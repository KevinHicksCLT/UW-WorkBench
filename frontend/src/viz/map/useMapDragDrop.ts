/**
 * Edit-mode drag/drop hook for the operating-model map — the custom
 * screen-space pointer gesture (ghost card, gap/nest hit-testing,
 * hover-to-drill, drop staging). Extracted verbatim from MapCanvas.
 *
 * We DON'T use React Flow's node dragging — it moves nodes in pane coords through
 * a controlled-store round-trip that races the map's frequent re-layouts (focus
 * changes, hover-drill) and loses the drag. Instead, dragging is a plain screen-
 * space pointer gesture: a ghost card follows the cursor 1:1, hit-testing uses
 * getBoundingClientRect, the dragged card is lifted out of the layout (its edges
 * disconnect), and the row under the cursor opens a gap. Nothing is committed
 * until pointer-up. React Flow just renders the static `displayNodes`.
 */
import {
  useCallback, useEffect, useMemo, useRef,
  type Dispatch, type MutableRefObject, type PointerEvent as ReactPointerEvent, type SetStateAction,
} from 'react';
import type { Node, useReactFlow } from '@xyflow/react';

import { MAP_CARD_W, MAP_CARD_H } from '../nodes/MapNode';
import type { DivisionSummary, FlowStep, FlowValueStream } from '../model';
import type { DivisionNodeData } from '../nodes/MapNode';
import {
  TYPE_LEVEL, HOVER_DRILL_MS, DRAGGABLE_TYPES, ROW_TYPES,
  type Category, type DragState, type GapState, type MoveRec, type RenameState,
} from './constants';

type Rf = ReturnType<typeof useReactFlow>;

const nodeName = (n: Node): string => ((n.data as { name?: string; label?: string }).name ?? (n.data as { label?: string }).label ?? '');
const arraysEqual = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

// The card under a screen point. The drag ghost is pointer-events:none so it's
// transparent to elementFromPoint.
const cardAtPoint = (x: number, y: number): { canvasId: string; type: string } | null => {
  const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('.react-flow__node') as HTMLElement | null;
  if (!el) return null;
  const canvasId = el.getAttribute('data-id'); if (!canvasId) return null;
  const type = [...el.classList].find((c) => c.startsWith('react-flow__node-'))?.slice('react-flow__node-'.length) ?? '';
  return { canvasId, type };
};

export type UseMapDragDropArgs = {
  editMode: boolean;
  rf: Rf;
  nodes: Node[];
  drag: DragState | null;
  setDrag: Dispatch<SetStateAction<DragState | null>>;
  dragRef: MutableRefObject<DragState | null>;
  setGap: Dispatch<SetStateAction<GapState | null>>;
  setNestTargetId: Dispatch<SetStateAction<string | null>>;
  selectedDomain: Category | null;
  focusedDivisionId: string | null;
  focusedVsId: string | null;
  focusedStepId: string | null;
  focusedStep: FlowStep | null;
  valueStreams: FlowValueStream[];
  steps: FlowStep[];
  displayDivisions: DivisionSummary[];
  catFor: (div: DivisionSummary) => Category;
  domainIdByCat: Map<string, string>;
  domainCatById: Map<string, string>;
  rawNodeId: (node: { id: string }) => string | null;
  onDomainClick: (cat: Category) => void;
  onDivisionClick: (divId: string) => void;
  onVsClick: (vsId: string) => void;
  onStepClick: (stepId: string) => void;
  onSubStepClick: (subId: string) => void;
  setPendingMoves: Dispatch<SetStateAction<Map<string, MoveRec>>>;
  setPendingOrder: Dispatch<SetStateAction<Map<string, string[]>>>;
  pendingRenames: Map<string, string>;
  setRename: Dispatch<SetStateAction<RenameState | null>>;
  flash: (kind: 'ok' | 'err', text: string) => void;
};

