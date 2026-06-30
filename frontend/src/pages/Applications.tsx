// Applications — catalog of the systems where work is executed and
// memorialized (Bridge Input "Cap – Application Catalog" + the pre-existing
// illustrative app estate), rendered in the canonical Sheet format (see
// components/Sheet.tsx). Sidebar "Applications & systems" items deep-link here
// with ?focus=<id> — the focused row is highlighted and scrolled into view.
// Clicking a row opens a right-hand drawer with what the app does, the roles
// that use it, the value streams it ties to, and usage stats. Data: GET /applications.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';
import { Sheet, SheetCell, type SheetCol } from '../components/Sheet';

type App = {
  id: string; code: string | null; name: string; kind: string; category: string | null;
  vendor: string | null; criticality: string; description: string | null;
  systemOfRecord: boolean | null; illustrative: boolean;
  totalTco: number | null; primaryDivisionName: string | null;
  stepUsages: number; sorDeliverables: number;
  valueStreams: string[]; roles: { id: string; name: string }[];
};

const DASH = '—';

const cols: SheetCol<App>[] = [
  { key: 'name', label: 'Application', width: 'minmax(0,1.3fr)', value: (a) => a.name },
  { key: 'kind', label: 'Kind', width: '130px', value: (a) => a.kind, dim: true },
  { key: 'category', label: 'Category', width: '160px', value: (a) => a.category ?? DASH, dim: true },
  { key: 'vendor', label: 'Vendor', width: '150px', value: (a) => a.vendor ?? DASH, dim: true },
  { key: 'division', label: 'Division', width: 'minmax(0,1fr)', value: (a) => a.primaryDivisionName ?? DASH, dim: true },
  {
    key: 'tco', label: 'TCO / yr', width: '90px', value: (a) => (a.totalTco != null ? String(a.totalTco) : ''), filterable: false,
    render: (a) => <SheetCell text={a.totalTco != null ? `$${Math.round(a.totalTco / 1000).toLocaleString()}K` : DASH} dim />,
  },
];

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">{children}</div>
);

// Right-hand slide-over for one application. All data is already in the list
// row, so the drawer just presents it — no extra fetch.
function AppDrawer({ app, onClose }: { app: App; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sub = [app.vendor, app.category, app.primaryDivisionName].filter(Boolean).join(' · ');
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside className="relative h-full bg-white border-l border-[#eaeaea] shadow-2xl flex flex-col" style={{ width: 480, maxWidth: '92vw' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#eaeaea] border-t-[3px] border-t-[#0070AD] flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0070AD]">Application</span>
              {app.systemOfRecord && (
                <span className="text-[9px] font-semibold uppercase tracking-wide text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] rounded px-1 py-0.5">System of record</span>
              )}
            </div>
            <div className="text-[15px] font-bold text-[#171717] leading-snug mt-0.5">{app.name}</div>
            {sub && <div className="text-[11px] text-[#a3a3a3] mt-0.5">{sub}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1 flex-shrink-0 text-[#a3a3a3] hover:text-[#171717] w-7 h-7 rounded-md hover:bg-[#fafafa] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="rounded-lg border border-[#cde3f5] bg-[#f2f8fd] p-3">
            <SectionLabel>What it does</SectionLabel>
            <p className="text-sm text-[#171717] leading-relaxed">{app.description}</p>
          </div>

          <div>
            <SectionLabel>Value streams</SectionLabel>
            {app.valueStreams.length ? (
              <div className="flex flex-wrap gap-1.5">
                {app.valueStreams.map((v) => (
                  <Link
                    key={v}
                    to={`/overview?vs=${encodeURIComponent(v)}`}
                    className="inline-flex items-center rounded-full bg-[#eef6fb] text-[#0070AD] border border-[#cde3f5] px-2 py-0.5 text-[11px] font-medium hover:bg-[#dceaf7] transition-colors"
                  >
                    {v}
                  </Link>
                ))}
              </div>
            ) : <div className="text-sm text-[#a3a3a3] italic">None mapped.</div>}
          </div>

          <div>
            <SectionLabel>Roles that use it</SectionLabel>
            {app.roles.length ? (
              <div className="flex flex-wrap gap-1.5">
                {app.roles.map((r) => (
                  <Link key={r.id} to={`/roles/${r.id}`} className="inline-flex items-center rounded-full bg-[#eef2ff] text-[#4338ca] border border-[#d6dcff] px-2 py-0.5 text-[11px] font-medium hover:bg-[#e0e7ff] transition-colors">{r.name}</Link>
                ))}
              </div>
            ) : <div className="text-sm text-[#a3a3a3] italic">None resolved from process steps.</div>}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function Applications() {
  const { data, error, loading } = useApi<{ applications: App[] }>('/applications');
  const [params] = useSearchParams();
  const focusId = params.get('focus');
  const apps = data?.applications ?? [];
  const [selected, setSelected] = useState<App | null>(null);

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle="Applications and tools where the work is performed and/or memorialized"
      />

      {error && <div className="text-sm text-red-600 mb-3">Failed to load applications.</div>}

      <Sheet
        rows={apps}
        cols={cols}
        rowKey={(a) => a.id}
        loading={loading}
        scrollToKey={focusId}
        unit="applications"
        onRowClick={(a) => setSelected(a)}
        selectedKey={selected?.id}
        summarize={(v) => `${v.filter((a) => a.systemOfRecord).length} systems of record · ${new Set(v.map((a) => a.vendor).filter(Boolean)).size} vendors`}
      />

      {selected && <AppDrawer app={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
