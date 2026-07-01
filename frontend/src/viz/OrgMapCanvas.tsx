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

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, ReactFlowProvider,
  useReactFlow, useStore, Handle, Position,
  type Node, type Edge, type NodeMouseHandler, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { MAP_CARD_W, MAP_CARD_H, sentenceCase } from './nodes/MapNode';
import { DOMAIN_HEX, DOMAIN_BG, DOMAIN_BORDER, DOMAIN_TEXT, type NodeFocusState } from './model';
import { useApi } from '../lib/useApi';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import MetricsSidebar, { MetricsDrawer, type Dashboard, type MetricSection } from '../components/MetricsSidebar';

// ── Org-table payload (same shapes as pages/OrgTable.tsx) ────────────────────

type RoleLite = { id: string; name: string; roleLevel: string | null; roleFamily: string | null; valueStreamCount: number };
type Dept = { id: string; name: string; roles: RoleLite[]; roleCount: number };
type Division = { id: string; name: string; segment: string; departments: Dept[]; looseRoles: RoleLite[]; roleCount: number };
type Segment = { id: string | null; name: string; divisions: Division[]; divisionCount: number; roleCount: number };
type OrgData = { company: { id: string; name: string }; totals: Record<string, number>; segments: Segment[] };

const LOOSE = '__loose'; // sentinel "team" for roles reporting directly to a division

// ── Layout constants ─────────────────────────────────────────────────────────

const GAP_X     = 12;  // horizontal gap between sibling cards
const ROW_GAP_Y = 32;  // vertical gap between a parent row and its child block

const CRUMB: CSSProperties     = { fontSize: 11, padding: '2px 7px' };
const CRUMB_SEP: CSSProperties = { color: '#d4d4d4', margin: '0 2px', fontSize: 10 };

// Each draggable org node TYPE maps to its OrgUnit level (segment=1, division=2,
// department=3). Roles/company aren't levels (can't be a parent / not draggable).
const ORG_TYPE_LEVEL: Record<string, number> = { orgSegment: 1, orgDivision: 2, orgDept: 3 };
const HOVER_DRILL_MS = 800; // hold the cursor directly over a box this long mid-drag → it drills open

// ── Small shared bits (mirroring nodes/MapNode.tsx) ──────────────────────────

const CLAMP2: CSSProperties = {
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
};

function focusClass(s: NodeFocusState | undefined): string {
  switch (s) {
    case 'dimmed':   return 'node-dimmed';
    case 'focused':  return 'node-focused';
    case 'expanded': return 'node-expanded';
    default:         return 'node-neutral';
  }
}

// Edit-mode affordance (mirrors MapNode.tsx): grab cursor + dashed outline when
// draggable; teal ring when it's the hovered nest target; amber dot when staged.
type EditAffordance = { editable?: boolean; dropTarget?: boolean; staged?: boolean };
function editStyle(d: EditAffordance): CSSProperties {
  if (d.dropTarget) return { cursor: 'grabbing', outline: '2px solid #0d9488', outlineOffset: 2, boxShadow: '0 0 0 4px rgba(13,148,136,0.18), 0 4px 14px rgba(13,148,136,0.25)' };
  if (d.editable) return { cursor: 'grab', outline: '1.5px dashed #cbd5e1', outlineOffset: 2 };
  return {};
}
function StagedDot() {
  return <div title="Unsaved change" style={{ position: 'absolute', top: -5, right: -5, width: 11, height: 11, borderRadius: '50%', background: '#f59e0b', border: '2px solid #ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', zIndex: 2 }} />;
}

function VHandles() {
  return (
    <>
      <Handle id="t" type="target" position={Position.Top}    style={{ opacity: 0, pointerEvents: 'none' }} isConnectable={false} />
      <Handle id="b" type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} isConnectable={false} />
    </>
  );
}

const cardBase: CSSProperties = {
  width: MAP_CARD_W,
  height: MAP_CARD_H,
  boxSizing: 'border-box',
  overflow: 'hidden',
  padding: '8px 10px',
  borderRadius: 10,
  background: '#ffffff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  cursor: 'pointer',
  userSelect: 'none',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  textAlign: 'center',
  gap: 4,
};

// ── Node components ──────────────────────────────────────────────────────────

type OrgCompanyData = { name: string; focusState?: NodeFocusState };
type OrgSegmentData = { name: string; divisionCount: number; focusState?: NodeFocusState; pieceIndex?: number } & EditAffordance;
type OrgDivisionData = { name: string; segment: string; teamCount: number; roleCount: number; focusState?: NodeFocusState; pieceIndex?: number } & EditAffordance;
type OrgDeptData = { name: string; segment: string; roleCount: number; focusState?: NodeFocusState; pieceIndex?: number } & EditAffordance;
type OrgRoleData = { name: string; focusState?: NodeFocusState; pieceIndex?: number };

const delayStyle = (i?: number) => (i != null ? { animationDelay: `${i * 40}ms` } : undefined);

