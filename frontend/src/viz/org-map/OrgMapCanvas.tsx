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
import { useNavigate } from 'react-router-dom';
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
import type { RenameState } from '../map/constants';
import { DragGhost, RenameEditor, MapEditToolbar, MoveFlashBanner } from '../map/MapChrome';

// ── Inner canvas ─────────────────────────────────────────────────────────────

type Props = { breadcrumbSlot?: HTMLElement | null };

function OrgMapCanvasInner({
  data,
  breadcrumbSlot,
  onSaved,
}: Props & { data: OrgData; onSaved: () => void }) {
  const rf = useReactFlow();
  const paneW = useStore((s) => s.width);
  const paneH = useStore((s) => s.height);
  const navigate = useNavigate();
  const { companyId } = useCompany();

  // Drill state. The company starts open (segments visible), like the VS map.
  const [companyOpen, setCompanyOpen] = useState(true);
  const [selSegName, setSelSegName] = useState<string | null>(null);
  const [selDivId, setSelDivId] = useState<string | null>(null);
  const [selDeptId, setSelDeptId] = useState<string | null>(null); // LOOSE = direct-to-division roles

  // ── Edit state (identical model to MapCanvas) ────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const dragRef = useRef<OrgDragState | null>(null);
  const [drag, setDrag] = useState<OrgDragState | null>(null);
  const [gap, setGap] = useState<{ parent: string; index: number; type: string } | null>(null);
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
  const [saving, setSaving] = useState(false);
  const dirty = pendingMoves.size > 0 || pendingOrder.size > 0 || pendingRenames.size > 0;
  const pendingCount = pendingMoves.size + pendingOrder.size + pendingRenames.size;
  const [rename, setRename] = useState<RenameState | null>(null);

  // Right-hand metrics panel.
  const [base, setBase] = useState<{ level: string; id: string } | null>(null);
  const [ovStack, setOvStack] = useState<{ level: string; id: string }[]>([]);
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
  // division" pseudo-team, with staged moves applied.
  const teams = useMemo(() => {
    if (!selDivision) return [] as { id: string; name: string; roles: RoleLite[] }[];
    let list = selDivision.departments
      .filter((dp) => {
        const r = pendingMoves.get(dp.id);
        return !(r && r.parent !== selDivId);
      })
      .map((dp) => ({ id: dp.id, name: dp.name, roles: dp.roles }));
    for (const [id, rec] of pendingMoves) {
      // any box staged to move UNDER this focused division shows as one of its teams
      if (rec.parent === selDivId && !list.some((t) => t.id === id)) {
        list = [...list, { id, name: rec.name, roles: [] }];
      }
    }
    if (selDivId) list = applyOrder(selDivId, list, (t) => t.id);
    if (selDivision.looseRoles.length > 0)
      list.push({ id: LOOSE, name: 'Direct to division', roles: selDivision.looseRoles });
    return list;
  }, [selDivision, pendingMoves, applyOrder, selDivId]);

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
    selSegment,
    displayDivisions,
    teams,
    segmentIdByName,
    rawNodeId,
    drillByCanvasId,
    setPendingMoves,
    setPendingOrder,
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
      await api.post(`/builder/nodes/batch?companyId=${encodeURIComponent(companyId)}`, { ops });
      setPendingMoves(new Map());
      setPendingOrder(new Map());
      setPendingRenames(new Map());
      flash('ok', 'Saved.');
      onSaved();
    } catch (e) {
      const msg = (e as Error)?.message;
      flash('err', msg && !/HTTP/.test(msg) ? msg : 'Save failed — your changes are kept.');
    } finally {
      setSaving(false);
    }
  }, [companyId, dirty, saving, pendingMoves, pendingOrder, pendingRenames, onSaved, flash]);

  const onRevert = useCallback(() => {
    setPendingMoves(new Map());
    setPendingOrder(new Map());
    setPendingRenames(new Map());
    setRename(null);
    flash('ok', 'Reverted.');
  }, [flash]);

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
      if (shiftIds.size)
        result = result.map((n) =>
          shiftIds.has(n.id)
            ? { ...n, position: { x: n.position.x + MAP_CARD_W + 12, y: n.position.y } }
            : n,
        );
    }
    return result.map((n) => {
      const draggable = DRAGGABLE_TYPES.has(n.type ?? '');
      const raw = rawNodeId(n);
      const renamed = raw != null ? pendingRenames.get(raw) : undefined;
      const staged = (raw != null && pendingMoves.has(raw)) || renamed !== undefined;
      const nestTarget = n.id === nestTargetId;
      if (!draggable && !staged && !nestTarget) return n;
      const data: Record<string, unknown> = {
        ...n.data,
        editable: draggable,
        staged,
        dropTarget: nestTarget,
      };
      if (renamed !== undefined) data.name = renamed;
      return { ...n, data };
    });
  }, [
    nodes,
    editMode,
    drag,
    gap,
    nestTargetId,
    DRAGGABLE_TYPES,
    rawNodeId,
    pendingMoves,
    pendingRenames,
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
    else if (node.type === 'orgRole')
      navigate(`/organization?role=${encodeURIComponent(node.id.replace(/^role:/, ''))}`);
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
