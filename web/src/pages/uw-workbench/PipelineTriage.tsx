// Pipeline Triage (CAP-12) — the ranked submission queue. KPI strip up top
// (open count, SLA breach risk, appetite mix, pending proposals), then the
// canonical Sheet: triage composite, appetite verdict, clearance state, SLA.
// Bulk decline (IN-appetite rows are skipped server-side) and re-score act on
// the checkbox multi-selection; row click opens the Risk Workspace.
import { useState } from 'react';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { Tile } from '../../components/Tile';
import { Sheet, SheetCell, type SheetCol } from '../../components/Sheet';
import { Button, ErrorMessage, StatusPill } from '../../components/ui';
import { fmt } from '../../lib/format';
import {
  CLOSED_STATUSES,
  errMsg,
  fmtDateTime,
  hoursUntil,
  statusTone,
  verdictTone,
  type AgentAction,
  type PipelineRow,
} from './types';

const DASH = '—';

export default function PipelineTriage({ onOpen }: { onOpen: (id: string) => void }) {
  const dialogs = useDialogs();
  const { data, error, loading, refetch } = useApi<PipelineRow[]>('/uw/submissions');
  const { data: pendingActions } = useApi<AgentAction[]>('/uw/agent-actions?disposition=PENDING');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const rows = data ?? [];
  const open = rows.filter((r) => !CLOSED_STATUSES.includes(r.status));
  const slaRisk = open.filter((r) => {
    const h = hoursUntil(r.slaDueAt);
    return h !== null && h < 4;
  });
  const withVerdict = rows.filter((r) => r.appetiteVerdict);
  const pct = (v: string) =>
    withVerdict.length
      ? Math.round(
          (withVerdict.filter((r) => r.appetiteVerdict === v).length / withVerdict.length) * 100,
        )
      : 0;
  const pendingCount = (pendingActions ?? []).length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function bulkDecline() {
    const reason = await dialogs.prompt({
      title: `Bulk decline ${selected.size} submission(s)`,
      message: 'IN-appetite submissions are skipped server-side — they require individual review.',
      label: 'Decline reason (min 10 characters)',
      placeholder: 'e.g. Capacity exhausted for this segment in the current cycle',
      confirmLabel: 'Decline',
    });
    if (reason === null) return;
    if (reason.length < 10) {
      await dialogs.alert('Decline reason must be at least 10 characters.');
      return;
    }
    setBusy(true);
    try {
      const result = (await api.post('/uw/submissions/bulk-decline', {
        submissionIds: [...selected],
        reason,
      })) as { declined: string[]; skippedInAppetite: string[] };
      const skipped = result.skippedInAppetite;
      await dialogs.alert({
        title: 'Bulk decline complete',
        message:
          `Declined ${result.declined.length}: ${result.declined.join(', ') || 'none'}.` +
          (skipped.length
            ? ` Skipped ${skipped.length} (IN appetite or already closed): ${skipped.join(', ')}.`
            : ''),
      });
      setSelected(new Set());
      refetch();
    } catch (e) {
      await dialogs.alert({ title: 'Bulk decline failed', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function rescore() {
    setBusy(true);
    try {
      const scores = (await api.post('/uw/triage/rescore', {
        submissionIds: [...selected],
      })) as unknown[];
      await dialogs.alert({
        title: 'Re-score complete',
        message: `${scores.length} triage score(s) appended (versioned — prior scores retained).`,
      });
      setSelected(new Set());
      refetch();
    } catch (e) {
      await dialogs.alert({ title: 'Re-score failed', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  const cols: SheetCol<PipelineRow>[] = [
    {
      key: 'sel',
      label: '',
      width: '34px',
      align: 'center',
      hideable: false,
      render: (r) => (
        <input
          type="checkbox"
          className="cursor-pointer accent-[#171717]"
          checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggle(r.id)}
          aria-label={`Select ${r.ref}`}
        />
      ),
    },
    {
      key: 'ref',
      label: 'Submission',
      width: 'minmax(170px,1.2fr)',
      hideable: false,
      value: (r) => `${r.ref} ${r.accountName}`,
      render: (r) => (
        <span className="truncate text-[12px]" title={`${r.ref} — ${r.accountName}`}>
          <span className="font-medium text-[#171717]">{r.ref}</span>
          <span className="text-[#737373]"> · {r.accountName}</span>
        </span>
      ),
    },
    {
      key: 'broker',
      label: 'Broker',
      width: 'minmax(110px,1fr)',
      value: (r) => r.brokerName ?? DASH,
      dim: true,
    },
    { key: 'lob', label: 'LOB', width: '70px', value: (r) => r.lob, align: 'center' },
    {
      key: 'triage',
      label: 'Triage',
      width: '84px',
      hint: 'Latest composite triage score (0–100, versioned weights)',
      align: 'center',
      filterable: false,
      value: (r) => (r.triage ? String(r.triage.composite) : ''),
      render: (r) =>
        r.triage ? (
          <span
            className="text-[12px] font-semibold text-[#171717] tnum"
            title={`weights ${r.triage.weightsVersion}`}
          >
            {r.triage.composite}
          </span>
        ) : (
          <SheetCell text={DASH} dim />
        ),
    },
    {
      key: 'appetite',
      label: 'Appetite',
      width: '92px',
      align: 'center',
      value: (r) => r.appetiteVerdict ?? DASH,
      render: (r) =>
        r.appetiteVerdict ? (
          <StatusPill tone={verdictTone(r.appetiteVerdict)}>{r.appetiteVerdict}</StatusPill>
        ) : (
          <SheetCell text={DASH} dim />
        ),
    },
    {
      key: 'clearance',
      label: 'Clearance',
      width: '92px',
      align: 'center',
      value: (r) => r.clearance,
      render: (r) => (
        <StatusPill tone={r.clearance === 'CLEAR' ? 'green' : 'red'}>{r.clearance}</StatusPill>
      ),
    },
    {
      key: 'sla',
      label: 'SLA due',
      width: '120px',
      filterable: false,
      value: (r) => r.slaDueAt ?? '',
      render: (r) => {
        const h = hoursUntil(r.slaDueAt);
        const cls =
          h === null
            ? 'text-[#737373]'
            : h < 0
              ? 'text-[#be123c] font-medium'
              : h < 4
                ? 'text-[#b45309] font-medium'
                : 'text-[#737373]';
        return <span className={'truncate text-[12px] ' + cls}>{fmtDateTime(r.slaDueAt)}</span>;
      },
    },
    {
      key: 'tiv',
      label: 'TIV',
      width: '90px',
      align: 'right',
      filterable: false,
      value: (r) => (r.tivTotal != null ? String(r.tivTotal) : ''),
      render: (r) => <SheetCell text={fmt.currency(r.tivTotal, { compact: true })} dim />,
    },
    {
      key: 'status',
      label: 'Status',
      width: '110px',
      align: 'center',
      value: (r) => r.status,
      render: (r) => (
        <StatusPill tone={statusTone(r.status)}>{r.status.replaceAll('_', ' ')}</StatusPill>
      ),
    },
  ];

  return (
    <div>
      {error && <ErrorMessage className="mb-3">Failed to load the pipeline: {error}</ErrorMessage>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Tile label="Open submissions" value={loading ? '…' : open.length} />
        <Tile
          label="SLA breach risk (< 4h)"
          value={loading ? '…' : slaRisk.length}
          tone={slaRisk.length > 0 ? 'negative' : 'neutral'}
          hint={
            slaRisk.length
              ? slaRisk
                  .map((r) => r.ref)
                  .slice(0, 4)
                  .join(', ')
              : 'all clocks healthy'
          }
        />
        <Tile
          label="Appetite mix (in / edge / out)"
          value={loading ? '…' : `${pct('IN')} / ${pct('EDGE')} / ${pct('OUT')}%`}
          hint={`${withVerdict.length} evaluated`}
        />
        <Tile
          label="Pending proposals"
          value={pendingCount}
          tone={pendingCount > 0 ? 'negative' : 'neutral'}
          hint="agent proposals awaiting human disposition (ADR-02)"
        />
      </div>

      <Sheet
        sheetKey="uw.pipeline"
        rows={rows}
        cols={cols}
        rowKey={(r) => r.id}
        loading={loading}
        unit="submissions"
        defaultSort={{ col: 'triage', dir: -1 }}
        emptyText="No submissions in the pipeline yet — the starter pack seeds your appetite and authority; submissions arrive via POST /uw/submissions (email, portal, API, or an agent over MCP)."
        onRowClick={(r) => onOpen(r.id)}
        summarize={(v) => `${v.filter((r) => !CLOSED_STATUSES.includes(r.status)).length} open`}
        leading={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="text-xs"
              disabled={selected.size === 0 || busy}
              onClick={rescore}
            >
              Rescore{selected.size ? ` (${selected.size})` : ''}
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              disabled={selected.size === 0 || busy}
              onClick={bulkDecline}
            >
              Bulk decline{selected.size ? ` (${selected.size})` : ''}…
            </Button>
          </div>
        }
      />
    </div>
  );
}
