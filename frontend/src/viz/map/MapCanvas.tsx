// MapCanvas.tsx — Interactive operating-model map with spatial drill-down.
// L0 Enterprise → L1 Domain (3 CEO domains, horizontal row) → L2 Division
// (horizontal row under the selected domain) → L3 Value Stream → L4 Process Area
// → L5 Sub-Process → L6 Process Step (the workbook's L5 steps) — each level
// rendering left-to-right as you drill in.
// A right-hand MetricsSidebar shows a spreadsheet-derived dashboard for whatever
// level is currently focused (company / domain / division / value stream / area)
// — the SAME panel the list view shows (SHOW_METRICS_SIDEBAR in viz/map/constants).
//
// Split for maintainability (pure code motion — behavior unchanged):
//   viz/map/constants.ts     — layout constants, types, pure helpers
//   viz/map/buildGraph.ts    — the two-pass node/edge layout builder
//   viz/map/useMapCamera.ts  — fit/center helpers + drill-driven camera effects
//   viz/map/useMapDragDrop.ts— edit-mode pointer drag/drop gesture
//   viz/map/MapBreadcrumb.tsx / viz/map/MapChrome.tsx — presentational chrome

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { mapNodeTypes, MAP_CARD_W, MAP_CARD_H, sentenceCase } from '../nodes/MapNode';
import type { DivisionSummary } from '../model';
import { MetricsDrawer, type Dashboard, type MetricSection } from '../../components/MetricsSidebar';
import ValueStreamDrawer from '../../components/ValueStreamDrawer';
import TestingTemplateModal from '../../components/TestingTemplateModal';
import Inspector from '../../components/Inspector';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { useDialogs } from '../../lib/dialogs';
import { useOpenRole } from '../../lib/roleDrawer';
import {
  SHOW_METRICS_SIDEBAR,
  DRAGGABLE_TYPES,
  LEVEL_LABEL,
  MAX_LEVEL,
  PLUS_GAP_SPREAD,
  catFor,
  type Category,
  type DragState,
  type GapState,
  type MoveRec,
  type RenameState,
} from './constants';
import { buildMapGraph } from './buildGraph';
import { useMapFocus } from './useMapFocus';
import { useStagedDisplay } from './useStagedDisplay';
import { useMapCamera } from './useMapCamera';
import { useMapDragDrop } from './useMapDragDrop';
import MapBreadcrumb from './MapBreadcrumb';
import { DragGhost, RenameEditor, MapEditToolbar, MoveFlashBanner } from './MapChrome';

// ── Inner canvas ─────────────────────────────────────────────────────────────

type Props = {
  divisions: DivisionSummary[];
  companyName: string;
  breadcrumbSlot?: HTMLElement | null;
  focusVsId?: string | null;
  onMoved?: () => void;
};

