/**
 * Edit-mode drag/drop hook for the Product Model map — the same custom
 * screen-space pointer gesture as the org / value-stream maps (ghost card,
 * gap/nest hit-testing, hover-to-drill, drop staging), keyed to product node
 * types. Adapted from viz/org-map/useOrgDragDrop.ts; all five product levels
 * are real ProductNode rows, so every level drags, nests, reorders and renames.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from 'react';
import type { Node, useReactFlow } from '@xyflow/react';

import { MAP_CARD_W, MAP_CARD_H } from '../nodes/MapNode';
import type { RenameState, GapState } from '../map/constants';
import {
  PRODUCT_TYPE_LEVEL,
  HOVER_DRILL_MS,
  type ProductNode,
  type ProductDragState,
  type ProductMoveRec,
} from './productNodes';

type Rf = ReturnType<typeof useReactFlow>;

const DRAGGABLE_TYPES = new Set([
  'productSegment',
  'productLob',
  'productProduct',
  'productVersion',
  'productComponent',
]);
const ROW_TYPES = [
  'productSegment',
  'productLob',
  'productProduct',
  'productVersion',
  'productComponent',
];
// Types the cursor can hover-hold to drill open mid-drag (components are leaves).
const DRILLABLE = ['productSegment', 'productLob', 'productProduct', 'productVersion'];

const nodeName = (n: Node): string => (n.data as { name?: string }).name ?? '';
const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

const cardAtPoint = (x: number, y: number): { canvasId: string; type: string } | null => {
  const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest(
    '.react-flow__node',
  ) as HTMLElement | null;
  if (!el) return null;
  const canvasId = el.getAttribute('data-id');
  if (!canvasId) return null;
  const type =
    [...el.classList]
      .find((c) => c.startsWith('react-flow__node-'))
      ?.slice('react-flow__node-'.length) ?? '';
  return { canvasId, type };
};

export type UseProductDragDropArgs = {
  editMode: boolean;
  rf: Rf;
  nodes: Node[];
  drag: ProductDragState | null;
  setDrag: Dispatch<SetStateAction<ProductDragState | null>>;
  dragRef: MutableRefObject<ProductDragState | null>;
  setGap: Dispatch<SetStateAction<GapState | null>>;
  setNestTargetId: Dispatch<SetStateAction<string | null>>;
  selSegId: string | null;
  selLobId: string | null;
  selProductId: string | null;
  selVersionId: string | null;
  lobs: ProductNode[];
  products: ProductNode[];
  versions: ProductNode[];
  components: ProductNode[];
  rawNodeId: (node: { id: string }) => string | null;
  drillByCanvasId: (canvasId: string, type: string) => void;
  setPendingMoves: Dispatch<SetStateAction<Map<string, ProductMoveRec>>>;
  setPendingOrder: Dispatch<SetStateAction<Map<string, string[]>>>;
  pendingRenames: Map<string, string>;
  setRename: Dispatch<SetStateAction<RenameState | null>>;
  flash: (kind: 'ok' | 'err', text: string) => void;
};

export function useProductDragDrop({
  editMode,
  rf,
  nodes,
  drag,
  setDrag,
  dragRef,
  setGap,
  setNestTargetId,
  selSegId,
  selLobId,
  selProductId,
  selVersionId,
  lobs,
  products,
  versions,
  components,
  rawNodeId,
  drillByCanvasId,
  setPendingMoves,
  setPendingOrder,
  pendingRenames,
  setRename,
  flash,
}: UseProductDragDropArgs) {
  const nestRef = useRef<string | null>(null);
  const gapRef = useRef<GapState | null>(null);
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);
  const clickTimerRef = useRef<number | null>(null);

  // The raw-id of the row a node currently renders under (its effective parent).
  const currentParentRaw = useCallback(
    (node: Node): string | null => {
      switch (node.type) {
        case 'productLob':
          return selSegId;
        case 'productProduct':
          return selLobId;
        case 'productVersion':
          return selProductId;
        case 'productComponent':
          return selVersionId;
        default:
          return null; // segment (root) / company
      }
    },
    [selSegId, selLobId, selProductId, selVersionId],
  );

  // Is `targetRaw` inside the dragged node's on-canvas subtree? Only the focused
  // chain's descendants render, so that's all we can (and need to) check; the
  // server's cycle guard is the authoritative backstop.
  const isVisibleDescendant = useCallback(
    (targetRaw: string, draggedRaw: string): boolean => {
      const lobIds = lobs.map((n) => n.id);
      const prodIds = products.map((n) => n.id);
      const verIds = versions.map((n) => n.id);
      const compIds = components.map((n) => n.id);
      const below = (ids: string[][]) => ids.some((arr) => arr.includes(targetRaw));
      if (draggedRaw === selSegId && below([lobIds, prodIds, verIds, compIds])) return true;
      if (draggedRaw === selLobId && below([prodIds, verIds, compIds])) return true;
      if (draggedRaw === selProductId && below([verIds, compIds])) return true;
      if (draggedRaw === selVersionId && below([compIds])) return true;
      return false;
    },
    [lobs, products, versions, components, selSegId, selLobId, selProductId, selVersionId],
  );

  const nodeById = useMemo(() => {
    const m = new Map<string, Node>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);
  const rowOrder = useCallback(
    (parent: string | null, type: string): string[] =>
      nodes
        .filter((n) => n.type === type && currentParentRaw(n) === parent)
        .sort(
          (a, b) =>
            ((a.data as { pieceIndex?: number }).pieceIndex ?? 0) -
            ((b.data as { pieceIndex?: number }).pieceIndex ?? 0),
        )
        .map((n) => rawNodeId(n))
        .filter((x): x is string => !!x),
    [nodes, currentParentRaw, rawNodeId],
  );

  const hoverDrillRef = useRef<{ id: string | null; timer: number | null }>({
    id: null,
    timer: null,
  });
  const clearHoverDrill = useCallback(() => {
    if (hoverDrillRef.current.timer) window.clearTimeout(hoverDrillRef.current.timer);
    hoverDrillRef.current = { id: null, timer: null };
  }, []);
  const scheduleHoverDrill = useCallback(
    (canvasId: string | null, type: string | null) => {
      if (!canvasId || !type || !DRILLABLE.includes(type)) {
        clearHoverDrill();
        return;
      }
      if (hoverDrillRef.current.id === canvasId) return;
      if (hoverDrillRef.current.timer) window.clearTimeout(hoverDrillRef.current.timer);
      hoverDrillRef.current = {
        id: canvasId,
        timer: window.setTimeout(() => drillByCanvasId(canvasId, type), HOVER_DRILL_MS),
      };
    },
    [clearHoverDrill, drillByCanvasId],
  );

  const nodeScreenRect = useCallback(
    (n: Node) => {
      const p = rf.flowToScreenPosition(n.position);
      const z = rf.getZoom();
      return { x: p.x, y: p.y, w: MAP_CARD_W * z, h: MAP_CARD_H * z };
    },
    [rf],
  );

  const computeGap = useCallback(
    (d: ProductDragState): GapState | null => {
      type RowRect = { id: string; r: { x: number; y: number; w: number; h: number } };
      let best: { type: string; dist: number; rects: RowRect[] } | null = null;
      for (const type of ROW_TYPES) {
        const rows = nodes.filter((n) => n.type === type && n.id !== d.canvasId);
        if (!rows.length) continue;
        const rects: RowRect[] = rows.map((n) => ({ id: n.id, r: nodeScreenRect(n) }));
        const r0 = rects[0].r;
        const dist = Math.abs(d.py - (r0.y + r0.h / 2));
        if (dist > r0.h * 1.4) continue;
        if (!best || dist < best.dist) best = { type, dist, rects };
      }
      if (!best) return null;
      const sample = nodeById.get(best.rects[0].id);
      const parent = sample ? currentParentRaw(sample) : null;
      // Segments live at the root (parent null) — reordering the root row is
      // still meaningful, keyed by the sentinel '' (never sent as a parent id).
      if (parent === d.rawId) return null;
      best.rects.sort((a, b) => a.r.x - b.r.x);
      const index = best.rects.filter((o) => o.r.x + o.r.w / 2 < d.px).length;
      return { parent: parent ?? '', index, type: best.type };
    },
    [nodes, nodeScreenRect, nodeById, currentParentRaw],
  );

  const computeNest = useCallback(
    (d: ProductDragState): string | null => {
      for (const n of nodes) {
        if (n.id === d.canvasId) continue;
        if (!PRODUCT_TYPE_LEVEL[n.type ?? '']) continue;
        const r = nodeScreenRect(n);
        if (d.px >= r.x && d.px <= r.x + r.w && d.py >= r.y && d.py <= r.y + r.h) {
          const frac = (d.px - r.x) / r.w;
          if (frac <= 0.22 || frac >= 0.78) return null;
          const targetRaw = rawNodeId(n);
          if (!targetRaw || targetRaw === d.originParent || isVisibleDescendant(targetRaw, d.rawId))
            return null;
          return n.id;
        }
      }
      return null;
    },
    [nodes, nodeScreenRect, rawNodeId, isVisibleDescendant],
  );

  const containerAtCursor = useCallback(
    (d: ProductDragState): { canvasId: string; type: string } | null => {
      for (const n of nodes) {
        if (n.id === d.canvasId) continue;
        if (!DRILLABLE.includes(n.type ?? '')) continue;
        const r = nodeScreenRect(n);
        if (d.px >= r.x && d.px <= r.x + r.w && d.py >= r.y && d.py <= r.y + r.h)
          return { canvasId: n.id, type: n.type ?? '' };
      }
      return null;
    },
    [nodes, nodeScreenRect],
  );

  const commitDrop = useCallback(() => {
    const d = dragRef.current;
    const g = gapRef.current;
    const nestId = nestRef.current;
    dragRef.current = null;
    gapRef.current = null;
    nestRef.current = null;
    clearHoverDrill();
    setDrag(null);
    setGap(null);
    setNestTargetId(null);
    if (!d || !d.started) {
      if (d) {
        const now = Date.now();
        const last = lastClickRef.current;
        if (last && last.id === d.canvasId && now - last.time < 300) {
          if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null;
          lastClickRef.current = null;
          const node = nodeById.get(d.canvasId);
          if (node) {
            const r = nodeScreenRect(node);
            setRename({
              rawId: d.rawId,
              value: pendingRenames.get(d.rawId) ?? d.name,
              x: r.x,
              y: r.y,
              w: r.w,
              h: r.h,
              cat: d.cat,
            });
          }
        } else {
          lastClickRef.current = { id: d.canvasId, time: now };
          if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
          clickTimerRef.current = window.setTimeout(() => {
            clickTimerRef.current = null;
            lastClickRef.current = null;
            drillByCanvasId(d.canvasId, d.type);
          }, 280);
        }
      }
      return;
    }

    // 0) NEST — dropped on a box's centre → become its child (one level deeper).
    if (nestId) {
      const tgt = nodeById.get(nestId);
      const targetRaw = tgt ? rawNodeId(tgt) : null;
      const targetLevel = PRODUCT_TYPE_LEVEL[tgt?.type ?? ''] ?? 0;
      if (targetRaw && targetLevel) {
        const sameLevel = targetLevel + 1 === d.level;
        setPendingMoves((m) => {
          const next = new Map(m);
          next.set(d.rawId, {
            parent: targetRaw,
            sameLevel,
            level: d.level,
            name: d.name,
            cat: d.cat,
          });
          return next;
        });
        setPendingOrder((m) => {
          if (!m.size) return m;
          const next = new Map(m);
          for (const [p, ids] of next) {
            const f = ids.filter((id) => id !== d.rawId);
            if (f.length !== ids.length) next.set(p, f);
          }
          return next;
        });
        flash('ok', sameLevel ? 'Staged move — children follow.' : 'Staged — nested inside.');
        if (tgt) drillByCanvasId(nestId, tgt.type ?? '');
      }
      return;
    }

    // 1) Dropped within a row → place beside, at that index.
    if (g) {
      const gapParent = g.parent || null; // '' = the root segments row
      if (gapParent && gapParent !== d.originParent && isVisibleDescendant(gapParent, d.rawId)) {
        flash('err', "Can't drop a box inside its own branch.");
        return;
      }
      const ids = rowOrder(gapParent, g.type).filter((id) => id !== d.rawId);
      ids.splice(Math.min(g.index, ids.length), 0, d.rawId);
      if (gapParent === d.originParent) {
        setPendingOrder((m) => {
          const next = new Map(m);
          if (arraysEqual(ids, d.originOrder)) next.delete(g.parent);
          else next.set(g.parent, ids);
          return next;
        });
      } else if (gapParent) {
        const sameLevel = (PRODUCT_TYPE_LEVEL[g.type] ?? 0) === d.level;
        setPendingMoves((m) => {
          const next = new Map(m);
          next.set(d.rawId, {
            parent: gapParent,
            sameLevel,
            level: d.level,
            name: d.name,
            cat: d.cat,
          });
          return next;
        });
        setPendingOrder((m) => {
          const next = new Map(m);
          next.set(g.parent, ids);
          return next;
        });
        flash(
          'ok',
          sameLevel
            ? 'Staged move — placed among siblings.'
            : 'Staged — placed inside (re-leveled).',
        );
      }
    }
  }, [
    clearHoverDrill,
    rowOrder,
    isVisibleDescendant,
    nodeById,
    rawNodeId,
    flash,
    drillByCanvasId,
    nodeScreenRect,
    pendingRenames,
    setDrag,
    setGap,
    setNestTargetId,
    setPendingMoves,
    setPendingOrder,
    setRename,
    dragRef,
  ]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const moved = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      const next: ProductDragState = {
        ...d,
        px: e.clientX,
        py: e.clientY,
        started: d.started || moved >= 4,
      };
      dragRef.current = next;
      setDrag(next);
      if (!next.started) return;
      e.preventDefault();
      const hc = containerAtCursor(next);
      scheduleHoverDrill(hc?.canvasId ?? null, hc?.type ?? null);
      const nest = computeNest(next);
      nestRef.current = nest;
      setNestTargetId(nest);
      const g = nest ? null : computeGap(next);
      gapRef.current = g;
      setGap(g);
    };
    const onUp = () => commitDrop();
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [
    drag,
    scheduleHoverDrill,
    computeGap,
    computeNest,
    containerAtCursor,
    commitDrop,
    dragRef,
    setDrag,
    setGap,
    setNestTargetId,
  ]);

  const onStagePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!editMode || e.button !== 0) return;
      if ((e.target as HTMLElement).closest('input')) return;
      if ((e.target as HTMLElement).closest('[data-edit-btn]')) return; // +/× badge click — never a drag
      const hit = cardAtPoint(e.clientX, e.clientY);
      if (!hit) {
        let lastX = e.clientX,
          lastY = e.clientY;
        const onMove = (ev: PointerEvent) => {
          const vp = rf.getViewport();
          rf.setViewport({
            x: vp.x + (ev.clientX - lastX),
            y: vp.y + (ev.clientY - lastY),
            zoom: vp.zoom,
          });
          lastX = ev.clientX;
          lastY = ev.clientY;
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return;
      }
      if (!DRAGGABLE_TYPES.has(hit.type)) return;
      const node = nodeById.get(hit.canvasId);
      const rawId = node ? rawNodeId(node) : null;
      if (!node || !rawId) return;
      const el = (e.target as HTMLElement).closest('.react-flow__node') as HTMLElement;
      const r = el.getBoundingClientRect();
      const origin = currentParentRaw(node);
      dragRef.current = {
        canvasId: hit.canvasId,
        rawId,
        type: hit.type,
        level: PRODUCT_TYPE_LEVEL[hit.type] ?? 0,
        name: nodeName(node),
        cat: '',
        originParent: origin,
        originOrder: rowOrder(origin, hit.type),
        grabDX: e.clientX - r.x,
        grabDY: e.clientY - r.y,
        cardW: r.width,
        cardH: r.height,
        startX: e.clientX,
        startY: e.clientY,
        px: e.clientX,
        py: e.clientY,
        started: false,
      };
      setDrag(dragRef.current);
    },
    [editMode, nodeById, rawNodeId, currentParentRaw, rowOrder, rf, dragRef, setDrag],
  );

  return { onStagePointerDown, clearHoverDrill, gapRef, nestRef, DRAGGABLE_TYPES };
}
