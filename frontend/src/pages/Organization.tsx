import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import OrgListExplorer from '../components/OrgListExplorer';
import OrgTable from './OrgTable';

// Organization tab — mirrors the Value Streams tab: a floating segmented control
// toggles between three views of the SAME org spine:
//   List  — fully-exploded drill-down outline (Company › Segment › Division ›
//           Department › Role › Person) with the shared metrics sidebar.
//   Table — the original box-grid drill-down (OrgTable), kept intact.
type View = 'list' | 'table';

// Floating segmented control — hovers over the content; List ↔ Table.
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
        <button type="button" role="tab" aria-selected={view === 'table'} className={btn(view === 'table')} onClick={() => onChange('table')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" />
          </svg>
          Table
        </button>
      </div>
    </div>
  );
}

export default function Organization() {
  // `?view=departments` (home "Departments" tile) and `?role=<id>` (links from
  // Work / External / Standards / the map) deep-link into the box-grid
  // drill-down — land on the Table view so OrgTable handles the param.
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<View>(
    searchParams.get('view') === 'departments' || searchParams.get('role') ? 'table' : 'list',
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <ViewToggle view={view} onChange={setView} />

        {view === 'list' ? (
          <OrgListExplorer />
        ) : (
          // Table view: the original OrgTable, in a scrollable centered container
          // (matching the app's standard detail-page shell). Top padding clears
          // the floating toggle.
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
