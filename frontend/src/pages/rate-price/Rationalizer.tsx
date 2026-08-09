// Rationalizer (CAP-19 — the TB-native differentiator, HLR-18). The legacy
// estate: raters → extraction (the unextracted list is the contract — nothing
// approximated, LLR-18.1) → human confirmation → divergence vs a target
// version (SM-A side-by-side grain, SM-B clustered rollup) → migration waves
// gated by INV-04 (cutover refusals list every blocking member).
import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useCompany } from '../../lib/company';
import { useDialogs } from '../../lib/dialogs';
import { withCompany } from '../../lib/portfolio';
import { Button, Card, Chip, EmptyState, ErrorMessage, StatusPill } from '../../components/ui';
import { Sheet, type SheetCol } from '../../components/Sheet';
import { errMsg, type Estate, type LegacyRater, type MigrationWave } from './types';

const raterTone = (status: string) =>
  status === 'RETIRED'
    ? 'slate'
    : status === 'MIGRATING'
      ? 'blue'
      : status === 'EXTRACTED'
        ? 'green'
        : 'amber';
const cellTone = (klass: string) =>
  klass === 'identical' ? 'green' : klass === 'parametric-delta' ? 'amber' : 'red';
const confidenceTone = (c: string) => (c === 'high' ? 'green' : c === 'medium' ? 'amber' : 'red');

