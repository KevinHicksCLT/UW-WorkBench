import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import MapCanvas from '../viz/MapCanvas';
import type { DivisionSummary } from '../viz/model';

// Note: DrillCanvas / DrillNode are no longer used by this view.
// Those files remain untouched (still used via other paths / org-chart).

export default function Explorer() {
  const [divisions, setDivisions] = useState<DivisionSummary[]>([]);
  const [companyName, setCompanyName] = useState('Enterprise');
  const [crumbSlot, setCrumbSlot] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      {/* Page header */}
      <header className="flex-shrink-0 px-6 pt-4 pb-3 border-b border-[#eaeaea] bg-white">
        <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">
          Operating Model Explorer
        </div>
        {/* Breadcrumb / hint lives here — MapCanvas portals its breadcrumb into this slot. */}
        <div ref={setCrumbSlot} className="min-h-[24px] flex items-center" />
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="h-full grid place-items-center">
            <div className="text-sm text-[#a3a3a3] animate-pulse">Loading operating model…</div>
          </div>
        ) : error ? (
          <div className="h-full grid place-items-center">
            <div className="text-sm text-[#be123c]">{error}</div>
          </div>
        ) : (
          <MapCanvas divisions={divisions} companyName={companyName} breadcrumbSlot={crumbSlot} />
        )}
      </div>
    </div>
  );
}
