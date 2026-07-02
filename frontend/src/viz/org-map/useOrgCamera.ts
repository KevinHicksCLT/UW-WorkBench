/**
 * Camera control hook for the Organization map — fit/center helpers (frozen
 * mid-drag, like MapCanvas) plus the drill-driven camera effects. Extracted
 * verbatim from OrgMapCanvas.tsx.
 */
import { useCallback, useEffect, type MutableRefObject } from 'react';
import type { useReactFlow } from '@xyflow/react';

import { MAP_CARD_W, MAP_CARD_H } from '../nodes/MapNode';
import type { Division, OrgDragState, RoleLite, Segment } from './orgNodes';

type Rf = ReturnType<typeof useReactFlow>;

export type UseOrgCameraArgs = {
  rf: Rf;
  paneW: number;
  paneH: number;
  dragRef: MutableRefObject<OrgDragState | null>;
  companyOpen: boolean;
  selSegName: string | null;
  selSegment: Segment | null;
  selDivId: string | null;
  selDivision: Division | null;
  selDeptId: string | null;
  selTeam: { id: string; name: string; roles: RoleLite[] } | null;
  displayDivisions: Division[];
  teams: { id: string }[];
  roles: RoleLite[];
};

export function useOrgCamera({
  rf, paneW, paneH, dragRef, companyOpen,
  selSegName, selSegment, selDivId, selDivision, selDeptId, selTeam,
  displayDivisions, teams, roles,
}: UseOrgCameraArgs) {
  // ── Camera helpers (frozen mid-drag, like MapCanvas) ─────────────────────────
  const fitNodes = useCallback((nodeIds: string[]) => {
    if (dragRef.current?.started) return;
    // RETRY until the freshly-opened children are present AND measured. The old code
    // did a single setTimeout(130) and bailed if they weren't ready yet — so the drill
    // fit silently never applied, leaving the stale company-level fitTopView camera
    // (scale 0.95) in place and the wide division/department rows cut off. Mirror
    // MapCanvas: keep re-checking on each animation frame until the nodes exist.
    let tries = 0;
    const attempt = () => {
      if (dragRef.current?.started) return;
      // Gate on the nodes EXISTING in the store (not on `measured` — React Flow never
      // populates measured.width for these custom org nodes, which made the old gate
      // wait forever and bail, leaving the stale company-level camera). Bounds below
      // fall back to MAP_CARD_W/H when measured is absent, so existence is enough.
      const req = nodeIds.map((id) => rf.getNode(id)).filter((n) => !!n);
      if (req.length < nodeIds.length && tries++ < 30) { requestAnimationFrame(attempt); return; }
      if (!req.length || !paneW || !paneH) return;
      // Frame the WHOLE visible spine so the company root is always in bounds.
      const all = rf.getNodes();
      if (!all.length) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of all) {
        const w = n.measured?.width ?? MAP_CARD_W;
        const h = n.measured?.height ?? MAP_CARD_H;
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + w);
        maxY = Math.max(maxY, n.position.y + h);
      }
      // Size the zoom against the ACTUAL top-pinned layout: the company sits TOP_PAD
      // below the top edge, so the height available for the spine is (paneH - TOP_PAD
      // - PAD), and the width budget is (paneW - 2·PAD). Taking the smaller of the two
      // ratios guarantees EVERY box fits — no right-edge or bottom-row cutoff — while
      // the company stays locked at the top.
      const TOP_PAD = 16, PAD = 48;
      const boundsW = Math.max(1, maxX - minX);
      const boundsH = Math.max(1, maxY - minY);
      const zoom = Math.max(0.05, Math.min(
        (paneW - PAD * 2) / boundsW,
        (paneH - TOP_PAD - PAD) / boundsH,
        2,
      ));
      const centerX = (minX + maxX) / 2;
      rf.setViewport({ x: paneW / 2 - centerX * zoom, y: TOP_PAD - minY * zoom, zoom }, { duration: 460 });
    };
    requestAnimationFrame(attempt);
  }, [rf, paneW, paneH]);  
  const fitTopView = useCallback(() => {
    rf.fitView({ duration: 0, padding: 0.08, maxZoom: 0.95 }).then((applied) => {
      if (!applied) return;
      const { x, zoom } = rf.getViewport();
      rf.setViewport({ x, y: 16, zoom }, { duration: 400 });
    });
  }, [rf]);
  const moveCameraToNode = useCallback((nodeId: string, yBias = 0.5) => {
    if (dragRef.current?.started) return;
    setTimeout(() => {
      const node = rf.getNode(nodeId);
      if (!node) return;
      const w = node.measured?.width ?? MAP_CARD_W;
      const h = node.measured?.height ?? MAP_CARD_H;
      rf.setCenter(node.position.x + w / 2, node.position.y + h / 2 + yBias * 80, { zoom: 0.9, duration: 420 });
    }, 60);
  }, [rf]);  

  useEffect(() => { fitTopView(); }, [companyOpen]);  
  useEffect(() => {
    if (selSegName && selSegment) fitNodes([`seg:${selSegName}`, ...displayDivisions.map((d) => `div:${d.id}`)]);
    else if (companyOpen) fitTopView();
  }, [selSegName]);  
  useEffect(() => {
    if (selDivId && selDivision) fitNodes([`div:${selDivId}`, ...teams.map((t) => `dept:${t.id}`)]);
    else if (selSegName) moveCameraToNode(`seg:${selSegName}`, 1.2);
  }, [selDivId]);  
  useEffect(() => {
    if (selDeptId && selTeam) fitNodes([`dept:${selDeptId}`, ...roles.map((r) => `role:${r.id}`)]);
    else if (selDivId) moveCameraToNode(`div:${selDivId}`, 0.8);
  }, [selDeptId]);  
}
