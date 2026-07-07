import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { DrawerShell, EmptyState, ErrorMessage, SkeletonLoader } from './ui';

// ValueStreamDrawer — the value stream's full detail (Process L4 & L5 tree +
// participating roles), rendered as a wide slide-over on the map/list view.
// Replaces the retired /value-streams/:id page so the detail is reachable in
// place from the "View full details" button in the right-hand sidebar.

type Detail = {
  name: string;
  domain: string | null;
  processAreas: {
    id: string;
    name: string;
    subProcesses: {
      id: string;
      name: string;
      description: string | null;
      inputs?: string[];
      outputs?: string[];
      steps?: { name: string; leads: string | null }[];
    }[];
  }[];
  roles: { roleId: string; roleName: string; participationType: string }[];
};

export default function ValueStreamDrawer({
  valueStreamId,
  onClose,
}: {
  valueStreamId: string;
  onClose: () => void;
}) {
  const [vs, setVs] = useState<Detail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setVs(null);
    setError('');
    api
      .get<Detail>(`/value-streams/${valueStreamId}`)
      .then(setVs)
      .catch((e: Error) => setError(e.message));
  }, [valueStreamId]);

  const processAreas = vs?.processAreas ?? [];
  const roles = vs?.roles ?? [];

  return (
    <DrawerShell
      onClose={onClose}
      width={640}
      maxWidth="92vw"
      header={
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">
            Value stream
          </div>
          <div className="text-[15px] font-bold text-[#171717] leading-snug">
            {vs?.name ?? 'Loading…'}
          </div>
          {vs?.domain && <div className="text-[11px] text-[#a3a3a3] mt-0.5">{vs.domain}</div>}
        </div>
      }
    >
      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : !vs ? (
        <SkeletonLoader count={5} height={48} className="space-y-2" />
      ) : (
        <>
          {/* Participating roles — compact chips up top so the long process
                  tree below doesn't bury them. */}
          <div className="mb-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-2">
              Participating roles ({roles.length})
            </div>
            {roles.length === 0 ? (
              <EmptyState baseClassName="text-sm text-[#a3a3a3] italic" message="None." />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {/* Plain role chips — the retired Lead/Core/Support tag is gone. */}
                {roles.map((r, i) => (
                  <Link
                    key={`${r.roleId}-${i}`}
                    to={`/organization?role=${r.roleId}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#eaeaea] bg-[#fafafa] px-2 py-1 hover:border-[#d4d4d4] transition-colors duration-150"
                  >
                    <span className="text-xs text-[#171717]">{r.roleName}</span>
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
            <EmptyState baseClassName="text-sm text-[#a3a3a3] italic" message="No process areas." />
          ) : (
            <div className="space-y-5">
              {processAreas.map((area, ai) => (
                <div key={area.id}>
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-md bg-[#171717] text-white text-[11px] font-semibold grid place-items-center tnum">
                      {ai + 1}
                    </span>
                    <span className="text-[13px] font-semibold text-[#171717]">{area.name}</span>
                  </div>
                  <ul className="mt-2 ml-2 border-l-2 border-[#e5e5e5] pl-4 space-y-3">
                    {area.subProcesses.map((sub) => (
                      <li key={sub.id}>
                        <div className="text-sm font-medium text-[#171717]">
                          {sub.description || sub.name}
                        </div>
                        {((sub.inputs?.length ?? 0) > 0 || (sub.outputs?.length ?? 0) > 0) && (
                          <div className="text-xs text-[#525252] mt-1.5 space-y-1">
                            {(sub.inputs?.length ?? 0) > 0 && (
                              <div className="flex gap-1.5">
                                <span className="flex-shrink-0 rounded bg-[#171717] text-white text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 leading-[14px]">
                                  Inputs
                                </span>
                                <span>{sub.inputs!.join(', ')}</span>
                              </div>
                            )}
                            {(sub.outputs?.length ?? 0) > 0 && (
                              <div className="flex gap-1.5">
                                <span className="flex-shrink-0 rounded bg-[#404040] text-white text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 leading-[14px]">
                                  Outputs
                                </span>
                                <span>{sub.outputs!.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {(sub.steps?.length ?? 0) > 0 && (
                          <ol className="mt-2 ml-1 space-y-1 list-none">
                            {sub.steps!.map((s, si) => (
                              <li
                                key={si}
                                className="text-xs text-[#525252] flex items-center gap-2"
                              >
                                <span className="flex-shrink-0 w-4 h-4 rounded-full border border-[#d4d4d4] text-[#737373] text-[9px] font-semibold grid place-items-center tnum">
                                  {si + 1}
                                </span>
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
    </DrawerShell>
  );
}
