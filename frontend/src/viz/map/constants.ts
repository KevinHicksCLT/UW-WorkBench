/**
 * Shared constants, types, and pure helpers for the operating-model map
 * (MapCanvas and its extracted modules). Layout geometry, drag/drop config,
 * and small data helpers live here — no React, no side effects.
 */
import type { CSSProperties } from 'react';

import { MAP_CARD_W, MAP_CARD_H } from '../nodes/MapNode';
import type { DivisionSummary, FlowStep } from '../model';

// Right-side metrics sidebar — re-enabled so the map matches the list view
// (was gated off in defect backlog 02, D3.3, while the data was distrusted;
// the deliverable-chain rework restored confidence). Both fetch + render gate
// on this flag.
export const SHOW_METRICS_SIDEBAR: boolean = true;

// Camera never zooms a drill-fit below this — keeps card text legible even when the
// whole spine is too tall to fit (deep L5 leaf columns overflow below the fold,
// pannable, while the company root stays pinned at the top). Cards are 150×68.
export const READABLE_MIN_ZOOM = 0.5;

// Every card is the same size (MAP_CARD_W × MAP_CARD_H, from MapNode.tsx) so the
// whole map reads as one consistent grid. The per-level aliases below keep the
// layout math readable but all resolve to the same dimensions.
// Spacing matches the Organization map (OrgMapCanvas): siblings sit GAP_X = 12
// apart, and each child block drops ROW_GAP_Y = 32 below its parent row.
export const COMPANY_H = MAP_CARD_H;
export const DOMAIN_TOP_OFFSET = 32; // y offset from company bottom to the domain row
export const CORE_W = MAP_CARD_W;
export const CORE_H = MAP_CARD_H;
export const DIV_W = MAP_CARD_W;
export const DIV_H = MAP_CARD_H;
export const DIV_GAP_X = 12; // horizontal gap between divisions in the L2 row
export const COL_GAP_X = 12; // horizontal gap between column centers
export const DIV_TOP_OFFSET = 32; // y offset from domain bottom to first division top
export const VS_W = MAP_CARD_W;
export const VS_H = MAP_CARD_H;
export const VS_GAP_X = 12;
export const VS_TOP_OFFSET = 32; // gap between focused-division bottom and VS row top
export const STEP_W = MAP_CARD_W;
export const STEP_H = MAP_CARD_H;
export const STEP_GAP_X = 12; // horizontal gap between ordered L4 process steps (left→right row)
export const STEP_TOP_OFFSET = 32; // gap between focused-VS bottom and step row top
export const SUBSTEP_GAP_Y = 12; // vertical gap between ordered L5 sub-processes (top→bottom column)
export const SUBSTEP_TOP_OFFSET = 32; // vertical offset of the L5 column below its focused L4 step
export const LEAF_GAP_Y = 12; // vertical gap between ordered L5 (leaf) steps
export const LEAF_TOP_OFFSET = 32; // vertical offset of the leaf column below its focused sub-process

// Screen-y (px) the top of the map content is pinned to on fit — must clear
// the floating controls row (view pills + variant lens bar at top-3, ~38px
// tall) so the company card never renders underneath it.
export const MAP_TOP_PIN = 64;

// Compact map breadcrumb (defect backlog 02, D3.5) — the shared .focus-crumb-*
// chips render at 14px; the map path runs five levels deep, so override down
// to ~11px with tighter padding and separators.
export const CRUMB: CSSProperties = { fontSize: 11, padding: '2px 7px' };
export const CRUMB_SEP: CSSProperties = { color: '#d4d4d4', margin: '0 2px', fontSize: 10 };

// Segments (the column list), their left-to-right order, and the top-to-bottom
// division order within each column are DATA: the API returns divisions already
// ordered by Node.sortOrder (value-chain order), grouped by their parent segment
// node's name. Renaming or reordering a segment in the builder reflects here.
// eslint-disable-next-line sonarjs/redundant-type-aliases -- the domain name documents intent at every call site
export type Category = string;

export function catFor(div: DivisionSummary): Category {
  return div.higherCategory ?? 'Unassigned';
}
export function categoriesOf(divisions: DivisionSummary[]): Category[] {
  const seen: Category[] = [];
  for (const d of divisions) {
    const c = catFor(d);
    if (!seen.includes(c)) seen.push(c);
  }
  return seen;
}

