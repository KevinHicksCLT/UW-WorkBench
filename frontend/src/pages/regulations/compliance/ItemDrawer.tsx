/**
 * Compliance item drawer — the read-first detail panel for one L2 item.
 * Sections are visually separated cards: the task → grounding evidence →
 * the regulation's full citation coverage (every jurisdiction, each distinct
 * citation listed once with the jurisdictions that carry it).
 */
import { Link } from 'react-router-dom';
import { useApi } from '../../../lib/useApi';
import { withCompany } from '../../../lib/portfolio';
import { DrawerShell, ErrorMessage, LoadingState } from '../../../components/ui';
import { FREQ_ALIGN_LABEL, type ItemDetail } from './shared';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[#a3a3a3] mb-0.5">{label}</div>
      <div className="text-sm text-[#171717]">{children}</div>
    </div>
  );
}

/** Bordered section card — keeps the drawer's zones visually separate. */
function Zone({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-lg border border-[#eaeaea] bg-white overflow-hidden">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#525252] px-3 py-2 bg-[#fafafa] border-b border-[#eaeaea]">
        {title}
      </h3>
      <div className="space-y-3 p-3">{children}</div>
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
        width={720}
        maxWidth="94vw"
        header={
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-[#a3a3a3]">
              {item ? `${item.regulation.regCode} · ${item.regulation.name}` : 'Compliance item'}
            </div>
            <div className="text-sm font-semibold text-[#171717]">{item?.itemCode}</div>
          </div>
        }
      >
        {loading && <LoadingState message="Loading item…" />}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {item && (
          <>
            <Zone title="The task">
              <p className="text-sm text-[#171717] leading-relaxed">{item.name}</p>
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
                <blockquote className="border-l-2 border-[#eaeaea] pl-3 text-[13px] text-[#525252] leading-relaxed">
                  {item.representativeRequirement}
                </blockquote>
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
            </Zone>

            <Zone
              title={`Citations — all jurisdictions (${item.citations.length.toLocaleString()} distinct across ${item.sourceRowCount.toLocaleString()} source rows)`}
            >
              <ul className="divide-y divide-[#f5f5f5]">
                {item.citations.map((c) => (
                  <li key={c.citation} className="py-2 first:pt-0 last:pb-0">
                    <Link
                      className="text-[13px] font-medium text-[#2563eb] hover:underline break-words"
                      to={`/regulations/requirement/${c.requirementId}`}
                    >
                      {c.citation}
                    </Link>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.jurisdictions.map((j) => (
                        <span
                          key={j.code}
                          title={j.name}
                          className="inline-block rounded border border-[#eaeaea] bg-[#fafafa] px-1.5 py-0.5 text-[10.5px] text-[#525252]"
                        >
                          {j.name}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </Zone>
          </>
        )}
      </DrawerShell>
    </div>
  );
}
