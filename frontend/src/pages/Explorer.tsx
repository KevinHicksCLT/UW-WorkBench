import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import MapCanvas from '../viz/MapCanvas';
import ListExplorer from '../components/ListExplorer';
import type { DivisionSummary } from '../viz/model';

type View = 'map' | 'list';

// Floating segmented control — hovers over the canvas; toggles map ↔ list.
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

// Note: DrillCanvas / DrillNode are no longer used by this view.
// Those files remain untouched (still used via other paths / org-chart).

export default function Explorer() {
  const [divisions, setDivisions] = useState<DivisionSummary[]>([]);
  const [companyName, setCompanyName] = useState('Enterprise');
  const [crumbSlot, setCrumbSlot] = useState<HTMLElement | null>(null);
  const [streams, setStreams] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  // Deep-link arrives when the user clicks through from elsewhere in the app:
  //   `?focus=<valueStreamId>` → LIST view focused on that value stream (its
  //                              detail opens in the right sidebar); add
  //                              `view=map` to focus the map instead.
  //   `?view=list|map`         → force that view (list is fully exploded to the
  //                              process-step level, e.g. the home "Process steps" tile).
  // Lift it into state and clear the param so it doesn't linger or re-fire.
  const [searchParams, setSearchParams] = useSearchParams();
  const [focusVsId, setFocusVsId] = useState<string | null>(null);

  useEffect(() => {
    const f = searchParams.get('focus');
    const v = searchParams.get('view');
    if (!f && v !== 'list' && v !== 'map') return;
    if (f) { setFocusVsId(f); setView(v === 'map' ? 'map' : 'list'); }
    else if (v === 'list' || v === 'map') setView(v);
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    next.delete('view');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    api.get('/explorer/overview')
      .then((overview) => {
        if (cancelled) return;
        // overview.divisions shape: { id, name, higherCategory, roles }
        // Null higherCategory → fold into "Core Business"
        const divs: DivisionSummary[] = (overview.divisions ?? []).map((d: any) => ({
          id: d.id,
          name: d.name,
          higherCategory: d.higherCategory ?? 'Core Business',
          roles: d.roles ?? 0,
        }));
        setDivisions(divs);
        if (overview.company?.name) setCompanyName(overview.company.name);
        if (overview.counts?.valueStreams != null) setStreams(overview.counts.valueStreams);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message ?? 'Failed to load');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header — map view only (MapCanvas portals its breadcrumb into the
          slot). The list view starts flush under the tab bar (D2.1). */}
      {view === 'map' && (
        <header className="flex-shrink-0 px-6 py-1.5 border-b border-[#eaeaea] bg-white">
          <div ref={setCrumbSlot} className="min-h-[18px] flex items-center" />
        </header>
      )}

      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* Hovering toggle: interactive map ↔ list view */}
        <ViewToggle view={view} onChange={setView} />

        {view === 'list' ? (
          <ListExplorer divisions={divisions} companyName={companyName} streams={streams} focusVsId={focusVsId} />
        ) : loading ? (
          <div className="h-full grid place-items-center">
            <div className="text-sm text-[#a3a3a3] animate-pulse">Loading operating model…</div>
          </div>
        ) : error ? (
          <div className="h-full grid place-items-center">
            <div className="text-sm text-[#be123c]">{error}</div>
          </div>
        ) : (
          <MapCanvas divisions={divisions} companyName={companyName} breadcrumbSlot={crumbSlot} focusVsId={focusVsId} />
        )}
      </div>
    </div>
  );
}
