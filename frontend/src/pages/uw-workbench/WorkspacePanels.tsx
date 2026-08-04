// Risk Workspace — interactive desk panels (split from RiskWorkspace.tsx for
// the file-size budget): agent proposal cards (ADR-02 disposition), the
// decision form with the pure-validator pass/fail breakdown (INV-1), and
// referral resolution (LLR-11). The quote → bind flow lives in
// QuoteBindPanel.tsx (same budget).
import { useState, type ReactNode } from 'react';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { useDialogs } from '../../lib/dialogs';
import { withCompany } from '../../lib/portfolio';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Select,
  StatusPill,
  Textarea,
} from '../../components/ui';
import {
  errMsg,
  fmtDateTime,
  type AgentAction,
  type AuthorityDetail,
  type Decision,
  type ReferralCase,
  type SubmissionDetail,
} from './types';

/** Uniform workspace section card: title row (+ optional badge/action) over content. */
export function Panel({
  title,
  badge,
  actions,
  children,
}: {
  title: string;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[#171717]">{title}</h3>
        {badge}
        <div className="flex-1" />
        {actions}
      </div>
      {children}
    </Card>
  );
}

// ── Agent proposals (ADR-02) ─────────────────────────────────────────────────

export function ProposalsPanel({
  actions,
  onDone,
}: {
  actions: AgentAction[];
  onDone: () => void;
}) {
  const dialogs = useDialogs();
  const [busy, setBusy] = useState(false);
  const pending = actions.filter((a) => a.disposition === 'PENDING');

  async function dispose(action: AgentAction, kind: 'accept' | 'modify' | 'reject') {
    let patch: Record<string, unknown> | undefined;
    let note: string | undefined;
    if (kind === 'modify') {
      const raw = await dialogs.prompt({
        title: 'Modify proposal',
        message: 'Enter the patch as a JSON object — it is recorded alongside the envelope.',
        label: 'Patch (JSON)',
        placeholder: '{"tiv": 1200000}',
        confirmLabel: 'Apply patch',
      });
      if (raw === null) return;
      try {
        patch = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        await dialogs.alert('Patch must be valid JSON (e.g. {"field": "value"}).');
        return;
      }
    } else {
      const raw = await dialogs.prompt({
        title: kind === 'accept' ? 'Accept proposal' : 'Reject proposal',
        label: 'Disposition note',
        placeholder: kind === 'accept' ? 'Looks right — applying' : 'Why is this rejected?',
        confirmLabel: kind === 'accept' ? 'Accept' : 'Reject',
      });
      if (raw === null) return;
      note = raw || undefined;
    }
    setBusy(true);
    try {
      await api.post(`/uw/agent-actions/${action.id}/disposition`, { action: kind, patch, note });
      onDone();
    } catch (e) {
      await dialogs.alert({ title: 'Disposition failed (ADR-02)', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  if (!pending.length) {
    return (
      <Panel title="Agent proposals">
        <EmptyState message="No proposals awaiting disposition." />
      </Panel>
    );
  }
  return (
    <Panel
      title="Agent proposals"
      badge={<StatusPill tone="amber">{`${pending.length} pending`}</StatusPill>}
    >
      <div className="space-y-3">
        {pending.map((a) => (
          <div key={a.id} className="rounded-md border border-[#fcd34d] bg-[#fffbeb] p-3">
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="font-semibold text-[#92400e]">
                ⚠ PROPOSAL — never auto-applies (ADR-02)
              </span>
              <span className="text-[#737373]">
                {a.agentId} · {a.kind} · {a.modelRef}
                {a.confidence != null ? ` · confidence ${(a.confidence * 100).toFixed(0)}%` : ''}
              </span>
            </div>
            {a.proposal && (
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-white border border-[#f0e0b0] p-2 text-[11px] text-[#525252]">
                {JSON.stringify(a.proposal, null, 2)}
              </pre>
            )}
            <div className="mt-2 flex gap-2">
              <Button className="text-xs" disabled={busy} onClick={() => dispose(a, 'accept')}>
                Accept
              </Button>
              <Button
                variant="secondary"
                className="text-xs"
                disabled={busy}
                onClick={() => dispose(a, 'modify')}
              >
                Modify…
              </Button>
              <Button
                variant="secondary"
                className="text-xs"
                disabled={busy}
                onClick={() => dispose(a, 'reject')}
              >
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── Decision form (INV-1) ────────────────────────────────────────────────────

type DecisionResult = {
  decision: Decision;
  referral: ReferralCase | null;
  authorityDetail: AuthorityDetail | null;
};

export function DecisionPanel({
  submission,
  onDone,
}: {
  submission: SubmissionDetail;
  onDone: () => void;
}) {
  const { companyId } = useCompany();
  const dialogs = useDialogs();
  const [outcome, setOutcome] = useState('QUOTE');
  const [premium, setPremium] = useState('');
  const [rationale, setRationale] = useState('');
  const [grantRef, setGrantRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DecisionResult | null>(null);

  async function submit() {
    if (rationale.trim().length < 10) {
      await dialogs.alert('Decision rationale must be at least 10 characters.');
      return;
    }
    const prem = premium ? Number(premium) : undefined;
    if (outcome === 'QUOTE' && (prem === undefined || Number.isNaN(prem) || prem <= 0)) {
      await dialogs.alert('A QUOTE outcome requires a premium greater than 0.');
      return;
    }
    setBusy(true);
    try {
      const res = (await api.post(withCompany('/uw/decisions', companyId), {
        submissionId: submission.id,
        outcome,
        premium: prem !== undefined && !Number.isNaN(prem) ? prem : undefined,
        rationale: rationale.trim(),
        authorityGrantRef: grantRef.trim() || undefined,
      })) as DecisionResult;
      setResult(res);
      onDone();
    } catch (e) {
      await dialogs.alert({ title: 'Decision blocked', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Record decision" badge={<StatusPill tone="blue">INV-1</StatusPill>}>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="uw-outcome">Outcome</Label>
          <Select id="uw-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="QUOTE">QUOTE</option>
            <option value="DECLINE">DECLINE</option>
            <option value="REFER">REFER</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="uw-premium">Premium (USD)</Label>
          <Input
            id="uw-premium"
            type="number"
            min={0}
            value={premium}
            onChange={(e) => setPremium(e.target.value)}
            placeholder="e.g. 185000"
          />
        </div>
        <div>
          <Label htmlFor="uw-grant">Authority grant ref (optional)</Label>
          <Input
            id="uw-grant"
            value={grantRef}
            onChange={(e) => setGrantRef(e.target.value)}
            placeholder="AG-31 — defaults to your operating role's grant"
          />
        </div>
        <div className="sm:col-span-4">
          <Label htmlFor="uw-rationale">Rationale (min 10 characters)</Label>
          <Textarea
            id="uw-rationale"
            rows={2}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Why this outcome — cited in the governance event"
          />
        </div>
      </div>
      <div className="mt-3">
        <Button className="text-xs" disabled={busy} onClick={submit}>
          Record decision
        </Button>
      </div>

      {result && (
        <div className="mt-4 space-y-3">
          <div className="text-[12px] text-[#171717]">
            Recorded <span className="font-semibold">{result.decision.outcome}</span> — authority{' '}
            <StatusPill tone={result.decision.authorityResult === 'PASS' ? 'green' : 'amber'}>
              {result.decision.authorityResult}
            </StatusPill>
          </div>
          {result.authorityDetail && (
            <ul className="space-y-1">
              {result.authorityDetail.checks.map((c) => (
                <li key={c.limit} className="flex items-center gap-2 text-[12px]">
                  <span className={c.pass ? 'text-[#047857]' : 'text-[#be123c]'}>
                    {c.pass ? '✓' : '✕'}
                  </span>
                  <span className="font-medium text-[#171717]">{c.limit}</span>
                  <span className="text-[#737373]">
                    bound {c.bound} · actual {c.actual}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {result.referral && (
            <div className="rounded-md border border-[#fcd34d] bg-[#fffbeb] p-3 text-[12px] text-[#92400e]">
              <span className="font-semibold">Referral opened</span> — {result.referral.reason} ·
              SLA {fmtDateTime(result.referral.slaDueAt)} · escalated to{' '}
              {result.referral.escalatedToRole?.displayValue ?? 'the escalation chain'}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

// ── Referral resolution (LLR-11) ─────────────────────────────────────────────

export function ReferralsPanel({
  referrals,
  onDone,
}: {
  referrals: ReferralCase[];
  onDone: () => void;
}) {
  const dialogs = useDialogs();
  const [busy, setBusy] = useState(false);

  async function resolve(r: ReferralCase, resolution: 'approve' | 'decline' | 'return') {
    const rationale = await dialogs.prompt({
      title: `${resolution[0].toUpperCase()}${resolution.slice(1)} referral`,
      message: 'The resolver must sit in the escalation chain (Roles catalog).',
      label: 'Resolution rationale (min 20 characters)',
      confirmLabel: 'Resolve',
    });
    if (rationale === null) return;
    if (rationale.length < 20) {
      await dialogs.alert('Resolution rationale must be at least 20 characters.');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/uw/referrals/${r.id}/resolve`, { resolution, rationale });
      onDone();
    } catch (e) {
      await dialogs.alert({ title: 'Resolution blocked (LLR-11)', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  if (!referrals.length) return null;
  return (
    <Panel title="Referrals">
      <div className="space-y-2">
        {referrals.map((r) => (
          <div key={r.id} className="rounded-md border border-[#eaeaea] p-3">
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <StatusPill
                tone={r.status === 'OPEN' ? 'amber' : r.status === 'APPROVED' ? 'green' : 'slate'}
              >
                {r.status}
              </StatusPill>
              <span className="text-[#171717]">{r.reason}</span>
              <span className="text-[#737373]">
                → {r.escalatedToRole?.displayValue ?? '—'} · SLA {fmtDateTime(r.slaDueAt)}
                {r.resolvedBy ? ` · resolved by ${r.resolvedBy}` : ''}
              </span>
            </div>
            {r.status === 'OPEN' && (
              <div className="mt-2 flex gap-2">
                <Button className="text-xs" disabled={busy} onClick={() => resolve(r, 'approve')}>
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  className="text-xs"
                  disabled={busy}
                  onClick={() => resolve(r, 'decline')}
                >
                  Decline
                </Button>
                <Button
                  variant="secondary"
                  className="text-xs"
                  disabled={busy}
                  onClick={() => resolve(r, 'return')}
                >
                  Return
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

// (Quote & bind moved to QuoteBindPanel.tsx — file-size budget.)
