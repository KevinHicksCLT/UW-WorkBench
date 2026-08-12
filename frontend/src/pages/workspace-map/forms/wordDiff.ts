// Word-level diff for a paired clause (the Beyond-Compare-style inline
// highlight). Tokenizes into words + whitespace runs (whitespace rides along
// with its word so highlights never split mid-gap), aligns with a classic LCS
// table, and merges adjacent segments of the same kind. Clauses are short
// (hundreds of tokens), so the O(n·m) table is fine; a hard cap bails to a
// whole-clause replace if a pathological input ever shows up.

export type DiffKind = 'same' | 'del' | 'add';

/** One run of text: unchanged, only in A (del), or only in B (add). */
export interface DiffSegment {
  kind: DiffKind;
  text: string;
}

const MAX_TOKENS = 2000;

/** Split into word tokens, each carrying its trailing whitespace. */
function tokenize(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

/** Comparison key: whitespace- and case-insensitive so reflowed text matches. */
function keyOf(token: string): string {
  return token.trim().toLowerCase();
}

function push(segments: DiffSegment[], kind: DiffKind, text: string): void {
  if (!text) return;
  const last = segments[segments.length - 1];
  if (last && last.kind === kind) last.text += text;
  else segments.push({ kind, text });
}

/**
 * Diff two clause texts into ordered segments. `del` segments render on the A
 * pane, `add` on the B pane, `same` on both.
 */
export function wordDiff(textA: string, textB: string): DiffSegment[] {
  const a = tokenize(textA);
  const b = tokenize(textB);
  const segments: DiffSegment[] = [];
  if (a.length + b.length > MAX_TOKENS) {
    push(segments, 'del', textA);
    push(segments, 'add', textB);
    return segments;
  }
  // LCS length table (a-index major), then walk back to emit segments.
  const cols = b.length + 1;
  const table = new Uint16Array((a.length + 1) * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * cols + j] =
        keyOf(a[i]) === keyOf(b[j])
          ? table[(i + 1) * cols + j + 1] + 1
          : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (keyOf(a[i]) === keyOf(b[j])) {
      push(segments, 'same', a[i]);
      i++;
      j++;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) {
      push(segments, 'del', a[i]);
      i++;
    } else {
      push(segments, 'add', b[j]);
      j++;
    }
  }
  while (i < a.length) push(segments, 'del', a[i++]);
  while (j < b.length) push(segments, 'add', b[j++]);
  return segments;
}
