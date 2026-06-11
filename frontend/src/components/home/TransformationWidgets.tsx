import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt } from '../../lib/format';
import { StatusPill, makeTimelineScale, TimelineGrid, TimelineAxis } from '../../lib/portfolio';

// ─── Transformation command-center widgets (Home, D1) ────────────────────────
// The widget BODIES for the Home dashboard's transformation widgets — the
// programs→initiatives rollup, the Gantt timeline, OKRs, risks/RAID and the
// Viva-style workforce signals. The catalog in lib/dashboardWidgets wraps each
// of these in its Card and feeds it the `transformation` slice of the
// GET /dashboard payload. Everything links into the existing /portfolio detail
// pages (programs, initiatives, RAID log), which remain the drill-down targets.

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
      <tr className="border-b border-[#f5f5f5]">
        <td className="py-2.5">
          <span className="flex items-center gap-1.5">
            <button onClick={onToggle} aria-expanded={open} aria-label={open ? 'Collapse initiatives' : 'Expand initiatives'} className="text-[#a3a3a3] hover:text-[#171717] flex-shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={'transition-transform duration-150 ' + (open ? 'rotate-90' : '')}>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <Link to={`/portfolio/programs/${p.id}`} className="font-medium text-[#171717] hover:text-[#4f46e5]">{p.name}</Link>
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
            <Link to={`/portfolio/initiatives/${i.id}`} className="text-[#525252] hover:text-[#4f46e5]">{i.name}</Link>
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
export function ProgramGantt({ t }: { t: TransformationData }) {
  const dates: (string | Date)[] = t.programs.flatMap((p) => [p.startDate, p.endDate, ...p.milestones.map((m) => m.dueDate)]);
  const scale = makeTimelineScale(dates);
  if (!scale || t.programs.length === 0) return <div className="text-sm text-[#a3a3a3]">No dated programs yet.</div>;
  const now = Date.now();
  const showToday = now >= scale.min && now <= scale.max;
  return (
    <div>
      <div className="flex">
        <div className="w-44 flex-shrink-0" />
        <div className="flex-1 relative"><TimelineAxis scale={scale} /></div>
      </div>
      <div className="flex">
        <div className="w-44 flex-shrink-0">
          {t.programs.map((p) => (
            <div key={p.id} className="h-9 flex items-center pr-3">
              <Link to={`/portfolio/programs/${p.id}`} className="text-xs font-medium text-[#171717] hover:text-[#4f46e5] truncate">{p.name}</Link>
            </div>
          ))}
        </div>
        <div className="flex-1 relative">
          <TimelineGrid scale={scale} />
          {showToday && (
            <div className="absolute top-0 bottom-0 w-px bg-[#be123c] z-10" style={{ left: `${scale.pct(new Date(now))}%` }} title="Today" />
          )}
          {t.programs.map((p) => {
            const left = scale.pct(p.startDate);
            const width = Math.max(1, scale.pct(p.endDate) - left);
            return (
              <div key={p.id} className="h-9 relative">
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-3.5 rounded-full opacity-90"
                  style={{ left: `${left}%`, width: `${width}%`, backgroundColor: STATUS_COLOR[p.computedStatus] ?? '#4f46e5' }}
                  title={`${p.name} · ${fmt.month(p.startDate)} – ${fmt.month(p.endDate)} · ${p.pctComplete}% complete`}
                />
                {p.milestones.map((m) => (
                  <div
                    key={m.id}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border border-white"
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
        <span className="flex items-center gap-1.5"><span className="w-4 h-1.5 rounded-full bg-[#4f46e5] inline-block" /> Program</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rotate-45 bg-[#171717] inline-block" /> Milestone</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rotate-45 bg-[#047857] inline-block" /> Done</span>
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
function SeverityBadge({ value }: { value: number }) {
  const color = value >= 16 ? '#dc2626' : value >= 10 ? '#d97706' : '#65a30d';
  return (
    <span className="inline-flex items-center justify-center w-7 h-5 rounded text-[11px] font-semibold text-white tnum flex-shrink-0" style={{ backgroundColor: color }}>
      {value}
    </span>
  );
}

export function TopRisks({ t }: { t: TransformationData }) {
  if (t.topRisks.length === 0) return <div className="text-sm text-[#a3a3a3]">No open risks.</div>;
  return (
    <div className="space-y-2">
      {t.topRisks.map((r) => (
        <div key={r.id} className="flex items-center gap-2.5 text-sm">
          <SeverityBadge value={r.severity} />
          <div className="min-w-0 flex-1">
            <Link to={`/portfolio/initiatives/${r.initiativeId}`} className="block truncate text-[#171717] hover:text-[#4f46e5]">{r.title}</Link>
            <div className="text-[10px] text-[#a3a3a3] truncate">{r.initiativeName}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── RAID log: open counts by type ────────────────────────────────────────────
export function RaidSummary({ t }: { t: TransformationData }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {(['RISK', 'ISSUE', 'ASSUMPTION', 'DECISION'] as const).map((type) => {
        const n = t.raidOpen[type] ?? 0;
        return (
          <div key={type} className={'rounded-md border p-3 ' + (n > 0 && type === 'RISK' ? 'border-[#fecaca] bg-[#fef2f2]' : 'border-[#eeeeee] bg-[#fafafa]')}>
            <div className="text-[10px] uppercase tracking-[0.08em] text-[#a3a3a3]">{type.charAt(0) + type.slice(1).toLowerCase()}s</div>
            <div className="text-xl font-semibold tnum text-[#171717]">{n}</div>
          </div>
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
