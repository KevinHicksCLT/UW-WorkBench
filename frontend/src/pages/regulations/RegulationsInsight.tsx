import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCompany } from '../../lib/company';
import { useApi } from '../../lib/useApi';
import { withCompany, Tile, SectionCard } from '../../lib/portfolio';
import PageHeader from '../../components/PageHeader';
import { useRegisterCrumb } from '../../lib/breadcrumbs';
import { EmptyState, LoadingState, StatusPill } from '../../components/ui';
import { catLabel, CONFIDENCE_HELP, type Overview } from './Regulations';

// Overview-card insight pages — /regulations/{jurisdictions,catalog,rules,sources}.
// Each of the four Regulations summary cards drills into one of these: a stat
// strip, simple bar/donut graphics over the distribution behind the number,
// and a click-through list (states → /regulations/:code, rows →
// /regulations/requirement/:id).

export type InsightKind = 'jurisdictions' | 'catalog' | 'rules' | 'sources';

type JurRow = {
  id: string;
  code: string;
  name: string;
  regulatorName: string;
  filingPortal: string;
  workersCompModel: string;
  priorityTier: string;
  profileDepth: string;
  lastVerifiedAt: string | null;
  _count: { requirements: number; bulletins: number; rules: number; sources: number };
};
type ReqRow = {
  id: string;
  category: string;
  lineOfBusiness: string;
  confidence: string;
  jurisdiction: { code: string; regulatorType: string };
};
type RuleRow = {
  id: string;
  ruleCode: string;
  category: string;
  description: string | null;
  jurisdiction: { code: string; name: string };
};
type SourceRow = {
  id: string;
  name: string;
  url: string;
  sourceType: string;
  monitor: boolean;
  checkTier: string;
  healthStatus: string;
  jurisdiction: { code: string; name: string } | null;
};
type BulletinRow = {
  id: string;
  reference: string;
  title: string;
  summary: string | null;
  url: string | null;
  issuedDate: string | null;
  jurisdiction: { code: string; name: string };
};

const label = (v: string) =>
  v
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : null);

