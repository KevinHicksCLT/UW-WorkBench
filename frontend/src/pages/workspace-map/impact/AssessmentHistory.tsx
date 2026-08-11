import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { changeLabel, type ImpactReport, type ImpactSubject } from './types';
import type { ImpactGate } from './useImpactGate';

/** Fetch a saved packet's stored snapshot and reopen it read-only in the impact
 *  panel. The subjectRef IS the original request subject, so the panel needs no
 *  graph re-walk — it renders exactly what was saved. No-ops on legacy rows that
 *  predate report snapshots. */
export async function reopenAssessment(gate: ImpactGate, id: string): Promise<void> {
  const a = await api.get<{
    subjectRef: ImpactSubject;
    changeType: string;
    subjectName: string;
    intent: string | null;
    report: ImpactReport | null;
  }>(`/impact/assessments/${id}`);
  if (!a.report || !a.report.subject) return;
  gate.openSaved(
    { changeType: a.changeType, subject: a.subjectRef, label: a.subjectName, pickable: false },
    a.report,
    a.intent ?? '',
  );
}

// The saved decision packets for one subject (Change Impact v2, Workstream D) —
// surfaced on the subject's own detail page so the assessment trail lives with
// the thing assessed. The panel is where packets are created; clicking a row
// reopens its stored snapshot (via `onOpen`). `refreshToken` re-fetches when it
// changes (e.g. the panel just closed after a save), so a freshly-saved packet
// appears without a manual reload.

interface Assessment {
  id: string;
  changeType: string;
  status: string;
  recommendation: string | null;
  createdAt: string;
  decidedAt: string | null;
}

/** Status → tone. RECOMMENDED/APPROVED/REJECTED carry the governance colour. */
const STATUS_TONE: Record<string, string> = {
  DRAFT: '#94a3b8',
  ASSESSED: '#2f6fb2',
  RECOMMENDED: '#b45309',
  APPROVED: '#0f766e',
  REJECTED: '#b91c1c',
  FURTHER_ANALYSIS: '#7c3aed',
};

export default function AssessmentHistory({
  subjectKind,
  subjectId,
  refreshToken,
  onOpen,
}: {
  subjectKind: string;
  subjectId: string;
  refreshToken?: number;
  /** Reopen a saved packet by id — makes each row a button. */
  onOpen?: (id: string) => void;
}) {
  const [rows, setRows] = useState<Assessment[] | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .get<Assessment[]>(
        `/impact/assessments?subjectKind=${encodeURIComponent(subjectKind)}&subjectId=${encodeURIComponent(subjectId)}`,
      )
      .then((r) => {
        if (alive) setRows(r);
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [subjectKind, subjectId, refreshToken]);

  // Nothing saved yet — stay quiet rather than showing an empty shell.
  if (!rows || rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#eaeaea] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-2">
        Impact assessments
      </div>
      <div className="space-y-1.5">
        {rows.map((a) => {
          const tone = STATUS_TONE[a.status] ?? '#525252';
          const body = (
            <>
              <span
                className="rounded-full px-2 py-0.5 font-semibold"
                style={{ color: '#fff', background: tone }}
              >
                {a.status.replace(/_/g, ' ').toLowerCase()}
              </span>
              <span className="font-medium text-[#171717]">{changeLabel(a.changeType)}</span>
              <span className="ml-auto text-[#a3a3a3] tnum">
                {new Date(a.createdAt).toLocaleDateString()}
              </span>
            </>
          );
          return onOpen ? (
            <button
              key={a.id}
              type="button"
              onClick={() => onOpen(a.id)}
              title="Reopen this assessment"
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors duration-150 hover:bg-[#f5f5f5]"
            >
              {body}
            </button>
          ) : (
            <div key={a.id} className="flex items-center gap-2 px-1.5 py-1 text-xs">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
