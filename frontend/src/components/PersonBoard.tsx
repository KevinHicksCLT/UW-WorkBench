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
const PRIORITY_TONE: Record<string, string> = {
  'High': 'bg-loss-50 text-loss-700 border-loss-200',
  'Medium': 'bg-overlap-50 text-overlap-700 border-overlap-200',
  'Low': 'bg-slate-50 text-slate-500 border-slate-200',
};
const HEALTH_DOT: Record<string, string> = { Green: '#10b981', Amber: '#f59e0b', Red: '#ef4444' };

function monogram(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export default function PersonBoard({ node, onInspect }: { node: any; onInspect: (item: DrillItem) => void }) {
  const who = node.lenses.who ?? {};
  const tasks: any[] = node.children?.items ?? [];
  const blocked = tasks.filter((t) => t.badges?.status === 'Blocked');
  const inProgress = tasks.filter((t) => t.badges?.status === 'In Progress');
  const toDo = tasks.filter((t) => t.badges?.status === 'To Do');
  const done = tasks.filter((t) => t.badges?.status === 'Done');

  return (
    <div className="h-full w-full overflow-y-auto rounded-2xl border border-slate-200/70 bg-surface-sunken p-5 animate-rise-in">

      {/* ── Identity card ─────────────────────────────────────────────────── */}
      <div className="card-elevated p-5 mb-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <span
            className="grid place-items-center rounded-2xl text-white text-lg font-bold flex-shrink-0 shadow-card"
            style={{ width: 56, height: 56, background: '#0f766e' }}
          >
            {monogram(node.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-h2 text-slate-900">{node.name}</h2>
              <span className="illustrative-badge">Illustrative</span>
            </div>
            {who.title && <div className="text-sm text-slate-500 mt-0.5">{who.title}</div>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="chip-soft">{EMP_LABEL[who.employmentType] ?? who.employmentType}</span>
              {who.region && <span className={`chip border ${REGION_TONE[who.region] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{who.region}</span>}
              {who.vendor && <span className="chip-soft">{who.vendor}</span>}
              {who.location && <span className="chip-soft">{who.location}</span>}
            </div>
          </div>
        </div>

        {/* Role & initiative assignments */}
        {(who.roles?.length || who.initiatives?.length) ? (
          <div className="mt-4 border-t border-slate-100 pt-4 grid sm:grid-cols-2 gap-4">
            {who.roles?.length > 0 && (
              <div>
                <div className="lens-eyebrow">Role &amp; allocation</div>
                <div className="mt-1 space-y-1">
                  {who.roles.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 truncate">{r.name}</span>
                      <span className="tnum text-slate-400 text-xs ml-2 flex-shrink-0">{r.allocationPct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {who.initiatives?.length > 0 && (
              <div>
                <div className="lens-eyebrow">On initiatives</div>
                <div className="mt-1 space-y-1">
                  {who.initiatives.map((i: any) => (
                    <div key={i.id} className="flex items-center gap-2 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: HEALTH_DOT[i.health] ?? '#94a3b8' }} />
                      <span className="text-slate-700 truncate">{i.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ── Performance placeholder ────────────────────────────────────────── */}
      <div className="mb-4">
        <div className="lens-eyebrow mb-2">Performance</div>
        <div className="lens-card border-dashed">
          <div className="flex items-start gap-2 text-sm text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-300 mt-0.5 flex-shrink-0" />
            <span>Individual metrics aren't connected to a live source yet.</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-400">Throughput, quality, utilization and cycle-time will populate here once a connector (Git / Jira / ITSM) is wired up.</div>
        </div>
      </div>

      {/* ── Task board ────────────────────────────────────────────────────── */}
      {tasks.length > 0 && (
        <>
          <div className="lens-eyebrow mb-2">
            Current work
            <span className="ml-auto text-[10px] font-medium normal-case tracking-normal text-slate-400">{tasks.length} tasks</span>
          </div>

          {/* Summary bar */}
          <div className="flex items-center gap-3 mb-3 text-[11px] text-slate-500">
            {blocked.length > 0 && <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-loss-500" />{blocked.length} blocked</span>}
            {inProgress.length > 0 && <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-accent-400" />{inProgress.length} in progress</span>}
            {toDo.length > 0 && <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" />{toDo.length} to do</span>}
            {done.length > 0 && <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gain-500" />{done.length} done</span>}
          </div>

          {/* Blocked tasks first (if any) */}
          {blocked.length > 0 && (
            <div className="callout-loss mb-3">
              <span className="dot-loss flex-shrink-0 mt-0.5" />
              <span>{blocked.length} task{blocked.length !== 1 ? 's' : ''} blocked — requires attention.</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-2">
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => onInspect({ id: t.id, type: 'task', name: t.name, subtitle: t.subtitle, badges: t.badges })}
                className="text-left card-elevated p-3 hover:shadow-float hover:-translate-y-0.5 transition-all duration-200 ease-out"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`chip border ${STATUS_TONE[t.badges?.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {t.badges?.status}
                  </span>
                  {t.badges?.priority && (
                    <span className={`chip border ${PRIORITY_TONE[t.badges.priority] ?? 'chip-soft'}`}>
                      {t.badges.priority}
                    </span>
                  )}
                </div>
                <div className="text-[13px] font-medium text-slate-700 mt-1.5 line-clamp-2 leading-snug">{t.name}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
