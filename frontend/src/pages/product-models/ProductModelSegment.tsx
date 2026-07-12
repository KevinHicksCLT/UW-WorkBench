// Product-model segment detail — drill target from the Product Models TOC
// (mirrors the application-kind page). Shows every legacy product model of one
// segment grouped by geography; clicking a model opens its detail drawer in
// place.
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import PageHeader from '../../components/PageHeader';
import { ListSearch } from '../../components/Sheet';
import {
  BackButton,
  Card,
  EmptyState,
  ErrorMessage,
  LoadingState,
  StatusPill,
} from '../../components/ui';
import ProductModelDrawer, { DISPOSITION_TONE, type ProductModel } from './ProductModelDrawer';

const UNSEGMENTED = 'Unsegmented';

export default function ProductModelSegment() {
  const { segment } = useParams();
  const segmentName = segment ? decodeURIComponent(segment) : '';
  const { data, error, loading } = useApi<{ productModels: ProductModel[] }>('/product-models');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<ProductModel | null>(null);

  const models = useMemo(() => {
    const all = (data?.productModels ?? []).filter(
      (m) => (m.segment ?? UNSEGMENTED) === segmentName,
    );
    const needle = q.trim().toLowerCase();
    return needle
      ? all.filter(
          (m) =>
            m.name.toLowerCase().includes(needle) ||
            (m.sourceSystem ?? '').toLowerCase().includes(needle) ||
            (m.geography ?? '').toLowerCase().includes(needle) ||
            (m.disposition ?? '').toLowerCase().includes(needle),
        )
      : all;
  }, [data, segmentName, q]);

  const groups = useMemo(() => {
    const byGeo = new Map<string, ProductModel[]>();
    for (const m of models) {
      const geo = m.geography ?? 'Global';
      (byGeo.get(geo) ?? byGeo.set(geo, []).get(geo)!).push(m);
    }
    return [...byGeo.entries()]
      .map(([geography, rows]) => ({
        geography,
        rows: rows.sort((x, y) => x.name.localeCompare(y.name)),
      }))
      .sort((x, y) => x.geography.localeCompare(y.geography));
  }, [models]);

  if (loading)
    return <LoadingState baseClassName="text-slate-500" message="Loading product models…" />;
  if (error)
    return <ErrorMessage baseClassName="text-red-600">Failed to load product models.</ErrorMessage>;

  const findings = models.reduce((n, m) => n + m.findingCount, 0);
  const onBoards = models.filter((m) => m.workspaces.length > 0).length;

  return (
    <div>
      <BackButton className="mb-3" />
      <PageHeader
        eyebrow="Product-model segment"
        title={segmentName}
        subtitle={[
          `${models.length} product model${models.length === 1 ? '' : 's'}`,
          onBoards ? `${onBoards} on a workspace board` : null,
          findings ? `${findings} finding${findings === 1 ? '' : 's'}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      <div className="flex items-center justify-end pb-2">
        <ListSearch value={q} onChange={setQ} placeholder="Search model, source system…" />
      </div>

      {groups.length === 0 ? (
        <EmptyState message="No product models in this segment." />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.geography} className="overflow-hidden p-0">
              <div className="px-4 py-2 border-b border-[#eaeaea] flex items-baseline gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-[#525252]">
                  {g.geography}
                </span>
                <span className="text-[11px] text-[#a3a3a3] tnum">{g.rows.length}</span>
              </div>
              {g.rows.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m)}
                  className="w-full text-left flex items-center gap-3 px-4 py-2 border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors duration-150"
                >
                  <span className="flex-1 min-w-0 text-sm text-[#171717] font-medium truncate">
                    {m.name}
                  </span>
                  {m.disposition && (
                    <StatusPill
                      tone={DISPOSITION_TONE[m.disposition] ?? 'slate'}
                      className="hidden sm:inline-flex flex-shrink-0"
                    >
                      {m.disposition}
                    </StatusPill>
                  )}
                  <span className="hidden md:inline text-[11px] text-[#737373] truncate max-w-[180px]">
                    {m.sourceSystem ?? '—'}
                  </span>
                  <span className="w-20 text-right text-[12px] tnum text-[#525252] flex-shrink-0">
                    {m.findingCount ? `${m.findingCount} findings` : '—'}
                  </span>
                </button>
              ))}
            </Card>
          ))}
        </div>
      )}

      {selected && <ProductModelDrawer model={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
