/**
 * Compliance item drawer — the read-first detail panel for one L2 item, laid
 * out in the workbook's three zones (task → grounding evidence → determination)
 * plus the sign-off workflow (Confirm / Reject / Needs research) and the
 * append-only sign-off history. Confirming a regulation-level item requires
 * selecting the specific supporting L3 rows (upgrades grounding to item-level).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useApi } from '../../../lib/useApi';
import { withCompany } from '../../../lib/portfolio';
import { useDialogs } from '../../../lib/dialogs';
import {
  Button,
  DrawerShell,
  ErrorMessage,
  LoadingState,
  Textarea,
  Label,
} from '../../../components/ui';
import {
  ConfidenceBadge,
  SignOffBadge,
  DETERMINATION_LABEL,
  FREQ_ALIGN_LABEL,
  GUARDRAIL,
  type ItemDetail,
} from './shared';

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
  onChanged,
}: {
  itemId: string;
  companyId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const dialogs = useDialogs();
  const {
    data: item,
    error,
    loading,
    refetch,
  } = useApi<ItemDetail>(
    withCompany(`/regulations/compliance-register/items/${itemId}`, companyId),
  );
  const [note, setNote] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const needsRowSelection = item?.groundingBasis === 'REGULATION';

  const signOff = async (action: 'CONFIRM' | 'REJECT' | 'NEEDS_RESEARCH') => {
    if (!item) return;
    if (action === 'REJECT' && !note.trim()) {
      setActionError('Rejection requires a note.');
      return;
    }
    if (action === 'CONFIRM' && needsRowSelection && selectedRows.size === 0) {
      setSelecting(true);
      setActionError('Select the supporting source rows that ground this item, then confirm.');
      return;
    }
    if (action === 'CONFIRM') {
      const ok = await dialogs.confirm({
        title: `Confirm ${item.itemCode} as a legal determination?`,
        message: 'This records your sign-off in the append-only audit trail.',
        confirmLabel: 'Confirm sign-off',
      });
      if (!ok) return;
    }
    setBusy(true);
    setActionError('');
    try {
      await api.post(
        withCompany(`/regulations/compliance-register/items/${item.id}/sign-off`, companyId),
        {
          action,
          note: note.trim() || undefined,
          supportingRequirementIds: selectedRows.size ? [...selectedRows] : undefined,
        },
      );
      setNote('');
      setSelecting(false);
      setSelectedRows(new Set());
      refetch();
      onChanged();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

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
            {item && item.signOff !== 'CONFIRMED' && (
              <div className="text-[11px] text-[#b45309] mt-0.5">{GUARDRAIL}</div>
            )}
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
                  {item.groundingBasis === 'ITEM'
                    ? 'Item-level match'
                    : 'Regulation-level — counsel to map'}
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
                <Field label="Counsel-selected source rows">
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
                      {selecting && (
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={selectedRows.has(r.id)}
                          onChange={(e) => {
                            const next = new Set(selectedRows);
                            if (e.target.checked) next.add(r.id);
                            else next.delete(r.id);
                            setSelectedRows(next);
                          }}
                        />
                      )}
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

            <Zone title="Determination">
              <Field label="Status">
                {DETERMINATION_LABEL[item.determinationStatus] ?? item.determinationStatus}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Reviewer">{item.reviewer ?? 'Not yet assigned'}</Field>
                <Field label="Audit status">{item.auditStatus}</Field>
              </div>
              {item.reviewNotes && <Field label="Review notes">{item.reviewNotes}</Field>}

              <div className="pt-1 border-t border-[#eaeaea]">
                <Label htmlFor="signoff-note">Note (required to reject)</Label>
                <Textarea
                  id="signoff-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Basis for the determination…"
                />
                {needsRowSelection && (
                  <p className="text-[11px] text-[#b45309] mt-1">
                    Low-confidence item: confirming requires selecting its specific supporting
                    source rows above{selecting ? '' : ' (click Confirm to start selecting)'}.
                  </p>
                )}
                {actionError && (
                  <ErrorMessage className="mt-1 text-sm text-[#be123c]">{actionError}</ErrorMessage>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    className="text-xs px-3 py-1.5"
                    disabled={busy}
                    onClick={() => void signOff('CONFIRM')}
                  >
                    Confirm{selectedRows.size ? ` (${selectedRows.size} rows)` : ''}
                  </Button>
                  <Button
                    className="text-xs px-3 py-1.5 bg-[#be123c] hover:bg-[#9f1239]"
                    disabled={busy}
                    onClick={() => void signOff('REJECT')}
                  >
                    Reject
                  </Button>
                  <Button
                    className="text-xs px-3 py-1.5"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void signOff('NEEDS_RESEARCH')}
                  >
                    Needs research
                  </Button>
                </div>
              </div>

              {item.signOffEvents.length > 0 && (
                <Field label="Sign-off history">
                  <ul className="text-[13px] space-y-1">
                    {item.signOffEvents.map((ev) => (
                      <li key={ev.id}>
                        <span className="font-medium">{ev.action}</span> — {ev.reviewer},{' '}
                        {new Date(ev.createdAt).toLocaleString()}
                        {ev.note ? ` · ${ev.note}` : ''}
                      </li>
                    ))}
                  </ul>
                </Field>
              )}
            </Zone>
          </>
        )}
      </DrawerShell>
    </div>
  );
}
