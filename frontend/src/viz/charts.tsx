import type { ReactNode } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

// Small, reusable insight charts. Titles convey the insight directly — the six
// operating-model questions (who/what/how/where/why/how-well) are answered
// through these visuals, never as labeled lens cards.

export const EMP_COLOR: Record<string, string> = { badged: '#2c5594', contractor: '#7c3aed', si_partner: '#c026d3' };
export const REGION_COLOR: Record<string, string> = { Onshore: '#10b981', Nearshore: '#0ea5e9', Offshore: '#f59e0b' };
export const SEV_COLOR: Record<string, string> = { Critical: '#b91c1c', High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };
export const HEALTH_COLOR: Record<string, string> = { Green: '#10b981', Amber: '#f59e0b', Red: '#ef4444' };
const ACCENT = '#3a5ff0';

export function Card({ title, hint, illustrative, children }: { title: string; hint?: string; illustrative?: boolean; children: ReactNode }) {
  return (
    <div className="lens-card">
      <div className="flex items-center gap-2 mb-0.5">
        <h3 className="text-[12px] font-bold tracking-wide text-slate-700 uppercase">{title}</h3>
        {illustrative && <span className="illustrative-badge ml-auto">Illustrative</span>}
      </div>
      {hint && <div className="text-[11px] text-slate-400 mb-2">{hint}</div>}
      {children}
    </div>
  );
}

// Honest stand-in where a live reading would go. The current metric VALUES are
// not from a connected source, so we show the real definitions (names/targets)
// without fabricating a number.
export function Placeholder({ note, items }: { note: string; items?: { name: string; target?: string | null }[] }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" />{note}</div>
      {items?.length ? (
        <ul className="mt-2 space-y-1">
          {items.slice(0, 8).map((m, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-600 truncate">{m.name}</span>
              {m.target ? <span className="chip-soft flex-shrink-0">target {m.target}</span> : <span className="text-slate-300">—</span>}
            </li>
          ))}
          {items.length > 8 && <li className="text-[11px] text-slate-400">+{items.length - 8} more</li>}
        </ul>
      ) : null}
    </div>
  );
}

