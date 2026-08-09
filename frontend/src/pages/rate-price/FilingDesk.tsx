// Filing Desk (CAP-15, HLR-14 — Earnix Filing-Accelerator pattern). Programs
// with their SERFF packets: sections generated from the implementing published
// version, jurisdiction checklist bound to compliance-register items (the
// satisfies edge — generation refuses while any bound item is unresolved,
// RATE-T-012), and submit as the declared filing-submit review point.
import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useCompany } from '../../lib/company';
import { useDialogs } from '../../lib/dialogs';
import { withCompany } from '../../lib/portfolio';
import { Button, Card, Chip, EmptyState, ErrorMessage, StatusPill } from '../../components/ui';
import { errMsg, type FilingPacket, type RateProgram } from './types';

const packetTone = (status: string) =>
  status === 'accepted'
    ? 'green'
    : status === 'submitted'
      ? 'blue'
      : status === 'objection'
        ? 'red'
        : 'amber';
const sectionTone = (status: string) =>
  status === 'generated' || status === 'linked' || status === 'bound' ? 'green' : 'amber';

export default function FilingDesk() {
  const { companyId } = useCompany();
  const dialogs = useDialogs();
  const programs = useApi<RateProgram[]>(withCompany('/rate-price/programs', companyId));
  const [busy, setBusy] = useState(false);

  async function submit(program: RateProgram, packet: FilingPacket) {
    const ok = await dialogs.confirm({
      title: `Submit filing — ${program.ref} · ${program.jurisdiction}`,
      message:
        'Submission is a declared review point (filing-submit). The packet export carries its governance-trace excerpt for the examiner.',
      confirmLabel: 'Submit for review point',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.post(withCompany(`/rate-price/filing-packets/${packet.id}/submit`, companyId), {});
      programs.refetch();
    } catch (e) {
      await dialogs.alert({ title: 'Submission blocked', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {programs.error && <ErrorMessage>{programs.error}</ErrorMessage>}
      {!programs.loading && !(programs.data ?? []).length && (
        <Card className="p-8 text-center">
          <EmptyState
            baseClassName="text-sm text-[#a3a3a3]"
            message="No rate programs yet — a program is a product × state × effective-date filing construct."
          />
        </Card>
      )}
      {(programs.data ?? []).map((program) => (
        <Card key={program.id} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold">
              {program.ref} — {program.product}
            </span>
            <Chip>{program.lob}</Chip>
            <Chip>{program.jurisdiction}</Chip>
            {program.effectiveDate && (
              <span className="text-[12px] text-[#737373]">
                effective {new Date(program.effectiveDate).toLocaleDateString('en-US')}
              </span>
            )}
            <span className="ml-auto" />
            <StatusPill
              tone={
                program.filingStatus === 'approved'
                  ? 'green'
                  : program.filingStatus === 'filed'
                    ? 'blue'
                    : program.filingStatus === 'withdrawn'
                      ? 'red'
                      : 'amber'
              }
            >
              {program.filingStatus}
            </StatusPill>
          </div>
          <div className="mt-1 text-[12px] text-[#737373]">
            implemented by{' '}
            {(program.modelLinks ?? []).map((l) => `${l.model.ref} (${l.model.name})`).join(', ') ||
              '—'}
          </div>
          {(program.filingPackets ?? []).map((packet) => (
            <div key={packet.id} className="mt-3 rounded-md border border-[#eaeaea] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-medium">Filing packet</span>
                <StatusPill tone={packetTone(packet.status)}>{packet.status}</StatusPill>
                {packet.serffTrackingNo && (
                  <span className="text-[11px] tabular-nums text-[#737373]">
                    {packet.serffTrackingNo}
                  </span>
                )}
                <span className="ml-auto" />
                {packet.status === 'draft' && (
                  <Button
                    className="text-[11px]"
                    disabled={busy}
                    onClick={() => void submit(program, packet)}
                  >
                    Submit for review point: filing-submit
                  </Button>
                )}
              </div>
              <table className="mt-2 w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-[#737373]">
                    <th className="pb-1">Section</th>
                    <th className="pb-1">Status</th>
                    <th className="pb-1">Bound compliance item</th>
                  </tr>
                </thead>
                <tbody>
                  {packet.sections.map((s) => (
                    <tr key={s.name} className="border-t border-[#f5f5f5]">
                      <td className="py-1.5">
                        {s.name}
                        {s.detail && <span className="text-[#a3a3a3]"> · {s.detail}</span>}
                      </td>
                      <td className="py-1.5">
                        <StatusPill tone={sectionTone(s.status)}>{s.status}</StatusPill>
                      </td>
                      <td className="py-1.5 tabular-nums text-[#737373]">
                        {s.boundComplianceRef ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {packet.submittedBy && (
                <p className="mt-1.5 text-[11px] text-[#737373]">
                  submitted by {packet.submittedBy}
                  {packet.submittedAt &&
                    ` · ${new Date(packet.submittedAt).toLocaleString('en-US')}`}
                </p>
              )}
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
