/**
 * Pending-aware display derivation for the operating-model map. Overlays the
 * staged (unsaved) moves/reorders onto the fetched data: SAME-LEVEL re-homes
 * are rendered under their new parent (removed from the source row, injected
 * into the target row, matching element type); RE-LEVEL moves stay in place
 * flagged and reconcile on Save. Extracted verbatim from MapCanvas.
 */
import { useMemo } from 'react';

import type { DivisionSummary, DivisionFlow, FlowStep, FlowValueStream } from '../model';
import { synthStep, type MoveRec } from './constants';

export type UseStagedDisplayArgs = {
  divisions: DivisionSummary[];
  dirty: boolean;
  pendingMoves: Map<string, MoveRec>;
  applyOrder: <T>(parentRaw: string | null, arr: T[], idOf: (t: T) => string) => T[];
  domainCatById: Map<string, string>;
  flowData: DivisionFlow | null;
  vsFlowData: DivisionFlow | null;
  focusedDivisionId: string | null;
  focusedVsId: string | null;
  focusedStepId: string | null;
  focusedSubStepId: string | null;
};

export function useStagedDisplay({
  divisions, dirty, pendingMoves, applyOrder, domainCatById,
  flowData, vsFlowData, focusedDivisionId, focusedVsId, focusedStepId, focusedSubStepId,
}: UseStagedDisplayArgs) {
  // L2 divisions: a same-level re-home to another domain is relabeled into the new
  // domain's column (the layout groups by higherCategory).
  const displayDivisions = useMemo<DivisionSummary[]>(() => {
    if (!dirty) return divisions;
    return divisions.flatMap((d) => {
      const rec = pendingMoves.get(d.id);
      if (rec && !rec.sameLevel) return []; // re-leveled out of L2 → leaves the divisions row
      if (rec && rec.sameLevel && domainCatById.has(rec.parent)) {
        return [{ ...d, higherCategory: domainCatById.get(rec.parent)!, higherCategoryId: rec.parent }];
      }
      return [d];
    });
  }, [divisions, dirty, pendingMoves, domainCatById]);
  const focusedDivision = displayDivisions.find((d) => d.id === focusedDivisionId) ?? null;

  // L3 renders only the value streams this division LEADS (render-only filter; the
  // other participations remain in the DB, just not drawn on the map). Exception:
  // a deep-linked focus VS that this division participates in but doesn't lead is
  // appended so the user still lands on it (links resolve to the strongest, not
  // necessarily leading, division — see /explorer/value-stream/:id/focus).
  const leadStreams: FlowValueStream[] = (flowData?.valueStreams ?? []).filter((vs) => vs.participationType === 'Lead');
  const focusedExtra = focusedVsId && !leadStreams.some((vs) => vs.id === focusedVsId)
    ? (flowData?.valueStreams ?? []).find((vs) => vs.id === focusedVsId) ?? null
    : null;
  const leadBase: FlowValueStream[] = focusedExtra ? [...leadStreams, focusedExtra] : leadStreams;
  const valueStreams = useMemo<FlowValueStream[]>(() => {
    if (!flowData || !focusedDivisionId) return leadBase;
    let list = leadBase.filter((vs) => { const r = pendingMoves.get(vs.id); return !(r && r.parent !== focusedDivisionId); });
    for (const [id, rec] of pendingMoves) {
      // any box staged to move UNDER this focused division shows as one of its L3s
      if (rec.parent === focusedDivisionId && !list.some((vs) => vs.id === id)) {
        list = [...list, { id, name: rec.name, participationType: 'Lead' }];
      }
    }
    return applyOrder(focusedDivisionId, list, (vs) => vs.id);
  }, [leadBase, flowData, focusedDivisionId, pendingMoves, applyOrder]);  
  const focusedVs = valueStreams.find((vs) => vs.id === focusedVsId) ?? null;

  // L4 steps under the focused VS + L5 sub-steps under the focused step.
  const stepsBase: FlowStep[] = vsFlowData?.selected?.steps ?? [];
  const steps = useMemo<FlowStep[]>(() => {
    if (!vsFlowData) return stepsBase;
    let list = stepsBase.filter((s) => { const r = pendingMoves.get(s.id); return !(r && r.parent !== focusedVsId); });
    if (focusedVsId) {
      for (const [id, rec] of pendingMoves) {
        // any box staged to move UNDER this focused value stream shows as one of its L4 steps
        if (rec.parent === focusedVsId && !list.some((s) => s.id === id)) {
          list = [...list, synthStep(id, rec.name)];
        }
      }
      list = applyOrder(focusedVsId, list, (s) => s.id);
    }
    if (focusedStepId) {
      list = list.map((s) => {
        if (s.id !== focusedStepId) return s;
        let subs = s.subSteps.filter((ss) => { const r = pendingMoves.get(ss.id); return !(r && r.parent !== focusedStepId); });
        for (const [id, rec] of pendingMoves) {
          if (rec.parent === focusedStepId && !subs.some((ss) => ss.id === id)) {
            subs = [...subs, { id, name: rec.name, step: 0, l5: [] }];
          }
        }
        subs = applyOrder(focusedStepId, subs, (ss) => ss.id);
        return { ...s, subSteps: subs };
      });
    }
    return list;
  }, [stepsBase, vsFlowData, focusedVsId, focusedStepId, pendingMoves, applyOrder]);  
  const focusedStep = steps.find((s) => s.id === focusedStepId) ?? null;
  const focusedSubStep = focusedStep?.subSteps.find((s) => s.id === focusedSubStepId) ?? null;

  return { displayDivisions, focusedDivision, valueStreams, focusedVs, steps, focusedStep, focusedSubStep };
}
