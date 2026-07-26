// Product Model List view — a normal flat spreadsheet over the product spine,
// rendered with the canonical Sheet (combobox filters + grid): ONE ROW PER L4
// VERSION, with its ancestry (Segment | LOB / Product Family | Product)
// denormalized into the leading columns. The first four column captions come
// from the payload's user-editable `levels` (never hardcoded); Status renders
// the shared StatusPill and "Runs in" is inherited from the L3 parent.
// Clicking a row docks the right-hand detail sidebar (ProductDetailPanel)
// showing everything under that version — header facts, ancestry, and the L5
// model components with their elements. Read-only. Data: GET /product-spine/table.

import { useMemo } from 'react';
import { useApi } from '../lib/useApi';
import ProductDetailPanel from './product-list/ProductDetailPanel';
import {
  flattenVersions,
  statusTone,
  type ProductTableData,
  type VersionRow,
} from './product-list/model';
import { useViewState } from '../lib/viewState';
import { Sheet, SheetCell, type SheetCol } from './Sheet';
import { ErrorMessage, StatusPill } from './ui';

const DASH = '—';

export default function ProductListExplorer() {
  const { data, error, loading } = useApi<ProductTableData>('/product-spine/table');
  // The open drawer persists as an id (lib/viewState) and re-resolves from the
  // loaded rows, so drilling out of the drawer and coming back reopens it.
  const [selectedId, setSelectedId] = useViewState<string | null>('product.list.selected', null);

  const levels = useMemo(
    () => [...(data?.levels ?? [])].sort((a, b) => a.levelNumber - b.levelNumber),
    [data],
  );
  const caption = (levelNumber: number, fallback: string) =>
    levels.find((l) => l.levelNumber === levelNumber)?.name ?? fallback;

  const rows = useMemo(() => flattenVersions(data?.roots ?? []), [data]);
  const selected = useMemo(
    () => (selectedId ? (rows.find((r) => r.id === selectedId) ?? null) : null),
    [selectedId, rows],
  );

  // Column captions depend on the payload's editable level names, so the
  // config is memoized on `levels` rather than hoisted to module scope.
  const cols = useMemo<SheetCol<VersionRow>[]>(
    () => [
      {
        key: 'segment',
        label: caption(1, 'Segment'),
        width: 'minmax(0,1fr)',
        value: (r) => r.segment,
      },
      {
        key: 'lob',
        label: caption(2, 'LOB / Product Family'),
        width: 'minmax(0,1.1fr)',
        value: (r) => r.lob,
      },
      {
        key: 'product',
        label: caption(3, 'Product'),
        width: 'minmax(0,1.1fr)',
        value: (r) => r.product,
      },
      {
        key: 'version',
        label: caption(4, 'Version / Jurisdiction'),
        width: 'minmax(0,1fr)',
        value: (r) => r.version,
        hideable: false,
      },
      {
        key: 'jurisdiction',
        label: 'Jurisdiction',
        width: '120px',
        value: (r) => r.jurisdiction ?? DASH,
        dim: true,
      },
      {
        key: 'status',
        label: 'Status',
        width: '120px',
        value: (r) => r.status ?? DASH,
        render: (r) =>
          r.status ? (
            <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill>
          ) : (
            <SheetCell text={DASH} dim />
          ),
      },
      {
        key: 'effective',
        label: 'Effective',
        width: '110px',
        value: (r) => r.effective ?? DASH,
        filterable: false,
        dim: true,
      },
      {
        key: 'runsIn',
        label: 'Runs in',
        width: 'minmax(0,1.1fr)',
        value: (r) => r.runsIn ?? DASH,
        dim: true,
      },
    ],
    [levels],
  );

  return (
    <div className="h-full flex relative">
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Spacer zone for the parent's floating TOC|Map|List pills; the sheet's
            sticky strip + header pin at the top of the scroll area below it. */}
        <div className="flex-shrink-0 h-[48px]" />
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="px-3 sm:px-4 pb-4">
            {error ? (
              <ErrorMessage className="py-8 text-center">
                Failed to load the product model.
              </ErrorMessage>
            ) : (
              <Sheet
                sheetKey="product-versions"
                rows={rows}
                cols={cols}
                rowKey={(r) => r.id}
                loading={loading}
                unit="versions"
                stickyStrip
                emptyText="No product versions defined yet."
                summarize={(v) =>
                  `${new Set(v.map((r) => r.segment)).size} segments · ${
                    new Set(v.map((r) => `${r.lob}|${r.product}`)).size
                  } products`
                }
                onRowClick={(r) => setSelectedId((prev) => (prev === r.id ? null : r.id))}
                selectedKey={selected?.id ?? null}
              />
            )}
          </div>
        </div>
      </div>

      {/* Right-hand detail sidebar — docked, fixed height, scrolls independently. */}
      {selected && (
        <ProductDetailPanel
          row={selected}
          componentLevelName={caption(5, 'Model Components')}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
