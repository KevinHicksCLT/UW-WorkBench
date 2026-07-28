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

/** One aligned stage slot across the compared flows: which lane has which
 *  stage in this phase. Lanes missing the slot render a gap — the difference
 *  is visible at a glance. */
export interface StageSlot {
  key: string;
  label: string;
  /** lane (column) id → that lane's stage id in this slot. */
  byLane: Map<string, string>;
}

function toks(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function similar(a: string, b: string): boolean {
  const ta = toks(a);
  const tb = toks(b);
  const sb = new Set(tb);
  const inter = ta.filter((x) => sb.has(x)).length;
  const union = new Set([...ta, ...tb]).size;
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  const headA = ta.at(-1);
  // Same head noun aligns the phase ("Claims Intake" ↔ "Submission Intake").
  const sameHead = !!headA && headA.length > 3 && headA === tb.at(-1);
  return (union ? inter / union : 0) >= 0.5 || la.includes(lb) || lb.includes(la) || sameHead;
}

/** Align each lane's ordered stages into shared vertical slots: stages whose
 *  names semantically match cluster into ONE slot (so similar phases line up
 *  across flows); unmatched stages keep their own slot in flow order. */
export function alignStages(
  lanes: { lane: string; stages: { id: string; name: string }[] }[],
): StageSlot[] {
  const slots: (StageSlot & { order: number })[] = [];
  lanes.forEach((laneDef, laneIdx) => {
    laneDef.stages.forEach((stage, stageIdx) => {
      const hit = slots.find((s) => !s.byLane.has(laneDef.lane) && similar(s.label, stage.name));
      if (hit) {
        hit.byLane.set(laneDef.lane, stage.id);
        // Shorter label wins — reads as the shared phase name.
        if (stage.name.length < hit.label.length) hit.label = stage.name;
      } else {
        slots.push({
          key: `slot:${laneIdx}:${stageIdx}:${stage.id}`,
          label: stage.name,
          byLane: new Map([[laneDef.lane, stage.id]]),
          order: stageIdx + laneIdx * 0.001,
        });
      }
    });
  });
  return slots.sort((a, b) => a.order - b.order);
}

// ── Two-stream step reconciliation (the Value-streams lens table) ───────────
// Each row is one canonical unit of work; the two streams' own steps sit side
// by side with their sequence inside the phase, and the verdict says whether
// the step merges 2→1, arrives at a different point in the flow, or exists in
// only one stream. All derived from the live L3→L4→L5 subtrees by name.

export interface ReconStep {
  id: string;
  /** 1-based position inside the stream's own phase flow. */
  seq: number;
  name: string;
  owner: string | null;
  apps: string[];
  /** The stream's own L4 sub-process the step sits under. */
  sub: string;
}

export type ReconVerdict = 'merge' | 'order' | 'onlyA' | 'onlyB';

export interface ReconRow {
  key: string;
  /** Canonical wording — the shorter of the two matched step names. */
  canonName: string;
  phaseKey: string;
  phaseLabel: string;
  a: ReconStep | null;
  b: ReconStep | null;
  verdict: ReconVerdict;
  /** |seqA − seqB| when both streams carry the step. */
  seqDelta: number;
}

export interface ReconPhase {
  key: string;
  label: string;
  rows: ReconRow[];
}

interface ReconLaneInput {
  id: string;
  stages: {
    id: string;
    name: string;
    subs: {
      name: string;
      tasks: { id: string; name: string; owner?: string | null; apps?: string[] }[];
    }[];
  }[];
}

/** A step arriving ≥ this many positions apart counts as resequenced. */
export const RESEQUENCE_DELTA = 2;

/**
 * Reconcile two streams phase by phase. Phases are the aligned stage slots
 * (alignStages); inside each phase the two streams' steps match on spineKey.
 * A step whose twin lives in a DIFFERENT phase still pairs up — it reconciles
 * into the phase where stream A (or, failing that, B) carries it, flagged as
 * order-differs.
 */
export function buildReconciliation(a: ReconLaneInput, b: ReconLaneInput): ReconPhase[] {
  const slots = alignStages([
    { lane: a.id, stages: a.stages },
    { lane: b.id, stages: b.stages },
  ]);

  interface Located {
    step: ReconStep;
    phaseIdx: number;
  }
  const locate = (lane: ReconLaneInput): Map<string, Located[]> => {
    const out = new Map<string, Located[]>();
    slots.forEach((slot, phaseIdx) => {
      const stageId = slot.byLane.get(lane.id);
      const stage = stageId ? lane.stages.find((s) => s.id === stageId) : null;
      if (!stage) return;
      let seq = 0;
      for (const sub of stage.subs) {
        for (const t of sub.tasks) {
          seq += 1;
          const k = spineKey(t.name);
          const g = out.get(k) ?? [];
          g.push({
            step: {
              id: t.id,
              seq,
              name: t.name,
              owner: t.owner ?? null,
              apps: t.apps ?? [],
              sub: sub.name,
            },
            phaseIdx,
          });
          out.set(k, g);
        }
      }
    });
    return out;
  };

  const aBy = locate(a);
  const bBy = locate(b);
  const phases: ReconPhase[] = slots.map((s) => ({ key: s.key, label: s.label, rows: [] }));
  const seen = new Set<string>();

  const push = (key: string, la: Located | null, lb: Located | null) => {
    const home = la ?? lb;
    if (!home) return;
    const phase = phases[home.phaseIdx];
    const sa = la?.step ?? null;
    const sb = lb?.step ?? null;
    const crossPhase = la && lb && la.phaseIdx !== lb.phaseIdx;
    const seqDelta = sa && sb ? Math.abs(sa.seq - sb.seq) : 0;
    const verdict: ReconVerdict =
      sa && sb
        ? crossPhase || seqDelta >= RESEQUENCE_DELTA
          ? 'order'
          : 'merge'
        : sa
          ? 'onlyA'
          : 'onlyB';
    const canonName =
      sa && sb ? (sa.name.length <= sb.name.length ? sa.name : sb.name) : home.step.name;
    phase.rows.push({
      key: `${phase.key}:${key}`,
      canonName,
      phaseKey: phase.key,
      phaseLabel: phase.label,
      a: sa,
      b: sb,
      verdict,
      seqDelta,
    });
  };

  for (const [key, las] of aBy) {
    seen.add(key);
    const lbs = bBy.get(key) ?? [];
    const n = Math.max(las.length, lbs.length);
    // Same name repeated inside a stream: each occurrence is its own row, so
    // the row key carries the occurrence index past the first.
    for (let i = 0; i < n; i += 1)
      push(i > 0 ? `${key}#${i}` : key, las[i] ?? null, lbs[i] ?? null);
  }
  for (const [key, lbs] of bBy) {
    if (seen.has(key)) continue;
    lbs.forEach((lb, i) => push(i > 0 ? `${key}#${i}` : key, null, lb));
  }

  for (const p of phases) {
    p.rows.sort(
      (x, y) =>
        (x.a?.seq ?? x.b?.seq ?? 0) - (y.a?.seq ?? y.b?.seq ?? 0) ||
        x.canonName.localeCompare(y.canonName),
    );
  }
  return phases.filter((p) => p.rows.length > 0);
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
