/**
 * Node components, data shapes and layout helpers for the Product Model map
 * (ProductMapCanvas). Mirrors viz/org-map/orgNodes.tsx — the
 * /product-spine/table payload types, the six card components
 * (company / L1 segment / L2 LOB family / L3 product / L4 version /
 * L5 model component) and the row-grid layout math. Carries the same edit
 * system as the org/value-stream maps: drag to move/reorder (children follow),
 * double-click rename, hover +/× add/remove, staged Save/Revert.
 *
 * Level display names are user-editable (ProductLevelType) — cards always
 * caption from the payload's `levels`, never from hardcoded strings.
 */
import { memo, type CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

import {
  MAP_CARD_W,
  MAP_CARD_H,
  sentenceCase,
  focusClass,
  editStyle,
  StagedDot,
  EditBadges,
  type EditAffordance,
} from '../nodes/mapNodeShared';
import { AddNodeCard } from '../nodes/mapNodeCards';
import type { NodeFocusState } from '../model';
import { StatusPill, Chip, type PillTone } from '../../components/ui';

// ── /product-spine/table payload ─────────────────────────────────────────────

export type ProductLevel = { levelNumber: number; dbValue: string; name: string };

export type ProductNode = {
  id: string;
  name: string;
  levelNumber: number;
  description: string | null;
  status: string | null;
  sortOrder: number;
  attributes: unknown;
  /** Total descendant count per level number (e.g. products/versions under a segment). */
  rollup: Record<number, number>;
  children: ProductNode[];
};

export type ProductData = {
  company: { id: string; name: string };
  levels: ProductLevel[];
  totals: Record<number, number>;
  roots: ProductNode[];
};

// ── Level captions (ALWAYS from the payload — names are user-editable) ───────

export function levelName(levels: ProductLevel[], levelNumber: number): string {
  return levels.find((l) => l.levelNumber === levelNumber)?.name ?? `Level ${levelNumber}`;
}

/** Pluralize the final word of a level label ("LOB / Product Family" → "LOB / product families"). */
function pluralizeLabel(label: string): string {
  const words = label.split(' ');
  const last = words[words.length - 1];
  let plural: string;
  if (/[^aeiou]y$/i.test(last)) plural = `${last.slice(0, -1)}ies`;
  else if (/(s|x|z|ch|sh)$/i.test(last)) plural = `${last}es`;
  else plural = `${last}s`;
  words[words.length - 1] = plural;
  return words.join(' ');
}

/** "3 products" / "1 version / jurisdiction" — caption for a card's next-level child count. */
export function childCaption(count: number, singularLevelName: string): string {
  const label = singularLevelName.toLowerCase();
  return `${count} ${count === 1 ? label : pluralizeLabel(label)}`;
}

// ── Attribute readers (attributes is untyped JSON — narrow safely) ──────────

function attrRecord(attributes: unknown): Record<string, unknown> {
  return attributes && typeof attributes === 'object' && !Array.isArray(attributes)
    ? (attributes as Record<string, unknown>)
    : {};
}
export function attrString(attributes: unknown, key: string): string | null {
  const v = attrRecord(attributes)[key];
  return typeof v === 'string' && v.trim() ? v : null;
}
export function attrStringArray(attributes: unknown, key: string): string[] {
  const v = attrRecord(attributes)[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

// ── Segment accent palette (cycled by root index — product segments are
//    tenant data, so unlike the org map they can't be color-keyed by name) ────

export type SegmentPalette = { hex: string; bg: string; border: string; text: string };
const SEGMENT_PALETTE: SegmentPalette[] = [
  { hex: '#2563eb', bg: '#eef3ff', border: '#c3d7fb', text: '#1d4ed8' }, // royal blue
  { hex: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e' }, // teal
  { hex: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' }, // violet
  { hex: '#d97706', bg: '#fff7ed', border: '#fdd9a8', text: '#b45309' }, // amber
  { hex: '#db2777', bg: '#fdf2f8', border: '#fbcfe8', text: '#be185d' }, // rose
  { hex: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' }, // green
];
export function segmentPalette(index: number): SegmentPalette {
  const n = SEGMENT_PALETTE.length;
  return SEGMENT_PALETTE[((index % n) + n) % n];
}

// ── L4 version status → pill tone (Active | Bound | Renewal only | Runoff) ───

const STATUS_TONE: Record<string, PillTone> = {
  Active: 'green',
  Bound: 'blue',
  'Renewal only': 'amber',
  Runoff: 'slate',
};
export function statusTone(status: string): PillTone {
  return STATUS_TONE[status] ?? 'slate';
}

// ── Layout constants (identical to the org map) ──────────────────────────────

export const GAP_X = 12; // horizontal gap between sibling cards
export const ROW_GAP_Y = 32; // vertical gap between a parent row and its child block

// Each draggable product node TYPE maps to its ProductNode level. All five
// levels are real DB rows (unlike the org map's synthetic buckets).
export const PRODUCT_TYPE_LEVEL: Record<string, number> = {
  productSegment: 1,
  productLob: 2,
  productProduct: 3,
  productVersion: 4,
  productComponent: 5,
};
export const PRODUCT_MAX_LEVEL = 5;
export const HOVER_DRILL_MS = 800; // hold the cursor over a box this long mid-drag → drills open

// An in-progress custom pointer drag of one product card (mirrors OrgDragState).
export type ProductDragState = {
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
export type ProductMoveRec = {
  parent: string;
  sameLevel: boolean;
  level: number;
  name: string;
  cat: string;
};

export const CRUMB: CSSProperties = { fontSize: 11, padding: '2px 7px' };
export const CRUMB_SEP: CSSProperties = { color: '#d4d4d4', margin: '0 2px', fontSize: 10 };

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

// ── Small shared bits (mirroring orgNodes.tsx) ───────────────────────────────

const CLAMP1: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 1,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};
const CLAMP2: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

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
  gap: 3,
};

const captionStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 500,
  color: '#737373',
  lineHeight: 1.2,
  ...CLAMP1,
};

const delayStyle = (i?: number) => (i != null ? { animationDelay: `${i * 40}ms` } : undefined);

// ── Node data shapes ─────────────────────────────────────────────────────────

export type ProductCompanyData = {
  name: string;
  /** e.g. "3 segments" — from the L1 level caption. */
  childCaption: string;
  focusState?: NodeFocusState;
};
export type ProductSegmentData = {
  name: string;
  childCaption: string;
  paletteIndex: number;
  focusState?: NodeFocusState;
  pieceIndex?: number;
} & EditAffordance;
export type ProductLobData = {
  name: string;
  childCaption: string;
  paletteIndex: number;
  focusState?: NodeFocusState;
  pieceIndex?: number;
} & EditAffordance;
export type ProductProductData = {
  name: string;
  childCaption: string;
  paletteIndex: number;
  focusState?: NodeFocusState;
  pieceIndex?: number;
} & EditAffordance;
export type ProductVersionData = {
  name: string;
  status: string | null;
  jurisdiction: string | null;
  paletteIndex: number;
  focusState?: NodeFocusState;
  pieceIndex?: number;
} & EditAffordance;
export type ProductComponentData = {
  name: string;
  owner: string | null;
  formats: string[];
  paletteIndex: number;
  focusState?: NodeFocusState;
  pieceIndex?: number;
} & EditAffordance;

// ── Node components ──────────────────────────────────────────────────────────

const ProductCompanyNode = memo(function ProductCompanyNode({ data }: NodeProps) {
  const d = data as ProductCompanyData;
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
      <div style={{ ...captionStyle, color: '#a3a3a3' }}>{d.childCaption}</div>
      <VHandles />
    </div>
  );
});

const ProductSegmentNode = memo(function ProductSegmentNode({ data }: NodeProps) {
  const d = data as ProductSegmentData;
  const pal = segmentPalette(d.paletteIndex);
  return (
    <div
      className={`animate-piece-arrive ${focusClass(d.focusState)}`}
      style={{
        ...cardBase,
        background: pal.bg,
        border: `1.5px solid ${pal.border}`,
        borderTop: `3px solid ${pal.hex}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        ...delayStyle(d.pieceIndex),
        ...editStyle(d),
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: pal.text,
          letterSpacing: '-0.011em',
          lineHeight: 1.25,
          ...CLAMP2,
        }}
      >
        {sentenceCase(d.name)}
      </div>
      <div style={captionStyle}>{d.childCaption}</div>
      {d.staged && <StagedDot />}
      <EditBadges d={d} />
      <VHandles />
    </div>
  );
});

const ProductLobNode = memo(function ProductLobNode({ data }: NodeProps) {
  const d = data as ProductLobData;
  const pal = segmentPalette(d.paletteIndex);
  return (
    <div
      className={`animate-piece-arrive ${focusClass(d.focusState)}`}
      style={{
        ...cardBase,
        border: `1px solid ${pal.border}`,
        borderLeft: `3px solid ${pal.hex}`,
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
      <div style={captionStyle}>{d.childCaption}</div>
      {d.staged && <StagedDot />}
      <EditBadges d={d} />
      <VHandles />
    </div>
  );
});

const ProductProductNode = memo(function ProductProductNode({ data }: NodeProps) {
  const d = data as ProductProductData;
  const pal = segmentPalette(d.paletteIndex);
  return (
    <div
      className={`animate-piece-arrive ${focusClass(d.focusState)}`}
      style={{
        ...cardBase,
        border: '1px solid #eaeaea',
        borderLeft: `3px solid ${pal.hex}`,
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
      <div style={captionStyle}>{d.childCaption}</div>
      {d.staged && <StagedDot />}
      <EditBadges d={d} />
      <VHandles />
    </div>
  );
});

const ProductVersionNode = memo(function ProductVersionNode({ data }: NodeProps) {
  const d = data as ProductVersionData;
  const pal = segmentPalette(d.paletteIndex);
  return (
    <div
      className={`animate-piece-arrive ${focusClass(d.focusState)}`}
      style={{
        ...cardBase,
        border: '1px solid #eaeaea',
        borderLeft: `3px solid ${pal.hex}`,
        ...delayStyle(d.pieceIndex),
        ...editStyle(d),
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#171717',
          letterSpacing: '-0.011em',
          lineHeight: 1.3,
          ...CLAMP1,
        }}
      >
        {sentenceCase(d.name)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
        {d.status && (
          <StatusPill
            tone={statusTone(d.status)}
            style={{ fontSize: 8.5, lineHeight: '12px', padding: '0 6px', whiteSpace: 'nowrap' }}
          >
            {d.status}
          </StatusPill>
        )}
        {d.jurisdiction && (
          <span style={{ fontSize: 9, fontWeight: 500, color: '#737373', ...CLAMP1 }}>
            {d.jurisdiction}
          </span>
        )}
      </div>
      {d.staged && <StagedDot />}
      <EditBadges d={d} />
      <VHandles />
    </div>
  );
});

const MAX_FORMAT_CHIPS = 2;

const ProductComponentNode = memo(function ProductComponentNode({ data }: NodeProps) {
  const d = data as ProductComponentData;
  const pal = segmentPalette(d.paletteIndex);
  const shown = d.formats.slice(0, MAX_FORMAT_CHIPS);
  const extra = d.formats.length - shown.length;
  return (
    <div
      className={`animate-piece-arrive ${focusClass(d.focusState)}`}
      style={{
        ...cardBase,
        cursor: 'pointer',
        border: '1px solid #eaeaea',
        borderLeft: `3px solid ${pal.hex}`,
        ...delayStyle(d.pieceIndex),
        ...editStyle(d),
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          color: '#171717',
          letterSpacing: '-0.011em',
          lineHeight: 1.25,
          ...CLAMP1,
        }}
      >
        {sentenceCase(d.name)}
      </div>
      {d.owner && (
        <div style={{ fontSize: 9, fontWeight: 500, color: '#737373', ...CLAMP1 }}>{d.owner}</div>
      )}
      {shown.length > 0 && (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 3, maxWidth: '100%' }}
          title={d.formats.join(', ')}
        >
          {shown.map((f) => (
            <Chip key={f} style={{ fontSize: 8, lineHeight: '12px', padding: '0 4px' }}>
              {f}
            </Chip>
          ))}
          {extra > 0 && (
            <span style={{ fontSize: 8.5, fontWeight: 500, color: '#a3a3a3' }}>+{extra}</span>
          )}
        </div>
      )}
      {d.staged && <StagedDot />}
      <EditBadges d={d} />
      <VHandles />
    </div>
  );
});

export const productNodeTypes = {
  productCompany: ProductCompanyNode,
  productSegment: ProductSegmentNode,
  productLob: ProductLobNode,
  productProduct: ProductProductNode,
  productVersion: ProductVersionNode,
  productComponent: ProductComponentNode,
  addNode: AddNodeCard,
};
