// boardVocabOf — the board-facing conveniences over the vocabulary lookup:
// runtime layer axis (typed superset filter), section titles/subtitles,
// greenfield lifecycle chips and the lens-bar legend.
import { describe, expect, it } from 'vitest';
import { buildVocabulary, type VocabRow } from '../../../src/lib/useVocabulary';
import { boardVocabOf } from '../../../src/pages/workspace-map/vocabulary';
import { LAYERS } from '../../../src/pages/workspace-map/types';

const layerRow = (token: string, sortOrder: number): VocabRow => ({
  domain: 'APPLICATION',
  kind: 'LAYER',
  token,
  label: token,
  color: null,
  sortOrder,
  meta: null,
});

describe('boardVocabOf', () => {
  const bv = boardVocabOf(buildVocabulary(null));

  it('serves the layer axis in vocabulary order', () => {
    expect(bv.layers).toEqual([...LAYERS]);
  });

  it('re-orders the axis from DB rows, dropping tokens outside the Layer union', () => {
    const reordered = boardVocabOf(
      buildVocabulary([layerRow('Data', 0), layerRow('UI', 1), layerRow('Quantum', 2)]),
    );
    expect(reordered.layers).toEqual(['Data', 'UI']);
  });

  it('falls back to the LAYERS constant when no DB token is a known Layer', () => {
    const alien = boardVocabOf(buildVocabulary([layerRow('Quantum', 0)]));
    expect(alien.layers).toEqual([...LAYERS]);
  });

  it('titles and subtitles each layer from vocabulary meta', () => {
    expect(bv.layerTitle('UI')).toBe('UI Components / Fields');
    expect(bv.layerTitle('Infrastructure')).toBe('Infra Security Rules & Logs');
    expect(bv.layerSubtitle('Business Service')).toBe('processing & validations');
  });

  it('colors greenfield lifecycle chips, vocabulary row first then fallback', () => {
    // No seeded row for the lifecycle tokens — the green family fallback.
    expect(bv.targetStatus('Live')).toEqual({ label: 'Live', color: '#10b981' });
    expect(bv.targetStatus('Planned')).toEqual({ label: 'Planned', color: '#a7f3d0' });
    expect(bv.targetStatus('???').color).toBe('#a7f3d0');
    // A STATUS row of the same token wins when the DB defines one.
    const withRow = boardVocabOf(
      buildVocabulary([
        {
          domain: 'APPLICATION',
          kind: 'STATUS',
          token: 'Building',
          label: 'In Build',
          color: 'sky',
          sortOrder: 0,
          meta: null,
        },
      ]),
    );
    expect(withRow.targetStatus('Building')).toEqual({ label: 'In Build', color: '#0ea5e9' });
  });

  it('builds the legend from meta.legend rows (classifications + AUTO/REVIEW)', () => {
    expect(bv.legend.map((l) => l.label)).toEqual([
      'correct — stays',
      'needs to move',
      'retire with sign-off',
      '2→1 semantically same · auto',
      'REVIEW semantically different',
    ]);
    expect(bv.legend[0].color).toBe('#10b981');
  });
});
