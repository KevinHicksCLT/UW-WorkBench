import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';

const PART_CLASS: Record<string, string> = { Lead: 'part-lead', Core: 'part-core', Control: 'part-control', Oversight: 'part-oversight', Support: 'part-support' };

type Participation = { valueStreamId: string; valueStreamName: string; domain: string | null; participationType: string; l3: string | null; l4: string | null };
type Role = {
  id: string; name: string; roleLevel: string | null; roleFamily: string | null; description: string | null;
  valueStreamCount: number; checklistCount: number; taskCount: number; participations: Participation[];
};
type Data = {
  id: string; name: string; company: { id: string; name: string }; division: { id: string; name: string; higherCategory: string | null };
  totals: { roles: number }; roles: Role[];
};

export default function DepartmentDetail() {
  const { id } = useParams();
  const { data: d, error, loading } = useApi<Data>(`/departments/${id}`);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (rid: string) => setOpen((p) => { const n = new Set(p); n.has(rid) ? n.delete(rid) : n.add(rid); return n; });

  if (loading) return <div className="text-slate-500">Loading department…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!d) return null;

  return (
    <div>
      <PageHeader
        title={d.name}
        subtitle={`${d.totals.roles} roles`}
      />

      <div className="card p-0 overflow-hidden">
        {d.roles.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500 italic">No roles.</div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] border-b border-[#eaeaea]">
                  <th className="text-left font-semibold px-4 py-2.5 w-8"></th>
                  <th className="text-left font-semibold px-2 py-2.5">Role</th>
                  <th className="text-left font-semibold px-2 py-2.5">Level</th>
                  <th className="text-left font-semibold px-2 py-2.5">Family</th>
                  <th className="text-left font-semibold px-2 py-2.5 w-[36%]">Value streams</th>
                  <th className="text-right font-semibold px-2 py-2.5">Resp.</th>
                  <th className="text-right font-semibold px-4 py-2.5">Checks</th>
                </tr>
              </thead>
              <tbody>
                {d.roles.map((r) => {
                  const isOpen = open.has(r.id);
                  return (
                    <RoleRows key={r.id} role={r} isOpen={isOpen} onToggle={() => toggle(r.id)} />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleRows({ role: r, isOpen, onToggle }: { role: Role; isOpen: boolean; onToggle: () => void }) {
  // distinct value streams for the inline cell
  const streams = Array.from(new Map(r.participations.map((p) => [p.valueStreamId, p])).values());
  return (
    <>
      <tr className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-colors duration-150 cursor-pointer align-top" onClick={onToggle}>
        <td className="px-4 py-2.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={'text-[#a3a3a3] transition-transform duration-150 ' + (isOpen ? 'rotate-90' : '')} aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </td>
        <td className="px-2 py-2.5">
          <Link to={`/roles/${r.id}`} className="text-[#171717] font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{r.name}</Link>
        </td>
        <td className="px-2 py-2.5 text-[#525252]">{r.roleLevel && r.roleLevel !== 'Individual Contributor' ? r.roleLevel : '—'}</td>
        <td className="px-2 py-2.5 text-[#525252]">{r.roleFamily ?? '—'}</td>
        <td className="px-2 py-2.5">
          {streams.length === 0 ? (
            <span className="text-xs text-[#a3a3a3] italic">None</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {streams.slice(0, 4).map((p) => (
                <span key={p.valueStreamId} className={PART_CLASS[p.participationType] ?? 'chip-soft'} title={`${p.participationType} · ${p.domain ?? ''}`}>{p.valueStreamName}</span>
              ))}
              {streams.length > 4 && <span className="text-[11px] text-[#a3a3a3] self-center">+{streams.length - 4}</span>}
            </div>
          )}
        </td>
        <td className="px-2 py-2.5 text-right tnum text-[#525252]">{r.taskCount}</td>
        <td className="px-4 py-2.5 text-right tnum text-[#525252]">{r.checklistCount}</td>
      </tr>
      {isOpen && (
        <tr className="bg-[#fafafa] border-b border-[#f5f5f5]">
          <td />
          <td colSpan={6} className="px-2 py-3 pr-4">
            {r.description && <p className="text-sm text-[#525252] mb-3 max-w-3xl">{r.description}</p>}
            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-2">
              Value-stream participation · L1 Domain → L2 Stream → L3 Process Area → L4 Sub-Process
            </div>
            {r.participations.length === 0 ? (
              <div className="text-sm text-slate-500 italic">Not mapped to any value stream.</div>
            ) : (
              <div className="space-y-1.5 max-w-3xl">
                {r.participations.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className={`${PART_CLASS[p.participationType] ?? 'chip-soft'} flex-shrink-0 mt-0.5`}>{p.participationType}</span>
                    <div className="min-w-0">
                      <Link to={`/overview?focus=${p.valueStreamId}`} className="text-[#171717] hover:underline">{p.valueStreamName}</Link>
                      {p.domain && <span className="text-xs text-[#a3a3a3]"> · {p.domain}</span>}
                      {(p.l3 || p.l4) && (
                        <div className="text-xs text-[#666666] mt-0.5">
                          {p.l3 && <span><span className="text-[#a3a3a3]">L3</span> {p.l3}</span>}
                          {p.l4 && <span> · <span className="text-[#a3a3a3]">L4</span> {p.l4}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link to={`/roles/${r.id}`} className="inline-block mt-3 text-xs text-[#0070f3] hover:underline">View full role profile →</Link>
          </td>
        </tr>
      )}
    </>
  );
}
