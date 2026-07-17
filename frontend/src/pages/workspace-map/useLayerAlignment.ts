import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { LAYERS } from './types';
import type { BoardComponent, Layer, LayerPads } from './types';

// SCRUM-222 — horizontal row alignment across the three board columns.
//
// Each column stacks its rows naturally (screen preview above the Brownfield
// rows, card headers above the Greenfield slots …), so the same row sits at a
// different height in every column and the connectors run diagonally. This
// hook measures the live connector anchors and computes per-row top spacing
// for every column so each row's anchors sit on ONE horizontal line — the map
// then reads left-to-right along straight connectors.
//
// The pads are applied by the columns as marginTop on their rows; a
// ResizeObserver re-measures on accordion toggles, board switches and zoom.
// `useRowAlignment` is the generic engine (string row keys — the Products
// board aligns per model component); `useLayerAlignment` is the application
// board's Layer-keyed wrapper.

export interface ColumnPads {
  bf: LayerPads;
  nz: LayerPads;
  gf: LayerPads;
}

type ColKey = 'bf' | 'nz' | 'gf';
const COLS: ColKey[] = ['bf', 'nz', 'gf'];

/** One aligned band: its key and each column's anchor key (null = not present). */
export interface AlignRow {
  key: string;
  bf: string | null;
  nz: string | null;
  gf: string | null;
}

export type RowPads = Record<ColKey, Record<string, number>>;

const EMPTY_ROW_PADS: RowPads = { bf: {}, nz: {}, gf: {} };

/** Anchor centre-y of one element, in unscaled canvas coordinates. */
function centerY(el: Element, origin: DOMRect, scale: number): number {
  const r = el.getBoundingClientRect();
  return (r.top + r.height / 2 - origin.top) / scale;
}

export function useRowAlignment(
  containerRef: RefObject<HTMLElement | null>,
  resetToken: string | null,
  rows: AlignRow[],
  scale: number,
): RowPads {
  const [pads, setPads] = useState<RowPads>(EMPTY_ROW_PADS);
  // The pads currently rendered — measurements include them, so subtract to
  // recover each row's natural position before recomputing.
  const applied = useRef<RowPads>(EMPTY_ROW_PADS);
  applied.current = pads;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  // Re-run the effect when the row set itself changes (e.g. version picks).
  const rowsKey = rows.map((r) => `${r.key}|${r.bf}|${r.nz}|${r.gf}`).join('§');

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !resetToken) return;

    const compute = () => {
      const origin = container.getBoundingClientRect();
      const find = (key: string | null) =>
        key ? container.querySelector(`[data-anchor="${CSS.escape(key)}"]`) : null;

      // Natural (pad-free) centre of every row per column.
      const natural = new Map<ColKey, Map<string, number>>();
      for (const col of COLS) {
        const m = new Map<string, number>();
        let cum = 0;
        for (const row of rowsRef.current) {
          cum += applied.current[col][row.key] ?? 0;
          const el = find(row[col]);
          if (el) m.set(row.key, centerY(el, origin, scale) - cum);
        }
        natural.set(col, m);
      }

      // Walk the rows top→bottom accumulating spacing: every present column
      // is pushed down to the slowest one, so the band's anchors line up.
      const next: RowPads = { bf: {}, nz: {}, gf: {} };
      const offset: Record<ColKey, number> = { bf: 0, nz: 0, gf: 0 };
      for (const row of rowsRef.current) {
        const present = COLS.filter((c) => natural.get(c)?.has(row.key));
        if (present.length < 2) continue;
        const eff = (c: ColKey) => (natural.get(c)?.get(row.key) ?? 0) + offset[c];
        const target = Math.max(...present.map(eff));
        for (const c of present) {
          const pad = Math.max(0, Math.round(target - eff(c)));
          next[c][row.key] = pad;
          offset[c] += pad;
        }
      }

      // Only commit real movement — guards against ResizeObserver feedback.
      const keys = new Set([
        ...rowsRef.current.map((r) => r.key),
        ...COLS.flatMap((c) => Object.keys(applied.current[c])),
      ]);
      const changed = COLS.some((c) =>
        [...keys].some((k) => Math.abs((next[c][k] ?? 0) - (applied.current[c][k] ?? 0)) > 1.5),
      );
      if (changed) setPads(next);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    for (const child of Array.from(container.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [containerRef, resetToken, rowsKey, scale]);

  // A board switch starts from natural positions again.
  useLayoutEffect(() => {
    setPads(EMPTY_ROW_PADS);
  }, [resetToken]);

  return pads;
}

export function useLayerAlignment(
  containerRef: RefObject<HTMLElement | null>,
  boardId: string | null,
  components: BoardComponent[],
  scale: number,
): ColumnPads {
  // Greenfield anchor per layer: the layer's component names its target service.
  const gfKey = new Map<Layer, string>(
    components
      .filter((c): c is BoardComponent & { microserviceId: string } => !!c.microserviceId)
      .map((c) => [c.layer, `gf:${c.microserviceId}:${c.layer}`]),
  );
  const rows: AlignRow[] = LAYERS.map((layer) => ({
    key: layer,
    bf: `bf:${layer}`,
    nz: `nz:${layer}`,
    gf: gfKey.get(layer) ?? null,
  }));
  return useRowAlignment(containerRef, boardId, rows, scale) as ColumnPads;
}
