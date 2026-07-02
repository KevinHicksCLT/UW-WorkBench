/**
 * Camera control hook for the operating-model map — fit/center helpers plus
 * the drill-driven camera effects (frame the freshly-opened row on each focus
 * change, top-pinned). Extracted verbatim from MapCanvas; behavior unchanged.
 */
import { useCallback, useEffect, type MutableRefObject } from 'react';
import { getViewportForBounds, type useReactFlow } from '@xyflow/react';

import { MAP_CARD_W, MAP_CARD_H } from '../nodes/MapNode';
import type { DivisionFlow, FlowStep, FlowValueStream } from '../model';
import { READABLE_MIN_ZOOM, DIV_W, DIV_H, type Category, type DragState } from './constants';

type Rf = ReturnType<typeof useReactFlow>;

export type UseMapCameraArgs = {
  rf: Rf;
  paneW: number;
  paneH: number;
  dragRef: MutableRefObject<DragState | null>;
  companyOpen: boolean;
  selectedDomain: Category | null;
  level: number;
  focusedDivisionId: string | null;
  focusedVsId: string | null;
  focusedStepId: string | null;
  focusedSubStepId: string | null;
  flowData: DivisionFlow | null;
  vsFlowData: DivisionFlow | null;
  valueStreams: FlowValueStream[];
  steps: FlowStep[];
  focusedStep: FlowStep | null;
};

