/**
 * Pure geometry for the Option C rationalization board — shared layout
 * constants, the deterministic per-cell height estimator that drives variable
 * slot heights (WR-10 in-box expansion + v3 WHY-THIS-MOVES panels), the
 * Normalize-box estimator, and the slot-height/offset math.
 * No React / React Flow imports so the estimators are unit-testable.
 *
 * Estimates are deliberately GENEROUS: boxes are top-aligned in their slot, so
 * over-estimating just leaves invisible margin below a box, while
 * under-estimating would overlap the next row. Never trim these down to
 * pixel-perfect values.
 */
import type { CategoryTag, NormalizationEntry } from '../../lib/rationalization';

// Option C geometry — one shared baseline grid across all panels: every box
// sits top-aligned in its layer SLOT, panels differ only in x. The gap
// between panels is the arrow lane.
export const BOX_W = 290; // unified box width (WR-05 sizing preserved)
export const PANEL_PAD = 14;
export const PANEL_W = BOX_W + PANEL_PAD * 2;
export const PANEL_GAP = 46;
export const HEADER_H = 60; // in-panel header band (title + v3 stats line)
export const SLOT_H = 180; // minimum layer slot height (shared across panels)
export const SLOT_MARGIN = 28; // breathing room under the tallest box in a slot
const STRIDE = PANEL_W + PANEL_GAP;
export const panelX = (i: number) => i * STRIDE;
export const X = { label: -170 };
export const ROW_H = SLOT_H; // relocation-edge label math

// Full-width lanes below the layer grid: the v3 dead-code lane and the
// shared-services lane (WR-15).
export const LANE_GAP = 44; // gap between the panels' bottom edge and a lane
export const SHARED_BOX_H = 96; // ceiling of a rendered shared-service box
export const LANE_H = HEADER_H + SHARED_BOX_H + PANEL_PAD * 2;
export const DEAD_ROW_H = 40; // one dead-code finding row (name + retire)
export const DEAD_BASE_H = 58; // lane heading + paddings

/** Estimated height of the dead-code lane for `count` findings. */
export const deadLaneHeight = (count: number): number => DEAD_BASE_H + count * DEAD_ROW_H;

// ── Cell height estimation (WR-10 + v3) ─────────────────────────────────────
// Component sizing assumptions (each a ceiling of the rendered CellNode CSS):
export const EMPTY_CELL_H = 52; // "—" placeholder box
export const CELL_BASE_H = 58; // py-3 padding + 2px borders + "+ finding" footer + slack
export const CHIP_ROW_H = 32; // one category chip row (chip ~26px + gap)
export const DIVIDER_H = 30; // "Doesn't belong here" divider row + margins
export const ITEM_H = 78; // expanded finding: ✓/✗ + name + ≤2 summary lines
export const ITEM_SCREEN_H = 28; // screen chip line under a finding
export const ITEM_FLAG_H = 22; // red relocation badge line (→ Business …)
export const ITEM_WHY_H = 104; // expanded WHY THIS MOVES panel ceiling
export const ANATOMY_ROW_H = 24; // one matched anatomy sub-category line

/**
 * Deterministic estimated pixel height of one legacy cell box given its
 * (view-filtered) category tags and the categories currently expanded in it.
 * Assumes every collapsed chip takes its own row (generous — chips actually
 * wrap several to a row); every expanded finding renders ✓/✗ + name + summary,
 * plus a screen-chip row when screenRef is set, a relocation badge line and a
 * WHY THIS MOVES panel for misplaced items, and one line per matched anatomy
 * sub-category (product boards).
 */
export function estimateCellHeight(
  tags: CategoryTag[],
  expandedCategories: string[],
  anatomyRows: (tag: CategoryTag) => number = () => 0,
): number {
  if (tags.length === 0) return EMPTY_CELL_H;
  let h = CELL_BASE_H;
  if (tags.some((t) => !t.stays)) h += DIVIDER_H;
  for (const t of tags) {
    h += CHIP_ROW_H;
    if (!expandedCategories.includes(t.category)) continue;
    for (const f of t.findings) {
      h += ITEM_H;
      if (f.screenRef) h += ITEM_SCREEN_H;
      if (!t.stays) h += ITEM_FLAG_H;
      if (!t.stays && f.whyThisMoves) h += ITEM_WHY_H;
    }
    h += anatomyRows(t) * ANATOMY_ROW_H;
  }
  return h;
}

// ── Normalize box estimation (v3) ───────────────────────────────────────────
export const NORM_BASE_H = 88; // box padding + name + roll-up + destination + pair line
export const NORM_ENTRY_H = 60; // one AUTO entry row (#N-101 + basis line)
export const NORM_HELD_H = 124; // one HELD/REVIEW card (note + resolution + actions)

/** Estimated pixel height of one Normalize box given its entries. */
export function estimateNormalizeHeight(entries: NormalizationEntry[]): number {
  let h = NORM_BASE_H;
  for (const e of entries) h += e.matchStatus === 'AUTO' ? NORM_ENTRY_H : NORM_HELD_H;
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
