import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useHeaderBreadcrumbSlot } from '../lib/breadcrumbs';
import MapCanvas from '../viz/MapCanvas';
import ListExplorer from '../components/ListExplorer';
import type { DivisionSummary } from '../viz/model';
import { ErrorMessage, LoadingState } from '../components/ui';

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
  // `?vs=<name>` focuses the LIST by value-stream NAME (used where the caller
  // only knows the name, e.g. the Third-Parties drawer) — pre-applies the Value
  // stream filter without needing the stream's id.
  const [focusVsName, setFocusVsName] = useState<string | null>(null);

  useEffect(() => {
    const f = searchParams.get('focus');
    const vsName = searchParams.get('vs');
    const v = searchParams.get('view');
    if (!f && !vsName && v !== 'list' && v !== 'map') return;
    if (f) { setFocusVsId(f); setView(v === 'map' ? 'map' : 'list'); }
    else if (vsName) { setFocusVsName(vsName); setView('list'); }
    else if (v === 'list' || v === 'map') setView(v);
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    next.delete('vs');
    next.delete('view');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Load the map bootstrap (domains + L2 divisions). Exposed as a callback so the
  // map can re-run it after an edit-mode move (an L2 row could have changed).
  const loadOverview = useCallback(() => {
    api.get('/explorer/overview')
      .then((overview) => {
        // overview.divisions shape: { id, name, higherCategory, higherCategoryId, roles }
        // Null higherCategory → fold into "Core Business"
        const divs: DivisionSummary[] = (overview.divisions ?? []).map((d: { id: string; name: string; higherCategory?: string | null; higherCategoryId?: string | null; roles?: number }) => ({
          id: d.id,
          name: d.name,
          higherCategory: d.higherCategory ?? 'Core Business',
          higherCategoryId: d.higherCategoryId ?? null,
          roles: d.roles ?? 0,
        }));
        setDivisions(divs);
        if (overview.company?.name) setCompanyName(overview.company.name);
        if (overview.counts?.valueStreams != null) setStreams(overview.counts.valueStreams);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message ?? 'Failed to load');
        setLoading(false);
      });
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  // In map view the drill breadcrumb claims the GLOBAL header bar (Layout's
  // BreadcrumbBar) and MapCanvas portals into it — no in-page header strip.
  const crumbSlot = useHeaderBreadcrumbSlot(view === 'map');

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* Hovering toggle: interactive map ↔ list view */}
        <ViewToggle view={view} onChange={setView} />

        {view === 'list' ? (
          <ListExplorer divisions={divisions} companyName={companyName} streams={streams} focusVsId={focusVsId} focusVsName={focusVsName} />
        ) : loading ? (
          <div className="h-full grid place-items-center">
            <LoadingState className="animate-pulse" message="Loading operating model…" />
          </div>
        ) : error ? (
          <div className="h-full grid place-items-center">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        ) : (
          <MapCanvas divisions={divisions} companyName={companyName} breadcrumbSlot={crumbSlot} focusVsId={focusVsId} onMoved={loadOverview} />
        )}
      </div>
    </div>
  );
}
