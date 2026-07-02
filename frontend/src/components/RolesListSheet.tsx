// RolesListSheet — the Roles tab's list view: one flat spreadsheet row per role
// (or, for a role with checklist responsibilities, one row per checklist item).
// Data: GET /roles. Roles are the centerpiece — Department/Division/Role/Type
// come off the org spine; the participation columns are the chain the role
// touches (value streams → deliverables → tasks → standards → checklist),
// resolved from each role's FK links (NodeRole / RoleDeliverable / RoleStandard
// / NodeChecklist). Unbounded columns are capped in the API; the drawer shows all.
import { useState, type ReactNode } from 'react';
import { useApi } from '../lib/useApi';
import { Sheet, SheetCell, type SheetCol } from '../components/Sheet';
import RoleDrawer from './RoleDrawer';
import { ErrorMessage } from './ui';

type RoleRow = {
  key: string; roleId: string; role: string; roleType: string | null;
  department: string | null; division: string | null;
  valueStreams: string[]; deliverables: string[]; tasks: string[]; standards: string[];
  checklist: string[];
};

const DASH = '—';

const listCell = (items: string[]) => {
  const joined = items.join(', ');
  return <SheetCell text={joined || DASH} dim title={joined || undefined} />;
};

const cols: SheetCol<RoleRow>[] = [
  { key: 'department', label: 'Department', width: '130px', value: (r) => r.department ?? DASH, dim: true },
  { key: 'division', label: 'Division', width: '130px', value: (r) => r.division ?? DASH, dim: true },
  { key: 'role', label: 'Role', width: '170px', value: (r) => r.role },
  { key: 'roleType', label: 'Role Type', width: '100px', value: (r) => r.roleType ?? DASH },
  { key: 'valueStreams', label: 'Value Streams', width: 'minmax(140px,1fr)', values: (r) => r.valueStreams, render: (r) => listCell(r.valueStreams) },
  { key: 'deliverables', label: 'Deliverables', width: 'minmax(140px,1fr)', values: (r) => r.deliverables, render: (r) => listCell(r.deliverables) },
  { key: 'tasks', label: 'Tasks', width: 'minmax(140px,1fr)', values: (r) => r.tasks, render: (r) => listCell(r.tasks) },
  { key: 'standards', label: 'Standards', width: 'minmax(140px,1fr)', values: (r) => r.standards, render: (r) => listCell(r.standards) },
  { key: 'checklist', label: 'Checklist', width: 'minmax(150px,1.1fr)', values: (r) => r.checklist, render: (r) => listCell(r.checklist) },
];

export default function RolesListSheet({ leading }: { leading?: ReactNode }) {
  const { data, error, loading } = useApi<{ rows: RoleRow[] }>('/roles');
  const rows = data?.rows ?? [];
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  return (
    <>
      <div className="h-full overflow-y-auto">
        <div className="px-4 sm:px-6 pt-3 pb-6">
          {error && <ErrorMessage baseClassName="text-sm text-red-600 mb-3">Failed to load roles.</ErrorMessage>}
          <Sheet
            rows={rows}
            cols={cols}
            rowKey={(r) => r.key}
            loading={loading}
            unit="rows"
            leading={leading}
            onRowClick={(r) => setSelectedRoleId(r.roleId)}
            summarize={(v) => `${new Set(v.map((r) => r.roleId)).size} roles · ${new Set(v.map((r) => r.department).filter(Boolean)).size} departments`}
          />
        </div>
      </div>

      {/* Sibling of the scroller (not nested inside it) so the drawer isn't
          clipped by the sheet's own overflow-y-auto. */}
      {selectedRoleId && <RoleDrawer roleId={selectedRoleId} onClose={() => setSelectedRoleId(null)} />}
    </>
  );
}