export function useMapDragDrop({
  editMode, rf, nodes, drag, setDrag, dragRef, setGap, setNestTargetId,
  selectedDomain, focusedDivisionId, focusedVsId, focusedStepId, focusedStep,
  valueStreams, steps, displayDivisions, catFor, domainIdByCat, domainCatById, rawNodeId,
  onDomainClick, onDivisionClick, onVsClick, onStepClick, onSubStepClick,
  setPendingMoves, setPendingOrder, pendingRenames, setRename, flash,
}: UseMapDragDropArgs) {
  // When the cursor is over the CENTRE of a box → that box highlights as a "nest
  // inside" target; over a GAP between boxes → the gap opens instead. These refs
  // mirror the state for the pointer-up handler.
  const nestRef = useRef<string | null>(null);
  const gapRef = useRef<GapState | null>(null);
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);
  const clickTimerRef = useRef<number | null>(null);

  // ── Edit-mode drag → stage a move / reorder ──────────────────────────────────
  // The raw-id of the row a node currently renders under (its effective parent).
  const currentParentRaw = useCallback((node: Node): string | null => {
    switch (node.type) {
      case 'divisionNode': return domainIdByCat.get((node.data as DivisionNodeData).category) ?? null;
      case 'valueStreamNode': return focusedDivisionId;
      case 'stepNode': return focusedVsId;
      case 'subStepNode': return focusedStepId;
      default: return null; // domain / company
    }
  }, [domainIdByCat, focusedDivisionId, focusedVsId, focusedStepId]);

  // Is `targetRaw` inside the dragged node's on-canvas subtree? Only the focused
  // chain's descendants are rendered, so that's all we can (and need to) check;
  // the server's cycle guard is the authoritative backstop.
  const isVisibleDescendant = useCallback((targetRaw: string, draggedRaw: string): boolean => {
    const inChainBelowDivision = valueStreams.some((v) => v.id === targetRaw) || steps.some((s) => s.id === targetRaw) || (focusedStep?.subSteps.some((s) => s.id === targetRaw) ?? false);
    const inChainBelowVs = steps.some((s) => s.id === targetRaw) || (focusedStep?.subSteps.some((s) => s.id === targetRaw) ?? false);
    if (draggedRaw === focusedDivisionId && inChainBelowDivision) return true;
    if (draggedRaw === focusedVsId && inChainBelowVs) return true;
    if (draggedRaw === focusedStepId && (focusedStep?.subSteps.some((s) => s.id === targetRaw) ?? false)) return true;
    if (domainCatById.has(draggedRaw)) {
      const cat = domainCatById.get(draggedRaw)!;
      if (displayDivisions.some((d) => d.id === targetRaw && catFor(d) === cat)) return true;
    }
    return false;
  }, [valueStreams, steps, focusedStep, focusedDivisionId, focusedVsId, focusedStepId, domainCatById, displayDivisions, catFor]);

  // Canvas id → node (for parent/level lookups during a drag).
  const nodeById = useMemo(() => {
    const m = new Map<string, Node>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);
  // Rendered left-to-right (or top-to-bottom) raw-id order of a parent's row.
  const rowOrder = useCallback((parent: string, type: string): string[] =>
    nodes.filter((n) => n.type === type && currentParentRaw(n) === parent)
      .sort((a, b) => ((a.data as { pieceIndex?: number }).pieceIndex ?? 0) - ((b.data as { pieceIndex?: number }).pieceIndex ?? 0))
      .map((n) => rawNodeId(n)).filter((x): x is string => !!x),
  [nodes, currentParentRaw, rawNodeId]);

  // ── Hover-to-drill (hold the cursor directly over a box for HOVER_DRILL_MS) ────
  const hoverDrillRef = useRef<{ id: string | null; timer: number | null }>({ id: null, timer: null });
  const clearHoverDrill = useCallback(() => {
    if (hoverDrillRef.current.timer) window.clearTimeout(hoverDrillRef.current.timer);
    hoverDrillRef.current = { id: null, timer: null };
  }, []);
  const scheduleHoverDrill = useCallback((canvasId: string | null, type: string | null) => {
    if (!canvasId || !type || !['coreNode', 'divisionNode', 'valueStreamNode', 'stepNode'].includes(type)) { clearHoverDrill(); return; }
    if (hoverDrillRef.current.id === canvasId) return; // already counting down on this exact box
    if (hoverDrillRef.current.timer) window.clearTimeout(hoverDrillRef.current.timer);
    hoverDrillRef.current = {
      id: canvasId,
      timer: window.setTimeout(() => {
        if (type === 'coreNode') { const c = canvasId.slice(5); if (selectedDomain !== c) onDomainClick(c as Category); }
        else if (type === 'divisionNode') { if (focusedDivisionId !== canvasId) onDivisionClick(canvasId); }
        else if (type === 'valueStreamNode') { const raw = canvasId.slice(3); if (focusedVsId !== raw) onVsClick(raw); }
        else if (type === 'stepNode') { const raw = canvasId.slice(5); if (focusedStepId !== raw) onStepClick(raw); }
      }, HOVER_DRILL_MS),
    };
  }, [clearHoverDrill, selectedDomain, focusedDivisionId, focusedVsId, focusedStepId, onDomainClick, onDivisionClick, onVsClick, onStepClick]);

  // Screen-space rect of a node from its STABLE layout position (node.position is
  // pane coords; the live gap-shift only touches displayNodes, not `nodes`, so this
  // is immune to cards sliding around — hit-testing stays rock-steady under the
  // cursor).
  const nodeScreenRect = useCallback((n: Node) => {
    const p = rf.flowToScreenPosition(n.position);
    const z = rf.getZoom();
    return { x: p.x, y: p.y, w: MAP_CARD_W * z, h: MAP_CARD_H * z };
  }, [rf]);

  // Compute the open insertion slot for the cursor position. The dragged card can
  // be placed beside the children of ANY rendered row (not just its own level) — so
  // an L3 can drop between the L4 steps of a value stream you've drilled into. We
  // pick the rendered card-row whose band the cursor is closest to.
  const computeGap = useCallback((d: DragState): { parent: string; index: number; type: string } | null => {
    type RowRect = { id: string; r: { x: number; y: number; w: number; h: number }; raw: string | null };
    let best: { type: string; horizontal: boolean; dist: number; rects: RowRect[] } | null = null;
    for (const type of ROW_TYPES) {
      const rows = nodes.filter((n) => n.type === type && n.id !== d.canvasId);
      if (!rows.length) continue;
      const horizontal = type !== 'subStepNode';
      const rects: RowRect[] = rows.map((n) => ({ id: n.id, r: nodeScreenRect(n), raw: rawNodeId(n) }));
      const r0 = rects[0].r;
      const dist = horizontal ? Math.abs(d.py - (r0.y + r0.h / 2)) : Math.abs(d.px - (r0.x + r0.w / 2));
      if (dist > (horizontal ? r0.h : r0.w) * 1.4) continue; // cursor not in this row's band
      if (!best || dist < best.dist) best = { type, horizontal, dist, rects };
    }
    if (!best) return null;
    const sample = nodeById.get(best.rects[0].id);
    const parent = sample ? currentParentRaw(sample) : null;
    if (!parent || parent === d.rawId) return null;
    best.rects.sort((a, b) => (best!.horizontal ? a.r.x - b.r.x : a.r.y - b.r.y));
    const main = (r: { x: number; y: number; w: number; h: number }) => (best!.horizontal ? r.x + r.w / 2 : r.y + r.h / 2);
    const ptr = best.horizontal ? d.px : d.py;
    const index = best.rects.filter((o) => main(o.r) < ptr).length;
    return { parent, index, type: best.type };
  }, [nodes, nodeScreenRect, nodeById, currentParentRaw, rawNodeId]);

  // The box whose CENTRE the cursor is over → a "nest inside" target (drop makes the
  // dragged card its child). Returns null when the cursor is near a card's edge or
  // in a gap (that's a place-beside), or the target is invalid.
  const computeNest = useCallback((d: DragState): string | null => {
    // Cursor over a box (by its STABLE layout rect) → nest into it. Using layout
    // positions (not the visually-shifted DOM) means the target never slides away
    // from under the cursor, so nesting is reliable.
    for (const n of nodes) {
      if (n.id === d.canvasId) continue;
      if (!TYPE_LEVEL[n.type ?? '']) continue; // company root / leaf can't be a parent
      const r = nodeScreenRect(n);
      if (d.px >= r.x && d.px <= r.x + r.w && d.py >= r.y && d.py <= r.y + r.h) {
        // Only the CENTRE of a card nests; its left/right edges mean "place beside"
        // (so the row spreads open). Stable layout coords → no oscillation.
        const horiz = n.type !== 'subStepNode';
        const frac = horiz ? (d.px - r.x) / r.w : (d.py - r.y) / r.h;
        if (frac <= 0.22 || frac >= 0.78) return null; // only the outer ~22% edges mean "place beside"; the rest nests
        const targetRaw = rawNodeId(n);
        if (!targetRaw || targetRaw === d.originParent || isVisibleDescendant(targetRaw, d.rawId)) return null;
        return n.id;
      }
    }
    return null;
  }, [nodes, nodeScreenRect, rawNodeId, isVisibleDescendant]);

  // The drillable container the cursor is over (stable layout hit-test) — what
  // hover-hold drills open. Unlike computeNest this allows ANY container (even the
  // current parent) so you can drill deeper before placing.
  const containerAtCursor = useCallback((d: DragState): { canvasId: string; type: string } | null => {
    for (const n of nodes) {
      if (n.id === d.canvasId) continue;
      if (!['coreNode', 'divisionNode', 'valueStreamNode', 'stepNode'].includes(n.type ?? '')) continue;
      const r = nodeScreenRect(n);
      if (d.px >= r.x && d.px <= r.x + r.w && d.py >= r.y && d.py <= r.y + r.h) return { canvasId: n.id, type: n.type ?? '' };
    }
    return null;
  }, [nodes, nodeScreenRect]);

  // ── Commit a drop (pointer-up) → stage a move / reorder ───────────────────────
  const commitDrop = useCallback(() => {
    const d = dragRef.current; const g = gapRef.current; const nestId = nestRef.current;
    dragRef.current = null; gapRef.current = null; nestRef.current = null;
    clearHoverDrill(); setDrag(null); setGap(null); setNestTargetId(null);
    if (!d || !d.started) {
      // A click on a draggable card (no drag). Double-click → inline rename;
      // single click → drill (deferred ~280ms so a 2nd click can cancel it).
      if (d) {
        const drill = () => {
          if (d.type === 'coreNode') onDomainClick(d.canvasId.slice(5) as Category);
          else if (d.type === 'divisionNode') onDivisionClick(d.canvasId);
          else if (d.type === 'valueStreamNode') onVsClick(d.canvasId.slice(3));
          else if (d.type === 'stepNode') onStepClick(d.canvasId.slice(5));
          else if (d.type === 'subStepNode') onSubStepClick(d.canvasId.slice(8));
        };
        const now = Date.now();
        const last = lastClickRef.current;
        if (last && last.id === d.canvasId && now - last.time < 300) {
          if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null; lastClickRef.current = null;
          const node = nodeById.get(d.canvasId);
          if (node) {
            const r = nodeScreenRect(node);
            setRename({ rawId: d.rawId, value: pendingRenames.get(d.rawId) ?? d.name, x: r.x, y: r.y, w: r.w, h: r.h, cat: d.cat });
          }
        } else {
          lastClickRef.current = { id: d.canvasId, time: now };
          if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
          clickTimerRef.current = window.setTimeout(() => { clickTimerRef.current = null; lastClickRef.current = null; drill(); }, 280);
        }
      }
      return;
    }

    // 0) NEST — dropped on a box's centre → become that box's child (one level
    //    deeper; the backend auto-creates the level if it doesn't exist yet).
    if (nestId) {
      const target = nodeById.get(nestId);
      const targetRaw = target ? rawNodeId(target) : null;
      const targetLevel = TYPE_LEVEL[target?.type ?? ''] ?? 0;
      if (targetRaw && targetLevel) {
        const sameLevel = targetLevel + 1 === d.level;
        setPendingMoves((m) => { const next = new Map(m); next.set(d.rawId, { parent: targetRaw, sameLevel, level: d.level, name: d.name, cat: d.cat }); return next; });
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
        // Open the target so the box lands visibly INSIDE it (no "where did it go?").
        if (target?.type === 'coreNode') onDomainClick(nestId.slice(5) as Category);
        else if (target?.type === 'divisionNode') onDivisionClick(nestId);
        else if (target?.type === 'valueStreamNode') onVsClick(nestId.slice(3));
        else if (target?.type === 'stepNode') onStepClick(nestId.slice(5));
      }
      return;
    }

    // 1) Dropped within a same-level row → place beside, at that index.
    if (g) {
      if (g.parent !== d.originParent && isVisibleDescendant(g.parent, d.rawId)) { flash('err', "Can't drop a box inside its own branch."); return; }
      const ids = rowOrder(g.parent, g.type).filter((id) => id !== d.rawId);
      ids.splice(Math.min(g.index, ids.length), 0, d.rawId);
      if (g.parent === d.originParent) {
        setPendingOrder((m) => {
          const next = new Map(m);
          if (arraysEqual(ids, d.originOrder)) next.delete(g.parent);
          else next.set(g.parent, ids);
          return next;
        });
      } else {
        const sameLevel = (TYPE_LEVEL[g.type] ?? 0) === d.level; // dropping into a deeper/shallower row re-levels
        setPendingMoves((m) => { const next = new Map(m); next.set(d.rawId, { parent: g.parent, sameLevel, level: d.level, name: d.name, cat: d.cat }); return next; });
        setPendingOrder((m) => { const next = new Map(m); next.set(g.parent, ids); return next; });
        flash('ok', sameLevel ? 'Staged move — placed among siblings.' : 'Staged — placed inside (re-leveled).');
      }
    }
    // else: no-op — the box returns to its row (it was only lifted, never staged).
  }, [clearHoverDrill, rowOrder, isVisibleDescendant, nodeById, rawNodeId, flash, onDomainClick, onDivisionClick, onVsClick, onStepClick, onSubStepClick, nodeScreenRect, pendingRenames]);  

  // Window listeners live only while a drag is in progress; re-subscribe when the
  // drill/gap callbacks change (focus shifts mid-drag) so they stay fresh.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current; if (!d) return;
      const moved = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      const next: DragState = { ...d, px: e.clientX, py: e.clientY, started: d.started || moved >= 4 };
      dragRef.current = next; setDrag(next);
      if (!next.started) return;
      e.preventDefault();
      // hover-drill on the container under the cursor (stable layout hit-test)
      const hc = containerAtCursor(next);
      scheduleHoverDrill(hc?.canvasId ?? null, hc?.type ?? null);
      // over a box → nest; otherwise → gap (place beside)
      const nest = computeNest(next);
      nestRef.current = nest; setNestTargetId(nest);
      const g = nest ? null : computeGap(next);
      gapRef.current = g; setGap(g);
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
  }, [drag, scheduleHoverDrill, computeGap, computeNest, containerAtCursor, commitDrop]);  

  // Start a drag when the pointer goes down on a draggable card (in edit mode).
  const onStagePointerDown = useCallback((e: ReactPointerEvent) => {
    if (!editMode || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('input')) return; // typing in the rename editor
    const hit = cardAtPoint(e.clientX, e.clientY);
    if (!hit) {
      // Empty canvas → custom pan (React Flow's own pan is disabled in edit mode so
      // it can't fight the card drag; we drive the viewport ourselves here).
      let lastX = e.clientX, lastY = e.clientY;
      const onMove = (ev: PointerEvent) => {
        const vp = rf.getViewport();
        rf.setViewport({ x: vp.x + (ev.clientX - lastX), y: vp.y + (ev.clientY - lastY), zoom: vp.zoom });
        lastX = ev.clientX; lastY = ev.clientY;
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
    if (!DRAGGABLE_TYPES.has(hit.type)) return; // non-draggable card (company/leaf) → React Flow click → drill
    const node = nodeById.get(hit.canvasId);
    const rawId = node ? rawNodeId(node) : null;
    if (!node || !rawId) return;
    const el = (e.target as HTMLElement).closest('.react-flow__node') as HTMLElement;
    const r = el.getBoundingClientRect();
    const origin = currentParentRaw(node);
    dragRef.current = {
      canvasId: hit.canvasId, rawId, type: hit.type, level: TYPE_LEVEL[hit.type] ?? 0,
      name: nodeName(node), cat: (node.data as { category?: string }).category ?? selectedDomain ?? '',
      originParent: origin, originOrder: origin ? rowOrder(origin, hit.type) : [],
      grabDX: e.clientX - r.x, grabDY: e.clientY - r.y, cardW: r.width, cardH: r.height,
      startX: e.clientX, startY: e.clientY, px: e.clientX, py: e.clientY, started: false,
    };
    setDrag(dragRef.current);
  }, [editMode, nodeById, rawNodeId, currentParentRaw, rowOrder, selectedDomain, rf]);  

  return { onStagePointerDown, clearHoverDrill, gapRef, nestRef };
}
