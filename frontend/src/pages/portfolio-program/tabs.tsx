/**
 * Tab views of the Portfolio Program page — Budget & spend card, Workstreams,
 * Pipeline, Roadmap, and the cross-initiative Resources utilization + finance
 * grid, plus the shared payload types. Extracted from PortfolioProgram.tsx.
 * (Prioritization moved to the Home dashboard: components/home/TransformationWidgets.tsx.)
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { fmt, STAGE_ORDER, STAGE_LABELS } from '../../lib/format';
import { Button, Card, EmptyState, ErrorMessage, LoadingState } from '../../components/ui';
import {
  StatusPill,
  StageBar,
  makeTimelineScale,
  TimelineAxis,
  TimelineGrid,
} from '../../lib/portfolio';

export type InitRow = {
  id: string;
  name: string;
  stage: string;
  status: string;
  startDate: string;
  dueDate: string;
  valueScore: number;
  complexityScore: number;
  cumulativeBenefit: number;
  cumulativeNetBenefit: number;
  ownerRoleName: string | null;
  valueStreamName: string | null;
};
export type Program = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  computedStatus?: string;
  statusOverridden?: boolean;
  workstreams: {
    id: string;
    name: string;
    status: string;
    computedStatus?: string;
    statusOverridden?: boolean;
    initiatives: InitRow[];
  }[];
};
export type Summary = {
  initiativeCount: number;
  totalBenefit: number;
  totalCost: number;
  netBenefit: number;
  budget: number;
  forecastSpend: number;
  actualSpend: number;
};
type ResourceRow = {
  name: string;
  roleName: string | null;
  totalAllocationPct: number;
  overUtilized: boolean;
  assignments: {
    initiativeId: string;
    initiativeName: string;
    allocationPct: number;
    startDate: string;
    endDate: string;
  }[];
  // Finance profile (ProgramResource): engagement window, type, monthly rate,
  // and manual month-amount overrides for current/future months.
  roleType: 'EMPLOYEE' | 'CONTRACTOR' | null;
  rate: number | null;
  rollOn: string | null;
  rollOff: string | null;
  monthAmounts: Record<string, number>;
};

export const STATUS_COLOR: Record<string, string> = {
  ON_TRACK: '#047857',
  AT_RISK: '#b45309',
  OFF_TRACK: '#be123c',
};

// ── BUDGET vs SPEND (FB-03) ───────────────────────────────────────────────
// Project budget (cost TARGET), forecasted spend (FORECAST) and actual
// spend-to-date (ACTUAL) as one comparable bar set, scaled to the largest of
// the three, plus % of budget spent.
export function BudgetSpendCard({ summary }: { summary: Summary | null }) {
  const budget = summary?.budget ?? 0;
  const forecast = summary?.forecastSpend ?? 0;
  const actual = summary?.actualSpend ?? 0;
  const max = Math.max(1, budget, forecast, actual);
  const pctSpent = budget > 0 ? Math.round((actual / budget) * 100) : null;
  const rows: { label: string; value: number; color: string }[] = [
    { label: 'Project budget', value: budget, color: '#4f46e5' },
    { label: 'Forecasted spend', value: forecast, color: '#0d9488' },
    { label: 'Actual spend-to-date', value: actual, color: '#171717' },
  ];
  return (
    <Card variant="elevated" className="p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-[#171717]">Budget &amp; spend</h3>
        <span className="text-xs text-[#a3a3a3]">
          {pctSpent === null ? (
            'No budget set'
          ) : (
            <>
              <span className="font-semibold text-[#171717] tnum">{pctSpent}%</span> of budget spent
            </>
          )}
        </span>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <div className="w-40 text-xs text-[#525252] flex-shrink-0">{r.label}</div>
            <div className="flex-1 h-5 bg-[#f5f5f5] rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${(r.value / max) * 100}%`,
                  backgroundColor: r.color,
                  minWidth: r.value ? 2 : 0,
                }}
              />
            </div>
            <div className="w-20 text-right text-xs text-[#171717] tnum flex-shrink-0">
              {fmt.currency(r.value, { compact: true })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── WORKSTREAMS ──────────────────────────────────────────────────────────
export function WorkstreamsTab({
  program,
  onCreateInit,
}: {
  program: Program;
  onCreateInit: (ws: { id: string; name: string }) => void;
}) {
  return (
    <div className="space-y-4">
      {program.workstreams.map((ws) => (
        <Card key={ws.id} variant="elevated" className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-[#f5f5f5]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
              <h3 className="font-semibold text-[#171717]">{ws.name}</h3>
              <StatusPill status={ws.computedStatus ?? ws.status} />
              {ws.statusOverridden && (
                <span
                  className="text-[10px] text-[#b45309]"
                  title={`Manually set to ${ws.status.replaceAll('_', ' ').toLowerCase()} — rolled-up health from its initiatives differs`}
                >
                  override
                </span>
              )}
              <span className="text-xs text-[#a3a3a3]">
                {ws.initiatives.length} initiative{ws.initiatives.length !== 1 && 's'}
              </span>
            </div>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => onCreateInit({ id: ws.id, name: ws.name })}
            >
              + Initiative
            </Button>
          </div>
          {ws.initiatives.length === 0 ? (
            <EmptyState baseClassName="text-sm text-[#a3a3a3] py-2" message="No initiatives yet." />
          ) : (
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
                  <tr>
                    <th className="text-left pb-2 font-semibold">Initiative</th>
                    <th className="text-left pb-2 font-semibold w-40">Stage</th>
                    <th className="text-center pb-2 font-semibold w-24">Status</th>
                    <th className="text-left pb-2 font-semibold pl-3 w-40">Value stream</th>
                  </tr>
                </thead>
                <tbody>
                  {ws.initiatives.map((init) => (
                    <tr key={init.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]">
                      <td className="py-2.5">
                        <Link
                          to={`/initiatives/${init.id}`}
                          className="font-medium text-[#171717] hover:text-[#4f46e5]"
                        >
                          {init.name}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        <StageBar stage={init.stage} />
                      </td>
                      <td className="py-2.5 text-center">
                        <StatusPill status={init.status} />
                      </td>
                      <td className="py-2.5 pl-3 text-[#666666] text-xs truncate">
                        {init.valueStreamName ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── PIPELINE ─────────────────────────────────────────────────────────────
export function PipelineTab({ program }: { program: Program }) {
  const all = program.workstreams.flatMap((ws) => ws.initiatives);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-start">
      {STAGE_ORDER.map((stage) => {
        const inits = all.filter((i) => i.stage === stage);
        return (
          <Card key={stage} variant="elevated" className="p-3">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#f5f5f5]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">
                {STAGE_LABELS[stage]}
              </span>
              <span className="text-xs text-[#171717] tnum">{inits.length}</span>
            </div>
            {inits.length === 0 ? (
              <div className="text-xs text-[#a3a3a3] py-2">—</div>
            ) : (
              <div className="space-y-2">
                {inits.map((i) => (
                  <Link
                    key={i.id}
                    to={`/initiatives/${i.id}`}
                    className="block border border-[#eaeaea] rounded-md p-2.5 hover:border-[#a3a3a3] transition-colors"
                  >
                    <div className="text-sm font-medium text-[#171717] leading-snug mb-1.5">
                      {i.name}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill status={i.status} />
                      <span className="text-xs text-[#666666] tnum" title="Value score">
                        V {i.valueScore}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ── ROADMAP ──────────────────────────────────────────────────────────────
export function RoadmapTab({ program }: { program: Program }) {
  const all = program.workstreams.flatMap((ws) => ws.initiatives);
  const scale = makeTimelineScale(all.flatMap((i) => [i.startDate, i.dueDate]));
  if (!scale)
    return (
      <Card variant="elevated" className="p-5 text-sm text-[#a3a3a3]">
        No initiatives to plot.
      </Card>
    );

  return (
    <Card variant="elevated" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[#171717]">Roadmap</h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#525252]">
          {Object.entries(STATUS_COLOR).map(([k, c]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: c }} />
              {k.replaceAll('_', ' ').toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-3 border-b border-[#eaeaea] pb-0.5 mb-1">
        <div className="w-56 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <TimelineAxis scale={scale} />
        </div>
      </div>

      {program.workstreams.map((ws) => (
        <div key={ws.id} className="mb-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] py-1.5">
            {ws.name}
          </div>
          <div className="flex gap-3">
            <div className="w-56 flex-shrink-0">
              {ws.initiatives.map((i) => (
                <div key={i.id} className="h-8 flex items-center min-w-0">
                  <Link
                    to={`/initiatives/${i.id}`}
                    className="text-sm font-medium text-[#171717] hover:text-[#4f46e5] truncate"
                  >
                    {i.name}
                  </Link>
                </div>
              ))}
              {ws.initiatives.length === 0 && (
                <div className="h-8 flex items-center text-xs text-[#a3a3a3]">No initiatives</div>
              )}
            </div>
            <div className="flex-1 min-w-0 relative">
              <TimelineGrid scale={scale} />
              {ws.initiatives.map((i) => {
                const left = scale.pct(i.startDate);
                const width = Math.max(1.2, scale.pct(i.dueDate) - left);
                return (
                  <div key={i.id} className="h-8 relative">
                    <div
                      className="absolute top-2 h-4 rounded"
                      title={`${i.name} — ${fmt.date(i.startDate)} → ${fmt.date(i.dueDate)}`}
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        backgroundColor: STATUS_COLOR[i.status] ?? '#171717',
                      }}
                    />
                  </div>
                );
              })}
              {ws.initiatives.length === 0 && <div className="h-8" />}
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}

// ── RESOURCES ────────────────────────────────────────────────────────────
// Resource utilization + finance grid: per resource — engagement window (roll
// on/off), employment type, monthly rate, and a month-by-month cost grid
// spanning 6 past months (calculated, locked) and 12 months from the current
// one (editable overrides). Row totals, per-month column totals, and a grand
// total (row totals Σ == column totals Σ) close the grid.
type MonthCol = { key: string; label: string; past: boolean };

function monthColumns(): MonthCol[] {
  const now = new Date();
  const cols: MonthCol[] = [];
  for (let off = -6; off <= 11; off++) {
    const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
    cols.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label:
        d.toLocaleDateString('en-US', { month: 'short' }) + " '" + String(d.getFullYear()).slice(2),
      past: off < 0,
    });
  }
  return cols;
}

// Calculated month amount = monthly rate × the summed allocation % of the
// assignments overlapping that month, zeroed outside the roll on/off window.
function calcAmount(r: ResourceRow, monthKey: string): number {
  if (r.rate == null) return 0;
  const [y, m] = monthKey.split('-').map(Number);
  const mStart = new Date(y, m - 1, 1);
  const mEnd = new Date(y, m, 0);
  if (r.rollOn && mEnd < new Date(r.rollOn)) return 0;
  if (r.rollOff && mStart > new Date(r.rollOff)) return 0;
  const alloc = r.assignments.reduce((a, as) => {
    const s = new Date(as.startDate),
      e = new Date(as.endDate);
    return s <= mEnd && e >= mStart ? a + as.allocationPct : a;
  }, 0);
  return Math.round(r.rate * (alloc / 100));
}

// Displayed amount: past months are always the calculation; current/future
// months honour a manual override when one is saved.
const cellAmount = (r: ResourceRow, col: MonthCol): number =>
  col.past ? calcAmount(r, col.key) : (r.monthAmounts[col.key] ?? calcAmount(r, col.key));

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

export function ProgramResourcesTab({ programId }: { programId: string }) {
  const [rows, setRows] = useState<ResourceRow[] | null>(null);
  const [error, setError] = useState('');
  const months = useMemo(monthColumns, []);

  function load() {
    api
      .get<ResourceRow[]>(`/portfolio/programs/${programId}/resources`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
  }, [programId]);

  async function patch(name: string, body: Record<string, unknown>) {
    try {
      await api.patch(`/portfolio/programs/${programId}/resources`, { name, ...body });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!rows) return <LoadingState />;

  const over = rows.filter((r) => r.overUtilized).length;
  const rowTotal = (r: ResourceRow) => months.reduce((a, c) => a + cellAmount(r, c), 0);
  const colTotal = (c: MonthCol) => rows.reduce((a, r) => a + cellAmount(r, c), 0);
  const grandTotal = rows.reduce((a, r) => a + rowTotal(r), 0);

  // Dense grid cells — intentionally more compact than the shared `.input`
  // form control, so the 18-month grid stays scannable.
  const th = 'pb-2 font-semibold whitespace-nowrap';
  const cellInput =
    'w-20 rounded border border-[#eaeaea] bg-white px-1.5 py-0.5 text-xs text-center tnum focus:outline-none focus:border-[#171717]';

  return (
    <Card variant="elevated" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[#171717]">Resource utilization</h3>
        <span className={'text-xs ' + (over > 0 ? 'text-[#be123c] font-medium' : 'text-[#a3a3a3]')}>
          {over > 0
            ? `${over} of ${rows.length} resources over-allocated (>100% active today)`
            : `${rows.length} resources — none over-allocated today`}
        </span>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          baseClassName="text-sm text-[#a3a3a3] py-2"
          message="No resources assigned across this program's initiatives yet."
        />
      ) : (
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
              <tr>
                <th className={`text-left ${th}`}>Resource</th>
                <th className={`text-left ${th}`}>Role</th>
                <th className={`text-center ${th}`}>Role Type</th>
                <th className={`text-center ${th}`}>Rate</th>
                <th className={`text-center ${th}`}>Start</th>
                <th className={`text-center ${th}`}>End</th>
                <th className={`text-center ${th}`}>Active alloc. %</th>
                {months.map((c) => (
                  <th key={c.key} className={`text-center ${th} px-1.5`}>
                    {c.label}
                  </th>
                ))}
                <th className={`text-center ${th} pl-3`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.name}
                  className={'border-b border-[#f5f5f5] ' + (r.overUtilized ? 'bg-[#fef2f2]' : '')}
                >
                  <td
                    className="py-2 font-medium text-[#171717] whitespace-nowrap pr-3"
                    title={r.assignments
                      .map((a) => `${a.initiativeName} ${a.allocationPct}%`)
                      .join(' · ')}
                  >
                    {r.name}
                  </td>
                  <td className="py-2 text-[#666666] whitespace-nowrap pr-3">
                    {r.roleName ?? '—'}
                  </td>
                  <td className="py-2 text-center">
                    <select
                      className={cellInput + ' w-28'}
                      value={r.roleType ?? ''}
                      onChange={(e) => void patch(r.name, { roleType: e.target.value || null })}
                    >
                      <option value="">—</option>
                      <option value="EMPLOYEE">Employee</option>
                      <option value="CONTRACTOR">Contractor</option>
                    </select>
                  </td>
                  <td className="py-2 text-center">
                    <input
                      key={`rate-${r.rate}`}
                      type="number"
                      min={0}
                      step={100}
                      className={cellInput + ' w-24'}
                      defaultValue={r.rate ?? ''}
                      placeholder="$ / mo"
                      onBlur={(e) => {
                        const v = e.target.value === '' ? null : Number(e.target.value);
                        if (v !== r.rate) void patch(r.name, { rate: v });
                      }}
                    />
                  </td>
                  <td className="py-2 text-center">
                    <input
                      key={`on-${r.rollOn}`}
                      type="date"
                      className={cellInput + ' w-32'}
                      defaultValue={dateInput(r.rollOn)}
                      onBlur={(e) => {
                        if (e.target.value !== dateInput(r.rollOn))
                          void patch(r.name, { rollOn: e.target.value || null });
                      }}
                    />
                  </td>
                  <td className="py-2 text-center">
                    <input
                      key={`off-${r.rollOff}`}
                      type="date"
                      className={cellInput + ' w-32'}
                      defaultValue={dateInput(r.rollOff)}
                      onBlur={(e) => {
                        if (e.target.value !== dateInput(r.rollOff))
                          void patch(r.name, { rollOff: e.target.value || null });
                      }}
                    />
                  </td>
                  <td
                    className={
                      'py-2 text-center tnum font-medium whitespace-nowrap ' +
                      (r.overUtilized ? 'text-[#be123c]' : 'text-[#171717]')
                    }
                  >
                    {r.totalAllocationPct}%
                    {r.overUtilized && (
                      <span className="ml-1.5 text-[10px] uppercase font-semibold">over</span>
                    )}
                  </td>
                  {months.map((c) =>
                    c.past ? (
                      // Past months: calculated, locked.
                      <td
                        key={c.key}
                        className="py-2 px-1.5 text-center tnum text-xs text-[#a3a3a3] bg-[#fafafa] whitespace-nowrap"
                        title="Past month — calculated, not editable"
                      >
                        {usd(calcAmount(r, c.key))}
                      </td>
                    ) : (
                      <td key={c.key} className="py-2 px-1.5 text-center">
                        <input
                          key={`${c.key}-${r.monthAmounts[c.key] ?? ''}-${r.rate}-${r.rollOn}-${r.rollOff}`}
                          type="number"
                          min={0}
                          className={cellInput}
                          defaultValue={cellAmount(r, c)}
                          title={
                            r.monthAmounts[c.key] != null
                              ? 'Manual override — clear to revert to the calculated amount'
                              : 'Calculated from rate × allocation — edit to override'
                          }
                          onBlur={(e) => {
                            const v = e.target.value === '' ? null : Number(e.target.value);
                            const current = cellAmount(r, c);
                            if (v === null) {
                              if (r.monthAmounts[c.key] != null)
                                void patch(r.name, { month: { key: c.key, amount: null } });
                            } else if (v !== current)
                              void patch(r.name, { month: { key: c.key, amount: v } });
                          }}
                        />
                      </td>
                    ),
                  )}
                  <td className="py-2 pl-3 text-center tnum font-semibold text-[#171717] whitespace-nowrap">
                    {usd(rowTotal(r))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#eaeaea]">
                <td
                  colSpan={7}
                  className="py-2.5 text-right pr-3 text-xs font-semibold uppercase tracking-[0.06em] text-[#a3a3a3]"
                >
                  Total
                </td>
                {months.map((c) => (
                  <td
                    key={c.key}
                    className="py-2.5 px-1.5 text-center tnum text-xs font-semibold text-[#171717] whitespace-nowrap"
                  >
                    {usd(colTotal(c))}
                  </td>
                ))}
                {/* Grand total — Σ row totals == Σ column totals. */}
                <td
                  className="py-2.5 pl-3 text-center tnum font-bold text-[#171717] whitespace-nowrap"
                  title="Grand total — row totals and column totals both sum to this figure"
                >
                  {usd(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}
