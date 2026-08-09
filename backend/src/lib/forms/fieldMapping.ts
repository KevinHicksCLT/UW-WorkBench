// Field-plane mapping suggestions (FORMS-LLR-017, LLD §7.2): a weighted
// blend of (a) source-name similarity to dictionary keys, (b) label text
// similarity, (c) option-set overlap for choice fields. Per-signal scores
// are persisted for audit (INV-F3); do-not-map definitions are excluded from
// candidates entirely (INV-F1).
import { bigramSimilarity, jaccard, normalizeClauseText } from './similarity.js';

export const SIGNAL_WEIGHTS = { nameSim: 0.4, labelSim: 0.45, optionOverlap: 0.15 } as const;

export type MappingCandidate = {
  id: string;
  key: string; // grammar: role.entity.attribute
  stability: string; // stable | do-not-map
  optionValues: string[]; // known enumeration values, [] for non-choice
};

export type ExtractedFieldInput = {
  sourceName: string;
  label: string | null;
  optionLabels: string[]; // [] for non-choice widgets
};

export type MappingSuggestion = {
  fieldDefinitionId: string;
  confidence: number;
  nameSim: number;
  labelSim: number;
  optionOverlap: number;
};

// Engine-specific prefixes normalized away before name comparison
// (FORMS-LLR-019) — e.g. "topmostSubform[0].page1[0].InsuredFEIN[0]".
const ENGINE_PREFIX = /^(topmostSubform|form1|page\d+|subform\d*)\[\d+\]\./i;

/** Strip engine prefixes + array suffixes from an AcroForm/XFA field name. */
export function normalizeSourceName(sourceName: string): string {
  let name = sourceName;
  while (ENGINE_PREFIX.test(name)) name = name.replace(ENGINE_PREFIX, '');
  return name.replace(/\[\d+\]/g, '').trim();
}

/** Dictionary keys compare as their attribute-bearing tokens, dots removed. */
function keyComparable(key: string): string {
  return key.replace(/\./g, ' ');
}

/**
 * Score one extracted field against one dictionary candidate. Fields or
 * candidates without options contribute 0 to the option signal (weights are
 * NOT renormalized: absent evidence lowers confidence rather than hiding).
 */
export function scoreMapping(
  field: ExtractedFieldInput,
  candidate: MappingCandidate,
): Omit<MappingSuggestion, 'fieldDefinitionId'> {
  const nameSim = bigramSimilarity(
    normalizeSourceName(field.sourceName),
    keyComparable(candidate.key),
  );
  const labelSim = field.label ? bigramSimilarity(field.label, keyComparable(candidate.key)) : 0;
  const optionOverlap =
    field.optionLabels.length > 0 && candidate.optionValues.length > 0
      ? jaccard(
          new Set(field.optionLabels.map(normalizeClauseText)),
          new Set(candidate.optionValues.map(normalizeClauseText)),
        )
      : 0;
  const confidence = Number(
    (
      SIGNAL_WEIGHTS.nameSim * nameSim +
      SIGNAL_WEIGHTS.labelSim * labelSim +
      SIGNAL_WEIGHTS.optionOverlap * optionOverlap
    ).toFixed(4),
  );
  return {
    confidence,
    nameSim: Number(nameSim.toFixed(4)),
    labelSim: Number(labelSim.toFixed(4)),
    optionOverlap: Number(optionOverlap.toFixed(4)),
  };
}

/**
 * Best mapping suggestion for a field across the dictionary. Candidates with
 * stability=do-not-map are never suggested (INV-F1). Returns null when no
 * candidate scores above the floor (0.2 — below that a suggestion is noise).
 */
export function suggestMapping(
  field: ExtractedFieldInput,
  candidates: MappingCandidate[],
): MappingSuggestion | null {
  const SUGGESTION_FLOOR = 0.2;
  let best: MappingSuggestion | null = null;
  for (const candidate of candidates) {
    if (candidate.stability === 'do-not-map') continue;
    const scored = scoreMapping(field, candidate);
    if (scored.confidence < SUGGESTION_FLOOR) continue;
    if (!best || scored.confidence > best.confidence) {
      best = { fieldDefinitionId: candidate.id, ...scored };
    }
  }
  return best;
}
