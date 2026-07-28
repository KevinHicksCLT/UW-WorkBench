// Derivation for the Products lens GRID view — the whole portfolio, one row
// per version (Segment › LOB › Product offering › Version), one column per
// model component, every cell the count of element-level differences against
// the LOB's canonical version. Built on buildComparison, the same engine the
// three-column detail view uses — the grid is just its portfolio-wide face.

import { buildComparison, type Comparison, type LobOption, type VersionColumn } from './spine';

export interface GridCell {
  component: string;
  /** null when the version does not carry the component at all. */
  delta: number | null;
}

export type GridRec = 'canonical' | 'merge' | 'decide' | 'retire';

export const GRID_REC_META: Record<
  GridRec,
  { label: string; fg: string; bg: string; border: string; dot: string }
> = {
  canonical: {
    label: 'Keep — canonical',
    fg: '#166534',
    bg: '#dcfce7',
    border: '#bbf7d0',
    dot: '#16a34a',
  },
  merge: {
    label: 'Merge into canonical',
    fg: '#3730a3',
    bg: '#eef2ff',
    border: '#d6dcff',
    dot: '#4f46e5',
  },
  decide: { label: 'Decide', fg: '#92400e', bg: '#fffbeb', border: '#fde68a', dot: '#b45309' },
  retire: {
    label: 'Retire candidate',
    fg: '#991b1b',
    bg: '#fef2f2',
    border: '#fecaca',
    dot: '#dc2626',
  },
};

export interface GridRow {
  version: VersionColumn;
  lobId: string;
  lobName: string;
  segmentName: string;
  productName: string;
  canonical: boolean;
  /** The LOB's canonical version (its first version in spine order). */
  canonicalName: string;
  cells: GridCell[];
  elements: number;
  deltas: number;
  /** % of the LOB's normalized element groups this version agrees with. */
  match: number;
  rec: GridRec;
}

export interface GridModel {
  /** Column axis: every component name across the portfolio, by frequency. */
  components: string[];
  rows: GridRow[];
  /** Per-LOB comparisons, keyed by LOB id — the cell modal drills into these. */
  comparisons: Map<string, Comparison>;
  totals: { raw: number; normalized: number; byRec: Record<GridRec, number> };
}

export function recOf(canonical: boolean, match: number): GridRec {
  if (canonical) return 'canonical';
  if (match >= 85) return 'merge';
  if (match >= 60) return 'decide';
  return 'retire';
}

export function buildGridModel(lobs: LobOption[]): GridModel {
  const freq = new Map<string, number>();
  const rows: GridRow[] = [];
  const comparisons = new Map<string, Comparison>();
  let raw = 0;
  let normalized = 0;

  for (const lob of lobs) {
    const comparison = buildComparison(lob.versions);
    comparisons.set(lob.id, comparison);
    raw += comparison.rawCount;
    normalized += comparison.normalizedCount;
    const canonical = lob.versions[0];
    const totalGroups = comparison.rows.reduce((n, r) => n + r.groups.length, 0);

    for (const comp of comparison.axis) freq.set(comp, (freq.get(comp) ?? 0) + 1);

    for (const v of lob.versions) {
      const cells: GridCell[] = comparison.axis.map((component) => {
        const row = comparison.rows.find((r) => r.component === component);
        if (!row || !v.components.has(component)) return { component, delta: null };
        // Difference vs the canonical version: an element group counts when
        // one of the pair carries it and the other does not.
        let delta = 0;
        for (const g of row.groups) {
          const mine = g.perVersion[v.id] != null;
          const canon = g.perVersion[canonical.id] != null;
          if (mine !== canon) delta += 1;
        }
        return { component, delta };
      });
      const deltas = cells.reduce((n, c) => n + (c.delta ?? 0), 0);
      const elements = [...v.components.values()].reduce((n, c) => n + c.elements.length, 0);
      const match =
        v.id === canonical.id
          ? 100
          : Math.max(0, Math.round(100 - (totalGroups ? (deltas / totalGroups) * 100 : 0)));
      const isCanonical = v.id === canonical.id;
      rows.push({
        version: v,
        lobId: lob.id,
        lobName: lob.name,
        segmentName: lob.segmentName,
        productName: v.productName,
        canonical: isCanonical,
        canonicalName: `${canonical.productName} · ${canonical.name}`,
        cells,
        elements,
        deltas,
        match,
        rec: recOf(isCanonical, match),
      });
    }
  }

  const components = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name)
    .slice(0, 12);

  // Re-project each row's cells onto the shared axis.
  for (const row of rows) {
    const byName = new Map(row.cells.map((c) => [c.component, c]));
    row.cells = components.map((component) => byName.get(component) ?? { component, delta: null });
  }

  const byRec: Record<GridRec, number> = { canonical: 0, merge: 0, decide: 0, retire: 0 };
  for (const r of rows) byRec[r.rec] += 1;

  return { components, rows, comparisons, totals: { raw, normalized, byRec } };
}

export type GridGroupMode = 'spine' | 'variance';

export interface GridGroup {
  key: string;
  name: string;
  canonNote: string;
  subs: { key: string; name: string; rows: GridRow[] }[];
  count: number;
}

export function groupGridRows(rows: GridRow[], mode: GridGroupMode): GridGroup[] {
  const groups: GridGroup[] = [];
  const sorted = [...rows].sort((a, b) =>
    mode === 'variance'
      ? a.match - b.match
      : a.segmentName.localeCompare(b.segmentName) ||
        a.lobName.localeCompare(b.lobName) ||
        a.productName.localeCompare(b.productName) ||
        a.version.name.localeCompare(b.version.name),
  );
  for (const r of sorted) {
    const gKey =
      mode === 'variance'
        ? r.match >= 85
          ? 'Near-identical to canonical (≥85% match)'
          : r.match >= 60
            ? 'Moderate variance (60–84%)'
            : 'High variance (<60%)'
        : r.segmentName;
    let g = groups.find((x) => x.key === gKey);
    if (!g) {
      g = { key: gKey, name: gKey, canonNote: '', subs: [], count: 0 };
      groups.push(g);
    }
    g.count += 1;
    if (!g.canonNote && r.canonical) g.canonNote = `canonical: ${r.canonicalName}`;
    const sKey = mode === 'variance' ? r.segmentName : r.lobName;
    let s = g.subs.find((x) => x.key === sKey);
    if (!s) {
      s = { key: sKey, name: sKey, rows: [] };
      g.subs.push(s);
    }
    s.rows.push(r);
  }
  return groups;
}
