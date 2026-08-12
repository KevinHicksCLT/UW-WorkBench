import { useState } from 'react';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import {
  Button,
  Chip,
  DrawerShell,
  ErrorMessage,
  Label,
  Select,
  StatusPill,
  type PillTone,
} from '../../components/ui';
import type { Finding, MatrixColumn, MatrixRow } from './types';

// Cluster drill-down drawer: representative wording, per-form cells, the
// cluster's findings with one-at-a-time accept/reject (needs-human is never
// bulk-cleared — FORMS-LLR-012), disposition proposal, and preferred-wording
// selection (ISO-flagged sources are rejected server-side, ADR-005).

const FINDING_TONE: Record<string, PillTone> = {
  'needs-human': 'amber',
  new: 'blue',
  accepted: 'green',
  rejected: 'red',
  superseded: 'slate',
};

export function ClusterDrawer({
  row,
  columns,
  workingSetId,
  onClose,
  onChanged,
}: {
  row: MatrixRow;
  columns: MatrixColumn[];
  workingSetId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data: findings, refetch: refetchFindings } = useApi<Finding[]>(
    `/forms/findings?workingSetId=${workingSetId}`,
  );
  const dialogs = useDialogs();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [dispType, setDispType] = useState('keep');
  const clusterFindings = (findings ?? []).filter((f) => f.clusterId === row.clusterId);

  const decide = async (findingId: string, decision: 'accepted' | 'rejected') => {
    setBusy(findingId);
    setErr('');
    try {
      await api.post(`/forms/findings/${findingId}/decide`, { decision });
      refetchFindings();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Decision failed');
    } finally {
      setBusy('');
    }
  };

  const propose = async () => {
    const rationale = await dialogs.prompt({
      title: `Propose: ${dispType} this cluster`,
      label: 'Rationale',
    });
    if (rationale === null) return;
    setBusy('disposition');
    setErr('');
    try {
      await api.post('/forms/dispositions', {
        subjectKind: 'cluster',
        clusterId: row.clusterId,
        type: dispType,
        rationale: rationale || undefined,
      });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Disposition failed');
    } finally {
      setBusy('');
    }
  };

  const setPreferred = async (clauseId: string) => {
    const ok = await dialogs.confirm({
      title: 'Set preferred wording',
      message: 'Make this clause the surviving standard for the cluster?',
    });
    if (!ok) return;
    setBusy('preferred');
    setErr('');
    try {
      await api.post(`/forms/clusters/${row.clusterId}/preferred-wording`, {
        sourceClauseId: clauseId,
      });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to set preferred wording');
    } finally {
      setBusy('');
    }
  };

  return (
    <DrawerShell
      onClose={onClose}
      width={680}
      maxWidth="94vw"
      header={
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">
            Clause cluster · {row.memberCount} members · divergence{' '}
            {(row.divergenceScore * 100).toFixed(1)}%
          </div>
          <h2 className="text-[16px] font-bold text-[#171717] leading-snug">{row.label}</h2>
        </div>
      }
    >
      <div className="space-y-5">
        {row.representativeText && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">
              Representative wording {row.hasPreferredWording && <Chip>★ preferred set</Chip>}
            </div>
            <div className="border border-[#eaeaea] rounded-md p-3 text-[13px] text-[#404040] whitespace-pre-wrap">
              {row.representativeText}
            </div>
          </div>
        )}

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">
            Per-form state
          </div>
          <div className="space-y-1">
            {columns.map((col) => {
              const cell = row.cells[col.id];
              if (!cell || cell.state === 'absent') return null;
              return (
                <div key={col.id} className="flex items-center gap-2 text-[13px]">
                  <span className="font-medium w-24 flex-shrink-0">{col.form.formNumber}</span>
                  <CellStateBadge state={cell.state} outlier={cell.outlier} />
                  <span className="text-[#a3a3a3] text-[12px]">
                    {(cell.similarity * 100).toFixed(0)}% similar
                  </span>
                  {cell.clauseId && cell.state !== 'identical' && (
                    <button
                      className="text-[12px] text-[#0070AD] hover:underline disabled:opacity-50"
                      disabled={busy === 'preferred'}
                      onClick={() => setPreferred(cell.clauseId as string)}
                    >
                      set as preferred
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">
            Findings ({clusterFindings.length})
          </div>
          {clusterFindings.length === 0 ? (
            <div className="text-[13px] text-[#a3a3a3] italic">
              No findings — run clustering to generate recommendations.
            </div>
          ) : (
            <div className="space-y-2">
              {clusterFindings.map((f) => (
                <div key={f.id} className="border border-[#eaeaea] rounded-md p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <StatusPill tone={FINDING_TONE[f.status] ?? 'slate'}>{f.status}</StatusPill>
                    <span className="text-[11px] text-[#a3a3a3]">
                      confidence {(f.confidence * 100).toFixed(0)}% · {f.agentSkill}
                    </span>
                  </div>
                  <div className="text-[13px] text-[#404040] mb-2">{f.claim}</div>
                  <div className="text-[11px] text-[#a3a3a3] mb-2">
                    {f.citations.length} citation(s) — every claim is grounded in clause text
                  </div>
                  {(f.status === 'new' || f.status === 'needs-human') && (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="!py-1 !px-2.5 text-[12px]"
                        disabled={busy === f.id}
                        onClick={() => decide(f.id, 'accepted')}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="ghost"
                        className="!py-1 !px-2.5 text-[12px]"
                        disabled={busy === f.id}
                        onClick={() => decide(f.id, 'rejected')}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-[#eaeaea]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">
            Disposition
          </div>
          {row.dispositions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {row.dispositions.map((d) => (
                <Chip key={d.id}>
                  {d.type} · {d.status}
                </Chip>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <div>
              <Label>Decision</Label>
              <Select value={dispType} onChange={(e) => setDispType(e.target.value)}>
                <option value="keep">Keep</option>
                <option value="merge">Merge into…</option>
                <option value="retire">Retire</option>
                <option value="redraft">Redraft</option>
              </Select>
            </div>
            <Button disabled={busy === 'disposition' || dispType === 'merge'} onClick={propose}>
              Propose
            </Button>
          </div>
          {dispType === 'merge' && (
            <div className="text-[11px] text-[#a3a3a3] mt-1">
              Merge targets a form — propose it from the Library form drawer.
            </div>
          )}
        </div>

        {err && <ErrorMessage>{err}</ErrorMessage>}
      </div>
    </DrawerShell>
  );
}

// Glyph + label + colour per state — never colour-only (FORMS-LLR-006 / WCAG).
export const CELL_STATE_META: Record<
  string,
  { glyph: string; label: string; bg: string; text: string }
> = {
  identical: { glyph: '●', label: 'Identical', bg: '#ecfdf5', text: '#047857' },
  near: { glyph: '◕', label: 'Near-identical', bg: '#eff6ff', text: '#1d4ed8' },
  divergent: { glyph: '◑', label: 'Divergent', bg: '#fffbeb', text: '#b45309' },
  unique: { glyph: '◇', label: 'Unique', bg: '#f5f3ff', text: '#6d28d9' },
  absent: { glyph: '·', label: 'Absent', bg: 'transparent', text: '#d4d4d4' },
};

export function CellStateBadge({ state, outlier }: { state: string; outlier?: boolean }) {
  const meta = CELL_STATE_META[state] ?? CELL_STATE_META.absent;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
      style={{ background: meta.bg, color: meta.text }}
    >
      <span aria-hidden>{meta.glyph}</span>
      {meta.label}
      {outlier && <span title="Outlier — verify membership">⚠</span>}
    </span>
  );
}
