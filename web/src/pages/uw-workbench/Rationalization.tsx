// Cross-Estate Rationalization (CAP-14) — the divergence inventory. Rows expand
// to an impact preview (affected submissions / roles / PAS bindings) which must
// be generated AND acknowledged before merge / retire / keep-both can be
// actioned; the action itself is CUO-gated (INV-6). Losing artifacts are
// tombstoned (RETIRED), never deleted.
import { useState } from 'react';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { Sheet, type SheetCol } from '../../components/Sheet';
import { Button, ErrorMessage, StatusPill } from '../../components/ui';
import { errMsg, type DivergencePair, type ImpactPreview } from './types';

const DASH = '—';

const sideCell = (ref: string, estate: string | null) => (
  <span className="truncate text-[12px]">
    <span className="font-medium text-[#171717]">{ref}</span>
    {estate && <span className="text-[#737373]"> · {estate}</span>}
  </span>
);

export default function Rationalization() {
  const dialogs = useDialogs();
  const { data, error, loading, refetch } = useApi<DivergencePair[]>(
    '/uw/rationalization/divergence',
  );
  const [impacts, setImpacts] = useState<Record<string, ImpactPreview>>({});
  const [busy, setBusy] = useState(false);

  async function loadImpact(pair: DivergencePair) {
    setBusy(true);
    try {
      const impact = await api.get<ImpactPreview>(
        `/uw/rationalization/divergence/${pair.id}/impact`,
      );
      setImpacts((m) => ({ ...m, [pair.id]: impact }));
    } catch (e) {
      await dialogs.alert({ title: 'Impact preview failed', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function actionPair(pair: DivergencePair, action: 'merge' | 'retire' | 'keep-both') {
    const impact = impacts[pair.id];
    if (!impact) return;
    const ok = await dialogs.confirm({
      title: `${action.toUpperCase()} ${pair.ref}?`,
      message:
        `Impact preview — ${impact.submissionsAffected} open submission(s), ${impact.rolesAffected} role(s), ` +
        `${impact.pasBindingsAffected} PAS binding(s) affected. ` +
        (action === 'keep-both'
          ? 'Both artifacts stay active.'
          : `The losing artifact (${pair.rightRef}) is tombstoned as RETIRED — never deleted.`) +
        ' Proceeding acknowledges this preview (INV-6).',
      confirmLabel: 'Acknowledge & continue',
      danger: action !== 'keep-both',
    });
    if (!ok) return;
    const note = await dialogs.prompt({
      title: `Action note — ${action} ${pair.ref}`,
      label: 'Note (min 10 characters)',
      placeholder: 'Why this resolution — recorded on the governance spine',
      confirmLabel: 'Action pair',
    });
    if (note === null) return;
    if (note.length < 10) {
      await dialogs.alert('Action note must be at least 10 characters.');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/uw/rationalization/divergence/${pair.id}/action`, {
        action,
        impactPreviewAck: true,
        note,
      });
      refetch();
    } catch (e) {
      await dialogs.alert({ title: 'Action blocked (INV-6 — CUO gate)', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  const cols: SheetCol<DivergencePair>[] = [
    { key: 'ref', label: 'Ref', width: '76px', hideable: false, value: (p) => p.ref },
    { key: 'kind', label: 'Kind', width: '100px', align: 'center', value: (p) => p.kind },
    {
      key: 'left',
      label: 'Left artifact',
      width: 'minmax(150px,1fr)',
      value: (p) => `${p.leftRef}${p.leftEstate ? ` ${p.leftEstate}` : ''}`,
      render: (p) => sideCell(p.leftRef, p.leftEstate),
    },
    {
      key: 'right',
      label: 'Right artifact',
      width: 'minmax(150px,1fr)',
      value: (p) => `${p.rightRef}${p.rightEstate ? ` ${p.rightEstate}` : ''}`,
      render: (p) => sideCell(p.rightRef, p.rightEstate),
    },
    {
      key: 'weight',
      label: 'Weight',
      width: '80px',
      align: 'center',
      hint: '1 − similarity: lower = closer to a pure duplicate',
      filterable: false,
      value: (p) => String(p.weight),
      render: (p) => (
        <span
          className={
            'tnum text-[12px] font-medium ' + (p.weight < 0.2 ? 'text-[#be123c]' : 'text-[#171717]')
          }
        >
          {p.weight.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'proposal',
      label: 'Proposal',
      width: '150px',
      value: (p) => p.proposal ?? DASH,
      dim: true,
    },
    {
      key: 'status',
      label: 'Status',
      width: '104px',
      align: 'center',
      value: (p) => p.status,
      render: (p) => (
        <StatusPill tone={p.status === 'OPEN' ? 'amber' : 'slate'}>
          {p.status.replaceAll('_', ' ')}
        </StatusPill>
      ),
    },
  ];

  return (
    <div>
      {error && (
        <ErrorMessage className="mb-3">Failed to load divergence pairs: {error}</ErrorMessage>
      )}
      <p className="text-[11px] text-[#737373] mb-3">
        Merge / retire / keep-both requires an acknowledged impact preview and the CUO role (INV-6)
        · losing artifacts are tombstoned, never deleted
      </p>
      <Sheet
        sheetKey="uw.rationalization"
        rows={data ?? []}
        cols={cols}
        rowKey={(p) => p.id}
        loading={loading}
        unit="pairs"
        defaultSort={{ col: 'weight', dir: 1 }}
        emptyText="No divergence pairs detected."
        summarize={(v) => `${v.filter((p) => p.status === 'OPEN').length} open`}
        expand={(p) => {
          const impact = impacts[p.id];
          return (
            <div className="text-[12px]">
              {impact ? (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[#525252]">
                  <span className="font-semibold text-[#171717]">Impact preview</span>
                  <span>
                    <span className="tnum font-medium text-[#171717]">
                      {impact.submissionsAffected}
                    </span>{' '}
                    open submissions
                  </span>
                  <span>
                    <span className="tnum font-medium text-[#171717]">{impact.rolesAffected}</span>{' '}
                    roles
                  </span>
                  <span>
                    <span className="tnum font-medium text-[#171717]">
                      {impact.pasBindingsAffected}
                    </span>{' '}
                    PAS bindings
                  </span>
                </div>
              ) : (
                <span className="text-[#737373]">
                  Generate the impact preview before actioning this pair (INV-6).
                </span>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="text-xs"
                  disabled={busy}
                  onClick={() => loadImpact(p)}
                >
                  {impact ? 'Refresh impact preview' : 'Impact preview'}
                </Button>
                {p.status === 'OPEN' && (
                  <>
                    <Button
                      className="text-xs"
                      disabled={busy || !impact}
                      onClick={() => actionPair(p, 'merge')}
                    >
                      Merge
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-xs"
                      disabled={busy || !impact}
                      onClick={() => actionPair(p, 'retire')}
                    >
                      Retire
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-xs"
                      disabled={busy || !impact}
                      onClick={() => actionPair(p, 'keep-both')}
                    >
                      Keep both
                    </Button>
                  </>
                )}
                {p.status !== 'OPEN' && p.actionedBy && (
                  <span className="self-center text-[#737373]">
                    Actioned by {p.actionedBy}
                    {p.actionNote ? ` — ${p.actionNote}` : ''}
                  </span>
                )}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
