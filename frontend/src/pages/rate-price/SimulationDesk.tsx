// Simulation & Optimization (CAP-05/06, HLR-05/06). Jurisdiction rule sets
// are DATA owned by compliance (ADR-006): restricted states render the
// blocking flag rail, jobs stay BLOCKED until a P6 human acknowledges
// (LLR-06.1 — the agent plane has no path through this gate), and completed
// runs show the disruption preview (premium-change buckets).
import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useCompany } from '../../lib/company';
import { useDialogs } from '../../lib/dialogs';
import { withCompany } from '../../lib/portfolio';
import { Button, Card, Chip, EmptyState, ErrorMessage, StatusPill } from '../../components/ui';
import { errMsg, type OptimizationJob, type RuleSet } from './types';

const DEMO_PORTFOLIO = [
  {
    payroll: 1_200_000,
    classCode: '91560',
    lossRatio3yr: 0.42,
    safetyProgram: true,
    tiv: 2_400_000,
    territory: 'T1',
    sprinklered: true,
    catZone: 'LOW',
  },
  {
    payroll: 850_000,
    classCode: '91580',
    lossRatio3yr: 0.61,
    safetyProgram: false,
    tiv: 5_100_000,
    territory: 'T2',
    sprinklered: false,
    catZone: 'MODERATE',
  },
  {
    payroll: 2_400_000,
    classCode: '98305',
    lossRatio3yr: 0.55,
    safetyProgram: true,
    tiv: 950_000,
    territory: 'T3',
    sprinklered: true,
    catZone: 'HIGH',
  },
  {
    payroll: 430_000,
    classCode: '91560',
    lossRatio3yr: 0.31,
    safetyProgram: false,
    tiv: 1_700_000,
    territory: 'T2',
    sprinklered: true,
    catZone: 'LOW',
  },
  {
    payroll: 3_800_000,
    classCode: '91580',
    lossRatio3yr: 0.7,
    safetyProgram: true,
    tiv: 8_800_000,
    territory: 'T3',
    sprinklered: false,
    catZone: 'HIGH',
  },
];

const jobTone = (status: string) =>
  status === 'COMPLETED'
    ? 'green'
    : status === 'BLOCKED'
      ? 'red'
      : status === 'RUNNING'
        ? 'blue'
        : 'amber';

