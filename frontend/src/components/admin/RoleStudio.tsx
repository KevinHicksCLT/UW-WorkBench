import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { AdminEntity } from '../../lib/adminTypes';
import EntityList from './EntityList';
import EntityForm from '../EntityForm';

// ─── Role Studio ─────────────────────────────────────────────────────────────
// The editable mirror of the Role detail screen. It surfaces EVERYTHING that
// screen shows for a role and makes each piece editable in place:
//   • Profile (name, level, family, reporting…)                  → Role row
//   • Responsibilities (checklist items + role tasks)            → FK by roleId
//   • Value-stream participation                                 → FK by roleId
//   • Deliverables & inputs (from the I/O inventory)             → IoItem (text-matched)
//   • Process tasks (the L5 steps the role leads/supports)       → ProcessStep (text-matched)
//   • People in the role                                         → Assignment (FK)
// The I/O and process rows aren't FK-linked to the role (the screen resolves them
// by matching the role name against free-text columns), so we fetch the resolved
// set from /admin/role-context/:id and edit those exact rows through the normal
// audited /admin endpoints. Adding one prefills the role name into the matching
// column so it immediately resolves back to this role.

type Role = { id: string; name: string; itemRole?: string | null; [k: string]: any };
type Context = { role: { id: string; name: string; itemRole: string | null }; ioItems: any[]; processSteps: any[] };

function withCompany(path: string, companyId: string | null) {
  if (!companyId) return path;
  return path + (path.includes('?') ? '&' : '?') + `companyId=${companyId}`;
}

