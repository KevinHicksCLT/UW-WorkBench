import type { Finding, NormalizationEntry } from './types';

// On-the-fly cross-application comparison (generic — works for ANY pair of
// scanned applications). A cross-board comparison has no authored
// NormalizationEntry rows spanning its applications, so the shared/unique
// verdict is COMPUTED here from the findings themselves: steps from different
// applications that resolve to the same normalized name are consolidation
// candidates; everything else is application-specific and migrates as-is.
// Same-board comparisons keep their scan-authored entries (field-level match
// cards, review verdicts) — this module only serves mixed-board scopes.

/** Loose name key: case/punctuation-insensitive so "Validate FEIN" matches
 *  "validate_fein()" but unrelated steps never collide. */
function nameKey(f: Finding): string {
  return `${f.layer}|${f.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()}`;
}

/** Synthesize normalization entries for a cross-board scope: one AUTO entry
 *  per step name that appears in 2+ of the compared applications. Findings in
 *  no group stay uncovered and pass through 1→1 (the column renders them as
 *  application-specific). Zero overlap → zero entries — nothing pretends to
 *  consolidate. */
export function computeCrossAppEntries(findings: Finding[]): NormalizationEntry[] {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    const k = nameKey(f);
    const g = groups.get(k) ?? [];
    g.push(f);
    groups.set(k, g);
  }
  const entries: NormalizationEntry[] = [];
  for (const [k, g] of groups) {
    const apps = new Set(g.map((f) => f.appId));
    if (apps.size < 2) continue;
    entries.push({
      id: `cmp:${k}`,
      layer: g[0].layer,
      notation: null,
      name: g[0].name,
      matchStatus: 'AUTO',
      matchBasis: `Matched on step name across ${apps.size} applications — computed by the comparison, not authored.`,
      differenceNote: null,
      proposedResolution: null,
      sourceCards: null,
      componentId: null,
      findingIds: g.map((f) => f.id),
    });
  }
  return entries;
}
