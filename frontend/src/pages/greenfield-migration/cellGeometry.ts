/**
 * Pure geometry for the workspace board (v3 wireframe layout) — per-column
 * widths (legacy panel / Normalize / Greenfield), the deterministic height
 * estimators that drive variable slot heights, and the slot-height/offset
 * math. No React / React Flow imports so the estimators are unit-testable.
 *
 * Estimates are deliberately GENEROUS: boxes are top-aligned in their slot, so
 * over-estimating just leaves invisible margin below a box, while
 * under-estimating would overlap the next row. Never trim these down to
 * pixel-perfect values.
 */
import type { CategoryTag, NormalizationEntry } from '../../lib/rationalization';

// v3 wireframe columns: ONE legacy source panel (app-switcher chips in its
// header), a wide Normalize comparison column, and the Greenfield targets.
// Every box sits top-aligned in its layer SLOT; the gap between panels is the
// arrow lane.
export const LEG_W = 330; // legacy panel box width (item rows)
export const NORM_W = 460; // Normalize box width (3-column comparison table)
export const GF_W = 250; // greenfield target box width
export const BOX_W = LEG_W; // legacy-cell width (kept name for node components)
export const PANEL_PAD = 12;
export const PANEL_GAP = 150; // arrow lane between panels (the wireframe's long curves)
export const HEADER_H = 60; // in-panel header band (title + stats + chips)
export const SLOT_H = 96; // minimum layer slot height (shared across panels)
export const SLOT_MARGIN = 18; // breathing room under the tallest box in a slot

/** Panel outer width for a given box width. */
export const panelW = (boxW: number) => boxW + PANEL_PAD * 2;
export const PANEL_W = panelW(LEG_W); // legacy panel outer width (legacy name)

/** X positions of the three v3 columns (legacy, Normalize, Greenfield). */
export function columnXs(): { legacy: number; normalize: number; greenfield: number } {
  const legacy = 0;
  const normalize = legacy + panelW(LEG_W) + PANEL_GAP;
  const greenfield = normalize + panelW(NORM_W) + PANEL_GAP;
  return { legacy, normalize, greenfield };
}

export const X = { label: -170 };
export const ROW_H = SLOT_H; // relocation-edge label math

// Full-width lanes below the layer grid: the v3 dead-code lane and the
// shared-services lane (WR-15).
export const LANE_GAP = 32; // gap between the panels' bottom edge and a lane
export const SHARED_BOX_H = 96; // ceiling of a rendered shared-service box
export const LANE_H = HEADER_H + SHARED_BOX_H + PANEL_PAD * 2;
export const DEAD_LANE_H = 42; // the wireframe's single-line red band

/** Estimated height of the dead-code lane (one-line band, count-independent). */
export const deadLaneHeight = (_count: number): number => DEAD_LANE_H;

// ── Legacy cell height estimation (v3 item rows) ────────────────────────────
// The cell renders a section header (dot + "<layer> layer" + descriptor +
// count + stay/move roll-up) then one compact row per finding: ✓/✗ + category
// tag + name + "correct here" / relocation badge. The wireframe shows ALL
// movers but folds stays past STAY_CAP behind "+ N more…"; a mover's
// WHY-THIS-MOVES panel expands inline.
export const CELL_HEADER_H = 32; // section header row + divider
export const CELL_BASE_H = 24; // paddings + slack
export const ITEM_ROW_H = 24; // one compact finding row
export const ITEM_WHY_H = 118; // expanded WHY THIS MOVES panel ceiling
export const MORE_ROW_H = 18; // "+ N more…" toggle row
export const STAY_CAP = 3; // stay rows shown before the fold (movers always show)
export const EMPTY_CELL_H = 44; // "—" placeholder box

/** Sentinel tokens carried in the cell's `expanded` list. */
export const EXPAND_ALL = '¶all';
export const whyToken = (findingId: string) => `why:${findingId}`;

/** Wireframe visibility rule: first STAY_CAP stays + every mover. */
export function visibleCellRows<T>(
  stays: T[],
  movers: T[],
  showAll: boolean,
): {
  shown: T[];
  hidden: number;
} {
  if (showAll) return { shown: [...stays, ...movers], hidden: 0 };
  const shownStays = stays.slice(0, STAY_CAP);
  return { shown: [...shownStays, ...movers], hidden: stays.length - shownStays.length };
}

