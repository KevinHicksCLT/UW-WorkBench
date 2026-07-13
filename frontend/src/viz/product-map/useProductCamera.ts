/**
 * Camera control hook for the Product Model map — fit/center helpers plus the
 * drill-driven camera effects, mirroring viz/org-map/useOrgCamera.ts,
 * including the mid-drag freeze (a camera move under an in-flight drag yanks
 * the dragged card away from the pointer).
 */
import { useCallback, useEffect, type MutableRefObject } from 'react';
import type { useReactFlow } from '@xyflow/react';

import { MAP_CARD_W, MAP_CARD_H } from '../nodes/mapNodeShared';
import type { ProductNode, ProductDragState } from './productNodes';

type Rf = ReturnType<typeof useReactFlow>;

export type UseProductCameraArgs = {
  rf: Rf;
  paneW: number;
  paneH: number;
  dragRef?: MutableRefObject<ProductDragState | null>;
  companyOpen: boolean;
  selSegId: string | null;
  selSegment: ProductNode | null;
  selLobId: string | null;
  selLob: ProductNode | null;
  selProductId: string | null;
  selProduct: ProductNode | null;
  selVersionId: string | null;
  selVersion: ProductNode | null;
  lobs: ProductNode[];
  products: ProductNode[];
  versions: ProductNode[];
  components: ProductNode[];
};

export function useProductCamera({
  rf,
  paneW,
  paneH,
  dragRef,
  companyOpen,
  selSegId,
  selSegment,
  selLobId,
  selLob,
  selProductId,
  selProduct,
  selVersionId,
  selVersion,
  lobs,
  products,
  versions,
  components,
}: UseProductCameraArgs) {
  // Fit the whole visible spine with the company row pinned at the top —
  // retrying each animation frame until the freshly-opened children exist in
  // the store (same rationale as useOrgCamera: a single timeout silently
  // leaves the stale camera in place when the row hasn't mounted yet).
  const fitNodes = useCallback(
    (nodeIds: string[]) => {
      if (dragRef?.current?.started) return; // never move the camera mid-drag
      let tries = 0;
      const attempt = () => {
        const req = nodeIds.map((id) => rf.getNode(id)).filter((n) => !!n);
        if (req.length < nodeIds.length && tries++ < 30) {
          requestAnimationFrame(attempt);
          return;
        }
        if (!req.length || !paneW || !paneH) return;
        const all = rf.getNodes();
        if (!all.length) return;
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const n of all) {
          const w = n.measured?.width ?? MAP_CARD_W;
          const h = n.measured?.height ?? MAP_CARD_H;
          minX = Math.min(minX, n.position.x);
          minY = Math.min(minY, n.position.y);
          maxX = Math.max(maxX, n.position.x + w);
          maxY = Math.max(maxY, n.position.y + h);
        }
        const TOP_PAD = 16,
          PAD = 48;
        const boundsW = Math.max(1, maxX - minX);
        const boundsH = Math.max(1, maxY - minY);
        const zoom = Math.max(
          0.05,
          Math.min((paneW - PAD * 2) / boundsW, (paneH - TOP_PAD - PAD) / boundsH, 2),
        );
        const centerX = (minX + maxX) / 2;
        rf.setViewport(
          { x: paneW / 2 - centerX * zoom, y: TOP_PAD - minY * zoom, zoom },
          { duration: 460 },
        );
      };
      requestAnimationFrame(attempt);
    },
    [rf, paneW, paneH],
  );

  const fitTopView = useCallback(() => {
    rf.fitView({ duration: 0, padding: 0.08, maxZoom: 0.95 }).then((applied) => {
      if (!applied) return;
      const { x, zoom } = rf.getViewport();
      rf.setViewport({ x, y: 16, zoom }, { duration: 400 });
    });
  }, [rf]);

  const moveCameraToNode = useCallback(
    (nodeId: string, yBias = 0.5) => {
      if (dragRef?.current?.started) return; // never move the camera mid-drag
      setTimeout(() => {
        const node = rf.getNode(nodeId);
        if (!node) return;
        const w = node.measured?.width ?? MAP_CARD_W;
        const h = node.measured?.height ?? MAP_CARD_H;
        rf.setCenter(node.position.x + w / 2, node.position.y + h / 2 + yBias * 80, {
          zoom: 0.9,
          duration: 420,
        });
      }, 60);
    },
    [rf],
  );

  // Each effect intentionally fires only when its own drill selection changes
  // (mirrors useOrgCamera — the row arrays are consumed, not watched).
  useEffect(() => {
    fitTopView();
  }, [companyOpen]);
  useEffect(() => {
    if (selSegId && selSegment) fitNodes([`seg:${selSegId}`, ...lobs.map((n) => `lob:${n.id}`)]);
    else if (companyOpen) fitTopView();
  }, [selSegId]);
  useEffect(() => {
    if (selLobId && selLob) fitNodes([`lob:${selLobId}`, ...products.map((n) => `prod:${n.id}`)]);
    else if (selSegId) moveCameraToNode(`seg:${selSegId}`, 1.2);
  }, [selLobId]);
  useEffect(() => {
    if (selProductId && selProduct)
      fitNodes([`prod:${selProductId}`, ...versions.map((n) => `ver:${n.id}`)]);
    else if (selLobId) moveCameraToNode(`lob:${selLobId}`, 0.8);
  }, [selProductId]);
  useEffect(() => {
    if (selVersionId && selVersion)
      fitNodes([`ver:${selVersionId}`, ...components.map((n) => `comp:${n.id}`)]);
    else if (selProductId) moveCameraToNode(`prod:${selProductId}`, 0.8);
  }, [selVersionId]);
}
