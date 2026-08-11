// Change-impact assessment vocabulary shared by the four workspace-lens
// walkers (process nodes / roles / applications / product elements). A report
// is DERIVED — computed on read from the live closures and junctions, never
// persisted — so it can run BEFORE a decision is saved and always reflects
// the current graph.

import {
  ALL_CHANGE_TYPES,
  classOf as taxonomyClassOf,
  emphasisOf,
  type ChangeClass,
} from './taxonomy.js';

export type { ChangeClass } from './taxonomy.js';

/** The original nine rationalization verbs — still the default vocabulary for
 *  the Applications and Products boards. The per-lens taxonomies (taxonomy.ts)
 *  extend this; ALL_CHANGE_TYPES is the full set the API accepts. */
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
/** A change type is any token in the cross-lens taxonomy — deliberately an open
 *  string so new lens tokens flow through without a compile-time union to keep
 *  in sync (the taxonomy registry is the single source of truth). */
// eslint-disable-next-line sonarjs/redundant-type-aliases
export type ChangeType = string;

/** Re-exported so the walkers keep importing class helpers from one place. */
export function classOf(t: ChangeType): ChangeClass {
  return taxonomyClassOf(t);
}

export type ImpactSeverity = 'BREAKING' | 'HIGH' | 'MEDIUM' | 'LOW';
const LADDER: ImpactSeverity[] = ['BREAKING', 'HIGH', 'MEDIUM', 'LOW'];

export { ALL_CHANGE_TYPES };

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
 *  restructure steps down one, additive/adopt step down two. */
export function grade(base: ImpactSeverity, cls: ChangeClass): ImpactSeverity {
  const shift = cls === 'destructive' ? 0 : cls === 'restructure' ? 1 : 2;
  return LADDER[Math.min(LADDER.indexOf(base) + shift, LADDER.length - 1)];
}

const bumpUp = (s: ImpactSeverity): ImpactSeverity => LADDER[Math.max(LADDER.indexOf(s) - 1, 0)];

/** The blast-radius bump: a change type grades impacts one rung HARDER inside
 *  the domains it emphasizes (Change Impact v2, Workstream A). `scope` lines
 *  are informational and never bumped. Applied centrally in `buildReport`, so
 *  every walker keeps emitting plain class-graded severities. For the legacy
 *  rationalization verbs (empty emphasis) this is a no-op, so the Applications
 *  and Products reports are byte-identical. */
export function emphasize(
  sev: ImpactSeverity,
  changeType: ChangeType,
  domain: ImpactDomain,
  category: string,
): ImpactSeverity {
  if (category === 'scope') return sev;
  return emphasisOf(changeType).includes(domain) ? bumpUp(sev) : sev;
}

/** Grade a base severity for a specific change type AND domain — the class
 *  shift followed by the emphasis bump. Equivalent to what `buildReport`
 *  applies to a class-graded line; exported for direct use and testing. */
export function weigh(
  base: ImpactSeverity,
  changeType: ChangeType,
  domain: ImpactDomain,
): ImpactSeverity {
  return emphasize(grade(base, classOf(changeType)), changeType, domain, 'weighted');
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

/** An auto-identified reviewer for the change — derived from the graph, never
 *  free-text. `kind` names the review function the documents prescribe
 *  (Process Owner, Business Architect, Operations Leader, Risk, Technology). */
export interface Stakeholder {
  kind:
    | 'Process Owner'
    | 'Business Architect'
    | 'Operations Leader'
    | 'Risk & Compliance'
    | 'Technology';
  name: string;
  why: string;
  entityType: string;
  entityId: string | null;
}

/** A named artifact produced by a lens-specific analysis stage (Producers,
 *  Consumers, Information Components, Milestone Impact, …). The deterministic
 *  walker fills what it can from the graph; AI-derived rows stay editable on
 *  the client. Kept generic so one panel renders every lens's stages. */
export interface ImpactSectionRow {
  label: string;
  detail?: string | null;
  entityType?: string;
  entityId?: string | null;
}
export interface ImpactSection {
  key: string;
  title: string;
  /** Short prose describing what this stage's artifact captures. */
  blurb?: string;
  rows: ImpactSectionRow[];
}

export interface ImpactReport {
  subject: ImpactSubjectOut;
  changeType: ChangeType;
  changeClass: ChangeClass;
  summary: { breaking: number; high: number; medium: number; low: number; total: number };
  impacts: Impact[];
  /** Auto-identified reviewers — present on every report (Workstream C). */
  stakeholders?: Stakeholder[];
  /** Lens-specific staged artifacts (Deliverable producers/consumers, Plan
   *  milestone impact, …). Absent for the flat quick-path reports. */
  sections?: ImpactSection[];
  score?: DecisionScore;
  goal?: GoalProgress;
}

export function buildReport(
  subject: ImpactSubjectOut,
  changeType: ChangeType,
  impacts: Impact[],
  extras?: {
    score?: DecisionScore;
    goal?: GoalProgress;
    stakeholders?: Stakeholder[];
    sections?: ImpactSection[];
  },
): ImpactReport {
  const order = (s: ImpactSeverity) => LADDER.indexOf(s);
  const dom = (d: ImpactDomain) => IMPACT_DOMAINS.indexOf(d);
  // Apply the change type's blast-radius emphasis before sorting/counting, so
  // the summary tallies and ordering reflect the weighted severities.
  const weighted = impacts.map((i) => {
    const sev = emphasize(i.severity, changeType, i.domain, i.category);
    return sev === i.severity ? i : { ...i, severity: sev };
  });
  const sorted = [...weighted].sort(
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
    ...(extras?.stakeholders?.length ? { stakeholders: extras.stakeholders } : {}),
    ...(extras?.sections?.length ? { sections: extras.sections } : {}),
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
