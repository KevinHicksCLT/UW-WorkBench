import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

// ValueStreamDrawer — the value stream's full detail (Process L4 & L5 tree +
// participating roles), rendered as a wide slide-over on the map/list view.
// Replaces the retired /value-streams/:id page so the detail is reachable in
// place from the "View full details" button in the right-hand sidebar.

const PART_CLASS: Record<string, string> = { Lead: 'part-lead', Core: 'part-core', Control: 'part-control', Oversight: 'part-oversight', Support: 'part-support' };

type Detail = {
  name: string;
  domain: string | null;
  processAreas: { id: string; name: string; subProcesses: { id: string; name: string; description: string | null; inputs?: string[]; outputs?: string[]; steps?: { name: string; leads: string | null }[] }[] }[];
  roles: { roleId: string; roleName: string; participationType: string }[];
};

export default function ValueStreamDrawer({ valueStreamId, onClose }: { valueStreamId: string; onClose: () => void }) {
  const [vs, setVs] = useState<Detail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setVs(null);
    setError('');
    api.get(`/value-streams/${valueStreamId}`).then(setVs).catch((e: Error) => setError(e.message));
  }, [valueStreamId]);

  const processAreas = vs?.processAreas ?? [];
  const roles = vs?.roles ?? [];

  return (
    <div className="absolute inset-0 z-30 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop dims the canvas; click to dismiss. */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <aside className="relative h-full bg-white border-l border-[#eaeaea] shadow-2xl flex flex-col" style={{ width: 640, maxWidth: '92vw' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#eaeaea] flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">Value stream</div>
            <div className="text-[15px] font-bold text-[#171717] leading-snug">{vs?.name ?? 'Loading…'}</div>
            {vs?.domain && <div className="text-[11px] text-[#a3a3a3] mt-0.5">{vs.domain}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1 flex-shrink-0 text-[#a3a3a3] hover:text-[#171717] w-7 h-7 rounded-md hover:bg-[#fafafa] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {error ? (
            <div className="text-sm text-[#be123c]">{error}</div>
          ) : !vs ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton rounded-md" style={{ height: 48 }} />)}
            </div>
          ) : (
            <>
              {/* Participating roles — compact chips up top so the long process
                  tree below doesn't bury them. */}
              <div className="mb-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-2">
                  Participating roles ({roles.length})
                </div>
                {roles.length === 0 ? (
                  <div className="text-sm text-[#a3a3a3] italic">None.</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {roles.map((r, i) => (
                      <Link key={`${r.roleId}-${i}`} to={`/roles?role=${r.roleId}`} className="inline-flex items-center gap-1.5 rounded-md border border-[#eaeaea] bg-[#fafafa] px-2 py-1 hover:border-[#d4d4d4] transition-colors duration-150">
                        <span className="text-xs text-[#171717]">{r.roleName}</span>
                        <span className={`${PART_CLASS[r.participationType] ?? 'chip-soft'} flex-shrink-0`}>{r.participationType}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Process L4 & L5 tree */}
              <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-2.5">
                Process Level 4 &amp; Process Level 5
              </div>
              {processAreas.length === 0 ? (
                <div className="text-sm text-[#a3a3a3] italic">No process areas.</div>
              ) : (
                <div className="space-y-5">
                  {processAreas.map((area, ai) => (
                    <div key={area.id}>
                      <div className="flex items-center gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-md bg-[#171717] text-white text-[11px] font-semibold grid place-items-center tnum">{ai + 1}</span>
                        <span className="text-[13px] font-semibold text-[#171717]">{area.name}</span>
                      </div>
                      <ul className="mt-2 ml-2 border-l-2 border-[#e5e5e5] pl-4 space-y-3">
                        {area.subProcesses.map((sub) => (
                          <li key={sub.id}>
                            <div className="text-sm font-medium text-[#171717]">{sub.description || sub.name}</div>
                            {((sub.inputs?.length ?? 0) > 0 || (sub.outputs?.length ?? 0) > 0) && (
                              <div className="text-xs text-[#525252] mt-1.5 space-y-1">
                                {(sub.inputs?.length ?? 0) > 0 && (
                                  <div className="flex gap-1.5">
                                    <span className="flex-shrink-0 rounded bg-[#171717] text-white text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 leading-[14px]">Inputs</span>
                                    <span>{sub.inputs!.join(', ')}</span>
                                  </div>
                                )}
                                {(sub.outputs?.length ?? 0) > 0 && (
                                  <div className="flex gap-1.5">
                                    <span className="flex-shrink-0 rounded bg-[#404040] text-white text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 leading-[14px]">Outputs</span>
                                    <span>{sub.outputs!.join(', ')}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            {(sub.steps?.length ?? 0) > 0 && (
                              <ol className="mt-2 ml-1 space-y-1 list-none">
                                {sub.steps!.map((s, si) => (
                                  <li key={si} className="text-xs text-[#525252] flex items-center gap-2">
                                    <span className="flex-shrink-0 w-4 h-4 rounded-full border border-[#d4d4d4] text-[#737373] text-[9px] font-semibold grid place-items-center tnum">{si + 1}</span>
                                    <span>
                                      <span className="text-[#171717]">{s.name}</span>
                                      {s.leads && <span className="text-[#a3a3a3]"> · {s.leads}</span>}
                                    </span>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