export function useMapCamera({
  rf, paneW, paneH, dragRef, companyOpen, selectedDomain, level,
  focusedDivisionId, focusedVsId, focusedStepId, focusedSubStepId,
  flowData, vsFlowData, valueStreams, steps, focusedStep,
}: UseMapCameraArgs) {
  // ── Camera helpers ────────────────────────────────────────────────────────
  // Fit a specific set of nodes in frame (used to frame the whole process row).
  const fitNodes = useCallback((nodeIds: string[], padding = 0.18) => {
    if (dragRef.current?.started) return; // never move the camera mid-drag (would yank the dragged card away)
    // Every map card is a known fixed size (MAP_CARD_W×MAP_CARD_H), so we don't
    // wait on xyflow to MEASURE freshly-added nodes (that was clipping long
    // columns whose bottom hadn't measured yet). Instead, once the nodes exist
    // in the store (positions known), compute the exact bounding box and fitBounds
    // it — the whole requested set lands completely in frame, deterministically.
    let tries = 0;
    const attempt = () => {
      // Wait until the freshly-opened children exist in the store…
      // Gate on the freshly-opened children existing in the store…
      const req = nodeIds.map((id) => rf.getNode(id)).filter((n): n is NonNullable<typeof n> => !!n);
      if (req.length < nodeIds.length && tries++ < 12) { requestAnimationFrame(attempt); return; }
      if (!paneW || !paneH) return;
      // Frame the WHOLE visible spine so the company root is always in bounds, then
      // pin its TOP near the container top — the company stays LOCKED at the top on
      // every drill (it must never scroll out of frame). Clamp the zoom to a
      // readable floor so deep levels (the tall L5 leaf column) don't shrink to an
      // unreadable size; when the spine is taller than fits, it overflows below the
      // fold (pannable) rather than zooming out past legibility (backlog item 36).
      const all = rf.getNodes();
      if (!all.length) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of all) {
        const w = n.measured?.width ?? n.width ?? MAP_CARD_W;
        const h = n.measured?.height ?? n.height ?? MAP_CARD_H;
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + w);
        maxY = Math.max(maxY, n.position.y + h);
      }
      const fit = getViewportForBounds(
        { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        paneW, paneH, 0.05, 2, padding,
      );
      const zoom = Math.min(Math.max(fit.zoom, READABLE_MIN_ZOOM), 2);
      const centerX = (minX + maxX) / 2;
      // x: re-derive horizontal centering for the (possibly clamped) zoom; y: pin the
      // spine top (company) to ~16px below the container top. One animated setViewport.
      rf.setViewport({ x: paneW / 2 - centerX * zoom, y: 16 - minY * zoom, zoom }, { duration: 460 });
    };
    requestAnimationFrame(attempt);
  }, [rf, paneW, paneH]);  

  // Fit the whole visible graph, then pin its top edge near the top of the
  // container — fitView alone centers vertically, which left a large empty band
  // above the map (defect backlog 02, D3.1). The company root sits at world
  // y=0, so viewport.y is exactly the on-screen offset of the content top.
  // NB: in xyflow v12 fitView() is queued until nodes are measured and returns
  // a promise — the viewport must be read AFTER it resolves. Reading it
  // synchronously (the old code) grabbed the stale pre-fit viewport, and the
  // queued fit then re-centered the graph over our y=16 pin.
  const fitTopView = useCallback(() => {
    rf.fitView({ duration: 0, padding: 0.08, maxZoom: 0.95 }).then((applied) => {
      if (!applied) return;
      const { x, zoom } = rf.getViewport();
      rf.setViewport({ x, y: 16, zoom }, { duration: 400 });
    });
  }, [rf]);

  const moveCameraToNode = useCallback((nodeId: string, yBias = 0.5) => {
    if (dragRef.current?.started) return; // never move the camera mid-drag
    setTimeout(() => {
      const node = rf.getNode(nodeId);
      if (!node) return;
      const w = node.measured?.width ?? DIV_W;
      const h = node.measured?.height ?? DIV_H;
      const cx = node.position.x + w / 2;
      // Bias y downward so opened children stay in frame
      const cy = node.position.y + h / 2 + yBias * 80;
      rf.setCenter(cx, cy, { zoom: 0.9, duration: 420 });
    }, 60);
  }, [rf]);  

  // Camera: company open/close → fit the visible graph (pinned to the top)
  useEffect(() => {
    fitTopView();
  }, [companyOpen]);  

  // Camera: domain selected → center on it (divisions appear below); deselected → fit
  useEffect(() => {
    if (selectedDomain && !focusedDivisionId) moveCameraToNode(`core:${selectedDomain}`, 1.4);
    else if (!selectedDomain && companyOpen) fitTopView();
  }, [selectedDomain]);  

  // Camera: division collapsed back → re-center on its domain. The drill-IN move is
  // intentionally NOT here: when a division is focused its value streams are fetched,
  // and the flowData effect below frames the whole row (top-pinned). Doing an extra
  // moveCameraToNode here first hard-zoomed to 0.9 → visible zoom-in-then-out glitch.
  useEffect(() => {
    if (!focusedDivisionId && selectedDomain) moveCameraToNode(`core:${selectedDomain}`, 1.4);
  }, [focusedDivisionId]);  

  // Camera: when the division's value streams arrive, frame the whole row — the
  // division plus its full left-to-right value-stream row, so nothing is cut off.
  useEffect(() => {
    if (level >= 1 && focusedDivisionId && flowData) {
      if (valueStreams.length > 0) {
        fitNodes([focusedDivisionId, ...valueStreams.map((vs) => `vs:${vs.id}`)], 0.3);
      } else {
        setTimeout(() => moveCameraToNode(focusedDivisionId, 0.8), 120);
      }
    }
  }, [flowData]);  

  // Camera: VS drill-IN is framed by the vsFlowData effect below (top-pinned, whole
  // process row) once the steps arrive. No immediate moveCameraToNode here — it
  // hard-zoomed to 0.9 before the fit, producing a zoom-in-then-out glitch.

  // Camera: when the process steps arrive, frame the whole process — the focused
  // value stream plus its full (centered, perpendicular) step row.
  useEffect(() => {
    if (level >= 2 && focusedVsId && vsFlowData) {
      if (steps.length > 0) {
        fitNodes([`vs:${focusedVsId}`, ...steps.map((s) => `step:${s.id}`)], 0.3);
      } else {
        setTimeout(() => moveCameraToNode(`vs:${focusedVsId}`, 0.8), 120);
      }
    }
  }, [vsFlowData]);  

  // Camera: L4 focused → frame the clicked step PLUS its full L5 task column, so
  // the step stays in view and every task is completely framed (nothing clipped).
  useEffect(() => {
    if (level < 3 || !focusedStepId) return;
    const step = steps.find((s) => s.id === focusedStepId);
    if (step && step.subSteps.length > 0) {
      fitNodes([`step:${focusedStepId}`, ...step.subSteps.map((s) => `substep:${s.id}`)], 0.3);
    } else {
      moveCameraToNode(`step:${focusedStepId}`, 0.3);
    }
  }, [focusedStepId]);  

  // Camera: L4 → focus sub-process. Frame it plus its full L5 process-step row.
  useEffect(() => {
    if (level < 4 || !focusedSubStepId) return;
    const sub = focusedStep?.subSteps.find((s) => s.id === focusedSubStepId);
    if (sub && sub.l5.length > 0) {
      fitNodes([`substep:${focusedSubStepId}`, ...sub.l5.map((s) => `leaf:${s.id}`)], 0.3);
    } else {
      moveCameraToNode(`substep:${focusedSubStepId}`, 0.3);
    }
  }, [focusedSubStepId]);  
}
