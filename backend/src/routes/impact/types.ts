// Change-impact assessment vocabulary shared by the four workspace-lens
// walkers (process nodes / roles / applications / product elements). A report
// is DERIVED — computed on read from the live closures and junctions, never
// persisted — so it can run BEFORE a decision is saved and always reflects
// the current graph.

export const CHANGE_TYPES = [
  'RETIRE',
  'DROP',
  'DEPRECATE',
  'REPLACE',
  'MERGE',
  'CONSOLIDATE',
  'MOVE',
  'ADOPT',
  'HOLD',
] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

/** How disruptive the verb is — the same touched entity grades harder under a
 *  destructive verb (retire/drop) than under a consolidation or an adoption. */
export type ChangeClass = 'destructive' | 'restructure' | 'adopt';

export function classOf(t: ChangeType): ChangeClass {
  if (t === 'RETIRE' || t === 'DROP' || t === 'DEPRECATE' || t === 'REPLACE') return 'destructive';
  if (t === 'MERGE' || t === 'CONSOLIDATE' || t === 'MOVE') return 'restructure';
  return 'adopt';
}

export type ImpactSeverity = 'BREAKING' | 'HIGH' | 'MEDIUM' | 'LOW';
const LADDER: ImpactSeverity[] = ['BREAKING', 'HIGH', 'MEDIUM', 'LOW'];

/** The six knock-on impact domains every report is organized under (the
 *  "Impact Assessment" step of the outlier decision workflow). Every impact
 *  line belongs to exactly one; the panel shows all six so an empty domain
 *  reads as "checked — nothing there", not "not checked". */
export const IMPACT_DOMAINS = [
  'product',
  'technology',
  'data',
  'operational',
  'compliance',
  'testing',
] as const;
export type ImpactDomain = (typeof IMPACT_DOMAINS)[number];

/** Grade a base severity by change class: destructive keeps the base,
 *  restructure steps down one, adopt/hold steps down two. */
export function grade(base: ImpactSeverity, cls: ChangeClass): ImpactSeverity {
  const shift = cls === 'destructive' ? 0 : cls === 'restructure' ? 1 : 2;
  return LADDER[Math.min(LADDER.indexOf(base) + shift, LADDER.length - 1)];
}

export interface Impact {
  severity: ImpactSeverity;
  /** Which knock-on domain the line lands in. */
  domain: ImpactDomain;
  /** Grouping bucket: roles | tasks | applications | deliverables |
   *  compliance | standards | checklists | initiatives | products | scope */
  category: string;
  entityType: string;
  entityId: string | null;
  entityName: string;
  description: string;
  /** How many underlying rows this line aggregates (omitted for single rows). */
  count?: number;
}

export interface ImpactSubjectOut {
  kind: string;
  id: string | null;
  name: string;
  context: string | null;
}

/** The quantified decision aid: one 0–100 confidence figure and the action it
 *  points at, mirroring the board's decision buttons (Standardize · Retain ·
 *  Retire). Derived from carriage, in-force exposure and the report's own
 *  severity mix — deterministic and explainable via `factors`. */
export interface DecisionScore {
  value: number;
  recommendation: 'STANDARDIZE' | 'RETAIN' | 'RETIRE';
  headline: string;
  factors: { label: string; detail: string }[];
}

/** Where this decision sits against the normalization end goal — the
 *  consolidated multi-state policy the LOB is being folded into. */
export interface GoalProgress {
  label: string;
  lobName: string;
  decided: number;
  need: number;
  pct: number;
}

export interface ImpactReport {
  subject: ImpactSubjectOut;
  changeType: ChangeType;
  changeClass: ChangeClass;
  summary: { breaking: number; high: number; medium: number; low: number; total: number };
  impacts: Impact[];
  score?: DecisionScore;
  goal?: GoalProgress;
}

export function buildReport(
  subject: ImpactSubjectOut,
  changeType: ChangeType,
  impacts: Impact[],
  extras?: { score?: DecisionScore; goal?: GoalProgress },
): ImpactReport {
  const order = (s: ImpactSeverity) => LADDER.indexOf(s);
  const dom = (d: ImpactDomain) => IMPACT_DOMAINS.indexOf(d);
  const sorted = [...impacts].sort(
    (a, b) =>
      dom(a.domain) - dom(b.domain) ||
      order(a.severity) - order(b.severity) ||
      a.entityName.localeCompare(b.entityName),
  );
  const n = (s: ImpactSeverity) => sorted.filter((i) => i.severity === s).length;
  return {
    subject,
    changeType,
    changeClass: classOf(changeType),
    summary: {
      breaking: n('BREAKING'),
      high: n('HIGH'),
      medium: n('MEDIUM'),
      low: n('LOW'),
      total: sorted.length,
    },
    impacts: sorted,
    ...(extras?.score ? { score: extras.score } : {}),
    ...(extras?.goal ? { goal: extras.goal } : {}),
  };
}

/** Push up to `cap` itemized impacts; the remainder collapses into one
 *  aggregate line so a 300-task subtree doesn't produce a 300-row report. */
export function pushCapped<T>(
  impacts: Impact[],
  items: T[],
  cap: number,
  toImpact: (item: T) => Impact,
  rollup: (rest: T[]) => Impact,
): void {
  items.slice(0, cap).forEach((i) => impacts.push(toImpact(i)));
  if (items.length > cap) impacts.push(rollup(items.slice(cap)));
}
