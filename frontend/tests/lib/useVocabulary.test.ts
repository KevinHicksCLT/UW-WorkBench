// useVocabulary — the workspace-board vocabulary lookup: baked-in fallback
// (the previously hardcoded constants), per-group server overlay, color/meta
// resolution, and the fetch hook's fallback-while-loading contract.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../src/lib/api', () => ({ api: apiMock }));

import {
  buildVocabulary,
  useVocabulary,
  TONE_HEX,
  type VocabRow,
} from '../../src/lib/useVocabulary';

const serverRow = (over: Partial<VocabRow>): VocabRow => ({
  domain: 'APPLICATION',
  kind: 'LAYER',
  token: 'X',
  label: 'X',
  color: null,
  sortOrder: 0,
  meta: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildVocabulary — fallback', () => {
  const vocab = buildVocabulary(null);

  it('serves the APPLICATION layer axis in its hardcoded order', () => {
    expect(vocab.tokens('APPLICATION', 'LAYER')).toEqual([
      'UI',
      'Integration',
      'Business Service',
      'Data',
      'Infrastructure',
    ]);
  });

  it('serves the 11-component PRODUCT_MODEL axis', () => {
    expect(vocab.tokens('PRODUCT_MODEL', 'LAYER')).toHaveLength(11);
    expect(vocab.tokens('PRODUCT_MODEL', 'LAYER')[0]).toBe('Party & Roles');
  });

  it('resolves colors via meta.dot first, then the tone name', () => {
    // LAYER rows carry an explicit dot hex.
    expect(vocab.colorHexOf('APPLICATION', 'LAYER', 'Business Service')).toBe('#d97706');
    // MATCH_STATUS rows carry only a tone name.
    expect(vocab.colorHexOf('APPLICATION', 'MATCH_STATUS', 'AUTO')).toBe(TONE_HEX.emerald);
  });

  it('reads string meta fields and ignores non-strings', () => {
    expect(vocab.metaString('APPLICATION', 'SCAFFOLD', 'Data', 'component')).toBe(
      'Data Schema & Payload',
    );
    expect(vocab.metaString('APPLICATION', 'LAYER', 'UI', 'descriptor')).toBe(
      'what screens capture',
    );
    expect(vocab.metaString('APPLICATION', 'LAYER', 'UI', 'missing')).toBeNull();
  });

  it('degrades unknown tokens to themselves with no color', () => {
    expect(vocab.get('APPLICATION', 'STATUS', 'Nope')).toBeUndefined();
    expect(vocab.labelOf('APPLICATION', 'STATUS', 'Nope')).toBe('Nope');
    expect(vocab.colorHexOf('APPLICATION', 'STATUS', 'Nope')).toBeNull();
  });
});

describe('buildVocabulary — server overlay', () => {
  it('replaces a (domain, kind) group wholesale and re-sorts by sortOrder', () => {
    const vocab = buildVocabulary([
      serverRow({ token: 'Data', label: 'Data & Storage', sortOrder: 0 }),
      serverRow({ token: 'UI', label: 'Experience', sortOrder: 1 }),
    ]);
    expect(vocab.tokens('APPLICATION', 'LAYER')).toEqual(['Data', 'UI']);
    expect(vocab.labelOf('APPLICATION', 'LAYER', 'UI')).toBe('Experience');
    // A dropped fallback row is gone — the server owns the group now.
    expect(vocab.get('APPLICATION', 'LAYER', 'Integration')).toBeUndefined();
  });

  it('keeps fallback groups the server did not return', () => {
    const vocab = buildVocabulary([serverRow({ kind: 'STATUS', token: 'Live', sortOrder: 0 })]);
    expect(vocab.tokens('APPLICATION', 'STATUS')).toEqual(['Live']);
    // LAYER group untouched by the server keeps its fallback rows.
    expect(vocab.tokens('APPLICATION', 'LAYER')).toHaveLength(5);
    expect(vocab.tokens('PRODUCT_MODEL', 'CLASSIFICATION')).toEqual([
      'Common',
      'Segment',
      'Geography',
      'Eliminate',
    ]);
  });
});

describe('useVocabulary', () => {
  it('serves the fallback while loading, then the server rows', async () => {
    let resolve!: (v: unknown) => void;
    apiMock.get.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useVocabulary());

    expect(result.current.loading).toBe(true);
    // Fallback answers immediately — the board never renders from nothing.
    expect(result.current.vocab.tokens('APPLICATION', 'LAYER')).toHaveLength(5);

    resolve({
      vocabulary: [serverRow({ token: 'UI', label: 'Experience', sortOrder: 0 })],
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiMock.get).toHaveBeenCalledWith('/rationalization/vocabulary');
    expect(result.current.vocab.tokens('APPLICATION', 'LAYER')).toEqual(['UI']);
  });

  it('keeps the fallback when the fetch fails', async () => {
    apiMock.get.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useVocabulary());
    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.vocab.tokens('APPLICATION', 'LAYER')).toHaveLength(5);
  });
});
