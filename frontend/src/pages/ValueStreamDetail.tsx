import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';
import ValueStreamFlow from '../viz/ValueStreamFlow';

const PART_CLASS: Record<string, string> = { Lead: 'part-lead', Core: 'part-core', Control: 'part-control', Oversight: 'part-oversight', Support: 'part-support' };

export default function ValueStreamDetail() {
  const { id } = useParams();
  const { data: vs, error, loading } = useApi<any>(`/value-streams/${id}`);
  const [view, setView] = useState<'detail' | 'flow'>('detail');

  if (loading) return <div className="text-sm text-[#a3a3a3]">Loading value stream…</div>;
  if (error) return <div className="text-sm text-[#be123c]">{error}</div>;
  if (!vs) return null;

  const subs: any[] = vs.subStreams ?? [];
  const processAreas: any[] = vs.processAreas ?? [];

  return (
    <div>
      <PageHeader
        title={vs.name}
        subtitle={vs.domain || undefined}
        breadcrumbs={[{ label: 'Value Streams', to: '/overview' }, { label: vs.name }]}
      />

      <div className="border-b border-[#eaeaea] mb-5 flex gap-1">
        {(['detail', 'flow'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setView(t)}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 ' +
              (view === t ? 'text-[#171717] border-[#171717]' : 'text-[#a3a3a3] border-transparent hover:text-[#525252]')
            }
          >
            {t === 'detail' ? 'Detail' : 'Flow Map'}
          </button>
        ))}
      </div>

      {view === 'flow' ? (
        <ValueStreamFlow name={vs.name} subStreams={subs} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <div className="flex items-center gap-2 mb-4 pb-2.5 border-b border-[#eaeaea]">
              <span className="w-1 h-3.5 rounded-full bg-[#171717]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-[#525252]">Process Areas &amp; Sub-Processes</span>
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
                      {area.subProcesses.map((sub: any) => (
                        <li key={sub.id}>
                          <div className="text-sm font-medium text-[#171717]">{sub.description || sub.name}</div>
                          {(sub.inputs?.length > 0 || sub.outputs?.length > 0) && (
                            <div className="text-xs text-[#525252] mt-1.5 space-y-1">
                              {sub.inputs?.length > 0 && (
                                <div className="flex gap-1.5">
                                  <span className="flex-shrink-0 rounded bg-[#171717] text-white text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 leading-[14px]">Inputs</span>
                                  <span>{sub.inputs.join(', ')}</span>
                                </div>
                              )}
                              {sub.outputs?.length > 0 && (
                                <div className="flex gap-1.5">
                                  <span className="flex-shrink-0 rounded bg-[#404040] text-white text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 leading-[14px]">Outputs</span>
                                  <span>{sub.outputs.join(', ')}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {sub.steps?.length > 0 && (
                            <ol className="mt-2 ml-1 space-y-1 list-none">
                              {sub.steps.map((s: any, si: number) => (
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
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-[#eaeaea]">
              <span className="w-1 h-3.5 rounded-full bg-[#171717]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-[#525252]">Participating Roles</span>
              <span className="ml-auto rounded-md bg-[#171717] text-white text-[10px] font-semibold tnum px-1.5 py-0.5">{vs.roles.length}</span>
            </div>
            {vs.roles.length === 0 ? (
              <div className="text-sm text-[#a3a3a3] italic">None.</div>
            ) : (
              <div className="space-y-0.5">
                {vs.roles.map((r: any, i: number) => (
                  <div key={`${r.roleId}-${i}`} className="flex items-center justify-between gap-2 py-1.5 border-b border-[#f5f5f5] last:border-0">
                    <Link to={`/roles/${r.roleId}`} className="text-sm text-[#171717] hover:underline truncate">{r.roleName}</Link>
                    <span className={`${PART_CLASS[r.participationType] ?? 'chip-soft'} flex-shrink-0`}>{r.participationType}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
