import { useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { STAGE_ORDER, STAGE_LABELS, STATUS_PILL_CLASS, STATUS_LABEL } from './format';

// Shared types + themed UI primitives for the Initiative Tracker tab. Kept
// separate so the four pages stay lean and visually consistent with the rest of
// the app (Vercel-clean cards, hairline borders, monochrome bars — no Recharts).

export type Stage = 'IDEA' | 'PLAN' | 'EXECUTE' | 'REALIZE' | 'COMPLETE';
export type Status = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK';

export type MetricValue = { dataset: string; periodStart: string; amount: number };
export type Line = { id: string; name: string; category: string | null; startDate: string; endDate: string; values: MetricValue[] };
export type Milestone = { id: string; name: string; dueDate: string; completedAt: string | null; isGate: boolean; status: string };
export type Raid = { id: string; type: string; title: string; description: string | null; probability: number; impact: number; severity: number; mitigation: string | null; status: string };

export type Objective = { id: string; name: string; description: string | null; weight: number; _count?: { links: number } };
export type ObjectiveLink = { id: string; objectiveId: string; impact: number; objective: { id: string; name: string; weight: number } };
export type Resource = { id: string; personId: string | null; roleName: string | null; name: string; allocationPct: number; startDate: string; endDate: string };
export type Activity = { id: string; name: string; startDate: string; endDate: string; status: string; dependsOnId: string | null; sortOrder: number };

export type InitiativeLinks = {
  valueStreamId: string | null; divisionId: string | null; ownerRoleId: string | null; sponsorRoleId: string | null;
  valueStreamName: string | null; divisionName: string | null; ownerRoleName: string | null; sponsorRoleName: string | null;
};

export type Initiative = InitiativeLinks & {
  id: string; companyId: string; name: string; description: string | null;
  stage: string; workflowAction: string | null; state: string;
  status: string; statusNote: string | null; startDate: string; dueDate: string;
  cumulativeBenefit: number; cumulativeCost: number; cumulativeNetBenefit: number;
  complexityScore: number; valueScore: number;
  workstream: { id: string; name: string; program: { id: string; name: string } };
  benefits: Line[]; costs: Line[]; milestones: Milestone[]; raidItems: Raid[];
  objectives: ObjectiveLink[]; resources: Resource[]; activities: Activity[];
  _count?: { raidItems: number; milestones: number };
};

export type LinkOptions = { valueStreams: { id: string; name: string }[]; divisions: { id: string; name: string }[]; roles: { id: string; name: string }[] };

// Append the active company to a query path.
export function withCompany(path: string, companyId: string | null): string {
  if (!companyId) return path;
  return path + (path.includes('?') ? '&' : '?') + `companyId=${companyId}`;
}

// ─── Pills / badges ────────────────────────────────────────────────────────
export function StatusPill({ status }: { status: string }) {
  return <span className={STATUS_PILL_CLASS[status] ?? 'pill-slate'}>{STATUS_LABEL[status] ?? status}</span>;
}

// Five-segment stage progress bar (uses the global .stage-pip classes).
export function StageBar({ stage }: { stage: string }) {
  const idx = STAGE_ORDER.indexOf(stage);
  return (
    <div className="flex items-center gap-1">
      {STAGE_ORDER.map((s, i) => (
        <div key={s} title={STAGE_LABELS[s]} className={'stage-pip ' + (i <= idx ? 'stage-pip-filled' : 'stage-pip-empty')} />
      ))}
    </div>
  );
}

export function StageChip({ stage }: { stage: string }) {
  const idx = STAGE_ORDER.indexOf(stage);
  return <span className="pill-blue tnum">{idx + 1}. {STAGE_LABELS[stage] ?? stage}</span>;
}

// ── Risk scoring bands (DB-driven) ──────────────────────────────────────────
// Severity = probability × impact on the standard 5×5 matrix (1–25). The bands
// that turn that number into a rating (Low/Moderate/High/Critical + color) are
// company data — Data Admin → Initiatives → Risk scoring bands — fetched once
// and cached for the session.
export type RiskBand = { id: string; label: string; minScore: number; maxScore: number; color: string; description: string | null };

let bandsCache: RiskBand[] | null = null;
let bandsPromise: Promise<RiskBand[]> | null = null;
const bandsListeners = new Set<(b: RiskBand[]) => void>();

function loadBands(): Promise<RiskBand[]> {
  if (bandsCache) return Promise.resolve(bandsCache);
  bandsPromise ??= api.get('/portfolio/risk-bands')
    .then((r: { bands: RiskBand[] }) => {
      bandsCache = r.bands ?? [];
      bandsListeners.forEach((fn) => fn(bandsCache!));
      return bandsCache!;
    })
    .catch(() => (bandsCache = []));
  return bandsPromise;
}

export function useRiskBands(): RiskBand[] {
  const [bands, setBands] = useState<RiskBand[]>(bandsCache ?? []);
  useEffect(() => {
    if (bandsCache) return;
    bandsListeners.add(setBands);
    void loadBands();
    return () => { bandsListeners.delete(setBands); };
  }, []);
  return bands;
}

export function bandFor(bands: RiskBand[], score: number): RiskBand | null {
  return bands.find((b) => score >= b.minScore && score <= b.maxScore) ?? null;
}

// Fallback when bands haven't loaded yet (matches the seeded defaults).
function fallback(v: number): { label: string; color: string } {
  return v >= 17 ? { label: 'High', color: '#be123c' } : v >= 9 ? { label: 'Medium', color: '#b45309' } : { label: 'Low', color: '#047857' };
}

// Shows only the RATING (Low/Medium/High …); the raw 5×5 score stays in the
// tooltip so the number never reads as an unanchored magnitude.
export function SeverityCell({ value }: { value: number }) {
  const bands = useRiskBands();
  const band = bandFor(bands, value);
  const label = band?.label ?? fallback(value).label;
  const color = band?.color ?? fallback(value).color;
  return (
    <span
      title={`Probability × impact on the 5×5 risk matrix: ${value} of 25${band?.description ? ` — ${band.description}` : ''}`}
      className="inline-flex items-center rounded px-2 h-6 text-white font-semibold text-xs"
      style={{ background: color }}
    >
      {label}
    </span>
  );
}

// ─── Layout primitives ──────────────────────────────────────────────────────
export function Tile({ label, value, hint, tone = 'neutral' }: { label: string; value: ReactNode; hint?: string; tone?: 'neutral' | 'positive' | 'negative' }) {
  const color = tone === 'positive' ? 'text-[#047857]' : tone === 'negative' ? 'text-[#be123c]' : 'text-[#171717]';
  return (
    <div className="card-elevated p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{label}</div>
      <div className={`text-2xl font-semibold mt-1 tnum ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-[#a3a3a3] mt-0.5">{hint}</div>}
    </div>
  );
}

export function SectionCard({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-[#171717]">{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  );
}

// Horizontal bar list (mirrors the Overview dashboard's BarList).
export function BarList({ groups, color }: { groups: { key: string; count: number }[]; color?: string | ((k: string) => string) }) {
  const max = Math.max(1, ...groups.map((g) => g.count));
  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const c = typeof color === 'function' ? color(g.key) : color ?? '#171717';
        return (
          <div key={g.key} className="flex items-center gap-3">
            <div className="w-28 text-xs text-[#525252] truncate flex-shrink-0">{g.key}</div>
            <div className="flex-1 h-5 bg-[#f5f5f5] rounded overflow-hidden">
              <div className="h-full rounded" style={{ width: `${(g.count / max) * 100}%`, backgroundColor: c, minWidth: g.count ? 2 : 0 }} />
            </div>
            <div className="w-8 text-right text-xs text-[#171717] tnum flex-shrink-0">{g.count}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Themed modal ────────────────────────────────────────────────────────────
export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 overflow-y-auto" onClick={onClose}>
      <div
        className={`bg-white rounded-lg border border-[#eaeaea] shadow-lg w-full my-auto max-h-[calc(100vh-2rem)] overflow-y-auto ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-[#eaeaea] sticky top-0 bg-white">
          <h2 className="text-sm font-semibold text-[#171717]">{title}</h2>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Lightweight SVG multi-series line chart ──────────────────────────────────
// Replaces Recharts. Renders a responsive line chart with a baseline, a max
// gridline, and a legend. Series amounts share one y-scale.
export function SvgLineChart({
  labels, series, height = 240, formatValue,
}: {
  labels: string[];
  series: { name: string; color: string; data: number[]; dashed?: boolean }[];
  height?: number;
  formatValue?: (n: number) => string;
}) {
  if (labels.length === 0) {
    return <div className="text-sm text-[#a3a3a3] py-8 text-center">No data yet.</div>;
  }
  const W = 640, H = height, padL = 52, padR = 12, padT = 12, padB = 28;
  const max = Math.max(1, ...series.flatMap((s) => s.data));
  const n = labels.length;
  const x = (i: number) => padL + (n <= 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1));
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const fmtV = formatValue ?? ((v: number) => String(Math.round(v)));
  // Show at most ~8 x labels to avoid crowding.
  const labelStep = Math.ceil(n / 8);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-[11px] text-[#525252]">
            <span className="inline-block w-3 h-0.5" style={{ backgroundColor: s.color, borderTop: s.dashed ? `2px dashed ${s.color}` : undefined, height: s.dashed ? 0 : 2 }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img">
        {/* gridlines */}
        <line x1={padL} y1={y(0)} x2={W - padR} y2={y(0)} stroke="#eaeaea" strokeWidth={1} />
        <line x1={padL} y1={y(max)} x2={W - padR} y2={y(max)} stroke="#f5f5f5" strokeWidth={1} />
        <text x={padL - 6} y={y(max) + 4} textAnchor="end" fontSize={10} fill="#a3a3a3">{fmtV(max)}</text>
        <text x={padL - 6} y={y(0) + 4} textAnchor="end" fontSize={10} fill="#a3a3a3">0</text>
        {/* x labels */}
        {labels.map((l, i) => (i % labelStep === 0 ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#a3a3a3">{l.slice(2)}</text>
        ) : null))}
        {/* series */}
        {series.map((s) => (
          <polyline
            key={s.name}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '5 4' : undefined}
            strokeLinejoin="round"
            points={s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          />
        ))}
      </svg>
    </div>
  );
}

// ─── Lightweight CSS timeline (Gantt) ────────────────────────────────────────
// Maps dates onto a 0–100% horizontal axis padded two weeks either side, with
// month tick marks. Shared by the initiative Workplan and the program Roadmap.
export type TimelineScale = { min: number; max: number; pct: (d: string | Date) => number; ticks: { pct: number; label: string }[] };

export const ACTIVITY_STATUS_COLOR: Record<string, string> = { PLANNED: '#a3a3a3', IN_PROGRESS: '#4f46e5', DONE: '#047857' };
export const ACTIVITY_STATUS_LABEL: Record<string, string> = { PLANNED: 'Planned', IN_PROGRESS: 'In progress', DONE: 'Done' };

export function makeTimelineScale(dates: (string | Date)[], unit: 'month' | 'quarter' = 'month'): TimelineScale | null {
  const ts = dates.map((d) => new Date(d).getTime()).filter((n) => !Number.isNaN(n));
  if (ts.length === 0) return null;
  const TWO_WEEKS = 14 * 86400000;
  const min = Math.min(...ts) - TWO_WEEKS;
  const max = Math.max(...ts) + TWO_WEEKS;
  const span = Math.max(1, max - min);
  const pct = (d: string | Date) => Math.min(100, Math.max(0, ((new Date(d).getTime() - min) / span) * 100));
  // Period-start ticks (month or calendar quarter), thinned to at most ~12 labels.
  const intervalMonths = unit === 'quarter' ? 3 : 1;
  const periodCount = Math.ceil(span / (intervalMonths * 30 * 86400000));
  const step = Math.max(1, Math.ceil(periodCount / 12));
  const label = (d: Date) => unit === 'quarter'
    ? `Q${Math.floor(d.getMonth() / 3) + 1} '${String(d.getFullYear()).slice(2)}`
    : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  const ticks: { pct: number; label: string }[] = [];
  const first = new Date(min);
  let cur = unit === 'quarter'
    ? new Date(first.getFullYear(), Math.floor(first.getMonth() / 3) * 3 + 3, 1)
    : new Date(first.getFullYear(), first.getMonth() + 1, 1);
  let i = 0;
  while (cur.getTime() <= max) {
    if (i % step === 0) ticks.push({ pct: ((cur.getTime() - min) / span) * 100, label: label(cur) });
    cur = new Date(cur.getFullYear(), cur.getMonth() + intervalMonths, 1);
    i++;
  }
  return { min, max, pct, ticks };
}

// Month tick labels + hairline gridlines for a timeline block. Rendered inside
// a `relative` container; the gridlines stretch the full height behind rows.
export function TimelineGrid({ scale }: { scale: TimelineScale }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {scale.ticks.map((t, i) => (
        <div key={i} className="absolute top-0 bottom-0 border-l border-[#f5f5f5]" style={{ left: `${t.pct}%` }} />
      ))}
    </div>
  );
}

export function TimelineAxis({ scale }: { scale: TimelineScale }) {
  return (
    <div className="relative h-5">
      {scale.ticks.map((t, i) => (
        <span key={i} className="absolute top-0 text-[10px] text-[#a3a3a3] whitespace-nowrap" style={{ left: `${t.pct}%` }}>
          {t.label}
        </span>
      ))}
    </div>
  );
}

// Roll month-keyed metric values into a sorted list of period keys (YYYY-MM).
export function monthKeysFromLines(...lineSets: Line[][]): string[] {
  const keys = new Set<string>();
  for (const set of lineSets) for (const l of set) for (const v of l.values) keys.add(v.periodStart.slice(0, 7));
  return [...keys].sort();
}

// Generate the contiguous YYYY-MM keys spanning a date range.
export function generateMonths(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start), e = new Date(end);
  let cur = new Date(s.getFullYear(), s.getMonth(), 1);
  while (cur <= e) { out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); }
  return out;
}