/**
 * Deterministic estimated pixel height of one legacy cell given its
 * (view-filtered) category tags and the expansion tokens active in it
 * (EXPAND_ALL shows every row; `why:<findingId>` opens that mover's panel).
 */
export function estimateCellHeight(tags: CategoryTag[], expandedTokens: string[]): number {
  const stays = tags.filter((t) => t.stays).flatMap((t) => t.findings);
  const movers = tags.filter((t) => !t.stays).flatMap((t) => t.findings);
  if (stays.length + movers.length === 0) return EMPTY_CELL_H;
  const showAll = expandedTokens.includes(EXPAND_ALL);
  const { shown, hidden } = visibleCellRows(stays, movers, showAll);
  let h = CELL_HEADER_H + CELL_BASE_H + shown.length * ITEM_ROW_H;
  if (hidden > 0 || showAll) h += MORE_ROW_H;
  const openWhys = new Set(
    expandedTokens.filter((t) => t.startsWith('why:')).map((t) => t.slice(4)),
  );
  for (const f of shown as { id: string; whyThisMoves: unknown }[])
    if (f.whyThisMoves && openWhys.has(f.id)) h += ITEM_WHY_H;
  return h;
}

// ── Normalize box estimation (v3 comparison table) ──────────────────────────
export const NORM_BASE_H = 64; // box padding + title row + 3-column header band
export const NORM_ENTRY_H = 34; // one compact entry row (#N-101, no cards)
export const NORM_HELD_EXTRA = 52; // resolution + actions on HELD/REVIEW rows
export const NORM_CARD_LINE_H = 14; // one field line in a source card
export const NORM_CARD_BASE_H = 56; // card title + verdict strip + paddings
export const NORM_MORE_H = 16; // "+ N more normalized…" note row
export const NORM_COMPACT_CAP = 3; // compact rows shown per card-less box

/**
 * The entries a Normalize box actually displays (wireframe density): a box
 * with comparison-card entries shows ONLY those (the wireframe's boxes list
 * the marquee comparisons; the rest is the "16 raw → 10" roll-up); a box
 * without cards shows up to NORM_COMPACT_CAP compact rows, non-AUTO first.
 */
export function visibleNormalizeEntries(entries: NormalizationEntry[]): {
  shown: NormalizationEntry[];
  hidden: number;
} {
  const withCards = entries.filter((e) => (e.sourceCards ?? []).length > 0);
  const compact = entries.filter((e) => (e.sourceCards ?? []).length === 0);
  if (withCards.length > 0) return { shown: withCards, hidden: compact.length };
  const compactRanked = [
    ...compact.filter((e) => e.matchStatus !== 'AUTO'),
    ...compact.filter((e) => e.matchStatus === 'AUTO'),
  ];
  const shownCompact = compactRanked.slice(0, NORM_COMPACT_CAP);
  return { shown: shownCompact, hidden: compact.length - shownCompact.length };
}

/** Estimated pixel height of one Normalize box given its entries. */
export function estimateNormalizeHeight(entries: NormalizationEntry[]): number {
  let h = NORM_BASE_H;
  const { shown, hidden } = visibleNormalizeEntries(entries);
  for (const e of shown) {
    const cards = e.sourceCards ?? [];
    if (cards.length > 0) {
      const lines = Math.max(...cards.map((c) => c.lines?.length ?? 3), 3);
      h += NORM_CARD_BASE_H + lines * NORM_CARD_LINE_H;
    } else {
      h += NORM_ENTRY_H;
    }
    if (e.matchStatus !== 'AUTO') h += NORM_HELD_EXTRA;
  }
  if (hidden > 0) h += NORM_MORE_H;
  return h;
}

/** Slot height for one layer row: at least SLOT_H, else tallest box + margin. */
export function slotHeightFor(estimates: number[]): number {
  return Math.max(SLOT_H, Math.max(0, ...estimates) + SLOT_MARGIN);
}

/** Cumulative y offset of each slot (offsets[0] = 0). */
export function slotOffsets(heights: number[]): number[] {
  const out: number[] = [];
  let y = 0;
  for (const h of heights) {
    out.push(y);
    y += h;
  }
  return out;
}
