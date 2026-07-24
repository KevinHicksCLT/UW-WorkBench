import { useSearchParams } from 'react-router-dom';
import OrgDrillToc from '../../components/OrgDrillToc';
import OrgListExplorer from '../../components/OrgListExplorer';
import OrgMapCanvas from '../../viz/org-map/OrgMapCanvas';
import OrgTable from '../org-table/OrgTable';
import { ViewPills } from '../../components/TocView';

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
// there). `?role=<id>` deep links land on the LIST view; the role's detail
// drawer itself is the GLOBAL RoleDrawerHost (Layout) — this page only needs
// the param to pick the view, never to mount/close the drawer.
type View = 'toc' | 'list' | 'map' | 'detail';

export default function Organization() {
  // View state lives in the URL — the single record of "where I was":
  // `?view=departments` (home "Departments" tile) opens the OrgTable drill-down
  // ('detail' surface); `?view=map|list` forces that view; `?role=<id>` (links
  // from Work / External / Standards / the org map's role leaves / old
  // /roles/:id URLs) picks the LIST view so the role's row is visible under
  // the global RoleDrawerHost. The params are KEPT (not stripped) so the
  // breadcrumb trail, browser back/forward, and a reload all land the user
  // back on the same spot.
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const roleId = searchParams.get('role');
  const view: View =
    viewParam === 'departments'
      ? 'detail'
      : viewParam === 'map' || viewParam === 'list'
        ? viewParam
        : roleId
          ? 'list'
          : 'toc';

  const setView = (v: View) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === 'toc') {
          next.delete('view');
          next.delete('role');
        } else if (v !== 'detail') {
          next.set('view', v);
        }
        return next;
      },
      { replace: true },
    );
  };

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
              <OrgDrillToc
                startAt="segment"
                leading={<ViewPills options={pillOptions} view={view} onChange={setView} />}
              />
            </div>
          </div>
        ) : view === 'list' ? (
          <OrgListExplorer />
        ) : view === 'map' ? (
          // Map view: a literal drill-down map of the org spine, full-bleed.
          <OrgMapCanvas />
        ) : (
          // Detail surface (deep links only): the OrgTable drill-down, in a
          // scrollable centered container. Top padding clears the floating toggle.
          <div className="h-full overflow-auto">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-6">
              <OrgTable />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
