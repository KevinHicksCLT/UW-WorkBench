// Pure derivation engine for the Roles lens — "one role at a time, its actual
// tasks, one decision". Given the compared roles' live task sets it computes:
//   • per-role facts (steps, streams, steps another compared role also does,
//     steps only it does) and a recommendation (consolidate into the target /
//     keep);
//   • per-step fates under the current decisions (stays here / already
//     covered / merges into the target / moves across as-is);
//   • the resulting TARGET ROLE — every surviving step with its provenance.
// Matching is name-based (spineKey), the same rule every spine lens uses.

import { spineKey } from './spineCompare';

export interface RoleTask {
  id: string;
  name: string;
  involvement: string;
  valueStream: string | null;
  l3: string | null;
  l4: string | null;
  apps: string[];
}

export interface RoleColumnInput {
  id: string;
  name: string;
  subtitle: string | null;
  tasks: RoleTask[];
}

export type RoleDecision = 'Consolidate' | 'Deprecate' | 'Keep';
export type StepDecision = 'Move' | 'Keep' | 'Drop';

export interface RoleFacts {
  steps: number;
  streams: number;
  /** Steps at least one OTHER compared role also does. */
  dup: number;
  /** Steps only this role does (among the compared set). */
  only: number;
}

export interface RoleRec {
  rec: 'CONSOLIDATE' | 'KEEP' | 'TARGET';
  /** Default decision the rec implies. */
  suggest: RoleDecision;
  reason: string;
}

export type StepFateKind = 'stays' | 'covered' | 'merges' | 'moves';

export interface StepFate {
  kind: StepFateKind;
  label: string;
  /** Short names of the other compared roles that also do the step. */
  also: string[];
}

export interface TargetStep {
  key: string;
  name: string;
  group: string;
  stream: string;
  /** Which compared roles contribute the step. */
  sources: { id: string; short: string }[];
  badge: 'merged' | 'moved' | 'unchanged';
}

