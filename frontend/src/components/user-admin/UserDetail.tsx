import { useEffect, useMemo, useState } from 'react';
import {
  DOMAIN_ADMIN_ASSIGNABLE,
  GEOGRAPHIES,
  GEOGRAPHY_LABELS,
  USER_TYPES,
  USER_TYPE_LABELS,
  type EffectivePermissions,
  type UserType,
  type UserUpsertRequest,
} from '@cascade/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useDialogs } from '../../lib/dialogs';
import { Button, Chip, ErrorMessage, Input, Label, LoadingState, Select } from '../ui';
import { OverrideTree } from './PermissionTree';
import {
  overrideRowsFromState,
  overrideStateFromRows,
  type OverrideState,
} from './permissionTreeModel';
import type { AdminUser, Pickers } from './types';

// UserDetail — drawer body for the Users sheet: the full user form (create →
// POST /users, edit → PATCH with only the changed fields), plus (edit only)
// the per-user permission-override editor and the deactivate action.

type OverrideRow = {
  menuKey: string;
  canCreate: boolean | null;
  canRead: boolean | null;
  canUpdate: boolean | null;
  canDelete: boolean | null;
};
type PermissionsPayload = { effective: EffectivePermissions; overrides: OverrideRow[] };

type FormState = {
  name: string;
  email: string;
  role: UserType;
  geography: string;
  orgUnitId: string;
  operatingRoleId: string;
  isManager: boolean;
  isApprover: boolean;
  reportsToId: string;
  valueStreamIds: string[];
  password: string;
};

function formFromUser(user: AdminUser | null): FormState {
  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    role: user?.role ?? 'MEMBER',
    geography: user?.geography ?? '',
    orgUnitId: user?.orgUnitId ?? '',
    operatingRoleId: user?.operatingRoleId ?? '',
    isManager: user?.isManager ?? false,
    isApprover: user?.isApprover ?? false,
    reportsToId: user?.reportsToId ?? '',
    valueStreamIds: user?.valueStreams.map((v) => v.processNode.id) ?? [],
    password: '',
  };
}

/** Depth-first walk of the picker org units so the Select reads as a tree.
 * Nodes whose parent is outside the (scope-cut) list count as roots. */
function orgUnitTreeWalk(
  units: Pickers['orgUnits'],
): { id: string; label: string; depth: number }[] {
  const ids = new Set(units.map((u) => u.id));
  const children = new Map<string, Pickers['orgUnits']>();
  const roots: Pickers['orgUnits'] = [];
  for (const u of units) {
    if (u.parentId && ids.has(u.parentId)) {
      const list = children.get(u.parentId) ?? [];
      list.push(u);
      children.set(u.parentId, list);
    } else {
      roots.push(u);
    }
  }
  const out: { id: string; label: string; depth: number }[] = [];
  const visit = (u: Pickers['orgUnits'][number], depth: number) => {
    out.push({ id: u.id, label: u.displayValue, depth });
    for (const c of children.get(u.id) ?? []) visit(c, depth + 1);
  };
  for (const r of roots) visit(r, 0);
  return out;
}

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

