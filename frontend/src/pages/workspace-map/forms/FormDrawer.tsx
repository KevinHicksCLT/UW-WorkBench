// Form detail drawer — the FR-5/FR-7 surface for a single form:
//   • FR-7.1 Bridge context package (also pushed to the AI assistant)
//   • FR-7.2 agent recommendation banner with evidence + one-click accept
//   • FR-5.1 existence classification (human confirms; audit trail)
//   • FR-5.2 STANDARDIZE / KEEP / RETIRE decision capture (audit trail)
// Every decision requires explicit human confirmation — the agent can never
// finalize (deterministic rule).

import { useEffect } from 'react';
import { Button, DrawerShell, Select } from '../../../components/ui';
import { useDialogs } from '../../../lib/dialogs';
import { setAssistantDetail } from '../../../lib/assistantContext';
import { contextPackage, decisionOf, formById, type FormsStore } from './model';
import { PRODUCT_NAME } from './mockData';
import {
  DECISION_META,
  REASON_META,
  STATE_NAME,
  type ExistenceReason,
  type FormClassification,
  type FormDecisionStatus,
  type FormRecord,
} from './types';
import { DecisionChip, LayerBadge, ReasonChip, SectionTitle } from './chrome';

export default function FormDrawer({
  formId,
  store,
  onClose,
  onDecide,
  onWithdraw,
  onClassify,
}: {
  formId: string;
  store: FormsStore;
  onClose: () => void;
  onDecide: (
    formId: string,
    status: FormDecisionStatus,
    reason: string,
    extra?: { targetCoreFormId?: string; conditionalBlock?: string },
  ) => void;
  onWithdraw: (formId: string) => void;
  onClassify: (formId: string, reason: ExistenceReason, prior: ExistenceReason) => void;
}) {
  const form = formById.get(formId) ?? null;

  // FR-7.1 — while the drawer is open the assistant carries this form's
  // context package; clearing on close keeps stale context out of later chats.
  useEffect(() => {
    if (!form) return;
    const pkg = contextPackage(form);
    setAssistantDetail(
      `Viewing form ${pkg.formId} "${pkg.title}"` +
        ` — parent: ${pkg.parentForm ?? 'none (core form)'}` +
        `; state: ${pkg.state ? (STATE_NAME[pkg.state] ?? pkg.state) : 'countrywide'}` +
        `; ${pkg.products.length} associated products` +
        `; ${pkg.citations.length} regulatory citations` +
        `; coverages: ${pkg.coverages.join(', ') || 'none'}` +
        `; ${pkg.rules.length} related rules; ${pkg.relatedForms.length} related forms.`,
    );
    return () => setAssistantDetail(null);
  }, [form]);

  if (!form) return null;
  const decision = store.decisions[form.formId] ?? null;
  const classification = store.classifications[form.formId] ?? null;

  return (
    <DrawerShell
      onClose={onClose}
      width={560}
      maxWidth="94vw"
      header={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#171717' }}>{form.formId}</span>
            <LayerBadge layer={form.layer} compact />
            <DecisionChip status={decisionOf(form, store)} />
          </div>
          <span style={{ fontSize: 12.5, color: '#404040' }}>{form.title}</span>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 12.5, color: '#262626', lineHeight: 1.5 }}>
          {form.description}
        </p>

        {form.layer !== 'CORE' && <AgentBanner form={form} store={store} onDecide={onDecide} />}

        {form.layer !== 'CORE' && (
          <Classification form={form} classification={classification} onClassify={onClassify} />
        )}

        {form.layer !== 'CORE' && (
          <DecisionBlock
            form={form}
            decision={decision}
            onDecide={onDecide}
            onWithdraw={onWithdraw}
          />
        )}

        <ContextPanel form={form} />
      </div>
    </DrawerShell>
  );
}

// ── FR-7.2 — agent recommendation ───────────────────────────────────────────

const AGENT_LABEL: Record<string, string> = {
  KEEP_STATE_VARIATION: 'KEEP STATE VARIATION',
  STANDARDIZE: 'STANDARDIZE',
  RETIRE: 'RETIRE',
};

