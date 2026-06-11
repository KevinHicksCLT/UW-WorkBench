import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHeaderBreadcrumbSlot } from '../lib/breadcrumbs';
import OrgListExplorer from '../components/OrgListExplorer';
import OrgMapCanvas from '../viz/OrgMapCanvas';
import OrgTable from './OrgTable';
import RoleDrawer from '../components/RoleDrawer';

// Organization tab — mirrors the Value Streams tab: a floating segmented control
// toggles between two views of the SAME org spine:
//   List — Excel-like drill-down grid (Domain › Division › Department › Role)
//          with the shared metrics sidebar.
//   Map  — a literal spatial drill-down map (OrgMapCanvas, react-flow), like the
//          Value Streams map: Company → Segment → Division → Team → Role.
// A third, toggle-less surface — 'detail' — renders the old OrgTable drill-down
// for the `?view=departments` deep link (the departments overview only exists
// there). `?role=<id>` deep links land on the LIST view with the role's full
// detail drawer open (the standalone role page was retired into RoleDrawer).
type View = 'list' | 'map' | 'detail';

// Floating segmented control — hovers over the content; List ↔ Map.
function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const btn = (active: boolean) =>
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 ' +
    (active ? 'bg-[#171717] text-white' : 'text-[#525252] hover:text-[#171717]');
  return (
    <div className="absolute top-3 left-4 z-20">
      <div className="inline-flex items-center gap-0.5 rounded-full border border-[#eaeaea] bg-white/90 backdrop-blur p-0.5 shadow-sm" role="tablist" aria-label="View mode">
        <button type="button" role="tab" aria-selected={view === 'list'} className={btn(view === 'list')} onClick={() => onChange('list')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          List
        </button>
        <button type="button" role="tab" aria-selected={view === 'map'} className={btn(view === 'map')} onClick={() => onChange('map')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15" />
          </svg>
          Map
        </button>
      </div>
    </div>
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
  const [view, setView] = useState<View>(searchParams.get('view') === 'departments' ? 'detail' : 'list');
  const [roleDrawerId, setRoleDrawerId] = useState<string | null>(searchParams.get('role'));
  useEffect(() => {
    if (searchParams.get('view') === 'departments') setView('detail');
    const role = searchParams.get('role');
    if (role) {
      setRoleDrawerId(role);
      const next = new URLSearchParams(searchParams);
      next.delete('role');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // In map view the drill breadcrumb claims the GLOBAL header bar (Layout's
  // BreadcrumbBar) and OrgMapCanvas portals into it — no in-page header strip.
  const crumbSlot = useHeaderBreadcrumbSlot(view === 'map');

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <ViewToggle view={view} onChange={setView} />

        {view === 'list' ? (
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
