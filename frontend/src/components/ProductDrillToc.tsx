import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useBackHandler } from '../lib/navBack';
import { useViewState } from '../lib/viewState';
import { TocView, type TocRow } from './TocView';
import { ErrorMessage, LoadingState, Select } from './ui';

// ProductDrillToc — the product spine as a TOC descent with the document's
// separation: the descent is segment (L1) → LOB / product family (L2) →
// PRODUCT (L3), and stops there. Versions and jurisdictions are FILTERS on
// this page (state, status), never drill levels — clicking a product opens
// its model view (Forms · Rating · Pricing · Underwriting Rules · Filings ·
// Lifecycle Behavior). Level captions come from the company's
// ProductLevelType display names. Data: one /product-spine/table bootstrap.

type ProductAttributes = {
  systems?: string;
  legacyVariants?: number;
  runsIn?: string;
  effective?: string;
  jurisdiction?: string;
  owner?: string;
  states?: string[];
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

/** Jurisdictions a version node covers — attributes.states for a countrywide
 *  version, the parsed US-XX token for a state-form version. */
function versionStates(v: ProductTreeNode): string[] {
  if (Array.isArray(v.attributes?.states) && v.attributes.states.length > 0)
    return v.attributes.states.filter((s): s is string => typeof s === 'string');
  const parsed = /US-([A-Z]{2})\b/.exec(v.name)?.[1];
  return parsed ? [parsed] : [];
}

/** Does a PRODUCT node survive the version-level filters? A product shows if
 *  ANY of its versions matches both the state and the status pick. */
function productMatches(p: ProductTreeNode, state: string, status: string): boolean {
  if (!state && !status) return true;
  return p.children.some(
    (v) => (!state || versionStates(v).includes(state)) && (!status || (v.status ?? '') === status),
  );
}

export default function ProductDrillToc({ leading }: { leading?: ReactNode }) {
  const navigate = useNavigate();
  const [table, setTable] = useState<ProductTable | null>(null);
  const [error, setError] = useState('');
  // Version-level filters — the page's answer to "where are the versions and
  // jurisdictions?": behind filters, not levels. Persisted per session.
  const [state, setState] = useViewState<string>('productModels.toc.state', '');
  const [status, setStatus] = useViewState<string>('productModels.toc.status', '');
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
    // The descent never goes past the product level anymore (older sessions
    // may have persisted a deeper stack).
    return out.slice(0, 2);
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

  // Filter option pools — every covered jurisdiction and every version status
  // in the whole spine (stable regardless of the drill position).
  const { stateOptions, statusOptions } = useMemo(() => {
    const states = new Set<string>();
    const statuses = new Set<string>();
    const walk = (nodes: ProductTreeNode[]) => {
      for (const n of nodes) {
        if (n.levelNumber === 4) {
          for (const s of versionStates(n)) states.add(s);
          if (n.status) statuses.add(n.status);
        }
        walk(n.children);
      }
    };
    if (table) walk(table.roots);
    return {
      stateOptions: [...states].sort((a, b) => a.localeCompare(b)),
      statusOptions: [...statuses].sort((a, b) => a.localeCompare(b)),
    };
  }, [table]);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!table) return <LoadingState message="Loading product models…" className="animate-pulse" />;

  const levelName = (n: number, fallback: string) =>
    table.levels.find((l) => l.levelNumber === n)?.name ?? fallback;
  const lc = (n: number, fallback: string) => levelName(n, fallback).toLowerCase();

  const open = stack[stack.length - 1] ?? null;
  const depth = stack.length; // 0 = segments, 1 = LOBs, 2 = products
  const rowsSource = open ? open.children : table.roots;
  const rowLevel = depth + 1;

  const push = (n: ProductTreeNode) => setStackIds((s) => [...s.slice(0, 2), n.id].slice(0, 2));

  // Filtered product count under any node (segment / LOB), honoring the
  // version-level filters so the counts always match what a click reveals.
  const productCount = (n: ProductTreeNode): number => {
    if (n.levelNumber === 3) return productMatches(n, state, status) ? 1 : 0;
    return n.children.reduce((sum, c) => sum + productCount(c), 0);
  };

  // Per-level row shaping: count column + extra column + click-through.
  const shape = (n: ProductTreeNode): TocRow | null => {
    switch (n.levelNumber) {
      case 1:
        return {
          id: n.id,
          name: n.name,
          count: productCount(n),
          extra: n.attributes?.systems ?? n.description,
          onClick: () => push(n),
        };
      case 2: {
        const count = productCount(n);
        if ((state || status) && count === 0) return null;
        return {
          id: n.id,
          name: n.name,
          count,
          extra: n.description,
          onClick: n.children.length ? () => push(n) : undefined,
        };
      }
      default: {
        // PRODUCT — the deepest TOC level. The count is its jurisdictional
        // reach; the click opens the model view (Forms · Rating · Pricing ·
        // Underwriting Rules · Filings · Lifecycle Behavior).
        if (!productMatches(n, state, status)) return null;
        const covered = new Set(n.children.flatMap(versionStates));
        return {
          id: n.id,
          name: n.name,
          count: covered.size,
          extra: n.attributes?.runsIn ?? null,
          onClick: () => navigate(`/product-models/nodes/${n.id}`),
        };
      }
    }
  };

  const rows = rowsSource.map(shape).filter((r): r is TocRow => r !== null);

  // Column captions per drilled level.
  const CAPTIONS: Record<number, { count: string; extra: string; unit: string }> = {
    1: { count: levelName(3, 'Products'), extra: 'Where they run today', unit: lc(1, 'segments') },
    2: { count: levelName(3, 'Products'), extra: 'Applies to', unit: lc(2, 'product families') },
    3: { count: 'Jurisdictions', extra: 'Runs in', unit: lc(3, 'products') },
  };
  const cap = CAPTIONS[Math.min(rowLevel, 3)];

  const filterNote = [
    state ? (/^[A-Z]{2}$/.test(state) ? `US-${state}` : state) : null,
    status ? status : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const totals = open
    ? `${open.name} · ${rows.length} ${cap.unit}${filterNote ? ` · ${filterNote}` : ''}`
    : [
        plural(table.totals[1] ?? 0, lc(1, 'segment')),
        plural(table.totals[3] ?? 0, lc(3, 'product')),
        plural(table.totals[4] ?? 0, lc(4, 'version')),
        filterNote,
      ]
        .filter(Boolean)
        .join(' · ');

  // The version/jurisdiction dimension, as page FILTERS (the document's
  // separation: products are the level, jurisdictions are a lens).
  const filters = (
    <div className="flex items-center gap-2">
      <Select
        aria-label="Filter by jurisdiction"
        value={state}
        onChange={(e) => setState(e.target.value)}
        className="text-xs !py-1"
      >
        <option value="">All jurisdictions</option>
        {stateOptions.map((s) => (
          <option key={s} value={s}>
            {/^[A-Z]{2}$/.test(s) ? `US-${s}` : s}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by version status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="text-xs !py-1"
      >
        <option value="">All statuses</option>
        {statusOptions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
    </div>
  );

  return (
    <TocView
      stateKey="productModels.toc"
      rows={rows}
      nameLabel={levelName(Math.min(rowLevel, 3), cap.unit)}
      countLabel={cap.count}
      extraLabel={cap.extra}
      unit={cap.unit}
      searchPlaceholder={`Search ${cap.unit}…`}
      leading={leading}
      totals={totals}
      actions={filters}
    />
  );
}
