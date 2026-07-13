/**
 * Node components, data shapes and layout helpers for the Organization map
 * (OrgMapCanvas). Extracted verbatim from OrgMapCanvas.tsx — the org-table
 * payload types, the five card components (company / segment / division /
 * team / role), and the row-grid layout math.
 */
import { memo, type CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

import { MAP_CARD_W, MAP_CARD_H, sentenceCase, type EditAffordance } from '../nodes/MapNode';
import { EditBadges } from '../nodes/mapNodeShared';
import { AddNodeCard } from '../nodes/mapNodeCards';
import { DOMAIN_HEX, DOMAIN_BG, DOMAIN_BORDER, DOMAIN_TEXT, type NodeFocusState } from '../model';

// ── Org-table payload (same shapes as pages/OrgTable.tsx) ────────────────────

export type RoleLite = {
  id: string;
  name: string;
  roleLevel: string | null;
  roleFamily: string | null;
  valueStreamCount: number;
};
export type Dept = { id: string; name: string; roles: RoleLite[]; roleCount: number };
export type Division = {
  id: string;
  name: string;
  segment: string;
  departments: Dept[];
  looseRoles: RoleLite[];
  roleCount: number;
};
export type Segment = {
  id: string | null;
  name: string;
  divisions: Division[];
  divisionCount: number;
  roleCount: number;
};
export type OrgData = {
  company: { id: string; name: string };
  totals: Record<string, number>;
  segments: Segment[];
};

export const LOOSE = '__loose'; // sentinel "team" for roles reporting directly to a division

// ── Layout constants ─────────────────────────────────────────────────────────

export const GAP_X = 12; // horizontal gap between sibling cards
export const ROW_GAP_Y = 32; // vertical gap between a parent row and its child block

export const CRUMB: CSSProperties = { fontSize: 11, padding: '2px 7px' };
export const CRUMB_SEP: CSSProperties = { color: '#d4d4d4', margin: '0 2px', fontSize: 10 };

// Each draggable org node TYPE maps to its OrgUnit level (segment=1, division=2,
// department=3). Roles/company aren't levels (can't be a parent / not draggable).
export const ORG_TYPE_LEVEL: Record<string, number> = { orgSegment: 1, orgDivision: 2, orgDept: 3 };
export const HOVER_DRILL_MS = 800; // hold the cursor directly over a box this long mid-drag → it drills open

// ── Small shared bits (mirroring nodes/MapNode.tsx) ──────────────────────────

const CLAMP2: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

function focusClass(s: NodeFocusState | undefined): string {
  switch (s) {
    case 'dimmed':
      return 'node-dimmed';
    case 'focused':
      return 'node-focused';
    case 'expanded':
      return 'node-expanded';
    default:
      return 'node-neutral';
  }
}

// Edit-mode affordance (shared with MapNode.tsx): grab cursor + dashed outline
// when draggable; teal ring when it's the hovered nest target; amber dot when
// staged; hover-only +/− badges when add/remove callbacks are attached.
function editStyle(d: EditAffordance): CSSProperties {
  if (d.dropTarget)
    return {
      cursor: 'grabbing',
      outline: '2px solid #0d9488',
      outlineOffset: 2,
      boxShadow: '0 0 0 4px rgba(13,148,136,0.18), 0 4px 14px rgba(13,148,136,0.25)',
    };
  if (d.editable) return { cursor: 'grab', outline: '1.5px dashed #cbd5e1', outlineOffset: 2 };
  return {};
}
function StagedDot() {
  return (
    <div
      title="Unsaved change"
      style={{
        position: 'absolute',
        top: -5,
        right: -5,
        width: 11,
        height: 11,
        borderRadius: '50%',
        background: '#f59e0b',
        border: '2px solid #ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        zIndex: 2,
      }}
    />
  );
}

function VHandles() {
  return (
    <>
      <Handle
        id="t"
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: 'none' }}
        isConnectable={false}
      />
      <Handle
        id="b"
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: 'none' }}
        isConnectable={false}
      />
    </>
  );
}

