// Risk Workspace (CAP-06, LLR-07) — desk mode for one submission: evidence
// with per-field confidence + provenance, risk objects + enrichment, clearance
// (incl. the INV-4 dual-control watchlist release), the latest triage lenses,
// then the interactive panels (proposals / decision / referrals / quote & bind)
// from WorkspacePanels.tsx.
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { fmt } from '../../lib/format';
import {
  Button,
  Chip,
  EmptyState,
  ErrorMessage,
  LoadingState,
  StatusPill,
} from '../../components/ui';
import {
  errMsg,
  fmtDateTime,
  statusTone,
  verdictTone,
  type ClearanceCheck,
  type SubmissionDetail,
} from './types';
import { DecisionPanel, Panel, ProposalsPanel, ReferralsPanel } from './WorkspacePanels';
import { QuoteBindPanel } from './QuoteBindPanel';

const CONFIDENCE_FLOOR = 0.7; // LLR-01 — below this a field is an exception, never silently used

export default function RiskWorkspace({
  submissionId,
  onBack,
}: {
  submissionId: string;
  onBack: () => void;
}) {
  const dialogs = useDialogs();
  const { data, error, loading, refetch } = useApi<SubmissionDetail>(
    `/uw/submissions/${submissionId}`,
  );

  async function enrich(riskObjectId: string) {
    try {
      const res = (await api.post(`/uw/risk-objects/${riskObjectId}/enrich`)) as {
        fetched: unknown[];
        skipped: { source: string; reason: string }[];
      };
      await dialogs.alert({
        title: 'Enrichment run complete',
        message:
          `${res.fetched.length} record(s) fetched.` +
          (res.skipped.length
            ? ` Skipped: ${res.skipped.map((s) => `${s.source} (${s.reason})`).join('; ')}.`
            : ''),
      });
      refetch();
    } catch (e) {
      await dialogs.alert({ title: 'Enrichment failed', message: errMsg(e) });
    }
  }

  async function release(check: ClearanceCheck) {
    const note = await dialogs.prompt({
      title: 'Dual-control release — watchlist hit',
      message:
        'Two signatures from DISTINCT roles are required (INV-4). Each signature lands on the governance spine.',
      label: 'Release note (min 5 characters)',
      confirmLabel: 'Sign release',
    });
    if (note === null) return;
    if (note.length < 5) {
      await dialogs.alert('Release note must be at least 5 characters.');
      return;
    }
    try {
      const res = (await api.post(`/uw/clearance/${check.id}/release`, { note })) as {
        releaseState: 'AWAITING_SECOND_SIGNATURE' | 'RELEASED';
      };
      await dialogs.alert({
        title: res.releaseState === 'RELEASED' ? 'Hold released' : 'First signature recorded',
        message:
          res.releaseState === 'RELEASED'
            ? 'Second signature accepted from a distinct role — the watchlist hold is released.'
            : 'Awaiting a second signature from a DISTINCT role (INV-4).',
      });
      refetch();
    } catch (e) {
      await dialogs.alert({ title: 'Release blocked (INV-4)', message: errMsg(e) });
    }
  }

  if (loading) return <LoadingState />;
  if (error || !data)
    return (
      <div>
        <ErrorMessage className="mb-3">
          Failed to load the submission: {error || 'not found'}
        </ErrorMessage>
        <Button variant="secondary" className="text-xs" onClick={onBack}>
          ← Back to Pipeline
        </Button>
      </div>
    );

  const s = data;
  const fields = s.extractedFields ?? [];
  const latestScore = s.triageScores[0] ?? null;

  return (
    <div className="space-y-4">
      {/* ── Desk header ─────────────────────────────────────────────────── */}
      <Panel
        title={`${s.ref} — ${s.account.name}`}
        badge={<StatusPill tone={statusTone(s.status)}>{s.status.replaceAll('_', ' ')}</StatusPill>}
        actions={
          <Button variant="secondary" className="text-xs" onClick={onBack}>
            ← Pipeline
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[#525252]">
          <span>
            LOB <span className="font-medium text-[#171717]">{s.lob}</span>
          </span>
          <span>
            TIV{' '}
            <span className="font-medium text-[#171717]">
              {fmt.currency(s.tivTotal, { compact: true })}
            </span>
          </span>
          <span>
            Broker <span className="font-medium text-[#171717]">{s.brokerName ?? '—'}</span>
          </span>
          <span>
            SLA <span className="font-medium text-[#171717]">{fmtDateTime(s.slaDueAt)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            Appetite{' '}
            {s.appetiteVerdict ? (
              <StatusPill tone={verdictTone(s.appetiteVerdict)}>{s.appetiteVerdict}</StatusPill>
            ) : (
              <span className="text-[#a3a3a3]">no statement</span>
            )}
          </span>
          {(s.appetiteCitations ?? []).map((c) => (
            <Chip key={`${c.ref}-${c.version}`} title={`stance ${c.stance}`}>
              cites {c.ref} v{c.version}
            </Chip>
          ))}
        </div>
        {s.description && <p className="mt-2 text-[12px] text-[#737373]">{s.description}</p>}
      </Panel>

      {/* ── Evidence (LLR-01) ───────────────────────────────────────────── */}
      <Panel
        title="Evidence"
        badge={
          s.extractionExceptions > 0 ? (
            <StatusPill tone="amber">{`${s.extractionExceptions} exception(s)`}</StatusPill>
          ) : undefined
        }
      >
        {fields.length === 0 ? (
          <EmptyState message="No extracted fields on this submission." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#eaeaea] text-left text-[11px] text-[#737373]">
                  <th className="py-1 pr-3 font-medium">Field</th>
                  <th className="py-1 pr-3 font-medium">Value</th>
                  <th className="py-1 pr-3 font-medium">Provenance</th>
                  <th className="py-1 pr-3 font-medium text-right">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => {
                  const low = f.confidence < CONFIDENCE_FLOOR;
                  return (
                    <tr
                      key={`${f.field}-${f.provenance.docId}`}
                      className={
                        'border-b border-[#f5f5f5] last:border-0 ' + (low ? 'bg-[#fffbeb]' : '')
                      }
                    >
                      <td className="py-1.5 pr-3 font-medium text-[#171717]">{f.field}</td>
                      <td className="py-1.5 pr-3 text-[#525252]">{f.value}</td>
                      <td className="py-1.5 pr-3 text-[#737373]">
                        {f.provenance.docId}
                        {f.provenance.page != null ? ` · p.${f.provenance.page}` : ''} ·{' '}
                        {f.provenance.extractorVersion}
                      </td>
                      <td className="py-1.5 pr-3 text-right tnum">
                        <span className={low ? 'font-semibold text-[#b45309]' : 'text-[#525252]'}>
                          {(f.confidence * 100).toFixed(0)}%
                        </span>
                        {low && (
                          <StatusPill tone="amber" className="ml-2">
                            exception
                          </StatusPill>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── Risk objects & enrichment (CAP-05) ──────────────────────────── */}
      <Panel title="Risk objects & enrichment">
        {s.riskObjects.length === 0 ? (
          <EmptyState message="No risk objects captured yet." />
        ) : (
          <div className="space-y-3">
            {s.riskObjects.map((r) => (
              <div key={r.id} className="rounded-md border border-[#eaeaea] p-3">
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <Chip>{r.kind}</Chip>
                  <span className="font-medium text-[#171717]">{r.name}</span>
                  {r.situs && <span className="text-[#737373]">{r.situs}</span>}
                  {r.tiv != null && (
                    <span className="text-[#737373]">
                      TIV {fmt.currency(r.tiv, { compact: true })}
                    </span>
                  )}
                  <div className="flex-1" />
                  <Button variant="secondary" className="text-xs" onClick={() => enrich(r.id)}>
                    Enrich
                  </Button>
                </div>
                {r.enrichmentRecords.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.enrichmentRecords.map((e) => (
                      <Chip
                        key={e.id}
                        title={`fetched ${fmtDateTime(e.fetchedAt)} · expires ${fmtDateTime(e.expiresAt)}`}
                      >
                        {e.source.name} · {e.source.kind}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ── Clearance (CAP-02, INV-4) ───────────────────────────────────── */}
      <Panel title="Clearance">
        <div className="space-y-2">
          {s.clearanceChecks.map((c) => {
            const tone = c.verdict === 'HIT' ? 'red' : c.verdict === 'RELEASED' ? 'slate' : 'green';
            const watchlistHit = c.checkType === 'WATCHLIST' && c.verdict === 'HIT';
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="w-24 font-medium text-[#171717]">{c.checkType}</span>
                <StatusPill tone={tone}>{c.verdict}</StatusPill>
                {c.matchEvidence && (
                  <span className="text-[#737373]" title={JSON.stringify(c.matchEvidence)}>
                    {JSON.stringify(c.matchEvidence)}
                  </span>
                )}
                {watchlistHit && (
                  <span className="flex items-center gap-2">
                    <span className="text-[#92400e]">
                      {c.firstReleaseBy
                        ? `1 of 2 signatures (${c.firstReleaseBy}) — second must come from a distinct role`
                        : 'Dual-control release required (INV-4)'}
                    </span>
                    <Button variant="secondary" className="text-xs" onClick={() => release(c)}>
                      {c.firstReleaseBy ? 'Countersign release' : 'Sign release'}
                    </Button>
                  </span>
                )}
                {c.verdict === 'RELEASED' && c.secondReleaseBy && (
                  <span className="text-[#737373]">
                    released by {c.firstReleaseBy} + {c.secondReleaseBy}
                  </span>
                )}
              </div>
            );
          })}
          {s.clearanceChecks.length === 0 && <EmptyState message="No clearance checks recorded." />}
        </div>
      </Panel>

      {/* ── Latest triage lenses (CAP-04) ───────────────────────────────── */}
      {latestScore && (
        <Panel
          title="Triage score"
          badge={<Chip>{`weights ${latestScore.weightsVersion}`}</Chip>}
          actions={
            <span className="text-[11px] text-[#737373]">
              {s.triageScores.length} version(s) · latest {fmtDateTime(latestScore.scoredAt)}
            </span>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(
              [
                ['Composite', latestScore.composite],
                ['Appetite fit', latestScore.appetiteFit],
                ['Winnability', latestScore.winnability],
                ['Expected value', latestScore.expectedValue],
                ['Effort', latestScore.effort],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#737373]">
                  {label}
                </div>
                <div
                  className={
                    'tnum text-lg ' +
                    (label === 'Composite'
                      ? 'font-bold text-[#171717]'
                      : 'font-semibold text-[#525252]')
                  }
                >
                  {Math.round(value)}
                </div>
                {latestScore.rationale && label !== 'Composite' && (
                  <div className="text-[11px] text-[#a3a3a3]">
                    {latestScore.rationale[
                      label === 'Appetite fit'
                        ? 'appetiteFit'
                        : label === 'Expected value'
                          ? 'expectedValue'
                          : label.toLowerCase()
                    ] ?? ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Interactive desk panels ─────────────────────────────────────── */}
      <ProposalsPanel actions={s.agentActions} onDone={refetch} />
      <ReferralsPanel referrals={s.referralCases} onDone={refetch} />
      <DecisionPanel submission={s} onDone={refetch} />

      {/* Decision history */}
      {s.decisions.length > 0 && (
        <Panel title="Decision history">
          <div className="space-y-1.5">
            {s.decisions.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                <StatusPill
                  tone={d.outcome === 'QUOTE' ? 'green' : d.outcome === 'REFER' ? 'amber' : 'slate'}
                >
                  {d.outcome}
                </StatusPill>
                <span className="font-medium text-[#171717]">{fmt.currency(d.premium)}</span>
                <span className="text-[#737373]">
                  authority {d.authorityResult}
                  {d.authorityGrant
                    ? ` · ${d.authorityGrant.ref} v${d.authorityGrant.version}`
                    : ''}{' '}
                  · {d.dispositionedBy} · {fmtDateTime(d.decidedAt)}
                </span>
                <span className="w-full text-[11px] text-[#a3a3a3]">{d.rationale}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <QuoteBindPanel submission={s} onDone={refetch} />
    </div>
  );
}
