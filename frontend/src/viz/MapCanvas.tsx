// MapCanvas.tsx — Interactive operating-model map with spatial drill-down.
// L0 Enterprise → L1 Domain (3 CEO domains, horizontal row) → L2 Division
// (horizontal row under the selected domain) → L3 Value Stream → L4 Process Area
// → L5 Sub-Process → L6 Process Step (the workbook's L5 steps) — each level
// rendering left-to-right as you drill in.
// A right-hand MetricsSidebar shows a spreadsheet-derived dashboard for whatever
// level is currently focused (company / domain / division / value stream / area)
// — the SAME panel the list view shows (SHOW_METRICS_SIDEBAR below).

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, ReactFlowProvider,
  useReactFlow, applyNodeChanges,
  type Node, type Edge, type NodeMouseHandler, type OnNodeDrag, type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { mapNodeTypes, MAP_CARD_W, MAP_CARD_H, sentenceCase } from './nodes/MapNode';
import type {
  CompanyNodeData, CoreNodeData, DivisionNodeData, ValueStreamNodeData, StepNodeData, SubStepNodeData, LeafStepNodeData,
} from './nodes/MapNode';
import { DOMAIN_HEX } from './model';
import type { NodeFocusState, DivisionSummary, DivisionFlow, FlowStep, FlowValueStream } from './model';
import MetricsSidebar, { MetricsDrawer, type Dashboard, type MetricSection } from '../components/MetricsSidebar';
import ValueStreamDrawer from '../components/ValueStreamDrawer';
import TestingTemplateModal from '../components/TestingTemplateModal';
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
  // The currently-hovered valid drop target while dragging (Apple-folder ring).
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  // Transient feedback banner (success / invalid-move), auto-dismisses.
  const [moveFlash, setMoveFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const flashTimer = useRef<number | null>(null);
  const flash = useCallback((kind: 'ok' | 'err', text: string) => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    setMoveFlash({ kind, text });
    flashTimer.current = window.setTimeout(() => setMoveFlash(null), 2600);
  }, []);

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
  const DRAGGABLE_TYPES = useMemo(() => new Set(['valueStreamNode', 'stepNode', 'subStepNode']), []);
  const VALID_PARENT_TYPE: Record<string, string> = useMemo(() => ({
    valueStreamNode: 'divisionNode', // L3 → moves under an L2 value stream (a different one)
    stepNode: 'valueStreamNode',     // L4 → moves under an L3 process area
    subStepNode: 'stepNode',         // L5 → moves under an L4 sub-process
  }), []);
  const PARENT_LABEL: Record<string, string> = useMemo(() => ({
    valueStreamNode: 'value stream',
    stepNode: 'process area',
    subStepNode: 'sub-process',
  }), []);
  // Strip the map's id prefix to recover the raw ProcessNode id (vs:/step:/substep:).
  const rawNodeId = useCallback((node: Node): string => {
    return node.id.replace(/^(vs|step|substep|leaf):/, '');
  }, []);

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

  // Derived
  const focusedDivision = divisions.find((d) => d.id === focusedDivisionId) ?? null;
  // L3 renders only the value streams this division LEADS (render-only filter; the
  // other participations remain in the DB, just not drawn on the map). Exception:
  // a deep-linked focus VS that this division participates in but doesn't lead is
  // appended so the user still lands on it (links resolve to the strongest, not
  // necessarily leading, division — see /explorer/value-stream/:id/focus).
  const leadStreams: FlowValueStream[] = (flowData?.valueStreams ?? []).filter((vs) => vs.participationType === 'Lead');
  const focusedExtra = focusedVsId && !leadStreams.some((vs) => vs.id === focusedVsId)
    ? (flowData?.valueStreams ?? []).find((vs) => vs.id === focusedVsId) ?? null
    : null;
  const valueStreams: FlowValueStream[] = focusedExtra ? [...leadStreams, focusedExtra] : leadStreams;
  const focusedVs = valueStreams.find((vs) => vs.id === focusedVsId) ?? null;
  const steps: FlowStep[] = vsFlowData?.selected?.steps ?? [];
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
    const categories = categoriesOf(divisions);
    const cols: Record<Category, DivisionSummary[]> = {};
    for (const d of divisions) (cols[catFor(d)] ??= []).push(d);

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

      const divs = cols[cat];
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
    divisions, companyName, companyOpen, selectedDomain, level,
    focusedDivisionId, focusedDivision, focusedVsId, focusedStepId, focusedStep, focusedSubStepId,
    flowData, valueStreams, vsFlowData, steps,
  ]);

  // Overlay edit-mode affordances onto the laid-out nodes WITHOUT touching the
  // layout memo (which `onNodeDragStop` reads for snap-back). In edit mode the
  // three process levels become draggable and get the grab/dashed style; the
  // hovered valid parent gets the drop-target ring. In normal view this is a
  // shallow pass-through (no draggable, no affordance) so the map is unchanged.
  const displayNodes = useMemo<Node[]>(() => {
    if (!editMode) return nodes;
    return nodes.map((n) => {
      const draggable = DRAGGABLE_TYPES.has(n.type ?? '');
      const isTarget = dropTargetId === n.id;
      if (!draggable && !isTarget) return n;
      return {
        ...n,
        draggable,
        data: { ...n.data, editable: draggable, dropTarget: isTarget },
      };
    });
  }, [nodes, editMode, dropTargetId, DRAGGABLE_TYPES]);

  // ── React Flow controlled nodes — EDIT MODE ONLY (so drag moves the cards) ───
  // React Flow v12 only commits drag position deltas to nodes that flow through
  // its store via onNodesChange. So edit-mode drag needs a controlled `rfNodes`
  // state + onNodesChange to paint the in-progress drag.
  //
  // BUT in VIEW mode that controlled path is pure jank: the sync effect re-seeds
  // `rfNodes` on every `displayNodes` change (every focus/level transition), and
  // those extra state updates re-measure/re-render the whole graph mid-camera-
  // animation, producing the reset/flicker. View mode never drags, so it doesn't
  // need the controlled store at all — we pass the stable, memoized `displayNodes`
  // straight to <ReactFlow> and skip the sync churn entirely. The machinery below
  // only engages when editMode is true.
  const [rfNodes, setRfNodes] = useState<Node[]>(displayNodes);
  // While a node is mid-drag, its live (dragged) position must survive any
  // re-seed from `displayNodes` — and a re-seed DOES happen mid-drag, because
  // `onNodeDrag` updates `dropTargetId`, which recomputes `displayNodes`. So we
  // remember which node is being dragged and keep its current position when
  // re-seeding; everything else snaps to the freshly-computed layout.
  const draggingIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editMode) return; // view mode renders displayNodes directly — no re-seed
    setRfNodes((prev) => {
      const dragId = draggingIdRef.current;
      if (!dragId) return displayNodes;
      const live = prev.find((n) => n.id === dragId);
      if (!live) return displayNodes;
      return displayNodes.map((n) => (n.id === dragId ? { ...n, position: live.position } : n));
    });
  }, [displayNodes, editMode]);
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setRfNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );
  // The node set handed to <ReactFlow>: controlled state in edit mode (drag),
  // the stable memoized layout in view mode (smooth, no re-seed churn).
  const flowNodes = editMode ? rfNodes : displayNodes;

  // ── Camera helpers ────────────────────────────────────────────────────────
  // Fit a specific set of nodes in frame (used to frame the whole process row).
  const fitNodes = useCallback((nodeIds: string[], padding = 0.18) => {
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

  // ── Edit-mode drag → reparent ────────────────────────────────────────────────
  // Hit-test the dragged node's center against every other node's measured box;
  // return the id of the first valid-parent node it overlaps (or null).
  const findDropTarget = useCallback((dragged: Node): string | null => {
    const parentType = VALID_PARENT_TYPE[dragged.type ?? ''];
    if (!parentType) return null;
    // The dragged node's CURRENT parent (the focused node one level above) — skip
    // it so dropping back where it started isn't treated as a (no-op) move.
    const currentParentId =
      dragged.type === 'valueStreamNode' ? focusedDivisionId
      : dragged.type === 'stepNode' ? (focusedVsId ? `vs:${focusedVsId}` : null)
      : dragged.type === 'subStepNode' ? (focusedStepId ? `step:${focusedStepId}` : null)
      : null;
    const w = dragged.measured?.width ?? MAP_CARD_W;
    const h = dragged.measured?.height ?? MAP_CARD_H;
    const cx = dragged.position.x + w / 2;
    const cy = dragged.position.y + h / 2;
    for (const n of rf.getNodes()) {
      if (n.id === dragged.id || n.id === currentParentId) continue;
      if (n.type !== parentType) continue;
      const nw = n.measured?.width ?? MAP_CARD_W;
      const nh = n.measured?.height ?? MAP_CARD_H;
      if (cx >= n.position.x && cx <= n.position.x + nw && cy >= n.position.y && cy <= n.position.y + nh) {
        return n.id;
      }
    }
    return null;
  }, [rf, VALID_PARENT_TYPE, focusedDivisionId, focusedVsId, focusedStepId]);

  const onNodeDrag: OnNodeDrag = useCallback((_e, node) => {
    if (!editMode || !DRAGGABLE_TYPES.has(node.type ?? '')) return;
    draggingIdRef.current = node.id; // protect its live position from layout re-seeds
    const target = findDropTarget(node);
    setDropTargetId((prev) => (prev === target ? prev : target));
  }, [editMode, DRAGGABLE_TYPES, findDropTarget]);

  const onNodeDragStop: OnNodeDrag = useCallback(async (_e, node) => {
    draggingIdRef.current = null; // drag finished — layout re-seeds may resume
    if (!editMode || !DRAGGABLE_TYPES.has(node.type ?? '')) return;
    const target = findDropTarget(node);
    setDropTargetId(null);
    // Snap the dragged node back to its computed slot regardless of outcome —
    // the layout is fully derived, so we never persist free positions. On a
    // successful move the parent refetch re-lays everything out. We reset our
    // own controlled state (rfNodes) so the snap-back actually paints.
    const resetPositions = () => setRfNodes((ns) => ns.map((n) => {
      if (n.id !== node.id) return n;
      const original = displayNodes.find((o) => o.id === n.id);
      return original ? { ...n, position: original.position } : n;
    }));

    if (!target) {
      resetPositions();
      return;
    }
    if (!companyId) { resetPositions(); flash('err', 'No active company.'); return; }

    const nodeId = rawNodeId(node);
    const newParentId = rawNodeId({ id: target } as Node);
    try {
      await api.patch(`/builder/nodes/${nodeId}?companyId=${encodeURIComponent(companyId)}`, { parentId: newParentId });
      flash('ok', 'Moved — children followed.');
      // Refetch the current flow(s) so the moved subtree re-lays out under its
      // new parent (the layout is fully derived from this data). Both the L3
      // value-stream row and the focused L4/L5 flow come from these two calls.
      if (focusedDivisionId) fetchFlow(focusedDivisionId);
      if (focusedDivisionId && focusedVsId) fetchVsFlow(focusedDivisionId, focusedVsId);
      onMoved?.();
    } catch (e) {
      const label = PARENT_LABEL[node.type ?? ''] ?? 'parent';
      const msg = (e as Error)?.message;
      resetPositions();
      flash('err', msg && !/HTTP/.test(msg) ? msg : `Can only move under a ${label}.`);
    }
  }, [editMode, DRAGGABLE_TYPES, findDropTarget, companyId, rawNodeId, displayNodes, flash, onMoved, PARENT_LABEL, focusedDivisionId, focusedVsId, fetchFlow, fetchVsFlow]);

  // ── Node click handler ────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    // In edit mode, suppress click-to-drill on draggable nodes so a drag never
    // also fires a navigation. Non-draggable nodes (company/domain/division)
    // stay interactive so the user can still open the path they want to edit.
    if (editMode && DRAGGABLE_TYPES.has(node.type ?? '')) return;
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
  }, [editMode, DRAGGABLE_TYPES, onCompanyClick, onDomainClick, onDivisionClick, onVsClick, onStepClick, onSubStepClick]);

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
      <div className="rf-stage rf-stage--map" style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={flowNodes}
          edges={edges}
          nodeTypes={mapNodeTypes}
          onNodesChange={editMode ? onNodesChange : undefined}
          onNodeClick={onNodeClick}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          nodesDraggable={editMode}
          nodesConnectable={false}
          minZoom={0.05}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e5e5e5" gap={20} size={1} />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>

        {/* Edit button — top-right of the canvas (the view toggle owns top-left).
            Toggles Apple-home-screen drag mode: process cards become draggable and
            can be dropped onto a node one level above to re-home the whole subtree. */}
        <div className="absolute top-3 right-4 z-20 flex items-center gap-2">
          {editMode && (
            <span className="hidden sm:inline-flex items-center rounded-full bg-white/90 backdrop-blur border border-[#eaeaea] px-2.5 py-1 text-[11px] text-[#525252] shadow-sm">
              Drag a process onto another to move it — children follow.
            </span>
          )}
          <button
            type="button"
            onClick={() => { setEditMode((v) => !v); setDropTargetId(null); }}
            aria-pressed={editMode}
            className={
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-colors duration-150 ' +
              (editMode
                ? 'bg-[#0d9488] text-white hover:bg-[#0f766e]'
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

      {/* Right metrics dashboard — same panel and behavior as the list view
          (startExpanded; the minimize control collapses it to the rail). */}
      {SHOW_METRICS_SIDEBAR && dashTarget && (
        <MetricsSidebar
          dash={dash}
          loading={dashLoading}
          onDrill={onDrill}
          startExpanded
          onBack={ovStack.length ? onDashBack : undefined}
          onViewAll={setDrawerSection}
          onViewDetail={dashTarget?.level === 'valueStream' && dashTarget.id ? () => setVsDetailId(dashTarget.id) : undefined}
          onTestingTemplate={(dashTarget?.level === 'valueStream' || dashTarget?.level === 'step') && dashTarget.id ? () => setTestingNodeId(dashTarget.id) : undefined}
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
