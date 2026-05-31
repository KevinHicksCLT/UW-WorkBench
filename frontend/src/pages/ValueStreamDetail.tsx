import { useParams, Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';
import { PARTICIPATION_CLASS } from '../lib/format';

export default function ValueStreamDetail() {
  const { id } = useParams();
  const { data: vs, error, loading } = useApi<any>(`/value-streams/${id}`);

  if (loading) return <div className="text-slate-500">Loading value stream…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!vs) return null;

  const subs: any[] = vs.subStreams ?? [];
  const l3 = subs.filter((s) => s.level === 3);
  const orphanL4 = subs.filter((s) => s.level === 4 && !s.parentId);
  const childrenOf = (pid: string) => subs.filter((s) => s.parentId === pid);

  return (
    <div>
      <PageHeader
        title={vs.name}
        subtitle={vs.domain || undefined}
        breadcrumbs={[{ label: 'Value Streams', to: '/value-streams' }, { label: vs.name }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <h3 className="font-semibold text-slate-900 mb-3">Process Areas & Sub-Processes</h3>
          {l3.length === 0 && orphanL4.length === 0 ? (
            <div className="text-sm text-slate-500 italic">No sub-streams.</div>
          ) : (
            <div className="space-y-3">
              {l3.map((p) => (
                <div key={p.id}>
                  <div className="font-medium text-slate-800">{p.name}</div>
                  <ul className="mt-1 ml-2 border-l-2 border-slate-100 pl-3 space-y-1.5">
                    {childrenOf(p.id).map((c) => (
                      <li key={c.id}>
                        <div className="text-sm text-slate-700">{c.name}</div>
                        {(c.inputs || c.outputs) && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            {c.inputs && <span><span className="font-semibold">In:</span> {c.inputs} </span>}
                            {c.outputs && <span><span className="font-semibold">Out:</span> {c.outputs}</span>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {orphanL4.map((c) => (
                <div key={c.id} className="text-sm text-slate-700">{c.name}</div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-3">Participating Roles ({vs.roles.length})</h3>
          {vs.roles.length === 0 ? (
            <div className="text-sm text-slate-500 italic">None.</div>
          ) : (
            <div className="space-y-1.5">
              {vs.roles.map((r: any, i: number) => (
                <div key={`${r.roleId}-${i}`} className="flex items-center justify-between gap-2 py-1 border-b border-slate-100 last:border-0">
                  <Link to={`/roles/${r.roleId}`} className="text-sm text-brand-700 hover:underline truncate">{r.roleName}</Link>
                  <span className={`${PARTICIPATION_CLASS[r.participationType] || 'pill-slate'} flex-shrink-0`}>{r.participationType}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
