import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCompany } from '../../lib/company';
import { useApi } from '../../lib/useApi';
import { withCompany, Tile, SectionCard } from '../../lib/portfolio';
import PageHeader from '../../components/PageHeader';
import { useRegisterCrumb } from '../../lib/breadcrumbs';
import { BackButton, EmptyState, Input, LoadingState, StatusPill } from '../../components/ui';
import { catLabel, type Overview } from './Regulations';
import { RequirementsTable } from './RequirementsTable';

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
type RuleRow = {
  id: string;
  ruleCode: string;
  category: string;
  description: string | null;
  ruleJson: unknown;
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
const label = (v: string) =>
  v
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

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
    title: 'Requirements',
    blurb:
      'Every requirement is one atomic legal obligation imposed by a regulation. Each should be mapped to the value stream(s) it governs — open a requirement and use edit links; linking applies it to every task under the stream.',
  },
  rules: {
    title: 'Agent rules',
    blurb:
      'Machine-readable rules derived from the requirements — encoded so agents can run compliance checks against them. A requirement states the legal obligation; an agent rule is the checkable control for it. Automated execution is a future phase.',
  },
  sources: {
    title: 'Regulatory sources',
    blurb:
      'The catalog of official regulator websites and feeds the requirements come from — statute pages, filing portals, and the pages where each regulator posts its bulletins and notices. Automated monitoring of these sources is a future phase — nothing is being polled today.',
  },
};

const LENS_TITLE: Record<string, string> = {
  state: 'State',
  federal: 'Federal',
  international: 'International',
};

export default function RegulationsInsight({ kind }: { kind: InsightKind }) {
  const { companyId } = useCompany();
  const [sp] = useSearchParams();
  // The active lens (from the card drill-down) scopes every query to that tab's
  // regulators in the DB — nothing is shown that doesn't belong to the tab.
  const lens = sp.get('lens') ?? undefined;
  const lensLabel = lens ? LENS_TITLE[lens] : undefined;
  useRegisterCrumb(lensLabel ? `${META[kind].title} · ${lensLabel}` : META[kind].title);
  const q = lens ? `?lens=${encodeURIComponent(lens)}` : '';
  const p = (path: string) => (companyId ? withCompany(`${path}${q}`, companyId) : null);

  const overview = useApi<Overview>(kind === 'catalog' ? p('/regulations/overview') : null);
  const jur = useApi<JurRow[]>(kind === 'jurisdictions' ? p('/regulations/jurisdictions') : null);
  const rules = useApi<RuleRow[]>(kind === 'rules' ? p('/regulations/rules') : null);
  const sources = useApi<SourceRow[]>(kind === 'sources' ? p('/regulations/sources') : null);

  return (
    <div>
      <PageHeader
        eyebrow={lensLabel ? `Regulations · ${lensLabel}` : 'Regulations'}
        title={META[kind].title}
        actions={
          <div className="flex items-center gap-2">
            <BackButton />
            <Link
              to="/regulations"
              className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
            >
              All regulations
            </Link>
          </div>
        }
      />
      <p className="text-sm text-[#525252] leading-relaxed mb-5 max-w-3xl">{META[kind].blurb}</p>

      {kind === 'jurisdictions' && <JurisdictionsBody rows={jur.data} loading={jur.loading} />}
      {kind === 'catalog' && <CatalogBody overview={overview.data} lens={lens} />}
      {kind === 'rules' && <RulesBody rows={rules.data} loading={rules.loading} />}
      {kind === 'sources' && <SourcesBody rows={sources.data} loading={sources.loading} />}
    </div>
  );
}

