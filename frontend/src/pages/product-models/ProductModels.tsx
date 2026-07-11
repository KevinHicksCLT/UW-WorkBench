// Product Models — catalog of the legacy product models being rationalized on
// the Workspace board (the fourth rationalizable structure alongside
// Applications, Value Streams and Roles), rendered in the canonical Sheet
// format (see components/Sheet.tsx). Deep links use ?focus=<id> — the focused
// row is highlighted and scrolled into view. Clicking a row opens a right-hand
// drawer with what the model covers, its disposition, and the workspace boards
// it appears on. Data: GET /product-models (plan §6.2).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import PageHeader from '../../components/PageHeader';
import { Sheet, SheetCell, type SheetCol } from '../../components/Sheet';
import { TocView, ViewPills, type TocRow } from '../../components/TocView';
import { ErrorMessage, StatusPill } from '../../components/ui';
import ProductModelDrawer, { DISPOSITION_TONE, type ProductModel } from './ProductModelDrawer';

const DASH = '—';
const UNSEGMENTED = 'Unsegmented';

const cols: SheetCol<ProductModel>[] = [
  { key: 'name', label: 'Product model', width: 'minmax(0,1.3fr)', value: (m) => m.name },
  {
    key: 'sourceSystem',
    label: 'Source system',
    width: '160px',
    value: (m) => m.sourceSystem ?? DASH,
    dim: true,
  },
  { key: 'segment', label: 'Segment', width: '150px', value: (m) => m.segment ?? DASH, dim: true },
  {
    key: 'geography',
    label: 'Geography',
    width: '130px',
    value: (m) => m.geography ?? DASH,
    dim: true,
  },
  {
    key: 'disposition',
    label: 'Disposition',
    width: '120px',
    value: (m) => m.disposition ?? DASH,
    render: (m) =>
      m.disposition ? (
        <StatusPill tone={DISPOSITION_TONE[m.disposition] ?? 'slate'}>{m.disposition}</StatusPill>
      ) : (
        <SheetCell text={DASH} dim />
      ),
  },
  {
    key: 'workspaces',
    label: 'Workspace',
    width: 'minmax(0,1fr)',
    value: (m) => m.workspaces.map((w) => w.name).join(', ') || DASH,
    dim: true,
  },
  {
    key: 'findings',
    label: 'Findings',
    width: '80px',
    value: (m) => String(m.findingCount),
    filterable: false,
    align: 'center',
    render: (m) => <SheetCell text={m.findingCount ? String(m.findingCount) : DASH} dim />,
  },
];

export default function ProductModels() {
  const { data, error, loading } = useApi<{ productModels: ProductModel[] }>('/product-models');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const focusId = params.get('focus');
  const models = data?.productModels ?? [];
  const [selected, setSelected] = useState<ProductModel | null>(null);

  // ── TOC (default view): one row per segment — model count + findings. Click
  // drills into the segment's detail page (its models, grouped by geography) —
  // the same descent as the Applications TOC. A ?focus deep link needs the
  // actual list, so it forces the List view.
  const [view, setView] = useState<'toc' | 'list'>(focusId ? 'list' : 'toc');
  useEffect(() => {
    if (focusId) setView('list');
  }, [focusId]);

  const tocRows = useMemo<TocRow[]>(() => {
    const groups = new Map<string, { count: number; findings: number }>();
    for (const m of models) {
      const seg = m.segment ?? UNSEGMENTED;
      const g = groups.get(seg) ?? { count: 0, findings: 0 };
      g.count += 1;
      g.findings += m.findingCount;
      groups.set(seg, g);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([segment, g]) => ({
        id: segment,
        name: segment,
        count: g.count,
        extra: g.findings > 0 ? `${g.findings} findings` : null,
        onClick: () => navigate(`/product-models/segments/${encodeURIComponent(segment)}`),
      }));
  }, [models, navigate]);

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
        title="Product Models"
        subtitle="Legacy product models being normalized and rationalized on the Workspace board"
      />

      {error && (
        <ErrorMessage baseClassName="text-sm text-red-600 mb-3">
          Failed to load product models.
        </ErrorMessage>
      )}

      {view === 'toc' ? (
        <TocView
          rows={tocRows}
          nameLabel="Segment"
          countLabel="Product models"
          extraLabel="Findings"
          unit="segments"
          searchPlaceholder="Search segment…"
          leading={viewToggle}
          totals={`${models.length} product models across ${tocRows.length} segments`}
        />
      ) : (
        <Sheet
          sheetKey="product-models"
          rows={models}
          cols={cols}
          rowKey={(m) => m.id}
          loading={loading}
          scrollToKey={focusId}
          unit="product models"
          leading={viewToggle}
          onRowClick={(m) => setSelected(m)}
          selectedKey={selected?.id}
          summarize={(v) =>
            `${v.filter((m) => m.workspaces.length > 0).length} on a workspace · ${new Set(v.map((m) => m.sourceSystem).filter(Boolean)).size} source systems`
          }
        />
      )}

      {selected && <ProductModelDrawer model={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
