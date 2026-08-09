// Model Workspace (SM-A home — CAP-02/04/05/08, HLR-02/04/05). Version
// timeline with publish (the declared review point that freezes the bundle,
// INV-01), the factor table for the selected version, and the what-if runner:
// reference quote + optional parallel-run delta against a paired legacy
// premium (the rationalization evidence ADR-002 exists for). AGLM-proposal
// drafts require an actuarial review note to publish (ADR-004).
import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useCompany } from '../../lib/company';
import { useDialogs } from '../../lib/dialogs';
import { withCompany } from '../../lib/portfolio';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorMessage,
  Input,
  Label,
  LoadingState,
  Select,
  StatusPill,
} from '../../components/ui';
import {
  errMsg,
  lifecycleTone,
  type ModelVersion,
  type QuoteResult,
  type RatingModel,
  type RatingSpec,
} from './types';

function factorSummary(f: RatingSpec['factors'][number]): string {
  switch (f.kind) {
    case 'base_rate':
      return `${f.rate} per ${f.per ?? 1} of ${f.exposureInput}`;
    case 'table':
      return `${f.rows?.length ?? 0} rows on ${f.input}`;
    case 'formula':
      return `${f.slope}×${f.input}+${f.intercept} [${f.min ?? '−∞'}, ${f.max ?? '∞'}]`;
    case 'flag':
      return `×${f.factor} when ${f.input}`;
  }
}