export function roleShort(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function groupOf(t: RoleTask): string {
  return [t.l3, t.l4].filter(Boolean).join(' › ') || (t.valueStream ?? 'Unmapped');
}

/** Dedupe a role's task list to one row per task id (Owner wins). */
export function dedupeTasks(tasks: RoleTask[]): RoleTask[] {
  const perTask = new Map<string, RoleTask>();
  for (const t of tasks) {
    const cur = perTask.get(t.id);
    if (!cur || t.involvement === 'Owner') perTask.set(t.id, t);
  }
  return [...perTask.values()];
}

function keySetOf(col: RoleColumnInput): Set<string> {
  return new Set(col.tasks.map((t) => spineKey(t.name)));
}

/** Precompute each column's name-key set once — fate/facts are per-task hot paths. */
export function columnKeySets(columns: RoleColumnInput[]): Set<string>[] {
  return columns.map(keySetOf);
}

export function roleFacts(columns: RoleColumnInput[]): RoleFacts[] {
  const keySets = columns.map(keySetOf);
  return columns.map((col, ci) => {
    const others = keySets.filter((_, i) => i !== ci);
    let dup = 0;
    for (const t of col.tasks) {
      const k = spineKey(t.name);
      if (others.some((s) => s.has(k))) dup += 1;
    }
    return {
      steps: col.tasks.length,
      streams: new Set(col.tasks.map((t) => t.valueStream ?? 'Unmapped')).size,
      dup,
      only: col.tasks.length - dup,
    };
  });
}

/** The recommended target: the compared role whose task set covers the most of
 *  the others' work (ties break to the bigger role). */
export function recommendedTarget(columns: RoleColumnInput[]): number {
  const keySets = columns.map(keySetOf);
  let best = 0;
  let bestScore = -1;
  columns.forEach((col, ci) => {
    let coverage = 0;
    columns.forEach((other, oi) => {
      if (oi === ci) return;
      for (const t of other.tasks) if (keySets[ci].has(spineKey(t.name))) coverage += 1;
    });
    const score = coverage * 10_000 + col.tasks.length;
    if (score > bestScore) {
      bestScore = score;
      best = ci;
    }
  });
  return best;
}

export function roleRecs(
  columns: RoleColumnInput[],
  facts: RoleFacts[],
  targetIdx: number,
): RoleRec[] {
  const targetKeys = keySetOf(columns[targetIdx]);
  const targetName = columns[targetIdx].name;
  return columns.map((col, ci) => {
    if (ci === targetIdx) {
      return {
        rec: 'TARGET',
        suggest: 'Keep',
        reason: `The target role. It already covers more of the compared work than any other role, so the others fold into it — every task they hold either already exists here or moves across.`,
      };
    }
    const covered = col.tasks.filter((t) => targetKeys.has(spineKey(t.name))).length;
    const share = col.tasks.length ? covered / col.tasks.length : 0;
    if (share >= 0.4) {
      return {
        rec: 'CONSOLIDATE',
        suggest: 'Consolidate',
        reason: `${covered} of its ${col.tasks.length} steps are the same work ${targetName} already performs. The rest transfers across unchanged — nothing is lost, one role owns the chain.`,
      };
    }
    return {
      rec: 'KEEP',
      suggest: 'Keep',
      reason: `Only ${covered} of its ${col.tasks.length} steps overlap ${targetName} — ${facts[ci].only} steps are its own. Consolidating would move work without removing any.`,
    };
  });
}

export function stepFate(
  task: RoleTask,
  colIdx: number,
  columns: RoleColumnInput[],
  keySets: Set<string>[],
  going: boolean[],
  targetIdx: number,
): StepFate {
  const k = spineKey(task.name);
  const also = columns
    .filter((c, i) => i !== colIdx && keySets[i].has(k))
    .map((c) => roleShort(c.name));
  if (!going[colIdx]) return { kind: 'stays', label: 'STAYS HERE', also };
  const coveredBySurvivor = columns.some((c, i) => i !== colIdx && !going[i] && keySets[i].has(k));
  if (coveredBySurvivor) return { kind: 'covered', label: 'ALREADY COVERED', also };
  const twinGoing = columns.some((c, i) => i !== colIdx && going[i] && keySets[i].has(k));
  if (twinGoing)
    return {
      kind: 'merges',
      label: `MERGES INTO ${roleShort(columns[targetIdx].name)}`,
      also,
    };
  return { kind: 'moves', label: 'MOVES ACROSS AS-IS', also };
}

/** Build the resulting role: every surviving step in source order, deduped by
 *  name across the going roles, with provenance + badges. */
export function buildTarget(
  columns: RoleColumnInput[],
  going: boolean[],
  targetIdx: number,
  stepDecisions: Record<string, StepDecision>,
): { steps: TargetStep[]; merged: number; moved: number } {
  const seen = new Map<string, TargetStep>();
  const ordered: TargetStep[] = [];
  let merged = 0;
  let moved = 0;

  // Target first (its whole set survives), then each consolidating role's
  // steps fold in. Surviving non-target roles keep their own work — they
  // contribute nothing here.
  const order = [targetIdx, ...columns.map((_, i) => i).filter((i) => i !== targetIdx)];
  for (const ci of order) {
    const col = columns[ci];
    const isTarget = ci === targetIdx;
    if (!isTarget && !going[ci]) continue;
    for (const t of col.tasks) {
      const key = spineKey(t.name);
      if (!isTarget) {
        const dec = stepDecisions[`${col.id}:${t.id}`];
        if (dec === 'Drop' || dec === 'Keep') continue; // dropped, or stays behind
      }
      const existing = seen.get(key);
      if (existing) {
        if (!existing.sources.some((s) => s.id === col.id)) {
          existing.sources.push({ id: col.id, short: roleShort(col.name) });
          existing.badge = 'merged';
          merged += 1;
        }
        continue;
      }
      const movedIn = !isTarget;
      if (movedIn) moved += 1;
      const step: TargetStep = {
        key,
        name: t.name,
        group: groupOf(t),
        stream: t.valueStream ?? 'Unmapped',
        sources: [{ id: col.id, short: roleShort(col.name) }],
        badge: movedIn ? 'moved' : 'unchanged',
      };
      seen.set(key, step);
      ordered.push(step);
    }
  }
  return { steps: ordered, merged, moved };
}
