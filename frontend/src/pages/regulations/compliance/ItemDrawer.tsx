/**
 * Compliance item drawer — the read-first detail panel for one L2 item, laid
 * out in the workbook's two zones (task → grounding evidence).
 */
import { Link } from 'react-router-dom';
import { useApi } from '../../../lib/useApi';
import { withCompany } from '../../../lib/portfolio';
import { DrawerShell, ErrorMessage, LoadingState } from '../../../components/ui';
import { ConfidenceBadge, SignOffBadge, FREQ_ALIGN_LABEL, type ItemDetail } from './shared';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[#a3a3a3]">{label}</div>
      <div className="text-sm text-[#171717]">{children}</div>
    </div>
  );
}

function Zone({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#525252] mb-2">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function ItemDrawer({
  itemId,
  companyId,
  onClose,
}: {
  itemId: string;
  companyId: string | null;
  onClose: () => void;
}) {
  const {
    data: item,
    error,
    loading,
  } = useApi<ItemDetail>(
    withCompany(`/regulations/compliance-register/items/${itemId}`, companyId),
  );

  return (
    // Fixed wrapper gives the DrawerShell's absolute positioning a
    // viewport-sized box regardless of how far the page is scrolled.
    <div className="fixed inset-0 z-40">
      <DrawerShell
        onClose={onClose}
        width={640}
        maxWidth="94vw"
        header={
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-[#a3a3a3]">
              {item ? `${item.regulation.regCode} · ${item.regulation.name}` : 'Compliance item'}
            </div>
            <div className="text-sm font-semibold text-[#171717] flex items-center gap-2 flex-wrap">
              {item?.itemCode}
              {item && <ConfidenceBadge confidence={item.confidence} />}
              {item && <SignOffBadge signOff={item.signOff} />}
            </div>
          </div>
        }
      >
        {loading && <LoadingState message="Loading item…" />}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {item && (
          <>
            <Zone title="The task">
              <p className="text-sm text-[#171717]">{item.name}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Owner">{item.ownerTeam}</Field>
                <Field label="Frequency">{item.frequency}</Field>
                <Field label="Evidence">{item.evidence}</Field>
                <Field label="Jurisdiction scope">{item.jurisdictionScope}</Field>
              </div>
            </Zone>

            <Zone title="Grounding evidence">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Supporting source rows">
                  {item.supportingReqRows.toLocaleString()} (
                  {item.officialSourceRows.toLocaleString()} official)
                </Field>
                <Field label="Grounding basis">
                  {item.groundingBasis === 'ITEM' ? 'Item-level match' : 'Regulation-level'}
                </Field>
                <Field label="Frequency (derived)">
                  {item.frequencyDerived} ·{' '}
                  {FREQ_ALIGN_LABEL[item.frequencyAlignment] ?? item.frequencyAlignment}
                </Field>
                <Field label="Deadline signals">{item.deadlineSignals || '—'}</Field>
              </div>
              <Field label={`Representative requirement (${item.repJurisdiction})`}>
                <blockquote className="border-l-2 border-[#eaeaea] pl-3 text-[13px] text-[#525252]">
                  {item.representativeRequirement}
                </blockquote>
              </Field>
              <Field label="Supporting citations (top 3)">
                <span className="text-[13px]">{item.supportingCitations || '—'}</span>
              </Field>
              {item.selectedRequirements.length > 0 && (
                <Field label="Selected source rows">
                  <ul className="text-[13px] space-y-0.5">
                    {item.selectedRequirements.map((r) => (
                      <li key={r.id}>
                        <Link
                          className="text-[#2563eb] hover:underline"
                          to={`/regulations/requirement/${r.id}`}
                        >
                          {r.jurisdiction.name}: {r.citation ?? r.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Field>
              )}
              <Field
                label={`Source rows of ${item.regulation.regCode} (${item.sourceRowCount.toLocaleString()} total, showing ${item.sourceRows.length})`}
              >
                <ul className="text-[13px] space-y-1 max-h-56 overflow-y-auto border border-[#eaeaea] rounded-md p-2">
                  {item.sourceRows.map((r) => (
                    <li key={r.id} className="flex items-start gap-2">
                      <span className="min-w-0">
                        <Link
                          className="text-[#2563eb] hover:underline"
                          to={`/regulations/requirement/${r.id}`}
                        >
                          {r.jurisdiction.name}
                        </Link>
                        : {r.citation ?? r.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </Field>
            </Zone>
          </>
        )}
      </DrawerShell>
    </div>
  );
}
