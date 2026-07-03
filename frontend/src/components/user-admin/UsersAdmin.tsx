import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Sheet, type SheetCol } from '../Sheet';
import { Button, Chip, DrawerShell, ErrorMessage, StatusPill } from '../ui';
import UserDetail from './UserDetail';
import { geographyLabel, userTypeLabel, type AdminUser } from './types';

// UsersAdmin — the User Admin → Users section: the canonical Sheet over
// GET /users, with a slide-over detail (UserDetail) for create/edit.

type DrawerState = { mode: 'create' } | { mode: 'edit'; user: AdminUser } | null;

export default function UsersAdmin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setError('');
    api
      .get<AdminUser[]>('/users')
      .then(setUsers)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // Mutations clear the api GET cache, so bumping the key refetches fresh rows.
  const refetch = useCallback(() => {
    api.invalidate('/users');
    setRefreshKey((k) => k + 1);
  }, []);

  const cols: SheetCol<AdminUser>[] = [
    { key: 'name', label: 'Name', width: 'minmax(0,1.1fr)', value: (u) => u.name, hideable: false },
    { key: 'email', label: 'Email', width: 'minmax(0,1.3fr)', value: (u) => u.email, dim: true },
    { key: 'type', label: 'User type', width: '170px', value: (u) => userTypeLabel(u.role) },
    {
      key: 'org',
      label: 'Org unit',
      width: 'minmax(0,1fr)',
      value: (u) => u.orgUnit?.displayValue ?? '',
      dim: true,
    },
    {
      key: 'geography',
      label: 'Geography',
      width: '120px',
      value: (u) => geographyLabel(u.geography),
      dim: true,
    },
    {
      key: 'valueStreams',
      label: 'Value streams',
      width: 'minmax(0,1.3fr)',
      values: (u) => u.valueStreams.map((v) => v.processNode.displayValue),
      render: (u) => (
        <div className="flex flex-wrap gap-1 py-0.5">
          {u.valueStreams.map((v) => (
            <Chip key={v.processNode.id} variant="soft">
              {v.processNode.displayValue}
            </Chip>
          ))}
        </div>
      ),
    },
    {
      key: 'manager',
      label: 'Manager',
      width: '84px',
      value: (u) => (u.isManager ? 'Yes' : '—'),
      align: 'center',
      dim: true,
    },
    {
      key: 'approver',
      label: 'Approver',
      width: '84px',
      value: (u) => (u.isApprover ? 'Yes' : '—'),
      align: 'center',
      dim: true,
    },
    {
      key: 'status',
      label: 'Status',
      width: '110px',
      value: (u) => (u.status === 'ACTIVE' ? 'Active' : 'Deactivated'),
      render: (u) => (
        <StatusPill tone={u.status === 'ACTIVE' ? 'green' : 'slate'}>
          {u.status === 'ACTIVE' ? 'Active' : 'Deactivated'}
        </StatusPill>
      ),
    },
  ];

  return (
    <div>
      {error && <ErrorMessage className="mb-3">{error}</ErrorMessage>}

      <Sheet<AdminUser>
        rows={users}
        cols={cols}
        rowKey={(u) => u.id}
        sheetKey="admin.users"
        unit="users"
        loading={loading}
        emptyText="No users match the current filters."
        onRowClick={(u) => setDrawer({ mode: 'edit', user: u })}
        leading={<Button onClick={() => setDrawer({ mode: 'create' })}>Add user</Button>}
      />

      {drawer && (
        // Fixed wrapper gives the DrawerShell's absolute positioning a
        // viewport-sized box regardless of how far the page is scrolled.
        <div className="fixed inset-0 z-40">
          <DrawerShell
            onClose={() => setDrawer(null)}
            width={640}
            maxWidth="94vw"
            header={
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">
                  {drawer.mode === 'create' ? 'New user' : 'User'}
                </div>
                <div className="text-[15px] font-bold text-[#171717] leading-snug truncate">
                  {drawer.mode === 'create' ? 'Add user' : drawer.user.name}
                </div>
                {drawer.mode === 'edit' && (
                  <div className="text-[11px] text-[#a3a3a3] mt-0.5 truncate">
                    {drawer.user.email}
                  </div>
                )}
              </div>
            }
          >
            <UserDetail
              user={drawer.mode === 'edit' ? drawer.user : null}
              onClose={() => setDrawer(null)}
              onSaved={() => {
                refetch();
                setDrawer(null);
              }}
            />
          </DrawerShell>
        </div>
      )}
    </div>
  );
}
