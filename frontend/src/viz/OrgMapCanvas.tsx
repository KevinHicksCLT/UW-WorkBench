// OrgMapCanvas.tsx — Interactive organization map with spatial drill-down.
// Company → Segment → Division → Team (department) → Role, each level rendering
// as a centered row under its selected parent — the same literal drill-down map
// as the Value Streams view (MapCanvas.tsx): same 150×68 cards, focus states,
// 11px breadcrumb, and top-pinned camera.
//
// Data comes from /explorer/org-table (the same payload the old box-grid used),
// so the ids stay the LEGACY ids the `?role=` deep link expects — clicking a
// role leaf navigates to /roles?role=<id>, which opens the existing role detail.

import { memo, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, ReactFlowProvider,
  useReactFlow, Handle, Position,
  type Node, type Edge, type NodeMouseHandler, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { MAP_CARD_W, MAP_CARD_H, sentenceCase } from './nodes/MapNode';
import { DOMAIN_HEX, DOMAIN_BG, DOMAIN_BORDER, DOMAIN_TEXT, type NodeFocusState } from './model';
import { useApi } from '../lib/useApi';
import { api } from '../lib/api';
import MetricsSidebar, { MetricsDrawer, type Dashboard, type MetricSection } from '../components/MetricsSidebar';

// ── Org-table payload (same shapes as pages/OrgTable.tsx) ────────────────────

type RoleLite = { id: string; name: string; roleLevel: string | null; roleFamily: string | null; peopleCount: number; valueStreamCount: number };
type Dept = { id: string; name: string; roles: RoleLite[]; roleCount: number; peopleCount: number };
type Division = { id: string; name: string; segment: string; departments: Dept[]; looseRoles: RoleLite[]; roleCount: number; peopleCount: number };
type Segment = { name: string; divisions: Division[]; divisionCount: number; roleCount: number; peopleCount: number };
type OrgData = { company: { id: string; name: string }; totals: Record<string, number>; segments: Segment[] };

const LOOSE = '__loose'; // sentinel "team" for roles reporting directly to a division

// ── Layout constants ─────────────────────────────────────────────────────────

const GAP_X      = 12;  // horizontal gap between sibling cards
const ROW_GAP_Y  = 32;  // vertical gap between a parent row and its child block
const WRAP_AT    = 8;   // children per visual row before wrapping into a grid
const WRAP_GAP_Y = 14;  // vertical gap between wrapped rows of one child block

// Compact map breadcrumb — same 11px override as the Value Streams map.
const CRUMB: CSSProperties     = { fontSize: 11, padding: '2px 7px' };
const CRUMB_SEP: CSSProperties = { color: '#d4d4d4', margin: '0 2px', fontSize: 10 };

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

// Hidden top/bottom handles — all org-map edges run parent-bottom → child-top.
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
  gap: 4,
};

function CountChip({ text }: { text: string }) {
  return (
    <span className="chip-soft" style={{ fontSize: 9, padding: '2px 6px', alignSelf: 'flex-start' }}>
      {text}
    </span>
  );
}

// ── Node components ──────────────────────────────────────────────────────────

type OrgCompanyData = { name: string; focusState?: NodeFocusState };
type OrgSegmentData = { name: string; divisionCount: number; focusState?: NodeFocusState; pieceIndex?: number };
type OrgDivisionData = { name: string; segment: string; teamCount: number; roleCount: number; focusState?: NodeFocusState; pieceIndex?: number };
type OrgDeptData = { name: string; roleCount: number; focusState?: NodeFocusState; pieceIndex?: number };
type OrgRoleData = { name: string; peopleCount: number; focusState?: NodeFocusState; pieceIndex?: number };

const delayStyle = (i?: number) => (i != null ? { animationDelay: `${i * 40}ms` } : undefined);

