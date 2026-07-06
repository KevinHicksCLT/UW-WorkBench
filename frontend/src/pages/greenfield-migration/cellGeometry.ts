/**
 * Pure geometry for the Option C rationalization board — shared layout
 * constants, the deterministic per-cell height estimator that drives variable
 * slot heights (WR-10 in-box expansion), and the slot-height/offset math.
 * No React / React Flow imports so the estimator is unit-testable in isolation.
 *
 * Estimates are deliberately GENEROUS: boxes are top-aligned in their slot, so
 * over-estimating just leaves invisible margin below a box, while
 * under-estimating would overlap the next row. Never trim these down to
 * pixel-perfect values.
 */
import type { Capdan, CategoryTag } from '../../lib/rationalization';

export const belongsHere = (c: Capdan) => c === 'Common' || c === 'Different';

// Option C geometry — one shared baseline grid across all panels: every box
// sits top-aligned in its layer SLOT, panels differ only in x. The gap
// between panels is the arrow lane.
export const BOX_W = 290; // unified box width (WR-05 sizing preserved)
export const PANEL_PAD = 14;
export const PANEL_W = BOX_W + PANEL_PAD * 2;
export const PANEL_GAP = 46;
export const HEADER_H = 46; // in-panel header band
export const SLOT_H = 180; // minimum layer slot height (shared across panels)
export const SLOT_MARGIN = 28; // breathing room under the tallest box in a slot
const STRIDE = PANEL_W + PANEL_GAP;
export const panelX = (i: number) => i * STRIDE;
export const X = { label: -160 };
export const ROW_H = SLOT_H; // relocation-edge label math

// Shared-services lane (WR-15) — a horizontal band below the layer grid for
// SHARED_SERVICE apps (MDM/RDM, auth, document services).
export const LANE_GAP = 44; // gap between the panels' bottom edge and the lane
export const SHARED_BOX_H = 96; // ceiling of a rendered shared-service box
export const LANE_H = HEADER_H + SHARED_BOX_H + PANEL_PAD * 2;

// ── Cell height estimation (WR-10) ──────────────────────────────────────────
// Component sizing assumptions (each a ceiling of the rendered CellNode CSS):
export const EMPTY_CELL_H = 52; // "—" placeholder box
export const CELL_BASE_H = 32; // py-3 padding + 2px borders + slack
export const CHIP_ROW_H = 32; // one category chip row (chip ~26px + gap)
export const DIVIDER_H = 30; // "Doesn't belong here" divider row + margins
export const ITEM_H = 70; // expanded finding: name line + ≤2 summary lines
export const ITEM_SCREEN_H = 28; // screen chip line under a finding
export const ITEM_FLAG_H = 20; // red "Belongs in …" / "Recommend removing" line

/**
 * Deterministic estimated pixel height of one legacy cell box given its
 * (view-filtered) category tags and the categories currently expanded in it.
 * Assumes every collapsed chip takes its own row (generous — chips actually
 * wrap several to a row) and every expanded finding renders name + summary,
 * plus a screen-chip row when screenRef is set and a red flag line for
 * Relocate/Eliminate tags.
 */
export function estimateCellHeight(tags: CategoryTag[], expandedCategories: string[]): number {
  if (tags.length === 0) return EMPTY_CELL_H;
  let h = CELL_BASE_H;
  if (tags.some((t) => !belongsHere(t.capdan))) h += DIVIDER_H;
  for (const t of tags) {
    h += CHIP_ROW_H;
    if (!expandedCategories.includes(t.category)) continue;
    for (const f of t.findings) {
      h += ITEM_H;
      if (f.screenRef) h += ITEM_SCREEN_H;
      if (!belongsHere(t.capdan)) h += ITEM_FLAG_H;
    }
  }
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
