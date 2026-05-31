import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import type { DrillItem } from '../viz/DrillCanvas';

const EMP_LABEL: Record<string, string> = { contractor: 'Contractor', si_partner: 'SI Partner', badged: 'Employee' };
const REGION_TONE: Record<string, string> = {
  Offshore: 'bg-amber-50 text-amber-700 border-amber-200',
  Nearshore: 'bg-sky-50 text-sky-700 border-sky-200',
  Onshore: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const STATUS_TONE: Record<string, string> = {
  'Done': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'In Progress': 'bg-accent-50 text-accent-700 border-accent-200',
  'To Do': 'bg-slate-100 text-slate-600 border-slate-200',
  'Blocked': 'bg-red-50 text-red-700 border-red-200',
};

function monogram(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export default function PersonBoard({ node, onInspect }: { node: any; onInspect: (item: DrillItem) => void }) {
  const who = node.lenses.who ?? {};
  const hw = node.lenses.howWell ?? {};
  const series: { name: string; points: { period: string; value: number }[] }[] = hw.series ?? [];
  const latest: any[] = hw.latest ?? [];
  const latestByName = new Map(latest.map((m) => [m.name, m]));
  const tasks: any[] = node.children?.items ?? [];

  return (
    <div className="h-full w-full overflow-y-auto rounded-2xl border border-slate-200/70 bg-surface-sunken p-5 animate-fade-in">
      {/* Identity */}
      <div className="card-elevated p-5 mb-4">
        <div className="flex items-start gap-4">
          <span className="grid place-items-center rounded-2xl text-white text-lg font-bold flex-shrink-0" style={{ width: 56, height: 56, background: '#0f766e' }}>
            {monogram(node.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-h2 text-slate-900">{node.name}</h2>
              <span className="illustrative-badge">Illustrative</span>
            </div>
            <div className="text-sm text-slate-500 mt-0.5">{who.title}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="chip-soft">{EMP_LABEL[who.employmentType] ?? who.employmentType}</span>
              {who.region && <span className={`chip border ${REGION_TONE[who.region] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{who.region}</span>}
              {who.vendor && <span className="chip-soft">{who.vendor}</span>}
              {who.location && <span className="chip-soft">{who.location}</span>}
            </div>
          </div>
        </div>
        {(who.roles?.length || who.initiatives?.length) ? (
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            {who.roles?.length > 0 && (
              <div>
                <div className="lens-eyebrow">Role &amp; allocation</div>
                {who.roles.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between text-sm py-0.5">
                    <span className="text-slate-700 truncate">{r.name}</span>
                    <span className="tnum text-slate-500">{r.allocationPct}%</span>
                  </div>
                ))}
              </div>
            )}
            {who.initiatives?.length > 0 && (
              <div>
                <div className="lens-eyebrow">On initiatives</div>
                {who.initiatives.map((i: any) => (
                  <div key={i.id} className="flex items-center gap-2 text-sm py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: i.health === 'Red' ? '#ef4444' : i.health === 'Amber' ? '#f59e0b' : '#10b981' }} />
                    <span className="text-slate-700 truncate">{i.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Performance — How well */}
      <div className="lens-eyebrow mb-2">Performance · last 6 months <span className="illustrative-badge ml-1">Illustrative</span></div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        {series.map((s) => {
          const m: any = latestByName.get(s.name) ?? {};
          const good = m.target == null ? null : m.direction === 'down' ? m.value <= m.target : m.value >= m.target;
          return (
            <div key={s.name} className="card-elevated p-4">
              <div className="flex items-baseline justify-between">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">{s.name}</div>
                {m.target != null && (
                  <span className={`text-[10px] font-semibold ${good ? 'text-emerald-600' : 'text-amber-600'}`}>{good ? 'on target' : 'below'}</span>
                )}
              </div>
              <div className="text-2xl font-bold text-slate-900 tnum leading-tight mt-0.5">
                {m.value ?? s.points[s.points.length - 1]?.value}
                <span className="text-sm font-medium text-slate-400 ml-1">{m.unit}</span>
              </div>
              <div style={{ height: 56 }} className="mt-1 -mx-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={s.points} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                    <CartesianGrid vertical={false} stroke="#eef1f7" />
                    <XAxis dataKey="period" tickFormatter={(p) => p.slice(5)} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} labelFormatter={(p) => p} />
                    {m.target != null && <ReferenceLine y={m.target} stroke="#f59e0b" strokeDasharray="3 3" />}
                    <Line type="monotone" dataKey="value" stroke="#3a5ff0" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tasks — What */}
      <div className="lens-eyebrow mb-2">Current work · {tasks.length} tasks</div>
      <div className="grid sm:grid-cols-2 gap-2">
        {tasks.map((t) => (
          <button
            key={t.id}
            onClick={() => onInspect({ id: t.id, type: 'task', name: t.name, subtitle: t.subtitle, badges: t.badges })}
            className="text-left card-elevated p-3 hover:shadow-float hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-center gap-2">
              <span className={`chip border ${STATUS_TONE[t.badges?.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{t.badges?.status}</span>
              {t.badges?.priority && <span className="chip-soft">{t.badges.priority}</span>}
            </div>
            <div className="text-sm text-slate-700 mt-1.5 line-clamp-2">{t.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
