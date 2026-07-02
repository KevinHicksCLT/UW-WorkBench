import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import PageHeader from '../../components/PageHeader';
import SignalCatalog from '../../components/SignalCatalog';
import { Card, EmptyState, ErrorMessage, LoadingState } from '../../components/ui';
import { MODES, HEAT } from '../../lib/aiAdoption';

// Metrics — the AI program in two stages (D6.3), both DB-driven:
//   Stage 1 "Analysis coverage" — how much of the operating model (value
//     streams, org groups, roles) has been analyzed for AI opportunity, when we
//     expect to finish, and whether we're on plan. Source: AnalysisStatus rows
//     vs the canonical node tree (/ai-analysis/summary), edited in Data Admin.
//   Stage 2 "AI adoption" — % of tasks automated / discarded / augmented,
//     broken down by org group, role, task category, deliverable type and value
//     stream. Source: Task.aiDisposition over the canonical Task table.
// Below both sits the existing value-stream × AI-mode heat map (NodeAiAdoption).

// Canonical value stream (Node) + its AI-adoption levels (0-4 per mode),
// from /explorer/value-stream-adoption. Edited in Data Admin → Metrics → AI adoption.
type ValueStream = {
  id: string; name: string; domain: string | null; cells: number[];
};

type CoverageRow = {
  type: string; label: string; total: number; complete: number; inProgress: number;
  notStarted: number; pctComplete: number; expectedFinish: string | null;
  overdue: number; onPlan: boolean;
};
type BreakdownRow = {
  name: string; total: number; automated: number; discarded: number; augmented: number; manual: number;
};
type DimensionKey = 'division' | 'role' | 'category' | 'deliverableType' | 'valueStream';
type Inventory = {
  orgs: number; valueStreams: number; roles: number; tasks: number; deliverables: number; applications: number;
};
type Summary = {
  inventory: Inventory;
  coverage: CoverageRow[];
  adoption: {
    totalTasks: number;
    counts: { automated: number; discarded: number; augmented: number; manual: number };
    pct: { automated: number; discarded: number; augmented: number; manual: number };
    breakdowns: Record<DimensionKey, BreakdownRow[]>;
  };
};

// Task-disposition palette — the same traffic-light scheme as the heat map
// (HEAT greens/amber/grey), so the two sections read as one system.
const DISPOSITIONS = [
  { key: 'automated', label: 'Automated', bg: '#16a34a', fg: '#ffffff' },
  { key: 'augmented', label: 'AI augmented', bg: '#bbf7d0', fg: '#15803d' },
  { key: 'discarded', label: 'Discarded', bg: '#fef3c7', fg: '#b45309' },
  { key: 'manual', label: 'Still manual', bg: '#f5f5f5', fg: '#737373' },
] as const;

const DIMENSIONS: [DimensionKey, string][] = [
  ['division', 'Org groups'],
  ['role', 'Roles'],
  ['category', 'Task categories'],
  ['deliverableType', 'Deliverable types'],
  ['valueStream', 'Value streams'],
];

// Stage 1 baseline inventory — the size of the current operating model. Pure
// counts of each canonical entity (no analysis tracking implied), ordered as the
// client reads the model: structure → people → work → outputs → systems.
const INVENTORY: [keyof Inventory, string][] = [
  ['orgs', 'Orgs'],
  ['valueStreams', 'Value streams'],
  ['roles', 'Roles'],
  ['tasks', 'Tasks'],
  ['deliverables', 'Deliverables'],
  ['applications', 'Applications'],
];

const fmtMonth = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';

// Compact headline stat — small padding/type (D6.2: no oversized boxes).
function Stat({ label, value, hint, color }: { label: string; value: string | number; hint?: string; color?: string }) {
  return (
    <Card variant="elevated" className="px-3 py-1.5 flex items-baseline gap-2 flex-wrap">
      <span className="text-lg font-semibold tnum leading-snug" style={{ color: color ?? '#171717' }}>{value}</span>
      <span className="min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{label}</span>
        {hint && <span className="text-[10px] text-[#a3a3a3]"> · {hint}</span>}
      </span>
    </Card>
  );
}

