import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt } from '../../lib/format';
import { StatusPill, SeverityCell, makeTimelineScale, TimelineGrid, TimelineAxis } from '../../lib/portfolio';

// ─── Transformation command-center widgets (Home, D1) ────────────────────────
// The widget BODIES for the Home dashboard's transformation widgets — the
// programs→initiatives rollup, the Gantt timeline and risks/RAID.
// The catalog in lib/dashboardWidgets wraps each
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
  raidOpen?: Record<string, number>; // open RAID counts by type (optional: older payloads)
};
export type TransformationData = {
  programs: HomeProgram[];
  topRisks: { id: string; title: string; severity: number; status: string; initiativeId: string; initiativeName: string }[];
  raidOpen: Record<string, number>;
};

// One color per program (health stays on the StatusPill): the same palette
// keys a program's timeline lane, its % complete bar, and every child
// initiative's bar — children always match their parent. Cycles past 6.
const PROGRAM_PALETTE = ['#4f46e5', '#0d9488', '#9333ea', '#0284c7', '#db2777', '#ea580c'];
const programColor = (idx: number) => PROGRAM_PALETTE[idx % PROGRAM_PALETTE.length];

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
          {t.programs.map((p, idx) => (
            <PortfolioRow key={p.id} p={p} color={programColor(idx)} open={!!open[p.id]} onToggle={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PortfolioRow({ p, color, open, onToggle }: { p: HomeProgram; color: string; open: boolean; onToggle: () => void }) {
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
        <td className="py-2.5 pr-4"><ProgressBar pct={p.pctComplete} color={color} /></td>
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
          <td className="py-2 pr-4"><ProgressBar pct={i.pctComplete} color={color} /></td>
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
          {t.programs.map((p, idx) => {
            const left = scale.pct(p.startDate);
            const width = Math.max(1.5, scale.pct(p.endDate) - left);
            const color = programColor(idx);
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
          Program (fill = % complete, one color per program)
        </span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rotate-45 bg-[#171717] inline-block" /> Milestone</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rotate-45 bg-[#047857] inline-block" /> Done</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rotate-45 bg-[#dc2626] inline-block" /> Missed</span>
        <span className="flex items-center gap-1.5"><span className="w-px h-3 bg-[#be123c] inline-block" /> Today</span>
      </div>
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

// One count tile (Risks / Issues / Assumptions / Decisions) — shared by the
// portfolio-wide RaidSummary and the per-program RaidByProgram boxes. Zero
// counts render muted so hotspots stand out.
function RaidTile({ rt, n, to }: { rt: (typeof RAID_TYPES)[number]; n: number; to: string }) {
  const live = n > 0;
  return (
    <Link
      to={to}
      className="rounded-md border p-3 transition-shadow duration-150 hover:shadow-sm"
      style={{ borderColor: live ? rt.border : '#eeeeee', backgroundColor: live ? rt.bg : '#fafafa' }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: live ? rt.color : '#a3a3a3' }}>{rt.label}</div>
      <div className="text-xl font-semibold tnum" style={{ color: live ? rt.color : '#171717' }}>{n}</div>
      <div className="text-[10px] text-[#a3a3a3] mt-0.5">open</div>
    </Link>
  );
}

export function RaidSummary({ t }: { t: TransformationData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {RAID_TYPES.map((rt) => (
        <RaidTile key={rt.type} rt={rt} n={t.raidOpen[rt.type] ?? 0} to={`/raid?type=${rt.type}`} />
      ))}
    </div>
  );
}

// ── RAID by program: one RAID-log box (the same 4-tile grid) per program ────
// The program name and every tile deep-link to that program's RAID tab; tiles
// also preset the type filter there.
export function RaidByProgram({ t }: { t: TransformationData }) {
  if (t.programs.length === 0) return <div className="text-sm text-[#a3a3a3]">No programs yet.</div>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {t.programs.map((p) => (
        <div key={p.id} className="rounded-lg border border-[#eaeaea] p-4">
          <Link to={`/programs/${p.id}?tab=RAID`} className="block text-sm font-semibold text-[#171717] hover:text-[#4f46e5] truncate mb-3">
            {p.name}
          </Link>
          <div className="grid grid-cols-2 gap-3">
            {RAID_TYPES.map((rt) => (
              <RaidTile key={rt.type} rt={rt} n={p.raidOpen?.[rt.type] ?? 0} to={`/programs/${p.id}?tab=RAID&type=${rt.type}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

