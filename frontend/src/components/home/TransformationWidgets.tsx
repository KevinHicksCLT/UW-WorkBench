import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt } from '../../lib/format';
import { StatusPill, SeverityCell, makeTimelineScale, TimelineGrid, TimelineAxis } from '../../lib/portfolio';

// ─── Transformation command-center widgets (Home, D1) ────────────────────────
// The widget BODIES for the Home dashboard's transformation widgets — the
// programs→initiatives rollup, the Gantt timeline, OKRs, risks/RAID and the
// Viva-style workforce signals. The catalog in lib/dashboardWidgets wraps each
// of these in its Card and feeds it the `transformation` slice of the
// GET /dashboard payload. The drill-down targets (/programs/:id,
// /initiatives/:id, /raid) live under Home too — clicking through never
// leaves the Home tab for the Workspace.

export type HomeInitiative = {
  id: string; name: string; stage: string; status: string; netBenefit: number; pctComplete: number;
};
export type HomeMilestone = {
  id: string; name: string; dueDate: string; status: string; initiativeName: string;
};
export type HomeProgram = {
  id: string; name: string; status: string; computedStatus: string;
  startDate: string; endDate: string;
  pctComplete: number; netBenefit: number;
  initiatives: HomeInitiative[];
  milestones: HomeMilestone[];
};
export type TransformationData = {
  programs: HomeProgram[];
  okrs: { id: string; name: string; weight: number; achievement: number; initiatives: number }[];
  workforceSignals: { period: string | null; signals: { name: string; unit: string; value: number; people: number }[] };
  topRisks: { id: string; title: string; severity: number; status: string; initiativeId: string; initiativeName: string }[];
  raidOpen: Record<string, number>;
};

const STATUS_COLOR: Record<string, string> = { ON_TRACK: '#4f46e5', AT_RISK: '#d97706', OFF_TRACK: '#dc2626' };

function ProgressBar({ pct, color = '#4f46e5' }: { pct: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded bg-[#f5f5f5] overflow-hidden">
        <div className="h-full rounded" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }} />
      </div>
      <span className="w-9 text-right text-xs text-[#171717] tnum flex-shrink-0">{pct}%</span>
    </div>
  );
}

