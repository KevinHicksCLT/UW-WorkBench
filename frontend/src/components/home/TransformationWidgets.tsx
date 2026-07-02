import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt } from '../../lib/format';
import {
  StatusPill,
  SeverityCell,
  makeTimelineScale,
  TimelineGrid,
  TimelineAxis,
} from '../../lib/portfolio';
import { EmptyState } from '../ui';

// ─── Transformation command-center widgets (Home, D1) ────────────────────────
// The widget BODIES for the Home dashboard's transformation widgets — the
// programs→initiatives rollup, the Gantt timeline and risks/RAID.
// The catalog in lib/dashboardWidgets wraps each
// of these in its Card and feeds it the `transformation` slice of the
// GET /dashboard payload. The drill-down targets (/programs/:id,
// /initiatives/:id, /raid) live under Home too — clicking through never
// leaves the Home tab for the Workspace.

export type HomeInitiative = {
  id: string;
  name: string;
  stage: string;
  status: string;
  netBenefit: number;
  pctComplete: number;
  budget: number;
  forecastSpend: number;
  actualSpend: number;
  // Prioritization scores (optional: older payloads degrade gracefully).
  valueScore?: number;
  complexityScore?: number;
};
export type HomeMilestone = {
  id: string;
  name: string;
  dueDate: string;
  status: string;
  initiativeName: string;
};
export type HomeProgram = {
  id: string;
  name: string;
  status: string;
  computedStatus: string;
  startDate: string;
  endDate: string;
  pctComplete: number;
  netBenefit: number;
  budget: number;
  forecastSpend: number;
  actualSpend: number;
  initiatives: HomeInitiative[];
  milestones: HomeMilestone[];
  raidOpen?: Record<string, number>; // open RAID counts by type (optional: older payloads)
  raidNew?: Record<string, number>; // open RAID raised in the last 7 days
};
export type TransformationData = {
  programs: HomeProgram[];
  topRisks: {
    id: string;
    title: string;
    severity: number;
    status: string;
    initiativeId: string;
    initiativeName: string;
  }[];
  raidOpen: Record<string, number>;
  raidNew?: Record<string, number>;
};

// One color per program (health stays on the StatusPill): the same palette
// keys a program's timeline lane, its % complete bar, and every child
// initiative's bar — children always match their parent. Cycles past 6.
const PROGRAM_PALETTE = ['#4f46e5', '#0d9488', '#9333ea', '#0284c7', '#db2777', '#ea580c'];
const programColor = (idx: number) => PROGRAM_PALETTE[idx % PROGRAM_PALETTE.length];

// % of budget spent (actual ÷ budget). Null when there is no budget to divide by.
const pctSpent = (budget: number, actual: number) =>
  budget > 0 ? Math.round((actual / budget) * 100) : null;

