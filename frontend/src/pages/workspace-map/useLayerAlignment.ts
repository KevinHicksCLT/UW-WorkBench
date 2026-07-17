import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { LAYERS } from './types';
import type { BoardComponent, Layer, LayerPads } from './types';

// SCRUM-222 — horizontal row alignment across the three board columns.
//
// Each column stacks its five layer rows naturally (screen preview above the
// Brownfield rows, card headers above the Greenfield slots …), so the same
// layer sits at a different height in every column and the connectors run
// diagonally. This hook measures the live connector anchors (`bf:{layer}`,
// `nz:{layer}`, `gf:{msId}:{layer}`) and computes per-layer top spacing for
// every column so each layer's anchors sit on ONE horizontal line — the map
// then reads left-to-right along straight connectors.
//
// The pads are applied by the columns as marginTop on their layer rows; a
// ResizeObserver re-measures on accordion toggles, board switches and zoom.

export interface ColumnPads {
  bf: LayerPads;
  nz: LayerPads;
  gf: LayerPads;
}

const EMPTY: ColumnPads = { bf: {}, nz: {}, gf: {} };
type ColKey = keyof ColumnPads;
const COLS: ColKey[] = ['bf', 'nz', 'gf'];

/** Anchor centre-y of one element, in unscaled canvas coordinates. */
function centerY(el: Element, origin: DOMRect, scale: number): number {
  const r = el.getBoundingClientRect();
  return (r.top + r.height / 2 - origin.top) / scale;
}

export function useLayerAlignment(
  containerRef: RefObject<HTMLElement | null>,
  boardId: string | null,
  components: BoardComponent[],
  scale: number,
): ColumnPads {
  const [pads, setPads] = useState<ColumnPads>(EMPTY);
  // The pads currently rendered — measurements include them, so subtract to
  // recover each row's natural position before recomputing.
  const applied = useRef<ColumnPads>(EMPTY);
  applied.current = pads;
  // Greenfield anchor per layer: the layer's component names its target service.
  const gfKey = new Map<Layer, string>(
    components
      .filter((c): c is BoardComponent & { microserviceId: string } => !!c.microserviceId)
      .map((c) => [c.layer, `gf:${c.microserviceId}:${c.layer}`]),
  );
  const gfKeyRef = useRef(gfKey);
  gfKeyRef.current = gfKey;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !boardId) return;

    const compute = () => {
      const origin = container.getBoundingClientRect();
      const find = (key: string) => container.querySelector(`[data-anchor="${CSS.escape(key)}"]`);
      const anchorKey = (col: ColKey, layer: Layer) =>
        col === 'bf' ? `bf:${layer}` : col === 'nz' ? `nz:${layer}` : gfKeyRef.current.get(layer);

      // Natural (pad-free) centre of every layer row per column.
      const natural = new Map<ColKey, Map<Layer, number>>();
      for (const col of COLS) {
        const m = new Map<Layer, number>();
        let cum = 0;
        for (const layer of LAYERS) {
          cum += applied.current[col][layer] ?? 0;
          const key = anchorKey(col, layer);
          const el = key ? find(key) : null;
          if (el) m.set(layer, centerY(el, origin, scale) - cum);
        }
        natural.set(col, m);
      }

      // Walk the layers top→bottom accumulating spacing: every present column
      // is pushed down to the slowest one, so the row's anchors line up.
      const next: ColumnPads = { bf: {}, nz: {}, gf: {} };
      const offset: Record<ColKey, number> = { bf: 0, nz: 0, gf: 0 };
      for (const layer of LAYERS) {
        const present = COLS.filter((c) => natural.get(c)?.has(layer));
        if (present.length < 2) continue;
        const eff = (c: ColKey) => (natural.get(c)?.get(layer) ?? 0) + offset[c];
        const target = Math.max(...present.map(eff));
        for (const c of present) {
          const pad = Math.max(0, Math.round(target - eff(c)));
          next[c][layer] = pad;
          offset[c] += pad;
        }
      }

      // Only commit real movement — guards against ResizeObserver feedback.
      const changed = COLS.some((c) =>
        LAYERS.some((l) => Math.abs((next[c][l] ?? 0) - (applied.current[c][l] ?? 0)) > 1.5),
      );
      if (changed) setPads(next);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    for (const child of Array.from(container.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [containerRef, boardId, scale]);

  // A board switch starts from natural positions again.
  useLayoutEffect(() => {
    setPads(EMPTY);
  }, [boardId]);

  return pads;
}
