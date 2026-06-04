import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';

// Standards area detail — drill target from the Standards tab. Shows the area's
// charter (mission/scope) and every individual standard grouped by category.
// Each standard expands to its meaning, the value streams it applies to, and the
// role accountable for meeting it.

type ValueStream = { id: string; name: string; domain: string | null };
type Responsible = { roleId: string; roleName: string; roleLevel: string | null; peopleCount: number };
type Item = {
  id: string;
  category: string;
  name: string;
  description: string;
  buildRun: string | null;
  ownerRole: string | null;
  relatedRole: string | null;
  relatedCategory: string | null;
  itemsLink: string | null;
  responsible: Responsible | null;
  valueStreams: ValueStream[];
};
type Data = {
  area: { id: string; department: string; count: number; charterIncluded: boolean; owner: string | null; link: string | null; mission: string | null; scope: string | null };
  totals: { items: number; categories: number; withOwnerRole: number };
  items: Item[];
};

export default function StandardArea() {
  const { id } = useParams();
  const { data, error, loading } = useApi<Data>(id ? `/explorer/standards/${id}` : null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setOpen((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // Filter + group standards by category (the in-area grouping).
  const groups = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    const items = needle
      ? data.items.filter((i) =>
          i.name.toLowerCase().includes(needle) ||
          i.description.toLowerCase().includes(needle) ||
          i.category.toLowerCase().includes(needle) ||
          (i.ownerRole ?? '').toLowerCase().includes(needle))
      : data.items;
    const byCat = new Map<string, Item[]>();
    for (const it of items) { if (!byCat.has(it.category)) byCat.set(it.category, []); byCat.get(it.category)!.push(it); }
    return [...byCat.entries()].map(([category, rows]) => ({ category, rows }));
  }, [data, q]);

  if (loading) return <div className="text-slate-500">Loading standards…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return null;

  const a = data.area;
  const scopeBullets = a.scope ? a.scope.split('\n').filter(Boolean) : [];

  return (
    <div>
      <PageHeader
        title={a.department}
        subtitle={`${data.totals.items} standards across ${data.totals.categories} categories · ${data.totals.withOwnerRole} mapped to a role`}
        eyebrow="Standards area"
        breadcrumbs={[{ label: 'Overview', to: '/' }, { label: 'Standards', to: '/standards' }, { label: a.department }]}
      />

      {/* Charter — mission + scope from the department standards sheet */}
      {(a.mission || scopeBullets.length > 0 || a.owner) && (
        <div className="card mb-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {a.mission && (
              <>
                <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">Mission</div>
                <p className="text-sm text-[#171717] mb-3">{a.mission}</p>
              </>
            )}
            {scopeBullets.length > 0 && (
              <>
                <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">Scope</div>
                <ul className="text-sm text-[#525252] space-y-0.5 list-disc pl-4">
                  {scopeBullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </>
            )}
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">Accountable owner</div>
            <p className="text-sm text-[#171717] mb-3">{a.owner ?? '—'}</p>
            <div className="flex items-center gap-2 text-xs text-[#666666]">
              <span className="tnum">{a.count} standards</span>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <input className="input sm:max-w-xs" placeholder="Search standards…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {groups.length === 0 ? (
        <div className="card text-sm text-slate-500 italic">No standards match.</div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.category}>
              <h3 className="text-sm font-semibold text-[#171717] mb-2 flex items-center gap-2">
                {g.category}
                <span className="text-xs font-normal text-[#a3a3a3] tnum">{g.rows.length}</span>
              </h3>
              <div className="card overflow-hidden p-0">
                {g.rows.map((it) => {
                  const isOpen = open.has(it.id);
                  return (
                    <div key={it.id} className="border-b border-[#f5f5f5] last:border-0">
                      <div className="flex items-start gap-2 px-4 py-2.5 hover:bg-[#fafafa] transition-colors duration-150 cursor-pointer" onClick={() => toggle(it.id)}>
                        <Chevron open={isOpen} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-[#171717]">{it.name}</div>
                          {!isOpen && <div className="text-xs text-[#a3a3a3] truncate">{it.description}</div>}
                        </div>
                        {it.buildRun && <span className="chip-soft flex-shrink-0">{it.buildRun}</span>}
                        <div className="hidden sm:block w-44 flex-shrink-0 text-right text-xs text-[#525252] truncate">
                          {it.responsible ? it.responsible.roleName : it.ownerRole ?? '—'}
                        </div>
                      </div>

                      {isOpen && (
                        <div className="bg-[#fafafa] border-t border-[#f5f5f5] px-4 py-3 pl-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* What it means */}
                          <div className="lg:col-span-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">What it means</div>
                            <p className="text-sm text-[#171717]">{it.description}</p>
                            {it.valueStreams.length > 0 && (
                              <div className="mt-3">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">Applies to value streams</div>
                                <div className="flex flex-wrap gap-1">
                                  {it.valueStreams.map((vs) => (
                                    <Link key={vs.id} to={`/overview?focus=${vs.id}`} className="chip-soft hover:bg-[#eaeaea]" onClick={(e) => e.stopPropagation()} title={vs.domain ?? ''}>
                                      {vs.name}
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Responsible role */}
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">Responsible role</div>
                            {it.responsible ? (
                              <div className="text-sm">
                                <Link to={`/roles/${it.responsible.roleId}`} className="text-[#171717] hover:underline" onClick={(e) => e.stopPropagation()}>
                                  {it.responsible.roleName}
                                </Link>
                                {it.ownerRole && it.ownerRole !== it.responsible.roleName && (
                                  <span className="text-xs text-[#a3a3a3]"> ({it.ownerRole})</span>
                                )}
                                <div className="text-xs text-[#a3a3a3] mt-0.5 flex items-center gap-1.5">
                                  {it.responsible.roleLevel && it.responsible.roleLevel !== 'Individual Contributor' && <span className="chip-soft">{it.responsible.roleLevel}</span>}
                                  <span className="tnum">{it.responsible.peopleCount} {it.responsible.peopleCount === 1 ? 'person' : 'people'}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-[#525252]">
                                {it.ownerRole ?? <span className="text-[#a3a3a3] italic">Unassigned</span>}
                                {it.ownerRole && <div className="text-[11px] text-[#a3a3a3] italic mt-0.5">not matched to a roster role</div>}
                              </div>
                            )}
                            {it.relatedRole && it.relatedRole !== it.ownerRole && (
                              <div className="mt-2 text-xs text-[#a3a3a3]">Accountable (governance): {it.relatedRole}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={'flex-shrink-0 mt-1 text-[#a3a3a3] transition-transform duration-150 ' + (open ? 'rotate-90' : '')} aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
