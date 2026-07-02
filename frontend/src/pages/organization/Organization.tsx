import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useHeaderBreadcrumbSlot } from '../../lib/breadcrumbs';
import OrgListExplorer from '../../components/OrgListExplorer';
import OrgMapCanvas from '../../viz/org-map/OrgMapCanvas';
import OrgTable from '../org-table/OrgTable';
import RoleDrawer from '../../components/RoleDrawer';
import { TocView, ViewPills, type TocRow } from '../../components/TocView';
import { ErrorMessage, LoadingState } from '../../components/ui';

// Organization tab — mirrors the Value Streams tab: a floating segmented control
// toggles views of the SAME org spine:
//   TOC  — (default) table of contents: one row per division with its role
//          count and segment; click through to the division detail.
//   Map  — a literal spatial drill-down map (OrgMapCanvas, react-flow), like the
//          Value Streams map: Company → Segment → Division → Team → Role.
//   List — Excel-like drill-down grid (Domain › Division › Department › Role)
//          with the shared metrics sidebar.
// A fourth, toggle-less surface — 'detail' — renders the old OrgTable drill-down
// for the `?view=departments` deep link (the departments overview only exists
// there). `?role=<id>` deep links land on the LIST view with the role's full
// detail drawer open (the standalone role page was retired into RoleDrawer).
type View = 'toc' | 'list' | 'map' | 'detail';

// TOC rows — one per ORG division (OrgUnit L2), from the org-table bootstrap:
// real division ids (what /divisions/:id expects), role counts homed in the
// division + its departments, and the parent segment. (/explorer/overview is
// the VALUE-STREAM map bootstrap — its "divisions" are process L2 nodes.)
function OrgToc({ leading }: { leading?: React.ReactNode }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TocRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .get<{
        segments: {
          divisions: { id: string; name: string; segment: string; roleCount: number }[];
        }[];
      }>('/explorer/org-table')
      .then((t) => {
        setRows(
          t.segments
            .flatMap((s) => s.divisions)
            .filter((d) => d.id !== '__unassigned') // pseudo-bucket, not a navigable division
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((d) => ({
              id: d.id,
              name: d.name,
              count: d.roleCount,
              extra: d.segment,
              onClick: () => navigate(`/divisions/${d.id}`),
            })),
        );
      })
      .catch((e) => setError(e.message ?? 'Failed to load'));
  }, [navigate]);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!rows) return <LoadingState message="Loading organization…" className="animate-pulse" />;
  return (
    <TocView
      rows={rows}
      nameLabel="Division"
      countLabel="Roles"
      extraLabel="Segment"
      unit="divisions"
      searchPlaceholder="Search division, segment…"
      leading={leading}
      totals={`${rows.length} divisions · ${rows.reduce((a, r) => a + r.count, 0)} roles`}
    />
  );
}

export default function Organization() {
  // Deep links: `?view=departments` (home "Departments" tile) opens the OrgTable
  // drill-down — the 'detail' surface (OrgTable consumes and clears the param,
  // so this only latches the surface on). `?role=<id>` (links from Work /
  // External / Standards / the org map's role leaves / old /roles/:id URLs)
  // opens that role's detail drawer OVER whatever view is active — the user
  // stays exactly where they drilled to, in map or list. The param is consumed
  // and cleared here so re-clicking the same link re-opens the drawer.
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<View>(() =>
    searchParams.get('view') === 'departments'
      ? 'detail'
      : searchParams.get('role')
        ? 'list'
        : 'toc',
  );
  const [roleDrawerId, setRoleDrawerId] = useState<string | null>(searchParams.get('role'));
  useEffect(() => {
    if (searchParams.get('view') === 'departments') setView('detail');
    const role = searchParams.get('role');
    if (role) {
      setRoleDrawerId(role);
      setView('list');
      const next = new URLSearchParams(searchParams);
      next.delete('role');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // In map view the drill breadcrumb claims the GLOBAL header bar (Layout's
  // BreadcrumbBar) and OrgMapCanvas portals into it — no in-page header strip.
  const crumbSlot = useHeaderBreadcrumbSlot(view === 'map');

  const pillOptions = [
    { key: 'toc' as const, label: 'TOC' },
    { key: 'map' as const, label: 'Map' },
    { key: 'list' as const, label: 'List' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* TOC hosts the pills inline in its header strip; the full-bleed
            surfaces (map/list/detail) get the floating toggle. */}
        {view !== 'toc' && (
          <ViewPills floating options={pillOptions} view={view} onChange={setView} />
        )}

        {view === 'toc' ? (
          <div className="h-full overflow-auto">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-6">
              <OrgToc
                leading={<ViewPills options={pillOptions} view={view} onChange={setView} />}
              />
            </div>
          </div>
        ) : view === 'list' ? (
          <OrgListExplorer focusRoleId={roleDrawerId} />
        ) : view === 'map' ? (
          // Map view: a literal drill-down map of the org spine, full-bleed.
          <OrgMapCanvas breadcrumbSlot={crumbSlot} />
        ) : (
          // Detail surface (deep links only): the OrgTable drill-down, in a
          // scrollable centered container. Top padding clears the floating toggle.
          <div className="h-full overflow-auto">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-6">
              <OrgTable />
            </div>
          </div>
        )}

        {/* Deep-linked role detail — slides over the active view in place. */}
        {roleDrawerId && <RoleDrawer roleId={roleDrawerId} onClose={() => setRoleDrawerId(null)} />}
      </div>
    </div>
  );
}