export default function Rationalizer({
  mode,
  onOpenModel,
}: {
  mode: 'A' | 'B';
  onOpenModel: (id: string) => void;
}) {
  const { companyId } = useCompany();
  const dialogs = useDialogs();
  const estate = useApi<Estate>(withCompany('/rate-price/estate', companyId));
  const [selectedRaterId, setSelectedRaterId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const raters = estate.data?.raters ?? [];
  const waves = estate.data?.waves ?? [];
  const selected = raters.find((r) => r.id === selectedRaterId) ?? raters[0] ?? null;
  const latestSpec = selected?.specs[0] ?? null;
  const latestMatrix = latestSpec?.divergenceMatrices[0] ?? null;

  async function extract(rater: LegacyRater) {
    setBusy(true);
    try {
      await api.post(withCompany(`/rate-price/legacy-raters/${rater.id}/extract`, companyId), {});
      estate.refetch();
    } catch (e) {
      await dialogs.alert({ title: 'Extraction refused', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function confirmSpec(specId: string) {
    const ok = await dialogs.confirm({
      title: 'Confirm canonical spec?',
      message:
        'Human confirmation is the INV-04 gate input: waves cannot cut over on unconfirmed specs. Confirm only after reviewing the factor map AND the unextracted list.',
      confirmLabel: 'Confirm spec',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.post(withCompany(`/rate-price/specs/${specId}/confirm`, companyId), {});
      estate.refetch();
    } catch (e) {
      await dialogs.alert({ title: 'Confirmation failed', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function cutover(wave: MigrationWave) {
    const ok = await dialogs.confirm({
      title: `Cut over ${wave.ref} — ${wave.name}?`,
      message:
        `${wave.members.length} rater(s) retire onto ${wave.targetModel?.ref ?? 'target'} ` +
        `(tolerance ${wave.tolerancePct}%). INV-04: every member needs a human-confirmed spec and divergence within tolerance — blockers are listed if not.`,
      confirmLabel: 'Execute cutover',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.post(withCompany(`/rate-price/migration-waves/${wave.id}/cutover`, companyId), {});
      estate.refetch();
    } catch (e) {
      await dialogs.alert({ title: 'Cutover blocked (INV-04)', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  const cols: SheetCol<LegacyRater>[] = [
    { key: 'ref', label: 'Ref', width: '76px', hideable: false, value: (r) => r.ref },
    {
      key: 'name',
      label: 'Legacy rater',
      width: 'minmax(180px,1.4fr)',
      hideable: false,
      value: (r) => r.name,
    },
    { key: 'lob', label: 'LOB', width: '64px', align: 'center', value: (r) => r.lob },
    { key: 'artifact', label: 'Artifact', width: '104px', value: (r) => r.artifactType },
    {
      key: 'complexity',
      label: 'Cmplx',
      width: '70px',
      align: 'right',
      hint: 'Extraction complexity score 0–100',
      value: (r) => (r.complexityScore != null ? String(r.complexityScore) : '—'),
    },
    {
      key: 'spec',
      label: 'Spec',
      width: '120px',
      align: 'center',
      value: (r) =>
        r.specs[0]
          ? r.specs[0].humanConfirmed
            ? 'confirmed'
            : `v${r.specs[0].specVersion} · ${r.specs[0].extractionConfidence}`
          : 'none',
      render: (r) =>
        r.specs[0] ? (
          <StatusPill
            tone={
              r.specs[0].humanConfirmed ? 'green' : confidenceTone(r.specs[0].extractionConfidence)
            }
          >
            {r.specs[0].humanConfirmed ? 'confirmed' : `${r.specs[0].extractionConfidence} conf`}
          </StatusPill>
        ) : (
          <StatusPill tone="slate">none</StatusPill>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '110px',
      align: 'center',
      value: (r) => r.status,
      render: (r) => <StatusPill tone={raterTone(r.status)}>{r.status}</StatusPill>,
    },
  ];

  return (
    <div className="space-y-4">
      {estate.error && <ErrorMessage>{estate.error}</ErrorMessage>}
      <Sheet
        rows={raters}
        cols={cols}
        rowKey={(r) => r.id}
        loading={estate.loading}
        unit="raters"
        sheetKey="rate-price.raters"
        emptyText="No legacy raters inventoried — the estate scan feeds this list."
        onRowClick={(r) => setSelectedRaterId(r.id)}
        selectedKey={selected?.id}
      />

      {selected && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Canonical spec extraction */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-[13px] font-semibold">
                Canonical spec — {selected.ref} {selected.name}
              </h3>
              <span className="ml-auto" />
              {selected.status !== 'RETIRED' && (
                <Button
                  variant="secondary"
                  className="text-[11px]"
                  disabled={busy}
                  onClick={() => void extract(selected)}
                >
                  {latestSpec ? 'Re-extract' : 'Extract'}
                </Button>
              )}
              {latestSpec && !latestSpec.humanConfirmed && (
                <Button
                  className="text-[11px]"
                  disabled={busy}
                  onClick={() => void confirmSpec(latestSpec.id)}
                >
                  Confirm (human)
                </Button>
              )}
            </div>
            {latestSpec ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <Chip>spec v{latestSpec.specVersion}</Chip>
                  <StatusPill tone={confidenceTone(latestSpec.extractionConfidence)}>
                    {latestSpec.extractionConfidence} confidence
                  </StatusPill>
                  {latestSpec.humanConfirmed ? (
                    <span className="text-[#15803d]">confirmed by {latestSpec.confirmedBy}</span>
                  ) : (
                    <span className="text-[#b45309]">pending human confirmation (INV-04)</span>
                  )}
                </div>
                <table className="mt-2 w-full text-[12px]">
                  <tbody>
                    {latestSpec.spec.factors.map((f) => (
                      <tr key={f.name} className="border-t border-[#f5f5f5]">
                        <td className="py-1 font-medium">{f.name}</td>
                        <td className="py-1">
                          <Chip>{f.kind}</Chip>
                        </td>
                        <td className="py-1 text-right">
                          {f.confidence && (
                            <StatusPill tone={confidenceTone(f.confidence)}>
                              {f.confidence}
                            </StatusPill>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(latestSpec.spec.unextracted ?? []).length > 0 && (
                  <div className="mt-2 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2">
                    <p className="text-[11px] font-semibold text-[#991b1b] mb-1">
                      Unextracted — the contract, never approximated (LLR-18.1)
                    </p>
                    {(latestSpec.spec.unextracted ?? []).map((u) => (
                      <p key={u.ref} className="text-[11px] text-[#991b1b]">
                        {u.ref} — {u.reason}
                      </p>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                baseClassName="text-sm text-[#a3a3a3]"
                message={
                  selected.status === 'INVENTORIED'
                    ? 'No definition captured yet — extraction refuses rather than guessing.'
                    : 'No spec extracted yet.'
                }
              />
            )}
          </Card>

          {/* Divergence */}
          <Card className="p-4">
            <h3 className="text-[13px] font-semibold mb-2">
              Divergence {mode === 'A' ? '— side-by-side' : '— clustered'}
            </h3>
            {latestMatrix ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-[11px] mb-2">
                  <span className="text-[#737373]">
                    vs {latestMatrix.targetVersion?.model.ref} v{latestMatrix.targetVersion?.semver}
                  </span>
                  <Chip>max Δ {latestMatrix.maxDivergencePct}%</Chip>
                  {latestMatrix.recommendation && (
                    <StatusPill tone="blue">{latestMatrix.recommendation}</StatusPill>
                  )}
                </div>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-[#737373]">
                      <th className="pb-1">Factor</th>
                      <th className="pb-1">Class</th>
                      <th className="pb-1 text-right">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestMatrix.cells.map((c) => (
                      <tr key={`${c.factor}-${c.side ?? ''}`} className="border-t border-[#f5f5f5]">
                        <td className="py-1">{c.factor}</td>
                        <td className="py-1">
                          <StatusPill tone={cellTone(c.class)}>
                            {c.class}
                            {c.side ? ` (${c.side})` : ''}
                          </StatusPill>
                        </td>
                        <td className="py-1 text-right tabular-nums">
                          {c.deltaPct != null ? `${c.deltaPct}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <EmptyState
                baseClassName="text-sm text-[#a3a3a3]"
                message="No divergence matrix — compute one against a published target version."
              />
            )}
          </Card>
        </div>
      )}

      {/* Migration waves */}
      <Card className="p-4">
        <h3 className="text-[13px] font-semibold mb-3">Migration waves</h3>
        {!waves.length && (
          <EmptyState
            baseClassName="text-sm text-[#a3a3a3]"
            message="No migration waves planned."
          />
        )}
        <ul className="space-y-2">
          {waves.map((wave) => (
            <li key={wave.id} className="rounded-md border border-[#eaeaea] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium">
                  {wave.ref} — {wave.name}
                </span>
                <Chip>wave {wave.sequence}</Chip>
                <Chip>tolerance {wave.tolerancePct}%</Chip>
                {wave.targetModel && (
                  <button
                    className="text-[11px] text-[#0369a1] hover:underline"
                    onClick={() => wave.targetModel && onOpenModel(wave.targetModel.id)}
                  >
                    → {wave.targetModel.ref}
                  </button>
                )}
                <span className="ml-auto" />
                <StatusPill
                  tone={
                    wave.status === 'CUTOVER'
                      ? 'green'
                      : wave.status === 'ROLLED_BACK'
                        ? 'red'
                        : 'amber'
                  }
                >
                  {wave.status}
                </StatusPill>
                {wave.status !== 'CUTOVER' && (
                  <Button
                    className="text-[11px]"
                    disabled={busy}
                    onClick={() => void cutover(wave)}
                  >
                    Cut over
                  </Button>
                )}
              </div>
              <div className="mt-1 text-[11px] text-[#737373]">
                {wave.members.map((m) => `${m.legacyRater.ref} (${m.status})`).join(' · ')}
                {wave.rollbackPlan && <span> · rollback: {wave.rollbackPlan}</span>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