function ProgressBar({ pct, color = '#4f46e5' }: { pct: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded bg-[#f5f5f5] overflow-hidden">
        <div
          className="h-full rounded"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-9 text-right text-xs text-[#171717] tnum flex-shrink-0">{pct}%</span>
    </div>
  );
}

// ── Portfolio rollup: programs → initiatives, expandable ────────────────────
export function PortfolioRollup({ t }: { t: TransformationData }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (t.programs.length === 0)
    return <EmptyState baseClassName="text-sm text-[#a3a3a3]" message="No programs yet." />;
  return (
    <div className="table-scroll">
      <table className="w-full text-sm">
        <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
          <tr>
            <th className="text-left py-2 font-semibold">Program</th>
            <th className="text-center py-2 font-semibold w-28">Health</th>
            <th className="text-left py-2 font-semibold w-44">% complete</th>
            <th className="text-center py-2 font-semibold w-20">Initiatives</th>
            <th className="text-center py-2 font-semibold w-24">Budget</th>
            <th className="text-center py-2 font-semibold w-24">Forecast</th>
            <th className="text-center py-2 font-semibold w-24">Actual</th>
            <th className="text-center py-2 font-semibold w-20">% spent</th>
          </tr>
        </thead>
        <tbody>
          {t.programs.map((p, idx) => (
            <PortfolioRow
              key={p.id}
              p={p}
              color={programColor(idx)}
              open={!!open[p.id]}
              onToggle={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PortfolioRow({
  p,
  color,
  open,
  onToggle,
}: {
  p: HomeProgram;
  color: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-colors duration-150">
        <td className="py-2.5">
          <span className="flex items-center gap-1.5">
            <button
              onClick={onToggle}
              aria-expanded={open}
              aria-label={open ? 'Collapse initiatives' : 'Expand initiatives'}
              className="text-[#a3a3a3] hover:text-[#171717] flex-shrink-0"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={'transition-transform duration-150 ' + (open ? 'rotate-90' : '')}
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <Link
              to={`/programs/${p.id}`}
              className="font-medium text-[#171717] hover:text-[#4f46e5]"
            >
              {p.name}
            </Link>
          </span>
        </td>
        <td className="py-2.5 text-center">
          <StatusPill status={p.computedStatus} />
        </td>
        <td className="py-2.5 pr-4">
          <ProgressBar pct={p.pctComplete} color={color} />
        </td>
        <td className="py-2.5 text-center tnum">{p.initiatives.length}</td>
        <td className="py-2.5 text-center tnum text-[#171717]">
          {fmt.currency(p.budget, { compact: true })}
        </td>
        <td className="py-2.5 text-center tnum text-[#525252]">
          {fmt.currency(p.forecastSpend, { compact: true })}
        </td>
        <td className="py-2.5 text-center tnum text-[#171717]">
          {fmt.currency(p.actualSpend, { compact: true })}
        </td>
        <td className="py-2.5 text-center tnum text-[#171717]">
          {pctSpent(p.budget, p.actualSpend) === null
            ? '—'
            : `${pctSpent(p.budget, p.actualSpend)}%`}
        </td>
      </tr>
      {open &&
        p.initiatives.map((i) => (
          <tr key={i.id} className="border-b border-[#f5f5f5] bg-[#fafafa]">
            <td className="py-2 pl-7">
              <Link to={`/initiatives/${i.id}`} className="text-[#525252] hover:text-[#4f46e5]">
                {i.name}
              </Link>
            </td>
            <td className="py-2 text-center">
              <StatusPill status={i.status} />
            </td>
            <td className="py-2 pr-4">
              <ProgressBar pct={i.pctComplete} color={color} />
            </td>
            <td className="py-2" />
            <td className="py-2 text-center tnum text-xs text-[#525252]">
              {fmt.currency(i.budget, { compact: true })}
            </td>
            <td className="py-2 text-center tnum text-xs text-[#a3a3a3]">
              {fmt.currency(i.forecastSpend, { compact: true })}
            </td>
            <td className="py-2 text-center tnum text-xs text-[#525252]">
              {fmt.currency(i.actualSpend, { compact: true })}
            </td>
            <td className="py-2 text-center tnum text-xs text-[#525252]">
              {pctSpent(i.budget, i.actualSpend) === null
                ? '—'
                : `${pctSpent(i.budget, i.actualSpend)}%`}
            </td>
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
  const dates: (string | Date)[] = t.programs.flatMap((p) => [
    p.startDate,
    p.endDate,
    ...p.milestones.map((m) => m.dueDate),
  ]);
  const scale = makeTimelineScale(dates, 'quarter');
  if (!scale || t.programs.length === 0)
    return <EmptyState baseClassName="text-sm text-[#a3a3a3]" message="No dated programs yet." />;
  const now = Date.now();
  const showToday = now >= scale.min && now <= scale.max;
  // Quarter boundaries (ticks + both edges) → alternating background bands.
  const bounds = [0, ...scale.ticks.map((tk) => tk.pct), 100];
  return (
    <div>
      <div className="flex">
        <div className="w-56 flex-shrink-0" />
        <div className="flex-1 relative">
          <TimelineAxis scale={scale} />
        </div>
      </div>
      <div className="flex">
        <div className="w-56 flex-shrink-0">
          {t.programs.map((p) => (
            <div key={p.id} className="h-11 flex items-center pr-4">
              <Link
                to={`/programs/${p.id}`}
                className="text-xs font-medium leading-snug text-[#171717] hover:text-[#4f46e5]"
              >
                {p.name}
              </Link>
            </div>
          ))}
        </div>
        <div className="flex-1 relative">
          {bounds
            .slice(0, -1)
            .map((b, i) =>
              i % 2 === 1 ? (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 bg-[#fafafa] pointer-events-none"
                  style={{ left: `${b}%`, width: `${bounds[i + 1] - b}%` }}
                />
              ) : null,
            )}
          <TimelineGrid scale={scale} />
          {showToday && (
            <div
              className="absolute top-0 bottom-0 w-px bg-[#be123c] z-10"
              style={{ left: `${scale.pct(new Date(now))}%` }}
              title="Today"
            />
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
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, p.pctComplete))}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                {p.milestones.map((m) => (
                  <div
                    key={m.id}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 rounded-[2px] border-2 border-white shadow-sm z-20"
                    style={{
                      left: `${scale.pct(m.dueDate)}%`,
                      backgroundColor:
                        m.status === 'DONE'
                          ? '#047857'
                          : m.status === 'MISSED'
                            ? '#dc2626'
                            : '#171717',
                    }}
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
          <span className="w-5 h-2 rounded-full inline-block overflow-hidden bg-[#4f46e5]/15">
            <span className="block h-full w-1/2 rounded-full bg-[#4f46e5]" />
          </span>
          Program (fill = % complete, one color per program)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rotate-45 bg-[#171717] inline-block" /> Milestone
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rotate-45 bg-[#047857] inline-block" /> Done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rotate-45 bg-[#dc2626] inline-block" /> Missed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-px h-3 bg-[#be123c] inline-block" /> Today
        </span>
      </div>
    </div>
  );
}

// ── Open risks: top open risks by severity ───────────────────────────────────
// Severity shows as its RATING (Low / Medium / High via SeverityCell — the same
// risk-band pill the RAID log uses), never as a raw 5×5 score.
export function TopRisks({ t }: { t: TransformationData }) {
  if (t.topRisks.length === 0)
    return <EmptyState baseClassName="text-sm text-[#a3a3a3]" message="No open risks." />;
  return (
    <div className="space-y-0.5 -mx-2">
      {t.topRisks.map((r) => (
        <Link
          key={r.id}
          to={`/initiatives/${r.initiativeId}`}
          className="flex items-center gap-2.5 text-sm rounded-md px-2 py-1.5 hover:bg-[#fafafa] transition-colors duration-150 group"
        >
          <span className="flex-shrink-0">
            <SeverityCell value={r.severity} />
          </span>
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
// portfolio-wide RaidSummary and the per-program RaidByProgram boxes. The big
// number is the TOTAL open count (FB-30); a "N new" link filters to items raised
// in the last 7 days (FB-31). Zero counts render muted so hotspots stand out.
function RaidTile({
  rt,
  total,
  neu,
  toAll,
  toNew,
}: {
  rt: (typeof RAID_TYPES)[number];
  total: number;
  neu: number;
  toAll: string;
  toNew: string;
}) {
  const live = total > 0;
  return (
    <div
      className="rounded-md border p-3 text-center transition-shadow duration-150 hover:shadow-sm"
      style={{
        borderColor: live ? rt.border : '#eeeeee',
        backgroundColor: live ? rt.bg : '#fafafa',
      }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: live ? rt.color : '#a3a3a3' }}
      >
        {rt.label}
      </div>
      <Link
        to={toAll}
        className="block text-xl font-semibold tnum hover:underline"
        style={{ color: live ? rt.color : '#171717' }}
      >
        {total}
      </Link>
      <div className="text-[10px] mt-0.5 h-3.5">
        {neu > 0 ? (
          <Link to={toNew} className="font-semibold text-[#4f46e5] hover:underline">
            {neu} new
          </Link>
        ) : (
          <span className="text-[#a3a3a3]">0 new</span>
        )}
      </div>
    </div>
  );
}

export function RaidSummary({ t }: { t: TransformationData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {RAID_TYPES.map((rt) => (
        <RaidTile
          key={rt.type}
          rt={rt}
          total={t.raidOpen[rt.type] ?? 0}
          neu={t.raidNew?.[rt.type] ?? 0}
          toAll={`/raid?type=${rt.type}`}
          toNew={`/raid?type=${rt.type}&new=1`}
        />
      ))}
    </div>
  );
}

// ── Prioritization (moved here from the program drill-down): every initiative
// across ALL programs, color-coded by program. Shared point/legend helpers. ──
type MatrixPoint = HomeInitiative & { programId: string; programName: string; color: string };

const matrixPoints = (t: TransformationData): MatrixPoint[] =>
  t.programs.flatMap((p, idx) =>
    p.initiatives.map((i) => ({
      ...i,
      programId: p.id,
      programName: p.name,
      color: programColor(idx),
    })),
  );

function ProgramLegend({ t }: { t: TransformationData }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-[#525252]">
      {t.programs.map((p, idx) => (
        <Link
          key={p.id}
          to={`/programs/${p.id}`}
          className="inline-flex items-center gap-1.5 hover:text-[#171717]"
        >
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: programColor(idx) }}
          />
          {p.name}
        </Link>
      ))}
    </div>
  );
}

// Value-vs-complexity quadrant matrix — x = complexity (0–10), y = value score.
export function ValueComplexityMatrix({ t }: { t: TransformationData }) {
  const pts = matrixPoints(t);
  if (pts.length === 0) return <div className="text-sm text-[#a3a3a3]">No initiatives yet.</div>;
  const yMax = Math.max(10, Math.ceil(Math.max(0, ...pts.map((i) => i.valueScore ?? 0)) * 1.1));
  return (
    <div>
      <p className="text-xs text-[#a3a3a3] mb-4">
        x = complexity score (0–10, charter), y = value score (Σ impact × objective weight). One
        color per program.
      </p>
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
            <span className="absolute top-2 left-3 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#047857]/60">
              Quick Wins
            </span>
            <span className="absolute top-2 right-3 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#4f46e5]/60">
              Strategic Bets
            </span>
            <span className="absolute bottom-2 left-3 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#a3a3a3]">
              Fill-ins
            </span>
            <span className="absolute bottom-2 right-3 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#be123c]/60">
              Money Pits
            </span>
            {/* dots — one color per program. Positions are clamped a few % in
                from every edge so a dot on an axis extreme (e.g. value 0) is
                still fully visible inside its quadrant, never clipped. */}
            {pts.map((i) => {
              const x = Math.min(95, Math.max(5, ((i.complexityScore ?? 5) / 10) * 100));
              const y = Math.min(95, Math.max(5, ((i.valueScore ?? 0) / yMax) * 100));
              return (
                <Link
                  key={i.id}
                  to={`/initiatives/${i.id}`}
                  className="absolute group"
                  style={{ left: `${x}%`, bottom: `${y}%`, transform: 'translate(-50%, 50%)' }}
                  title={`${i.name} (${i.programName}) — value ${i.valueScore ?? 0}, complexity ${i.complexityScore ?? 5}`}
                >
                  <span
                    className="block w-3 h-3 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: i.color }}
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-[#525252] whitespace-nowrap bg-white/85 px-1 rounded group-hover:text-[#171717]">
                    {i.name}
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="text-center text-[10px] text-[#a3a3a3] mt-1">Complexity →</div>
        </div>
      </div>
      <ProgramLegend t={t} />
    </div>
  );
}

// Ranked table — every initiative across programs, sortable, program color-coded.
type RankSortKey = 'name' | 'programName' | 'valueScore' | 'complexityScore';

export function InitiativesRanked({ t }: { t: TransformationData }) {
  const pts = matrixPoints(t);
  const [sortKey, setSortKey] = useState<RankSortKey>('valueScore');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const sorted = useMemo(() => {
    return [...pts].sort((a, b) => {
      const av =
        sortKey === 'valueScore'
          ? (a.valueScore ?? 0)
          : sortKey === 'complexityScore'
            ? (a.complexityScore ?? 5)
            : a[sortKey];
      const bv =
        sortKey === 'valueScore'
          ? (b.valueScore ?? 0)
          : sortKey === 'complexityScore'
            ? (b.complexityScore ?? 5)
            : b[sortKey];
      const cmp =
        typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return cmp * sortDir;
    });
  }, [pts, sortKey, sortDir]);

  if (pts.length === 0) return <div className="text-sm text-[#a3a3a3]">No initiatives yet.</div>;

  function setSort(k: RankSortKey) {
    if (sortKey === k) setSortDir(sortDir === 1 ? -1 : 1);
    else {
      setSortKey(k);
      setSortDir(k === 'name' || k === 'programName' ? 1 : -1);
    }
  }
  const arrow = (k: RankSortKey) => (sortKey === k ? (sortDir === 1 ? ' ↑' : ' ↓') : '');

  return (
    <div>
      <div className="table-scroll">
        <table className="w-full text-sm">
          <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
            <tr>
              <th
                className="text-left pb-2 font-semibold cursor-pointer select-none"
                onClick={() => setSort('name')}
              >
                Initiative{arrow('name')}
              </th>
              <th
                className="text-left pb-2 font-semibold cursor-pointer select-none"
                onClick={() => setSort('programName')}
              >
                Program{arrow('programName')}
              </th>
              <th
                className="text-center pb-2 font-semibold cursor-pointer select-none w-24"
                onClick={() => setSort('valueScore')}
              >
                Value{arrow('valueScore')}
              </th>
              <th
                className="text-center pb-2 font-semibold cursor-pointer select-none w-28"
                onClick={() => setSort('complexityScore')}
              >
                Complexity{arrow('complexityScore')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((i) => (
              <tr key={i.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]">
                <td className="py-2.5">
                  <Link
                    to={`/initiatives/${i.id}`}
                    className="font-medium text-[#171717] hover:text-[#4f46e5]"
                  >
                    {i.name}
                  </Link>
                </td>
                <td className="py-2.5">
                  <Link
                    to={`/programs/${i.programId}`}
                    className="inline-flex items-center gap-1.5 text-[#525252] hover:text-[#171717]"
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: i.color }}
                    />
                    {i.programName}
                  </Link>
                </td>
                <td className="py-2.5 text-center tnum">{i.valueScore ?? 0}</td>
                <td className="py-2.5 text-center tnum">{i.complexityScore ?? 5}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── RAID by program: one RAID-log box (the same 4-tile grid) per program ────
// The program name and every tile deep-link to that program's RAID tab; tiles
// also preset the type filter there.
export function RaidByProgram({ t }: { t: TransformationData }) {
  if (t.programs.length === 0)
    return <EmptyState baseClassName="text-sm text-[#a3a3a3]" message="No programs yet." />;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {t.programs.map((p) => (
        <div key={p.id} className="rounded-lg border border-[#eaeaea] p-4">
          <Link
            to={`/programs/${p.id}?tab=RAID`}
            className="block text-sm font-semibold text-[#171717] hover:text-[#4f46e5] truncate mb-3"
          >
            {p.name}
          </Link>
          <div className="grid grid-cols-2 gap-3">
            {RAID_TYPES.map((rt) => (
              <RaidTile
                key={rt.type}
                rt={rt}
                total={p.raidOpen?.[rt.type] ?? 0}
                neu={p.raidNew?.[rt.type] ?? 0}
                toAll={`/programs/${p.id}?tab=RAID&type=${rt.type}`}
                toNew={`/programs/${p.id}?tab=RAID&type=${rt.type}&new=1`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
