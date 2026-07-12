/**
 * useVocabulary(domain) — the board's single vocabulary source (3-A). Loads
 * `GET /rationalization/vocabulary?domain=` (fixture fallback while Agent 2's
 * endpoint lands) and derives every lookup the board renders from: the row
 * axis, classification chips, status dots, lens modes, anatomy views, match
 * statuses and the legend. Nothing downstream hardcodes vocabulary arrays.
 */
import { useEffect, useMemo, useState } from 'react';
import { useCompany } from '../../lib/company';
import {
  classificationFrom,
  layerHintsFrom,
  layerMetaFrom,
  layersFrom,
  legendFrom,
  matchMetaFrom,
  optionsFrom,
  statusesFrom,
  type ClassificationMeta,
  type Domain,
  type Layer,
  type LayerMeta,
  type LegendItem,
  type MatchMeta,
  type StatusMeta,
  type VocabularyRow,
} from '../../lib/rationalization';
import { fetchVocabulary, type BoardSource } from './data';

export type Vocabulary = {
  rows: VocabularyRow[];
  /** Board row axis (5 IT layers / 11 product components). */
  layers: Layer[];
  layerHints: Record<string, string>;
  layerMeta: Record<string, LayerMeta>;
  classification: ClassificationMeta;
  statusMeta: StatusMeta;
  matchMeta: MatchMeta;
  modes: { value: string; label: string }[];
  views: { value: string; label: string }[];
  dispositions: { value: string; label: string }[];
  legend: LegendItem[];
  loading: boolean;
  source: BoardSource;
};

const EMPTY: VocabularyRow[] = [];

/** Load + derive the vocabulary for one domain (cached per company+domain). */
export function useVocabulary(domain: Domain): Vocabulary {
  const { companyId, loading: companyLoading } = useCompany();
  const [rows, setRows] = useState<VocabularyRow[]>(EMPTY);
  const [source, setSource] = useState<BoardSource>('fixture');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyLoading) return;
    let cancelled = false;
    setLoading(true);
    fetchVocabulary(domain, companyId).then(({ data, source: src }) => {
      if (cancelled) return;
      setRows(data);
      setSource(src);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [domain, companyId, companyLoading]);

  return useMemo(
    () => ({
      rows,
      layers: layersFrom(rows),
      layerHints: layerHintsFrom(rows),
      layerMeta: layerMetaFrom(rows),
      classification: classificationFrom(rows),
      statusMeta: statusesFrom(rows),
      matchMeta: matchMetaFrom(rows),
      modes: optionsFrom(rows, 'MODE'),
      views: optionsFrom(rows, 'VIEW'),
      dispositions: optionsFrom(rows, 'DISPOSITION'),
      legend: legendFrom(rows),
      loading,
      source,
    }),
    [rows, loading, source],
  );
}
