// Applications — catalog of the systems where work is executed and
// memorialized (Bridge Input "Cap – Application Catalog" + the pre-existing
// illustrative app estate), rendered in the canonical Sheet format (see
// components/Sheet.tsx). Sidebar "Applications & systems" items deep-link here
// with ?focus=<id> — the focused row is highlighted and scrolled into view.
// Clicking a row drills into the application's own page (profile + codebase
// scan). Data: GET /applications.
import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { useViewState } from '../../lib/viewState';
import PageHeader from '../../components/PageHeader';
import { Sheet, SheetCell, type SheetCol } from '../../components/Sheet';
import { TocView, ViewPills, type TocRow } from '../../components/TocView';
import { ErrorMessage } from '../../components/ui';
import type { App } from './types';

const DASH = '—';

const cols: SheetCol<App>[] = [
  { key: 'name', label: 'Application', width: 'minmax(0,1.3fr)', value: (a) => a.name },
  { key: 'kind', label: 'Kind', width: '130px', value: (a) => a.kind, dim: true },
  {
    key: 'category',
    label: 'Category',
    width: '160px',
    value: (a) => a.category ?? DASH,
    dim: true,
  },
  { key: 'vendor', label: 'Vendor', width: '150px', value: (a) => a.vendor ?? DASH, dim: true },
  {
    key: 'division',
    label: 'Division',
    width: 'minmax(0,1fr)',
    value: (a) => a.primaryDivisionName ?? DASH,
    dim: true,
  },
  {
    key: 'scanned',
    label: 'Scan',
    width: '110px',
    value: (a) => (a.scanStatus === 'SCANNED' ? 'Scanned' : 'Not scanned'),
    align: 'center',
    render: (a) =>
      a.scanStatus === 'SCANNED' ? (
        <span className="pill-green">Scanned</span>
      ) : (
        <SheetCell text="Not scanned" dim />
      ),
  },
  {
    key: 'tco',
    label: 'TCO / yr',
    width: '90px',
    value: (a) => (a.totalTco != null ? String(a.totalTco) : ''),
    filterable: false,
    align: 'center',
    render: (a) => (
      <SheetCell
        text={a.totalTco != null ? `$${Math.round(a.totalTco / 1000).toLocaleString()}K` : DASH}
        dim
      />
    ),
  },
];

export default function Applications() {
  const { data, error, loading } = useApi<{ applications: App[] }>('/applications');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const focusId = params.get('focus');
  const apps = data?.applications ?? [];

  // ── TOC (default view): one row per application kind — count + run cost.
  // Click drills into the kind's detail page (its applications, grouped by
  // category) — the same descent as the Standards TOC. A ?focus deep link
  // needs the actual list, so it forces the List view.
  // Persisted per session (lib/viewState) so returning to the tab restores the
  // TOC|List choice; a ?focus deep link needs the list, so it skips restore.
  const [view, setView] = useViewState<'toc' | 'list'>(
    'applications.view',
    focusId ? 'list' : 'toc',
    !focusId,
  );
  useEffect(() => {
    if (focusId) setView('list');
  }, [focusId]);

  const tocRows = useMemo<TocRow[]>(() => {
    const groups = new Map<string, { count: number; tco: number }>();
    for (const a of apps) {
      const g = groups.get(a.kind) ?? { count: 0, tco: 0 };
      g.count += 1;
      g.tco += a.totalTco ?? 0;
      groups.set(a.kind, g);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([kind, g]) => ({
        id: kind,
        name: kind,
        count: g.count,
        extra: g.tco > 0 ? `$${Math.round(g.tco / 1000).toLocaleString()}K / yr` : null,
        onClick: () => navigate(`/applications/kinds/${encodeURIComponent(kind)}`),
      }));
  }, [apps, navigate]);

  const viewToggle = (
    <ViewPills
      options={[
        { key: 'toc' as const, label: 'TOC' },
        { key: 'list' as const, label: 'List' },
      ]}
      view={view}
      onChange={setView}
    />
  );

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle="Applications and tools where the work is performed and/or memorialized"
      />

      {error && (
        <ErrorMessage baseClassName="text-sm text-red-600 mb-3">
          Failed to load applications.
        </ErrorMessage>
      )}

      {view === 'toc' ? (
        <TocView
          rows={tocRows}
          nameLabel="Kind"
          countLabel="Applications"
          extraLabel="Run cost (TCO)"
          unit="kinds"
          searchPlaceholder="Search kind…"
          leading={viewToggle}
          totals={`${apps.length} applications across ${tocRows.length} kinds`}
        />
      ) : (
        <Sheet
          sheetKey="applications"
          rows={apps}
          cols={cols}
          rowKey={(a) => a.id}
          loading={loading}
          scrollToKey={focusId}
          unit="applications"
          leading={viewToggle}
          onRowClick={(a) => navigate(`/applications/${a.id}`)}
          summarize={(v) =>
            `${v.filter((a) => a.systemOfRecord).length} systems of record · ${new Set(v.map((a) => a.vendor).filter(Boolean)).size} vendors`
          }
        />
      )}
    </div>
  );
}
