import { describe, expect, it } from 'vitest';
import { wordDiff } from '../../../../src/pages/workspace-map/forms/wordDiff';

/** Reassemble one pane's text from the segments. */
function pane(segments: ReturnType<typeof wordDiff>, side: 'a' | 'b'): string {
  const skip = side === 'a' ? 'add' : 'del';
  return segments
    .filter((s) => s.kind !== skip)
    .map((s) => s.text)
    .join('');
}

describe('wordDiff', () => {
  it('returns one same segment for identical text', () => {
    const segments = wordDiff('we will pay covered damages', 'we will pay covered damages');
    expect(segments).toEqual([{ kind: 'same', text: 'we will pay covered damages' }]);
  });

  it('marks a mid-sentence replacement as del + add and keeps the frame same', () => {
    const segments = wordDiff(
      'losses caused by an occurrence during the policy period',
      'losses arising out of an occurrence during the policy period',
    );
    expect(segments.map((s) => s.kind)).toContain('del');
    expect(segments.map((s) => s.kind)).toContain('add');
    const del = segments
      .filter((s) => s.kind === 'del')
      .map((s) => s.text.trim())
      .join(' ');
    const add = segments
      .filter((s) => s.kind === 'add')
      .map((s) => s.text.trim())
      .join(' ');
    expect(del).toBe('caused by');
    expect(add).toBe('arising out of');
    // The unchanged tail stays a shared segment.
    expect(segments[segments.length - 1]).toMatchObject({ kind: 'same' });
  });

  it('reconstructs each side exactly from its segments', () => {
    const a =
      'We will pay those sums that the insured becomes legally obligated to pay as damages.';
    const b = 'We shall pay all sums that any insured becomes legally obligated to pay as damages.';
    const segments = wordDiff(a, b);
    expect(pane(segments, 'a')).toBe(a);
    expect(pane(segments, 'b')).toBe(b);
  });

  it('treats case and reflowed whitespace as unchanged', () => {
    const segments = wordDiff('Coverage   Territory applies', 'coverage territory applies');
    expect(segments.every((s) => s.kind === 'same')).toBe(true);
  });

  it('merges adjacent tokens of the same kind into one segment', () => {
    const segments = wordDiff('alpha beta gamma', 'delta epsilon zeta');
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ kind: 'del' });
    expect(segments[1]).toMatchObject({ kind: 'add' });
  });
});
