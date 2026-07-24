// OrgMapCanvas.tsx — Interactive organization map with spatial drill-down.
// Company → Segment → Division → Team (department) → Role, each level rendering
// as a centered row under its selected parent — the same literal drill-down map
// as the Value Streams view (MapCanvas.tsx): same 150×68 cards, focus states,
// 11px breadcrumb, top-pinned camera, AND the identical edit system (drag to
// move/nest/reorder, double-click to rename, custom pan, staged Save/Revert).
//
// Data comes from /explorer/org-table; segment/division/department carry their
// OrgUnit ids so they can be edited. Roles are leaves (a separate table) — they
// navigate to /organization?role=<id> and aren't draggable.
//
// Split for maintainability (pure code motion — behavior unchanged):
//   viz/org-map/orgNodes.tsx      — payload types, card components, layout math
//   viz/org-map/useOrgDragDrop.ts — edit-mode pointer drag/drop gesture
//   viz/org-map/useOrgCamera.ts   — fit/center helpers + drill camera effects
//   viz/map/MapChrome.tsx         — shared ghost / rename / toolbar / banner

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

import { MAP_CARD_W, MAP_CARD_H, sentenceCase } from '../nodes/MapNode';
import { DOMAIN_HEX, type NodeFocusState } from '../model';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { useDialogs } from '../../lib/dialogs';
import { useOpenRole } from '../../lib/roleDrawer';
import { useViewState } from '../../lib/viewState';
import MetricsSidebar, {
  MetricsDrawer,
  type Dashboard,
  type MetricSection,
} from '../../components/MetricsSidebar';
import { ErrorMessage, LoadingState } from '../../components/ui';
import {
  orgNodeTypes,
  gridPositions,
  gridHeight,
  LOOSE,
  ROW_GAP_Y,
  CRUMB,
  CRUMB_SEP,
  type Division,
  type OrgData,
  type OrgDragState,
  type MoveRec,
  type RoleLite,
  type Segment,
  type OrgCompanyData,
  type OrgSegmentData,
  type OrgDivisionData,
  type OrgDeptData,
  type OrgRoleData,
} from './orgNodes';
import { useOrgDragDrop } from './useOrgDragDrop';
import { useOrgCamera } from './useOrgCamera';
import { PLUS_GAP_SPREAD, type RenameState } from '../map/constants';
import { DragGhost, RenameEditor, MapEditToolbar, MoveFlashBanner } from '../map/MapChrome';

// ── Inner canvas ─────────────────────────────────────────────────────────────

// Human labels for the org levels (add/remove dialogs). Teams' children are
// Roles (a separate table), so adds bottom out at level 3.
const ORG_LEVEL_LABEL: Record<number, string> = { 1: 'segment', 2: 'division', 3: 'team' };
const ORG_MAX_LEVEL = 3;

type Props = { breadcrumbSlot?: HTMLElement | null };