function AgentBanner({
  form,
  store,
  onDecide,
}: {
  form: FormRecord;
  store: FormsStore;
  onDecide: (formId: string, status: FormDecisionStatus, reason: string) => void;
}) {
  const dialogs = useDialogs();
  if (!form.agent) return null;
  const m = DECISION_META[form.agent.disposition];
  const decided = decisionOf(form, store) !== 'UNDECIDED';
  const accept = async () => {
    // Explicit human confirmation — the agent never finalizes a decision.
    const ok = await dialogs.confirm({
      title: `Accept the agent's ${AGENT_LABEL[form.agent!.disposition]} recommendation?`,
      message: `${form.agent!.reason} Evidence: ${form.agent!.evidence.join('; ')}.`,
    });
    if (ok)
      onDecide(
        form.formId,
        form.agent!.disposition,
        `Accepted agent recommendation: ${form.agent!.reason}`,
      );
  };
  return (
    <div
      style={{
        border: `1px solid ${m.border}`,
        borderRadius: 10,
        background: m.bg,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: m.fg, letterSpacing: 0.4 }}>
        COMPLIANCE AGENT RECOMMENDS — {AGENT_LABEL[form.agent.disposition]}
      </span>
      <span style={{ fontSize: 12.5, color: '#262626' }}>{form.agent.reason}</span>
      {form.agent.evidence.length > 0 && (
        <span style={{ fontSize: 11.5, color: '#404040' }}>
          Evidence: {form.agent.evidence.join(' · ')}
        </span>
      )}
      {!decided && (
        <div>
          <Button className="text-xs" onClick={() => void accept()}>
            Accept recommendation…
          </Button>
        </div>
      )}
    </div>
  );
}

// ── FR-5.1 — existence classification ───────────────────────────────────────

function Classification({
  form,
  classification,
  onClassify,
}: {
  form: FormRecord;
  classification: FormClassification | null;
  onClassify: (formId: string, reason: ExistenceReason, prior: ExistenceReason) => void;
}) {
  const current = classification?.reason ?? form.existenceReason;
  return (
    <div>
      <SectionTitle right={<ReasonChip reason={current} />}>Why does this form exist?</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Select
          aria-label="Existence reason"
          value={current}
          onChange={(e) => onClassify(form.formId, e.target.value as ExistenceReason, current)}
          style={{
            width: 'auto',
            minWidth: 240,
            height: 28,
            fontSize: 12,
            padding: '0 28px 0 8px',
          }}
        >
          {(Object.keys(REASON_META) as ExistenceReason[]).map((r) => (
            <option key={r} value={r}>
              {REASON_META[r].label}
            </option>
          ))}
        </Select>
      </div>
      {classification && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#525252' }}>
          Confirmed by {classification.decidedBy} on{' '}
          {new Date(classification.decidedAt).toLocaleString()} (was{' '}
          {REASON_META[classification.priorValue].label})
        </p>
      )}
    </div>
  );
}

// ── FR-5.2 / decisions ──────────────────────────────────────────────────────

