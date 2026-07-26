import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useBackHandler } from '../lib/navBack';
import { useViewState } from '../lib/viewState';
import { TocView, type TocRow } from './TocView';
import { ErrorMessage, LoadingState } from './ui';

// ProductDrillToc — the product spine as a TOC descent, mirroring OrgDrillToc:
// segment (product L1) → LOB / product family (L2) → product (L3) → version /
// jurisdiction (L4) → model components (L5). Level captions come from the
// company's ProductLevelType display names (user-editable), never hardcoded.
// Data: one /product-spine/table bootstrap fetch.

type ProductAttributes = {
  systems?: string;
  legacyVariants?: number;
  runsIn?: string;
  effective?: string;
  jurisdiction?: string;
  owner?: string;
  elements?: { element: string; livesIn: string; format: string }[];
};

export type ProductTreeNode = {
  id: string;
  name: string;
  levelNumber: number;
  description: string | null;
  status: string | null;
  sortOrder: number;
  attributes: ProductAttributes | null;
  rollup: Record<number, number>;
  children: ProductTreeNode[];
};

export type ProductTable = {
  company: { id: string; name: string };
  levels: { levelNumber: number; dbValue: string; name: string }[];
  totals: Record<number, number>;
  roots: ProductTreeNode[];
};

// Naive plural for user-editable level names ("Segment" → "segments").
const plural = (n: number, s: string) => `${n} ${n === 1 || /s$/i.test(s) ? s : `${s}s`}`;

export default function ProductDrillToc({ leading }: { leading?: ReactNode }) {
  const navigate = useNavigate();
  const [table, setTable] = useState<ProductTable | null>(null);
  const [error, setError] = useState('');
  // Drill stack persisted as node IDS (lib/viewState) so leaving the tab and
  // returning restores the exact descent; the nodes themselves are re-resolved
  // from the freshly loaded tree (a stale id past a rename/removal prunes the
  // descent at that level instead of pointing at a dead node).
  const [stackIds, setStackIds] = useViewState<string[]>('productModels.toc.stack', []);
  const stack = useMemo(() => {
    if (!table) return [];
    const out: ProductTreeNode[] = [];
    let source = table.roots;
    for (const id of stackIds) {
      const node = source.find((c) => c.id === id);
      if (!node) break;
      out.push(node);
      source = node.children;
    }
    return out;
  }, [table, stackIds]);

  useEffect(() => {
    api
      .get<ProductTable>('/product-spine/table')
      .then(setTable)
      .catch((e) => setError(e.message ?? 'Failed to load'));
  }, []);

  // The header's back button pops the drill one level (lib/navBack); at the
  // root it falls through to history. No in-page back pill.
  useBackHandler(() => {
    if (stackIds.length === 0) return false;
    setStackIds((s) => s.slice(0, -1));
    return true;
  });

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!table) return <LoadingState message="Loading product models…" className="animate-pulse" />;

  const levelName = (n: number, fallback: string) =>
    table.levels.find((l) => l.levelNumber === n)?.name ?? fallback;
  const lc = (n: number, fallback: string) => levelName(n, fallback).toLowerCase();

  const open = stack[stack.length - 1] ?? null;
  const depth = stack.length; // 0 = segments, 1 = LOBs, 2 = products, 3 = versions
  const rowsSource = open ? open.children : table.roots;
  const rowLevel = depth + 1;

  const push = (n: ProductTreeNode) => setStackIds((s) => [...s, n.id]);

  // Per-level row shaping: count column + extra column + click-through.
  const shape = (n: ProductTreeNode): TocRow => {
    switch (n.levelNumber) {
      case 1:
        return {
          id: n.id,
          name: n.name,
          count: n.rollup[3] ?? 0,
          extra: n.attributes?.systems ?? n.description,
          onClick: () => push(n),
        };
      case 2:
        return {
          id: n.id,
          name: n.name,
          count: n.rollup[3] ?? 0,
          extra: n.description,
          onClick: n.children.length ? () => push(n) : undefined,
        };
      case 3:
        return {
          id: n.id,
          name: n.name,
          count: n.rollup[4] ?? 0,
          extra: n.attributes?.runsIn ?? null,
          onClick: () => push(n),
        };
      case 4:
        return {
          id: n.id,
          name: n.name,
          count: n.rollup[5] ?? 0,
          extra: [n.status, n.attributes?.effective].filter(Boolean).join(' · ') || null,
          onClick: () => push(n),
        };
      default:
        // Model component — click through to its dedicated detail page (all
        // elements + where each lives today).
        return {
          id: n.id,
          name: n.name,
          count: n.attributes?.elements?.length ?? 0,
          extra: n.attributes?.owner ?? null,
          onClick: () => navigate(`/product-models/nodes/${n.id}`),
        };
    }
  };

  const rows = rowsSource.map(shape);

  // Column captions per drilled level.
  const CAPTIONS: Record<number, { count: string; extra: string; unit: string }> = {
    1: { count: levelName(3, 'Products'), extra: 'Where they run today', unit: lc(1, 'segments') },
    2: { count: levelName(3, 'Products'), extra: 'Applies to', unit: lc(2, 'product families') },
    3: { count: levelName(4, 'Versions'), extra: 'Runs in', unit: lc(3, 'products') },
    4: { count: levelName(5, 'Components'), extra: 'Status · effective', unit: lc(4, 'versions') },
    5: { count: 'Elements', extra: 'Maintained by', unit: lc(5, 'model components') },
  };
  const cap = CAPTIONS[rowLevel];

  const totals = open
    ? `${open.name} · ${rows.length} ${cap.unit}`
    : [
        plural(table.totals[1] ?? 0, lc(1, 'segment')),
        plural(table.totals[3] ?? 0, lc(3, 'product')),
        plural(table.totals[4] ?? 0, lc(4, 'version')),
      ].join(' · ');

  return (
    <TocView
      stateKey="productModels.toc"
      rows={rows}
      nameLabel={levelName(rowLevel, cap.unit)}
      countLabel={cap.count}
      extraLabel={cap.extra}
      unit={cap.unit}
      searchPlaceholder={`Search ${cap.unit}…`}
      leading={leading}
      totals={totals}
    />
  );
}
