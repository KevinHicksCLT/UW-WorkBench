// MapCanvas.tsx — Interactive operating-model map with spatial drill-down.
// L0 Enterprise → L1 Domain (3 CEO domains, horizontal row) → L2 Division
// (horizontal row under the selected domain) → L3 Value Stream → L4 Process Area
// → L5 Sub-Process → L6 Process Step (the workbook's L5 steps) — each level
// rendering left-to-right as you drill in.
// A right-hand MetricsSidebar shows a spreadsheet-derived dashboard for whatever
// level is currently focused (company / domain / division / value stream / area)
// — the SAME panel the list view shows (SHOW_METRICS_SIDEBAR below).

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, ReactFlowProvider,
  useReactFlow,
  type Node, type Edge, type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { mapNodeTypes, MAP_CARD_W, MAP_CARD_H, sentenceCase } from './nodes/MapNode';
import type {
  CompanyNodeData, CoreNodeData, DivisionNodeData, ValueStreamNodeData, StepNodeData, SubStepNodeData, LeafStepNodeData,
} from './nodes/MapNode';
import { DOMAIN_HEX } from './model';
import type { NodeFocusState, DivisionSummary, DivisionFlow, FlowStep, FlowValueStream } from './model';
import { MetricsDrawer, type Dashboard, type MetricSection } from '../components/MetricsSidebar';
import ValueStreamDrawer from '../components/ValueStreamDrawer';
import TestingTemplateModal from '../components/TestingTemplateModal';
import Inspector from '../components/Inspector';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';

// ── Layout constants ─────────────────────────────────────────────────────────

// Right-side metrics sidebar — re-enabled so the map matches the list view
// (was gated off in defect backlog 02, D3.3, while the data was distrusted;
// the deliverable-chain rework restored confidence). Both fetch + render gate
// on this flag.
const SHOW_METRICS_SIDEBAR: boolean = true;

// Every card is the same size (MAP_CARD_W × MAP_CARD_H, from MapNode.tsx) so the
// whole map reads as one consistent grid. The per-level aliases below keep the
// layout math readable but all resolve to the same dimensions.
// Spacing matches the Organization map (OrgMapCanvas): siblings sit GAP_X = 12
// apart, and each child block drops ROW_GAP_Y = 32 below its parent row.
const COMPANY_H        = MAP_CARD_H;
const DOMAIN_TOP_OFFSET = 32;  // y offset from company bottom to the domain row
const CORE_W          = MAP_CARD_W;
const CORE_H          = MAP_CARD_H;
const DIV_W           = MAP_CARD_W;
const DIV_H           = MAP_CARD_H;
const DIV_GAP_X       = 12;    // horizontal gap between divisions in the L2 row
const COL_GAP_X       = 12;    // horizontal gap between column centers
const DIV_TOP_OFFSET  = 32;    // y offset from domain bottom to first division top
const VS_W            = MAP_CARD_W;
const VS_H            = MAP_CARD_H;
const VS_GAP_X        = 12;
const VS_TOP_OFFSET   = 32;    // gap between focused-division bottom and VS row top
const STEP_W          = MAP_CARD_W;
const STEP_H          = MAP_CARD_H;
const STEP_GAP_X      = 12;    // horizontal gap between ordered L4 process steps (left→right row)
const STEP_TOP_OFFSET = 32;    // gap between focused-VS bottom and step row top
const SUBSTEP_GAP_Y     = 12;  // vertical gap between ordered L5 sub-processes (top→bottom column)
const SUBSTEP_TOP_OFFSET = 32; // vertical offset of the L5 column below its focused L4 step
const LEAF_GAP_Y        = 12;  // vertical gap between ordered L5 (leaf) steps
const LEAF_TOP_OFFSET   = 32;  // vertical offset of the leaf column below its focused sub-process

// Compact map breadcrumb (defect backlog 02, D3.5) — the shared .focus-crumb-*
// chips render at 14px; the map path runs five levels deep, so override down
// to ~11px with tighter padding and separators.
const CRUMB: CSSProperties     = { fontSize: 11, padding: '2px 7px' };
const CRUMB_SEP: CSSProperties = { color: '#d4d4d4', margin: '0 2px', fontSize: 10 };

// Segments (the column list), their left-to-right order, and the top-to-bottom
// division order within each column are DATA: the API returns divisions already
// ordered by Node.sortOrder (value-chain order), grouped by their parent segment
// node's name. Renaming or reordering a segment in the builder reflects here.
type Category = string;

function catFor(div: DivisionSummary): Category {
  return div.higherCategory ?? 'Unassigned';
}
function categoriesOf(divisions: DivisionSummary[]): Category[] {
  const seen: Category[] = [];
  for (const d of divisions) { const c = catFor(d); if (!seen.includes(c)) seen.push(c); }
  return seen;
}

// Each draggable map node TYPE maps to a fixed backend ProcessNode level (the
// locked taxonomy: 1 = domain, 2 = division / value stream, 3 = process area,
// 4 = sub-process, 5 = task). A drop re-levels the moved node to target.level+1;
// the deepest level (MAX_LEVEL) can never be a parent. The server is the authority
// on the depth cap — the client only blocks the obvious "drop under L5" case.
const TYPE_LEVEL: Record<string, number> = {
  coreNode: 1, divisionNode: 2, valueStreamNode: 3, stepNode: 4, subStepNode: 5,
};
const MAX_LEVEL = 5;
const HOVER_DRILL_MS = 800; // hold the cursor directly over a box this long mid-drag → it drills open

// An in-progress custom pointer drag of one process card.
type DragState = {
  canvasId: string;      // React Flow node id (vs:.. / step:.. / division id / core:..)
  rawId: string;         // underlying ProcessNode id
  type: string;          // node type (coreNode / divisionNode / …)
  level: number;         // TYPE_LEVEL[type]
  name: string;
  cat: string;           // domain category (for the ghost's accent)
  originParent: string | null; // raw parent id at grab time
  originOrder: string[];       // raw-id order of the origin row at grab time (for no-op reorder detection)
  grabDX: number; grabDY: number; // pointer offset within the card (screen px)
  cardW: number; cardH: number;
  startX: number; startY: number;  // pointer-down position (screen px) — drag threshold origin
  px: number; py: number;          // current pointer position (screen px)
  started: boolean;                // passed the movement threshold → really dragging
};

// A minimal FlowStep for an L4 node optimistically injected under a new parent
// (its real children/detail fill in on Save's refetch).
function synthStep(id: string, name: string): FlowStep {
  return {
    id, step: 0, name, subSteps: [], inputs: null, outputs: null, upstream: null,
    downstream: null, roles: [], categories: [], primaryCategory: null, crossDomain: false, unowned: false,
  };
}

