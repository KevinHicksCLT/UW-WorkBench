/**
 * Edge components + pure edge factories for the v3 board. Per the wireframe
 * legend: GREEN edges are items that are correct and stay in their row (cell →
 * Normalize, Normalize → Greenfield); RED edges are relocations leaving their
 * row (and shared-service absorptions, WR-15, which keep their sky tint to
 * stay distinguishable inside their own lane).
 */
import {
  MarkerType,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import { ROW_H } from './cellGeometry';

export const EDGE_STAY = '#10b981'; // green — correct, stays in its row
export const EDGE_MOVE = '#dc2626'; // red — misplaced, needs to move
export const EDGE_SHARED = '#0284c7'; // sky — absorbed by a shared service (WR-15)
export const EDGE_CHAIN = '#cbd5e1'; // neutral — source A → source B flow hint

/**
 * Smooth bezier relocation arrow. The curve lives entirely in the lane between
 * the columns; the label is pinned to the empty horizontal gap just before the
 * target row (the path midpoint can land on a box, the row gap never does).
 */
export function RelocateEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.4,
  });
  const dir = targetY >= sourceY ? 1 : -1;
  const lx = (sourceX + targetX) / 2;
  const ly = targetY - dir * (ROW_H * 0.52);
  const d = data as { label?: string; color?: string } | undefined;
  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`,
            pointerEvents: 'none',
            color: d?.color ?? EDGE_MOVE,
          }}
          className="rounded bg-white/85 px-1 text-[12px] font-semibold whitespace-nowrap"
        >
          {d?.label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

// ── Pure edge factories (unit-testable) ─────────────────────────────────────

const arrow = (color: string, size = 15) => ({
  type: MarkerType.ArrowClosed,
  color,
  width: size,
  height: size,
});

/** Neutral source→source flow hint between adjacent legacy columns. */
export const chainEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  sourceHandle: 'r',
  targetHandle: 'l',
  type: 'default',
  style: { stroke: EDGE_CHAIN, strokeWidth: 1.5 },
  markerEnd: arrow('#94a3b8', 14),
});

/** Green stay-edge: correct findings flowing into their row's Normalize box. */
export const stayEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  sourceHandle: 'r',
  targetHandle: 'l',
  type: 'default',
  style: { stroke: EDGE_STAY, strokeWidth: 1.75 },
  markerEnd: arrow(EDGE_STAY),
});

/** Red move-edge: a relocation leaving its row for another Normalize box. */
export const moveEdge = (id: string, source: string, target: string, label: string): Edge => ({
  id,
  source,
  target,
  sourceHandle: 'r',
  targetHandle: 'l',
  type: 'relocate',
  data: { label, color: EDGE_MOVE },
  animated: true,
  style: { stroke: EDGE_MOVE, strokeWidth: 1.75, strokeDasharray: '5 3' },
  markerEnd: arrow(EDGE_MOVE, 16),
});

/** Normalize → Greenfield delivery edge (green family). */
export const greenfieldEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  sourceHandle: 'r',
  targetHandle: 'l',
  type: 'default',
  style: { stroke: '#5eead4', strokeWidth: 1.75 },
  markerEnd: arrow('#14b8a6'),
});

/** Cell → shared-service absorption edge (WR-15 lane). */
export const sharedEdge = (id: string, source: string, target: string, label: string): Edge => ({
  id,
  source,
  target,
  sourceHandle: 'r',
  targetHandle: 'l',
  type: 'relocate',
  data: { label, color: EDGE_SHARED },
  animated: true,
  style: { stroke: EDGE_SHARED, strokeWidth: 1.75, strokeDasharray: '5 3' },
  markerEnd: arrow(EDGE_SHARED, 16),
});
