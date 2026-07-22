/**
 * Compliance item drawer — the read-first detail panel for one L2 item.
 * Two card sections: the task, then the regulation's full requirement +
 * citation coverage — every jurisdiction's obligation shown once per distinct
 * citation, never repeated.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../../lib/useApi';
import { withCompany } from '../../../lib/portfolio';
import { DrawerShell, ErrorMessage, LoadingState } from '../../../components/ui';
import { valueText, type Plan } from '../../work-library/shared';
import { type ItemDetail } from './shared';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[#a3a3a3] mb-0.5">{label}</div>
      <div className="text-sm text-[#171717]">{children}</div>
    </div>
  );
}

/** Bordered section card — keeps the drawer's zones visually separate. */
function Zone({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 rounded-lg border border-[#eaeaea] bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#fafafa] border-b border-[#eaeaea]">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#525252]">{title}</h3>
        {action}
      </div>
      <div className="space-y-3 p-3">{children}</div>
    </section>
  );
}

/** Read-only rendering of one Work Library plan block (checklist or testing). */
function PlanReadOnly({ plan, kind }: { plan: Plan; kind: 'CHECKLIST' | 'TEST' }) {
  const sections = plan.sections.filter((s) => s.kind === kind);
  const custom = plan.customRows.filter((r) =>
    kind === 'TEST' ? r.kind === 'TEST' : r.kind !== 'TEST',
  );
  if (sections.length === 0 && custom.length === 0)
    return (
      <p className="text-[12px] text-[#a3a3a3]">
        No {kind === 'TEST' ? 'testing' : 'checklist'} pattern assigned yet.
      </p>
    );
  let n = 0;
  return (
    <div>
      {sections.map((s) => (
        <div key={s.id}>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#a3a3a3] mb-1">
            {s.name}
          </div>
          <ul className="divide-y divide-[#f5f5f5] mb-2">
            {s.keys
              .filter((k) => !k.answer?.suppressed)
              .map((k) => (
                <li key={k.id} className="flex items-baseline gap-2 py-1">
                  <span className="w-5 shrink-0 text-right text-[11px] text-[#a3a3a3] tabular-nums">
                    {++n}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] text-[#171717]">{k.key}</span>
                  <span className="min-w-0 max-w-[45%] text-right text-[12.5px] text-[#525252]">
                    {valueText(k.answer) || <span className="text-[#d4d4d4]">—</span>}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}
      {custom.length > 0 && (
        <ul className="divide-y divide-[#f5f5f5]">
          {custom.map((r) => (
            <li key={r.id} className="flex items-baseline gap-2 py-1">
              <span className="w-5 shrink-0 text-right text-[11px] text-[#a3a3a3] tabular-nums">
                {++n}
              </span>
              <span className="min-w-0 flex-1 text-[13px] text-[#171717]">{r.customKey}</span>
              <span className="min-w-0 max-w-[45%] text-right text-[12.5px] text-[#525252]">
                {valueText(r) || <span className="text-[#d4d4d4]">—</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
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
  // Collapsed by default — the first three citations preview the coverage;
  // the toggle reveals the full jurisdiction list.
  const [showAllCitations, setShowAllCitations] = useState(false);
  const CITATION_PREVIEW = 3;
  // The item's Work Library checklist/testing plan, shown read-only below the
  // citations; editing happens on the Work Library page itself.
  const { data: plan } = useApi<Plan>(`/work-library/plan/compliance/${itemId}`);

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

            <Zone
              title={`Requirements & citations — all jurisdictions (${item.citations.length.toLocaleString()})`}
            >
              <ul className="divide-y divide-[#f5f5f5]">
                {(showAllCitations
                  ? item.citations
                  : item.citations.slice(0, CITATION_PREVIEW)
                ).map((c) => (
                  <li key={c.citation} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {c.jurisdictions.map((j) => (
                        <span
                          key={j.code}
                          title={j.name}
                          className="inline-block rounded border border-[#eaeaea] bg-[#fafafa] px-1.5 py-0.5 text-[10.5px] font-medium text-[#525252]"
                        >
                          {j.name}
                        </span>
                      ))}
                    </div>
                    <p className="text-[13px] text-[#171717] leading-relaxed">{c.requirement}</p>
                    <Link
                      className="text-[12px] text-[#2563eb] hover:underline break-words"
                      to={`/regulations/requirement/${c.requirementId}`}
                    >
                      {c.citation}
                    </Link>
                  </li>
                ))}
              </ul>
              {item.citations.length > CITATION_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAllCitations((v) => !v)}
                  className="text-[12px] font-medium text-[#2563eb] hover:underline"
                >
                  {showAllCitations
                    ? 'Show less'
                    : `Show all ${item.citations.length.toLocaleString()} jurisdictions`}
                </button>
              )}
            </Zone>

            <Zone
              title="Checklist & testing plan"
              action={
                <Link
                  className="text-[11px] font-medium text-[#2563eb] hover:underline whitespace-nowrap"
                  to={`/work-library?type=compliance&id=${item.id}`}
                >
                  Edit in Work Library →
                </Link>
              }
            >
              {!plan ? (
                <LoadingState baseClassName="text-[12px] text-[#a3a3a3]" message="Loading plan…" />
              ) : plan.assignedTemplateIds.length === 0 && plan.customRows.length === 0 ? (
                <p className="text-[12px] text-[#a3a3a3]">
                  No checklist or testing plan yet — set one up in the Work Library.
                </p>
              ) : (
                <>
                  <Field label="Checklist">
                    <PlanReadOnly plan={plan} kind="CHECKLIST" />
                  </Field>
                  <Field label="Testing">
                    <PlanReadOnly plan={plan} kind="TEST" />
                  </Field>
                </>
              )}
            </Zone>
          </>
        )}
      </DrawerShell>
    </div>
  );
}
