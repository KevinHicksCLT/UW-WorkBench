import type { ReactNode } from 'react';
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

export type InitiativeLinks = {
  valueStreamId: string | null; divisionId: string | null; ownerRoleId: string | null; sponsorRoleId: string | null;
  valueStreamName: string | null; divisionName: string | null; ownerRoleName: string | null; sponsorRoleName: string | null;
};

export type Initiative = InitiativeLinks & {
  id: string; name: string; description: string | null;
  stage: string; workflowAction: string | null; state: string;
  status: string; statusNote: string | null; startDate: string; dueDate: string;
  cumulativeBenefit: number; cumulativeCost: number; cumulativeNetBenefit: number;
  workstream: { id: string; name: string; program: { id: string; name: string } };
  benefits: Line[]; costs: Line[]; milestones: Milestone[]; raidItems: Raid[];
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

export function severityClass(v: number): string {
  return v >= 16 ? 'bg-[#be123c]' : v >= 9 ? 'bg-[#b45309]' : 'bg-[#047857]';
}

export function SeverityCell({ value }: { value: number }) {
  return (
    <span className={`inline-flex items-center justify-center w-9 h-6 rounded text-white font-semibold text-xs tnum ${severityClass(value)}`}>
      {value}
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
