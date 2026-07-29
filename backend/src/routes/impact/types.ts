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

/** Grade a base severity by change class: destructive keeps the base,
 *  restructure steps down one, adopt/hold steps down two. */
export function grade(base: ImpactSeverity, cls: ChangeClass): ImpactSeverity {
  const shift = cls === 'destructive' ? 0 : cls === 'restructure' ? 1 : 2;
  return LADDER[Math.min(LADDER.indexOf(base) + shift, LADDER.length - 1)];
}

export interface Impact {
  severity: ImpactSeverity;
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

/** Rationalization steer (Retain / Standardize / Retire) the walker derives
 *  from the subject's footprint — advisory, the reviewer still decides. */
export interface ImpactRecommendation {
  option: 'RETAIN' | 'STANDARDIZE' | 'RETIRE';
  reason: string;
}

export interface ImpactReport {
  subject: ImpactSubjectOut;
  changeType: ChangeType;
  changeClass: ChangeClass;
  summary: { breaking: number; high: number; medium: number; low: number; total: number };
  impacts: Impact[];
  recommendation?: ImpactRecommendation;
}

export function buildReport(
  subject: ImpactSubjectOut,
  changeType: ChangeType,
  impacts: Impact[],
  recommendation?: ImpactRecommendation,
): ImpactReport {
  const order = (s: ImpactSeverity) => LADDER.indexOf(s);
  const sorted = [...impacts].sort(
    (a, b) =>
      order(a.severity) - order(b.severity) ||
      a.category.localeCompare(b.category) ||
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
    ...(recommendation ? { recommendation } : {}),
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
