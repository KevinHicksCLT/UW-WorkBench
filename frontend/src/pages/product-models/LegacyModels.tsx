import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { Sheet, SheetCell, type SheetCol } from '../../components/Sheet';
import { ErrorMessage, StatusPill } from '../../components/ui';
import LegacyModelDrawer from './LegacyModelDrawer';
import {
  dispositionTone,
  summarizeModels,
  workspaceNames,
  type LegacyProductModel,
} from './legacyModelList';

// LegacyModels — the Legacy product-model master list (plan §5 D-1), the fifth
// view of the /product-models tab (`?view=legacy`). One row per
// LegacyProductModel from GET /product-models, rendered in the canonical Sheet
// format; row click opens LegacyModelDrawer; `?focus=<id>` deep-links to a row
// (highlighted + scrolled into view, same contract as /applications).

const DASH = '—';

const cols: SheetCol<LegacyProductModel>[] = [
  { key: 'name', label: 'Legacy model', width: 'minmax(0,1.4fr)', value: (m) => m.name },
  {
    key: 'sourceSystem',
    label: 'Source system',
    width: 'minmax(0,1.1fr)',
    value: (m) => m.sourceSystem ?? DASH,
    dim: true,
  },
  { key: 'segment', label: 'Segment', width: '130px', value: (m) => m.segment ?? DASH, dim: true },
  {
    key: 'geography',
    label: 'Geography',
    width: '120px',
    value: (m) => m.geography ?? DASH,
    dim: true,
  },
  {
    key: 'disposition',
    label: 'Disposition',
    width: '120px',
    value: (m) => m.disposition ?? DASH,
    align: 'center',
    render: (m) =>
      m.disposition ? (
        <StatusPill tone={dispositionTone(m.disposition)}>{m.disposition}</StatusPill>
      ) : (
        <SheetCell text={DASH} dim />
      ),
  },
  {
    key: 'workspaces',
    label: 'Workspaces',
    width: 'minmax(0,1fr)',
    values: workspaceNames,
    dim: true,
  },
  {
    key: 'findings',
    label: 'Findings',
    width: '90px',
    value: (m) => String(m.findingCount),
    filterable: false,
    align: 'center',
    render: (m) => <SheetCell text={String(m.findingCount)} dim />,
  },
];

export default function LegacyModels({ leading }: { leading?: ReactNode }) {
  const { data, error, loading } = useApi<{ productModels: LegacyProductModel[] }>(
    '/product-models',
  );
  const [params] = useSearchParams();
  const focusId = params.get('focus');
  const models = data?.productModels ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? (models.find((m) => m.id === openId) ?? null) : null;

  return (
    <>
      {error && (
        <ErrorMessage baseClassName="text-sm text-red-600 mb-3">
          Failed to load legacy product models.
        </ErrorMessage>
      )}
      <Sheet
        sheetKey="product-models.legacy"
        rows={models}
        cols={cols}
        rowKey={(m) => m.id}
        loading={loading}
        scrollToKey={focusId}
        selectedKey={openId}
        unit="legacy models"
        leading={leading}
        onRowClick={(m) => setOpenId(m.id)}
        summarize={summarizeModels}
      />
      {open && <LegacyModelDrawer model={open} onClose={() => setOpenId(null)} />}
    </>
  );
}
