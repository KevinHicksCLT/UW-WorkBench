import { useLayoutEffect, useMemo, useState, type RefObject } from 'react';
import { AMBER, GREEN, RED } from './types';

// One drawn connector between two column anchors. Points are in canvas
// (unscaled) coordinates; the SVG lives inside the same scaled canvas so it
// tracks zoom for free.
export interface Edge {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
  count: number | null;
  dim: boolean;
  /** Shifts the vertical gutter segment sideways so paired edges don't overlap. */
  lane: number;
}

/** Where an edge attaches to an anchor element. */
type Side = 'left' | 'right';

export interface EdgeSpec {
  id: string;
  from: string; // anchor key on the source element's right side
  to: string; // anchor key on the target element's left side
  fromSide?: Side;
  toSide?: Side;
  color: string;
  width: number;
  count?: number | null;
  dim?: boolean;
  /** Vertical start/end offset — separates the stay/move pair leaving one anchor. */
  y0Offset?: number;
  y1Offset?: number;
  /** Gutter lane (−1 | 0 | 1): sideways shift of the vertical segment. */
  lane?: number;
}

function anchorPoint(
  el: Element,
  side: Side,
  origin: DOMRect,
  scale: number,
): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const x = side === 'right' ? r.right : r.left;
  const y = r.top + r.height / 2;
  return { x: (x - origin.left) / scale, y: (y - origin.top) / scale };
}

/**
 * Measure the DOM anchor elements inside `containerRef` and resolve every spec
 * into a drawable Edge. Recomputes on layout and resize (ResizeObserver on the
 * canvas catches accordion toggles, board switches and zoom). Measuring the
 * real DOM keeps the connectors correct no matter how tall each column's
 * content grows — no hard-coded pixel geometry like the static wireframe.
 */
export function useEdges(
  containerRef: RefObject<HTMLElement | null>,
  specs: EdgeSpec[],
  scale: number,
): Edge[] {
  const [edges, setEdges] = useState<Edge[]>([]);
  // Effect dependency by value: the spec list is rebuilt each render, so key it.
  const specsKey = useMemo(() => JSON.stringify(specs), [specs]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const compute = () => {
      const origin = container.getBoundingClientRect();
      const parsed = JSON.parse(specsKey) as EdgeSpec[];
      const find = (key: string) => container.querySelector(`[data-anchor="${CSS.escape(key)}"]`);
      const next: Edge[] = [];
      for (const s of parsed) {
        const a = find(s.from);
        const b = find(s.to);
        if (!a || !b) continue;
        const p0 = anchorPoint(a, s.fromSide ?? 'right', origin, scale);
        const p1 = anchorPoint(b, s.toSide ?? 'left', origin, scale);
        p0.y += s.y0Offset ?? 0;
        p1.y += s.y1Offset ?? 0;
        next.push({
          id: s.id,
          x0: p0.x,
          y0: p0.y,
          x1: p1.x,
          y1: p1.y,
          color: s.color,
          width: s.width,
          count: s.count ?? null,
          dim: s.dim ?? false,
          lane: s.lane ?? 0,
        });
      }
      setEdges(next);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    // Anchors can move without the container resizing (a section collapses while
    // another grows) — observe the column roots too.
    for (const child of Array.from(container.children)) ro.observe(child);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [containerRef, specsKey, scale]);

  return edges;
}

// Smooth-step routing (orthogonal with rounded corners): out horizontally,
// turn down the column gutter, turn again, land horizontally. Stays crisp on
// the tall drops this board has — a bezier there degenerates into a kinked
// near-vertical dive — and the arrowhead always enters its anchor flat.
function bezier(e: Edge): string {
  const { x0, y0, x1, y1 } = e;
  const dy = y1 - y0;
  if (Math.abs(dy) < 2) return `M${x0},${y0} L${x1},${y1}`;
  const midX = (x0 + x1) / 2 + e.lane * 7;
  const r = Math.min(14, Math.abs(dy) / 2, Math.abs(x1 - x0) / 2);
  const sy = dy > 0 ? 1 : -1;
  return [
    `M${x0},${y0}`,
    `L${(midX - r).toFixed(1)},${y0}`,
    `Q${midX.toFixed(1)},${y0} ${midX.toFixed(1)},${(y0 + sy * r).toFixed(1)}`,
    `L${midX.toFixed(1)},${(y1 - sy * r).toFixed(1)}`,
    `Q${midX.toFixed(1)},${y1} ${(midX + r).toFixed(1)},${y1}`,
    `L${x1},${y1}`,
  ].join(' ');
}

/** SVG overlay of every connector plus its count pill. Non-interactive. */
export function FlowEdges({ edges }: { edges: Edge[] }) {
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
      fill="none"
    >
      <defs>
        <marker id="wm-ok" markerWidth={9} markerHeight={9} refX={7} refY={4.5} orient="auto">
          <path d="M1,1 L7,4.5 L1,8" stroke={GREEN} strokeWidth={1.6} fill="none" />
        </marker>
        <marker id="wm-mv" markerWidth={9} markerHeight={9} refX={7} refY={4.5} orient="auto">
          <path d="M1,1 L7,4.5 L1,8" stroke={RED} strokeWidth={1.6} fill="none" />
        </marker>
        <marker id="wm-rv" markerWidth={9} markerHeight={9} refX={7} refY={4.5} orient="auto">
          <path d="M1,1 L7,4.5 L1,8" stroke={AMBER} strokeWidth={1.6} fill="none" />
        </marker>
      </defs>
      {edges.map((e) => (
        <path
          key={e.id}
          d={bezier(e)}
          stroke={e.color}
          strokeWidth={e.width}
          opacity={e.dim ? 0.18 : 1}
          markerEnd={
            e.color === GREEN ? 'url(#wm-ok)' : e.color === AMBER ? 'url(#wm-rv)' : 'url(#wm-mv)'
          }
        />
      ))}
      {edges
        .filter((e) => e.count != null && !e.dim)
        .map((e) => (
          <g key={`${e.id}-pill`} transform={`translate(${e.x0 + 8}, ${e.y0})`}>
            <rect
              x={-1}
              y={-9}
              width={e.count! >= 10 ? 22 : 16}
              height={17}
              rx={8.5}
              fill="#fff"
              stroke={e.color}
              strokeWidth={1.5}
            />
            <text
              x={e.count! >= 10 ? 10 : 7}
              y={3}
              fontSize={10.5}
              fontWeight={700}
              fill={e.color}
              textAnchor="middle"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {e.count}
            </text>
          </g>
        ))}
    </svg>
  );
}