// Company root — dark card, same as the VS map's company node.
const OrgCompanyNode = memo(function OrgCompanyNode({ data }: NodeProps) {
  const d = data as OrgCompanyData;
  return (
    <div
      className={focusClass(d.focusState)}
      style={{
        ...cardBase,
        padding: '10px 12px',
        borderRadius: 12,
        background: '#171717',
        border: '1px solid #171717',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', lineHeight: 1.25, ...CLAMP2 }}>
        {sentenceCase(d.name)}
      </div>
      <VHandles />
    </div>
  );
});

// Segment — tinted header card (domain palette where the segment name matches).
const OrgSegmentNode = memo(function OrgSegmentNode({ data }: NodeProps) {
  const d = data as OrgSegmentData;
  const hex    = DOMAIN_HEX[d.name]    ?? '#94a3b8';
  const bg     = DOMAIN_BG[d.name]     ?? '#f8fafc';
  const border = DOMAIN_BORDER[d.name] ?? '#e2e8f0';
  const text   = DOMAIN_TEXT[d.name]   ?? '#475569';
  return (
    <div
      className={`animate-piece-arrive ${focusClass(d.focusState)}`}
      style={{
        ...cardBase,
        background: bg,
        border: `1.5px solid ${border}`,
        borderTop: `3px solid ${hex}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        ...delayStyle(d.pieceIndex),
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: text, letterSpacing: '-0.011em', lineHeight: 1.25, ...CLAMP2 }}>
        {sentenceCase(d.name)}
      </div>
      <CountChip text={`${d.divisionCount} division${d.divisionCount === 1 ? '' : 's'} ›`} />
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
      style={{
        ...cardBase,
        border: `1px solid ${border}`,
        borderLeft: `3px solid ${hex}`,
        ...delayStyle(d.pieceIndex),
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.3, ...CLAMP2 }}>
        {sentenceCase(d.name)}
      </div>
      <CountChip text={`${d.teamCount} team${d.teamCount === 1 ? '' : 's'} · ${d.roleCount} role${d.roleCount === 1 ? '' : 's'} ›`} />
      <VHandles />
    </div>
  );
});

const OrgDeptNode = memo(function OrgDeptNode({ data }: NodeProps) {
  const d = data as OrgDeptData;
  return (
    <div
      className={`animate-piece-arrive ${focusClass(d.focusState)}`}
      style={{
        ...cardBase,
        border: '1px solid #eaeaea',
        borderLeft: '3px solid #64748b',
        ...delayStyle(d.pieceIndex),
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.3, ...CLAMP2 }}>
        {sentenceCase(d.name)}
      </div>
      <CountChip text={`${d.roleCount} role${d.roleCount === 1 ? '' : 's'} ›`} />
      <VHandles />
    </div>
  );
});

// Role leaf — clicking navigates to the role detail (/roles?role=<id>).
const OrgRoleNode = memo(function OrgRoleNode({ data }: NodeProps) {
  const d = data as OrgRoleData;
  return (
    <div
      className={`animate-piece-arrive ${focusClass(d.focusState)}`}
      style={{
        ...cardBase,
        border: '1px solid #eaeaea',
        borderLeft: '3px solid #94a3b8',
        ...delayStyle(d.pieceIndex),
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.3, ...CLAMP2 }}>
        {sentenceCase(d.name)}
      </div>
      <CountChip text={`${d.peopleCount} ${d.peopleCount === 1 ? 'person' : 'people'} ›`} />
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

// ── Grid layout helpers ──────────────────────────────────────────────────────
// A child block wraps into rows of WRAP_AT cards; every visual row is centered
// on the parent's center-x so long role lists read as a compact grid, not a
// kilometer-wide strip.

function gridPositions(n: number, centerX: number, top: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i += WRAP_AT) {
    const count = Math.min(WRAP_AT, n - i);
    const totalW = count * MAP_CARD_W + (count - 1) * GAP_X;
    const left = centerX - totalW / 2;
    const rowY = top + (i / WRAP_AT) * (MAP_CARD_H + WRAP_GAP_Y);
    for (let j = 0; j < count; j++) out.push({ x: left + j * (MAP_CARD_W + GAP_X), y: rowY });
  }
  return out;
}

function gridHeight(n: number): number {
  const rows = Math.max(1, Math.ceil(n / WRAP_AT));
  return rows * MAP_CARD_H + (rows - 1) * WRAP_GAP_Y;
}

// ── Inner canvas ─────────────────────────────────────────────────────────────

type Props = { breadcrumbSlot?: HTMLElement | null };

function OrgMapCanvasInner({ data, breadcrumbSlot }: Props & { data: OrgData }) {
  const rf = useReactFlow();
  const navigate = useNavigate();

  // Drill state. The company starts open (segments visible), like the VS map.
  const [companyOpen, setCompanyOpen] = useState(true);
  const [selSegName, setSelSegName] = useState<string | null>(null);
  const [selDivId, setSelDivId] = useState<string | null>(null);
  const [selDeptId, setSelDeptId] = useState<string | null>(null); // LOOSE = direct-to-division roles

  // Right-hand metrics panel — the SAME MetricsSidebar (and dashboards) the org
  // LIST view opens, so both views stay in sync: drilling a segment/division/
  // team here shows exactly what clicking that row in the list shows. `base` =
  // the node clicked on the map; `ovStack` = in-panel drills (role → person).
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

  // Changing the focused entity makes the drawer's snapshot stale — close it.
  useEffect(() => { setDrawerSection(null); }, [target?.level, target?.id]);

  // Derived selection
  const segments = data.segments;
  const selSegment = selSegName ? segments.find((s) => s.name === selSegName) ?? null : null;
  const selDivision = selSegment && selDivId ? selSegment.divisions.find((d) => d.id === selDivId) ?? null : null;
  // Teams of the selected division, with the "Direct to division" pseudo-team
  // appended when loose roles exist (mirrors the old box-grid).
  const teams = useMemo(() => {
    if (!selDivision) return [] as { id: string; name: string; roles: RoleLite[] }[];
    const out = selDivision.departments.map((dp) => ({ id: dp.id, name: dp.name, roles: dp.roles }));
    if (selDivision.looseRoles.length > 0) out.push({ id: LOOSE, name: 'Direct to division', roles: selDivision.looseRoles });
    return out;
  }, [selDivision]);
  const selTeam = selDeptId ? teams.find((t) => t.id === selDeptId) ?? null : null;
  const roles = selTeam?.roles ?? [];

  // Click handlers — clicking the selected node again collapses back a level.
  // Each selection also opens the SAME metrics sidebar the list view opens for
  // that entity (deselecting steps the panel back to the parent level).
  const hexOf = (segName: string | null) => (segName ? DOMAIN_HEX[segName] ?? '#94a3b8' : undefined);

  function onCompanyClick() {
    if (companyOpen) {
      setCompanyOpen(false); setSelSegName(null); setSelDivId(null); setSelDeptId(null);
      closeMetrics();
    } else {
      setCompanyOpen(true);
    }
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
    // The "Direct to division" pseudo-team has no department entity — keep the
    // division's dashboard up for it.
    if (next && next !== LOOSE) openMetrics('department', id, hexOf(selSegName));
    else if (selDivId) openMetrics('division', selDivId, hexOf(selSegName));
  }

  // Breadcrumb jumps — keep the sidebar pointed at the level jumped to.
  const crumbClear = useCallback(() => { setSelSegName(null); setSelDivId(null); setSelDeptId(null); closeMetrics(); }, []); // eslint-disable-line
  const crumbToSegment = () => { setSelDivId(null); setSelDeptId(null); if (selSegName) openMetrics('domain', selSegName, hexOf(selSegName)); };
  const crumbToDivision = () => { setSelDeptId(null); if (selDivId) openMetrics('division', selDivId, hexOf(selSegName)); };

  // ── Build nodes and edges ──────────────────────────────────────────────────
  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];

    const LINE = '#9ca3af';
    const accent = selSegName ? (DOMAIN_HEX[selSegName] ?? LINE) : LINE;

    // Company root at world y=0, centered on x=0 (fitTopView relies on y=0 top).
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

    // Segment row, centered under the company.
    const segTop = MAP_CARD_H + 40;
    const segPos = gridPositions(segments.length, 0, segTop);
    let divCenterX = 0;
    segments.forEach((seg, i) => {
      const id = `seg:${seg.name}`;
      const isSel = selSegName === seg.name;
      const fs: NodeFocusState = !selSegName ? 'neutral' : isSel ? 'expanded' : 'dimmed';
      ns.push({
        id,
        type: 'orgSegment',
        position: segPos[i],
        data: { name: seg.name, divisionCount: seg.divisions.length, focusState: fs, pieceIndex: i } satisfies OrgSegmentData,
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
          strokeOpacity: isSel ? 0.95 : (selSegName ? 0.2 : 0.55),
        },
      });
      if (isSel) divCenterX = segPos[i].x + MAP_CARD_W / 2;
    });

    // Division block under the selected segment.
    if (!selSegment) return { nodes: ns, edges: es };
    const divTop = segTop + gridHeight(segments.length) + ROW_GAP_Y;
    const divPos = gridPositions(selSegment.divisions.length, divCenterX, divTop);
    let deptCenterX = divCenterX;
    selSegment.divisions.forEach((div, i) => {
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
          strokeOpacity: isSel ? 0.95 : (selDivId ? 0.18 : 0.6),
        },
      });
      if (isSel) deptCenterX = divPos[i].x + MAP_CARD_W / 2;
    });

    // Team (department) block under the selected division.
    if (!selDivision) return { nodes: ns, edges: es };
    const deptTop = divTop + gridHeight(selSegment.divisions.length) + ROW_GAP_Y;
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
        data: { name: t.name, roleCount: t.roles.length, focusState: fs, pieceIndex: i } satisfies OrgDeptData,
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
          strokeOpacity: isSel ? 0.95 : (selDeptId ? 0.18 : 0.6),
        },
      });
      if (isSel) roleCenterX = deptPos[i].x + MAP_CARD_W / 2;
    });

    // Role block under the selected team. Roles are leaves — click navigates.
    if (!selTeam) return { nodes: ns, edges: es };
    const roleTop = deptTop + gridHeight(teams.length) + ROW_GAP_Y;
    const rolePos = gridPositions(roles.length, roleCenterX, roleTop);
    roles.forEach((r, i) => {
      const id = `role:${r.id}`;
      ns.push({
        id,
        type: 'orgRole',
        position: rolePos[i],
        data: { name: r.name, peopleCount: r.peopleCount, focusState: 'neutral', pieceIndex: i } satisfies OrgRoleData,
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
  }, [data.company.name, segments, companyOpen, selSegName, selSegment, selDivId, selDivision, teams, selDeptId, selTeam, roles]);

  // ── Camera helpers (same patterns as MapCanvas) ────────────────────────────

  // Fit a specific set of nodes in frame, deferred past a frame + a tick so
  // freshly-added nodes are measured first.
  const fitNodes = useCallback((nodeIds: string[], padding = 0.28) => {
    requestAnimationFrame(() => setTimeout(() => {
      const present = nodeIds.filter((id) => rf.getNode(id) && rf.getNode(id)!.measured?.width);
      if (!present.length) return;
      rf.fitView({ nodes: present.map((id) => ({ id })), padding, duration: 460, maxZoom: 1 });
    }, 130));
  }, [rf]);

  // Fit the whole visible graph, then pin its top edge near the top of the
  // container. NB: in xyflow v12 fitView() is queued until nodes are measured
  // and returns a promise — read the viewport AFTER it resolves (never put a
  // fitView prop on <ReactFlow>, it would re-center over this pin).
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
      const w = node.measured?.width ?? MAP_CARD_W;
      const h = node.measured?.height ?? MAP_CARD_H;
      const cx = node.position.x + w / 2;
      const cy = node.position.y + h / 2 + yBias * 80;
      rf.setCenter(cx, cy, { zoom: 0.9, duration: 420 });
    }, 60);
  }, [rf]);

  // Camera: company open/close → fit the visible graph (pinned to the top).
  useEffect(() => {
    fitTopView();
  }, [companyOpen]); // eslint-disable-line

  // Camera: segment selected → frame it plus its division block; cleared → fit.
  useEffect(() => {
    if (selSegName && selSegment) {
      fitNodes([`seg:${selSegName}`, ...selSegment.divisions.map((d) => `div:${d.id}`)], 0.3);
    } else if (companyOpen) {
      fitTopView();
    }
  }, [selSegName]); // eslint-disable-line

  // Camera: division selected → frame it plus its team block; cleared → re-center segment.
  useEffect(() => {
    if (selDivId && selDivision) {
      fitNodes([`div:${selDivId}`, ...teams.map((t) => `dept:${t.id}`)], 0.3);
    } else if (selSegName) {
      moveCameraToNode(`seg:${selSegName}`, 1.2);
    }
  }, [selDivId]); // eslint-disable-line

  // Camera: team selected → frame it plus its role block; cleared → re-center division.
  useEffect(() => {
    if (selDeptId && selTeam) {
      fitNodes([`dept:${selDeptId}`, ...roles.map((r) => `role:${r.id}`)], 0.3);
    } else if (selDivId) {
      moveCameraToNode(`div:${selDivId}`, 0.8);
    }
  }, [selDeptId]); // eslint-disable-line

  // ── Node click handler ─────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = (_e, node) => {
    if (node.type === 'orgCompany') onCompanyClick();
    else if (node.type === 'orgSegment') onSegmentClick(node.id.replace(/^seg:/, ''));
    else if (node.type === 'orgDivision') onDivisionClick(node.id.replace(/^div:/, ''));
    else if (node.type === 'orgDept') onDeptClick(node.id.replace(/^dept:/, ''));
    else if (node.type === 'orgRole') {
      // Role leaf → the role's full-detail drawer, in place (Organization
      // overlays it on this map; same drawer the list opens for roles).
      navigate(`/roles?role=${encodeURIComponent(node.id.replace(/^role:/, ''))}`);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex' }}>

      {/* Breadcrumb — rendered into the page header via portal, like the VS map. */}
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
            {selTeam && (
              <>
                <span style={CRUMB_SEP}>›</span>
                <span className="focus-crumb-active" style={CRUMB}>{sentenceCase(selTeam.name)}</span>
              </>
            )}
            <button
              onClick={crumbClear}
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
            Click a segment to drill into divisions, teams and roles.
          </span>
        ),
        breadcrumbSlot
      )}

      {/* React Flow canvas. No `fitView` prop on purpose — see fitTopView. */}
      <div className="rf-stage rf-stage--map" style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={orgNodeTypes}
          onNodeClick={onNodeClick}
          nodesDraggable={false}
          nodesConnectable={false}
          minZoom={0.05}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e5e5e5" gap={20} size={1} />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>
      </div>

      {/* Right-hand metrics panel — identical to the org list view's. */}
      {base && (
        <MetricsSidebar dash={dash} loading={dashLoading} onDrill={onPanelDrill} startExpanded accent={accentHex}
          onBack={ovStack.length ? onPanelBack : undefined} onClose={closeMetrics} onViewAll={setDrawerSection} />
      )}

      {/* Comprehensive "view all" drawer — overlays the panel. */}
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
  const { data, error, loading } = useApi<OrgData>('/explorer/org-table');

  if (loading) {
    return (
      <div className="h-full grid place-items-center">
        <div className="text-sm text-[#a3a3a3] animate-pulse">Loading organization…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-full grid place-items-center">
        <div className="text-sm text-[#be123c]">{error}</div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <ReactFlowProvider>
      <OrgMapCanvasInner data={data} breadcrumbSlot={breadcrumbSlot} />
    </ReactFlowProvider>
  );
}
