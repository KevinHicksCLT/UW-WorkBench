import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../lib/company';
import { useApi } from '../../lib/useApi';
import { withCompany } from '../../lib/portfolio';
import { DrawerShell, EmptyState, LoadingState, StatusPill } from '../../components/ui';
import { catLabel, CONFIDENCE_HELP, OBLIGATION_HELP, type Overview } from './Regulations';

// Drill-down drawers behind the four Regulations overview cards (SCRUM-45).
// Each card opens a right-side DrawerShell that answers the "what is this
// number?" question in place: the jurisdictions on file (SCRUM-40 verified
// meaning), the active-regulation breakdown + value-stream coverage
// (SCRUM-41/43), the machine-readable compliance rules (SCRUM-46/77), and the
// monitored sources + bulletins feed (SCRUM-44).

/** Which overview card was clicked. */
export type DrillKind = 'jurisdictions' | 'regulations' | 'rules' | 'sources';

type JurRow = {
  id: string;
  code: string;
  name: string;
  regulatorName: string;
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
  origin: string;
  jurisdiction: { code: string; name: string };
};
type SourceRow = {
  id: string;
  name: string;
  url: string;
  sourceType: string;
  authority: string;
  monitor: boolean;
  checkTier: string;
  lastCheckedAt: string | null;
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

function Explainer({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[#525252] leading-relaxed mb-4">{children}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#525252] mt-5 mb-2 first:mt-0">
      {children}
    </div>
  );
}

const TITLES: Record<DrillKind, { title: string; eyebrow: string }> = {
  jurisdictions: { title: 'Jurisdictions on file', eyebrow: 'Regulations' },
  regulations: { title: 'Active regulations', eyebrow: 'Regulations' },
  rules: { title: 'Compliance rules', eyebrow: 'Regulations' },
  sources: { title: 'Monitored sources', eyebrow: 'Regulations' },
};

/** Right-side drill-down for one overview card. */
export function RegOverviewDrawer({
  kind,
  overview,
  onClose,
}: {
  kind: DrillKind;
  overview: Overview;
  onClose: () => void;
}) {
  const { companyId } = useCompany();
  const p = (path: string) => (companyId ? withCompany(path, companyId) : null);
  const jur = useApi<JurRow[]>(kind === 'jurisdictions' ? p('/regulations/jurisdictions') : null);
  const rules = useApi<RuleRow[]>(kind === 'rules' ? p('/regulations/rules') : null);
  const sources = useApi<SourceRow[]>(kind === 'sources' ? p('/regulations/sources') : null);
  const bulletins = useApi<BulletinRow[]>(kind === 'sources' ? p('/regulations/bulletins') : null);

  return (
    // Fixed wrapper gives the DrawerShell's absolute positioning a
    // viewport-sized box regardless of how far the page is scrolled.
    <div className="fixed inset-0 z-40">
      <DrawerShell
        onClose={onClose}
        width={560}
        maxWidth="94vw"
        header={
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#a3a3a3]">
              {TITLES[kind].eyebrow}
            </div>
            <div className="text-base font-semibold text-[#171717]">{TITLES[kind].title}</div>
          </div>
        }
      >
        {kind === 'jurisdictions' && <JurisdictionsBody rows={jur.data} loading={jur.loading} />}
        {kind === 'regulations' && <RegulationsBody overview={overview} />}
        {kind === 'rules' && <RulesBody rows={rules.data} loading={rules.loading} />}
        {kind === 'sources' && (
          <SourcesBody
            rows={sources.data}
            bulletins={bulletins.data}
            loading={sources.loading || bulletins.loading}
          />
        )}
      </DrawerShell>
    </div>
  );
}

// ── Jurisdictions ────────────────────────────────────────────────────────────
function JurisdictionsBody({ rows, loading }: { rows: JurRow[] | null; loading: boolean }) {
  const navigate = useNavigate();
  if (loading || !rows) return <LoadingState />;
  return (
    <div>
      <Explainer>
        Every state insurance regulator tracked in the baseline — federal and international
        regulators surface in their own lenses. <strong>Verified</strong> means the state&apos;s
        profile was confirmed against the regulator&apos;s official sources on that date; unverified
        profiles still carry the baseline research.
      </Explainer>
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
            <span className="text-xs text-[#525252] tnum">{j._count.requirements} regulations</span>
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
    </div>
  );
}

// ── Active regulations breakdown + coverage (SCRUM-41/43) ────────────────────
function RegulationsBody({ overview }: { overview: Overview }) {
  const r = overview.requirements;
  const coverage = overview.coverageByValueStream ?? [];
  return (
    <div>
      <Explainer>
        Every active regulation is one atomic obligation. Each should be mapped to the value
        stream(s) it governs — open its jurisdiction page and use <em>edit links</em>. Linking
        materializes the obligation onto every task under the stream, and all higher-level views
        roll up from those task links.
      </Explainer>
      <div className="grid grid-cols-3 gap-2 mb-1">
        <div className="rounded-lg border border-[#eaeaea] px-3 py-2 text-center">
          <div className="text-lg font-semibold tnum text-[#171717]">{r.total}</div>
          <div className="text-[10px] text-[#a3a3a3]">Active</div>
        </div>
        <div className="rounded-lg border border-[#eaeaea] px-3 py-2 text-center">
          <div className="text-lg font-semibold tnum text-[#047857]">{r.mapped}</div>
          <div className="text-[10px] text-[#a3a3a3]">Mapped</div>
        </div>
        <div className="rounded-lg border border-[#eaeaea] px-3 py-2 text-center">
          <div className="text-lg font-semibold tnum text-[#be123c]">{r.unmapped}</div>
          <div className="text-[10px] text-[#a3a3a3]">Unmapped</div>
        </div>
      </div>

      <SectionTitle>By confidence</SectionTitle>
      <div className="space-y-1.5">
        {Object.entries(r.byConfidence).map(([k, n]) => (
          <div key={k} className="flex items-start gap-2 text-xs">
            <span className="tnum w-8 text-right font-medium text-[#171717]">{n}</span>
            <span className="font-medium text-[#262626] w-16">{label(k)}</span>
            <span className="text-[#a3a3a3] flex-1">{CONFIDENCE_HELP[k] ?? ''}</span>
          </div>
        ))}
      </div>

      <SectionTitle>By category</SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(r.byCategory)
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => (
            <span key={k} className="chip">
              {catLabel(k)} <span className="tnum text-[#a3a3a3]">{n}</span>
            </span>
          ))}
      </div>

      <SectionTitle>Coverage by value stream</SectionTitle>
      <Explainer>
        How the mapped regulatory load distributes across the operating model — use it to see which
        value streams carry compliance obligations and where mapping is still thin.
      </Explainer>
      {coverage.length === 0 ? (
        <EmptyState message="No regulations are mapped to value streams yet." />
      ) : (
        <div className="space-y-1">
          {coverage.map((c) => (
            <div key={c.valueStreamId} className="flex items-center gap-2 text-xs">
              <span className="tnum w-8 text-right font-medium text-[#171717]">
                {c.requirementCount}
              </span>
              <span className="text-[#262626] truncate">{c.valueStream ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Compliance rules (SCRUM-46/77) ───────────────────────────────────────────
function RulesBody({ rows, loading }: { rows: RuleRow[] | null; loading: boolean }) {
  const navigate = useNavigate();
  if (loading || !rows) return <LoadingState />;
  const byCategory = new Map<string, RuleRow[]>();
  for (const r of rows) {
    (byCategory.get(r.category) ?? byCategory.set(r.category, []).get(r.category)!).push(r);
  }
  return (
    <div>
      <Explainer>
        Machine-readable controls distilled from each state&apos;s regulatory artifacts. They are
        <strong> distinct from active regulations</strong>: a regulation states the legal obligation
        ({OBLIGATION_HELP.FILING_GATE.toLowerCase()}, ongoing, …); a compliance rule encodes a
        checkable control for it. Phase 1 stores and displays them — automated execution against
        operational signals is a future phase. Each rule lives on its state&apos;s detail page under
        “Compliance rules”.
      </Explainer>
      {[...byCategory.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([cat, list]) => (
          <div key={cat}>
            <SectionTitle>
              {label(cat)} <span className="tnum text-[#a3a3a3]">({list.length})</span>
            </SectionTitle>
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
    </div>
  );
}

// ── Monitored sources + bulletins (SCRUM-44) ─────────────────────────────────
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
  if (loading || !rows) return <LoadingState />;
  return (
    <div>
      <Explainer>
        Official regulator websites and feeds the Phase-2 monitoring pipeline polls — priority
        states daily, the rest weekly — for new bulletins, rule changes and guidance. Anything it
        discovers lands in the bulletins feed below and on the issuing state&apos;s page.
      </Explainer>

      <SectionTitle>
        Bulletins on file <span className="tnum text-[#a3a3a3]">({bulletins?.length ?? 0})</span>
      </SectionTitle>
      {!bulletins?.length ? (
        <EmptyState message="No bulletins on file yet — the pipeline appends here continuously." />
      ) : (
        <div className="divide-y divide-[#f5f5f5] mb-2">
          {bulletins.map((b) => (
            <div key={b.id} className="py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#171717]">
                  {b.url ? (
                    <a className="hover:underline" href={b.url} target="_blank" rel="noreferrer">
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

      <SectionTitle>
        Sources <span className="tnum text-[#a3a3a3]">({rows.length})</span>
      </SectionTitle>
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
    </div>
  );
}
