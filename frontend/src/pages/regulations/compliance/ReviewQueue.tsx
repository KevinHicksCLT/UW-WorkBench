/**
 * Compliance register — review queue. All 4,089 items sorted weakest-grounded
 * first (Low → Medium → High), filterable by sign-off status and confidence,
 * with multi-select bulk actions for identical template task families
 * (bulk-confirm is server-refused for regulation-level items, which require
 * per-item source-row selection).
 */
import { useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../lib/useApi';
import { withCompany } from '../../../lib/portfolio';
import { useDialogs } from '../../../lib/dialogs';
import { Button, EmptyState, ErrorMessage, LoadingState, Select } from '../../../components/ui';
import { ConfidenceBadge, SignOffBadge, type ItemRow } from './shared';

const PAGE_SIZE = 50;

export function ReviewQueue({
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
  const dialogs = useDialogs();
  const [signOff, setSignOff] = useState('PENDING');
  const [confidence, setConfidence] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const params = new URLSearchParams({
    sort: 'queue',
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (signOff) params.set('signOff', signOff);
  if (confidence) params.set('confidence', confidence);
  if (lens) params.set('lens', lens);
  const { data, error, loading, refetch } = useApi<{
    rows: ItemRow[];
    total: number;
  }>(
    withCompany(
      `/regulations/compliance-register/items?${params.toString()}&reload=${reloadKey}`,
      companyId,
    ),
  );

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const bulk = async (action: 'CONFIRM' | 'NEEDS_RESEARCH') => {
    if (selected.size === 0) return;
    const ok = await dialogs.confirm({
      title: `${action === 'CONFIRM' ? 'Confirm' : 'Mark needs-research'} ${selected.size} items?`,
      message:
        action === 'CONFIRM'
          ? 'Only item-level grounded items are confirmed in bulk; regulation-level items are skipped (they require per-item source-row selection).'
          : undefined,
      confirmLabel: action === 'CONFIRM' ? 'Confirm sign-off' : 'Mark needs research',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = (await api.post(
        withCompany('/regulations/compliance-register/items/bulk-sign-off', companyId),
        { itemIds: [...selected], action },
      )) as { updated: number; skipped: number };
      setSelected(new Set());
      refetch();
      onChanged();
      if (result.skipped > 0)
        await dialogs.alert(
          `${result.updated} updated; ${result.skipped} regulation-level items skipped — confirm those individually with source-row selection.`,
        );
    } catch (e) {
      await dialogs.alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Select
          value={signOff}
          onChange={(e) => {
            setSignOff(e.target.value);
            setPage(1);
          }}
          className="max-w-[180px]"
        >
          <option value="PENDING">Pending</option>
          <option value="NEEDS_RESEARCH">Needs research</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All statuses</option>
        </Select>
        <Select
          value={confidence}
          onChange={(e) => {
            setConfidence(e.target.value);
            setPage(1);
          }}
          className="max-w-[160px]"
        >
          <option value="">All confidence</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </Select>
        {data && (
          <span className="text-xs text-[#a3a3a3]">
            {data.total.toLocaleString()} items · weakest grounding first
          </span>
        )}
        {selected.size > 0 && (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs text-[#525252]">{selected.size} selected</span>
            <Button
              className="text-xs px-3 py-1.5"
              disabled={busy}
              onClick={() => void bulk('CONFIRM')}
            >
              Bulk confirm
            </Button>
            <Button
              variant="secondary"
              className="text-xs px-3 py-1.5"
              disabled={busy}
              onClick={() => void bulk('NEEDS_RESEARCH')}
            >
              Needs research
            </Button>
          </span>
        )}
      </div>
      {loading && <LoadingState message="Loading queue…" />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {data && (
        <div className="border border-[#eaeaea] rounded-lg bg-white overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[#a3a3a3] border-b border-[#eaeaea]">
                <th className="px-3 py-2 font-medium w-8" aria-label="Select" />
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Regulation</th>
                <th className="px-3 py-2 font-medium">What must be done</th>
                <th className="px-3 py-2 font-medium">Grounding</th>
                <th className="px-3 py-2 font-medium">Confidence</th>
                <th className="px-3 py-2 font-medium">Sign-off</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((it) => (
                <tr key={it.id} className="border-t border-[#f5f5f5] hover:bg-[#fafafa]">
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={selected.has(it.id)}
                      onChange={(e) => toggle(it.id, e.target.checked)}
                    />
                  </td>
                  <td
                    className="px-3 py-1.5 whitespace-nowrap font-mono text-[12px] text-[#2563eb] cursor-pointer hover:underline"
                    onClick={() => onOpenItem(it.id)}
                  >
                    {it.itemCode}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{it.regulation?.name}</td>
                  <td className="px-3 py-1.5 cursor-pointer" onClick={() => onOpenItem(it.id)}>
                    {it.name}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {it.groundingBasis === 'ITEM'
                      ? `Item-level (${it.supportingReqRows.toLocaleString()} rows)`
                      : 'Regulation-level'}
                  </td>
                  <td className="px-3 py-1.5">
                    <ConfidenceBadge confidence={it.confidence} />
                  </td>
                  <td className="px-3 py-1.5">
                    <SignOffBadge signOff={it.signOff} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length === 0 && (
            <div className="p-4">
              <EmptyState message="No items match the current filters." />
            </div>
          )}
          <div className="flex items-center justify-between px-3 py-2 border-t border-[#eaeaea] text-xs text-[#525252]">
            <span>
              Page {page} of {totalPages}
            </span>
            <span className="flex gap-2">
              <Button
                variant="secondary"
                className="text-xs px-2 py-1"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                className="text-xs px-2 py-1"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