const cardBase: CSSProperties = {
  width: MAP_CARD_W,
  height: MAP_CARD_H,
  boxSizing: 'border-box',
  overflow: 'visible', // edit badges straddle the edges; labels clamp themselves
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

export type OrgCompanyData = { name: string; focusState?: NodeFocusState };
export type OrgSegmentData = {
  name: string;
  divisionCount: number;
  focusState?: NodeFocusState;
  pieceIndex?: number;
} & EditAffordance;
export type OrgDivisionData = {
  name: string;
  segment: string;
  teamCount: number;
  roleCount: number;
  focusState?: NodeFocusState;
  pieceIndex?: number;
} & EditAffordance;
export type OrgDeptData = {
  name: string;
  segment: string;
  roleCount: number;
  focusState?: NodeFocusState;
  pieceIndex?: number;
} & EditAffordance;
// orgOnly (derived from NodeRole): no value-stream tasks — org structure only
// (why e.g. Executive Office roles never appear on the Value Streams map).
// Roles carry the edit affordance too: in edit mode they drag to re-home
// (Role.orgUnitId) or reorder (Role.sortOrder) — no +/× badges though.
export type OrgRoleData = {
  name: string;
  focusState?: NodeFocusState;
  pieceIndex?: number;
  orgOnly?: boolean;
} & EditAffordance;

const delayStyle = (i?: number) => (i != null ? { animationDelay: `${i * 40}ms` } : undefined);

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

const OrgSegmentNode = memo(function OrgSegmentNode({ data }: NodeProps) {
  const d = data as OrgSegmentData;
  const hex = DOMAIN_HEX[d.name] ?? '#94a3b8';
  const bg = DOMAIN_BG[d.name] ?? '#f8fafc';
  const border = DOMAIN_BORDER[d.name] ?? '#e2e8f0';
  const text = DOMAIN_TEXT[d.name] ?? '#475569';
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
        ...editStyle(d),
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: text,
          letterSpacing: '-0.011em',
          lineHeight: 1.25,
          ...CLAMP2,
        }}
      >
        {sentenceCase(d.name)}
      </div>
      {d.staged && <StagedDot />}
      <EditBadges d={d} />
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
        ...editStyle(d),
      }}
    >
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: '#171717',
          letterSpacing: '-0.011em',
          lineHeight: 1.3,
          ...CLAMP2,
        }}
      >
        {sentenceCase(d.name)}
      </div>
      {d.staged && <StagedDot />}
      <EditBadges d={d} />
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
      style={{
        ...cardBase,
        border: '1px solid #eaeaea',
        borderLeft: `3px solid ${hex}`,
        ...delayStyle(d.pieceIndex),
        ...editStyle(d),
      }}
    >
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: '#171717',
          letterSpacing: '-0.011em',
          lineHeight: 1.3,
          ...CLAMP2,
        }}
      >
        {sentenceCase(d.name)}
      </div>
      {d.staged && <StagedDot />}
      <EditBadges d={d} />
      <VHandles />
    </div>
  );
});

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
        ...editStyle(d),
      }}
    >
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: '#171717',
          letterSpacing: '-0.011em',
          lineHeight: 1.3,
          ...CLAMP2,
        }}
      >
        {sentenceCase(d.name)}
      </div>
      {d.orgOnly && (
        <div
          title="Organizational role with no value-stream tasks — it appears here but not on the Value Streams map."
          style={{
            marginTop: 3,
            fontSize: 8.5,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#737373',
          }}
        >
          Org-only
        </div>
      )}
      {d.staged && <StagedDot />}
      <VHandles />
    </div>
  );
});

export const orgNodeTypes = {
  orgCompany: OrgCompanyNode,
  orgSegment: OrgSegmentNode,
  orgDivision: OrgDivisionNode,
  orgDept: OrgDeptNode,
  orgRole: OrgRoleNode,
  addNode: AddNodeCard,
};

// ── Row layout helpers ───────────────────────────────────────────────────────

export function gridPositions(n: number, centerX: number, top: number): { x: number; y: number }[] {
  const totalW = n * MAP_CARD_W + Math.max(0, n - 1) * GAP_X;
  const left = centerX - totalW / 2;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) out.push({ x: left + i * (MAP_CARD_W + GAP_X), y: top });
  return out;
}
export function gridHeight(_n: number): number {
  return MAP_CARD_H;
}

// An in-progress custom pointer drag of one org card.
export type OrgDragState = {
  canvasId: string;
  rawId: string;
  type: string;
  level: number;
  name: string;
  cat: string;
  originParent: string | null;
  originOrder: string[];
  grabDX: number;
  grabDY: number;
  cardW: number;
  cardH: number;
  startX: number;
  startY: number;
  px: number;
  py: number;
  started: boolean;
};
export type MoveRec = {
  parent: string;
  sameLevel: boolean;
  level: number;
  name: string;
  cat: string;
};
