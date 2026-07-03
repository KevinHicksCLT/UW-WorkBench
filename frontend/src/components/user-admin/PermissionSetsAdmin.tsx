import { useEffect, useState } from 'react';
import { USER_TYPES, USER_TYPE_LABELS, type UserType } from '@cascade/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button, Card, ErrorMessage, LoadingState } from '../ui';
import { GrantTree } from './PermissionTree';
import { grantRowsFromState, grantStateFromRows, type GrantState } from './permissionTreeModel';

// PermissionSetsAdmin — User Admin → User Types & Permissions (SITE_ADMIN
// only): the six per-user-type permission sets. Left rail picks a type, right
// side edits its grants in the GrantTree. SITE_ADMIN itself is always full
// access and not editable.

type GrantRow = {
  menuKey: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};
type PermissionSet = { id: string; userType: UserType; grants: GrantRow[] };

export default function PermissionSetsAdmin() {
  const { refreshMe } = useAuth();
  const [sets, setSets] = useState<PermissionSet[] | null>(null);
  const [selected, setSelected] = useState<UserType>(USER_TYPES[0]);
  const [state, setState] = useState<GrantState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<PermissionSet[]>('/users/permission-sets')
      .then(setSets)
      .catch((e: Error) => setError(e.message));
  }, []);

  // Load the selected type's grants into the editor whenever the selection (or
  // the fetched sets) change. Switching types discards unsaved edits.
  useEffect(() => {
    const set = sets?.find((s) => s.userType === selected);
    setState(set ? grantStateFromRows(set.grants) : null);
    setDirty(false);
    setSaved(false);
  }, [sets, selected]);

  const save = async () => {
    if (!state) return;
    setSaving(true);
    setError('');
    try {
      const updated = (await api.put(`/users/permission-sets/${selected}`, {
        grants: grantRowsFromState(state),
      })) as PermissionSet;
      setSets((prev) => prev?.map((s) => (s.userType === selected ? updated : s)) ?? null);
      setDirty(false);
      setSaved(true);
      // Re-sync our own session in case we just changed our own type's set.
      await refreshMe();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="flex-shrink-0 lg:w-64">
        <nav
          className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible"
          aria-label="User types"
        >
          {USER_TYPES.map((t) => {
            const active = t === selected;
            return (
              <button
                key={t}
                onClick={() => setSelected(t)}
                aria-current={active ? 'true' : undefined}
                className={
                  'whitespace-nowrap lg:whitespace-normal rounded-md px-3 py-2 text-sm text-left transition-colors duration-150 lg:border-l-2 ' +
                  (active
                    ? 'bg-[#f5f5f5] text-[#171717] font-semibold lg:border-[#171717]'
                    : 'text-[#666666] font-medium hover:text-[#171717] hover:bg-[#fafafa] lg:border-transparent')
                }
              >
                {USER_TYPE_LABELS[t]}
                {t === 'SITE_ADMIN' && (
                  <span className="block text-[11px] font-normal text-[#a3a3a3]">
                    full access — not editable
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        {error && <ErrorMessage className="mb-3">{error}</ErrorMessage>}
        {selected === 'SITE_ADMIN' ? (
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-[#171717] mb-1">
              Site Admin is always full access
            </h3>
            <p className="text-sm text-[#666666] max-w-xl">
              The Site Admin user type holds create, read, update, and delete on every menu item by
              definition — it administers the platform itself, including this page. Its permission
              set cannot be reduced; pick another user type to edit its grants.
            </p>
          </Card>
        ) : !sets || !state ? (
          <LoadingState baseClassName="text-sm text-[#a3a3a3] italic" />
        ) : (
          <>
            <GrantTree
              value={state}
              onChange={(next) => {
                setState(next);
                setDirty(true);
                setSaved(false);
              }}
            />
            <div className="flex items-center gap-3 mt-3">
              <Button onClick={() => void save()} disabled={saving || !dirty}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              {saved && <span className="text-[11px] text-[#16a34a]">Saved.</span>}
              <span className="text-[11px] text-[#a3a3a3]">
                Changes reach other signed-in users within a minute.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
