// The board's vocabulary feed (plan §3-A): WorkspaceMap mounts ONE
// BoardVocabProvider (one fetch via lib/useVocabulary), and the columns read
// typed conveniences from context instead of hardcoded constants. The `Layer`
// TS union stays the compile-time superset for type safety — the DB drives
// the runtime order, titles and colors.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useVocabulary, type Vocabulary } from '../../lib/useVocabulary';
import { LegendItem } from './LensBar';
import { LAYERS, type Layer } from './types';

export interface BoardVocab {
  /** Raw lookup — any (domain, kind, token) the board needs ad hoc. */
  vocab: Vocabulary;
  /** APPLICATION row axis in DB order (falls back to the LAYERS constant). */
  layers: readonly Layer[];
  /** Normalize-section title — what the layer's component covers. */
  layerTitle(layer: Layer): string;
  /** Brownfield layer-section subtitle ("what screens capture" …). */
  layerSubtitle(layer: Layer): string;
  /** Greenfield target lifecycle chip (Planned / Building / Live). */
  targetStatus(token: string): { label: string; color: string };
  /** Board legend (lens bar), from vocabulary meta.legend rows. */
  legend: { color: string; label: string }[];
}

const isLayer = (t: string): t is Layer => (LAYERS as readonly string[]).includes(t);

/** Greenfield lifecycle chips have no seeded vocabulary rows (the STATUS kind
 *  is the migration ladder) — the board's green family stays the fallback. */
const TARGET_STATUS_FALLBACK: Record<string, string> = {
  Planned: '#a7f3d0',
  Building: '#34d399',
  Live: '#10b981',
};

/** Pure builder (unit-tested): BoardVocab conveniences over one lookup. */
export function boardVocabOf(vocab: Vocabulary): BoardVocab {
  const dbLayers = vocab.tokens('APPLICATION', 'LAYER').filter(isLayer);
  const layers: readonly Layer[] = dbLayers.length > 0 ? dbLayers : LAYERS;
  // The v3 wireframe's top-bar legend: the classification meanings plus the
  // AUTO/REVIEW verdicts. HELD's legend line surfaces on its cards instead —
  // the toolbar only fits the four the design comp shows.
  const legend = (['CLASSIFICATION', 'MATCH_STATUS'] as const).flatMap((kind) =>
    vocab.rows('APPLICATION', kind).flatMap((r) => {
      if (kind === 'MATCH_STATUS' && r.token === 'HELD') return [];
      const label = vocab.metaString('APPLICATION', kind, r.token, 'legend');
      if (!label) return [];
      return [{ color: vocab.colorHexOf('APPLICATION', kind, r.token) ?? '#525252', label }];
    }),
  );
  return {
    vocab,
    layers,
    legend,
    layerTitle: (l) => vocab.metaString('APPLICATION', 'SCAFFOLD', l, 'component') ?? l,
    layerSubtitle: (l) => vocab.metaString('APPLICATION', 'LAYER', l, 'descriptor') ?? '',
    targetStatus: (token) => {
      const row = vocab.get('APPLICATION', 'STATUS', token);
      return {
        label: row?.label ?? token,
        color: row
          ? (vocab.colorHexOf('APPLICATION', 'STATUS', token) ?? '#047857')
          : (TARGET_STATUS_FALLBACK[token] ?? TARGET_STATUS_FALLBACK.Planned),
      };
    },
  };
}

const Ctx = createContext<BoardVocab | null>(null);

export function BoardVocabProvider({ children }: { children: ReactNode }) {
  const { vocab } = useVocabulary();
  const value = useMemo(() => boardVocabOf(vocab), [vocab]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBoardVocab(): BoardVocab {
  const v = useContext(Ctx);
  if (!v) throw new Error('useBoardVocab must be used within a BoardVocabProvider');
  return v;
}

/** The lens-bar legend, rendered from vocabulary rows (meta.legend). */
export function BoardLegend() {
  const { legend } = useBoardVocab();
  return (
    <>
      {legend.map((l) => (
        <LegendItem key={l.label} color={l.color} label={l.label} />
      ))}
    </>
  );
}