function DecisionBlock({
  form,
  decision,
  onDecide,
  onWithdraw,
}: {
  form: FormRecord;
  decision: {
    status: FormDecisionStatus;
    reason: string;
    decidedBy: string;
    decidedAt: string;
    conditionalBlock?: string;
    unifiedFormId?: string;
  } | null;
  onDecide: (
    formId: string,
    status: FormDecisionStatus,
    reason: string,
    extra?: { targetCoreFormId?: string; conditionalBlock?: string },
  ) => void;
  onWithdraw: (formId: string) => void;
}) {
  const dialogs = useDialogs();
  const parent = form.parentFormId ? formById.get(form.parentFormId) : null;

  const keep = async () => {
    const reason = await dialogs.prompt({
      title: 'Keep as a state variation',
      label: 'Why must this stay separate?',
      initial: form.agent?.disposition === 'KEEP_STATE_VARIATION' ? form.agent.reason : '',
    });
    if (reason) onDecide(form.formId, 'KEEP_STATE_VARIATION', reason);
  };
  const standardize = async () => {
    const block = await dialogs.prompt({
      title: `Standardize into ${parent?.formId ?? 'the core form'}`,
      label: 'Conditional language block note',
      initial: form.state
        ? `${parent?.title ?? 'Core form'} + ${STATE_NAME[form.state] ?? form.state} Conditional Language Block`
        : '',
    });
    if (block)
      onDecide(form.formId, 'STANDARDIZE', 'Requirement absorbed into the core form.', {
        targetCoreFormId: form.parentFormId ?? undefined,
        conditionalBlock: block,
      });
  };
  const retire = async () => {
    const ok = await dialogs.confirm({
      title: `Retire ${form.formId}?`,
      message: 'Records a RETIRE decision — the form leaves the target state.',
      danger: true,
    });
    if (ok) onDecide(form.formId, 'RETIRE', 'No active filing dependency.');
  };

  return (
    <div>
      <SectionTitle>Rationalization decision</SectionTitle>
      {decision ? (
        <div
          style={{
            border: '1px solid #eaeaea',
            borderRadius: 10,
            background: '#fafafa',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 12,
          }}
        >
          <span>
            <DecisionChip status={decision.status} />{' '}
            <span style={{ color: '#262626' }}>{decision.reason}</span>
          </span>
          {decision.conditionalBlock && (
            <span style={{ color: '#3730a3', fontWeight: 600 }}>→ {decision.conditionalBlock}</span>
          )}
          {decision.unifiedFormId && (
            <span style={{ color: '#0e7490', fontWeight: 600 }}>
              → Unified into {decision.unifiedFormId}
            </span>
          )}
          <span style={{ color: '#525252', fontSize: 11 }}>
            {decision.decidedBy} · {new Date(decision.decidedAt).toLocaleString()}
          </span>
          <div>
            <Button variant="secondary" className="text-xs" onClick={() => onWithdraw(form.formId)}>
              Withdraw decision
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" className="text-xs" onClick={() => void keep()}>
            Keep state variation…
          </Button>
          <Button variant="secondary" className="text-xs" onClick={() => void standardize()}>
            Standardize into core…
          </Button>
          <Button variant="secondary" className="text-xs" onClick={() => void retire()}>
            Retire…
          </Button>
        </div>
      )}
    </div>
  );
}

// ── FR-7.1 — context package panel ──────────────────────────────────────────

function ContextPanel({ form }: { form: FormRecord }) {
  const pkg = contextPackage(form);
  const row = (label: string, value: string) => (
    <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
      <span style={{ minWidth: 150, color: '#404040', fontWeight: 600 }}>{label}</span>
      <span style={{ color: '#171717' }}>{value}</span>
    </div>
  );
  return (
    <div>
      <SectionTitle>Bridge context package</SectionTitle>
      <div
        style={{
          border: '1px solid #eaeaea',
          borderRadius: 10,
          background: '#fff',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {row('Parent form', pkg.parentForm ?? '— (core form)')}
        {row('State', pkg.state ? (STATE_NAME[pkg.state] ?? pkg.state) : 'Countrywide')}
        {row(
          `Associated products (${pkg.products.length})`,
          pkg.products.map((p) => PRODUCT_NAME[p] ?? p).join(', ') || '—',
        )}
        {row(
          `Regulatory citations (${pkg.citations.length})`,
          pkg.citations.slice(0, 6).join('; ') + (pkg.citations.length > 6 ? ' …' : '') || '—',
        )}
        {row('Related coverages', pkg.coverages.join(', ') || '—')}
        {row(
          `Related rules (${pkg.rules.length})`,
          pkg.rules.slice(0, 5).join('; ') + (pkg.rules.length > 5 ? ' …' : '') || '—',
        )}
        {row(`Related forms (${pkg.relatedForms.length})`, pkg.relatedForms.join(', ') || '—')}
        {row(
          `Filing dependencies (${form.filingDependencies.length})`,
          form.filingDependencies.join('; ') || 'None',
        )}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#525252' }}>
        This package is also supplied to the AI assistant while this form is open.
      </p>
    </div>
  );
}