function MapCanvasInner({ divisions, companyName, breadcrumbSlot, focusVsId, onMoved }: Props) {
  const rf = useReactFlow();
  const paneW = useStore((s) => s.width);
  const paneH = useStore((s) => s.height);
  const openRole = useOpenRole();
  const { companyId } = useCompany();

  // ── Edit mode (Apple-home-screen drag-to-reparent) ───────────────────────────
  // OFF by default → the map is pixel-identical to the read-only view (drag
  // disabled, click-to-drill active). ON → process nodes (L3 value stream, L4
  // sub-process, L5 task) become draggable; dropping one onto a node exactly one
  // level above (e.g. an L4 onto a different L3, including a different value
  // stream) re-parents the whole subtree via PATCH /builder/nodes/:id.
  const [editMode, setEditMode] = useState(false);
  // ── Custom pointer-drag state (see useMapDragDrop) ───────────────────────────
  // `drag` is the in-progress gesture (ghost follows the cursor); `gap` is the open
  // insertion slot under the cursor. Declared up here so the display-array memos
  // can lift the dragged card out of the layout while it's in flight.
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [gap, setGap] = useState<GapState | null>(null);
  // When the cursor is over the CENTRE of a box → that box highlights as a "nest
  // inside" target (drop makes the dragged card its child, one level deeper).
  const [nestTargetId, setNestTargetId] = useState<string | null>(null);
  // Transient feedback banner (success / invalid-move), auto-dismisses.
  const [moveFlash, setMoveFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const flashTimer = useRef<number | null>(null);
  const flash = useCallback((kind: 'ok' | 'err', text: string) => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    setMoveFlash({ kind, text });
    flashTimer.current = window.setTimeout(() => setMoveFlash(null), 2600);
  }, []);

  // ── Staged edits (Save / Revert) ─────────────────────────────────────────────
  // Drags never hit the DB directly; they accumulate here until the user Saves
  // (one atomic /builder/nodes/batch call) or Reverts. A move records its target
  // parent + whether the node keeps its level: SAME-LEVEL re-homes render
  // optimistically under the new parent (matching element type); RE-LEVEL moves
  // just flag the card and reconcile on Save's refetch. A reorder records the new
  // left-to-right (or top-to-bottom) child order for a parent.
  const [pendingMoves, setPendingMoves] = useState<Map<string, MoveRec>>(new Map());
  const [pendingOrder, setPendingOrder] = useState<Map<string, string[]>>(new Map());
  // Staged inline renames (rawId → new display name).
  const [pendingRenames, setPendingRenames] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const dirty = pendingMoves.size > 0 || pendingOrder.size > 0 || pendingRenames.size > 0;
  const pendingCount = pendingMoves.size + pendingOrder.size + pendingRenames.size;
  // Active double-click rename editor (positioned over the box, in screen coords).
  const [rename, setRename] = useState<RenameState | null>(null);

  // ── Drill/focus state machine (viz/map/useMapFocus) ──────────────────────────
  const {
    companyOpen,
    selectedDomain,
    level,
    focusedDivisionId,
    focusedVsId,
    focusedStepId,
    focusedSubStepId,
    flowData,
    flowLoading,
    vsFlowData,
    vsFlowLoading,
    fetchFlow,
    fetchVsFlow,
    onCompanyClick,
    onDomainClick,
    onDivisionClick,
    onVsClick,
    onStepClick,
    onSubStepClick,
    crumbToL0,
    crumbToL1,
    crumbToL2,
    crumbToL3,
    crumbToDomains,
  } = useMapFocus(divisions, focusVsId);

  // Right-hand metrics dashboard (per-level, spreadsheet-derived).
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [, setDashLoading] = useState(false);
  // Comprehensive "view all" drawer (a snapshot of one sidebar section).
  const [drawerSection, setDrawerSection] = useState<MetricSection | null>(null);
  // Value-stream full detail, shown as an in-place drawer (the standalone page
  // was retired — the map is the only home for this content now).
  const [vsDetailId, setVsDetailId] = useState<string | null>(null);
  // Testing-template modal for the focused process node (value stream / step).
  const [testingNodeId, setTestingNodeId] = useState<string | null>(null);

  // The map keys L1 domain headers by category NAME (`core:<name>`); the real
  // ProcessNode id rides on each division as higherCategoryId. These two maps let
  // the domain header act as an id-backed drag source / drop target.
  const domainIdByCat = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of divisions) {
      const c = catFor(d);
      if (d.higherCategoryId && !m.has(c)) m.set(c, d.higherCategoryId);
    }
    return m;
  }, [divisions]);
  const domainCatById = useMemo(() => {
    const m = new Map<string, string>();
    for (const [c, id] of domainIdByCat) m.set(id, c);
    return m;
  }, [domainIdByCat]);

  // Canvas node id → raw ProcessNode id. Domains resolve via the name→id map; L2
  // divisions already carry their raw id; deeper nodes strip the level prefix.
  const rawNodeId = useCallback(
    (node: { id: string }): string | null => {
      const id = node.id;
      if (id === 'company') return null;
      if (id.startsWith('core:')) return domainIdByCat.get(id.slice(5)) ?? null;
      return id.replace(/^(vs|step|substep|leaf):/, '');
    },
    [domainIdByCat],
  );

  // Apply a parent's staged child order (listed ids first, in order; the rest keep
  // their incoming order).
  const applyOrder = useCallback(
    <T,>(parentRaw: string | null, arr: T[], idOf: (t: T) => string): T[] => {
      if (!parentRaw) return arr;
      const ord = pendingOrder.get(parentRaw);
      if (!ord) return arr;
      const pos = new Map(ord.map((id, i) => [id, i]));
      return [...arr].sort(
        (a, b) => (pos.get(idOf(a)) ?? Infinity) - (pos.get(idOf(b)) ?? Infinity),
      );
    },
    [pendingOrder],
  );

  // ── Derived, pending-aware display data (viz/map/useStagedDisplay) ───────────
  const {
    displayDivisions,
    focusedDivision,
    valueStreams,
    focusedVs,
    steps,
    focusedStep,
    focusedSubStep,
  } = useStagedDisplay({
    divisions,
    dirty,
    pendingMoves,
    applyOrder,
    domainCatById,
    flowData,
    vsFlowData,
    focusedDivisionId,
    focusedVsId,
    focusedStepId,
    focusedSubStepId,
  });

  // Hovering "+" opens the insertion slot; CLOSING is delayed so micro pointer
  // wobbles don't snap the row back and forth, and OPENING is idempotent: if
  // the same gap is already open we return the previous state object so React
  // bails out of the re-render. Without that bail-out every mouseover set a
  // fresh gap object → re-render → xyflow re-inserted node DOM → the browser
  // bounced hover off the badge → mouseleave/enter → set again — a ~40ms
  // feedback storm that made the badge flash and swallow clicks.
  const gapCloseTimer = useRef<number | null>(null);
  const plusHoverGap = useCallback((g: GapState | null) => {
    if (gapCloseTimer.current) {
      window.clearTimeout(gapCloseTimer.current);
      gapCloseTimer.current = null;
    }
    if (g)
      setGap((prev) => (prev?.hover && prev.index === g.index && prev.type === g.type ? prev : g));
    else
      gapCloseTimer.current = window.setTimeout(() => {
        gapCloseTimer.current = null;
        // Only clear a hover-opened gap — a drag owns its own gap state.
        setGap((prev) => (prev?.hover ? null : prev));
      }, 250);
  }, []);

  // ── Add / Remove (edit mode) ──────────────────────────────────────────────
  // Unlike drags/renames these are NOT staged — a create/delete is applied
  // immediately (the backend maintains the closure transactionally) and the
  // affected flows refetch. Deletes cascade the whole subtree behind a confirm
  // modal; adds offer to capture the lower-level steps in the same flow.
  const dialogs = useDialogs();

  const refetchFocused = useCallback(() => {
    onMoved?.();
    if (focusedDivisionId) fetchFlow(focusedDivisionId);
    if (focusedDivisionId && focusedVsId) fetchVsFlow(focusedDivisionId, focusedVsId);
  }, [onMoved, focusedDivisionId, focusedVsId, fetchFlow, fetchVsFlow]);

  // Create a node at `level` under `parentId` (prompting for its name); when a
  // row anchor is given the new node is spliced in right after it. Afterwards
  // the user is offered the lower-level children, one prompt at a time.
  const createNode = useCallback(
    async (level: number, parentId: string | null, row?: { ids: string[]; afterId: string }) => {
      if (!companyId) return;
      const label = LEVEL_LABEL[level] ?? 'node';
      const name = await dialogs.prompt({
        title: `Add ${label}`,
        label: 'Name',
        placeholder: `New ${label}`,
        confirmLabel: 'Add',
      });
      if (!name) return;
      try {
        const created = (await api.post(
          `/builder/nodes?companyId=${encodeURIComponent(companyId)}`,
          {
            typeKey: `p${level}`,
            parentId,
            name,
          },
        )) as { id: string };
        if (row && parentId) {
          const ids = row.ids.filter((id) => id !== created.id);
          const at = ids.indexOf(row.afterId);
          if (at >= 0) ids.splice(at + 1, 0, created.id);
          else ids.push(created.id);
          await api.post(`/builder/nodes/batch?companyId=${encodeURIComponent(companyId)}`, {
            ops: [{ op: 'reorder', parentId, orderedIds: ids }],
          });
        }
        // Connected-additions rule: a new container shouldn't stay empty —
        // offer its lower-level steps in the same flow.
        if (level < MAX_LEVEL) {
          const childLabel = LEVEL_LABEL[level + 1] ?? 'node';
          let addMore = await dialogs.confirm({
            title: `Add ${childLabel}s under “${name}”?`,
            message: `“${name}” was added. You can capture its lower-level ${childLabel}s now, one at a time.`,
            confirmLabel: `Add ${childLabel}s`,
            cancelLabel: 'Not now',
          });
          while (addMore) {
            const childName = await dialogs.prompt({
              title: `Add ${childLabel} under “${name}”`,
              label: 'Name',
              message: 'Cancel when you are done.',
              confirmLabel: 'Add',
            });
            if (!childName) {
              addMore = false;
            } else {
              await api.post(`/builder/nodes?companyId=${encodeURIComponent(companyId)}`, {
                typeKey: `p${level + 1}`,
                parentId: created.id,
                name: childName,
              });
            }
          }
        }
        flash('ok', 'Added.');
        refetchFocused();
      } catch (e) {
        const msg = (e as Error)?.message;
        flash('err', msg && !/HTTP/.test(msg) ? msg : 'Add failed.');
      }
    },
    [companyId, dialogs, flash, refetchFocused],
  );

  // Row context for a canvas node: process level, effective parent, and the
  // rendered sibling raw-id order (for splicing an added node into place).
  const rowInfoFor = useCallback(
    (n: Node): { level: number; parent: string | null; rowIds: string[] } | null => {
      switch (n.type) {
        case 'coreNode':
          return { level: 1, parent: null, rowIds: [] };
        case 'divisionNode': {
          const cat = (n.data as { category?: string }).category ?? '';
          return {
            level: 2,
            parent: domainIdByCat.get(cat) ?? null,
            rowIds: displayDivisions.filter((d) => catFor(d) === cat).map((d) => d.id),
          };
        }
        case 'valueStreamNode':
          return { level: 3, parent: focusedDivisionId, rowIds: valueStreams.map((v) => v.id) };
        case 'stepNode':
          return { level: 4, parent: focusedVsId, rowIds: steps.map((s) => s.id) };
        case 'subStepNode':
          return {
            level: 5,
            parent: focusedStepId,
            rowIds: focusedStep?.subSteps.map((s) => s.id) ?? [],
          };
        default:
          return null;
      }
    },
    [
      domainIdByCat,
      displayDivisions,
      focusedDivisionId,
      focusedVsId,
      focusedStepId,
      focusedStep,
      valueStreams,
      steps,
    ],
  );

  // "+" on a card → add a sibling right after it (same level, same parent).
  const handleAddAfter = useCallback(
    (n: Node) => {
      const info = rowInfoFor(n);
      if (!info) return;
      const raw = rawNodeId(n);
      void createNode(
        info.level,
        info.parent,
        raw && info.parent ? { ids: info.rowIds, afterId: raw } : undefined,
      );
    },
    [rowInfoFor, rawNodeId, createNode],
  );

  // "−" on a card → confirm modal, then delete the node and its WHOLE subtree.
  const handleRemove = useCallback(
    async (n: Node, name: string) => {
      if (!companyId) return;
      const raw = rawNodeId(n);
      if (!raw) return;
      const ok = await dialogs.confirm({
        title: `Remove “${sentenceCase(name)}”?`,
        message: 'This permanently deletes this step and every step beneath it.',
        danger: true,
        confirmLabel: 'Remove',
      });
      if (!ok) return;
      try {
        await api.delete(
          `/builder/nodes/${raw}?companyId=${encodeURIComponent(companyId)}&confirm=${encodeURIComponent(name)}`,
        );
        // Collapse focus off the deleted branch (each toggle clears its level + below).
        if (raw === focusedSubStepId) onSubStepClick(raw);
        else if (raw === focusedStepId) onStepClick(raw);
        else if (raw === focusedVsId) onVsClick(raw);
        else if (raw === focusedDivisionId) onDivisionClick(raw);
        else if (selectedDomain && domainCatById.get(raw) === selectedDomain)
          onDomainClick(selectedDomain);
        // Drop any staged edits that reference the deleted node.
        setPendingMoves((m) => {
          if (!m.has(raw)) return m;
          const next = new Map(m);
          next.delete(raw);
          return next;
        });
        setPendingRenames((m) => {
          if (!m.has(raw)) return m;
          const next = new Map(m);
          next.delete(raw);
          return next;
        });
        setPendingOrder((m) => {
          let touched = false;
          const next = new Map<string, string[]>();
          for (const [p, ids] of m) {
            if (p === raw) {
              touched = true;
              continue;
            }
            const filtered = ids.filter((id) => id !== raw);
            if (filtered.length !== ids.length) touched = true;
            next.set(p, filtered);
          }
          return touched ? next : m;
        });
        flash('ok', 'Removed.');
        refetchFocused();
      } catch (e) {
        const msg = (e as Error)?.message;
        flash('err', msg && !/HTTP/.test(msg) ? msg : 'Remove failed.');
      }
    },
    [
      companyId,
      rawNodeId,
      dialogs,
      focusedSubStepId,
      focusedStepId,
      focusedVsId,
      focusedDivisionId,
      selectedDomain,
      domainCatById,
      onSubStepClick,
      onStepClick,
      onVsClick,
      onDivisionClick,
      onDomainClick,
      flash,
      refetchFocused,
    ],
  );

  // ── Metrics dashboard target (deepest focused level) ───────────────────────
  // The metrics/roles dashboards bottom out at the process-area (L3) level, so
  // drilling into L4 sub-processes / L5 steps keeps the L3 dashboard in view.
  const metricTarget = useMemo<{ level: string; id: string } | null>(() => {
    // The metrics sidebar follows the deepest focused node: L5 step, then the
    // L4 sub-process (its authored inputs/outputs/leads detail), then the value
    // stream, whose sidebar offers the "View full details" drawer.
    if (level >= 4 && focusedSubStep) return { level: 'step', id: focusedSubStep.id };
    if (focusedStep) return { level: 'step', id: focusedStep.id };
    if (focusedVs) return { level: 'valueStream', id: focusedVs.id };
    return null;
  }, [level, focusedSubStep, focusedStep?.id, focusedVs?.id]);

  // Sidebar-internal drill stack (e.g. department — these aren't map nodes, so
  // they navigate inside the dashboard rather than the canvas).
  const [ovStack, setOvStack] = useState<{ level: string; id: string }[]>([]);
  const dashTarget = ovStack.length ? ovStack[ovStack.length - 1] : metricTarget;

  // Map navigation resets the sidebar drill stack.
  useEffect(() => {
    setOvStack([]);
  }, [metricTarget?.level, metricTarget?.id]);

  // Any change of the focused entity makes the drawer's snapshot stale — close it.
  useEffect(() => {
    setDrawerSection(null);
  }, [dashTarget?.level, dashTarget?.id]);

  useEffect(() => {
    // Flag off → skip the fetch entirely, not just the render.
    if (!SHOW_METRICS_SIDEBAR || !dashTarget) {
      setDash(null);
      return;
    }
    let cancelled = false;
    setDashLoading(true);
    setDash(null);
    const path = dashTarget.id
      ? `/explorer/roles/${dashTarget.level}/${encodeURIComponent(dashTarget.id)}`
      : `/explorer/roles/${dashTarget.level}`;
    api
      .get<Dashboard>(path)
      .then((d) => {
        if (!cancelled) setDash(d);
      })
      .catch(() => {
        if (!cancelled) setDash(null);
      })
      .finally(() => {
        if (!cancelled) setDashLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dashTarget?.level, dashTarget?.id]);

  // ── Build nodes and edges (see viz/map/buildGraph.ts) ─────────────────────
  const { nodes, edges } = useMemo(
    () =>
      buildMapGraph({
        displayDivisions,
        companyName,
        companyOpen,
        selectedDomain,
        level,
        focusedDivisionId,
        focusedVsId,
        focusedStepId,
        focusedSubStepId,
        flowData,
        valueStreams,
        vsFlowData,
        steps,
        applyOrder,
        domainIdByCat,
      }),
    [
      displayDivisions,
      companyName,
      companyOpen,
      selectedDomain,
      level,
      focusedDivisionId,
      focusedDivision,
      focusedVsId,
      focusedStepId,
      focusedStep,
      focusedSubStepId,
      flowData,
      valueStreams,
      vsFlowData,
      steps,
      applyOrder,
      domainIdByCat,
    ],
  );

  // Overlay edit-mode affordances onto the laid-out nodes WITHOUT touching the
  // layout memo (which `onNodeDragStop` reads for snap-back). In edit mode the
  // three process levels become draggable and get the grab/dashed style; the
  // hovered valid parent gets the drop-target ring. In normal view this is a
  // shallow pass-through (no draggable, no affordance) so the map is unchanged.
  const displayNodes = useMemo<Node[]>(() => {
    if (!editMode) return nodes;
    // Lift the dragged card out (a dragged domain/coreNode isn't in the data arrays,
    // so drop it by id here; L2–L5 are already removed upstream).
    const liftId = drag?.started ? drag.canvasId : null;
    let result = liftId ? nodes.filter((n) => n.id !== liftId) : nodes;
    // Open the insertion slot: every rendered card of the gap's type at/after the
    // index slides over by one card-width (the CSS transform-transition animates it).
    if (gap) {
      const horiz = gap.type !== 'subStepNode';
      const rowNodes = result
        .filter((n) => n.type === gap.type)
        .sort((a, b) => (horiz ? a.position.x - b.position.x : a.position.y - b.position.y));
      const shiftIds = new Set(rowNodes.slice(gap.index).map((n) => n.id));
      if (shiftIds.size) {
        // A drag opens a full card-width slot (the card will land there); a
        // "+" hover spreads just enough to make room for the badge.
        const spread = gap.hover ? PLUS_GAP_SPREAD : (horiz ? MAP_CARD_W : MAP_CARD_H) + 12;
        const dx = horiz ? spread : 0;
        const dy = horiz ? 0 : spread;
        result = result.map((n) =>
          shiftIds.has(n.id)
            ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
            : n,
        );
      }
    }
    const mapped = result.map((n) => {
      const draggable = DRAGGABLE_TYPES.has(n.type ?? '');
      const raw = rawNodeId(n);
      const renamed = raw != null ? pendingRenames.get(raw) : undefined;
      const staged = (raw != null && pendingMoves.has(raw)) || renamed !== undefined;
      const nestTarget = n.id === nestTargetId; // "nest inside here" highlight
      if (!draggable && !staged && !nestTarget) return n;
      const data: Record<string, unknown> = {
        ...n.data,
        editable: draggable,
        staged,
        dropTarget: nestTarget,
      };
      if (draggable && !drag?.started) {
        // Hover-only +/× badges. The remove confirm needs the SERVER name (a
        // staged rename hasn't been saved yet), so capture it pre-overlay.
        const orig = n.data as { name?: string; label?: string; pieceIndex?: number };
        const serverName = orig.name ?? orig.label ?? '';
        data.plusSide = n.type === 'subStepNode' ? 'bottom' : 'right';
        data.onAddAfter = () => handleAddAfter(n);
        data.onRemove = () => void handleRemove(n, serverName);
        // Hovering "+" opens the insertion slot after this card (same gap the
        // drag gesture uses), previewing where the new step will land.
        data.onPlusHover = (h: boolean) =>
          plusHoverGap(
            h
              ? { parent: '', index: (orig.pieceIndex ?? 0) + 1, type: n.type ?? '', hover: true }
              : null,
          );
      }
      if (renamed !== undefined) {
        if (n.type === 'coreNode') data.label = renamed;
        else data.name = renamed;
      }
      // Descending zIndex along the row: every card paints ABOVE its following
      // sibling, so the "+" badge hanging into the gutter is always on top and
      // reachable from any pointer direction (a :hover z-raise raced fast paths).
      if (draggable) {
        const idx = (n.data as { pieceIndex?: number }).pieceIndex ?? 0;
        return { ...n, zIndex: 200 - idx, data };
      }
      return { ...n, data };
    });
    // "+ Add …" placeholder under a focused node with no rendered children —
    // the in-place way to seed a first child at any level.
    const placeholders: Node[] = [];
    const addPlaceholder = (parentCanvasId: string, childLevel: number, parentRaw: string) => {
      const p = nodes.find((x) => x.id === parentCanvasId);
      if (!p) return;
      placeholders.push({
        id: `add:${parentRaw}`,
        type: 'addNode',
        position: { x: p.position.x, y: p.position.y + MAP_CARD_H + 32 },
        data: {
          label: `Add ${LEVEL_LABEL[childLevel] ?? 'node'}`,
          onClick: () => void createNode(childLevel, parentRaw),
        },
        draggable: false,
        selectable: false,
      });
    };
    if (!drag?.started) {
      const domRaw = selectedDomain ? domainIdByCat.get(selectedDomain) : undefined;
      if (selectedDomain && domRaw && !displayDivisions.some((d) => catFor(d) === selectedDomain))
        addPlaceholder(`core:${selectedDomain}`, 2, domRaw);
      if (focusedDivisionId && flowData && !flowLoading && valueStreams.length === 0)
        addPlaceholder(focusedDivisionId, 3, focusedDivisionId);
      if (focusedVsId && vsFlowData && !vsFlowLoading && steps.length === 0)
        addPlaceholder(`vs:${focusedVsId}`, 4, focusedVsId);
      if (focusedStepId && focusedStep && focusedStep.subSteps.length === 0)
        addPlaceholder(`step:${focusedStepId}`, 5, focusedStepId);
    }
    return placeholders.length ? [...mapped, ...placeholders] : mapped;
  }, [
    nodes,
    editMode,
    drag,
    gap,
    nestTargetId,
    rawNodeId,
    pendingMoves,
    pendingRenames,
    handleAddAfter,
    handleRemove,
    createNode,
    selectedDomain,
    domainIdByCat,
    displayDivisions,
    focusedDivisionId,
    focusedVsId,
    focusedStepId,
    focusedStep,
    flowData,
    vsFlowData,
    flowLoading,
    vsFlowLoading,
    valueStreams,
    steps,
  ]);

  // While dragging, drop the lifted card's connectors so its line visibly detaches
  // from its parent (the card itself is hidden in displayNodes; its slot stays so
  // siblings don't shift and the drop target stays put).
  const displayEdges = useMemo<Edge[]>(() => {
    const liftId = drag?.started ? drag.canvasId : null;
    return liftId ? edges.filter((e) => e.source !== liftId && e.target !== liftId) : edges;
  }, [edges, drag]);

  const flowNodes = displayNodes;

  // ── Camera helpers + drill-driven camera effects (viz/map/useMapCamera) ────
  useMapCamera({
    rf,
    paneW,
    paneH,
    dragRef,
    companyOpen,
    selectedDomain,
    level,
    focusedDivisionId,
    focusedVsId,
    focusedStepId,
    focusedSubStepId,
    flowData,
    vsFlowData,
    valueStreams,
    steps,
    focusedStep,
  });

  // ── Edit-mode pointer drag/drop (viz/map/useMapDragDrop) ───────────────────
  const { onStagePointerDown, clearHoverDrill, gapRef, nestRef } = useMapDragDrop({
    editMode,
    rf,
    nodes,
    drag,
    setDrag,
    dragRef,
    setGap,
    setNestTargetId,
    selectedDomain,
    focusedDivisionId,
    focusedVsId,
    focusedStepId,
    focusedStep,
    valueStreams,
    steps,
    displayDivisions,
    catFor,
    domainIdByCat,
    domainCatById,
    rawNodeId,
    onDomainClick,
    onDivisionClick,
    onVsClick,
    onStepClick,
    onSubStepClick,
    setPendingMoves,
    setPendingOrder,
    pendingRenames,
    setRename,
    flash,
  });

  // ── Save / Revert staged edits ────────────────────────────────────────────────
  const onSave = useCallback(async () => {
    if (!companyId || !dirty || saving) return;
    const ops: (
      | { op: 'move'; id: string; newParentId: string }
      | { op: 'reorder'; parentId: string; orderedIds: string[] }
      | { op: 'rename'; id: string; name: string }
    )[] = [];
    for (const [id, rec] of pendingMoves) ops.push({ op: 'move', id, newParentId: rec.parent });
    for (const [parentId, orderedIds] of pendingOrder)
      ops.push({ op: 'reorder', parentId, orderedIds });
    for (const [id, name] of pendingRenames) ops.push({ op: 'rename', id, name });
    setSaving(true);
    try {
      await api.post(`/builder/nodes/batch?companyId=${encodeURIComponent(companyId)}`, { ops });
      setPendingMoves(new Map());
      setPendingOrder(new Map());
      setPendingRenames(new Map());
      flash('ok', 'Saved.');
      if (focusedDivisionId) fetchFlow(focusedDivisionId);
      if (focusedDivisionId && focusedVsId) fetchVsFlow(focusedDivisionId, focusedVsId);
      onMoved?.();
    } catch (e) {
      const msg = (e as Error)?.message;
      flash('err', msg && !/HTTP/.test(msg) ? msg : 'Save failed — your changes are kept.');
    } finally {
      setSaving(false);
    }
  }, [
    companyId,
    dirty,
    saving,
    pendingMoves,
    pendingOrder,
    pendingRenames,
    focusedDivisionId,
    focusedVsId,
    fetchFlow,
    fetchVsFlow,
    onMoved,
    flash,
  ]);

  const onRevert = useCallback(() => {
    setPendingMoves(new Map());
    setPendingOrder(new Map());
    setPendingRenames(new Map());
    setRename(null);
    flash('ok', 'Reverted.');
  }, [flash]);

  // Commit the inline rename editor → stage the new name.
  const commitRename = useCallback(() => {
    if (!rename) return;
    const v = rename.value.trim();
    if (v)
      setPendingRenames((m) => {
        const n = new Map(m);
        n.set(rename.rawId, v);
        return n;
      });
    setRename(null);
  }, [rename]);

  const onToggleEdit = useCallback(() => {
    if (editMode && dirty) {
      flash('err', 'Save or revert your changes first.');
      return;
    }
    setEditMode((v) => !v);
    dragRef.current = null;
    gapRef.current = null;
    nestRef.current = null;
    setDrag(null);
    setGap(null);
    setNestTargetId(null);
    setRename(null);
    clearHoverDrill();
  }, [editMode, dirty, flash, clearHoverDrill, gapRef, nestRef]);

  // ── Node click handler ────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback(
    (_e, node) => {
      // Click-to-drill stays active in edit mode for every level so the user can
      // navigate to the branch they want to edit. React Flow fires this only on a
      // genuine click (a drag goes through onNodeDragStop instead), so click and
      // drag don't collide.
      if (node.type === 'companyNode') {
        onCompanyClick();
      } else if (node.type === 'coreNode') {
        onDomainClick(node.id.replace(/^core:/, '') as Category);
      } else if (node.type === 'divisionNode') {
        onDivisionClick(node.id);
      } else if (node.type === 'valueStreamNode') {
        onVsClick(node.id.replace(/^vs:/, ''));
      } else if (node.type === 'stepNode') {
        onStepClick(node.id.replace(/^step:/, ''));
      } else if (node.type === 'subStepNode') {
        onSubStepClick(node.id.replace(/^substep:/, ''));
      }
      // leafStepNode (L5) is display-only (non-interactive)
    },
    [onCompanyClick, onDomainClick, onDivisionClick, onVsClick, onStepClick, onSubStepClick],
  );

  // ── Dashboard drill-down ────────────────────────────────────────────────────
  // Map levels move the canvas; departments drill inside the sidebar (stack).
  const onDrill = useCallback(
    (lvl: string, id: string) => {
      // Roles are the leaf of the sidebar drill — clicking one opens the role
      // drawer in place (over the map) rather than leaving for another page.
      if (lvl === 'role') {
        openRole(id);
        return;
      }
      if (lvl === 'department') {
        setOvStack((s) => [...s, { level: lvl, id }]);
        return;
      }
      setOvStack([]);
      if (lvl === 'domain') onDomainClick(id as Category);
      else if (lvl === 'division') onDivisionClick(id);
      else if (lvl === 'valueStream') onVsClick(id);
      else if (lvl === 'step') onStepClick(id);
    },
    [openRole, onDomainClick, onDivisionClick, onVsClick, onStepClick],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex' }}>
      {/* Breadcrumb — rendered into the page header via portal (lives in the header, not over the canvas). */}
      {breadcrumbSlot &&
        createPortal(
          <MapBreadcrumb
            companyName={companyName}
            selectedDomain={selectedDomain}
            level={level}
            focusedDivision={focusedDivision}
            focusedVs={focusedVs}
            focusedStep={focusedStep}
            focusedSubStep={focusedSubStep ?? null}
            crumbToDomains={crumbToDomains}
            crumbToL0={crumbToL0}
            crumbToL1={crumbToL1}
            crumbToL2={crumbToL2}
            crumbToL3={crumbToL3}
          />,
          breadcrumbSlot,
        )}

      {/* Fetch loading indicator */}
      {(flowLoading || vsFlowLoading) && (
        <div
          className="animate-pulse"
          style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            padding: '6px 14px',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #eaeaea',
            borderRadius: 8,
            fontSize: 12,
            color: '#a3a3a3',
          }}
        >
          Loading…
        </div>
      )}

      {/* React Flow canvas. No `fitView` prop on purpose: it queues a
          vertically-CENTERED fit on init that lands after (and overrides) the
          top-pinned fit from fitTopView — the companyOpen mount effect handles
          the initial camera instead. */}
      <div
        className={'rf-stage rf-stage--map' + (editMode ? ' rf-stage--edit' : '')}
        style={{ flex: 1, position: 'relative' }}
        onPointerDownCapture={onStagePointerDown}
      >
        <ReactFlow
          nodes={flowNodes}
          edges={displayEdges}
          nodeTypes={mapNodeTypes}
          onNodeClick={onNodeClick}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnDrag={!editMode}
          minZoom={0.05}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e5e5e5" gap={20} size={1} />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>

        {/* Drag ghost — a card-sized chip following the cursor 1:1 (pointer-events
            off so it's transparent to hit-testing). Only while really dragging. */}
        {drag?.started && <DragGhost drag={drag} />}

        {/* Inline rename editor — double-click a box in edit mode to open it. */}
        {rename && (
          <RenameEditor rename={rename} setRename={setRename} commitRename={commitRename} />
        )}

        {/* Edit toolbar — top-right of the canvas (the view toggle owns top-left). */}
        <MapEditToolbar
          editMode={editMode}
          dirty={dirty}
          pendingCount={pendingCount}
          saving={saving}
          onSave={onSave}
          onRevert={onRevert}
          onToggleEdit={onToggleEdit}
        />

        {/* Move feedback — small ephemeral banner, bottom-center (never a window.alert). */}
        {moveFlash && <MoveFlashBanner moveFlash={moveFlash} />}

        {/* Comprehensive "view all" drawer — overlays the canvas; closing it leaves
            the map (and its breadcrumb) exactly where the user left it. */}
        {drawerSection && (
          <MetricsDrawer
            section={drawerSection}
            contextTitle={dash?.title ?? ''}
            onClose={() => setDrawerSection(null)}
            onDrill={onDrill}
          />
        )}

        {/* Value-stream full detail — slides over the canvas in place. */}
        {vsDetailId && (
          <ValueStreamDrawer valueStreamId={vsDetailId} onClose={() => setVsDetailId(null)} />
        )}

        {/* Testing templates for the focused process node — slides over the canvas. */}
        {testingNodeId && (
          <TestingTemplateModal nodeId={testingNodeId} onClose={() => setTestingNodeId(null)} />
        )}
      </div>

      {/* Right inspector — same component as the list view. Opens collapsed (a
          rail) so the canvas isn't covered; breadcrumb/child clicks re-target it
          without moving the map. */}
      {SHOW_METRICS_SIDEBAR && dashTarget && dashTarget.id && (
        <Inspector
          nodeId={dashTarget.id}
          startCollapsed
          onRetarget={(id) => setOvStack((s) => [...s, { level: 'node', id }])}
        />
      )}
    </div>
  );
}

// ── Provider wrapper ──────────────────────────────────────────────────────────

export default function MapCanvas({
  divisions,
  companyName,
  breadcrumbSlot,
  focusVsId,
  onMoved,
}: Props) {
  return (
    <ReactFlowProvider>
      <MapCanvasInner
        divisions={divisions}
        companyName={companyName}
        breadcrumbSlot={breadcrumbSlot}
        focusVsId={focusVsId}
        onMoved={onMoved}
      />
    </ReactFlowProvider>
  );
}
