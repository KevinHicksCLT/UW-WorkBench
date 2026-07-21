/**
 * Compliance register — "By regulation" view. The L1 table (538 regulations
 * with child counts); a row expands to its L2 compliance items
 * (confidence-badged, click → detail drawer) and the regulation's
 * jurisdiction deadline variants with the promote action.
 */
import { Fragment, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../lib/useApi';
import { withCompany } from '../../../lib/portfolio';
import { useDialogs } from '../../../lib/dialogs';
import {
  Button,
  EmptyState,
  ErrorMessage,
  Input,
  LoadingState,
  Select,
  StatusPill,
} from '../../../components/ui';
import { catLabel, flagLabel } from '../Regulations';
import { ConfidenceBadge, type ItemRow, type RegulationRow, type VariantRow } from './shared';

/** "PRODUCT_FILING, LICENSING" → "Product filing, Licensing". */
const categoryLabels = (raw: string) =>
  raw
    .split(',')
    .map((c) => catLabel(c.trim()))
    .join(', ');

/** "ALL, LIFE, NON_LIFE" → "All lines, Life, Non life". */
const lobLabels = (raw: string) =>
  raw
    .split(',')
    .map((t) => (t.trim() === 'ALL' ? 'All lines' : flagLabel(t.trim())))
    .join(', ');

type RegDetail = RegulationRow & { items: ItemRow[]; variants: VariantRow[] };

function RegulationDetailPanel({
  regulationId,
  companyId,
  onOpenItem,
  onChanged,
  reloadKey,
}: {
  regulationId: string;
  companyId: string | null;
  onOpenItem: (id: string) => void;
  onChanged: () => void;
  reloadKey: number;
}) {
  const dialogs = useDialogs();
  const { data, error, loading, refetch } = useApi<RegDetail>(
    withCompany(
      `/regulations/compliance-register/regulations/${regulationId}?reload=${reloadKey}`,
      companyId,
    ),
  );
  const promote = async (variant: VariantRow) => {
    const ok = await dialogs.confirm({
      title: `Promote ${variant.jurisdiction} variant to a compliance item?`,
      message: `Creates a bespoke, pre-filled compliance item for "${variant.deadlineVariant}".`,
      confirmLabel: 'Promote',
    });
    if (!ok) return;
    try {
      await api.post(
        withCompany(`/regulations/compliance-register/variants/${variant.id}/promote`, companyId),
      );
      refetch();
      onChanged();
    } catch (e) {
      await dialogs.alert((e as Error).message);
    }
  };

  if (loading) return <LoadingState message="Loading compliance items…" />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!data) return null;
  return (
    <div className="pl-6 pb-3">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-[#a3a3a3]">
            <th className="py-1 pr-3 font-medium">Item</th>
            <th className="py-1 pr-3 font-medium">What must be done</th>
            <th className="py-1 pr-3 font-medium">Owner</th>
            <th className="py-1 pr-3 font-medium">Frequency</th>
            <th className="py-1 pr-3 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it) => (
            <tr
              key={it.id}
              className="border-t border-[#f5f5f5] hover:bg-[#fafafa] cursor-pointer"
              onClick={() => onOpenItem(it.id)}
            >
              <td className="py-1.5 pr-3 whitespace-nowrap font-mono text-[12px]">{it.itemCode}</td>
              <td className="py-1.5 pr-3">{it.name}</td>
              <td className="py-1.5 pr-3 whitespace-nowrap">{it.ownerTeam}</td>
              <td className="py-1.5 pr-3 whitespace-nowrap">{it.frequency}</td>
              <td className="py-1.5 pr-3">
                <ConfidenceBadge confidence={it.confidence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.variants.length > 0 && (
        <div className="mt-2 border-t border-[#eaeaea] pt-2">
          <div className="text-[11px] uppercase tracking-wide text-[#a3a3a3] mb-1">
            Jurisdiction deadline variants ({data.variants.length})
          </div>
          <ul className="space-y-1 text-[13px]">
            {data.variants.map((v) => (
              <li key={v.id} className="flex items-center gap-2 flex-wrap">
                <StatusPill tone="blue">{v.deadlineVariant}</StatusPill>
                <span className="min-w-0">
                  {v.jurisdiction} — {v.requirementTitle}{' '}
                  <span className="text-[#a3a3a3]">({v.citation})</span>
                </span>
                {v.promotedItem ? (
                  <button
                    type="button"
                    className="text-[#2563eb] hover:underline text-[12px]"
                    onClick={() => v.promotedItem && onOpenItem(v.promotedItem.id)}
                  >
                    Promoted → {v.promotedItem.itemCode}
                  </button>
                ) : (
                  <Button
                    variant="secondary"
                    className="text-[11px] px-2 py-0.5"
                    onClick={() => void promote(v)}
                  >
                    Promote to compliance item
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RegulationBrowser({
  companyId,
  lens,
  onOpenItem,
  onChanged,
  reloadKey,
}: {
  companyId: string | null;
  lens: string;
  onOpenItem: (id: string) => void;
  onChanged: () => void;
  reloadKey: number;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, error, loading } = useApi<{ rows: RegulationRow[] }>(
    withCompany(
      `/regulations/compliance-register/regulations?reload=${reloadKey}${lens ? `&lens=${lens}` : ''}`,
      companyId,
    ),
  );

  // Multi-category regulations carry comma-joined lists — filter on the
  // individual tokens, not the raw combined strings.
  const categories = useMemo(
    () =>
      [
        ...new Set((data?.rows ?? []).flatMap((r) => r.category.split(',').map((c) => c.trim()))),
      ].sort(),
    [data],
  );
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows ?? []).filter(
      (r) =>
        (!category ||
          r.category
            .split(',')
            .map((c) => c.trim())
            .includes(category)) &&
        (!q || r.name.toLowerCase().includes(q) || r.regCode.toLowerCase().includes(q)),
    );
  }, [data, search, category]);

  if (loading) return <LoadingState message="Loading regulations…" />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search regulation or REG-###…"
          className="max-w-xs"
        />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="max-w-xs">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {catLabel(c)}
            </option>
          ))}
        </Select>
        <span className="text-xs text-[#a3a3a3]">
          {rows.length} of {(data?.rows ?? []).length} regulations
          {lens ? ` in the ${lens} lens` : ''}
        </span>
      </div>
      <div className="border border-[#eaeaea] rounded-lg bg-white overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[#a3a3a3] border-b border-[#eaeaea]">
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Regulation / program</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium text-right">Items</th>
              <th className="px-3 py-2 font-medium text-right">Source rows</th>
              <th className="px-3 py-2 font-medium">Frequency</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr
                  className="border-t border-[#f5f5f5] hover:bg-[#fafafa] cursor-pointer align-top"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-[12px]">
                    <span className="inline-block w-3 text-[#a3a3a3]">
                      {expanded === r.id ? '▾' : '▸'}
                    </span>
                    {r.regCode}
                  </td>
                  <td className="px-3 py-2 max-w-xl">
                    <div className="font-medium text-[#171717]">{r.name}</div>
                    <div className="text-[12px] text-[#737373] mt-0.5">
                      {r.representativeRequirement}
                    </div>
                    <div className="text-[11px] text-[#a3a3a3] mt-0.5">
                      {[
                        lobLabels(r.lineOfBusiness),
                        `Impacts: ${
                          [
                            r.productImpact && 'Product',
                            r.processImpact && 'Process',
                            r.systemImpact && 'System',
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'None recorded'
                        }`,
                        `Evidence: ${r.evidenceRequired}`,
                        r.dueDate !== 'Not Yet Determined' ? `Due: ${r.dueDate}` : null,
                      ]
                        .filter(Boolean)
                        .join('  ·  ')}
                    </div>
                  </td>
                  <td className="px-3 py-2 max-w-[220px]">{categoryLabels(r.category)}</td>
                  <td className="px-3 py-2">{r.ownerTeam}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.itemCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.requirementRowCount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.frequency}</td>
                </tr>
                {expanded === r.id && (
                  <tr>
                    <td colSpan={7} className="bg-[#fafafa]">
                      <RegulationDetailPanel
                        regulationId={r.id}
                        companyId={companyId}
                        onOpenItem={onOpenItem}
                        onChanged={onChanged}
                        reloadKey={reloadKey}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-4">
            <EmptyState message="No regulations match the current filters." />
          </div>
        )}
      </div>
    </div>
  );
}