// ── Jurisdictions ────────────────────────────────────────────────────────────
function JurisdictionsBody({ rows, loading }: { rows: JurRow[] | null; loading: boolean }) {
  const navigate = useNavigate();
  if (loading || !rows) return <LoadingState />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        <Tile compact label="Jurisdictions" value={rows.length} />
      </div>
      <SectionCard title={`All jurisdictions (${rows.length})`}>
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
              <span className="flex-1" />
              <span className="text-xs text-[#525252] tnum">
                {j._count.requirements} requirements · {j._count.rules} rules · {j._count.sources}{' '}
                sources
              </span>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ── Requirements catalog ─────────────────────────────────────────────────────
// Charts come from the server-side aggregates in /overview (no all-rows load);
// the list is the shared server-driven paginated table.
function CatalogBody({ overview, lens }: { overview: Overview | null; lens?: string }) {
  if (!overview) return <LoadingState />;
  const r = overview.requirements;
  const byCategory = Object.entries(r.byCategory)
    .map(([k, n]) => [catLabel(k), n] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile compact label="Requirements" value={r.total.toLocaleString()} />
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
          value={r.unmapped.toLocaleString()}
          tone="negative"
          hint="still need mapping"
        />
        <Tile
          compact
          label="Verified"
          value={(r.byConfidence.VERIFIED ?? 0).toLocaleString()}
          hint="confirmed at the source"
        />
      </div>
      <SectionCard title="By category">
        <BarList data={byCategory} />
      </SectionCard>
      <SectionCard title="All requirements">
        <RequirementsTable baseParams={lens ? { lens } : {}} />
      </SectionCard>
    </div>
  );
}

// ── Compliance rules ─────────────────────────────────────────────────────────
function RulesBody({ rows, loading }: { rows: RuleRow[] | null; loading: boolean }) {
  const [query, setQuery] = useState('');
  const [openRule, setOpenRule] = useState<string | null>(null);
  const byCategory = useMemo(() => tally(rows ?? [], (r) => label(r.category)), [rows]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows ?? [];
    return (rows ?? []).filter(
      (r) =>
        r.ruleCode.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        r.jurisdiction.name.toLowerCase().includes(q) ||
        label(r.category).toLowerCase().includes(q),
    );
  }, [rows, query]);
  const grouped = useMemo(() => {
    const m = new Map<string, RuleRow[]>();
    for (const r of filtered) (m.get(r.category) ?? m.set(r.category, []).get(r.category)!).push(r);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);
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
      <SectionCard
        title={`All rules (${filtered.length})`}
        actions={
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rules…"
            aria-label="Search rules"
            className="max-w-xs"
          />
        }
      >
        {filtered.length === 0 && <EmptyState message="No rules match the search." />}
        {grouped.map(([cat, list]) => (
          <div key={cat} className="mb-4 last:mb-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#525252] mb-1.5">
              {label(cat)} <span className="tnum text-[#a3a3a3]">({list.length})</span>
            </div>
            <div className="divide-y divide-[#f5f5f5]">
              {list.map((r) => (
                <div key={r.id} className="py-1.5">
                  {/* Expand to the machine-readable rule body, same as the state page. */}
                  <button
                    type="button"
                    onClick={() => setOpenRule(openRule === r.id ? null : r.id)}
                    aria-expanded={openRule === r.id}
                    className="w-full text-left flex items-baseline gap-2 hover:bg-[#fafafa] -mx-2 px-2 rounded-md transition-colors duration-100 group"
                  >
                    <span className="text-xs font-medium tnum text-[#171717] flex-shrink-0 group-hover:underline">
                      {r.ruleCode}
                    </span>
                    <span className="text-[11px] text-[#a3a3a3] flex-shrink-0">
                      {r.jurisdiction.code}
                    </span>
                    <span className="text-xs text-[#525252] truncate flex-1">{r.description}</span>
                    <span className="text-[#a3a3a3] text-xs flex-shrink-0">
                      {openRule === r.id ? '▾' : '▸'}
                    </span>
                  </button>
                  {openRule === r.id && (
                    <pre className="mt-2 rounded-lg bg-[#fafafa] border border-[#eaeaea] p-3 text-[11px] text-[#262626] overflow-x-auto">
                      {JSON.stringify(r.ruleJson, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

// ── Regulatory sources ───────────────────────────────────────────────────────
function SourcesBody({ rows, loading }: { rows: SourceRow[] | null; loading: boolean }) {
  const byType = useMemo(() => tally(rows ?? [], (r) => label(r.sourceType)), [rows]);
  if (loading || !rows) return <LoadingState />;
  const states = new Set(rows.map((s) => s.jurisdiction?.code).filter(Boolean)).size;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        <Tile compact label="Sources" value={rows.length} hint="official regulator sites & feeds" />
        <Tile compact label="States covered" value={states} />
      </div>
      <SectionCard title="Sources by type">
        <BarList data={byType} />
      </SectionCard>
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
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
