/**
 * Value-stream lens cascade helpers (L3 → L4 dropdowns) for the Application
 * Rationalization workspace — token matching between rationalization stages
 * and the canonical Level tree, plus the tiny labelled select field. Extracted
 * verbatim from GreenfieldMigration.tsx.
 */
import type { ReactNode } from 'react';

// The canonical L3 value streams and their L4 processes come from the unified
// Level tree (GET /explorer/tree: division → value_stream → areas). The
// rationalization stages carry no FK into that tree, so each stage (lens) is
// matched to its closest L4 process by name-token overlap. Only L3 streams and
// L4 processes that resolve to an existing board are listed (no dead picks);
// picking an L3 repopulates the L4 dropdown and opens its first board. Stages
// with no match stay reachable via an "Application lenses" group in the L4
// dropdown.
export type LensL4 = { id: string; name: string };
export type LensL3 = { id: string; name: string; l4s: LensL4[] };

const LENS_STOP = new Set(['and', 'the', 'for', 'with', 'mgmt', 'management']);
// Lowercased, lightly-stemmed name tokens ("Channels" matches "channel").
export const lensTokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.replace(/s$/, ''))
    .filter((t) => t.length >= 3 && !LENS_STOP.has(t));
// Overlap score — hits on the L4 name count double vs hits on its parent L3.
export function lensScore(stage: string[], l4: string[], l3: string[]): number {
  const s = new Set(stage);
  let n = 0;
  for (const t of l4) if (s.has(t)) n += 2;
  for (const t of l3) if (s.has(t)) n += 1;
  return n;
}

// Tiny labelled control for the cascade row. `interactive` swaps the wrapping
// <label> for a <div> when the child hosts its own interactive controls (the
// WR-01 multi-select popover) so label activation can't misfire clicks.
export function LensField({
  label,
  children,
  interactive = false,
}: {
  label: string;
  children: ReactNode;
  interactive?: boolean;
}) {
  const caption = (
    <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">
      {label}
    </span>
  );
  if (interactive)
    return (
      <div className="flex flex-col gap-0.5 min-w-0">
        {caption}
        {children}
      </div>
    );
  return (
    <label className="flex flex-col gap-0.5 min-w-0">
      {caption}
      {children}
    </label>
  );
}
export const LENS_SELECT_CLS =
  'h-7 rounded-md border border-[#eaeaea] bg-white px-1.5 text-[12px] text-[#171717] max-w-[240px] focus:outline-none focus:border-[#d4d4d4]';
