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

/** Connectors and row alignment both target the row's HEADER line, not its
 *  centre: an expanded section grows downward, so its anchor stays put at the
 *  header and the three columns keep lining up top-aligned. ~half a collapsed
 *  header's height; shorter elements fall back to their true centre. */
export const HEADER_ANCHOR_Y = 17;

export function anchorY(r: DOMRect): number {
  return r.top + Math.min(r.height / 2, HEADER_ANCHOR_Y);
}

function anchorPoint(
  el: Element,
  side: Side,
  origin: DOMRect,
  scale: number,
): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const x = side === 'right' ? r.right : r.left;
  const y = anchorY(r);
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
  /** Value key of the row-alignment pads. The alignment hook's ResizeObserver
   *  mutates layout inside observer callbacks, and the browser DROPS the
   *  resulting notifications for other observers in that frame — without this
   *  dep the connectors freeze on pre-alignment geometry. */
  refreshKey?: string,
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
  }, [containerRef, specsKey, scale, refreshKey]);

  return edges;
}

// Straight-line routing: each connector runs point to point. The arrowhead
// markers use orient="auto", so they stay aligned with the line's angle.
// Rows are aligned by useRowAlignment to within its tolerance; the few px of
// rounding residual left over would still read as a slant, so anything close
// to horizontal SNAPS to the midpoint and draws dead level. Genuinely
// unaligned edges keep their true angle.
const SNAP = 9;
function straight(e: Edge): string {
  const dy = e.y1 - e.y0;
  if (dy !== 0 && Math.abs(dy) <= SNAP) {
    const y = ((e.y0 + e.y1) / 2).toFixed(1);
    return `M${e.x0},${y} L${e.x1},${y}`;
  }
  return `M${e.x0},${e.y0} L${e.x1},${e.y1}`;
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
          d={straight(e)}
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
