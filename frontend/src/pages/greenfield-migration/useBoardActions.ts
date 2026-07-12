/**
 * useBoardActions — the v3 board interactions (3-B/3-D): approve/hold a
 * normalization entry (PATCH /rationalization/normalization-entries/:id),
 * retire a dead-code finding, and the PM-07 local-patch fallback that applies
 * finding edits directly to fixture-sourced boards until Agent 2's endpoints
 * land. Every mutation goes through a useDialogs confirm.
 */
import { useCallback, useMemo } from 'react';
import { useDialogs } from '../../lib/dialogs';
import type { Domain, Finding, Layer, StageDetail } from '../../lib/rationalization';
import { patchFinding, patchNormalizationEntry, type BoardSource } from './data';
import type { EntryAction } from './normalizeNodes';

export type BoardActionsArgs = {
  detail: StageDetail | null;
  detailSource: BoardSource;
  domain: Domain;
  mutateDetail: (fn: (d: StageDetail) => StageDetail) => void;
  reload: () => void;
};

export function useBoardActions({
  detail,
  detailSource,
  domain,
  mutateDetail,
  reload,
}: BoardActionsArgs) {
  const dialogs = useDialogs();

  const onEntryAction = useCallback(
    async (entryId: string, action: EntryAction) => {
      const entry = detail?.normalizationEntries?.find((e) => e.id === entryId);
      const ok = await dialogs.confirm({
        title: action === 'approve' ? 'Approve this normalization?' : 'Hold this normalization?',
        message: entry
          ? `#${entry.notation} ${entry.name}${entry.proposedResolution ? ` — ${entry.proposedResolution}` : ''}`
          : undefined,
        confirmLabel: action === 'approve' ? 'Approve' : 'Hold',
        danger: action === 'hold',
      });
      if (!ok) return;
      const matchStatus = action === 'approve' ? ('AUTO' as const) : ('HELD' as const);
      if (detailSource === 'fixture') {
        mutateDetail((d) => ({
          ...d,
          normalizationEntries: (d.normalizationEntries ?? []).map((e) =>
            e.id === entryId ? { ...e, matchStatus } : e,
          ),
        }));
        return;
      }
      try {
        await patchNormalizationEntry(entryId, { matchStatus });
        reload();
      } catch (e) {
        await dialogs.alert({ title: 'Could not update', message: (e as Error).message });
      }
    },
    [detail, detailSource, dialogs, mutateDetail, reload],
  );

  const onRetireFinding = useCallback(
    async (findingId: string) => {
      const f = detail?.findings.find((x) => x.id === findingId);
      const ok = await dialogs.confirm({
        title: 'Retire this dead code?',
        message: f ? `${f.name} — unreachable / superseded.` : undefined,
        confirmLabel: 'Retire',
        danger: true,
      });
      if (!ok) return;
      if (detailSource === 'fixture') {
        mutateDetail((d) => ({
          ...d,
          findings: d.findings.map((x) =>
            x.id === findingId ? { ...x, migrationStatus: 'Retired' } : x,
          ),
        }));
        return;
      }
      try {
        await patchFinding(domain, findingId, { migrationStatus: 'Retired' });
        reload();
      } catch (e) {
        await dialogs.alert({ title: 'Could not retire', message: (e as Error).message });
      }
    },
    [detail, detailSource, domain, dialogs, mutateDetail, reload],
  );

  /** PM-07 local fallback: apply a finding patch to a fixture-sourced board. */
  const onLocalPatch = useCallback(
    (findingId: string | null, patch: Partial<Finding>, cell?: { appId: string; layer: Layer }) => {
      mutateDetail((d) => {
        if (findingId)
          return {
            ...d,
            findings: d.findings.map((f) => (f.id === findingId ? { ...f, ...patch } : f)),
          };
        if (!cell) return d;
        const created: Finding = {
          id: `local-${Date.now()}`,
          appId: cell.appId,
          layer: cell.layer,
          category: null,
          view: null,
          screenRef: null,
          plainSummary: null,
          recommendedLayer: null,
          capdan: patch.capdan ?? 'Common',
          targetLayer: null,
          sharedServiceId: null,
          name: patch.name ?? 'New finding',
          codeRef: null,
          migrationApproach: null,
          rationale: null,
          effort: null,
          complexity: null,
          migrationStatus: 'Identified',
          deadCode: false,
          normalizationEntryId: null,
          whyThisMoves: null,
          ...patch,
        };
        return { ...d, findings: [...d.findings, created] };
      });
    },
    [mutateDetail],
  );

  // Stable identity — the board builder memo depends on this object.
  return useMemo(
    () => ({ onEntryAction, onRetireFinding, onLocalPatch }),
    [onEntryAction, onRetireFinding, onLocalPatch],
  );
}
