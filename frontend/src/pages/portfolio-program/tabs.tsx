/**
 * Tab views of the Portfolio Program page — Budget & spend card, Workstreams,
 * Pipeline, Prioritization (value-vs-complexity matrix), Roadmap, and the
 * cross-initiative Resources table, plus the shared payload types. Extracted
 * verbatim from PortfolioProgram.tsx.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { fmt, STAGE_ORDER, STAGE_LABELS } from '../../lib/format';
import { Button, Card, EmptyState, ErrorMessage, LoadingState } from '../../components/ui';
import {
  StatusPill, StageBar,
  makeTimelineScale, TimelineAxis, TimelineGrid,
} from '../../lib/portfolio';

export type InitRow = {
  id: string; name: string; stage: string; status: string;
  startDate: string; dueDate: string;
  valueScore: number; complexityScore: number;
  cumulativeBenefit: number; cumulativeNetBenefit: number;
  ownerRoleName: string | null; valueStreamName: string | null;
};
export type Program = {
  id: string; name: string; description: string | null; status: string;
  computedStatus?: string; statusOverridden?: boolean;
  workstreams: { id: string; name: string; status: string; computedStatus?: string; statusOverridden?: boolean; initiatives: InitRow[] }[];
};
export type Summary = {
  initiativeCount: number; totalBenefit: number; totalCost: number; netBenefit: number;
  budget: number; forecastSpend: number; actualSpend: number;
};
type ResourceRow = {
  name: string; roleName: string | null; totalAllocationPct: number; overUtilized: boolean;
  assignments: { initiativeId: string; initiativeName: string; allocationPct: number; startDate: string; endDate: string }[];
};

export const STATUS_COLOR: Record<string, string> = { ON_TRACK: '#047857', AT_RISK: '#b45309', OFF_TRACK: '#be123c' };

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
          {pctSpent === null ? 'No budget set' : <><span className="font-semibold text-[#171717] tnum">{pctSpent}%</span> of budget spent</>}
        </span>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <div className="w-40 text-xs text-[#525252] flex-shrink-0">{r.label}</div>
            <div className="flex-1 h-5 bg-[#f5f5f5] rounded overflow-hidden">
              <div className="h-full rounded" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: r.color, minWidth: r.value ? 2 : 0 }} />
            </div>
            <div className="w-20 text-right text-xs text-[#171717] tnum flex-shrink-0">{fmt.currency(r.value, { compact: true })}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── WORKSTREAMS ──────────────────────────────────────────────────────────
export function WorkstreamsTab({ program, onCreateInit }: { program: Program; onCreateInit: (ws: { id: string; name: string }) => void }) {
  return (
    <div className="space-y-4">
      {program.workstreams.map((ws) => (
        <Card key={ws.id} variant="elevated" className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-[#f5f5f5]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
              <h3 className="font-semibold text-[#171717]">{ws.name}</h3>
              <StatusPill status={ws.computedStatus ?? ws.status} />
              {ws.statusOverridden && <span className="text-[10px] text-[#b45309]" title={`Manually set to ${ws.status.replaceAll('_', ' ').toLowerCase()} — rolled-up health from its initiatives differs`}>override</span>}
              <span className="text-xs text-[#a3a3a3]">{ws.initiatives.length} initiative{ws.initiatives.length !== 1 && 's'}</span>
            </div>
            <Button variant="secondary" className="text-xs" onClick={() => onCreateInit({ id: ws.id, name: ws.name })}>+ Initiative</Button>
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
                    <th className="text-left pb-2 font-semibold w-24">Status</th>
                    <th className="text-left pb-2 font-semibold pl-3 w-40">Value stream</th>
                  </tr>
                </thead>
                <tbody>
                  {ws.initiatives.map((init) => (
                    <tr key={init.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]">
                      <td className="py-2.5">
                        <Link to={`/initiatives/${init.id}`} className="font-medium text-[#171717] hover:text-[#4f46e5]">{init.name}</Link>
                      </td>
                      <td className="py-2.5 pr-3"><StageBar stage={init.stage} /></td>
                      <td className="py-2.5"><StatusPill status={init.status} /></td>
                      <td className="py-2.5 pl-3 text-[#666666] text-xs truncate">{init.valueStreamName ?? '—'}</td>
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
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{STAGE_LABELS[stage]}</span>
              <span className="text-xs text-[#171717] tnum">{inits.length}</span>
            </div>
            {inits.length === 0 ? (
              <div className="text-xs text-[#a3a3a3] py-2">—</div>
            ) : (
              <div className="space-y-2">
                {inits.map((i) => (
                  <Link key={i.id} to={`/initiatives/${i.id}`} className="block border border-[#eaeaea] rounded-md p-2.5 hover:border-[#a3a3a3] transition-colors">
                    <div className="text-sm font-medium text-[#171717] leading-snug mb-1.5">{i.name}</div>
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill status={i.status} />
                      <span className="text-xs text-[#666666] tnum" title="Value score">V {i.valueScore}</span>
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

// ── PRIORITIZATION ───────────────────────────────────────────────────────
type SortKey = 'name' | 'valueScore' | 'complexityScore';

export function PrioritizationTab({ program }: { program: Program }) {
  const all = program.workstreams.flatMap((ws) => ws.initiatives);
  const [sortKey, setSortKey] = useState<SortKey>('valueScore');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const yMax = Math.max(10, Math.ceil(Math.max(0, ...all.map((i) => i.valueScore)) * 1.1));

  const sorted = useMemo(() => {
    return [...all].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return cmp * sortDir;
    });
  }, [all, sortKey, sortDir]);

  function setSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === 1 ? -1 : 1);
    else { setSortKey(k); setSortDir(k === 'name' ? 1 : -1); }
  }
  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === 1 ? ' ↑' : ' ↓') : '');

  return (
    <div className="space-y-4">
      <Card variant="elevated" className="p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-1">Value vs. Complexity</h3>
        <p className="text-xs text-[#a3a3a3] mb-4">x = complexity score (0–10, charter), y = value score (Σ impact × objective weight).</p>
        <div className="flex gap-2">
          <div className="flex items-center justify-center w-5 flex-shrink-0">
            <span className="text-[10px] text-[#a3a3a3] -rotate-90 whitespace-nowrap">Value →</span>
          </div>
          <div className="flex-1">
            <div className="relative h-80 border border-[#eaeaea] rounded-md bg-[#fcfcfc] overflow-hidden">
              {/* quadrant dividers */}
              <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-[#e5e5e5]" />
              <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-[#e5e5e5]" />
              {/* quadrant labels */}
              <span className="absolute top-2 left-3 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#047857]/60">Quick Wins</span>
              <span className="absolute top-2 right-3 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#4f46e5]/60">Strategic Bets</span>
              <span className="absolute bottom-2 left-3 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#a3a3a3]">Fill-ins</span>
              <span className="absolute bottom-2 right-3 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#be123c]/60">Money Pits</span>
              {/* dots */}
              {all.map((i) => {
                const x = Math.min(100, Math.max(0, (i.complexityScore / 10) * 100));
                const y = Math.min(100, Math.max(0, (i.valueScore / yMax) * 100));
                return (
                  <Link
                    key={i.id}
                    to={`/initiatives/${i.id}`}
                    className="absolute group"
                    style={{ left: `${x}%`, bottom: `${y}%`, transform: 'translate(-50%, 50%)' }}
                    title={`${i.name} — value ${i.valueScore}, complexity ${i.complexityScore}`}
                  >
                    <span className="block w-3 h-3 rounded-full border-2 border-white shadow" style={{ backgroundColor: STATUS_COLOR[i.status] ?? '#171717' }} />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-[#525252] whitespace-nowrap bg-white/85 px-1 rounded group-hover:text-[#171717]">{i.name}</span>
                  </Link>
                );
              })}
            </div>
            <div className="text-right text-[10px] text-[#a3a3a3] mt-1">Complexity →</div>
          </div>
        </div>
      </Card>

      <Card variant="elevated" className="p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-3">Initiatives ranked</h3>
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
              <tr>
                <th className="text-left pb-2 font-semibold cursor-pointer select-none" onClick={() => setSort('name')}>Initiative{arrow('name')}</th>
                <th className="text-center pb-2 font-semibold cursor-pointer select-none w-24" onClick={() => setSort('valueScore')}>Value{arrow('valueScore')}</th>
                <th className="text-center pb-2 font-semibold cursor-pointer select-none w-28" onClick={() => setSort('complexityScore')}>Complexity{arrow('complexityScore')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((i) => (
                <tr key={i.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]">
                  <td className="py-2.5">
                    <Link to={`/initiatives/${i.id}`} className="font-medium text-[#171717] hover:text-[#4f46e5]">{i.name}</Link>
                  </td>
                  <td className="py-2.5 text-center tnum">{i.valueScore}</td>
                  <td className="py-2.5 text-center tnum">{i.complexityScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── ROADMAP ──────────────────────────────────────────────────────────────
export function RoadmapTab({ program }: { program: Program }) {
  const all = program.workstreams.flatMap((ws) => ws.initiatives);
  const scale = makeTimelineScale(all.flatMap((i) => [i.startDate, i.dueDate]));
  if (!scale) return <Card variant="elevated" className="p-5 text-sm text-[#a3a3a3]">No initiatives to plot.</Card>;

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
        <div className="flex-1 min-w-0"><TimelineAxis scale={scale} /></div>
      </div>

      {program.workstreams.map((ws) => (
        <div key={ws.id} className="mb-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] py-1.5">{ws.name}</div>
          <div className="flex gap-3">
            <div className="w-56 flex-shrink-0">
              {ws.initiatives.map((i) => (
                <div key={i.id} className="h-8 flex items-center min-w-0">
                  <Link to={`/initiatives/${i.id}`} className="text-sm font-medium text-[#171717] hover:text-[#4f46e5] truncate">{i.name}</Link>
                </div>
              ))}
              {ws.initiatives.length === 0 && <div className="h-8 flex items-center text-xs text-[#a3a3a3]">No initiatives</div>}
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
                      style={{ left: `${left}%`, width: `${width}%`, backgroundColor: STATUS_COLOR[i.status] ?? '#171717' }}
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
export function ProgramResourcesTab({ programId }: { programId: string }) {
  const [rows, setRows] = useState<ResourceRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get(`/portfolio/programs/${programId}/resources`).then(setRows).catch((e) => setError(e.message)); }, [programId]);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!rows) return <LoadingState />;

  const over = rows.filter((r) => r.overUtilized).length;

  return (
    <Card variant="elevated" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[#171717]">Resource utilization</h3>
        <span className={'text-xs ' + (over > 0 ? 'text-[#be123c] font-medium' : 'text-[#a3a3a3]')}>
          {over > 0 ? `${over} of ${rows.length} resources over-allocated (>100% active today)` : `${rows.length} resources — none over-allocated today`}
        </span>
      </div>
      {rows.length === 0 ? (
        <EmptyState baseClassName="text-sm text-[#a3a3a3] py-2" message="No resources assigned across this program's initiatives yet." />
      ) : (
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
              <tr>
                <th className="text-left pb-2 font-semibold">Resource</th>
                <th className="text-left pb-2 font-semibold">Role</th>
                <th className="text-center pb-2 font-semibold w-32">Active alloc. %</th>
                <th className="text-left pb-2 font-semibold pl-4">Assignments</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className={'border-b border-[#f5f5f5] ' + (r.overUtilized ? 'bg-[#fef2f2]' : '')}>
                  <td className="py-2.5 font-medium text-[#171717]">{r.name}</td>
                  <td className="py-2.5 text-[#666666]">{r.roleName ?? '—'}</td>
                  <td className={'py-2.5 text-center tnum font-medium ' + (r.overUtilized ? 'text-[#be123c]' : 'text-[#171717]')}>
                    {r.totalAllocationPct}%{r.overUtilized && <span className="ml-1.5 text-[10px] uppercase font-semibold">over</span>}
                  </td>
                  <td className="py-2.5 pl-4 text-xs text-[#666666]">
                    {r.assignments.map((a, idx) => (
                      <span key={idx}>
                        {idx > 0 && <span className="text-[#d4d4d4]"> · </span>}
                        <Link to={`/initiatives/${a.initiativeId}`} className="hover:text-[#4f46e5]">{a.initiativeName}</Link>
                        <span className="tnum"> {a.allocationPct}%</span>
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
