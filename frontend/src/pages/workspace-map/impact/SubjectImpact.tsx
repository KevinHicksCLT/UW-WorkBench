import { useEffect, useRef, useState } from 'react';
import { useImpactGate } from './useImpactGate';
import ImpactPanel from './ImpactPanel';
import AssessmentHistory, { reopenAssessment } from './AssessmentHistory';
import type { ImpactSubject } from './types';

// The self-contained impact-assessment surface for a subject's own detail page
// (Change Impact v2, Workstream D — assessment history surfaces). Drops onto the
// value-stream node (Inspector), role profile and application detail: an "Assess
// change impact" button that opens the staged panel (Intent stage first, per-lens
// taxonomy dropdown), the saved-packet history for that subject, and the panel
// itself. Reopening a row replays its stored snapshot. Bumps a refresh token when
// the panel closes so a freshly-saved packet appears without a manual reload.

export default function SubjectImpact({
  subject,
  subjectKind,
  subjectId,
  label,
  changeType,
  className,
}: {
  subject: ImpactSubject;
  /** The subjectKind filter for the history query (matches the stored row). */
  subjectKind: string;
  /** The primary id inside the subject ref the history query matches on. */
  subjectId: string;
  /** Display name shown in the panel header. */
  label: string;
  /** The change type the Intent stage starts on — the reviewer can pick another
   *  from the lens taxonomy before running the assessment. */
  changeType: string;
  className?: string;
}) {
  const gate = useImpactGate();
  const [refresh, setRefresh] = useState(0);
  const wasOpen = useRef(false);
  useEffect(() => {
    const open = !!gate.state;
    if (wasOpen.current && !open) setRefresh((n) => n + 1);
    wasOpen.current = open;
  }, [gate.state]);

  return (
    <div className={className ?? 'space-y-2'}>
      <button
        type="button"
        onClick={() => gate.run({ changeType, label, subject, pickable: true }, () => {})}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#2f6fb2]/40 bg-[#2f6fb2]/5 px-2.5 py-1.5 text-xs font-semibold text-[#2f6fb2] transition-colors duration-150 hover:bg-[#2f6fb2]/10"
      >
        Assess change impact
      </button>
      <AssessmentHistory
        subjectKind={subjectKind}
        subjectId={subjectId}
        refreshToken={refresh}
        onOpen={(id) => reopenAssessment(gate, id)}
      />
      <ImpactPanel gate={gate} />
    </div>
  );
}
