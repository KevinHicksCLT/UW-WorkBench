import { useState } from 'react';
import RolesListSheet from '../components/RolesListSheet';
import RolesOrgChart from '../components/RolesOrgChart';

// Roles tab — mirrors the Value Streams / Organization tabs: a floating
// segmented control toggles between two views, roles are the centerpiece:
//   List — flat spreadsheet, one row per role: Department, Division, Role, Role
//          Type, participating value streams / deliverables / tasks / standards,
//          checklist responsibilities.
//   Map  — org chart hierarchy rooted at the CEO, drilling down to the lowest
//          role (scaffold: just the CEO for now, see RolesOrgChart).
type View = 'list' | 'map';

// The segmented List/Map pill. In the list view it rides inline in the Sheet's
// totals strip (the `leading` slot) — identical to the Standards tab, so the
// toggle · counts · search sit on one row and scroll away together. In the org
// chart view it floats (there's no strip to host it).
function TogglePill({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const btn = (active: boolean) =>
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 ' +
    (active ? 'bg-[#171717] text-white' : 'text-[#525252] hover:text-[#171717]');
  return (
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
  );
}

export default function Roles() {
  const [view, setView] = useState<View>('list');
  const toggle = <TogglePill view={view} onChange={setView} />;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {view === 'list' ? (
          <RolesListSheet leading={toggle} />
        ) : (
          <>
            <div className="absolute top-3 left-4 z-20">{toggle}</div>
            <RolesOrgChart />
          </>
        )}
      </div>
    </div>
  );
}