// ── Portfolio rollup: programs → initiatives, expandable ────────────────────
export function PortfolioRollup({ t }: { t: TransformationData }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (t.programs.length === 0) return <div className="text-sm text-[#a3a3a3]">No programs yet.</div>;
  return (
    <div className="table-scroll">
      <table className="w-full text-sm">
        <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
          <tr>
            <th className="text-left py-2 font-semibold">Program</th>
            <th className="text-left py-2 font-semibold w-28">Health</th>
            <th className="text-left py-2 font-semibold w-44">% complete</th>
            <th className="text-right py-2 font-semibold w-24">Initiatives</th>
            <th className="text-right py-2 font-semibold w-28">Net benefit</th>
          </tr>
        </thead>
        <tbody>
          {t.programs.map((p) => (
            <PortfolioRow key={p.id} p={p} open={!!open[p.id]} onToggle={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PortfolioRow({ p, open, onToggle }: { p: HomeProgram; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-colors duration-150">
        <td className="py-2.5">
          <span className="flex items-center gap-1.5">
            <button onClick={onToggle} aria-expanded={open} aria-label={open ? 'Collapse initiatives' : 'Expand initiatives'} className="text-[#a3a3a3] hover:text-[#171717] flex-shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={'transition-transform duration-150 ' + (open ? 'rotate-90' : '')}>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <Link to={`/programs/${p.id}`} className="font-medium text-[#171717] hover:text-[#4f46e5]">{p.name}</Link>
          </span>
        </td>
        <td className="py-2.5"><StatusPill status={p.computedStatus} /></td>
        <td className="py-2.5 pr-4"><ProgressBar pct={p.pctComplete} color={STATUS_COLOR[p.computedStatus] ?? '#4f46e5'} /></td>
        <td className="py-2.5 text-right tnum">{p.initiatives.length}</td>
        <td className={'py-2.5 text-right tnum ' + (p.netBenefit < 0 ? 'text-[#be123c]' : 'text-[#171717]')}>{fmt.currency(p.netBenefit, { compact: true })}</td>
      </tr>
      {open && p.initiatives.map((i) => (
        <tr key={i.id} className="border-b border-[#f5f5f5] bg-[#fafafa]">
          <td className="py-2 pl-7">
            <Link to={`/initiatives/${i.id}`} className="text-[#525252] hover:text-[#4f46e5]">{i.name}</Link>
            <span className="ml-2 text-[10px] uppercase tracking-[0.06em] text-[#a3a3a3]">{i.stage.charAt(0) + i.stage.slice(1).toLowerCase()}</span>
          </td>
          <td className="py-2"><StatusPill status={i.status} /></td>
          <td className="py-2 pr-4"><ProgressBar pct={i.pctComplete} color={STATUS_COLOR[i.status] ?? '#4f46e5'} /></td>
          <td className="py-2" />
          <td className={'py-2 text-right tnum text-xs ' + (i.netBenefit < 0 ? 'text-[#be123c]' : 'text-[#525252]')}>{fmt.currency(i.netBenefit, { compact: true })}</td>
        </tr>
      ))}
    </>
  );
}

// ── Gantt timeline: one lane per program, milestone diamonds, today line ────
// Each bar is a light track for the program's full duration with a solid fill
// for % complete; alternating quarter bands sit behind the lanes. The label
// column is wide enough to wrap long program names instead of truncating them.
export function ProgramGantt({ t }: { t: TransformationData }) {
  const dates: (string | Date)[] = t.programs.flatMap((p) => [p.startDate, p.endDate, ...p.milestones.map((m) => m.dueDate)]);
  const scale = makeTimelineScale(dates, 'quarter');
  if (!scale || t.programs.length === 0) return <div className="text-sm text-[#a3a3a3]">No dated programs yet.</div>;
  const now = Date.now();
  const showToday = now >= scale.min && now <= scale.max;
  // Quarter boundaries (ticks + both edges) → alternating background bands.
  const bounds = [0, ...scale.ticks.map((tk) => tk.pct), 100];
  return (
    <div>
      <div className="flex">
        <div className="w-56 flex-shrink-0" />
        <div className="flex-1 relative"><TimelineAxis scale={scale} /></div>
      </div>
      <div className="flex">
        <div className="w-56 flex-shrink-0">
          {t.programs.map((p) => (
            <div key={p.id} className="h-11 flex items-center pr-4">
              <Link to={`/programs/${p.id}`} className="text-xs font-medium leading-snug text-[#171717] hover:text-[#4f46e5]">{p.name}</Link>
            </div>
          ))}
        </div>
        <div className="flex-1 relative">
          {bounds.slice(0, -1).map((b, i) =>
            i % 2 === 1 ? (
              <div key={i} className="absolute top-0 bottom-0 bg-[#fafafa] pointer-events-none" style={{ left: `${b}%`, width: `${bounds[i + 1] - b}%` }} />
            ) : null,
          )}
          <TimelineGrid scale={scale} />
          {showToday && (
            <div className="absolute top-0 bottom-0 w-px bg-[#be123c] z-10" style={{ left: `${scale.pct(new Date(now))}%` }} title="Today" />
          )}
          {t.programs.map((p) => {
            const left = scale.pct(p.startDate);
            const width = Math.max(1.5, scale.pct(p.endDate) - left);
            const color = STATUS_COLOR[p.computedStatus] ?? '#4f46e5';
            return (
              <div key={p.id} className="h-11 relative">
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-4 rounded-full overflow-hidden"
                  style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color + '26' }}
                  title={`${p.name} · ${fmt.month(p.startDate)} – ${fmt.month(p.endDate)} · ${p.pctComplete}% complete`}
                >
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, p.pctComplete))}%`, backgroundColor: color }} />
                </div>
                {p.milestones.map((m) => (
                  <div
                    key={m.id}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 rounded-[2px] border-2 border-white shadow-sm z-20"
                    style={{ left: `${scale.pct(m.dueDate)}%`, backgroundColor: m.status === 'DONE' ? '#047857' : m.status === 'MISSED' ? '#dc2626' : '#171717' }}
                    title={`${m.name} (${m.initiativeName}) · ${fmt.date(m.dueDate)}`}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[10px] text-[#a3a3a3]">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-2 rounded-full inline-block overflow-hidden bg-[#4f46e5]/15"><span className="block h-full w-1/2 rounded-full bg-[#4f46e5]" /></span>
          Program (fill = % complete)
        </span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rotate-45 bg-[#171717] inline-block" /> Milestone</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rotate-45 bg-[#047857] inline-block" /> Done</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rotate-45 bg-[#dc2626] inline-block" /> Missed</span>
        <span className="flex items-center gap-1.5"><span className="w-px h-3 bg-[#be123c] inline-block" /> Today</span>
      </div>
    </div>
  );
}

// ── Objectives & key results: achievement bars ───────────────────────────────
export function OkrList({ t }: { t: TransformationData }) {
  if (t.okrs.length === 0) return <div className="text-sm text-[#a3a3a3]">No strategic objectives yet.</div>;
  return (
    <div className="space-y-2.5">
      {t.okrs.map((o) => (
        <div key={o.id}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs text-[#525252] truncate">{o.name}</span>
            <span className="text-[10px] text-[#a3a3a3] flex-shrink-0 tnum">w{o.weight} · {o.initiatives} init.</span>
          </div>
          <ProgressBar pct={o.achievement} color={o.achievement >= 60 ? '#047857' : o.achievement >= 30 ? '#4f46e5' : '#d97706'} />
        </div>
      ))}
    </div>
  );
}

// ── Open risks: top open risks by severity ───────────────────────────────────
// Severity shows as its RATING (Low / Medium / High via SeverityCell — the same
// risk-band pill the RAID log uses), never as a raw 5×5 score.
export function TopRisks({ t }: { t: TransformationData }) {
  if (t.topRisks.length === 0) return <div className="text-sm text-[#a3a3a3]">No open risks.</div>;
  return (
    <div className="space-y-0.5 -mx-2">
      {t.topRisks.map((r) => (
        <Link key={r.id} to={`/initiatives/${r.initiativeId}`} className="flex items-center gap-2.5 text-sm rounded-md px-2 py-1.5 hover:bg-[#fafafa] transition-colors duration-150 group">
          <span className="flex-shrink-0"><SeverityCell value={r.severity} /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[#171717] group-hover:text-[#4f46e5]">{r.title}</div>
            <div className="text-[10px] text-[#a3a3a3] truncate">{r.initiativeName}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── RAID log: open counts by type ────────────────────────────────────────────
// Each tile deep-links into the RAID log pre-filtered to its type.
const RAID_TYPES = [
  { type: 'RISK', label: 'Risks', color: '#be123c', bg: '#fef2f2', border: '#fecaca' },
  { type: 'ISSUE', label: 'Issues', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  { type: 'ASSUMPTION', label: 'Assumptions', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
  { type: 'DECISION', label: 'Decisions', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
] as const;

export function RaidSummary({ t }: { t: TransformationData }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {RAID_TYPES.map(({ type, label, color, bg, border }) => {
        const n = t.raidOpen[type] ?? 0;
        const live = n > 0;
        return (
          <Link
            key={type}
            to={`/raid?type=${type}`}
            className="rounded-md border p-3 transition-shadow duration-150 hover:shadow-sm"
            style={{ borderColor: live ? border : '#eeeeee', backgroundColor: live ? bg : '#fafafa' }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: live ? color : '#a3a3a3' }}>{label}</div>
            <div className="text-xl font-semibold tnum" style={{ color: live ? color : '#171717' }}>{n}</div>
            <div className="text-[10px] text-[#a3a3a3] mt-0.5">open</div>
          </Link>
        );
      })}
    </div>
  );
}

// ── Workforce signals: Viva-style company-wide averages ─────────────────────
export function WorkforceSignals({ t }: { t: TransformationData }) {
  const ws = t.workforceSignals;
  if (!ws.period || ws.signals.length === 0) return <div className="text-sm text-[#a3a3a3]">No workforce signals yet.</div>;
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {ws.signals.map((s) => (
          <div key={s.name}>
            <div className="text-lg font-semibold text-[#171717] tnum">
              {fmt.number(s.value)} <span className="text-xs font-normal text-[#a3a3a3]">{s.unit}</span>
            </div>
            <div className="text-[11px] text-[#525252]">{s.name}</div>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-[#a3a3a3] mt-3">
        Avg per person · {ws.signals[0]?.people ?? 0} people · {ws.period} · illustrative signals
      </div>
    </div>
  );
}