export default function RoleStudio({ companyId, bySlug }: { companyId: string | null; bySlug: Map<string, AdminEntity> }) {
  const roleEntity = bySlug.get('role');
  const [selected, setSelected] = useState<Role | null>(null);
  const [editingRole, setEditingRole] = useState(false);
  const [listRefresh, setListRefresh] = useState(0);

  if (!roleEntity) return <div className="card-elevated p-8 text-center text-sm text-[#a3a3a3]">Roles aren’t available in this build.</div>;

  return (
    <div>
      <p className="text-sm text-[#666666] mb-4 max-w-2xl">
        Pick a role to edit everything the Role screen shows for it — profile, responsibilities, value-stream
        participation, the deliverables & inputs it owns, the process steps it leads, and the people in it.
      </p>
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div className="lg:w-[38%] flex-shrink-0 lg:sticky lg:top-2">
          <EntityList
            key={listRefresh}
            entity={roleEntity}
            companyId={companyId}
            title="Roles"
            selectable
            selectedId={selected?.id ?? null}
            onSelect={(row) => setSelected(row as Role)}
            onChanged={() => setListRefresh((n) => n + 1)}
            dense
            bodyMaxHeight="62vh"
          />
        </div>

        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="card-elevated p-10 text-center text-sm text-[#a3a3a3]">Select a role to edit its full profile.</div>
          ) : (
            <div className="space-y-6">
              <div className="card p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">Role</div>
                  <div className="text-base font-semibold text-[#171717] truncate">{selected.name}</div>
                  {selected.roleLevel && <div className="text-sm text-[#666666] mt-0.5">{selected.roleLevel}{selected.roleFamily ? ` · ${selected.roleFamily}` : ''}</div>}
                </div>
                <button className="btn-secondary flex-shrink-0" onClick={() => setEditingRole(true)}>Edit profile</button>
              </div>

              {/* Responsibilities */}
              <Section title="Responsibilities" hint="What the role is accountable for — shown grouped on the Role screen.">
                {bySlug.get('checklistItem') && <EntityList entity={bySlug.get('checklistItem')!} companyId={companyId} title="Checklist items" fixed={{ roleId: selected.id }} filter={(r) => r.roleId === selected.id} emptyHint="No checklist items yet — add one." dense />}
                {bySlug.get('roleTask') && <div className="mt-5"><EntityList entity={bySlug.get('roleTask')!} companyId={companyId} title="Role tasks" fixed={{ roleId: selected.id }} filter={(r) => r.roleId === selected.id} emptyHint="No role tasks yet — add one." dense /></div>}
              </Section>

              {/* Participation */}
              {bySlug.get('roleValueStream') && (
                <Section title="Value-stream participation" hint="Which value streams the role works in, and how (Lead / Core / Support …).">
                  <EntityList entity={bySlug.get('roleValueStream')!} companyId={companyId} title="Participation" fixed={{ roleId: selected.id }} filter={(r) => r.roleId === selected.id} emptyHint="No participation links yet — add one." dense />
                </Section>
              )}

              {/* Deliverables & inputs (text-matched IoItem) */}
              <RoleContextSection
                role={selected}
                companyId={companyId}
                entity={bySlug.get('ioItem')}
                kind="io"
              />

              {/* Process tasks (text-matched ProcessStep) */}
              <RoleContextSection
                role={selected}
                companyId={companyId}
                entity={bySlug.get('processStep')}
                kind="steps"
              />

              {/* People */}
              {bySlug.get('assignment') && (
                <Section title="People in this role" hint="Assignments of people to the role.">
                  <EntityList entity={bySlug.get('assignment')!} companyId={companyId} title="Assignments" fixed={{ roleId: selected.id }} filter={(r) => r.roleId === selected.id} emptyHint="No people assigned yet." dense />
                </Section>
              )}
            </div>
          )}
        </div>
      </div>

      {editingRole && selected && (
        <EntityForm entity={roleEntity} companyId={companyId} record={selected} onClose={() => setEditingRole(false)} onSaved={() => { setEditingRole(false); setListRefresh((n) => n + 1); }} />
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-[#171717]">{title}</h3>
        {hint && <p className="text-xs text-[#a3a3a3]">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

// Editable view of the IoItems (deliverables/inputs) or ProcessSteps that resolve
// to the role by free-text matching. Fetched from /admin/role-context/:id; edited
// through the normal /admin/{ioItem|processStep} endpoints.
function RoleContextSection({ role, companyId, entity, kind }: { role: Role; companyId: string | null; entity?: AdminEntity; kind: 'io' | 'steps' }) {
  const [ctx, setCtx] = useState<Context | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Record<string, any> | null | { create: Record<string, any> }>(null);

  const load = () => {
    setLoading(true); setError('');
    api.get(withCompany(`/admin/role-context/${role.id}`, companyId))
      .then(setCtx)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [role.id, companyId]);

  if (!entity) return null;

  const roleAlias = role.itemRole || role.name;
  const rows = kind === 'io' ? (ctx?.ioItems ?? []) : (ctx?.processSteps ?? []);
  const title = kind === 'io' ? 'Deliverables & inputs' : 'Process tasks';
  const hint = kind === 'io'
    ? 'The I/O inventory rows that name this role in "Key roles" — its deliverables (outputs) and inputs.'
    : 'The L5 process steps this role leads or supports.';
  const addDefaults = kind === 'io'
    ? { keyRoles: roleAlias, type: 'Deliverable' }
    : { leads: roleAlias };

  const remove = async (row: Record<string, any>) => {
    if (!confirm(`Delete "${row.name}"?\n\nThis removes the row from the catalog (it will disappear from every role that referenced it).`)) return;
    try { await api.delete(withCompany(`/admin/${entity.slug}/${row.id}`, companyId)); load(); }
    catch (e) { alert((e as Error).message); }
  };

  return (
    <Section title={title} hint={hint}>
      {error && <div className="text-sm text-[#be123c] mb-2">{error}</div>}
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#eaeaea] text-left text-[#666666]">
              {kind === 'io' ? (
                <>
                  <th className="px-3 py-1.5 font-medium">Type</th>
                  <th className="px-3 py-1.5 font-medium">Name</th>
                  <th className="px-3 py-1.5 font-medium">Value stream</th>
                  <th className="px-3 py-1.5 font-medium">Sub-process</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-1.5 font-medium">Step</th>
                  <th className="px-3 py-1.5 font-medium">Name</th>
                  <th className="px-3 py-1.5 font-medium">Value stream</th>
                  <th className="px-3 py-1.5 font-medium">Role</th>
                </>
              )}
              <th className="px-3 py-1.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-[#a3a3a3]">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-[#a3a3a3] italic">None resolve to this role yet — add one below.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa]">
                  {kind === 'io' ? (
                    <>
                      <td className="px-3 py-1.5">{r.type}</td>
                      <td className="px-3 py-1.5 text-[#171717]">{r.name}</td>
                      <td className="px-3 py-1.5 text-[#666666]">{r.valueStreamName ?? '—'}</td>
                      <td className="px-3 py-1.5 text-[#666666]">{r.l4 ?? r.l3 ?? '—'}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-1.5 tnum text-[#666666]">{r.stepNumber}</td>
                      <td className="px-3 py-1.5 text-[#171717]">{r.name}</td>
                      <td className="px-3 py-1.5 text-[#666666]">{r.valueStreamName ?? '—'}</td>
                      <td className="px-3 py-1.5"><span className={'text-[11px] px-1.5 py-0.5 rounded ' + (r.relation === 'Lead' ? 'bg-[#dbeafe] text-[#1e40af]' : 'bg-[#f5f5f5] text-[#525252]')}>{r.relation}</span></td>
                    </>
                  )}
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(r)} className="text-[#525252] hover:text-[#171717] text-xs font-medium">Edit</button>
                    <button onClick={() => remove(r)} className="ml-3 text-[#be123c] hover:text-[#9f1239] text-xs font-medium">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button className="btn-secondary mt-2" onClick={() => setEditing({ create: addDefaults })}>
        + Add {kind === 'io' ? 'deliverable / input' : 'process task'}
      </button>

      {editing !== null && (
        <EntityForm
          entity={entity}
          companyId={companyId}
          record={'create' in editing ? null : (editing as Record<string, any>)}
          defaults={'create' in editing ? (editing as { create: Record<string, any> }).create : undefined}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </Section>
  );
}
