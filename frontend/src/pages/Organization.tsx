import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import OrgListExplorer from '../components/OrgListExplorer';
import OrgMapCanvas from '../viz/OrgMapCanvas';
import OrgTable from './OrgTable';

// Organization tab — mirrors the Value Streams tab: a floating segmented control
// toggles between two views of the SAME org spine:
//   List — Excel-like drill-down grid (Domain › Division › Department › Role)
//          with the shared metrics sidebar.
//   Map  — a literal spatial drill-down map (OrgMapCanvas, react-flow), like the
//          Value Streams map: Company → Segment → Division → Team → Role.
// A third, toggle-less surface — 'detail' — renders the old OrgTable drill-down
// for the `?role=<id>` and `?view=departments` deep links (role detail and the
// departments overview only exist there; the map's role leaves link into it).
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

const hasDeepLink = (sp: URLSearchParams) => sp.get('view') === 'departments' || !!sp.get('role');

export default function Organization() {
  // `?view=departments` (home "Departments" tile) and `?role=<id>` (links from
  // Work / External / Standards / the org map's role leaves) deep-link into the
  // OrgTable drill-down — the 'detail' surface. OrgTable itself consumes and
  // clears the params, so this only latches the surface on (it must not flip
  // back when the params disappear).
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<View>(hasDeepLink(searchParams) ? 'detail' : 'list');
  useEffect(() => {
    if (hasDeepLink(searchParams)) setView('detail');
  }, [searchParams]);

  // Slot the map's breadcrumb portals into (same pattern as the VS Explorer).
  const [crumbSlot, setCrumbSlot] = useState<HTMLElement | null>(null);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header — map view only (OrgMapCanvas portals its breadcrumb here). */}
      {view === 'map' && (
        <header className="flex-shrink-0 px-6 py-1.5 border-b border-[#eaeaea] bg-white">
          <div ref={setCrumbSlot} className="min-h-[18px] flex items-center" />
        </header>
      )}

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <ViewToggle view={view} onChange={setView} />

        {view === 'list' ? (
          <OrgListExplorer />
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
      </div>
    </div>
  );
}