// ── Inner canvas ─────────────────────────────────────────────────────────────

type Props = { divisions: DivisionSummary[]; companyName: string; breadcrumbSlot?: HTMLElement | null; focusVsId?: string | null; onMoved?: () => void };

function MapCanvasInner({ divisions, companyName, breadcrumbSlot, focusVsId, onMoved }: Props) {
  const rf = useReactFlow();
  const navigate = useNavigate();
  const { companyId } = useCompany();

  // ── Edit mode (Apple-home-screen drag-to-reparent) ───────────────────────────
  // OFF by default → the map is pixel-identical to the read-only view (drag
  // disabled, click-to-drill active). ON → process nodes (L3 value stream, L4
  // sub-process, L5 task) become draggable; dropping one onto a node exactly one
  // level above (e.g. an L4 onto a different L3, including a different value
  // stream) re-parents the whole subtree via PATCH /builder/nodes/:id.
  const [editMode, setEditMode] = useState(false);
  // ── Custom pointer-drag state (see the drag lifecycle further down) ──────────
  // `drag` is the in-progress gesture (ghost follows the cursor); `gap` is the open
  // insertion slot under the cursor. Declared up here so the display-array memos
  // can lift the dragged card out of the layout while it's in flight.
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [gap, setGap] = useState<{ parent: string; index: number; type: string } | null>(null);
  // When the cursor is over the CENTRE of a box → that box highlights as a "nest
  // inside" target (drop makes the dragged card its child, one level deeper). Over a
  // GAP between boxes → `gap` opens instead (drop beside). nestRef mirrors the state
  // for the pointer-up handler.
  const nestRef = useRef<string | null>(null);
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
  type MoveRec = { parent: string; sameLevel: boolean; level: number; name: string; cat: string };
  const [pendingMoves, setPendingMoves] = useState<Map<string, MoveRec>>(new Map());
  const [pendingOrder, setPendingOrder] = useState<Map<string, string[]>>(new Map());
  // Staged inline renames (rawId → new display name).
  const [pendingRenames, setPendingRenames] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const dirty = pendingMoves.size > 0 || pendingOrder.size > 0 || pendingRenames.size > 0;
  const pendingCount = pendingMoves.size + pendingOrder.size + pendingRenames.size;
  // Active double-click rename editor (positioned over the box, in screen coords).
  const [rename, setRename] = useState<{ rawId: string; value: string; x: number; y: number; w: number; h: number; cat: string } | null>(null);
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);
  const clickTimerRef = useRef<number | null>(null);

  // Top-of-map gating: company → domains → divisions. The company starts open by
  // default so the three domains are visible on load (drill begins one level in).
  const [companyOpen, setCompanyOpen] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<Category | null>(null);

  // Level / focus state (within a selected domain)
  const [level, setLevel] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [focusedDivisionId, setFocusedDivisionId] = useState<string | null>(null);
  const [focusedVsId, setFocusedVsId] = useState<string | null>(null);
  const [focusedStepId, setFocusedStepId] = useState<string | null>(null);
  const [focusedSubStepId, setFocusedSubStepId] = useState<string | null>(null);

  // API data
  const [flowData, setFlowData] = useState<DivisionFlow | null>(null);
  const [flowLoading, setFlowLoading] = useState(false);
  const [vsFlowData, setVsFlowData] = useState<DivisionFlow | null>(null);
  const [vsFlowLoading, setVsFlowLoading] = useState(false);
  // Right-hand metrics dashboard (per-level, spreadsheet-derived).
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  // Comprehensive "view all" drawer (a snapshot of one sidebar section).
  const [drawerSection, setDrawerSection] = useState<MetricSection | null>(null);
  // Value-stream full detail, shown as an in-place drawer (the standalone page
  // was retired — the map is the only home for this content now).
  const [vsDetailId, setVsDetailId] = useState<string | null>(null);
  // Testing-template modal for the focused process node (value stream / step).
  const [testingNodeId, setTestingNodeId] = useState<string | null>(null);

  // Fetch helpers
  const fetchFlow = useCallback(async (divId: string) => {
    setFlowLoading(true);
    setFlowData(null);
    try {
      const data: DivisionFlow = await api.get(`/explorer/division/${divId}/flow`);
      setFlowData(data);
    } catch { /* ignore */ }
    finally { setFlowLoading(false); }
  }, []);

  const fetchVsFlow = useCallback(async (divId: string, vsId: string) => {
    setVsFlowLoading(true);
    setVsFlowData(null);
    try {
      const data: DivisionFlow = await api.get(`/explorer/division/${divId}/flow?vs=${vsId}`);
      setVsFlowData(data);
    } catch { /* ignore */ }
    finally { setVsFlowLoading(false); }
  }, []);

  // ── Edit-mode drag/drop config ───────────────────────────────────────────────
  // Only process nodes that have a real, on-canvas parent one level above are
  // draggable. division (L2) is excluded: its parent (L1 domain) is keyed by
  // category NAME on the map, not a draggable node id. leaf (L6) is display-only.
  // For each draggable type, VALID_PARENT_TYPE names the node type a drop must
  // land on (exactly one level up). The dashed-outline + ring affordance and the
  // hit-test both key off this table.
  // Every id-backed process level is draggable (L1 domain → L5 sub-process). The
  // enterprise root + the vestigial L6 leaf stay fixed.
  const DRAGGABLE_TYPES = useMemo(() => new Set(['coreNode', 'divisionNode', 'valueStreamNode', 'stepNode', 'subStepNode']), []);

  // The map keys L1 domain headers by category NAME (`core:<name>`); the real
  // ProcessNode id rides on each division as higherCategoryId. These two maps let
  // the domain header act as an id-backed drag source / drop target.
  const domainIdByCat = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of divisions) { const c = catFor(d); if (d.higherCategoryId && !m.has(c)) m.set(c, d.higherCategoryId); }
    return m;
  }, [divisions]);
  const domainCatById = useMemo(() => {
    const m = new Map<string, string>();
    for (const [c, id] of domainIdByCat) m.set(id, c);
    return m;
  }, [domainIdByCat]);

  // Canvas node id → raw ProcessNode id. Domains resolve via the name→id map; L2
  // divisions already carry their raw id; deeper nodes strip the level prefix.
  const rawNodeId = useCallback((node: { id: string }): string | null => {
    const id = node.id;
    if (id === 'company') return null;
    if (id.startsWith('core:')) return domainIdByCat.get(id.slice(5)) ?? null;
    return id.replace(/^(vs|step|substep|leaf):/, '');
  }, [domainIdByCat]);

  // Reset everything below the domain level.
  const resetBelowDomain = useCallback(() => {
    setLevel(0); setFocusedDivisionId(null); setFlowData(null);
    setFocusedVsId(null); setVsFlowData(null); setFocusedStepId(null); setFocusedSubStepId(null);
  }, []);

  // Click handlers
  const onCompanyClick = useCallback(() => {
    if (companyOpen) {
      setCompanyOpen(false); setSelectedDomain(null); resetBelowDomain();
    } else {
      setCompanyOpen(true);
    }
  }, [companyOpen, resetBelowDomain]);

  const onDomainClick = useCallback((cat: Category) => {
    if (selectedDomain === cat) {
      setSelectedDomain(null); resetBelowDomain();  // toggle off → hide divisions
    } else {
      setSelectedDomain(cat); resetBelowDomain();    // switch → show this domain's divisions
    }
  }, [selectedDomain, resetBelowDomain]);

  const onDivisionClick = useCallback((divId: string) => {
    if (focusedDivisionId === divId && level >= 1) {
      setLevel(0); setFocusedDivisionId(null); setFlowData(null);
      setFocusedVsId(null); setVsFlowData(null); setFocusedStepId(null); setFocusedSubStepId(null);
      return;
    }
    setLevel(1); setFocusedDivisionId(divId);
    setFocusedVsId(null); setVsFlowData(null); setFocusedStepId(null); setFocusedSubStepId(null);
    fetchFlow(divId);
  }, [focusedDivisionId, level, fetchFlow]);

  const onVsClick = useCallback((vsId: string) => {
    if (!focusedDivisionId) return;
    if (focusedVsId === vsId && level >= 2) {
      setLevel(1); setFocusedVsId(null); setVsFlowData(null); setFocusedStepId(null); setFocusedSubStepId(null);
      return;
    }
    setLevel(2); setFocusedVsId(vsId); setFocusedStepId(null); setFocusedSubStepId(null);
    fetchVsFlow(focusedDivisionId, vsId);
  }, [focusedDivisionId, focusedVsId, level, fetchVsFlow]);

  // Clicking a process area (L3): focus it and reveal its L4 sub-processes as a
  // left-to-right flow below. The right dashboard updates to this area's metrics.
  const onStepClick = useCallback((stepId: string) => {
    if (focusedStepId === stepId && level >= 3) {
      setLevel(2); setFocusedStepId(null); setFocusedSubStepId(null);
      return;
    }
    setLevel(3); setFocusedStepId(stepId); setFocusedSubStepId(null);
  }, [focusedStepId, level]);

  // Clicking an L4 sub-process: focus it and reveal its L5 process steps (v15)
  // as a left-to-right flow below. Toggles back to the sub-process row (L3 focus).
  const onSubStepClick = useCallback((subId: string) => {
    if (focusedSubStepId === subId && level === 4) {
      setLevel(3); setFocusedSubStepId(null);
      return;
    }
    setLevel(4); setFocusedSubStepId(subId);
  }, [focusedSubStepId, level]);

  // Deep-link focus: jump straight to a value stream (company → domain → division
  // → VS) in one shot. Used when the user arrives from a value-stream link
  // elsewhere in the app. Sets the whole drill path at once and kicks off both
  // flow fetches, so the VS node + its process row + the sidebar all resolve.
  const focusValueStream = useCallback((category: Category, divisionId: string, vsId: string) => {
    setCompanyOpen(true);
    setSelectedDomain(category);
    setLevel(2);
    setFocusedDivisionId(divisionId);
    setFocusedVsId(vsId);
    setFocusedStepId(null);
    setFocusedSubStepId(null);
    fetchFlow(divisionId);
    fetchVsFlow(divisionId, vsId);
  }, [fetchFlow, fetchVsFlow]);

  // Apply an incoming focus target once per id. The backend resolves which domain
  // + division surfaces the stream (it may not be a division's LEAD stream).
  const appliedFocusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusVsId || divisions.length === 0) return;
    if (appliedFocusRef.current === focusVsId) return;
    appliedFocusRef.current = focusVsId;
    let cancelled = false;
    api.get(`/explorer/value-stream/${focusVsId}/focus`)
      .then((f: { divisionId: string; category: string }) => {
        if (!cancelled) focusValueStream(f.category as Category, f.divisionId, focusVsId);
      })
      .catch(() => { /* unresolvable → leave the map at its default view */ });
    return () => { cancelled = true; };
  }, [focusVsId, divisions.length, focusValueStream]);

  // Breadcrumb collapse
  const crumbToL0 = useCallback(() => {
    setLevel(0); setFocusedDivisionId(null); setFlowData(null);
    setFocusedVsId(null); setVsFlowData(null); setFocusedStepId(null); setFocusedSubStepId(null);
  }, []);
  const crumbToL1 = useCallback(() => {
    if (level >= 2) { setLevel(1); setFocusedVsId(null); setVsFlowData(null); setFocusedStepId(null); setFocusedSubStepId(null); }
  }, [level]);
  const crumbToL2 = useCallback(() => {
    if (level >= 3) { setLevel(2); setFocusedStepId(null); setFocusedSubStepId(null); }
  }, [level]);
  const crumbToL3 = useCallback(() => {
    if (level >= 4) { setLevel(3); setFocusedSubStepId(null); }
  }, [level]);
  // Back to the domains row (clears the selected domain + everything below).
  const crumbToDomains = useCallback(() => {
    setSelectedDomain(null); resetBelowDomain();
  }, [resetBelowDomain]);

  // Apply a parent's staged child order (listed ids first, in order; the rest keep
  // their incoming order).
  const applyOrder = useCallback(<T,>(parentRaw: string | null, arr: T[], idOf: (t: T) => string): T[] => {
    if (!parentRaw) return arr;
    const ord = pendingOrder.get(parentRaw);
    if (!ord) return arr;
    const pos = new Map(ord.map((id, i) => [id, i]));
    return [...arr].sort((a, b) => (pos.get(idOf(a)) ?? Infinity) - (pos.get(idOf(b)) ?? Infinity));
  }, [pendingOrder]);

  // Derived — pending-aware. SAME-LEVEL re-homes are rendered under their new
  // parent (removed from the source row, injected into the target row, matching
  // element type); RE-LEVEL moves stay in place flagged and reconcile on Save.

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
  useEffect(() => { setOvStack([]); }, [metricTarget?.level, metricTarget?.id]);

  // Any change of the focused entity makes the drawer's snapshot stale — close it.
  useEffect(() => { setDrawerSection(null); }, [dashTarget?.level, dashTarget?.id]);

  useEffect(() => {
    // Flag off → skip the fetch entirely, not just the render.
    if (!SHOW_METRICS_SIDEBAR || !dashTarget) { setDash(null); return; }
    let cancelled = false;
    setDashLoading(true); setDash(null);
    const path = dashTarget.id
      ? `/explorer/roles/${dashTarget.level}/${encodeURIComponent(dashTarget.id)}`
      : `/explorer/roles/${dashTarget.level}`;
    api.get(path)
      .then((d: Dashboard) => { if (!cancelled) setDash(d); })
      .catch(() => { if (!cancelled) setDash(null); })
      .finally(() => { if (!cancelled) setDashLoading(false); });
    return () => { cancelled = true; };
  }, [dashTarget?.level, dashTarget?.id]); // eslint-disable-line

  // ── Build nodes and edges ─────────────────────────────────────────────────
  // Two-pass layout:
  //   Pass 1: Compute geometry — for each column, walk divisions top-to-bottom.
  //           When reaching the focused division, insert the VS+step block.
  //           Push all subsequent divisions down by the block height.
  //   Pass 2: Emit Node/Edge objects using the computed positions.

  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];

    // Edge palette. Base lines are a visible neutral gray (darker than before so
    // the structure reads); the actively-drilled "selected flow" is drawn in the
    // selected domain's color, thicker and fully opaque.
    const LINE   = '#9ca3af';                                   // visible neutral line
    const accent = selectedDomain ? (DOMAIN_HEX[selectedDomain] ?? LINE) : LINE;

    // Partition divisions by their segment; the API already delivers them in
    // value-chain order (Node.sortOrder), so each column keeps incoming order.
    const categories = categoriesOf(displayDivisions);
    const cols: Record<Category, DivisionSummary[]> = {};
    for (const d of displayDivisions) (cols[catFor(d)] ??= []).push(d);

    // Column center-x values, left→right in segment order.
    const colWidth = DIV_W + COL_GAP_X;
    const colCenterX: Record<Category, number> = {};
    categories.forEach((c, i) => { colCenterX[c] = colWidth * i; });
    const middleX = (colWidth * Math.max(categories.length - 1, 0)) / 2; // geometric centre of the columns

    // ── Company root (always present) ─────────────────────────────────────────
    const companyFs: NodeFocusState = !companyOpen ? 'neutral' : 'expanded';
    ns.push({
      id: 'company',
      type: 'companyNode',
      position: { x: middleX - MAP_CARD_W / 2, y: 0 },
      data: { name: companyName, focusState: companyFs } satisfies CompanyNodeData,
      draggable: false,
      selectable: false,
    });

    // Domains only appear once the company is opened.
    if (!companyOpen) return { nodes: ns, edges: es };

    const domainRowY = COMPANY_H + DOMAIN_TOP_OFFSET;

    // ── Process each domain column ─────────────────────────────────────────────
    categories.forEach((cat, ci) => {
      const cx = colCenterX[cat];
      const coreLeft = cx - CORE_W / 2;
      const isDomainSelected = selectedDomain === cat;

      // Domain header node. Selected → expanded (stays visible while drilling);
      // a different domain selected → dimmed; none selected → neutral.
      const domainFs: NodeFocusState = !selectedDomain ? 'neutral'
        : isDomainSelected ? 'expanded'
        : 'dimmed';
      ns.push({
        id: `core:${cat}`,
        type: 'coreNode',
        position: { x: coreLeft, y: domainRowY },
        data: { label: cat, category: cat, focusState: domainFs, pieceIndex: ci } satisfies CoreNodeData,
        draggable: false,
      });

      // Edge: company → domain
      es.push({
        id: `e:company->${cat}`,
        source: 'company',
        target: `core:${cat}`,
        sourceHandle: 'b',
        targetHandle: 't',
        style: {
          stroke: isDomainSelected ? accent : LINE,
          strokeWidth: isDomainSelected ? 2 : 1.25,
          strokeOpacity: isDomainSelected ? 0.95 : (selectedDomain ? 0.2 : 0.55),
        },
      });

      // Divisions render ONLY for the selected domain — as a horizontal (L2) row
      // centered under the domain header.
      if (!isDomainSelected) return;

      const divs = applyOrder(domainIdByCat.get(cat) ?? null, cols[cat], (d) => d.id);
      const divRowY = domainRowY + CORE_H + DIV_TOP_OFFSET;
      const totalDivRowWidth = divs.length * DIV_W + (divs.length - 1) * DIV_GAP_X;
      const divRowLeft = cx - totalDivRowWidth / 2;

      divs.forEach((div, di) => {
        const isDivFocused = div.id === focusedDivisionId;
        const divX = divRowLeft + di * (DIV_W + DIV_GAP_X);
        const divCenterX = divX + DIV_W / 2;

        const divFs: NodeFocusState = !focusedDivisionId ? 'neutral'
          : isDivFocused ? 'focused'
          : 'dimmed';

        ns.push({
          id: div.id,
          type: 'divisionNode',
          position: { x: divX, y: divRowY },
          data: {
            name: div.name,
            category: cat,
            focusState: divFs,
            pieceIndex: di,
          } satisfies DivisionNodeData,
          draggable: false,
        });

        // Edge: core → division
        es.push({
          id: `e:core:${cat}->${div.id}`,
          source: `core:${cat}`,
          target: div.id,
          sourceHandle: 'b',
          targetHandle: 't',
          style: {
            stroke: isDivFocused ? accent : LINE,
            strokeWidth: isDivFocused ? 2 : 1.25,
            strokeOpacity: isDivFocused ? 0.95 : (focusedDivisionId ? 0.18 : 0.55),
          },
        });

        // ── Focused division → its value streams render L-to-R below it ───────
        if (isDivFocused && flowData && valueStreams.length > 0) {
          const vsRowTop = divRowY + DIV_H + VS_TOP_OFFSET;

          // VS row: centered under the focused division.
          const totalVsRowWidth = valueStreams.length * VS_W + (valueStreams.length - 1) * VS_GAP_X;
          const vsRowLeft = divCenterX - totalVsRowWidth / 2;

          valueStreams.forEach((vs, vi) => {
            const vsNodeId = `vs:${vs.id}`;
            const isVsFocused = focusedVsId === vs.id;
            const vsFs: NodeFocusState = level < 2 ? 'neutral'
              : isVsFocused ? 'focused'
              : 'dimmed';

            const vsX = vsRowLeft + vi * (VS_W + VS_GAP_X);
            const vsY = vsRowTop;

            ns.push({
              id: vsNodeId,
              type: 'valueStreamNode',
              position: { x: vsX, y: vsY },
              data: {
                name: vs.name,
                category: cat,
                participationType: vs.participationType,
                focusState: vsFs,
                pieceIndex: vi,
              } satisfies ValueStreamNodeData,
              draggable: false,
            });

            // Edge: division → VS
            es.push({
              id: `e:${div.id}->${vsNodeId}`,
              source: div.id,
              target: vsNodeId,
              sourceHandle: 'b',
              targetHandle: 't',
              style: {
                stroke: isVsFocused ? accent : LINE,
                strokeWidth: isVsFocused ? 2 : 1.25,
                strokeOpacity: isVsFocused ? 0.95 : (focusedVsId ? 0.18 : 0.6),
              },
            });

            // ── If this VS is focused, insert step block below it ─────────────
            // The L4 process steps render as an ORDERED HORIZONTAL ROW (step 1
            // leftmost), since a process flow that has an order must be drawn in
            // that order. The row is centered horizontally under the VS; each
            // step increases in X at a constant Y. Connectors run l→r (left
            // handle of one card to the right handle of the previous), so the
            // arrows read left-to-right.
            if (isVsFocused && vsFlowData && steps.length > 0) {
              const stepsTop = vsY + VS_H + STEP_TOP_OFFSET;

              // Single row, centered under the focused VS.
              const vsCenterX = vsX + VS_W / 2;
              const totalStepRowWidth = steps.length * STEP_W + (steps.length - 1) * STEP_GAP_X;
              const stepsLeft = vsCenterX - totalStepRowWidth / 2;

              steps.forEach((step, si) => {
                const stepNodeId = `step:${step.id}`;
                const isStepFocused = focusedStepId === step.id;
                const stepFs: NodeFocusState = level < 3 ? 'neutral'
                  : isStepFocused ? 'focused'
                  : 'dimmed';

                const stepX = stepsLeft + si * (STEP_W + STEP_GAP_X);
                const stepY = stepsTop;

                ns.push({
                  id: stepNodeId,
                  type: 'stepNode',
                  position: { x: stepX, y: stepY },
                  data: {
                    step: step.step,
                    name: step.name,
                    category: cat,
                    primaryCategory: step.primaryCategory,
                    categories: step.categories,
                    subStepCount: step.subSteps.length,
                    unowned: step.unowned,
                    focusState: stepFs,
                    pieceIndex: si,
                  } satisfies StepNodeData,
                  draggable: false,
                });

                // Edge: step[i-1] → step[i] (horizontal: right → left)
                if (si > 0) {
                  es.push({
                    id: `e:step${steps[si - 1].id}->step${step.id}`,
                    source: `step:${steps[si - 1].id}`,
                    target: stepNodeId,
                    sourceHandle: 'r',
                    targetHandle: 'l',
                    type: 'smoothstep',
                    style: { stroke: accent, strokeWidth: 2, strokeOpacity: 0.9 },
                  });
                }

                // ── If this step is focused, drop its L5 sub-process column
                //    DOWN from it (centered under the step card, increasing Y) so
                //    it doesn't collide with the rest of the L4 row, ordered
                //    top-to-bottom. ──
                if (isStepFocused && step.subSteps.length > 0) {
                  const stepCenterX = stepX + STEP_W / 2;
                  const subLeft = stepCenterX - MAP_CARD_W / 2;
                  const subTop = stepY + STEP_H + SUBSTEP_TOP_OFFSET;
                  const subs = step.subSteps;

                  subs.forEach((sub, sj) => {
                    const subNodeId = `substep:${sub.id}`;
                    const isSubFocused = focusedSubStepId === sub.id;
                    const subFs: NodeFocusState = level < 4 ? 'neutral'
                      : isSubFocused ? 'focused'
                      : 'dimmed';
                    const subY = subTop + sj * (MAP_CARD_H + SUBSTEP_GAP_Y);

                    ns.push({
                      id: subNodeId,
                      type: 'subStepNode',
                      position: { x: subLeft, y: subY },
                      data: { step: sub.step, name: sub.name, l5Count: sub.l5.length, focusState: subFs, pieceIndex: sj } satisfies SubStepNodeData,
                      draggable: false,
                    });

                    // Edge: subStep[j-1] → subStep[j] (vertical: bottom → top)
                    if (sj > 0) {
                      es.push({
                        id: `e:substep${subs[sj - 1].id}->substep${sub.id}`,
                        source: `substep:${subs[sj - 1].id}`,
                        target: subNodeId,
                        sourceHandle: 'b',
                        targetHandle: 't',
                        type: 'smoothstep',
                        style: { stroke: accent, strokeWidth: 2, strokeOpacity: 0.9 },
                      });
                    }

                    // ── If this sub-process is focused, drop its L5 step column
                    //    DOWN from it, ordered top-to-bottom. (Vestigial: L5 is a
                    //    leaf so sub.l5 is empty, but kept for completeness.) ──
                    if (isSubFocused && sub.l5.length > 0) {
                      const subCenterX = subLeft + MAP_CARD_W / 2;
                      const leafLeft = subCenterX - MAP_CARD_W / 2;
                      const leafTop = subY + MAP_CARD_H + LEAF_TOP_OFFSET;
                      const l5 = sub.l5;

                      l5.forEach((leaf, lk) => {
                        const leafNodeId = `leaf:${leaf.id}`;
                        ns.push({
                          id: leafNodeId,
                          type: 'leafStepNode',
                          position: { x: leafLeft, y: leafTop + lk * (MAP_CARD_H + LEAF_GAP_Y) },
                          data: { step: leaf.step, name: leaf.name, focusState: 'neutral', pieceIndex: lk } satisfies LeafStepNodeData,
                          draggable: false,
                          selectable: false,
                        });
                        // Edge: leaf[k-1] → leaf[k] (vertical: bottom → top)
                        if (lk > 0) {
                          es.push({
                            id: `e:leaf${l5[lk - 1].id}->leaf${leaf.id}`,
                            source: `leaf:${l5[lk - 1].id}`,
                            target: leafNodeId,
                            sourceHandle: 'b',
                            targetHandle: 't',
                            type: 'smoothstep',
                            style: { stroke: accent, strokeWidth: 2, strokeOpacity: 0.9 },
                          });
                        }
                      });

                      // Edge: sub-process → first L5 step (top → bottom, into the column)
                      es.push({
                        id: `e:${subNodeId}->leaf:${l5[0].id}`,
                        source: subNodeId,
                        target: `leaf:${l5[0].id}`,
                        sourceHandle: 'b',
                        targetHandle: 't',
                        type: 'smoothstep',
                        style: { stroke: accent, strokeWidth: 2, strokeOpacity: 0.8 },
                      });
                    }
                  });

                  // Edge: step → first sub-process (top → bottom, into the column)
                  es.push({
                    id: `e:${stepNodeId}->substep:${subs[0].id}`,
                    source: stepNodeId,
                    target: `substep:${subs[0].id}`,
                    sourceHandle: 'b',
                    targetHandle: 't',
                    type: 'smoothstep',
                    style: { stroke: accent, strokeWidth: 2, strokeOpacity: 0.8 },
                  });
                }
              });

              // Edge: VS → first step (left of the row)
              es.push({
                id: `e:${vsNodeId}->step:${steps[0].id}`,
                source: vsNodeId,
                target: `step:${steps[0].id}`,
                sourceHandle: 'b',
                targetHandle: 't',
                style: { stroke: accent, strokeWidth: 2, strokeOpacity: 0.8 },
              });
            }
          });
        }
      });
    });

    return { nodes: ns, edges: es };
  }, [
    displayDivisions, companyName, companyOpen, selectedDomain, level,
    focusedDivisionId, focusedDivision, focusedVsId, focusedStepId, focusedStep, focusedSubStepId,
    flowData, valueStreams, vsFlowData, steps, applyOrder, domainIdByCat,
  ]);

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
      const rowNodes = result.filter((n) => n.type === gap.type)
        .sort((a, b) => (horiz ? a.position.x - b.position.x : a.position.y - b.position.y));
      const shiftIds = new Set(rowNodes.slice(gap.index).map((n) => n.id));
      if (shiftIds.size) {
        const dx = horiz ? MAP_CARD_W + 12 : 0;
        const dy = horiz ? 0 : MAP_CARD_H + 12;
        result = result.map((n) => (shiftIds.has(n.id) ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n));
      }
    }
    return result.map((n) => {
      const draggable = DRAGGABLE_TYPES.has(n.type ?? '');
      const raw = rawNodeId(n);
      const renamed = raw != null ? pendingRenames.get(raw) : undefined;
      const staged = (raw != null && pendingMoves.has(raw)) || renamed !== undefined;
      const nestTarget = n.id === nestTargetId; // "nest inside here" highlight
      if (!draggable && !staged && !nestTarget) return n;
      const data: Record<string, unknown> = { ...n.data, editable: draggable, staged, dropTarget: nestTarget };
      if (renamed !== undefined) { if (n.type === 'coreNode') data.label = renamed; else data.name = renamed; }
      return { ...n, data };
    });
  }, [nodes, editMode, drag, gap, nestTargetId, DRAGGABLE_TYPES, rawNodeId, pendingMoves, pendingRenames]);

  // While dragging, drop the lifted card's connectors so its line visibly detaches
  // from its parent (the card itself is hidden in displayNodes; its slot stays so
  // siblings don't shift and the drop target stays put).
  const displayEdges = useMemo<Edge[]>(() => {
    const liftId = drag?.started ? drag.canvasId : null;
    return liftId ? edges.filter((e) => e.source !== liftId && e.target !== liftId) : edges;
  }, [edges, drag]);

  // ── Custom pointer-drag (edit mode) ──────────────────────────────────────────
  // We DON'T use React Flow's node dragging — it moves nodes in pane coords through
  // a controlled-store round-trip that races the map's frequent re-layouts (focus
  // changes, hover-drill) and loses the drag. Instead, dragging is a plain screen-
  // space pointer gesture: a ghost card follows the cursor 1:1, hit-testing uses
  // getBoundingClientRect, the dragged card is lifted out of the layout (its edges
  // disconnect), and the row under the cursor opens a gap. Nothing is committed
  // until pointer-up. React Flow just renders the static `displayNodes`.
  const flowNodes = displayNodes;

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
      const nodes = nodeIds.map((id) => rf.getNode(id)).filter((n): n is NonNullable<typeof n> => !!n);
      if (nodes.length < nodeIds.length && tries++ < 12) { requestAnimationFrame(attempt); return; }
      if (!nodes.length) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of nodes) {
        const w = n.measured?.width ?? n.width ?? MAP_CARD_W;
        const h = n.measured?.height ?? n.height ?? MAP_CARD_H;
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + w);
        maxY = Math.max(maxY, n.position.y + h);
      }
      rf.fitBounds({ x: minX, y: minY, width: maxX - minX, height: maxY - minY }, { padding, duration: 460 });
    };
    requestAnimationFrame(attempt);
  }, [rf]);

  // Fit the whole visible graph, then pin its top edge near the top of the
  // container — fitView alone centers vertically, which left a large empty band
  // above the map (defect backlog 02, D3.1). The company root sits at world
  // y=0, so viewport.y is exactly the on-screen offset of the content top.
  // NB: in xyflow v12 fitView() is queued until nodes are measured and returns
  // a promise — the viewport must be read AFTER it resolves. Reading it
  // synchronously (the old code) grabbed the stale pre-fit viewport, and the
  // queued fit then re-centered the graph over our y=16 pin.
  const fitTopView = useCallback(() => {
    void rf.fitView({ duration: 0, padding: 0.08, maxZoom: 0.95 }).then((applied) => {
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
  }, [companyOpen]); // eslint-disable-line

  // Camera: domain selected → center on it (divisions appear below); deselected → fit
  useEffect(() => {
    if (selectedDomain && !focusedDivisionId) moveCameraToNode(`core:${selectedDomain}`, 1.4);
    else if (!selectedDomain && companyOpen) fitTopView();
  }, [selectedDomain]); // eslint-disable-line

  // Camera: division focused → center on it; collapsed back → re-center on its domain
  useEffect(() => {
    if (focusedDivisionId) moveCameraToNode(focusedDivisionId, 0.8);
    else if (selectedDomain) moveCameraToNode(`core:${selectedDomain}`, 1.4);
  }, [focusedDivisionId]); // eslint-disable-line

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
  }, [flowData]); // eslint-disable-line

  // Camera: L2 → focus VS
  useEffect(() => {
    if (level >= 2 && focusedVsId) moveCameraToNode(`vs:${focusedVsId}`, 0.8);
  }, [focusedVsId]); // eslint-disable-line

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
  }, [vsFlowData]); // eslint-disable-line

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
  }, [focusedStepId]); // eslint-disable-line

  // Camera: L4 → focus sub-process. Frame it plus its full L5 process-step row.
  useEffect(() => {
    if (level < 4 || !focusedSubStepId) return;
    const sub = focusedStep?.subSteps.find((s) => s.id === focusedSubStepId);
    if (sub && sub.l5.length > 0) {
      fitNodes([`substep:${focusedSubStepId}`, ...sub.l5.map((s) => `leaf:${s.id}`)], 0.3);
    } else {
      moveCameraToNode(`substep:${focusedSubStepId}`, 0.3);
    }
  }, [focusedSubStepId]); // eslint-disable-line

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
  }, [valueStreams, steps, focusedStep, focusedDivisionId, focusedVsId, focusedStepId, domainCatById, displayDivisions]);

  const nodeName = (n: Node): string => ((n.data as { name?: string; label?: string }).name ?? (n.data as { label?: string }).label ?? '');
  const arraysEqual = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  // Canvas id → node (for parent/level lookups during a drag).
  const nodeById = useMemo(() => { const m = new Map<string, Node>(); for (const n of nodes) m.set(n.id, n); return m; }, [nodes]);
  // Rendered left-to-right (or top-to-bottom) raw-id order of a parent's row.
  const rowOrder = useCallback((parent: string, type: string): string[] =>
    nodes.filter((n) => n.type === type && currentParentRaw(n) === parent)
      .sort((a, b) => ((a.data as { pieceIndex?: number }).pieceIndex ?? 0) - ((b.data as { pieceIndex?: number }).pieceIndex ?? 0))
      .map((n) => rawNodeId(n)).filter((x): x is string => !!x),
  [nodes, currentParentRaw, rawNodeId]);

  // The card under a screen point. The drag ghost is pointer-events:none so it's
  // transparent to elementFromPoint.
  const cardAtPoint = (x: number, y: number): { canvasId: string; type: string } | null => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('.react-flow__node') as HTMLElement | null;
    if (!el) return null;
    const canvasId = el.getAttribute('data-id'); if (!canvasId) return null;
    const type = [...el.classList].find((c) => c.startsWith('react-flow__node-'))?.slice('react-flow__node-'.length) ?? '';
    return { canvasId, type };
  };

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
  const gapRef = useRef<{ parent: string; index: number; type: string } | null>(null);
  const ROW_TYPES = useMemo(() => ['coreNode', 'divisionNode', 'valueStreamNode', 'stepNode', 'subStepNode'], []);
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
  }, [nodes, ROW_TYPES, nodeScreenRect, nodeById, currentParentRaw, rawNodeId]);

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
        setPendingOrder((m) => { if (!m.size) return m; const next = new Map(m); for (const [p, ids] of next) { const f = ids.filter((id) => id !== d.rawId); if (f.length !== ids.length) next.set(p, f); } return next; });
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
        setPendingOrder((m) => { const next = new Map(m); if (arraysEqual(ids, d.originOrder)) next.delete(g.parent); else next.set(g.parent, ids); return next; });
      } else {
        const sameLevel = (TYPE_LEVEL[g.type] ?? 0) === d.level; // dropping into a deeper/shallower row re-levels
        setPendingMoves((m) => { const next = new Map(m); next.set(d.rawId, { parent: g.parent, sameLevel, level: d.level, name: d.name, cat: d.cat }); return next; });
        setPendingOrder((m) => { const next = new Map(m); next.set(g.parent, ids); return next; });
        flash('ok', sameLevel ? 'Staged move — placed among siblings.' : 'Staged — placed inside (re-leveled).');
      }
      return;
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
  }, [editMode, DRAGGABLE_TYPES, nodeById, rawNodeId, currentParentRaw, rowOrder, selectedDomain, rf]);

  // ── Save / Revert staged edits ────────────────────────────────────────────────
  const onSave = useCallback(async () => {
    if (!companyId || !dirty || saving) return;
    const ops: ({ op: 'move'; id: string; newParentId: string } | { op: 'reorder'; parentId: string; orderedIds: string[] } | { op: 'rename'; id: string; name: string })[] = [];
    for (const [id, rec] of pendingMoves) ops.push({ op: 'move', id, newParentId: rec.parent });
    for (const [parentId, orderedIds] of pendingOrder) ops.push({ op: 'reorder', parentId, orderedIds });
    for (const [id, name] of pendingRenames) ops.push({ op: 'rename', id, name });
    setSaving(true);
    try {
      await api.post(`/builder/nodes/batch?companyId=${encodeURIComponent(companyId)}`, { ops });
      setPendingMoves(new Map()); setPendingOrder(new Map()); setPendingRenames(new Map());
      flash('ok', 'Saved.');
      if (focusedDivisionId) fetchFlow(focusedDivisionId);
      if (focusedDivisionId && focusedVsId) fetchVsFlow(focusedDivisionId, focusedVsId);
      onMoved?.();
    } catch (e) {
      const msg = (e as Error)?.message;
      flash('err', msg && !/HTTP/.test(msg) ? msg : 'Save failed — your changes are kept.');
    } finally { setSaving(false); }
  }, [companyId, dirty, saving, pendingMoves, pendingOrder, pendingRenames, focusedDivisionId, focusedVsId, fetchFlow, fetchVsFlow, onMoved, flash]);

  const onRevert = useCallback(() => {
    setPendingMoves(new Map()); setPendingOrder(new Map()); setPendingRenames(new Map());
    setRename(null);
    flash('ok', 'Reverted.');
  }, [flash]);

  // Commit the inline rename editor → stage the new name.
  const commitRename = useCallback(() => {
    if (!rename) return;
    const v = rename.value.trim();
    if (v) setPendingRenames((m) => { const n = new Map(m); n.set(rename.rawId, v); return n; });
    setRename(null);
  }, [rename]);

  const onToggleEdit = useCallback(() => {
    if (editMode && dirty) { flash('err', 'Save or revert your changes first.'); return; }
    setEditMode((v) => !v);
    dragRef.current = null; gapRef.current = null; nestRef.current = null;
    setDrag(null); setGap(null); setNestTargetId(null); setRename(null);
    clearHoverDrill();
  }, [editMode, dirty, flash, clearHoverDrill]);

  // ── Node click handler ────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
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
  }, [onCompanyClick, onDomainClick, onDivisionClick, onVsClick, onStepClick, onSubStepClick]);

  // ── Dashboard drill-down ────────────────────────────────────────────────────
  // Map levels move the canvas; departments drill inside the sidebar (stack).
  const onDrill = useCallback((lvl: string, id: string) => {
    // Roles are the leaf of the sidebar drill — clicking one leaves the map and
    // opens the dedicated role page rather than an in-sidebar role dashboard.
    if (lvl === 'role') { navigate(`/roles/${id}`); return; }
    if (lvl === 'department') { setOvStack((s) => [...s, { level: lvl, id }]); return; }
    setOvStack([]);
    if (lvl === 'domain') onDomainClick(id as Category);
    else if (lvl === 'division') onDivisionClick(id);
    else if (lvl === 'valueStream') onVsClick(id);
    else if (lvl === 'step') onStepClick(id);
  }, [navigate, onDomainClick, onDivisionClick, onVsClick, onStepClick]);
  const onDashBack = useCallback(() => setOvStack((s) => s.slice(0, -1)), []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex' }}>

      {/* Breadcrumb — rendered into the page header via portal (lives in the header, not over the canvas). */}
      {breadcrumbSlot && createPortal(
        selectedDomain ? (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', whiteSpace: 'nowrap' }}>
            <button onClick={crumbToDomains} className="focus-crumb-ancestor" style={CRUMB}>{sentenceCase(companyName)}</button>
            <span style={CRUMB_SEP}>›</span>
            {!focusedDivision
              ? <span className="focus-crumb-active" style={CRUMB}>{selectedDomain}</span>
              : <button onClick={crumbToL0} className="focus-crumb-ancestor" style={CRUMB}>{selectedDomain}</button>}
            {focusedDivision && (
              <>
                <span style={CRUMB_SEP}>›</span>
                {level === 1
                  ? <span className="focus-crumb-active" style={CRUMB}>{sentenceCase(focusedDivision.name)}</span>
                  : <button onClick={crumbToL1} className="focus-crumb-ancestor" style={CRUMB}>{sentenceCase(focusedDivision.name)}</button>}
              </>
            )}
            {level >= 2 && focusedVs && (
              <>
                <span style={CRUMB_SEP}>›</span>
                {level === 2
                  ? <span className="focus-crumb-active" style={CRUMB}>{sentenceCase(focusedVs.name)}</span>
                  : <button onClick={crumbToL2} className="focus-crumb-ancestor" style={CRUMB}>{sentenceCase(focusedVs.name)}</button>}
              </>
            )}
            {level >= 3 && focusedStep && (
              <>
                <span style={CRUMB_SEP}>›</span>
                {level === 3
                  ? <span className="focus-crumb-active" style={CRUMB}>{sentenceCase(focusedStep.name)}</span>
                  : <button onClick={crumbToL3} className="focus-crumb-ancestor" style={CRUMB}>{sentenceCase(focusedStep.name)}</button>}
              </>
            )}
            {level === 4 && focusedSubStep && (
              <>
                <span style={CRUMB_SEP}>›</span>
                <span className="focus-crumb-active" style={CRUMB}>{sentenceCase(focusedSubStep.name)}</span>
              </>
            )}
            <button
              onClick={crumbToDomains}
              aria-label="Clear focus"
              style={{
                marginLeft: 6, width: 18, height: 18, borderRadius: 5,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#a3a3a3',
                background: 'transparent', border: '1px solid #eaeaea', cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-[#666666]">
            Click a domain to drill into the end-to-end process.
          </span>
        ),
        breadcrumbSlot
      )}

      {/* Fetch loading indicator */}
      {(flowLoading || vsFlowLoading) && (
        <div
          className="animate-pulse"
          style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 20, padding: '6px 14px',
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
            border: '1px solid #eaeaea', borderRadius: 8, fontSize: 12, color: '#a3a3a3',
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
        {drag?.started && (
          <div
            style={{
              position: 'fixed', left: drag.px - drag.grabDX, top: drag.py - drag.grabDY,
              width: drag.cardW, height: drag.cardH, zIndex: 50, pointerEvents: 'none',
              borderRadius: 10, background: '#ffffff',
              border: '1px solid #eaeaea', borderLeft: `3px solid ${DOMAIN_HEX[drag.cat] ?? '#64748b'}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)', opacity: 0.95,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '8px 10px', textAlign: 'center', fontSize: 11.5, fontWeight: 600, color: '#171717',
            }}
          >
            {sentenceCase(drag.name)}
          </div>
        )}

        {/* Inline rename editor — double-click a box in edit mode to open it. */}
        {rename && (
          <input
            autoFocus
            value={rename.value}
            onChange={(e) => setRename((r) => (r ? { ...r, value: e.target.value } : r))}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commitRename();
              else if (e.key === 'Escape') setRename(null);
            }}
            onBlur={commitRename}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              position: 'fixed', left: rename.x, top: rename.y, width: rename.w, height: rename.h,
              zIndex: 60, boxSizing: 'border-box', padding: '6px 8px', borderRadius: 10,
              border: `2px solid ${DOMAIN_HEX[rename.cat] ?? '#0d9488'}`, background: '#ffffff',
              fontSize: 11.5, fontWeight: 600, color: '#171717', textAlign: 'center', outline: 'none',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            }}
          />
        )}

        {/* Edit toolbar — top-right of the canvas (the view toggle owns top-left).
            Edit mode makes every process level (L1 domain → L5 sub-process)
            draggable; drag onto another box to re-home it (children + associations
            follow, re-leveling as needed), hold over a box to drill deeper, or drop
            within a row to reorder. Nothing hits the DB until Save. */}
        <div className="absolute top-3 right-4 z-20 flex items-center gap-2">
          {editMode && (
            <span className="hidden md:inline-flex items-center rounded-full bg-white/90 backdrop-blur border border-[#eaeaea] px-2.5 py-1 text-[11px] text-[#525252] shadow-sm">
              {dirty
                ? `${pendingCount} unsaved change${pendingCount === 1 ? '' : 's'} — Save or Revert`
                : 'Drag to move • hold to drill • drop in a row to reorder • double-click to rename'}
            </span>
          )}
          {editMode && dirty && (
            <>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-colors duration-150 bg-[#0d9488] text-white hover:bg-[#0f766e] disabled:opacity-60"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={onRevert}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-colors duration-150 border border-[#eaeaea] bg-white/90 backdrop-blur text-[#525252] hover:text-[#171717] disabled:opacity-60"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 7" />
                </svg>
                Revert
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onToggleEdit}
            aria-pressed={editMode}
            className={
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-colors duration-150 ' +
              (editMode
                ? (dirty ? 'border border-[#eaeaea] bg-white/90 backdrop-blur text-[#a3a3a3]' : 'bg-[#0d9488] text-white hover:bg-[#0f766e]')
                : 'border border-[#eaeaea] bg-white/90 backdrop-blur text-[#525252] hover:text-[#171717]')
            }
          >
            {editMode ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Done
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                Edit
              </>
            )}
          </button>
        </div>

        {/* Move feedback — small ephemeral banner, bottom-center (never a window.alert). */}
        {moveFlash && (
          <div
            className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 rounded-lg px-3.5 py-2 text-xs font-medium shadow-md backdrop-blur"
            style={
              moveFlash.kind === 'ok'
                ? { background: 'rgba(13,148,136,0.95)', color: '#fff' }
                : { background: 'rgba(190,18,60,0.95)', color: '#fff' }
            }
            role="status"
          >
            {moveFlash.text}
          </div>
        )}

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
        {vsDetailId && <ValueStreamDrawer valueStreamId={vsDetailId} onClose={() => setVsDetailId(null)} />}

        {/* Testing templates for the focused process node — slides over the canvas. */}
        {testingNodeId && <TestingTemplateModal nodeId={testingNodeId} onClose={() => setTestingNodeId(null)} />}
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

export default function MapCanvas({ divisions, companyName, breadcrumbSlot, focusVsId, onMoved }: Props) {
  return (
    <ReactFlowProvider>
      <MapCanvasInner divisions={divisions} companyName={companyName} breadcrumbSlot={breadcrumbSlot} focusVsId={focusVsId} onMoved={onMoved} />
    </ReactFlowProvider>
  );
}
