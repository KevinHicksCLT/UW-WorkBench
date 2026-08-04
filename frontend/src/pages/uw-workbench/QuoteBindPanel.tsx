// Risk Workspace — quote & bind panel (INV-2 / INV-7 / LLR-12), split from
// WorkspacePanels.tsx for the file-size budget. Quote references its rating
// model (priced-by, RATE-PRICING) and form set (documented-by, FORMS-RATION);
// bind executes onto a registered PAS Application node, idempotent on
// correlationId.
import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useCompany } from '../../lib/company';
import { useDialogs } from '../../lib/dialogs';
import { withCompany } from '../../lib/portfolio';
import { fmt } from '../../lib/format';
import { Button, Input, Label, Select, StatusPill } from '../../components/ui';
import type { App } from '../applications/types';
import { errMsg, fmtDateTime, type SubmissionDetail } from './types';
import { Panel } from './WorkspacePanels';

export function QuoteBindPanel({
  submission,
  onDone,
}: {
  submission: SubmissionDetail;
  onDone: () => void;
}) {
  const { companyId } = useCompany();
  const dialogs = useDialogs();
  // PAS bind target: the registered Application catalog; fall back to the
  // submission's own PAS bindings if the catalog is empty for this tenant.
  const { data: appData } = useApi<{ applications: App[] }>('/applications');
  const catalog = appData?.applications ?? [];
  const appOptions = catalog.length
    ? catalog.map((a) => ({ id: a.id, name: a.name }))
    : submission.pasBindings.map((b) => ({ id: b.applicationId, name: b.application.name }));

  const quoteDecisions = submission.decisions.filter(
    (d) => d.outcome === 'QUOTE' && d.authorityResult === 'PASS',
  );
  const proposedQuotes = submission.quoteProposals.filter((q) => q.status === 'PROPOSED');

  const [decisionId, setDecisionId] = useState('');
  const [premium, setPremium] = useState('');
  const [modelRef, setModelRef] = useState('');
  const [formSetRef, setFormSetRef] = useState('');
  const [quoteId, setQuoteId] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [busy, setBusy] = useState(false);

  async function createQuote() {
    const decision = decisionId || quoteDecisions[0]?.id;
    if (!decision) {
      await dialogs.alert(
        'A quote requires a QUOTE-outcome decision that passed authority validation (INV-2).',
      );
      return;
    }
    const prem = Number(premium || quoteDecisions.find((d) => d.id === decision)?.premium || 0);
    if (!prem || Number.isNaN(prem) || prem <= 0) {
      await dialogs.alert('Premium must be greater than 0.');
      return;
    }
    if (modelRef && !/^M-[A-Z]{2}-\d{2}$/.test(modelRef)) {
      await dialogs.alert('modelRef must match M-XX-## (RATE-PRICING), e.g. M-CP-04.');
      return;
    }
    if (formSetRef && !/^FS-[A-Z-]+-\d{2}$/.test(formSetRef)) {
      await dialogs.alert('formSetRef must match FS-XXX-## (FORMS-RATION), e.g. FS-CP-STD-26.');
      return;
    }
    setBusy(true);
    try {
      await api.post(withCompany('/uw/quotes', companyId), {
        submissionId: submission.id,
        decisionId: decision,
        premium: prem,
        modelRef: modelRef || undefined,
        formSetRef: formSetRef || undefined,
      });
      onDone();
    } catch (e) {
      await dialogs.alert({ title: 'Quote blocked', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function executeBind() {
    const quote = quoteId || proposedQuotes[0]?.id;
    if (!quote) {
      await dialogs.alert('No PROPOSED quote to bind — create a quote first.');
      return;
    }
    const app = applicationId || appOptions[0]?.id;
    if (!app) {
      await dialogs.alert('Select the registered PAS Application node to execute the bind on.');
      return;
    }
    setBusy(true);
    try {
      const bind = (await api.post(withCompany('/uw/bind', companyId), {
        quoteId: quote,
        correlationId: crypto.randomUUID(),
        applicationId: app,
      })) as { pasPolicyRef: string; replayed?: boolean };
      await dialogs.alert({
        title: bind.replayed ? 'Bind replayed (idempotent)' : 'Bind executed',
        message: `PAS policy ${bind.pasPolicyRef}${bind.replayed ? ' — same correlationId returned the existing policy (LLR-12).' : '.'}`,
      });
      onDone();
    } catch (e) {
      await dialogs.alert({ title: 'Bind blocked by invariant', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Quote & bind" badge={<StatusPill tone="blue">INV-2 · INV-7</StatusPill>}>
      {submission.quoteProposals.length > 0 && (
        <div className="mb-3 space-y-1">
          {submission.quoteProposals.map((q) => (
            <div key={q.id} className="flex flex-wrap items-center gap-2 text-[12px]">
              <StatusPill
                tone={q.status === 'BOUND' ? 'green' : q.status === 'PROPOSED' ? 'blue' : 'slate'}
              >
                {q.status}
              </StatusPill>
              <span className="font-medium text-[#171717]">{fmt.currency(q.premium)}</span>
              <span className="text-[#737373]">
                priced-by {q.modelRef ?? '—'} · documented-by {q.formSetRef ?? '—'}
                {q.bindEvent
                  ? ` · ${q.bindEvent.pasPolicyRef} (${fmtDateTime(q.bindEvent.executedAt)})`
                  : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="uw-q-decision">Decision</Label>
          <Select
            id="uw-q-decision"
            value={decisionId}
            onChange={(e) => setDecisionId(e.target.value)}
          >
            {quoteDecisions.length === 0 && <option value="">No eligible QUOTE decision</option>}
            {quoteDecisions.map((d) => (
              <option key={d.id} value={d.id}>
                {fmt.currency(d.premium)} · {fmtDateTime(d.decidedAt)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="uw-q-premium">Premium (USD)</Label>
          <Input
            id="uw-q-premium"
            type="number"
            min={0}
            value={premium}
            onChange={(e) => setPremium(e.target.value)}
            placeholder="defaults to decision premium"
          />
        </div>
        <div>
          <Label htmlFor="uw-q-model">Model ref (RATE-PRICING)</Label>
          <Input
            id="uw-q-model"
            value={modelRef}
            onChange={(e) => setModelRef(e.target.value)}
            placeholder="M-CP-04"
          />
        </div>
        <div>
          <Label htmlFor="uw-q-form">Form set ref (FORMS-RATION)</Label>
          <Input
            id="uw-q-form"
            value={formSetRef}
            onChange={(e) => setFormSetRef(e.target.value)}
            placeholder="FS-CP-STD-26"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button className="text-xs" disabled={busy} onClick={createQuote}>
          Create quote
        </Button>
        <span className="text-[11px] text-[#737373]">
          Both cross-module refs must resolve before bind (INV-7).
        </span>
      </div>

      <div className="mt-4 border-t border-[#f0f0f0] pt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="uw-b-quote">Quote to bind</Label>
          <Select id="uw-b-quote" value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
            {proposedQuotes.length === 0 && <option value="">No PROPOSED quote</option>}
            {proposedQuotes.map((q) => (
              <option key={q.id} value={q.id}>
                {fmt.currency(q.premium)} · {q.modelRef ?? 'unpriced'} /{' '}
                {q.formSetRef ?? 'undocumented'}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="uw-b-app">PAS application node</Label>
          <Select
            id="uw-b-app"
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
          >
            {appOptions.length === 0 && <option value="">No registered application</option>}
            {appOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <Button className="text-xs" disabled={busy} onClick={executeBind}>
            Execute bind
          </Button>
        </div>
      </div>
    </Panel>
  );
}