const OrgCompanyNode = memo(function OrgCompanyNode({ data }: NodeProps) {
  const d = data as OrgCompanyData;
  return (
    <div
      className={focusClass(d.focusState)}
      style={{ ...cardBase, padding: '10px 12px', borderRadius: 12, background: '#171717', border: '1px solid #171717', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', lineHeight: 1.25, ...CLAMP2 }}>{sentenceCase(d.name)}</div>
      <VHandles />
    </div>
  );
});

const OrgSegmentNode = memo(function OrgSegmentNode({ data }: NodeProps) {
  const d = data as OrgSegmentData;
  const hex    = DOMAIN_HEX[d.name]    ?? '#94a3b8';
  const bg     = DOMAIN_BG[d.name]     ?? '#f8fafc';
  const border = DOMAIN_BORDER[d.name] ?? '#e2e8f0';
  const text   = DOMAIN_TEXT[d.name]   ?? '#475569';
  return (
    <div
      className={`animate-piece-arrive ${focusClass(d.focusState)}`}
      style={{ ...cardBase, background: bg, border: `1.5px solid ${border}`, borderTop: `3px solid ${hex}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', ...delayStyle(d.pieceIndex), ...editStyle(d) }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: text, letterSpacing: '-0.011em', lineHeight: 1.25, ...CLAMP2 }}>{sentenceCase(d.name)}</div>
      {d.staged && <StagedDot />}
      <VHandles />
    </div>
  );
});

const OrgDivisionNode = memo(function OrgDivisionNode({ data }: NodeProps) {
  const d = data as OrgDivisionData;
  const hex = DOMAIN_HEX[d.segment] ?? '#94a3b8';
  const border = DOMAIN_BORDER[d.segment] ?? '#e2e8f0';
  return (
    <div
      className={`animate-piece-arrive ${focusClass(d.focusState)}`}
      style={{ ...cardBase, border: `1px solid ${border}`, borderLeft: `3px solid ${hex}`, ...delayStyle(d.pieceIndex), ...editStyle(d) }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.3, ...CLAMP2 }}>{sentenceCase(d.name)}</div>
      {d.staged && <StagedDot />}
      <VHandles />
    </div>
  );
});

const OrgDeptNode = memo(function OrgDeptNode({ data }: NodeProps) {
  const d = data as OrgDeptData;
  const hex = DOMAIN_HEX[d.segment] ?? '#94a3b8';
  return (
    <div
      className={`animate-piece-arrive ${focusClass(d.focusState)}`}
      style={{ ...cardBase, border: '1px solid #eaeaea', borderLeft: `3px solid ${hex}`, ...delayStyle(d.pieceIndex), ...editStyle(d) }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.3, ...CLAMP2 }}>{sentenceCase(d.name)}</div>
      {d.staged && <StagedDot />}
      <VHandles />
    </div>
  );
});

const OrgRoleNode = memo(function OrgRoleNode({ data }: NodeProps) {
  const d = data as OrgRoleData;
  return (
    <div
      className={`animate-piece-arrive ${focusClass(d.focusState)}`}
      style={{ ...cardBase, border: '1px solid #eaeaea', borderLeft: '3px solid #94a3b8', ...delayStyle(d.pieceIndex) }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.3, ...CLAMP2 }}>{sentenceCase(d.name)}</div>
      <VHandles />
    </div>
  );
});

const orgNodeTypes = {
  orgCompany:  OrgCompanyNode,
  orgSegment:  OrgSegmentNode,
  orgDivision: OrgDivisionNode,
  orgDept:     OrgDeptNode,
  orgRole:     OrgRoleNode,
};

// ── Row layout helpers ───────────────────────────────────────────────────────

function gridPositions(n: number, centerX: number, top: number): { x: number; y: number }[] {
  const totalW = n * MAP_CARD_W + Math.max(0, n - 1) * GAP_X;
  const left = centerX - totalW / 2;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) out.push({ x: left + i * (MAP_CARD_W + GAP_X), y: top });
  return out;
}
function gridHeight(_n: number): number { return MAP_CARD_H; }

// An in-progress custom pointer drag of one org card.
type OrgDragState = {
  canvasId: string; rawId: string; type: string; level: number; name: string; cat: string;
  originParent: string | null; originOrder: string[];
  grabDX: number; grabDY: number; cardW: number; cardH: number;
  startX: number; startY: number; px: number; py: number; started: boolean;
};
type MoveRec = { parent: string; sameLevel: boolean; level: number; name: string; cat: string };

// ── Inner canvas ─────────────────────────────────────────────────────────────

type Props = { breadcrumbSlot?: HTMLElement | null };

function OrgMapCanvasInner({ data, breadcrumbSlot, onSaved }: Props & { data: OrgData; onSaved: () => void }) {
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
  const nestRef = useRef<string | null>(null);
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
  const [rename, setRename] = useState<{ rawId: string; value: string; x: number; y: number; w: number; h: number; cat: string } | null>(null);
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);
  const clickTimerRef = useRef<number | null>(null);

  // Right-hand metrics panel.
  const [base, setBase] = useState<{ level: string; id: string } | null>(null);
  const [ovStack, setOvStack] = useState<{ level: string; id: string }[]>([]);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [drawerSection, setDrawerSection] = useState<MetricSection | null>(null);
  const [accentHex, setAccentHex] = useState<string | undefined>(undefined);
  const target = ovStack.length ? ovStack[ovStack.length - 1] : base;

  const openMetrics = (level: string, id: string, accent?: string) => { setBase({ level, id }); setOvStack([]); setAccentHex(accent); };
  const onPanelDrill = (level: string, id: string) => setOvStack((s) => [...s, { level, id }]);
  const onPanelBack = () => setOvStack((s) => s.slice(0, -1));
  const closeMetrics = () => { setBase(null); setOvStack([]); };

  useEffect(() => {
    if (!target) { setDash(null); return; }
    let cancelled = false; setDashLoading(true); setDash(null);
    const url = target.id ? `/explorer/roles/${target.level}/${encodeURIComponent(target.id)}` : `/explorer/roles/${target.level}`;
    api.get(url)
      .then((d: Dashboard) => { if (!cancelled) setDash(d); })
      .catch(() => { if (!cancelled) setDash(null); })
      .finally(() => { if (!cancelled) setDashLoading(false); });
    return () => { cancelled = true; };
  }, [target?.level, target?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setDrawerSection(null); }, [target?.level, target?.id]);

  // Segment name → OrgUnit id (so the name-keyed segment card is an id-backed
  // drag source / drop target). Unassigned segment has no id → not draggable.
  const segmentIdByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of data.segments) if (s.id) m.set(s.name, s.id);
    return m;
  }, [data.segments]);

  // Canvas node id → raw OrgUnit id.
  const rawNodeId = useCallback((node: { id: string }): string | null => {
    const id = node.id;
    if (id === 'company') return null;
    if (id.startsWith('seg:')) return segmentIdByName.get(id.slice(4)) ?? null;
    return id.replace(/^(div|dept|role):/, '');
  }, [segmentIdByName]);

  const DRAGGABLE_TYPES = useMemo(() => new Set(['orgSegment', 'orgDivision', 'orgDept']), []);

  // Apply a parent's staged child order.
  const applyOrder = useCallback(<T,>(parentRaw: string | null, arr: T[], idOf: (t: T) => string): T[] => {
    if (!parentRaw) return arr;
    const ord = pendingOrder.get(parentRaw);
    if (!ord) return arr;
    const pos = new Map(ord.map((id, i) => [id, i]));
    return [...arr].sort((a, b) => (pos.get(idOf(a)) ?? Infinity) - (pos.get(idOf(b)) ?? Infinity));
  }, [pendingOrder]);

  // ── Derived selection — pending-aware (mirrors MapCanvas display arrays) ─────
  const selSegId = selSegName ? segmentIdByName.get(selSegName) ?? null : null;

  // Segments: a segment nested under something deeper is removed from the top row.
  const displaySegments = useMemo<Segment[]>(() => {
    if (!dirty) return data.segments;
    return data.segments.filter((s) => !(s.id && pendingMoves.has(s.id)));
  }, [data.segments, dirty, pendingMoves]);

  const selSegment = selSegName ? data.segments.find((s) => s.name === selSegName) ?? null : null;

  // Divisions under the selected segment: drop staged departures, inject staged
  // same-level arrivals, then apply staged order.
  const displayDivisions = useMemo<Division[]>(() => {
    if (!selSegment) return [];
    let list = selSegment.divisions.filter((dv) => { const r = pendingMoves.get(dv.id); return !(r && r.parent !== selSegId); });
    for (const [id, rec] of pendingMoves) {
      // any box staged to move UNDER this focused segment shows as one of its divisions
      if (rec.parent === selSegId && !list.some((dv) => dv.id === id)) {
        list = [...list, { id, name: rec.name, segment: selSegName ?? '', departments: [], looseRoles: [], roleCount: 0 }];
      }
    }
    return applyOrder(selSegId, list, (dv) => dv.id);
  }, [selSegment, pendingMoves, applyOrder, selSegId, selSegName]);

  const selDivision = selDivId ? displayDivisions.find((d) => d.id === selDivId) ?? null : null;

  // Teams (departments) of the selected division + the synthetic "Direct to
  // division" pseudo-team, with staged moves applied.
  const teams = useMemo(() => {
    if (!selDivision) return [] as { id: string; name: string; roles: RoleLite[] }[];
    let list = selDivision.departments
      .filter((dp) => { const r = pendingMoves.get(dp.id); return !(r && r.parent !== selDivId); })
      .map((dp) => ({ id: dp.id, name: dp.name, roles: dp.roles }));
    for (const [id, rec] of pendingMoves) {
      // any box staged to move UNDER this focused division shows as one of its teams
      if (rec.parent === selDivId && !list.some((t) => t.id === id)) {
        list = [...list, { id, name: rec.name, roles: [] }];
      }
    }
    if (selDivId) list = applyOrder(selDivId, list, (t) => t.id);
    if (selDivision.looseRoles.length > 0) list.push({ id: LOOSE, name: 'Direct to division', roles: selDivision.looseRoles });
    return list;
  }, [selDivision, pendingMoves, applyOrder, selDivId]);

  const selTeam = selDeptId ? teams.find((t) => t.id === selDeptId) ?? null : null;
  const roles = selTeam?.roles ?? [];

  // ── Click handlers ──────────────────────────────────────────────────────────
  const hexOf = (segName: string | null) => (segName ? DOMAIN_HEX[segName] ?? '#94a3b8' : undefined);

  function onCompanyClick() {
    if (companyOpen) { setCompanyOpen(false); setSelSegName(null); setSelDivId(null); setSelDeptId(null); closeMetrics(); }
    else setCompanyOpen(true);
  }
  function onSegmentClick(name: string) {
    const next = selSegName === name ? null : name;
    setSelSegName(next); setSelDivId(null); setSelDeptId(null);
    if (next) openMetrics('domain', name, hexOf(name)); else closeMetrics();
  }
  function onDivisionClick(id: string) {
    const next = selDivId === id ? null : id;
    setSelDivId(next); setSelDeptId(null);
    if (next) openMetrics('division', id, hexOf(selSegName));
    else if (selSegName) openMetrics('domain', selSegName, hexOf(selSegName));
  }
  function onDeptClick(id: string) {
    const next = selDeptId === id ? null : id;
    setSelDeptId(next);
    if (next && next !== LOOSE) openMetrics('department', id, hexOf(selSegName));
    else if (selDivId) openMetrics('division', selDivId, hexOf(selSegName));
  }

  const crumbClear = useCallback(() => { setSelSegName(null); setSelDivId(null); setSelDeptId(null); closeMetrics(); }, []); // eslint-disable-line
  const crumbToSegment = () => { setSelDivId(null); setSelDeptId(null); if (selSegName) openMetrics('domain', selSegName, hexOf(selSegName)); };
  const crumbToDivision = () => { setSelDeptId(null); if (selDivId) openMetrics('division', selDivId, hexOf(selSegName)); };

  // ── Build nodes and edges (from the display arrays) ──────────────────────────
  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];
    const LINE = '#9ca3af';
    const accent = selSegName ? (DOMAIN_HEX[selSegName] ?? LINE) : LINE;

    const companyFs: NodeFocusState = companyOpen ? 'expanded' : 'neutral';
    ns.push({ id: 'company', type: 'orgCompany', position: { x: -MAP_CARD_W / 2, y: 0 }, data: { name: data.company.name, focusState: companyFs } satisfies OrgCompanyData, draggable: false, selectable: false });
    if (!companyOpen) return { nodes: ns, edges: es };

    const segTop = MAP_CARD_H + 40;
    const segPos = gridPositions(displaySegments.length, 0, segTop);
    let divCenterX = 0;
    displaySegments.forEach((seg, i) => {
      const id = `seg:${seg.name}`;
      const isSel = selSegName === seg.name;
      const fs: NodeFocusState = !selSegName ? 'neutral' : isSel ? 'expanded' : 'dimmed';
      ns.push({ id, type: 'orgSegment', position: segPos[i], data: { name: seg.name, divisionCount: seg.divisions.length, focusState: fs, pieceIndex: i } satisfies OrgSegmentData, draggable: false });
      es.push({ id: `e:company->${id}`, source: 'company', target: id, sourceHandle: 'b', targetHandle: 't', style: { stroke: isSel ? accent : LINE, strokeWidth: isSel ? 2 : 1.25, strokeOpacity: isSel ? 0.95 : (selSegName ? 0.2 : 0.55) } });
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
      ns.push({ id, type: 'orgDivision', position: divPos[i], data: { name: div.name, segment: selSegment.name, teamCount: div.departments.length + (div.looseRoles.length > 0 ? 1 : 0), roleCount: div.roleCount, focusState: fs, pieceIndex: i } satisfies OrgDivisionData, draggable: false });
      es.push({ id: `e:seg->${id}`, source: `seg:${selSegment.name}`, target: id, sourceHandle: 'b', targetHandle: 't', style: { stroke: isSel ? accent : LINE, strokeWidth: isSel ? 2 : 1.25, strokeOpacity: isSel ? 0.95 : (selDivId ? 0.18 : 0.6) } });
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
      ns.push({ id, type: 'orgDept', position: deptPos[i], data: { name: t.name, segment: selSegName ?? '', roleCount: t.roles.length, focusState: fs, pieceIndex: i } satisfies OrgDeptData, draggable: false });
      es.push({ id: `e:div->${id}`, source: `div:${selDivision.id}`, target: id, sourceHandle: 'b', targetHandle: 't', style: { stroke: isSel ? accent : LINE, strokeWidth: isSel ? 2 : 1.25, strokeOpacity: isSel ? 0.95 : (selDeptId ? 0.18 : 0.6) } });
      if (isSel) roleCenterX = deptPos[i].x + MAP_CARD_W / 2;
    });

    if (!selTeam) return { nodes: ns, edges: es };
    const roleTop = deptTop + gridHeight(teams.length) + ROW_GAP_Y;
    const rolePos = gridPositions(roles.length, roleCenterX, roleTop);
    roles.forEach((r, i) => {
      const id = `role:${r.id}`;
      ns.push({ id, type: 'orgRole', position: rolePos[i], data: { name: r.name, focusState: 'neutral', pieceIndex: i } satisfies OrgRoleData, draggable: false });
      es.push({ id: `e:dept->${id}`, source: `dept:${selTeam.id}`, target: id, sourceHandle: 'b', targetHandle: 't', style: { stroke: accent, strokeWidth: 1.25, strokeOpacity: 0.5 } });
    });

    return { nodes: ns, edges: es };
  }, [data.company.name, displaySegments, companyOpen, selSegName, selSegment, selDivId, displayDivisions, selDivision, teams, selDeptId, selTeam, roles]);

  // ── Edit machinery (ported from MapCanvas) ───────────────────────────────────
  const currentParentRaw = useCallback((node: Node): string | null => {
    switch (node.type) {
      case 'orgDivision': return segmentIdByName.get((node.data as OrgDivisionData).segment) ?? null;
      case 'orgDept': return selDivId;
      default: return null; // segment (top-level) / company / role
    }
  }, [segmentIdByName, selDivId]);

  const isVisibleDescendant = useCallback((targetRaw: string, draggedRaw: string): boolean => {
    const divIds = selSegment ? displayDivisions.map((d) => d.id) : [];
    const teamIds = teams.map((t) => t.id);
    if (selSegId && draggedRaw === selSegId && (divIds.includes(targetRaw) || teamIds.includes(targetRaw))) return true;
    if (draggedRaw === selDivId && teamIds.includes(targetRaw)) return true;
    return false;
  }, [selSegment, displayDivisions, teams, selSegId, selDivId]);

  const nodeName = (n: Node): string => ((n.data as { name?: string }).name ?? '');
  const arraysEqual = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const nodeById = useMemo(() => { const m = new Map<string, Node>(); for (const n of nodes) m.set(n.id, n); return m; }, [nodes]);
  const rowOrder = useCallback((parent: string, type: string): string[] =>
    nodes.filter((n) => n.type === type && currentParentRaw(n) === parent)
      .sort((a, b) => ((a.data as { pieceIndex?: number }).pieceIndex ?? 0) - ((b.data as { pieceIndex?: number }).pieceIndex ?? 0))
      .map((n) => rawNodeId(n)).filter((x): x is string => !!x),
  [nodes, currentParentRaw, rawNodeId]);

  const cardAtPoint = (x: number, y: number): { canvasId: string; type: string } | null => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('.react-flow__node') as HTMLElement | null;
    if (!el) return null;
    const canvasId = el.getAttribute('data-id'); if (!canvasId) return null;
    const type = [...el.classList].find((c) => c.startsWith('react-flow__node-'))?.slice('react-flow__node-'.length) ?? '';
    return { canvasId, type };
  };

  const hoverDrillRef = useRef<{ id: string | null; timer: number | null }>({ id: null, timer: null });
  const clearHoverDrill = useCallback(() => {
    if (hoverDrillRef.current.timer) window.clearTimeout(hoverDrillRef.current.timer);
    hoverDrillRef.current = { id: null, timer: null };
  }, []);
  const drillByCanvasId = useCallback((canvasId: string, type: string) => {
    if (type === 'orgSegment') { const n = canvasId.slice(4); if (selSegName !== n) onSegmentClick(n); }
    else if (type === 'orgDivision') { const id = canvasId.slice(4); if (selDivId !== id) onDivisionClick(id); }
    else if (type === 'orgDept') { const id = canvasId.slice(5); if (selDeptId !== id) onDeptClick(id); }
  }, [selSegName, selDivId, selDeptId]); // eslint-disable-line react-hooks/exhaustive-deps
  const scheduleHoverDrill = useCallback((canvasId: string | null, type: string | null) => {
    if (!canvasId || !type || !['orgSegment', 'orgDivision', 'orgDept'].includes(type)) { clearHoverDrill(); return; }
    if (hoverDrillRef.current.id === canvasId) return;
    if (hoverDrillRef.current.timer) window.clearTimeout(hoverDrillRef.current.timer);
    hoverDrillRef.current = { id: canvasId, timer: window.setTimeout(() => drillByCanvasId(canvasId, type), HOVER_DRILL_MS) };
  }, [clearHoverDrill, drillByCanvasId]);

  const nodeScreenRect = useCallback((n: Node) => {
    const p = rf.flowToScreenPosition(n.position);
    const z = rf.getZoom();
    return { x: p.x, y: p.y, w: MAP_CARD_W * z, h: MAP_CARD_H * z };
  }, [rf]);

  const gapRef = useRef<{ parent: string; index: number; type: string } | null>(null);
  const ROW_TYPES = useMemo(() => ['orgSegment', 'orgDivision', 'orgDept'], []);
  const computeGap = useCallback((d: OrgDragState): { parent: string; index: number; type: string } | null => {
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
    if (!parent || parent === d.rawId) return null;
    best.rects.sort((a, b) => a.r.x - b.r.x);
    const index = best.rects.filter((o) => o.r.x + o.r.w / 2 < d.px).length;
    return { parent, index, type: best.type };
  }, [nodes, ROW_TYPES, nodeScreenRect, nodeById, currentParentRaw]);

  const computeNest = useCallback((d: OrgDragState): string | null => {
    for (const n of nodes) {
      if (n.id === d.canvasId) continue;
      if (!ORG_TYPE_LEVEL[n.type ?? '']) continue;
      const r = nodeScreenRect(n);
      if (d.px >= r.x && d.px <= r.x + r.w && d.py >= r.y && d.py <= r.y + r.h) {
        const frac = (d.px - r.x) / r.w;
        if (frac <= 0.22 || frac >= 0.78) return null;
        const targetRaw = rawNodeId(n);
        if (!targetRaw || targetRaw === d.originParent || isVisibleDescendant(targetRaw, d.rawId)) return null;
        return n.id;
      }
    }
    return null;
  }, [nodes, nodeScreenRect, rawNodeId, isVisibleDescendant]);

  const containerAtCursor = useCallback((d: OrgDragState): { canvasId: string; type: string } | null => {
    for (const n of nodes) {
      if (n.id === d.canvasId) continue;
      if (!['orgSegment', 'orgDivision', 'orgDept'].includes(n.type ?? '')) continue;
      const r = nodeScreenRect(n);
      if (d.px >= r.x && d.px <= r.x + r.w && d.py >= r.y && d.py <= r.y + r.h) return { canvasId: n.id, type: n.type ?? '' };
    }
    return null;
  }, [nodes, nodeScreenRect]);

  const commitDrop = useCallback(() => {
    const d = dragRef.current; const g = gapRef.current; const nestId = nestRef.current;
    dragRef.current = null; gapRef.current = null; nestRef.current = null;
    clearHoverDrill(); setDrag(null); setGap(null); setNestTargetId(null);
    if (!d || !d.started) {
      if (d) {
        const now = Date.now();
        const last = lastClickRef.current;
        if (last && last.id === d.canvasId && now - last.time < 300) {
          if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null; lastClickRef.current = null;
          const node = nodeById.get(d.canvasId);
          if (node) { const r = nodeScreenRect(node); setRename({ rawId: d.rawId, value: pendingRenames.get(d.rawId) ?? d.name, x: r.x, y: r.y, w: r.w, h: r.h, cat: d.cat }); }
        } else {
          lastClickRef.current = { id: d.canvasId, time: now };
          if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
          clickTimerRef.current = window.setTimeout(() => { clickTimerRef.current = null; lastClickRef.current = null; drillByCanvasId(d.canvasId, d.type); }, 280);
        }
      }
      return;
    }

    // 0) NEST — dropped on a box's centre → become its child (one level deeper).
    if (nestId) {
      const tgt = nodeById.get(nestId);
      const targetRaw = tgt ? rawNodeId(tgt) : null;
      const targetLevel = ORG_TYPE_LEVEL[tgt?.type ?? ''] ?? 0;
      if (targetRaw && targetLevel) {
        const sameLevel = targetLevel + 1 === d.level;
        setPendingMoves((m) => { const next = new Map(m); next.set(d.rawId, { parent: targetRaw, sameLevel, level: d.level, name: d.name, cat: d.cat }); return next; });
        setPendingOrder((m) => { if (!m.size) return m; const next = new Map(m); for (const [p, ids] of next) { const f = ids.filter((id) => id !== d.rawId); if (f.length !== ids.length) next.set(p, f); } return next; });
        flash('ok', sameLevel ? 'Staged move — children follow.' : 'Staged — nested inside.');
        if (tgt) drillByCanvasId(nestId, tgt.type ?? '');
      }
      return;
    }

    // 1) Dropped within a row → place beside, at that index.
    if (g) {
      if (g.parent !== d.originParent && isVisibleDescendant(g.parent, d.rawId)) { flash('err', "Can't drop a box inside its own branch."); return; }
      const ids = rowOrder(g.parent, g.type).filter((id) => id !== d.rawId);
      ids.splice(Math.min(g.index, ids.length), 0, d.rawId);
      if (g.parent === d.originParent) {
        setPendingOrder((m) => { const next = new Map(m); if (arraysEqual(ids, d.originOrder)) next.delete(g.parent); else next.set(g.parent, ids); return next; });
      } else {
        const sameLevel = (ORG_TYPE_LEVEL[g.type] ?? 0) === d.level;
        setPendingMoves((m) => { const next = new Map(m); next.set(d.rawId, { parent: g.parent, sameLevel, level: d.level, name: d.name, cat: d.cat }); return next; });
        setPendingOrder((m) => { const next = new Map(m); next.set(g.parent, ids); return next; });
        flash('ok', sameLevel ? 'Staged move — placed among siblings.' : 'Staged — placed inside (re-leveled).');
      }
      return;
    }
  }, [clearHoverDrill, rowOrder, isVisibleDescendant, nodeById, rawNodeId, flash, drillByCanvasId, nodeScreenRect, pendingRenames]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current; if (!d) return;
      const moved = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      const next: OrgDragState = { ...d, px: e.clientX, py: e.clientY, started: d.started || moved >= 4 };
      dragRef.current = next; setDrag(next);
      if (!next.started) return;
      e.preventDefault();
      const hc = containerAtCursor(next);
      scheduleHoverDrill(hc?.canvasId ?? null, hc?.type ?? null);
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

  const onStagePointerDown = useCallback((e: ReactPointerEvent) => {
    if (!editMode || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('input')) return;
    const hit = cardAtPoint(e.clientX, e.clientY);
    if (!hit) {
      let lastX = e.clientX, lastY = e.clientY;
      const onMove = (ev: PointerEvent) => {
        const vp = rf.getViewport();
        rf.setViewport({ x: vp.x + (ev.clientX - lastX), y: vp.y + (ev.clientY - lastY), zoom: vp.zoom });
        lastX = ev.clientX; lastY = ev.clientY;
      };
      const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      return;
    }
    if (!DRAGGABLE_TYPES.has(hit.type)) return;
    const node = nodeById.get(hit.canvasId);
    const rawId = node ? rawNodeId(node) : null;
    if (!node || !rawId || rawId === LOOSE || rawId === '__unassigned') return; // synthetic rows aren't movable
    const el = (e.target as HTMLElement).closest('.react-flow__node') as HTMLElement;
    const r = el.getBoundingClientRect();
    const origin = currentParentRaw(node);
    dragRef.current = {
      canvasId: hit.canvasId, rawId, type: hit.type, level: ORG_TYPE_LEVEL[hit.type] ?? 0,
      name: nodeName(node), cat: (node.data as { segment?: string; name?: string }).segment ?? (hit.type === 'orgSegment' ? (node.data as { name?: string }).name ?? '' : selSegName ?? ''),
      originParent: origin, originOrder: origin ? rowOrder(origin, hit.type) : [],
      grabDX: e.clientX - r.x, grabDY: e.clientY - r.y, cardW: r.width, cardH: r.height,
      startX: e.clientX, startY: e.clientY, px: e.clientX, py: e.clientY, started: false,
    };
    setDrag(dragRef.current);
  }, [editMode, DRAGGABLE_TYPES, nodeById, rawNodeId, currentParentRaw, rowOrder, selSegName, rf]);

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
      onSaved();
    } catch (e) {
      const msg = (e as Error)?.message;
      flash('err', msg && !/HTTP/.test(msg) ? msg : 'Save failed — your changes are kept.');
    } finally { setSaving(false); }
  }, [companyId, dirty, saving, pendingMoves, pendingOrder, pendingRenames, onSaved, flash]);

  const onRevert = useCallback(() => {
    setPendingMoves(new Map()); setPendingOrder(new Map()); setPendingRenames(new Map());
    setRename(null);
    flash('ok', 'Reverted.');
  }, [flash]);

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

  // displayNodes — lift the dragged card, open the gap, apply staged flags + names.
  const displayNodes = useMemo<Node[]>(() => {
    if (!editMode) return nodes;
    const liftId = drag?.started ? drag.canvasId : null;
    let result = liftId ? nodes.filter((n) => n.id !== liftId) : nodes;
    if (gap) {
      const rowNodes = result.filter((n) => n.type === gap.type).sort((a, b) => a.position.x - b.position.x);
      const shiftIds = new Set(rowNodes.slice(gap.index).map((n) => n.id));
      if (shiftIds.size) result = result.map((n) => (shiftIds.has(n.id) ? { ...n, position: { x: n.position.x + MAP_CARD_W + 12, y: n.position.y } } : n));
    }
    return result.map((n) => {
      const draggable = DRAGGABLE_TYPES.has(n.type ?? '');
      const raw = rawNodeId(n);
      const renamed = raw != null ? pendingRenames.get(raw) : undefined;
      const staged = (raw != null && pendingMoves.has(raw)) || renamed !== undefined;
      const nestTarget = n.id === nestTargetId;
      if (!draggable && !staged && !nestTarget) return n;
      const data: Record<string, unknown> = { ...n.data, editable: draggable, staged, dropTarget: nestTarget };
      if (renamed !== undefined) data.name = renamed;
      return { ...n, data };
    });
  }, [nodes, editMode, drag, gap, nestTargetId, DRAGGABLE_TYPES, rawNodeId, pendingMoves, pendingRenames]);

  const displayEdges = useMemo<Edge[]>(() => {
    const liftId = drag?.started ? drag.canvasId : null;
    return liftId ? edges.filter((e) => e.source !== liftId && e.target !== liftId) : edges;
  }, [edges, drag]);
  const flowNodes = displayNodes;

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
    void rf.fitView({ duration: 0, padding: 0.08, maxZoom: 0.95 }).then((applied) => {
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

  useEffect(() => { fitTopView(); }, [companyOpen]); // eslint-disable-line
  useEffect(() => {
    if (selSegName && selSegment) fitNodes([`seg:${selSegName}`, ...displayDivisions.map((d) => `div:${d.id}`)]);
    else if (companyOpen) fitTopView();
  }, [selSegName]); // eslint-disable-line
  useEffect(() => {
    if (selDivId && selDivision) fitNodes([`div:${selDivId}`, ...teams.map((t) => `dept:${t.id}`)]);
    else if (selSegName) moveCameraToNode(`seg:${selSegName}`, 1.2);
  }, [selDivId]); // eslint-disable-line
  useEffect(() => {
    if (selDeptId && selTeam) fitNodes([`dept:${selDeptId}`, ...roles.map((r) => `role:${r.id}`)]);
    else if (selDivId) moveCameraToNode(`div:${selDivId}`, 0.8);
  }, [selDeptId]); // eslint-disable-line

  // ── Node click handler (drill / role nav) ────────────────────────────────────
  const onNodeClick: NodeMouseHandler = (_e, node) => {
    if (node.type === 'orgCompany') onCompanyClick();
    else if (node.type === 'orgSegment') onSegmentClick(node.id.replace(/^seg:/, ''));
    else if (node.type === 'orgDivision') onDivisionClick(node.id.replace(/^div:/, ''));
    else if (node.type === 'orgDept') onDeptClick(node.id.replace(/^dept:/, ''));
    else if (node.type === 'orgRole') navigate(`/organization?role=${encodeURIComponent(node.id.replace(/^role:/, ''))}`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex' }}>
      {breadcrumbSlot && createPortal(
        selSegName ? (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', whiteSpace: 'nowrap' }}>
            <button onClick={crumbClear} className="focus-crumb-ancestor" style={CRUMB}>{sentenceCase(data.company.name)}</button>
            <span style={CRUMB_SEP}>›</span>
            {!selDivision
              ? <span className="focus-crumb-active" style={CRUMB}>{sentenceCase(selSegName)}</span>
              : <button onClick={crumbToSegment} className="focus-crumb-ancestor" style={CRUMB}>{sentenceCase(selSegName)}</button>}
            {selDivision && (
              <>
                <span style={CRUMB_SEP}>›</span>
                {!selTeam
                  ? <span className="focus-crumb-active" style={CRUMB}>{sentenceCase(selDivision.name)}</span>
                  : <button onClick={crumbToDivision} className="focus-crumb-ancestor" style={CRUMB}>{sentenceCase(selDivision.name)}</button>}
              </>
            )}
            {selTeam && (<><span style={CRUMB_SEP}>›</span><span className="focus-crumb-active" style={CRUMB}>{sentenceCase(selTeam.name)}</span></>)}
            <button onClick={crumbClear} aria-label="Clear focus" style={{ marginLeft: 6, width: 18, height: 18, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#a3a3a3', background: 'transparent', border: '1px solid #eaeaea', cursor: 'pointer' }}>✕</button>
          </div>
        ) : (
          <span className="text-[11px] text-[#666666]">Click a segment to drill into divisions, teams and roles.</span>
        ),
        breadcrumbSlot
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
        {drag?.started && (
          <div style={{ position: 'fixed', left: drag.px - drag.grabDX, top: drag.py - drag.grabDY, width: drag.cardW, height: drag.cardH, zIndex: 50, pointerEvents: 'none', borderRadius: 10, background: '#ffffff', border: '1px solid #eaeaea', borderLeft: `3px solid ${DOMAIN_HEX[drag.cat] ?? '#64748b'}`, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', opacity: 0.95, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px', textAlign: 'center', fontSize: 11.5, fontWeight: 600, color: '#171717' }}>
            {sentenceCase(drag.name)}
          </div>
        )}

        {/* Inline rename editor */}
        {rename && (
          <input
            autoFocus
            value={rename.value}
            onChange={(e) => setRename((r) => (r ? { ...r, value: e.target.value } : r))}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commitRename(); else if (e.key === 'Escape') setRename(null); }}
            onBlur={commitRename}
            onFocus={(e) => e.currentTarget.select()}
            style={{ position: 'fixed', left: rename.x, top: rename.y, width: rename.w, height: rename.h, zIndex: 60, boxSizing: 'border-box', padding: '6px 8px', borderRadius: 10, border: `2px solid ${DOMAIN_HEX[rename.cat] ?? '#0d9488'}`, background: '#ffffff', fontSize: 11.5, fontWeight: 600, color: '#171717', textAlign: 'center', outline: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
          />
        )}

        {/* Edit toolbar */}
        <div className="absolute top-3 right-4 z-20 flex items-center gap-2">
          {editMode && (
            <span className="hidden md:inline-flex items-center rounded-full bg-white/90 backdrop-blur border border-[#eaeaea] px-2.5 py-1 text-[11px] text-[#525252] shadow-sm">
              {dirty ? `${pendingCount} unsaved change${pendingCount === 1 ? '' : 's'} — Save or Revert` : 'Drag to move • hold to drill • drop in a row to reorder • double-click to rename'}
            </span>
          )}
          {editMode && dirty && (
            <>
              <button type="button" onClick={onSave} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-colors duration-150 bg-[#0d9488] text-white hover:bg-[#0f766e] disabled:opacity-60">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={onRevert} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-colors duration-150 border border-[#eaeaea] bg-white/90 backdrop-blur text-[#525252] hover:text-[#171717] disabled:opacity-60">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 7" /></svg>
                Revert
              </button>
            </>
          )}
          <button type="button" onClick={onToggleEdit} aria-pressed={editMode} className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-colors duration-150 ' + (editMode ? (dirty ? 'border border-[#eaeaea] bg-white/90 backdrop-blur text-[#a3a3a3]' : 'bg-[#0d9488] text-white hover:bg-[#0f766e]') : 'border border-[#eaeaea] bg-white/90 backdrop-blur text-[#525252] hover:text-[#171717]')}>
            {editMode ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>Done</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>Edit</>
            )}
          </button>
        </div>

        {/* Move feedback banner */}
        {moveFlash && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 rounded-lg px-3.5 py-2 text-xs font-medium shadow-md backdrop-blur" style={moveFlash.kind === 'ok' ? { background: 'rgba(13,148,136,0.95)', color: '#fff' } : { background: 'rgba(190,18,60,0.95)', color: '#fff' }} role="status">
            {moveFlash.text}
          </div>
        )}
      </div>

      {base && (
        <MetricsSidebar dash={dash} loading={dashLoading} onDrill={onPanelDrill} accent={accentHex}
          onBack={ovStack.length ? onPanelBack : undefined} onClose={closeMetrics} onViewAll={setDrawerSection} />
      )}
      {drawerSection && (
        <MetricsDrawer section={drawerSection} contextTitle={dash?.title ?? ''} onClose={() => setDrawerSection(null)} onDrill={onPanelDrill} />
      )}
    </div>
  );
}

// ── Data wrapper + provider ──────────────────────────────────────────────────

export default function OrgMapCanvas({ breadcrumbSlot }: Props) {
  const { data, error, loading, refetch } = useApi<OrgData>('/explorer/org-table');

  if (loading && !data) {
    return <div className="h-full grid place-items-center"><div className="text-sm text-[#a3a3a3] animate-pulse">Loading organization…</div></div>;
  }
  if (error) {
    return <div className="h-full grid place-items-center"><div className="text-sm text-[#be123c]">{error}</div></div>;
  }
  if (!data) return null;

  return (
    <ReactFlowProvider>
      <OrgMapCanvasInner data={data} breadcrumbSlot={breadcrumbSlot} onSaved={refetch} />
    </ReactFlowProvider>
  );
}