export default function UserDetail({
  user,
  onClose,
  onSaved,
}: {
  /** null = create mode. */
  user: AdminUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const auth = useAuth();
  const { confirm } = useDialogs();
  const isCreate = user === null;
  const isSelf = !isCreate && user.id === auth.user?.id;
  const isSiteAdmin = auth.user?.role === 'SITE_ADMIN';

  const [form, setForm] = useState<FormState>(() => formFromUser(user));
  const [pickers, setPickers] = useState<Pickers | null>(null);
  const [managers, setManagers] = useState<AdminUser[]>([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Permission overrides (edit mode only).
  const [effective, setEffective] = useState<EffectivePermissions | null>(null);
  const [overrides, setOverrides] = useState<OverrideState | null>(null);
  const [overridesError, setOverridesError] = useState('');
  const [savingOverrides, setSavingOverrides] = useState(false);
  const [overridesSaved, setOverridesSaved] = useState(false);

  useEffect(() => {
    api
      .get<Pickers>('/users/pickers')
      .then(setPickers)
      .catch((e: Error) => setError(e.message));
    api
      .get<AdminUser[]>('/users?managersOnly=1')
      .then(setManagers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    api
      .get<PermissionsPayload>(`/users/${user.id}/permissions`)
      .then((p) => {
        setEffective(p.effective);
        setOverrides(overrideStateFromRows(p.overrides));
      })
      .catch((e: Error) => setOverridesError(e.message));
  }, [user]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const assignableTypes: readonly UserType[] = isSiteAdmin ? USER_TYPES : DOMAIN_ADMIN_ASSIGNABLE;
  // Keep the current role visible even when the editor could not assign it
  // (e.g. a domain admin viewing… the server hides those users anyway, but a
  // SITE_ADMIN edited by rule keeps the select coherent).
  const typeOptions = assignableTypes.includes(form.role)
    ? assignableTypes
    : [form.role, ...assignableTypes];

  const orgOptions = useMemo(() => (pickers ? orgUnitTreeWalk(pickers.orgUnits) : []), [pickers]);

  const filteredRoles = useMemo(() => {
    if (!pickers) return [];
    const needle = roleFilter.trim().toLowerCase();
    const list = needle
      ? pickers.roles.filter((r) => r.displayValue.toLowerCase().includes(needle))
      : pickers.roles;
    // The selected role must stay in the options or the select loses its value.
    const selected = pickers.roles.find((r) => r.id === form.operatingRoleId);
    return selected && !list.some((r) => r.id === selected.id) ? [selected, ...list] : list;
  }, [pickers, roleFilter, form.operatingRoleId]);

  const toggleStream = (id: string) =>
    set(
      'valueStreamIds',
      form.valueStreamIds.includes(id)
        ? form.valueStreamIds.filter((v) => v !== id)
        : [...form.valueStreamIds, id],
    );

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (isCreate) {
        const body: UserUpsertRequest = {
          email: form.email.trim(),
          name: form.name.trim(),
          role: form.role,
          orgUnitId: form.orgUnitId || null,
          geography: (form.geography || null) as UserUpsertRequest['geography'],
          operatingRoleId: form.operatingRoleId || null,
          isManager: form.isManager,
          isApprover: form.isApprover,
          reportsToId: form.reportsToId || null,
          valueStreamIds: form.valueStreamIds,
          ...(form.password ? { password: form.password } : {}),
        };
        await api.post('/users', body);
      } else {
        // PATCH only what changed.
        const initial = formFromUser(user);
        const patch: Partial<UserUpsertRequest> = {};
        if (form.name.trim() !== initial.name) patch.name = form.name.trim();
        if (form.email.trim() !== initial.email) patch.email = form.email.trim();
        if (form.role !== initial.role) patch.role = form.role;
        if (form.geography !== initial.geography)
          patch.geography = (form.geography || null) as UserUpsertRequest['geography'];
        if (form.orgUnitId !== initial.orgUnitId) patch.orgUnitId = form.orgUnitId || null;
        if (form.operatingRoleId !== initial.operatingRoleId)
          patch.operatingRoleId = form.operatingRoleId || null;
        if (form.isManager !== initial.isManager) patch.isManager = form.isManager;
        if (form.isApprover !== initial.isApprover) patch.isApprover = form.isApprover;
        if (form.reportsToId !== initial.reportsToId) patch.reportsToId = form.reportsToId || null;
        if (!sameIds(form.valueStreamIds, initial.valueStreamIds))
          patch.valueStreamIds = form.valueStreamIds;
        if (Object.keys(patch).length > 0) await api.patch(`/users/${user.id}`, patch);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveOverrides = async () => {
    if (!user || !overrides) return;
    setSavingOverrides(true);
    setOverridesError('');
    setOverridesSaved(false);
    try {
      await api.put(`/users/${user.id}/overrides`, overrideRowsFromState(overrides));
      setOverridesSaved(true);
    } catch (e) {
      setOverridesError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingOverrides(false);
    }
  };

  const deactivate = async () => {
    if (!user) return;
    const ok = await confirm({
      title: `Deactivate ${user.name}?`,
      message:
        'The user is signed out and can no longer log in. Their record and history are kept.',
      confirmLabel: 'Deactivate',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/users/${user.id}`);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deactivate failed');
    }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorMessage>{error}</ErrorMessage>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ud-name">Name</Label>
          <Input id="ud-name" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ud-email">Email</Label>
          <Input
            id="ud-email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="ud-type">User type</Label>
          <Select
            id="ud-type"
            value={form.role}
            disabled={isSelf}
            onChange={(e) => set('role', e.target.value as UserType)}
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {USER_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          {isSelf && (
            <p className="text-[11px] text-[#a3a3a3] mt-1">You cannot change your own user type.</p>
          )}
        </div>
        <div>
          <Label htmlFor="ud-geo">Geography</Label>
          <Select
            id="ud-geo"
            value={form.geography}
            onChange={(e) => set('geography', e.target.value)}
          >
            <option value="" />
            {GEOGRAPHIES.map((g) => (
              <option key={g} value={g}>
                {GEOGRAPHY_LABELS[g]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ud-org">Org unit</Label>
          <Select
            id="ud-org"
            value={form.orgUnitId}
            onChange={(e) => set('orgUnitId', e.target.value)}
          >
            <option value="" />
            {orgOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {'  '.repeat(o.depth) + o.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ud-reports-to">Reports to</Label>
          <Select
            id="ud-reports-to"
            value={form.reportsToId}
            onChange={(e) => set('reportsToId', e.target.value)}
          >
            <option value="" />
            {managers
              .filter((m) => m.id !== user?.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </Select>
          <p className="text-[11px] text-[#a3a3a3] mt-1">Managers only</p>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="ud-role">Operating role</Label>
          <Input
            className="mb-1.5"
            placeholder="Filter roles…"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter operating roles"
          />
          <Select
            id="ud-role"
            value={form.operatingRoleId}
            onChange={(e) => set('operatingRoleId', e.target.value)}
          >
            <option value="" />
            {filteredRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.displayValue}
              </option>
            ))}
          </Select>
        </div>
        {isCreate && (
          <div className="sm:col-span-2">
            <Label htmlFor="ud-password">Password</Label>
            <Input
              id="ud-password"
              type="password"
              autoComplete="new-password"
              placeholder="Leave blank to auto-generate"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
          </div>
        )}
      </div>

      <div>
        <Label>Value streams</Label>
        {form.valueStreamIds.length > 0 && pickers && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {form.valueStreamIds.map((id) => {
              const vs = pickers.valueStreams.find((v) => v.id === id);
              return (
                <Chip key={id} variant="soft" className="inline-flex items-center gap-1">
                  {vs?.displayValue ?? id}
                  <button
                    type="button"
                    aria-label={`Remove ${vs?.displayValue ?? id}`}
                    onClick={() => toggleStream(id)}
                    className="text-[#a3a3a3] hover:text-[#171717]"
                  >
                    ×
                  </button>
                </Chip>
              );
            })}
          </div>
        )}
        <div className="rounded-lg border border-[#eaeaea] max-h-44 overflow-y-auto p-2 space-y-0.5">
          {!pickers ? (
            <LoadingState baseClassName="text-[11px] text-[#a3a3a3] italic" />
          ) : (
            pickers.valueStreams.map((vs) => (
              <label
                key={vs.id}
                className="flex items-center gap-2 text-sm text-[#171717] px-1 py-0.5 rounded hover:bg-[#fafafa] cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[#171717]"
                  checked={form.valueStreamIds.includes(vs.id)}
                  onChange={() => toggleStream(vs.id)}
                />
                <span className="truncate">{vs.displayValue}</span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center gap-5">
        <label className="flex items-center gap-2 text-sm text-[#171717] cursor-pointer">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[#171717]"
            checked={form.isManager}
            onChange={(e) => set('isManager', e.target.checked)}
          />
          Manager
        </label>
        <label className="flex items-center gap-2 text-sm text-[#171717] cursor-pointer">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[#171717]"
            checked={form.isApprover}
            onChange={(e) => set('isApprover', e.target.checked)}
          />
          Approver
        </label>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-[#f5f5f5]">
        <Button
          onClick={() => void save()}
          disabled={saving || !form.name.trim() || !form.email.trim()}
        >
          {saving ? 'Saving…' : isCreate ? 'Create user' : 'Save'}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <div className="flex-1" />
        {!isCreate && !isSelf && (
          <Button variant="ghost" className="text-[#be123c]" onClick={() => void deactivate()}>
            Deactivate
          </Button>
        )}
      </div>

      {!isCreate && (
        <div className="pt-3 border-t border-[#eaeaea]">
          <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#374151] mb-2">
            Permission overrides
          </div>
          {overridesError && <ErrorMessage className="mb-2">{overridesError}</ErrorMessage>}
          {effective && overrides ? (
            <>
              <OverrideTree
                value={overrides}
                base={effective}
                onChange={(next) => {
                  setOverrides(next);
                  setOverridesSaved(false);
                }}
              />
              <div className="flex items-center gap-2 mt-2">
                <Button onClick={() => void saveOverrides()} disabled={savingOverrides}>
                  {savingOverrides ? 'Saving…' : 'Save overrides'}
                </Button>
                {overridesSaved && (
                  <span className="text-[11px] text-[#16a34a]">Overrides saved.</span>
                )}
              </div>
            </>
          ) : (
            !overridesError && <LoadingState baseClassName="text-[11px] text-[#a3a3a3] italic" />
          )}
        </div>
      )}
    </div>
  );
}
