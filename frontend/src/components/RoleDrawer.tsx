import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { PARTICIPATION_CLASS } from '../lib/format';

// RoleDrawer — the role's full detail (inputs & deliverables, process tasks,
// responsibilities and value-stream participation), rendered as a wide
// slide-over wherever the user already is. Replaces the retired role page
// (OrgTable's RoleDetailView): role links across the app and the sidebar's
// "View full details" button open this instead of navigating.

// ── Shapes (from GET /roles/:id — same payload the old page consumed) ─────────
type RoleParticipation = { valueStreamId: string; valueStreamName: string; participationType: string; subStream: string | null; inputs: string | null; outputs: string | null };
type Grouped = { category: string; items: string[] };
type ServerIoRow = { valueStreamId: string; valueStreamName: string; domain: string | null; l3: string | null; l4: string | null; inputs: string[]; deliverables: string[] };
type ProcTask = { valueStreamId: string; valueStreamName: string; l3: string | null; l4: string | null; stepNumber: number; name: string; relation: 'Lead' | 'Support'; outputs: string | null };
type RoleDetailData = {
  id: string; name: string; roleFamily: string | null; roleLevel: string | null;
  division?: { id: string; name: string }; department?: { id: string; name: string };
  participation: RoleParticipation[]; responsibilities: Grouped[];
  ioRows?: ServerIoRow[]; deliverableCount?: number; inputCount?: number; processTasks?: ProcTask[];
};

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#374151] mb-2">{children}</div>
);

const Empty = ({ text }: { text: string }) => (
  <div className="text-sm text-[#a3a3a3] italic">{text}</div>
);

const Skeleton = () => (
  <div className="space-y-2">
    {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton rounded-md" style={{ height: 48 }} />)}
  </div>
);

export default function RoleDrawer({ roleId, onClose }: { roleId: string; onClose: () => void }) {
  const [r, setR] = useState<RoleDetailData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setR(null); setError('');
    api.get(`/roles/${roleId}`).then(setR).catch((e: Error) => setError(e.message));
  }, [roleId]);

  // Process tasks — the L5 steps the role leads/supports — grouped by value stream.
  const taskGroups = useMemo(() => {
    const groups = new Map<string, { vsId: string; vsName: string; tasks: ProcTask[] }>();
    for (const t of r?.processTasks ?? []) {
      const g = groups.get(t.valueStreamId) ?? { vsId: t.valueStreamId, vsName: t.valueStreamName, tasks: [] };
      g.tasks.push(t); groups.set(t.valueStreamId, g);
    }
    return [...groups.values()].sort((a, b) => a.vsName.localeCompare(b.vsName));
  }, [r]);
  const processTaskCount = r?.processTasks?.length ?? 0;

  return (
    <div className="absolute inset-0 z-30 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop dims the canvas; click to dismiss. */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <aside className="relative h-full bg-white border-l border-[#eaeaea] shadow-2xl flex flex-col" style={{ width: 720, maxWidth: '94vw' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#eaeaea] flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0 flex items-start gap-2.5">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">Role</div>
              <div className="text-[15px] font-bold text-[#171717] leading-snug">
                {r?.name ?? 'Loading…'}
              </div>
              <div className="text-[11px] text-[#a3a3a3] mt-0.5">
                {[r?.roleFamily, r?.department?.name, r?.division?.name].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1 flex-shrink-0 text-[#a3a3a3] hover:text-[#171717] w-7 h-7 rounded-md hover:bg-[#fafafa] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {error ? (
            <div className="text-sm text-[#be123c]">{error}</div>
          ) : !r ? (
            <Skeleton />
          ) : (
            <>
              {/* Value-stream participation — compact chips up top so the long
                  sections below don't bury where the role plays. */}
              <div className="mb-6">
                <SectionLabel>Value-Stream Participation ({r.participation.length})</SectionLabel>
                {r.participation.length === 0 ? <Empty text="Not mapped to any value stream." /> : (
                  <div className="space-y-1.5">
                    {r.participation.map((p, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
                        <div className="min-w-0">
                          <Link to={`/overview?focus=${p.valueStreamId}`} className="text-sm text-brand-700 hover:underline">{p.valueStreamName}</Link>
                          {p.subStream && <div className="text-xs text-slate-400 truncate">{p.subStream}</div>}
                        </div>
                        <span className={`${PARTICIPATION_CLASS[p.participationType] || 'pill-slate'} flex-shrink-0`}>{p.participationType}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Process Tasks — the L5 process steps this role leads or supports,
                  tied back to the role. These are its lowest-level activities; each
                  yields the output shown. */}
              <div className="mb-6">
                <SectionLabel>Process Tasks ({processTaskCount})</SectionLabel>
                <p className="text-xs text-slate-400 -mt-1 mb-3">The process steps this role leads or supports — its lowest-level activities, by value stream.</p>
                {processTaskCount === 0 ? <Empty text="No process steps tie to this role." /> : (
                  <div className="space-y-4">
                    {taskGroups.map((g) => (
                      <div key={g.vsId}>
                        <Link to={`/overview?focus=${g.vsId}`} className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:underline">{g.vsName} ({g.tasks.length})</Link>
                        <ul className="mt-1.5 divide-y divide-slate-100">
                          {g.tasks.map((t, i) => (
                            <li key={i} className="flex items-start gap-2.5 py-2 first:pt-0">
                              <span className={`${t.relation === 'Lead' ? 'pill-blue' : 'pill-slate'} mt-0.5 flex-shrink-0`}>{t.relation}</span>
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] text-slate-700 break-words">{t.name}</div>
                                {t.outputs && <div className="text-[11px] text-[#a3a3a3] mt-0.5 break-words">→ {t.outputs}</div>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