// ── Tiny chart primitives (page-local) ───────────────────────────────────────
/** Horizontal bar list — label, count, proportional bar. */
function BarList({ data, max: maxIn }: { data: [string, number][]; max?: number }) {
  const max = maxIn ?? Math.max(1, ...data.map(([, n]) => n));
  return (
    <div className="space-y-1.5">
      {data.map(([k, n]) => (
        <div key={k} className="flex items-center gap-2 text-xs">
          <span className="w-40 truncate text-[#525252]" title={k}>
            {k}
          </span>
          <span className="tnum w-10 text-right font-medium text-[#171717]">{n}</span>
          <div className="flex-1 h-2 rounded-full bg-[#f5f5f5] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#171717]"
              style={{ width: `${Math.max(2, (n / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const DONUT_COLORS = ['#171717', '#2563eb', '#d97706', '#dc2626', '#059669', '#a3a3a3'];
/** Conic-gradient donut with a legend. */
function Donut({
  data,
  legendHelp,
}: {
  data: [string, number][];
  legendHelp?: Record<string, string>;
}) {
  const total = data.reduce((s, [, n]) => s + n, 0) || 1;
  let acc = 0;
  const stops = data.map(([, n], i) => {
    const from = (acc / total) * 360;
    acc += n;
    const to = (acc / total) * 360;
    return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${from}deg ${to}deg`;
  });
  return (
    <div className="flex items-center gap-5">
      <div
        className="w-28 h-28 rounded-full flex-shrink-0"
        style={{ background: `conic-gradient(${stops.join(', ')})` }}
      >
        <div className="w-16 h-16 rounded-full bg-white relative top-6 left-6 flex items-center justify-center text-sm font-semibold tnum">
          {total}
        </div>
      </div>
      <div className="space-y-1">
        {data.map(([k, n], i) => (
          <div
            key={k}
            className="flex items-center gap-2 text-xs"
            title={legendHelp?.[k.toUpperCase().replace(/ /g, '_')]}
          >
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="text-[#525252]">{k}</span>
            <span className="tnum font-medium text-[#171717]">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const tally = <T,>(rows: T[], key: (r: T) => string): [string, number][] => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const META: Record<InsightKind, { title: string; blurb: string }> = {
  jurisdictions: {
    title: 'Jurisdictions',
    blurb:
      'Every state insurance regulator tracked in the baseline — federal and international regulators surface in their own lenses on the Regulations tab. Verified means the profile was confirmed against the regulator’s official sources.',
  },
  catalog: {
    title: 'Active regulations',
    blurb:
      'Every active regulation is one atomic obligation. Each should be mapped to the value stream(s) it governs — open a regulation and use edit links; linking materializes the obligation onto every task under the stream.',
  },
  rules: {
    title: 'Compliance rules',
    blurb:
      'Machine-readable controls distilled from each state’s regulatory artifacts — distinct from active regulations: a regulation states the legal obligation, a rule encodes a checkable control for it. Phase 1 stores and displays them; automated execution is a future phase.',
  },
  sources: {
    title: 'Monitored sources',
    blurb:
      'Official regulator websites and feeds the Phase-2 monitoring pipeline polls — priority states daily, the rest weekly — for new bulletins, rule changes and guidance. Discoveries land in the bulletins feed and on the issuing state’s page.',
  },
};

export default function RegulationsInsight({ kind }: { kind: InsightKind }) {
  const { companyId } = useCompany();
  useRegisterCrumb(META[kind].title);
  const p = (path: string) => (companyId ? withCompany(path, companyId) : null);

  const overview = useApi<Overview>(p('/regulations/overview'));
  const jur = useApi<JurRow[]>(kind === 'jurisdictions' ? p('/regulations/jurisdictions') : null);
  const reqs = useApi<ReqRow[]>(kind === 'catalog' ? p('/regulations/requirements') : null);
  const rules = useApi<RuleRow[]>(kind === 'rules' ? p('/regulations/rules') : null);
  const sources = useApi<SourceRow[]>(kind === 'sources' ? p('/regulations/sources') : null);
  const bulletins = useApi<BulletinRow[]>(kind === 'sources' ? p('/regulations/bulletins') : null);

  return (
    <div>
      <PageHeader
        eyebrow="Regulations"
        title={META[kind].title}
        actions={
          <Link
            to="/regulations"
            className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
          >
            All regulations
          </Link>
        }
      />
      <p className="text-sm text-[#525252] leading-relaxed mb-5 max-w-3xl">{META[kind].blurb}</p>

      {kind === 'jurisdictions' && (
        <JurisdictionsBody rows={jur.data} loading={jur.loading} overview={overview.data} />
      )}
      {kind === 'catalog' && (
        <CatalogBody rows={reqs.data} loading={reqs.loading} overview={overview.data} />
      )}
      {kind === 'rules' && <RulesBody rows={rules.data} loading={rules.loading} />}
      {kind === 'sources' && (
        <SourcesBody
          rows={sources.data}
          bulletins={bulletins.data}
          loading={sources.loading || bulletins.loading}
        />
      )}
    </div>
  );
}

// ── Jurisdictions ────────────────────────────────────────────────────────────
function JurisdictionsBody({
  rows,
  loading,
  overview,
}: {
  rows: JurRow[] | null;
  loading: boolean;
  overview: Overview | null;
}) {
  const navigate = useNavigate();
  if (loading || !rows) return <LoadingState />;
  const priority = rows.filter((j) => j.priorityTier === 'PRIORITY').length;
  const verified = rows.filter((j) => j.lastVerifiedAt).length;
  const full = rows.filter((j) => j.profileDepth === 'FULL_PROFILE').length;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile compact label="Jurisdictions" value={rows.length} />
        <Tile compact label="Priority states" value={priority} hint="deep compliance profiles" />
        <Tile compact label="Verified" value={verified} hint="confirmed against the regulator" />
        <Tile compact label="Full profiles" value={full} hint="complete operating detail" />
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <SectionCard title="Filing portal landscape">
          <BarList
            data={Object.entries(overview?.flags.filingPortal ?? {})
              .map(([k, n]) => [label(k), n] as [string, number])
              .sort((a, b) => b[1] - a[1])}
          />
        </SectionCard>
        <SectionCard title="Workers' comp model">
          <BarList
            data={Object.entries(overview?.flags.workersCompModel ?? {})
              .map(([k, n]) => [label(k), n] as [string, number])
              .sort((a, b) => b[1] - a[1])}
          />
        </SectionCard>
      </div>
      <SectionCard title="All jurisdictions">
        <div className="divide-y divide-[#f5f5f5]">
          {rows.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => navigate(`/regulations/${j.code}`)}
              className="w-full text-left py-2 flex items-center gap-2 hover:bg-[#fafafa] -mx-2 px-2 rounded-md transition-colors duration-100"
            >
              <span className="text-sm font-medium text-[#171717]">{j.name}</span>
              <span className="text-[11px] text-[#a3a3a3] tnum">{j.code}</span>
              {j.priorityTier === 'PRIORITY' && <StatusPill tone="amber">Priority</StatusPill>}
              <span className="flex-1" />
              <span className="text-xs text-[#525252] tnum">
                {j._count.requirements} regulations · {j._count.rules} rules · {j._count.sources}{' '}
                sources
              </span>
              {j.lastVerifiedAt ? (
                <StatusPill tone="green" title={`Profile verified ${fmtDate(j.lastVerifiedAt)}`}>
                  Verified
                </StatusPill>
              ) : (
                <StatusPill tone="slate">Baseline</StatusPill>
              )}
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ── Active regulations catalog ───────────────────────────────────────────────
function CatalogBody({
  rows,
  loading,
  overview,
}: {
  rows: ReqRow[] | null;
  loading: boolean;
  overview: Overview | null;
}) {
  const byCategory = useMemo(() => tally(rows ?? [], (r) => catLabel(r.category)), [rows]);
  const byLob = useMemo(
    () =>
      tally(rows ?? [], (r) =>
        r.lineOfBusiness === 'ALL' ? 'All lines' : label(r.lineOfBusiness),
      ),
    [rows],
  );
  if (loading || !rows || !overview) return <LoadingState />;
  const r = overview.requirements;
  const coverage = overview.coverageByValueStream ?? [];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile compact label="Active regulations" value={r.total} />
        <Tile
          compact
          label="Mapped"
          value={r.mapped}
          tone="positive"
          hint="linked to value streams"
        />
        <Tile
          compact
          label="Unmapped"
          value={r.unmapped}
          tone="negative"
          hint="still need mapping"
        />
        <Tile
          compact
          label="Verified"
          value={r.byConfidence.VERIFIED ?? 0}
          hint="confirmed at the source"
        />
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <SectionCard title="Confidence mix">
          <Donut
            data={Object.entries(r.byConfidence)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => [label(k), n] as [string, number])}
            legendHelp={CONFIDENCE_HELP}
          />
        </SectionCard>
        <SectionCard title="Coverage by value stream">
          {coverage.length === 0 ? (
            <EmptyState message="No regulations are mapped to value streams yet." />
          ) : (
            <BarList data={coverage.map((c) => [c.valueStream ?? '—', c.requirementCount])} />
          )}
        </SectionCard>
        <SectionCard title="By category">
          <BarList data={byCategory} />
        </SectionCard>
        <SectionCard title="By line of business">
          <BarList data={byLob} />
        </SectionCard>
      </div>
    </div>
  );
}

// ── Compliance rules ─────────────────────────────────────────────────────────
function RulesBody({ rows, loading }: { rows: RuleRow[] | null; loading: boolean }) {
  const navigate = useNavigate();
  const byCategory = useMemo(() => tally(rows ?? [], (r) => label(r.category)), [rows]);
  const grouped = useMemo(() => {
    const m = new Map<string, RuleRow[]>();
    for (const r of rows ?? [])
      (m.get(r.category) ?? m.set(r.category, []).get(r.category)!).push(r);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rows]);
  if (loading || !rows) return <LoadingState />;
  const states = new Set(rows.map((r) => r.jurisdiction.code)).size;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Tile compact label="Active rules" value={rows.length} />
        <Tile compact label="Categories" value={byCategory.length} />
        <Tile compact label="States covered" value={states} />
      </div>
      <SectionCard title="Rules by category">
        <BarList data={byCategory.slice(0, 15)} />
      </SectionCard>
      <SectionCard title="All rules">
        {grouped.map(([cat, list]) => (
          <div key={cat} className="mb-4 last:mb-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#525252] mb-1.5">
              {label(cat)} <span className="tnum text-[#a3a3a3]">({list.length})</span>
            </div>
            <div className="divide-y divide-[#f5f5f5]">
              {list.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/regulations/${r.jurisdiction.code}`)}
                  className="w-full text-left py-1.5 flex items-baseline gap-2 hover:bg-[#fafafa] -mx-2 px-2 rounded-md transition-colors duration-100"
                >
                  <span className="text-xs font-medium tnum text-[#171717] flex-shrink-0">
                    {r.ruleCode}
                  </span>
                  <span className="text-[11px] text-[#a3a3a3] flex-shrink-0">
                    {r.jurisdiction.code}
                  </span>
                  <span className="text-xs text-[#525252] truncate">{r.description}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

// ── Monitored sources + bulletins ────────────────────────────────────────────
function SourcesBody({
  rows,
  bulletins,
  loading,
}: {
  rows: SourceRow[] | null;
  bulletins: BulletinRow[] | null;
  loading: boolean;
}) {
  const navigate = useNavigate();
  const byType = useMemo(() => tally(rows ?? [], (r) => label(r.sourceType)), [rows]);
  if (loading || !rows) return <LoadingState />;
  const daily = rows.filter((s) => s.monitor && s.checkTier === 'PRIORITY_DAILY').length;
  const weekly = rows.filter((s) => s.monitor && s.checkTier !== 'PRIORITY_DAILY').length;
  const healthy = rows.filter((s) => s.healthStatus === 'OK').length;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile compact label="Sources" value={rows.length} hint={`${healthy} healthy`} />
        <Tile compact label="Checked daily" value={daily} hint="priority states" />
        <Tile compact label="Checked weekly" value={weekly} />
        <Tile compact label="Bulletins on file" value={bulletins?.length ?? 0} />
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <SectionCard title="Sources by type">
          <BarList data={byType} />
        </SectionCard>
        <SectionCard title={`Bulletins (${bulletins?.length ?? 0})`}>
          {!bulletins?.length ? (
            <EmptyState message="No bulletins on file yet — the pipeline appends here continuously." />
          ) : (
            <div className="divide-y divide-[#f5f5f5]">
              {bulletins.map((b) => (
                <div key={b.id} className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#171717]">
                      {b.url ? (
                        <a
                          className="hover:underline"
                          href={b.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {b.reference} ↗
                        </a>
                      ) : (
                        b.reference
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/regulations/${b.jurisdiction.code}`)}
                      className="text-[11px] text-[#525252] hover:text-[#171717] hover:underline"
                    >
                      {b.jurisdiction.name}
                    </button>
                    {b.issuedDate && (
                      <span className="text-xs text-[#a3a3a3] tnum">{fmtDate(b.issuedDate)}</span>
                    )}
                  </div>
                  {b.summary && <p className="text-xs text-[#525252] mt-0.5">{b.summary}</p>}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
      <SectionCard title="All sources">
        <div className="divide-y divide-[#f5f5f5]">
          {rows.map((s) => (
            <div key={s.id} className="flex items-center gap-2 py-1.5 text-sm min-w-0">
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-[#171717] hover:underline truncate"
              >
                {s.name} ↗
              </a>
              {s.jurisdiction && (
                <span className="text-[11px] text-[#a3a3a3] flex-shrink-0">
                  {s.jurisdiction.code}
                </span>
              )}
              <span className="flex-1" />
              <StatusPill tone="slate">{label(s.sourceType)}</StatusPill>
              {s.monitor && (
                <StatusPill tone="amber">
                  {s.checkTier === 'PRIORITY_DAILY' ? 'Daily' : 'Weekly'}
                </StatusPill>
              )}
              <StatusPill tone={s.healthStatus === 'OK' ? 'green' : 'red'}>
                {label(s.healthStatus)}
              </StatusPill>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
