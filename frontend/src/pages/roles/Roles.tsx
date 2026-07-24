import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import RoleEditorDrawer from '../../components/RoleEditorDrawer';
import RolesListSheet from '../../components/RolesListSheet';
import RolesOrgChart from '../../components/RolesOrgChart';
import OrgDrillToc from '../../components/OrgDrillToc';
import { ViewPills } from '../../components/TocView';
import { Button } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { can } from '../../lib/permissions';

// Roles tab — mirrors the Value Streams / Organization tabs, roles are the
// centerpiece:
//   TOC  — (default) table of contents: one row per division with its role
//          count and segment; click through to the List pre-filtered to it.
//   List — flat spreadsheet, one row per role: Department, Division, Role, Role
//          Type, participating value streams / deliverables / tasks / standards,
//          checklist responsibilities.
//   Map  — org chart hierarchy rooted at the CEO, drilling down to the lowest
//          role (scaffold: just the CEO for now, see RolesOrgChart).
type View = 'toc' | 'list' | 'map';

export default function Roles() {
  // Deep-linkable view (`/roles?view=list`) — same pattern as Organization:
  // the view lives in the URL so breadcrumbs/back/reload restore it.
  const [searchParams, setSearchParams] = useSearchParams();
  const paramView = searchParams.get('view');
  const view: View = paramView === 'list' || paramView === 'map' ? paramView : 'toc';
  const setView = (v: View) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === 'toc') next.delete('view');
        else next.set('view', v);
        return next;
      },
      { replace: true },
    );
  };
  // Division picked on the TOC — the List opens pre-filtered to it.
  const [preFilter, setPreFilter] = useState<string | null>(null);

  // SCRUM-34 — the add-role flow lives on the tab itself, not in Data Admin.
  const { permissions } = useAuth();
  const [adding, setAdding] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const pillOptions = [
    { key: 'toc' as const, label: 'TOC' },
    { key: 'list' as const, label: 'List' },
    { key: 'map' as const, label: 'Map' },
  ];
  const pills = (
    <div className="flex items-center gap-2">
      <ViewPills
        options={pillOptions}
        view={view}
        onChange={(v) => {
          if (v === 'toc') {
            setPreFilter(null);
          }
          setView(v);
        }}
      />
      {can(permissions, 'roles', 'create') && (
        <Button
          variant="secondary"
          className="!py-1 !px-2.5 text-xs"
          onClick={() => setAdding(true)}
        >
          + New role
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {view === 'toc' ? (
          <div className="h-full overflow-auto">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-6">
              <OrgDrillToc startAt="division" leading={pills} />
            </div>
          </div>
        ) : view === 'list' ? (
          <RolesListSheet
            key={`roles-${preFilter ?? ''}-${refreshKey}`}
            leading={pills}
            forceFilters={preFilter ? { division: preFilter } : undefined}
          />
        ) : (
          <>
            <div className="absolute top-3 left-4 z-20">{pills}</div>
            <RolesOrgChart />
          </>
        )}
        {adding && (
          <RoleEditorDrawer
            role={null}
            onClose={() => setAdding(false)}
            onSaved={() => {
              setRefreshKey((k) => k + 1);
              setView('list');
            }}
          />
        )}
      </div>
    </div>
  );
}