function OrgMapCanvasInner({
  data,
  breadcrumbSlot,
  onSaved,
}: Props & { data: OrgData; onSaved: () => void }) {
  const rf = useReactFlow();
  const paneW = useStore((s) => s.width);
  const paneH = useStore((s) => s.height);
  const openRole = useOpenRole();
  const { companyId } = useCompany();

  // Drill state. The company starts open (segments visible), like the VS map.
  // Persisted per session (lib/viewState) so leaving the tab and returning
  // restores the exact drill; the metrics panel below re-fetches off it.
  const [companyOpen, setCompanyOpen] = useViewState<boolean>('org.map.companyOpen', true);
  const [selSegName, setSelSegName] = useViewState<string | null>('org.map.segment', null);
  const [selDivId, setSelDivId] = useViewState<string | null>('org.map.division', null);
  // LOOSE = direct-to-division roles
  const [selDeptId, setSelDeptId] = useViewState<string | null>('org.map.department', null);

  // ── Edit state (identical model to MapCanvas) ────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const dragRef = useRef<OrgDragState | null>(null);
  const [drag, setDrag] = useState<OrgDragState | null>(null);
  const [gap, setGap] = useState<{
    parent: string;
    index: number;
    type: string;
    hover?: boolean;
  } | null>(null);
  const [nestTargetId, setNestTargetId] = useState<string | null>(null);
  const [moveFlash, setMoveFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const flashTimer = useRef<number | null>(null);
  const flash = useCallback((kind: 'ok' | 'err', text: string) => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    setMoveFlash({ kind, text });
    flashTimer.current = window.setTimeout(() => setMoveFlash(null), 2600);
  }, []);
  const [pendingMoves, setPendingMoves] = useState<Map<string, MoveRec>>(new Map());
  const [pendingOrder, setPendingOrder] = useState<Map<string, string[]>>(new Map());
  const [pendingRenames, setPendingRenames] = useState<Map<string, string>>(new Map());
  // Staged ROLE edits — separate from the org-unit spine: a re-home saves via
  // PATCH /roles/:id { orgUnitId }, an order via PUT /roles/reorder.
  const [pendingRoleMoves, setPendingRoleMoves] = useState<
    Map<string, { unitId: string; name: string }>
  >(new Map());
  const [pendingRoleOrder, setPendingRoleOrder] = useState<Map<string, string[]>>(new Map());
  const [saving, setSaving] = useState(false);
  const dirty =
    pendingMoves.size > 0 ||
    pendingOrder.size > 0 ||
    pendingRenames.size > 0 ||
    pendingRoleMoves.size > 0 ||
    pendingRoleOrder.size > 0;
  const pendingCount =
    pendingMoves.size +
    pendingOrder.size +
    pendingRenames.size +
    pendingRoleMoves.size +
    pendingRoleOrder.size;
  const [rename, setRename] = useState<RenameState | null>(null);

  // Right-hand metrics panel — the open target + its drill stack persist too,
  // so the sidebar comes back exactly as left (the fetch effect keys off them).
  const [base, setBase] = useViewState<{ level: string; id: string } | null>('org.map.base', null);
  const [ovStack, setOvStack] = useViewState<{ level: string; id: string }[]>('org.map.stack', []);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [drawerSection, setDrawerSection] = useState<MetricSection | null>(null);
  const [accentHex, setAccentHex] = useState<string | undefined>(undefined);
  const target = ovStack.length ? ovStack[ovStack.length - 1] : base;

  const openMetrics = (level: string, id: string, accent?: string) => {
    setBase({ level, id });
    setOvStack([]);
    setAccentHex(accent);
  };
  const onPanelDrill = (level: string, id: string) => setOvStack((s) => [...s, { level, id }]);
  const onPanelBack = () => setOvStack((s) => s.slice(0, -1));
  const closeMetrics = () => {
    setBase(null);
    setOvStack([]);
  };

  useEffect(() => {
    if (!target) {
      setDash(null);
      return;
    }
    let cancelled = false;
    setDashLoading(true);
    setDash(null);
    const url = target.id
      ? `/explorer/roles/${target.level}/${encodeURIComponent(target.id)}`
      : `/explorer/roles/${target.level}`;
    api
      .get<Dashboard>(url)
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
  }, [target?.level, target?.id]);

  useEffect(() => {
    setDrawerSection(null);
  }, [target?.level, target?.id]);

  // Segment name → OrgUnit id (so the name-keyed segment card is an id-backed
  // drag source / drop target). Unassigned segment has no id → not draggable.
  const segmentIdByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of data.segments) if (s.id) m.set(s.name, s.id);
    return m;
  }, [data.segments]);

  // Canvas node id → raw OrgUnit id.
  const rawNodeId = useCallback(
    (node: { id: string }): string | null => {
      const id = node.id;
      if (id === 'company') return null;
      if (id.startsWith('seg:')) return segmentIdByName.get(id.slice(4)) ?? null;
      return id.replace(/^(div|dept|role):/, '');
    },
    [segmentIdByName],
  );

  // Apply a parent's staged child order.
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

  // ── Derived selection — pending-aware (mirrors MapCanvas display arrays) ─────
  const selSegId = selSegName ? (segmentIdByName.get(selSegName) ?? null) : null;

  // Segments: a segment nested under something deeper is removed from the top row.
  const displaySegments = useMemo<Segment[]>(() => {
    if (!dirty) return data.segments;
    return data.segments.filter((s) => !(s.id && pendingMoves.has(s.id)));
  }, [data.segments, dirty, pendingMoves]);

  const selSegment = selSegName ? (data.segments.find((s) => s.name === selSegName) ?? null) : null;

  // Divisions under the selected segment: drop staged departures, inject staged
  // same-level arrivals, then apply staged order.
  const displayDivisions = useMemo<Division[]>(() => {
    if (!selSegment) return [];
    let list = selSegment.divisions.filter((dv) => {
      const r = pendingMoves.get(dv.id);
      return !(r && r.parent !== selSegId);
    });
    for (const [id, rec] of pendingMoves) {
      // any box staged to move UNDER this focused segment shows as one of its divisions
      if (rec.parent === selSegId && !list.some((dv) => dv.id === id)) {
        list = [
          ...list,
          {
            id,
            name: rec.name,
            segment: selSegName ?? '',
            departments: [],
            looseRoles: [],
            roleCount: 0,
          },
        ];
      }
    }
    return applyOrder(selSegId, list, (dv) => dv.id);
  }, [selSegment, pendingMoves, applyOrder, selSegId, selSegName]);

  const selDivision = selDivId ? (displayDivisions.find((d) => d.id === selDivId) ?? null) : null;

  // Teams (departments) of the selected division + the synthetic "Direct to
  // division" pseudo-team, with staged unit AND role moves applied. A role
  // staged to another home leaves its row immediately; staged arrivals join
  // their target; a staged order re-sorts; the pseudo-team hides once empty.
  const stageRoles = useCallback(
    (unitId: string, roles: RoleLite[]): RoleLite[] => {
      let out = roles.filter((r) => {
        const rec = pendingRoleMoves.get(r.id);
        return !(rec && rec.unitId !== unitId);
      });
      for (const [rid, rec] of pendingRoleMoves) {
        if (rec.unitId === unitId && !out.some((r) => r.id === rid)) {
          out = [
            ...out,
            { id: rid, name: rec.name, roleLevel: null, roleFamily: null, valueStreamCount: 1 },
          ];
        }
      }
      const ord = pendingRoleOrder.get(unitId);
      if (ord) {
        const pos = new Map(ord.map((id, i) => [id, i]));
        out = [...out].sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity));
      }
      return out;
    },
    [pendingRoleMoves, pendingRoleOrder],
  );

  const teams = useMemo(() => {
    if (!selDivision) return [] as { id: string; name: string; roles: RoleLite[] }[];
    let list = selDivision.departments
      .filter((dp) => {
        const r = pendingMoves.get(dp.id);
        return !(r && r.parent !== selDivId);
      })
      .map((dp) => ({ id: dp.id, name: dp.name, roles: stageRoles(dp.id, dp.roles) }));
    for (const [id, rec] of pendingMoves) {
      // any box staged to move UNDER this focused division shows as one of its teams
      if (rec.parent === selDivId && !list.some((t) => t.id === id)) {
        list = [...list, { id, name: rec.name, roles: [] }];
      }
    }
    if (selDivId) list = applyOrder(selDivId, list, (t) => t.id);
    const loose = selDivId ? stageRoles(selDivId, selDivision.looseRoles) : selDivision.looseRoles;
    if (loose.length > 0) list.push({ id: LOOSE, name: 'Direct to division', roles: loose });
    return list;
  }, [selDivision, pendingMoves, applyOrder, selDivId, stageRoles]);

  const selTeam = selDeptId ? (teams.find((t) => t.id === selDeptId) ?? null) : null;
  const roles = selTeam?.roles ?? [];

  // ── Click handlers ──────────────────────────────────────────────────────────
  const hexOf = (segName: string | null) =>
    segName ? (DOMAIN_HEX[segName] ?? '#94a3b8') : undefined;

  function onCompanyClick() {
    if (companyOpen) {
      setCompanyOpen(false);
      setSelSegName(null);
      setSelDivId(null);
      setSelDeptId(null);
      closeMetrics();
    } else setCompanyOpen(true);
  }
  function onSegmentClick(name: string) {
    const next = selSegName === name ? null : name;
    setSelSegName(next);
    setSelDivId(null);
    setSelDeptId(null);
    if (next) openMetrics('domain', name, hexOf(name));
    else closeMetrics();
  }
  function onDivisionClick(id: string) {
    const next = selDivId === id ? null : id;
    setSelDivId(next);
    setSelDeptId(null);
    if (next) openMetrics('division', id, hexOf(selSegName));
    else if (selSegName) openMetrics('domain', selSegName, hexOf(selSegName));
  }
  function onDeptClick(id: string) {
    const next = selDeptId === id ? null : id;
    setSelDeptId(next);
    if (next && next !== LOOSE) openMetrics('department', id, hexOf(selSegName));
    else if (selDivId) openMetrics('division', selDivId, hexOf(selSegName));
  }

  const crumbClear = useCallback(() => {
    setSelSegName(null);
    setSelDivId(null);
    setSelDeptId(null);
    closeMetrics();
  }, []);
  const crumbToSegment = () => {
    setSelDivId(null);
    setSelDeptId(null);
    if (selSegName) openMetrics('domain', selSegName, hexOf(selSegName));
  };
  const crumbToDivision = () => {
    setSelDeptId(null);
    if (selDivId) openMetrics('division', selDivId, hexOf(selSegName));
  };

  // ── Build nodes and edges (from the display arrays) ──────────────────────────
  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];
    const LINE = '#9ca3af';
    const accent = selSegName ? (DOMAIN_HEX[selSegName] ?? LINE) : LINE;

    const companyFs: NodeFocusState = companyOpen ? 'expanded' : 'neutral';
    ns.push({
      id: 'company',
      type: 'orgCompany',
      position: { x: -MAP_CARD_W / 2, y: 0 },
      data: { name: data.company.name, focusState: companyFs } satisfies OrgCompanyData,
      draggable: false,
      selectable: false,
    });
    if (!companyOpen) return { nodes: ns, edges: es };

    const segTop = MAP_CARD_H + 40;
    const segPos = gridPositions(displaySegments.length, 0, segTop);
    let divCenterX = 0;
    displaySegments.forEach((seg, i) => {
      const id = `seg:${seg.name}`;
      const isSel = selSegName === seg.name;
      const fs: NodeFocusState = !selSegName ? 'neutral' : isSel ? 'expanded' : 'dimmed';
      ns.push({
        id,
        type: 'orgSegment',
        position: segPos[i],
        data: {
          name: seg.name,
          divisionCount: seg.divisions.length,
          focusState: fs,
          pieceIndex: i,
        } satisfies OrgSegmentData,
        draggable: false,
      });
      es.push({
        id: `e:company->${id}`,
        source: 'company',
        target: id,
        sourceHandle: 'b',
        targetHandle: 't',
        style: {
          stroke: isSel ? accent : LINE,
          strokeWidth: isSel ? 2 : 1.25,
          strokeOpacity: isSel ? 0.95 : selSegName ? 0.2 : 0.55,
        },
      });
      if (isSel) divCenterX = segPos[i].x + MAP_CARD_W / 2;
    });

    if (!selSegment) return { nodes: ns, edges: es };
    const divTop = segTop + gridHeight(displaySegments.length) + ROW_GAP_Y;
    const divPos = gridPositions(displayDivisions.length, divCenterX, divTop);
    let deptCenterX = divCenterX;
    displayDivisions.forEach((div, i) => {
      const id = `div:${div.id}`;
      const isSel = selDivId === div.id;
      const fs: NodeFocusState = !selDivId ? 'neutral' : isSel ? 'focused' : 'dimmed';
      ns.push({
        id,
        type: 'orgDivision',
        position: divPos[i],
        data: {
          name: div.name,
          segment: selSegment.name,
          teamCount: div.departments.length + (div.looseRoles.length > 0 ? 1 : 0),
          roleCount: div.roleCount,
          focusState: fs,
          pieceIndex: i,
        } satisfies OrgDivisionData,
        draggable: false,
      });
      es.push({
        id: `e:seg->${id}`,
        source: `seg:${selSegment.name}`,
        target: id,
        sourceHandle: 'b',
        targetHandle: 't',
        style: {
          stroke: isSel ? accent : LINE,
          strokeWidth: isSel ? 2 : 1.25,
          strokeOpacity: isSel ? 0.95 : selDivId ? 0.18 : 0.6,
        },
      });
      if (isSel) deptCenterX = divPos[i].x + MAP_CARD_W / 2;
    });

    if (!selDivision) return { nodes: ns, edges: es };
    const deptTop = divTop + gridHeight(displayDivisions.length) + ROW_GAP_Y;
    const deptPos = gridPositions(teams.length, deptCenterX, deptTop);
    let roleCenterX = deptCenterX;
    teams.forEach((t, i) => {
      const id = `dept:${t.id}`;
      const isSel = selDeptId === t.id;
      const fs: NodeFocusState = !selDeptId ? 'neutral' : isSel ? 'focused' : 'dimmed';
      ns.push({
        id,
        type: 'orgDept',
        position: deptPos[i],
        data: {
          name: t.name,
          segment: selSegName ?? '',
          roleCount: t.roles.length,
          focusState: fs,
          pieceIndex: i,
        } satisfies OrgDeptData,
        draggable: false,
      });
      es.push({
        id: `e:div->${id}`,
        source: `div:${selDivision.id}`,
        target: id,
        sourceHandle: 'b',
        targetHandle: 't',
        style: {
          stroke: isSel ? accent : LINE,
          strokeWidth: isSel ? 2 : 1.25,
          strokeOpacity: isSel ? 0.95 : selDeptId ? 0.18 : 0.6,
        },
      });
      if (isSel) roleCenterX = deptPos[i].x + MAP_CARD_W / 2;
    });

    if (!selTeam) return { nodes: ns, edges: es };
    const roleTop = deptTop + gridHeight(teams.length) + ROW_GAP_Y;
    const rolePos = gridPositions(roles.length, roleCenterX, roleTop);
    roles.forEach((r, i) => {
      const id = `role:${r.id}`;
      ns.push({
        id,
        type: 'orgRole',
        position: rolePos[i],
        data: {
          name: r.name,
          focusState: 'neutral',
          pieceIndex: i,
          orgOnly: r.valueStreamCount === 0,
        } satisfies OrgRoleData,
        draggable: false,
      });
      es.push({
        id: `e:dept->${id}`,
        source: `dept:${selTeam.id}`,
        target: id,
        sourceHandle: 'b',
        targetHandle: 't',
        style: { stroke: accent, strokeWidth: 1.25, strokeOpacity: 0.5 },
      });
    });

    return { nodes: ns, edges: es };
  }, [
    data.company.name,
    displaySegments,
    companyOpen,
    selSegName,
    selSegment,
    selDivId,
    displayDivisions,
    selDivision,
    teams,
    selDeptId,
    selTeam,
    roles,
  ]);

  // ── Edit machinery (viz/org-map/useOrgDragDrop — ported from MapCanvas) ──────
  const drillByCanvasId = useCallback(
    (canvasId: string, type: string) => {
      if (type === 'orgSegment') {
        const n = canvasId.slice(4);
        if (selSegName !== n) onSegmentClick(n);
      } else if (type === 'orgDivision') {
        const id = canvasId.slice(4);
        if (selDivId !== id) onDivisionClick(id);
      } else if (type === 'orgDept') {
        const id = canvasId.slice(5);
        if (selDeptId !== id) onDeptClick(id);
      }
    },
    [selSegName, selDivId, selDeptId],
  );

  const { onStagePointerDown, clearHoverDrill, gapRef, nestRef, DRAGGABLE_TYPES } = useOrgDragDrop({
    editMode,
    rf,
    nodes,
    drag,
    setDrag,
    dragRef,
    setGap,
    setNestTargetId,
    selSegName,
    selSegId,
    selDivId,
    selDeptId,
    selSegment,
    displayDivisions,
    teams,
    segmentIdByName,
    rawNodeId,
    drillByCanvasId,
    setPendingMoves,
    setPendingOrder,
    setPendingRoleMoves,
    setPendingRoleOrder,
    onRoleClick: openRole,
    pendingRenames,
    setRename,
    flash,
  });

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
      if (ops.length)
        await api.post(`/builder/nodes/batch?companyId=${encodeURIComponent(companyId)}`, { ops });
      // Role edits land on the canonical Role rows (single source of truth for
      // every org/roles view): re-home via PATCH, display order via reorder.
      for (const [id, rec] of pendingRoleMoves)
        await api.patch(`/roles/${encodeURIComponent(id)}`, { orgUnitId: rec.unitId });
      for (const [, orderedIds] of pendingRoleOrder)
        await api.put('/roles/reorder', { orderedIds });
      setPendingMoves(new Map());
      setPendingOrder(new Map());
      setPendingRenames(new Map());
      setPendingRoleMoves(new Map());
      setPendingRoleOrder(new Map());
      flash('ok', 'Saved.');
      onSaved();
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
    pendingRoleMoves,
    pendingRoleOrder,
    onSaved,
    flash,
  ]);

  const onRevert = useCallback(() => {
    setPendingMoves(new Map());
    setPendingOrder(new Map());
    setPendingRenames(new Map());
    setPendingRoleMoves(new Map());
    setPendingRoleOrder(new Map());
    setRename(null);
    flash('ok', 'Reverted.');
  }, [flash]);

  // Hovering "+" opens the insertion slot; CLOSING is delayed so micro pointer
  // wobbles don't snap the row back and forth, and OPENING is idempotent so a
  // re-entered gap returns the previous state object and React bails out of
  // the re-render — otherwise every mouseover re-set the gap → re-render →
  // hover (and the mouse cursor) oscillated ~40ms (mirrors MapCanvas).
  const gapCloseTimer = useRef<number | null>(null);
  const plusHoverGap = useCallback(
    (g: { parent: string; index: number; type: string; hover?: boolean } | null) => {
      if (gapCloseTimer.current) {
        window.clearTimeout(gapCloseTimer.current);
        gapCloseTimer.current = null;
      }
      if (g)
        setGap((prev) =>
          prev?.hover && prev.index === g.index && prev.type === g.type ? prev : g,
        );
      else
        gapCloseTimer.current = window.setTimeout(() => {
          gapCloseTimer.current = null;
          // Only clear a hover-opened gap — a drag owns its own gap state.
          setGap((prev) => (prev?.hover ? null : prev));
        }, 250);
    },
    [],
  );

  // ── Add / Remove (edit mode; applied immediately, not staged) ────────────────
  // Same model as the Value Streams map: creates/deletes hit /builder/nodes
  // directly (closure maintained server-side) and the org table refetches.
  const dialogs = useDialogs();

  const createOrgUnit = useCallback(
    async (level: number, parentId: string | null, row?: { ids: string[]; afterId: string }) => {
      if (!companyId) return;
      const label = ORG_LEVEL_LABEL[level] ?? 'unit';
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
            typeKey: `o${level}`,
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
        // Offer the lower-level units in the same flow (connected-additions rule).
        if (level < ORG_MAX_LEVEL) {
          const childLabel = ORG_LEVEL_LABEL[level + 1] ?? 'unit';
          let addMore = await dialogs.confirm({
            title: `Add ${childLabel}s under “${name}”?`,
            message: `“${name}” was added. You can capture its ${childLabel}s now, one at a time.`,
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
                typeKey: `o${level + 1}`,
                parentId: created.id,
                name: childName,
              });
            }
          }
        }
        flash('ok', 'Added.');
        onSaved();
      } catch (e) {
        const msg = (e as Error)?.message;
        flash('err', msg && !/HTTP/.test(msg) ? msg : 'Add failed.');
      }
    },
    [companyId, dialogs, flash, onSaved],
  );

  // Row context for a canvas node — level, effective parent, sibling raw ids.
  const rowInfoFor = useCallback(
    (n: Node): { level: number; parent: string | null; rowIds: string[] } | null => {
      switch (n.type) {
        case 'orgSegment':
          return { level: 1, parent: null, rowIds: [] };
        case 'orgDivision':
          return { level: 2, parent: selSegId, rowIds: displayDivisions.map((dv) => dv.id) };
        case 'orgDept':
          return {
            level: 3,
            parent: selDivId,
            rowIds: teams.filter((t) => t.id !== LOOSE).map((t) => t.id),
          };
        default:
          return null;
      }
    },
    [selSegId, selDivId, displayDivisions, teams],
  );

  const handleAddAfter = useCallback(
    (n: Node) => {
      const info = rowInfoFor(n);
      if (!info) return;
      const raw = rawNodeId(n);
      void createOrgUnit(
        info.level,
        info.parent,
        raw && info.parent ? { ids: info.rowIds, afterId: raw } : undefined,
      );
    },
    [rowInfoFor, rawNodeId, createOrgUnit],
  );

  const handleRemove = useCallback(
    async (n: Node, name: string) => {
      if (!companyId) return;
      const raw = rawNodeId(n);
      if (!raw || raw === LOOSE) return;
      const ok = await dialogs.confirm({
        title: `Remove “${sentenceCase(name)}”?`,
        message: 'This permanently deletes this unit and every unit beneath it.',
        danger: true,
        confirmLabel: 'Remove',
      });
      if (!ok) return;
      try {
        await api.delete(
          `/builder/nodes/${raw}?companyId=${encodeURIComponent(companyId)}&confirm=${encodeURIComponent(name)}`,
        );
        // Collapse focus off the deleted branch.
        if (raw === selDeptId) onDeptClick(raw);
        else if (raw === selDivId) onDivisionClick(raw);
        else if (raw === selSegId && selSegName) onSegmentClick(selSegName);
        // Drop staged edits referencing the deleted unit.
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
        onSaved();
      } catch (e) {
        const msg = (e as Error)?.message;
        flash('err', msg && !/HTTP/.test(msg) ? msg : 'Remove failed.');
      }
    },
    [companyId, rawNodeId, dialogs, selDeptId, selDivId, selSegId, selSegName, flash, onSaved],
  );

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

  // displayNodes — lift the dragged card, open the gap, apply staged flags + names.
  const displayNodes = useMemo<Node[]>(() => {
    if (!editMode) return nodes;
    const liftId = drag?.started ? drag.canvasId : null;
    let result = liftId ? nodes.filter((n) => n.id !== liftId) : nodes;
    if (gap) {
      const rowNodes = result
        .filter((n) => n.type === gap.type)
        .sort((a, b) => a.position.x - b.position.x);
      const shiftIds = new Set(rowNodes.slice(gap.index).map((n) => n.id));
      // A drag opens a full card-width slot; a "+" hover spreads just enough
      // to make room for the badge.
      const spread = gap.hover ? PLUS_GAP_SPREAD : MAP_CARD_W + 12;
      if (shiftIds.size)
        result = result.map((n) =>
          shiftIds.has(n.id)
            ? { ...n, position: { x: n.position.x + spread, y: n.position.y } }
            : n,
        );
    }
    const mapped = result.map((n) => {
      const draggable = DRAGGABLE_TYPES.has(n.type ?? '');
      const raw = rawNodeId(n);
      const renamed = raw != null ? pendingRenames.get(raw) : undefined;
      const staged =
        (raw != null && (pendingMoves.has(raw) || pendingRoleMoves.has(raw))) ||
        renamed !== undefined;
      const nestTarget = n.id === nestTargetId;
      if (!draggable && !staged && !nestTarget) return n;
      const data: Record<string, unknown> = {
        ...n.data,
        editable: draggable,
        staged,
        dropTarget: nestTarget,
      };
      // Hover-only +/− badges — real OrgUnits only (the "Direct to division"
      // pseudo-team and the Unassigned segment aren't rows in the DB; role
      // cards drag/re-home but add/delete elsewhere). The remove confirm needs
      // the SERVER name, so capture it pre-rename-overlay.
      if (draggable && !drag?.started && raw && raw !== LOOSE && n.type !== 'orgRole') {
        const orig = n.data as { name?: string; pieceIndex?: number };
        const serverName = orig.name ?? '';
        data.plusSide = 'right';
        data.onAddAfter = () => handleAddAfter(n);
        data.onRemove = () => void handleRemove(n, serverName);
        // Hovering "+" opens the insertion slot after this card (same gap the
        // drag gesture uses), previewing where the new unit will land.
        data.onPlusHover = (h: boolean) =>
          plusHoverGap(
            h
              ? { parent: '', index: (orig.pieceIndex ?? 0) + 1, type: n.type ?? '', hover: true }
              : null,
          );
      }
      if (renamed !== undefined) data.name = renamed;
      // Descending zIndex along the row: every card paints ABOVE its following
      // sibling, so the "+" badge hanging into the gutter is always on top and
      // reachable from any pointer direction (mirrors MapCanvas).
      if (draggable) {
        const idx = (n.data as { pieceIndex?: number }).pieceIndex ?? 0;
        return { ...n, zIndex: 200 - idx, data };
      }
      return { ...n, data };
    });
    // "+ Add …" placeholder under a focused unit with no children yet.
    const placeholders: Node[] = [];
    const addPlaceholder = (parentCanvasId: string, childLevel: number, parentRaw: string) => {
      const p = nodes.find((x) => x.id === parentCanvasId);
      if (!p) return;
      placeholders.push({
        id: `add:${parentRaw}`,
        type: 'addNode',
        position: { x: p.position.x, y: p.position.y + MAP_CARD_H + ROW_GAP_Y },
        data: {
          label: `Add ${ORG_LEVEL_LABEL[childLevel] ?? 'unit'}`,
          onClick: () => void createOrgUnit(childLevel, parentRaw),
        },
        draggable: false,
        selectable: false,
      });
    };
    if (!drag?.started) {
      if (selSegment && selSegId && displayDivisions.length === 0)
        addPlaceholder(`seg:${selSegment.name}`, 2, selSegId);
      if (selDivision && selDivId && !teams.some((t) => t.id !== LOOSE))
        addPlaceholder(`div:${selDivId}`, 3, selDivId);
    }
    return placeholders.length ? [...mapped, ...placeholders] : mapped;
  }, [
    nodes,
    editMode,
    drag,
    gap,
    nestTargetId,
    DRAGGABLE_TYPES,
    rawNodeId,
    pendingMoves,
    pendingRoleMoves,
    pendingRenames,
    handleAddAfter,
    handleRemove,
    createOrgUnit,
    selSegment,
    selSegId,
    selDivision,
    selDivId,
    displayDivisions,
    teams,
  ]);

  const displayEdges = useMemo<Edge[]>(() => {
    const liftId = drag?.started ? drag.canvasId : null;
    return liftId ? edges.filter((e) => e.source !== liftId && e.target !== liftId) : edges;
  }, [edges, drag]);
  const flowNodes = displayNodes;

  // ── Camera helpers + drill effects (viz/org-map/useOrgCamera) ────────────────
  useOrgCamera({
    rf,
    paneW,
    paneH,
    dragRef,
    companyOpen,
    selSegName,
    selSegment,
    selDivId,
    selDivision,
    selDeptId,
    selTeam,
    displayDivisions,
    teams,
    roles,
  });

  // ── Node click handler (drill / role nav) ────────────────────────────────────
  const onNodeClick: NodeMouseHandler = (_e, node) => {
    if (node.type === 'orgCompany') onCompanyClick();
    else if (node.type === 'orgSegment') onSegmentClick(node.id.replace(/^seg:/, ''));
    else if (node.type === 'orgDivision') onDivisionClick(node.id.replace(/^div:/, ''));
    else if (node.type === 'orgDept') onDeptClick(node.id.replace(/^dept:/, ''));
    else if (node.type === 'orgRole') openRole(node.id.replace(/^role:/, ''));
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex' }}>
      {breadcrumbSlot &&
        createPortal(
          selSegName ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                whiteSpace: 'nowrap',
              }}
            >
              <button onClick={crumbClear} className="focus-crumb-ancestor" style={CRUMB}>
                {sentenceCase(data.company.name)}
              </button>
              <span style={CRUMB_SEP}>›</span>
              {!selDivision ? (
                <span className="focus-crumb-active" style={CRUMB}>
                  {sentenceCase(selSegName)}
                </span>
              ) : (
                <button onClick={crumbToSegment} className="focus-crumb-ancestor" style={CRUMB}>
                  {sentenceCase(selSegName)}
                </button>
              )}
              {selDivision && (
                <>
                  <span style={CRUMB_SEP}>›</span>
                  {!selTeam ? (
                    <span className="focus-crumb-active" style={CRUMB}>
                      {sentenceCase(selDivision.name)}
                    </span>
                  ) : (
                    <button
                      onClick={crumbToDivision}
                      className="focus-crumb-ancestor"
                      style={CRUMB}
                    >
                      {sentenceCase(selDivision.name)}
                    </button>
                  )}
                </>
              )}
              {selTeam && (
                <>
                  <span style={CRUMB_SEP}>›</span>
                  <span className="focus-crumb-active" style={CRUMB}>
                    {sentenceCase(selTeam.name)}
                  </span>
                </>
              )}
              <button
                onClick={crumbClear}
                aria-label="Clear focus"
                style={{
                  marginLeft: 6,
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: '#a3a3a3',
                  background: 'transparent',
                  border: '1px solid #eaeaea',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-[#666666]">
              Click a segment to drill into divisions, teams and roles.
            </span>
          ),
          breadcrumbSlot,
        )}

      <div
        className={'rf-stage rf-stage--map' + (editMode ? ' rf-stage--edit' : '')}
        style={{ flex: 1, position: 'relative', minWidth: 0 }}
        onPointerDownCapture={onStagePointerDown}
      >
        <ReactFlow
          nodes={flowNodes}
          edges={displayEdges}
          nodeTypes={orgNodeTypes}
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

        {/* Drag ghost */}
        {drag?.started && <DragGhost drag={drag} />}

        {/* Inline rename editor */}
        {rename && (
          <RenameEditor rename={rename} setRename={setRename} commitRename={commitRename} />
        )}

        {/* Edit toolbar */}
        <MapEditToolbar
          editMode={editMode}
          dirty={dirty}
          pendingCount={pendingCount}
          saving={saving}
          onSave={onSave}
          onRevert={onRevert}
          onToggleEdit={onToggleEdit}
        />

        {/* Move feedback banner */}
        {moveFlash && <MoveFlashBanner moveFlash={moveFlash} />}
      </div>

      {base && (
        <MetricsSidebar
          dash={dash}
          loading={dashLoading}
          onDrill={onPanelDrill}
          accent={accentHex}
          onBack={ovStack.length ? onPanelBack : undefined}
          onClose={closeMetrics}
          onViewAll={setDrawerSection}
        />
      )}
      {drawerSection && (
        <MetricsDrawer
          section={drawerSection}
          contextTitle={dash?.title ?? ''}
          onClose={() => setDrawerSection(null)}
          onDrill={onPanelDrill}
        />
      )}
    </div>
  );
}

// ── Data wrapper + provider ──────────────────────────────────────────────────

export default function OrgMapCanvas({ breadcrumbSlot }: Props) {
  const { data, error, loading, refetch } = useApi<OrgData>('/explorer/org-table');

  if (loading && !data) {
    return (
      <div className="h-full grid place-items-center">
        <LoadingState className="animate-pulse" message="Loading organization…" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-full grid place-items-center">
        <ErrorMessage>{error}</ErrorMessage>
      </div>
    );
  }
  if (!data) return null;

  return (
    <ReactFlowProvider>
      <OrgMapCanvasInner data={data} breadcrumbSlot={breadcrumbSlot} onSaved={refetch} />
    </ReactFlowProvider>
  );
}