export default function ModelWorkspace({
  models,
  selectedId,
  onSelect,
  onPublished,
}: {
  models: RatingModel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPublished: () => void;
}) {
  const { companyId } = useCompany();
  const dialogs = useDialogs();
  const modelId = selectedId ?? models[0]?.id ?? null;
  const detail = useApi<RatingModel>(
    modelId ? withCompany(`/rate-price/models/${modelId}`, companyId) : null,
  );
  const [versionId, setVersionId] = useState<string | null>(null);
  const [riskInput, setRiskInput] = useState<Record<string, string>>({});
  const [legacyPremium, setLegacyPremium] = useState('');
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [busy, setBusy] = useState(false);

  const versions = detail.data?.versions ?? [];
  const activeVersion: ModelVersion | null =
    versions.find((v) => v.id === (versionId ?? detail.data?.currentVersionId)) ??
    versions[0] ??
    null;
  const spec = activeVersion?.spec ?? null;
  const inputs = useMemo(() => spec?.inputs ?? [], [spec]);

  if (!models.length) {
    return (
      <Card className="p-8 text-center">
        <EmptyState
          baseClassName="text-sm text-[#a3a3a3]"
          message="No rating models in the estate — register one from the Portfolio tab."
        />
      </Card>
    );
  }

  async function runQuote(kind: 'quote' | 'parallel') {
    if (!activeVersion) return;
    const payload: Record<string, unknown> = {};
    for (const input of inputs) {
      const raw = riskInput[input.name];
      if (raw === undefined || raw === '') continue;
      payload[input.name] =
        input.type === 'number' ? Number(raw) : input.type === 'boolean' ? raw === 'true' : raw;
    }
    setBusy(true);
    try {
      const path = kind === 'quote' ? '/rate-price/quote' : '/rate-price/parallel-run';
      const body =
        kind === 'quote'
          ? { versionId: activeVersion.id, riskInput: payload, kind: 'what-if' }
          : {
              versionId: activeVersion.id,
              riskInput: payload,
              legacyPremium: Number(legacyPremium || '0'),
            };
      setResult((await api.post(withCompany(path, companyId), body)) as QuoteResult);
    } catch (e) {
      await dialogs.alert({ title: 'Run failed', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function publish(version: ModelVersion) {
    let reviewNote: string | undefined;
    if (version.provenance === 'aglm-proposal') {
      const note = await dialogs.prompt({
        title: `Actuarial review — ${version.semver}`,
        label: 'Review note (ADR-004: proposals never bypass review)',
        placeholder: 'Fit metrics reviewed; territory refit approved for filing…',
        confirmLabel: 'Publish with review',
      });
      if (note === null) return;
      reviewNote = note;
    } else {
      const ok = await dialogs.confirm({
        title: `Publish ${version.semver}?`,
        message:
          'Publish is a declared review point: the bundle hash freezes and the version becomes immutable (INV-01). Edits after publish create a new version.',
        confirmLabel: 'Publish version',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await api.post(withCompany(`/rate-price/versions/${version.id}/publish`, companyId), {
        reviewNote,
      });
      detail.refetch();
      onPublished();
    } catch (e) {
      await dialogs.alert({ title: 'Publish blocked', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-[11px] uppercase tracking-wide text-[#737373]">Model</Label>
        <Select
          value={modelId ?? ''}
          onChange={(e) => {
            onSelect(e.target.value);
            setVersionId(null);
            setResult(null);
          }}
          className="w-72 text-sm"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.ref} — {m.name}
            </option>
          ))}
        </Select>
        {detail.data && (
          <StatusPill tone={lifecycleTone(detail.data.lifecycle)}>
            {detail.data.lifecycle}
          </StatusPill>
        )}
        {detail.data?.ownerRole?.displayValue && (
          <span className="text-[12px] text-[#737373]">
            owned by {detail.data.ownerRole.displayValue}
          </span>
        )}
      </div>
      {detail.error && <ErrorMessage>{detail.error}</ErrorMessage>}
      {detail.loading && <LoadingState message="Loading model…" />}

      {detail.data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Version timeline */}
          <Card className="p-4">
            <h3 className="text-[13px] font-semibold mb-3">Version timeline</h3>
            <ul className="space-y-2">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className={
                    'rounded-md border px-3 py-2 cursor-pointer ' +
                    (v.id === activeVersion?.id
                      ? 'border-[#171717] bg-[#fafafa]'
                      : 'border-[#eaeaea] hover:border-[#a3a3a3]')
                  }
                  onClick={() => {
                    setVersionId(v.id);
                    setResult(null);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium tabular-nums">v{v.semver}</span>
                    <StatusPill tone={v.status === 'published' ? 'green' : 'amber'}>
                      {v.status}
                    </StatusPill>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-[#737373]">
                    <Chip>{v.provenance}</Chip>
                    <span className="truncate" title={v.bundleHash}>
                      {v.bundleHash.slice(0, 10)}…
                    </span>
                  </div>
                  {v.status === 'draft' && (
                    <Button
                      variant="secondary"
                      className="mt-2 text-[11px]"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void publish(v);
                      }}
                    >
                      Publish → review point
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {/* Factor table */}
          <Card className="p-4">
            <h3 className="text-[13px] font-semibold mb-3">
              Factors{' '}
              {activeVersion && <span className="text-[#737373]">· v{activeVersion.semver}</span>}
            </h3>
            {spec ? (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-[#737373]">
                    <th className="pb-1.5">Factor</th>
                    <th className="pb-1.5">Kind</th>
                    <th className="pb-1.5">Definition</th>
                  </tr>
                </thead>
                <tbody>
                  {spec.factors.map((f) => (
                    <tr key={f.name} className="border-t border-[#f0f0f0]">
                      <td className="py-1.5 font-medium">{f.name}</td>
                      <td className="py-1.5">
                        <Chip>{f.kind}</Chip>
                      </td>
                      <td className="py-1.5 text-[#737373] tabular-nums">{factorSummary(f)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState baseClassName="text-sm text-[#a3a3a3]" message="No version selected." />
            )}
            {spec?.minPremium != null && (
              <p className="mt-2 text-[11px] text-[#737373]">
                Minimum premium {spec.minPremium.toLocaleString('en-US')} · rounding{' '}
                {spec.rounding ?? 'none'}
              </p>
            )}
          </Card>

          {/* What-if runner */}
          <Card className="p-4">
            <h3 className="text-[13px] font-semibold mb-3">What-if · reference quote</h3>
            {activeVersion?.status !== 'published' && (
              <p className="mb-2 text-[11px] text-[#b45309]">
                Runs execute against published versions only (INV-02) — publish this draft first.
              </p>
            )}
            <div className="space-y-2">
              {inputs.map((input) => (
                <div key={input.name} className="flex items-center gap-2">
                  <Label className="w-32 text-[11px] text-[#737373]" title={input.domain}>
                    {input.name}
                  </Label>
                  {input.type === 'boolean' ? (
                    <Select
                      value={riskInput[input.name] ?? ''}
                      onChange={(e) =>
                        setRiskInput((s) => ({ ...s, [input.name]: e.target.value }))
                      }
                      className="flex-1 text-[12px]"
                    >
                      <option value="">—</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </Select>
                  ) : (
                    <Input
                      value={riskInput[input.name] ?? ''}
                      onChange={(e) =>
                        setRiskInput((s) => ({ ...s, [input.name]: e.target.value }))
                      }
                      placeholder={input.domain ?? input.type}
                      className="flex-1 text-[12px]"
                    />
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Label className="w-32 text-[11px] text-[#737373]">legacy premium</Label>
                <Input
                  value={legacyPremium}
                  onChange={(e) => setLegacyPremium(e.target.value)}
                  placeholder="for parallel-run Δ"
                  className="flex-1 text-[12px]"
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                disabled={busy || activeVersion?.status !== 'published'}
                onClick={() => void runQuote('quote')}
                className="text-[12px]"
              >
                Run quote
              </Button>
              <Button
                variant="secondary"
                disabled={busy || activeVersion?.status !== 'published' || !legacyPremium}
                onClick={() => void runQuote('parallel')}
                className="text-[12px]"
              >
                Parallel-run Δ
              </Button>
            </div>
            {result && (
              <div className="mt-3 border-t border-[#f0f0f0] pt-3">
                <div className="text-[20px] font-semibold tabular-nums">
                  {result.premium.toLocaleString('en-US')}
                  {result.deltaPct != null && (
                    <span
                      className={
                        'ml-2 text-[12px] font-medium ' +
                        (result.materiality === 'material'
                          ? 'text-[#be123c]'
                          : result.materiality === 'watch'
                            ? 'text-[#b45309]'
                            : 'text-[#15803d]')
                      }
                    >
                      Δ {result.deltaPct}% ({result.materiality})
                    </span>
                  )}
                </div>
                <table className="mt-2 w-full text-[11px]">
                  <tbody>
                    {result.factorBreakdown.map((row) => (
                      <tr key={row.name} className="border-t border-[#f5f5f5]">
                        <td className="py-1">{row.name}</td>
                        <td className="py-1 text-right tabular-nums font-medium">{row.value}</td>
                        <td className="py-1 pl-2 text-[#737373]">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.missingInputs.length > 0 && (
                  <p className="mt-1 text-[11px] text-[#b45309]">
                    Missing inputs (passed through at 1.0): {result.missingInputs.join(', ')}
                  </p>
                )}
                {result.traceId && (
                  <p className="mt-1 text-[10px] text-[#a3a3a3]">
                    trace {result.traceId} · {result.latencyMs}ms
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