export default function SimulationDesk() {
  const { companyId } = useCompany();
  const dialogs = useDialogs();
  const ruleSets = useApi<RuleSet[]>(withCompany('/rate-price/rule-sets', companyId));
  const jobs = useApi<OptimizationJob[]>(withCompany('/rate-price/optimization-jobs', companyId));
  const [busy, setBusy] = useState(false);

  async function acknowledge(job: OptimizationJob) {
    const ok = await dialogs.confirm({
      title: `Compliance acknowledgment — ${job.version?.model.ref ?? 'job'}`,
      message:
        `Restricted jurisdictions: ${(job.constraints?.restrictedCodes ?? []).join(', ') || '—'}. ` +
        'Acknowledging as Compliance (P6) unblocks this optimization run; the acknowledgment is recorded on the governance spine. Agent actors cannot supply it.',
      confirmLabel: 'Acknowledge as P6',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.post(
        withCompany(`/rate-price/optimization-jobs/${job.id}/acknowledge`, companyId),
        { actorKind: 'HUMAN' },
      );
      jobs.refetch();
    } catch (e) {
      await dialogs.alert({ title: 'Acknowledgment rejected', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function run(job: OptimizationJob) {
    setBusy(true);
    try {
      await api.post(withCompany(`/rate-price/optimization-jobs/${job.id}/run`, companyId), {
        rateChangePct: 4,
        scenarioSteps: 3,
        portfolio: DEMO_PORTFOLIO,
      });
      jobs.refetch();
    } catch (e) {
      await dialogs.alert({ title: 'Run blocked', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  const restricted = (ruleSets.data ?? []).filter((r) => r.optimizationRestricted);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-4">
        <h3 className="text-[13px] font-semibold mb-3">Jurisdiction rule sets</h3>
        {ruleSets.error && <ErrorMessage>{ruleSets.error}</ErrorMessage>}
        <ul className="space-y-2">
          {(ruleSets.data ?? []).map((rs) => (
            <li key={rs.id} className="rounded-md border border-[#eaeaea] px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium">
                  {rs.code}
                  {rs.jurisdiction?.name && (
                    <span className="text-[#737373] font-normal"> · {rs.jurisdiction.name}</span>
                  )}
                </span>
                <StatusPill tone={rs.optimizationRestricted ? 'red' : 'green'}>
                  {rs.optimizationRestricted ? 'restricted' : 'permitted'}
                </StatusPill>
              </div>
              <div className="mt-1 text-[11px] text-[#737373]">
                {rs.constraints.map((c) => (
                  <div key={`${c.kind}-${String(c.value)}`}>
                    {c.kind}: {String(c.value)}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
        {restricted.length > 0 && (
          <p className="mt-3 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[11px] text-[#991b1b]">
            ⛔ {restricted.map((r) => r.code).join(', ')} restrict price optimization for this
            product context — jobs targeting them stay BLOCKED until Compliance (P6) acknowledges
            (LLR-06.1). Missing rule-set rows also block: the table is authoritative, never
            inference.
          </p>
        )}
      </Card>

      <Card className="p-4 lg:col-span-2">
        <h3 className="text-[13px] font-semibold mb-3">Optimization jobs</h3>
        {jobs.error && <ErrorMessage>{jobs.error}</ErrorMessage>}
        {!jobs.loading && !(jobs.data ?? []).length && (
          <EmptyState
            baseClassName="text-sm text-[#a3a3a3]"
            message="No optimization jobs — create one from a published model version."
          />
        )}
        <ul className="space-y-3">
          {(jobs.data ?? []).map((job) => (
            <li key={job.id} className="rounded-md border border-[#eaeaea] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium">
                  {job.version?.model.ref} v{job.version?.semver}
                </span>
                <span className="text-[12px] text-[#737373]">{job.objective}</span>
                <span className="ml-auto" />
                <StatusPill tone={jobTone(job.status)}>{job.status}</StatusPill>
                {job.status === 'BLOCKED' && (
                  <Button
                    variant="secondary"
                    className="text-[11px]"
                    disabled={busy}
                    onClick={() => void acknowledge(job)}
                  >
                    Route to P6 · acknowledge
                  </Button>
                )}
                {job.status === 'READY' && (
                  <Button className="text-[11px]" disabled={busy} onClick={() => void run(job)}>
                    Run +4% scenario sweep
                  </Button>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                {(job.constraints?.targetJurisdictions ?? []).map((code) => (
                  <Chip
                    key={code}
                    className={
                      (job.constraints?.restrictedCodes ?? []).includes(code)
                        ? 'border-[#fecaca] text-[#991b1b]'
                        : undefined
                    }
                  >
                    {code}
                  </Chip>
                ))}
                {job.constraints?.perRiskCapPct != null && (
                  <span className="text-[#737373]">
                    per-risk cap ±{job.constraints.perRiskCapPct}%
                  </span>
                )}
                {job.complianceAckBy && (
                  <span className="text-[#15803d]">P6 ack: {job.complianceAckBy}</span>
                )}
              </div>
              {job.resultSummary && (
                <div className="mt-2 border-t border-[#f0f0f0] pt-2">
                  <p className="text-[11px] text-[#737373] mb-1">
                    Disruption preview — {job.resultSummary.portfolioSize} risks ·{' '}
                    {job.resultSummary.scenarios.length} scenarios · cap ±
                    {job.resultSummary.perRiskCapPct}%
                  </p>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wide text-[#737373]">
                        <th className="pb-1">Premium change</th>
                        {job.resultSummary.scenarios.map((s) => (
                          <th key={s.scale} className="pb-1 text-right tabular-nums">
                            ×{s.scale.toFixed(3)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {job.resultSummary.scenarios[0]?.buckets.map((bucket, i) => (
                        <tr key={bucket.label} className="border-t border-[#f5f5f5]">
                          <td className="py-1">{bucket.label}</td>
                          {job.resultSummary?.scenarios.map((s) => (
                            <td key={s.scale} className="py-1 text-right tabular-nums">
                              {s.buckets[i]?.pctOfBook ?? 0}%
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
