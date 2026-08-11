// FORMS-RATION shared trust model (ADR-004, FORMS-LLR-012, LLD §7.2):
// clause findings and field mappings route through ONE confidence contract so
// reviewers learn a single set of ergonomics. τ below this threshold forces
// needs-human, which is excluded from every bulk action and never bulk-cleared.

/** Routing threshold τ — findings/mappings below it force human review. */
export const CONFIDENCE_TAU = 0.7;

/** Segmentation/extraction confidence below this quarantines the artifact. */
export const QUARANTINE_THRESHOLD = 0.7;

export type FindingStatus = 'new' | 'needs-human' | 'accepted' | 'rejected' | 'superseded';
export type MappingStatus = 'suggested' | 'needs-human' | 'confirmed' | 'rejected';

/** Initial status for an AI finding: τ-routed, never auto-accepted. */
export function routeFindingStatus(confidence: number): FindingStatus {
  return confidence < CONFIDENCE_TAU ? 'needs-human' : 'new';
}

/** Initial status for a field-mapping suggestion: same τ contract. */
export function routeMappingStatus(confidence: number): MappingStatus {
  return confidence < CONFIDENCE_TAU ? 'needs-human' : 'suggested';
}

/**
 * Default working-set UX mode from member count (FORMS-HLR-008): ≤7 forms
 * read as documents (Reading mode), ≥8 triage as a dataset (Portfolio mode).
 */
export function defaultMode(memberCount: number): 'reading' | 'portfolio' {
  return memberCount <= 7 ? 'reading' : 'portfolio';
}

/** Effective mode = explicit user override, else the size-derived default. */
export function effectiveMode(
  memberCount: number,
  modeOverride: string | null,
): 'reading' | 'portfolio' {
  if (modeOverride === 'reading' || modeOverride === 'portfolio') return modeOverride;
  return defaultMode(memberCount);
}