export function StatRow({ items }: { items: { value: ReactNode; label: string; tone?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s, i) => (
        <div key={i} className="flex-1 min-w-[72px] rounded-lg bg-slate-50 border border-slate-200/70 px-2.5 py-1.5">
          <div className="text-lg font-bold tnum leading-tight" style={{ color: s.tone ?? '#0f172a' }}>{s.value}</div>
          <div className="text-[10px] text-slate-500 leading-tight">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// Donut with a center caption.
export function Donut({ data, center, sub }: { data: { name: string; value: number; color: string }[]; center: ReactNode; sub?: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <div className="text-xs text-slate-300">No data</div>;
  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: 104, height: 104 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data.filter((d) => d.value > 0)} dataKey="value" innerRadius={34} outerRadius={50} paddingAngle={2} stroke="none">
              {data.filter((d) => d.value > 0).map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center pointer-events-none text-center">
          <div><div className="text-lg font-bold tnum text-slate-900 leading-none">{center}</div>{sub && <div className="text-[9px] text-slate-400 mt-0.5">{sub}</div>}</div>
        </div>
      </div>
      <div className="space-y-1 flex-1 min-w-0">
        {data.filter((d) => d.value > 0).map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <span className="text-slate-600 truncate flex-1">{d.name}</span>
            <span className="tnum text-slate-800 font-medium">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Horizontal % bars (0-100), colored by attainment.
export function AttainmentBars({ data }: { data: { category: string; pct: number; total: number }[] }) {
  const rows = data.filter((d) => d.total > 0).slice(0, 8);
  if (!rows.length) return <div className="text-xs text-slate-300">No measured KPIs</div>;
  return (
    <div className="space-y-1.5">
      {rows.map((d) => (
        <div key={d.category}>
          <div className="flex justify-between text-[11px] text-slate-500"><span className="truncate">{d.category}</span><span className="tnum">{d.pct}%</span></div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <span className="block h-full rounded-full" style={{ width: `${d.pct}%`, background: d.pct >= 75 ? '#10b981' : d.pct >= 50 ? '#f59e0b' : '#ef4444' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// KPI value vs target mini-bars.
export function KpiBars({ metrics }: { metrics: any[] }) {
  const rows = metrics.slice(0, 6).map((m) => {
    const good = m.target == null ? null : m.direction === 'down' ? m.value <= m.target : m.value >= m.target;
    return { name: m.name.length > 22 ? m.name.slice(0, 22) + '…' : m.name, value: m.value, fill: good == null ? '#94a3b8' : good ? '#10b981' : '#ef4444', target: m.target, unit: m.unit, full: m.name };
  });
  if (!rows.length) return <div className="text-xs text-slate-300">No KPIs</div>;
  return (
    <div style={{ height: rows.length * 30 + 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 28, top: 2, bottom: 2 }} barCategoryGap={6}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v: any, _n, p: any) => [`${v}${p.payload.unit}${p.payload.target != null ? ` (target ${p.payload.target})` : ''}`, p.payload.full]} />
          <Bar dataKey="value" radius={[3, 3, 3, 3]}>
            {rows.map((r, i) => <Cell key={i} fill={r.fill} />)}
            <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: '#475569' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Risk severity bars.
export function SeverityBars({ bySeverity }: { bySeverity: { severity: string; count: number }[] }) {
  const total = bySeverity.reduce((a, s) => a + s.count, 0);
  if (!total) return <div className="text-xs text-slate-300">No risks</div>;
  return (
    <div className="space-y-1">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
        {bySeverity.map((s) => s.count > 0 && <span key={s.severity} style={{ width: `${(s.count / total) * 100}%`, background: SEV_COLOR[s.severity] }} title={`${s.severity}: ${s.count}`} />)}
      </div>
      <div className="flex flex-wrap gap-2">
        {bySeverity.filter((s) => s.count > 0).map((s) => (
          <span key={s.severity} className="inline-flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full" style={{ background: SEV_COLOR[s.severity] }} />{s.count} {s.severity}</span>
        ))}
      </div>
    </div>
  );
}

// Category focus bars (checklist items by category).
export function CategoryBars({ data }: { data: { category: string; count: number }[] }) {
  const rows = data.slice(0, 8);
  if (!rows.length) return <div className="text-xs text-slate-300">No data</div>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className="space-y-1">
      {rows.map((d) => (
        <div key={d.category} className="flex items-center gap-2 text-[11px]">
          <span className="w-28 truncate text-slate-500">{d.category}</span>
          <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><span className="block h-full rounded-full bg-accent-400" style={{ width: `${(d.count / max) * 100}%` }} /></span>
          <span className="tnum text-slate-700 w-7 text-right">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

// Process-flow strip: numbered steps left-to-right.
export function FlowStrip({ steps }: { steps: { id: string; stepNumber: number; name: string; leads?: string | null }[] }) {
  if (!steps?.length) return <div className="text-xs text-slate-300">No mapped steps</div>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {steps.slice(0, 14).map((s, i) => (
        <div key={s.id} className="flex items-center gap-1.5">
          <div className="rounded-lg border border-slate-200 bg-white px-2 py-1 max-w-[150px]" title={s.leads ? `Lead: ${s.leads}` : undefined}>
            <span className="text-[9px] font-bold text-accent-600 mr-1">{s.stepNumber}</span>
            <span className="text-[11px] text-slate-700">{s.name.length > 26 ? s.name.slice(0, 26) + '…' : s.name}</span>
          </div>
          {i < Math.min(steps.length, 14) - 1 && <span className="text-slate-300 text-xs">→</span>}
        </div>
      ))}
      {steps.length > 14 && <span className="text-[11px] text-slate-400 self-center">+{steps.length - 14} more</span>}
    </div>
  );
}

// I/O mix (inputs / outputs / deliverables).
export function IoMix({ io }: { io: { Input: number; Output: number; Deliverable: number; total: number } }) {
  if (!io?.total) return <div className="text-xs text-slate-300">No I/O mapped</div>;
  return <Donut center={io.total} sub="items" data={[{ name: 'Inputs', value: io.Input, color: '#0ea5e9' }, { name: 'Outputs', value: io.Output, color: '#10b981' }, { name: 'Deliverables', value: io.Deliverable, color: '#7c3aed' }]} />;
}
