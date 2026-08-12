// Clause segmentation (FORMS-LLR-001, LLD §2.1): rule pass over numbering
// grammars and SECTION-style headings. Deterministic v1 — the model-assisted
// boundary adjudication pass (rule confidence < 0.8 windows) is the upgrade
// path. Emits character offsets back into the canonical source text so every
// finding can cite exact spans.

export type SegmentedClause = {
  ordinal: number;
  level: number;
  heading: string | null;
  text: string;
  charStart: number;
  charEnd: number;
  segConfidence: number;
};

// Boundary grammars, most-specific first. Level reflects typical nesting:
// SECTION/ALL-CAPS headings (1), "A." / "1." enumerations (2), "(a)" (3).
const BOUNDARY_PATTERNS: { re: RegExp; level: number; confidence: number }[] = [
  { re: /^SECTION [IVXLC0-9]/, level: 1, confidence: 0.95 },
  { re: /^[A-Z][A-Z ,&'-]{3,60}\.?$/, level: 1, confidence: 0.85 },
  { re: /^[A-Z]\. \S/, level: 2, confidence: 0.9 },
  { re: /^\d{1,2}\. \S/, level: 2, confidence: 0.9 },
  { re: /^\([a-z]\) \S/, level: 3, confidence: 0.85 },
];

type Boundary = { line: number; level: number; heading: string | null; confidence: number };

function classifyLine(line: string): { level: number; confidence: number } | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  for (const p of BOUNDARY_PATTERNS) {
    if (p.re.test(trimmed)) return { level: p.level, confidence: p.confidence };
  }
  return null;
}

/**
 * Segment a form's canonical text into clauses. Splits at recognized
 * numbering/heading boundaries; text before the first boundary becomes a
 * preamble clause at reduced confidence. A text with no boundaries at all is
 * one whole-document clause at low confidence (candidate for quarantine when
 * below the 0.7 threshold — LLD §2.1 step 5).
 */
export function segmentClauses(sourceText: string): SegmentedClause[] {
  const lines = sourceText.split('\n');
  // Line start offsets into sourceText (split removes the \n separators).
  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }

  const boundaries: Boundary[] = [];
  for (let i = 0; i < lines.length; i++) {
    const hit = classifyLine(lines[i]);
    if (hit) {
      const trimmed = lines[i].trim();
      // Heading = the boundary line itself when it's short; long enumerated
      // paragraphs keep their text in the clause body instead.
      const heading = trimmed.length <= 80 ? trimmed : null;
      boundaries.push({ line: i, level: hit.level, heading, confidence: hit.confidence });
    }
  }

  const clauses: SegmentedClause[] = [];
  const pushClause = (
    startLine: number,
    endLine: number,
    level: number,
    heading: string | null,
    confidence: number,
  ) => {
    const charStart = lineStarts[startLine];
    const lastLine = lines[endLine];
    const charEnd = lineStarts[endLine] + lastLine.length;
    const text = sourceText.slice(charStart, charEnd).trim();
    if (text.length === 0) return;
    clauses.push({
      ordinal: clauses.length + 1,
      level,
      heading,
      text,
      charStart,
      charEnd,
      segConfidence: confidence,
    });
  };

  if (boundaries.length === 0) {
    pushClause(0, lines.length - 1, 1, null, 0.5);
    return clauses;
  }

  if (boundaries[0].line > 0) {
    // Preamble before the first recognized boundary.
    pushClause(0, boundaries[0].line - 1, 1, null, 0.75);
  }
  for (let b = 0; b < boundaries.length; b++) {
    const start = boundaries[b].line;
    const end = b + 1 < boundaries.length ? boundaries[b + 1].line - 1 : lines.length - 1;
    pushClause(start, end, boundaries[b].level, boundaries[b].heading, boundaries[b].confidence);
  }
  return clauses;
}

/** Version-level segmentation confidence = mean of clause confidences. */
export function meanSegConfidence(clauses: SegmentedClause[]): number {
  if (clauses.length === 0) return 0;
  return clauses.reduce((sum, c) => sum + c.segConfidence, 0) / clauses.length;
}
