// Pure comparison engine for the Value-streams / Roles workspace lenses.
// Columns are picked spine slices (a value stream's tasks, a role's tasks);
// everything below is computed on the fly from the real task names:
//   • WITHIN a column: the same step appearing several times (different L4s /
//     involvements) — consolidate inside the stream or role.
//   • ACROSS columns: the same step appearing in 2+ compared columns —
//     combine across value streams / org units.
// Nothing is authored; any pair of streams or roles compares the same way.

export interface SpineItem {
  id: string;
  name: string;
  /** Which compared column (stream/role id) the item belongs to. */
  column: string;
  /** Grouping row inside the column (L3 area, L4 sub-process, value stream…). */
  group: string;
  /** Optional badge (e.g. Owner / Participant for role tasks). */
  tag?: string | null;
}

/** Loose name key — case/punctuation-insensitive; trailing plural collapsed. */
export function spineKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/s\b/g, '');
}

export interface SharedGroup {
  key: string;
  name: string;
  /** column id → its matching items. */
  byColumn: Map<string, SpineItem[]>;
  columns: number;
  total: number;
}

export interface WithinDup {
  column: string;
  key: string;
  name: string;
  items: SpineItem[];
}

export interface ColumnStats {
  column: string;
  total: number;
  shared: number;
  withinDup: number;
  unique: number;
}

export interface SpineComparison {
  shared: SharedGroup[];
  withinDups: WithinDup[];
  stats: ColumnStats[];
  /** id → classification for row badges. */
  markOf: Map<string, 'shared' | 'dup' | 'unique'>;
  current: number;
  normalized: number;
}

export function compareSpineColumns(items: SpineItem[]): SpineComparison {
  const byKey = new Map<string, SpineItem[]>();
  for (const it of items) {
    const k = spineKey(it.name);
    const g = byKey.get(k) ?? [];
    g.push(it);
    byKey.set(k, g);
  }

  const shared: SharedGroup[] = [];
  const withinDups: WithinDup[] = [];
  const markOf = new Map<string, 'shared' | 'dup' | 'unique'>();
  let normalized = 0;

  for (const [key, group] of byKey) {
    const byColumn = new Map<string, SpineItem[]>();
    for (const it of group) {
      const g = byColumn.get(it.column) ?? [];
      g.push(it);
      byColumn.set(it.column, g);
    }
    normalized += 1;
    if (byColumn.size > 1) {
      shared.push({
        key,
        name: group[0].name,
        byColumn,
        columns: byColumn.size,
        total: group.length,
      });
      for (const it of group) markOf.set(it.id, 'shared');
    } else {
      const only = [...byColumn.entries()][0];
      if (only[1].length > 1) {
        withinDups.push({ column: only[0], key, name: group[0].name, items: only[1] });
        for (const it of only[1]) markOf.set(it.id, 'dup');
      } else {
        markOf.set(group[0].id, 'unique');
      }
    }
  }

  shared.sort((a, b) => b.columns - a.columns || b.total - a.total || a.name.localeCompare(b.name));
  withinDups.sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));

  const columns = [...new Set(items.map((i) => i.column))];
  const stats: ColumnStats[] = columns.map((c) => {
    const mine = items.filter((i) => i.column === c);
    const sharedCount = mine.filter((i) => markOf.get(i.id) === 'shared').length;
    const dupCount = mine.filter((i) => markOf.get(i.id) === 'dup').length;
    return {
      column: c,
      total: mine.length,
      shared: sharedCount,
      withinDup: dupCount,
      unique: mine.length - sharedCount - dupCount,
    };
  });

  return { shared, withinDups, stats, markOf, current: items.length, normalized };
}
