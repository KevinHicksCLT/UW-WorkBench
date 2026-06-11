// Applications — catalog of the systems where work is executed and
// memorialized (Bridge Input "Cap – Application Catalog" + the pre-existing
// illustrative app estate), rendered in the canonical Sheet format (see
// components/Sheet.tsx). Sidebar "Applications & systems" items deep-link here
// with ?focus=<id> — the focused row is highlighted and scrolled into view.
// Clicking a row expands its description + usage detail. Data: GET /applications.
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';
import { Sheet, SheetCell, type SheetCol } from '../components/Sheet';

type App = {
  id: string; code: string | null; name: string; kind: string; category: string | null;
  vendor: string | null; criticality: string; description: string | null;
  systemOfRecord: boolean | null; illustrative: boolean;
  totalTco: number | null; primaryDivisionName: string | null;
  stepUsages: number; sorDeliverables: number;
};

const DASH = '—';

const cols: SheetCol<App>[] = [
  {
    key: 'name', label: 'Application', width: 'minmax(0,1.3fr)', value: (a) => a.name,
    render: (a) => (
      <>
        {a.code && <span className="text-[10px] font-mono font-semibold text-[#0070AD] bg-[#eaf1ff] border border-[#cdddff] rounded px-1 py-0.5 flex-shrink-0">{a.code}</span>}
        <span className="truncate text-[12px] text-[#171717]">{a.name}</span>
        {a.systemOfRecord && <span className="text-[9px] font-semibold uppercase tracking-wide text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] rounded px-1 py-0.5 flex-shrink-0">SoR</span>}
      </>
    ),
  },
  { key: 'kind', label: 'Kind', width: '150px', value: (a) => a.kind, dim: true },
  { key: 'category', label: 'Category', width: '170px', value: (a) => a.category ?? DASH, dim: true },
  { key: 'vendor', label: 'Vendor', width: '150px', value: (a) => a.vendor ?? DASH, dim: true },
  { key: 'division', label: 'Division', width: 'minmax(0,1fr)', value: (a) => a.primaryDivisionName ?? DASH, dim: true },
  {
    key: 'steps', label: 'Steps', width: '70px', value: (a) => String(a.stepUsages), filterable: false,
    render: (a) => <span className="text-[12px] text-[#737373] tnum">{a.stepUsages}</span>,
  },
  {
    key: 'tco', label: 'TCO / yr', width: '90px', value: (a) => (a.totalTco != null ? String(a.totalTco) : ''), filterable: false,
    render: (a) => <SheetCell text={a.totalTco != null ? `$${Math.round(a.totalTco / 1000).toLocaleString()}K` : DASH} dim />,
  },
];

export default function Applications() {
  const { data, error, loading } = useApi<{ applications: App[] }>('/applications');
  const [params] = useSearchParams();
  const focusId = params.get('focus');
  const apps = data?.applications ?? [];

  return (
    <div>
      <PageHeader
        title="Applications, Systems of Record, Delivery Mediums"
        subtitle="Applications and tools where the work is performed and/or memorialized"
      />

      {error && <div className="text-sm text-red-600 mb-3">Failed to load applications.</div>}

      <Sheet
        rows={apps}
        cols={cols}
        rowKey={(a) => a.id}
        loading={loading}
        scrollToKey={focusId}
        summarize={(v) => `${v.filter((a) => a.systemOfRecord).length} systems of record · ${new Set(v.map((a) => a.vendor).filter(Boolean)).size} vendors`}
        expand={(a) => (
          <div className="space-y-1 text-[12px] text-[#525252]">
            {a.description && <div>{a.description}</div>}
            <div className="flex items-center gap-4 flex-wrap text-[11px]">
              <span>Used on {a.stepUsages} step{a.stepUsages === 1 ? '' : 's'}</span>
              <span>System of record for {a.sorDeliverables} deliverable{a.sorDeliverables === 1 ? '' : 's'}</span>
              {a.criticality && <span>Criticality: {a.criticality}</span>}
              {a.totalTco != null && <span>TCO ${Math.round(a.totalTco / 1000).toLocaleString()}K/yr</span>}
            </div>
          </div>
        )}
      />
    </div>
  );
}