export default function ActiveAI() {
  const { companyId, company, loading: companyLoading } = useCompany();
  const [streams, setStreams] = useState<ValueStream[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'adoption' | 'signals'>('adoption');
  const [dimension, setDimension] = useState<DimensionKey>('division');

  useEffect(() => {
    if (companyLoading) return;
    setLoading(true);
    setError('');
    const qs = companyId ? `?companyId=${companyId}` : '';
    Promise.all([
      api.get('/explorer/value-stream-adoption'),
      api.get(`/ai-analysis/summary${qs}`),
    ])
      .then(([adoption, sum]) => { setStreams(adoption.valueStreams ?? []); setSummary(sum); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [companyId, companyLoading]);

  // Build the heat matrix: one row per value stream, one cell (level) per mode.
  const rows = useMemo(() =>
    streams.map((vs) => ({ vs, cells: vs.cells ?? [0, 0, 0, 0] })), [streams]);

  // Group rows by value-stream domain for readable section headers.
  const groups = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = r.vs.domain ?? 'Unassigned';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  // Headline coverage stats across the heat map (inlined in its header).
  const heatStats = useMemo(() => {
    const total = rows.length;
    const anyAi = rows.filter((r) => r.cells.some((c) => c > 0)).length;
    const autonomous = rows.filter((r) => r.cells[3] >= 2).length;
    return { total, anyAi, autonomous };
  }, [rows]);

  const breakdown = summary?.adoption.breakdowns[dimension] ?? [];

  return (
    <div>
      <PageHeader
        title="Metrics"
        subtitle="The AI program in two stages: first analyze the operating model, then adopt — automate, augment or discard the work itself."
        eyebrow={company?.name}
        dense
      />

      {/* Sub-view switcher — AI adoption vs the trackable-signal catalog. */}
      <div className="border-b border-[#eaeaea] mb-2 flex gap-1">
        {([['adoption', 'AI Adoption'], ['signals', 'Trackable Metrics']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={
              'px-4 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 ' +
              (view === v ? 'text-[#171717] border-[#171717]' : 'text-[#a3a3a3] border-transparent hover:text-[#525252]')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'signals' ? (
        <SignalCatalog companyId={companyId} />
      ) : loading || companyLoading ? (
        <LoadingState baseClassName="py-8 text-sm text-[#a3a3a3]" />
      ) : error ? (
        <ErrorMessage baseClassName="py-8 text-sm text-[#be123c]">{error}</ErrorMessage>
      ) : (
      <>
      {/* ── Stage 1 · Current State Analysis ─────────────────────────────────── */}
      <Card variant="elevated" className="overflow-hidden mb-2.5">
        <div className="px-4 py-2.5 border-b border-[#eaeaea]">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">Stage 1</span>
            <h2 className="text-base font-semibold text-[#171717]">Current State Analysis</h2>
          </div>
          <p className="text-[11px] text-[#666666] mt-0.5">
            Baseline inventory of today's operating model — the orgs, value streams, roles, tasks, deliverables and
            applications a client must understand before planning a multi-year AI transformation.
          </p>
        </div>

        {/* Baseline inventory — pure counts of each canonical entity (Stage 1). */}
        <div className="px-4 py-3 grid grid-cols-3 sm:grid-cols-6 gap-2 border-b border-[#eaeaea]">
          {INVENTORY.map(([key, label]) => (
            <Card key={key} variant="elevated" className="px-3 py-2.5 flex flex-col gap-0.5">
              <span className="text-2xl font-semibold tnum leading-none text-[#171717]">
                {(summary?.inventory[key] ?? 0).toLocaleString()}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{label}</span>
            </Card>
          ))}
        </div>

        {/* Analysis coverage — how much of the model has been assessed. */}
        <div className="px-4 py-1.5 flex items-baseline gap-2 flex-wrap border-b border-[#f5f5f5]">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#525252]">Analysis coverage</h3>
          <p className="text-[11px] text-[#666666] min-w-0 truncate" title="In-progress fill shows analyses underway. Analysis status per value stream / org group / role is edited in Data Admin → Analysis Status.">
            How much of the operating model has been assessed for AI opportunity, and whether the remaining work is on plan.
          </p>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#eaeaea] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">
              <th className="text-left px-4 py-1.5">Subject</th>
              <th className="text-left px-2 py-1.5">Analyzed</th>
              <th className="text-left px-2 py-1.5 w-[34%]">Progress</th>
              <th className="text-right px-2 py-1.5">% complete</th>
              <th className="text-right px-2 py-1.5">Expected finish</th>
              <th className="text-right px-4 py-1.5">Plan</th>
            </tr>
          </thead>
          <tbody>
            {(summary?.coverage ?? []).map((c) => (
              <tr key={c.type} className="border-b border-[#f5f5f5] last:border-0">
                <td className="px-4 py-1 text-sm font-medium text-[#171717]">{c.label}</td>
                <td className="px-2 py-1 text-sm text-[#525252] tnum whitespace-nowrap">{c.complete}/{c.total}</td>
                <td className="px-2 py-1">
                  <div className="h-3 rounded bg-[#f5f5f5] overflow-hidden flex" title={`${c.complete} complete · ${c.inProgress} in progress · ${c.notStarted} not started`}>
                    <div style={{ width: `${(100 * c.complete) / Math.max(1, c.total)}%`, backgroundColor: '#16a34a' }} />
                    <div style={{ width: `${(100 * c.inProgress) / Math.max(1, c.total)}%`, backgroundColor: '#bbf7d0' }} />
                  </div>
                </td>
                <td className="px-2 py-1 text-sm text-[#171717] tnum text-right">{c.pctComplete}%</td>
                <td className="px-2 py-1 text-sm text-[#525252] tnum text-right whitespace-nowrap">{fmtMonth(c.expectedFinish)}</td>
                <td className="px-4 py-1 text-right">
                  {c.onPlan ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: '#bbf7d0', color: '#15803d' }}>On plan</span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                      Behind · {c.overdue} overdue
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ── Stage 2 · AI adoption ────────────────────────────────────────────── */}
      <Card variant="elevated" className="overflow-hidden mb-2.5">
        <div className="px-4 py-2.5 border-b border-[#eaeaea] flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">Stage 2</span>
              <h2 className="text-base font-semibold text-[#171717]">Adoption Telemetry</h2>
            </div>
            <p className="text-[11px] text-[#666666] mt-0.5" title="Computed from the canonical Task table (aiDisposition per task) — the same rows as Deliverables & Tasks; edited in Data Admin → Task.">
              Of {summary?.adoption.totalTasks.toLocaleString() ?? 0} tasks, how many were automated, AI-augmented or discarded outright.
            </p>
          </div>
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
            {DISPOSITIONS.map((d) => (
              <span key={d.key} className="inline-flex items-center gap-1.5 text-[10px] text-[#666666]">
                <span className="inline-block h-3 w-3 rounded-sm border border-black/5" style={{ backgroundColor: d.bg }} />
                {d.label}
              </span>
            ))}
          </div>
        </div>

        {/* Compact headline stats (D6.2) */}
        <div className="px-4 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-[#f5f5f5]">
          <Stat label="Tasks automated" value={`${summary?.adoption.pct.automated ?? 0}%`} hint={`${summary?.adoption.counts.automated.toLocaleString()} tasks`} color="#15803d" />
          <Stat label="Tasks discarded" value={`${summary?.adoption.pct.discarded ?? 0}%`} hint={`${summary?.adoption.counts.discarded.toLocaleString()} eliminated`} color="#b45309" />
          <Stat label="AI augmented" value={`${summary?.adoption.pct.augmented ?? 0}%`} hint={`${summary?.adoption.counts.augmented.toLocaleString()} tasks`} />
          <Stat label="Still manual" value={`${summary?.adoption.pct.manual ?? 0}%`} hint={`${summary?.adoption.counts.manual.toLocaleString()} tasks`} />
        </div>

        {/* Breakdown dimension switcher */}
        <div className="px-4 pt-1 flex gap-1 flex-wrap border-b border-[#f5f5f5]">
          {DIMENSIONS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDimension(key)}
              className={
                'px-3 py-1 text-[11px] font-medium border-b-2 -mb-px transition-colors duration-150 ' +
                (dimension === key ? 'text-[#171717] border-[#171717]' : 'text-[#a3a3a3] border-transparent hover:text-[#525252]')
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* One stacked bar per group — share of tasks automated/augmented/discarded/manual */}
        <div className="px-4 py-2">
          <div className="grid grid-cols-[minmax(140px,220px)_1fr_auto_auto] gap-x-3 items-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] py-1">{DIMENSIONS.find(([k]) => k === dimension)?.[1]}</div>
            <div />
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] text-right w-14">Auto</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] text-right w-14">Disc</div>
            {breakdown.map((b) => {
              const pct = (n: number) => (b.total ? Math.round((100 * n) / b.total) : 0);
              return (
                <Fragment key={b.name}>
                  <div className="text-xs text-[#171717] truncate py-1" title={`${b.name} · ${b.total} tasks`}>{b.name}</div>
                  <div className="h-4 rounded overflow-hidden flex bg-[#f5f5f5]" title={`${b.total} tasks — ${pct(b.automated)}% automated · ${pct(b.augmented)}% augmented · ${pct(b.discarded)}% discarded · ${pct(b.manual)}% manual`}>
                    {DISPOSITIONS.map((d) => (
                      <div key={d.key} style={{ width: `${(100 * b[d.key]) / Math.max(1, b.total)}%`, backgroundColor: d.bg }} />
                    ))}
                  </div>
                  <div className="text-xs tnum text-right w-14" style={{ color: '#15803d' }}>{pct(b.automated)}%</div>
                  <div className="text-xs tnum text-right w-14" style={{ color: '#b45309' }}>{pct(b.discarded)}%</div>
                </Fragment>
              );
            })}
          </div>
          {breakdown.length === 0 && (
            <EmptyState baseClassName="py-6 text-sm text-[#a3a3a3] italic" message="No assessed tasks yet for this breakdown." />
          )}
        </div>
      </Card>

      {/* ── Value-stream × AI-mode heat map ────────────────────────────────── */}
      <Card variant="elevated" className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#eaeaea] flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-[#171717]">Adoption by value stream</h2>
            <p className="text-[11px] text-[#666666] mt-0.5">
              How far each value stream has taken AI at every point on the autonomy spectrum — {heatStats.anyAi}/{heatStats.total} streams with AI in use, {heatStats.autonomous} running autonomous agents beyond pilot. Click a stream to drill in.
            </p>
          </div>
          {/* Legend — the level IS the traffic light (red behind → green ahead) */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
            {HEAT.map((h) => (
              <span key={h.name} className="inline-flex items-center gap-1.5 text-[10px] text-[#666666]">
                <span className="inline-block h-3 w-3 rounded-sm border border-black/5" style={{ backgroundColor: h.bg }} />
                {h.name}
              </span>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState baseClassName="px-5 py-10 text-sm text-[#a3a3a3] italic" message="No value streams defined for this company." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[720px]">
              <thead>
                <tr className="border-b border-[#eaeaea]">
                  <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] sticky left-0 bg-white z-10">
                    Value stream
                  </th>
                  {MODES.map((m) => (
                    <th key={m.key} className="px-2 py-2.5 text-center align-bottom" title={m.desc}>
                      <div className="text-[11px] font-semibold text-[#171717] leading-tight">{m.short}</div>
                      <div className="text-[10px] text-[#a3a3a3] font-normal leading-tight">{m.label}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(([domain, grp]) => (
                  <DomainGroup key={domain} domain={domain} rows={grp} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mode descriptions footer */}
        <div className="px-5 py-3 border-t border-[#eaeaea] bg-[#fafafa] grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1.5">
          {MODES.map((m) => (
            <div key={m.key} className="text-[11px] text-[#666666]">
              <span className="font-semibold text-[#171717]">{m.label}:</span> {m.desc}
            </div>
          ))}
        </div>
      </Card>

      <p className="text-[11px] text-[#a3a3a3] mt-3 italic">
        Adoption levels are read from the operating model (the same value streams as Value Streams and Home) and edited in
        Data Admin → Metrics → AI adoption. Streams with no AI yet show “Not used”.
      </p>
      </>
      )}
    </div>
  );
}

// One domain section: a collapsible sub-header row, then its value-stream rows.
function DomainGroup({ domain, rows }: { domain: string; rows: { vs: ValueStream; cells: number[] }[] }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <tr className="bg-[#fafafa] border-b border-[#eaeaea] cursor-pointer hover:bg-[#f5f5f5]" onClick={() => setOpen((v) => !v)}>
        <td colSpan={MODES.length + 1} className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#666666] sticky left-0 bg-[#fafafa]">
          <button type="button" aria-expanded={open} className="inline-flex items-center gap-1.5 text-left">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={'text-[#a3a3a3] transition-transform duration-150 ' + (open ? '' : '-rotate-90')} aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
            {domain} <span className="text-[#a3a3a3] font-normal">· {rows.length}</span>
          </button>
        </td>
      </tr>
      {open && rows.map(({ vs, cells }) => (
        <tr key={vs.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] group">
          <td className="px-5 py-2 sticky left-0 bg-white group-hover:bg-[#fafafa] z-10">
            {/* Drill one level DEEPER into the stream's AI profile (use cases,
                role utilization, efficiency) — not across to the value-stream
                page; that stays reachable from the drill-in's header. */}
            <Link to={`/metrics/${vs.id}`} className="text-sm text-[#171717] group-hover:text-[#4338ca] truncate block max-w-[260px]">
              {vs.name}
            </Link>
          </td>
          {cells.map((lvl, i) => {
            const h = HEAT[lvl];
            return (
              <td key={i} className="px-1.5 py-1.5">
                <div
                  className="h-7 rounded flex items-center justify-center text-[10px] font-medium select-none"
                  style={{ backgroundColor: h.bg, color: h.fg }}
                  title={`${vs.name} · ${MODES[i].label}: ${h.name}`}
                >
                  {h.short}
                </div>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
