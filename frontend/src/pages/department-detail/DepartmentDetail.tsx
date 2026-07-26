import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { useOpenRole } from '../../lib/roleDrawer';
import { useViewState } from '../../lib/viewState';
import PageHeader from '../../components/PageHeader';
import { Card, EmptyState, ErrorMessage, LoadingState } from '../../components/ui';

type Participation = {
  valueStreamId: string;
  valueStreamName: string;
  domain: string | null;
  participationType: string;
  l3: string | null;
  l4: string | null;
};
type Role = {
  id: string;
  name: string;
  roleLevel: string | null;
  roleFamily: string | null;
  description: string | null;
  valueStreamCount: number;
  checklistCount: number;
  taskCount: number;
  participations: Participation[];
};
type Data = {
  id: string;
  name: string;
  company: { id: string; name: string };
  division: { id: string; name: string; higherCategory: string | null };
  totals: { roles: number };
  roles: Role[];
};

export default function DepartmentDetail() {
  const { id } = useParams();
  const { data: d, error, loading } = useApi<Data>(`/departments/${id}`);
  // Expanded roles persist per department (lib/viewState) so drilling out
  // and coming back restores the exact view.
  const [openArr, setOpenArr] = useViewState<string[]>(`dept.${id}.open`, []);
  const open = useMemo(() => new Set(openArr), [openArr]);
  const toggle = (rid: string) =>
    setOpenArr((p) => (p.includes(rid) ? p.filter((x) => x !== rid) : [...p, rid]));

  if (loading) return <LoadingState baseClassName="text-slate-500" message="Loading department…" />;
  if (error) return <ErrorMessage baseClassName="text-red-600">{error}</ErrorMessage>;
  if (!d) return null;

  return (
    <div>
      <PageHeader title={d.name} subtitle={`${d.totals.roles} roles`} />

      <Card className="p-0 overflow-hidden">
        {d.roles.length === 0 ? (
          <EmptyState baseClassName="px-4 py-8 text-sm text-slate-500 italic" message="No roles." />
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] border-b border-[#eaeaea]">
                  <th className="text-center font-semibold px-4 py-2.5 w-8"></th>
                  <th className="text-left font-semibold px-2 py-2.5">Role</th>
                  <th className="text-left font-semibold px-2 py-2.5">Level</th>
                  <th className="text-left font-semibold px-2 py-2.5">Family</th>
                  <th className="text-left font-semibold px-2 py-2.5 w-[36%]">Value streams</th>
                  <th className="text-center font-semibold px-2 py-2.5">Resp.</th>
                  <th className="text-center font-semibold px-4 py-2.5">Checks</th>
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
      </Card>
    </div>
  );
}

function RoleRows({
  role: r,
  isOpen,
  onToggle,
}: {
  role: Role;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const openRole = useOpenRole();
  // distinct value streams for the inline cell
  const streams = Array.from(new Map(r.participations.map((p) => [p.valueStreamId, p])).values());
  return (
    <>
      <tr
        className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-colors duration-150 cursor-pointer align-top"
        onClick={onToggle}
      >
        <td className="px-4 py-2.5 text-center">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={
              'mx-auto text-[#a3a3a3] transition-transform duration-150 ' +
              (isOpen ? 'rotate-90' : '')
            }
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </td>
        <td className="px-2 py-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openRole(r.id);
            }}
            className="text-[#171717] font-medium hover:underline"
          >
            {r.name}
          </button>
        </td>
        <td className="px-2 py-2.5 text-[#525252]">
          {r.roleLevel && r.roleLevel !== 'Individual Contributor' ? r.roleLevel : '—'}
        </td>
        <td className="px-2 py-2.5 text-[#525252]">{r.roleFamily ?? '—'}</td>
        <td className="px-2 py-2.5">
          {streams.length === 0 ? (
            <span className="text-xs text-[#a3a3a3] italic">None</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {streams.slice(0, 4).map((p) => (
                <span key={p.valueStreamId} className="chip-soft" title={p.domain ?? undefined}>
                  {p.valueStreamName}
                </span>
              ))}
              {streams.length > 4 && (
                <span className="text-[11px] text-[#a3a3a3] self-center">
                  +{streams.length - 4}
                </span>
              )}
            </div>
          )}
        </td>
        <td className="px-2 py-2.5 text-center tnum text-[#525252]">{r.taskCount}</td>
        <td className="px-4 py-2.5 text-center tnum text-[#525252]">{r.checklistCount}</td>
      </tr>
      {isOpen && (
        <tr className="bg-[#fafafa] border-b border-[#f5f5f5]">
          <td />
          <td colSpan={6} className="px-2 py-3 pr-4">
            {r.description && (
              <p className="text-sm text-[#525252] mb-3 max-w-3xl">{r.description}</p>
            )}
            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-2">
              Value-stream participation · L1 Domain → L2 Stream → L3 Process Area → L4 Sub-Process
            </div>
            {r.participations.length === 0 ? (
              <EmptyState
                baseClassName="text-sm text-slate-500 italic"
                message="Not mapped to any value stream."
              />
            ) : (
              <div className="space-y-1.5 max-w-3xl">
                {/* Plain rows — the retired Lead/Core/Support tag is gone. */}
                {r.participations.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <div className="min-w-0">
                      <Link
                        to={`/overview?focus=${p.valueStreamId}`}
                        className="text-[#171717] hover:underline"
                      >
                        {p.valueStreamName}
                      </Link>
                      {p.domain && <span className="text-xs text-[#a3a3a3]"> · {p.domain}</span>}
                      {(p.l3 || p.l4) && (
                        <div className="text-xs text-[#666666] mt-0.5">
                          {p.l3 && (
                            <span>
                              <span className="text-[#a3a3a3]">L3</span> {p.l3}
                            </span>
                          )}
                          {p.l4 && (
                            <span>
                              {' '}
                              · <span className="text-[#a3a3a3]">L4</span> {p.l4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link
              to={`/roles/${r.id}`}
              className="inline-block mt-3 text-xs text-[#0070f3] hover:underline"
            >
              View full role profile →
            </Link>
          </td>
        </tr>
      )}
    </>
  );
}
