// Applications — catalog of the systems where work is executed and
// memorialized (Bridge Input "Cap – Application Catalog" + the pre-existing
// illustrative app estate). Sidebar "Applications & systems" items deep-link
// here with ?focus=<id>. Data: GET /applications.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';

type App = {
  id: string; code: string | null; name: string; kind: string; category: string | null;
  vendor: string | null; criticality: string; description: string | null;
  systemOfRecord: boolean | null; illustrative: boolean;
  totalTco: number | null; primaryDivisionName: string | null;
  stepUsages: number; sorDeliverables: number;
};

function Dropdown({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="min-w-[160px]">
      <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none w-full rounded-lg border border-[#eaeaea] bg-white pl-3 pr-8 py-1.5 text-sm text-[#171717] cursor-pointer hover:border-[#d4d4d4] focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150"
        >
          {['All', ...options].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a3a3a3]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

export default function Applications() {
  const { data, error, loading } = useApi<{ applications: App[] }>('/applications');
  const [params] = useSearchParams();
  const focusId = params.get('focus');
  const [category, setCategory] = useState('All');
  const [domain, setDomain] = useState('All');
  const focusRef = useRef<HTMLDivElement | null>(null);

  const apps = data?.applications ?? [];
  const categories = useMemo(() => [...new Set(apps.map((a) => a.category).filter((v): v is string => !!v))].sort(), [apps]);
  const kinds = useMemo(() => [...new Set(apps.map((a) => a.kind).filter(Boolean))].sort(), [apps]);

  const filtered = apps.filter((a) =>
    (category === 'All' || a.category === category)
    && (domain === 'All' || a.kind === domain));

  // Deep link from the value-stream sidebar: scroll the focused app into view.
  useEffect(() => {
    if (focusId && !loading) focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusId, loading]);

  return (
    <div className="px-6 py-6 max-w-[1200px] mx-auto">
      <PageHeader
        title="Applications, Systems of Record, Delivery Mediums"
        subtitle="Applications and tools where the work is performed and/or memorialized"
      />
      <div className="flex flex-wrap gap-3 mb-5">
        <Dropdown label="Category" value={category} onChange={setCategory} options={categories} />
        <Dropdown label="Kind" value={domain} onChange={setDomain} options={kinds} />
      </div>

      {error && <div className="text-sm text-red-600">Failed to load applications.</div>}
      {loading && <div className="grid gap-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton rounded-lg" style={{ height: 64 }} />)}</div>}

      <div className="grid gap-2">
        {filtered.map((a) => {
          const focused = a.id === focusId;
          return (
            <div
              key={a.id}
              ref={focused ? focusRef : undefined}
              className={`rounded-lg border px-4 py-3 bg-white ${focused ? 'border-[#0070AD] ring-2 ring-[#0070AD]/20' : 'border-[#eaeaea]'}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                {a.code && <span className="text-[10px] font-mono font-semibold text-[#0070AD] bg-[#eaf1ff] border border-[#cdddff] rounded px-1.5 py-0.5">{a.code}</span>}
                <span className="text-[14px] font-semibold text-[#171717]">{a.name}</span>
                {a.systemOfRecord && <span className="text-[9px] font-semibold uppercase tracking-wide text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] rounded px-1.5 py-0.5">System of record</span>}
                {a.illustrative && <span className="text-[9px] font-medium uppercase tracking-wide text-[#a3a3a3] bg-[#fafafa] border border-[#eaeaea] rounded px-1.5 py-0.5">Illustrative</span>}
                <span className="ml-auto text-[10px] text-[#a3a3a3]">{a.kind}{a.category ? ` · ${a.category}` : ''}</span>
              </div>
              <div className="mt-1 flex items-center gap-4 text-[11px] text-[#525252] flex-wrap">
                {a.vendor && <span>Vendor: {a.vendor}</span>}
                {a.primaryDivisionName && <span>Division: {a.primaryDivisionName}</span>}
                <span>Used on {a.stepUsages} step{a.stepUsages === 1 ? '' : 's'}</span>
                <span>System of record for {a.sorDeliverables} deliverable{a.sorDeliverables === 1 ? '' : 's'}</span>
                {a.totalTco != null && <span>TCO ${Math.round(a.totalTco / 1000).toLocaleString()}K/yr</span>}
              </div>
              {a.description && <div className="mt-1 text-[11px] text-[#a3a3a3]">{a.description}</div>}
            </div>
          );
        })}
        {!loading && !filtered.length && <div className="text-sm text-[#a3a3a3]">No applications match the filters.</div>}
      </div>
    </div>
  );
}