// Each draggable map node TYPE maps to a fixed backend ProcessNode level (the
// locked taxonomy: 1 = domain, 2 = division / value stream, 3 = process area,
// 4 = sub-process, 5 = task). A drop re-levels the moved node to target.level+1;
// the deepest level (MAX_LEVEL) can never be a parent. The server is the authority
// on the depth cap — the client only blocks the obvious "drop under L5" case.
export const TYPE_LEVEL: Record<string, number> = {
  coreNode: 1,
  divisionNode: 2,
  valueStreamNode: 3,
  stepNode: 4,
  subStepNode: 5,
};
export const MAX_LEVEL = 5;

// Human labels for the process levels, in this map's vocabulary (used by the
// add/remove dialogs). Matches TYPE_LEVEL above.
export const LEVEL_LABEL: Record<number, string> = {
  1: 'domain',
  2: 'division',
  3: 'value stream',
  4: 'process step',
  5: 'sub-step',
};
export const HOVER_DRILL_MS = 800; // hold the cursor directly over a box this long mid-drag → it drills open

// An in-progress custom pointer drag of one process card.
export type DragState = {
  canvasId: string; // React Flow node id (vs:.. / step:.. / division id / core:..)
  rawId: string; // underlying ProcessNode id
  type: string; // node type (coreNode / divisionNode / …)
  level: number; // TYPE_LEVEL[type]
  name: string;
  cat: string; // domain category (for the ghost's accent)
  originParent: string | null; // raw parent id at grab time
  originOrder: string[]; // raw-id order of the origin row at grab time (for no-op reorder detection)
  grabDX: number;
  grabDY: number; // pointer offset within the card (screen px)
  cardW: number;
  cardH: number;
  startX: number;
  startY: number; // pointer-down position (screen px) — drag threshold origin
  px: number;
  py: number; // current pointer position (screen px)
  started: boolean; // passed the movement threshold → really dragging
};

// A staged move: target parent + whether the node keeps its level.
export type MoveRec = {
  parent: string;
  sameLevel: boolean;
  level: number;
  name: string;
  cat: string;
};

// The open insertion slot under the cursor mid-drag. `hover` marks the small
// spread opened by hovering a "+" badge (just enough room for the button),
// as opposed to the full card-width slot a drag opens.
export type GapState = { parent: string; index: number; type: string; hover?: boolean };

// Hover "+" spread: siblings after the badge move over by this much, growing
// the 12px gutter to 42px — the 26px badge sits centered with 8px breathing
// room on each side. (EditBadges positions the badge at the 42px gap's middle.)
export const PLUS_GAP_SPREAD = 30;

// Active double-click rename editor (positioned over the box, in screen coords).
export type RenameState = {
  rawId: string;
  value: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cat: string;
};

// A minimal FlowStep for an L4 node optimistically injected under a new parent
// (its real children/detail fill in on Save's refetch).
export function synthStep(id: string, name: string): FlowStep {
  return {
    id,
    step: 0,
    name,
    subSteps: [],
    inputs: null,
    outputs: null,
    upstream: null,
    downstream: null,
    roles: [],
    categories: [],
    primaryCategory: null,
    crossDomain: false,
    unowned: false,
  };
}

// ── Edit-mode drag/drop config ───────────────────────────────────────────────
// Only process nodes that have a real, on-canvas parent one level above are
// draggable. division (L2) is excluded: its parent (L1 domain) is keyed by
// category NAME on the map, not a draggable node id. leaf (L6) is display-only.
// For each draggable type, VALID_PARENT_TYPE names the node type a drop must
// land on (exactly one level up). The dashed-outline + ring affordance and the
// hit-test both key off this table.
// Every id-backed process level is draggable (L1 domain → L5 sub-process). The
// enterprise root + the vestigial L6 leaf stay fixed.
export const DRAGGABLE_TYPES = new Set([
  'coreNode',
  'divisionNode',
  'valueStreamNode',
  'stepNode',
  'subStepNode',
]);

export const ROW_TYPES = ['coreNode', 'divisionNode', 'valueStreamNode', 'stepNode', 'subStepNode'];
