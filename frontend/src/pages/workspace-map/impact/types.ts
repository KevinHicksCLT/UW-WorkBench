// Shared vocabulary for the workspace's common change-impact assessment —
// the frontend mirror of backend routes/impact/types.ts. Every lens
// (Applications / Value streams / Roles / Products) builds an ImpactRequest
// from its own decision surface and shows the same prioritized report before
// the change is applied.

export type ImpactSeverity = 'BREAKING' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ChangeType =
  'RETIRE' | 'DROP' | 'DEPRECATE' | 'REPLACE' | 'MERGE' | 'CONSOLIDATE' | 'MOVE' | 'ADOPT' | 'HOLD';

export type ImpactSubject =
  | { kind: 'process-nodes'; nodeIds: string[] }
  | { kind: 'role'; roleId: string; taskIds?: string[] }
  | { kind: 'application'; applicationIds?: string[]; rationalizationAppIds?: string[] }
  | {
      kind: 'product-element';
      lobId: string;
      component: string;
      elementName?: string;
      componentNodeIds?: string[];
    };

export interface ImpactRequest {
  changeType: ChangeType;
  label?: string;
  subject: ImpactSubject;
}

export type ImpactDomain =
  'product' | 'technology' | 'data' | 'operational' | 'compliance' | 'testing';

export interface Impact {
  severity: ImpactSeverity;
  domain: ImpactDomain;
  category: string;
  entityType: string;
  entityId: string | null;
  entityName: string;
  description: string;
  count?: number;
}

/** The quantified decision aid — mirrors backend routes/impact/types.ts. The
 *  recommendation names one of the board's decision buttons outright. */
export interface DecisionScore {
  value: number;
  recommendation: 'STANDARDIZE' | 'RETAIN' | 'RETIRE';
  headline: string;
  factors: { label: string; detail: string }[];
}

/** Where the LOB stands against the normalization end goal. */
export interface GoalProgress {
  label: string;
  lobName: string;
  decided: number;
  need: number;
  pct: number;
}

export interface ImpactReport {
  subject: { kind: string; id: string | null; name: string; context: string | null };
  changeType: ChangeType;
  changeClass: 'destructive' | 'restructure' | 'adopt';
  summary: { breaking: number; high: number; medium: number; low: number; total: number };
  impacts: Impact[];
  score?: DecisionScore;
  goal?: GoalProgress;
}

/** Board-decision tones (ProductReviewList's Retain · Standardize · Retire). */
export const RECOMMENDATION_META: Record<
  DecisionScore['recommendation'],
  { label: string; tone: string; verb: string }
> = {
  STANDARDIZE: { label: 'Standardize', tone: '#4f46e5', verb: 'fold into the consolidated model' },
  RETAIN: { label: 'Retain', tone: '#0f766e', verb: 'keep as a product-specific variant' },
  RETIRE: { label: 'Retire', tone: '#dc2626', verb: 'drop from the target model' },
};

export const SEVERITY_META: Record<
  ImpactSeverity,
  { label: string; fg: string; bg: string; border: string }
> = {
  BREAKING: { label: 'Critical', fg: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
  HIGH: { label: 'High', fg: '#9a3412', bg: '#fff7ed', border: '#fed7aa' },
  MEDIUM: { label: 'Medium', fg: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  LOW: { label: 'Info', fg: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
};

/** Button/verb labels — what "Proceed" actually does. */
export const CHANGE_LABELS: Record<ChangeType, string> = {
  RETIRE: 'Retire',
  DROP: 'Drop',
  DEPRECATE: 'Deprecate',
  REPLACE: 'Replace',
  MERGE: 'Merge',
  CONSOLIDATE: 'Consolidate',
  MOVE: 'Move',
  ADOPT: 'Adopt',
  HOLD: 'Hold',
};

export const DESTRUCTIVE = new Set<ChangeType>(['RETIRE', 'DROP', 'DEPRECATE', 'REPLACE']);

/** The six knock-on impact domains, in display order. `areas` is the fixed
 *  checklist of what each domain covers — shown even when nothing was found,
 *  so an empty domain reads as "checked, no impact", not "not checked". */
export const DOMAIN_META: { key: ImpactDomain; label: string; areas: string }[] = [
  {
    key: 'product',
    label: 'Product Impact',
    areas: 'Which products, versions and states carry this today',
  },
  {
    key: 'technology',
    label: 'Technology Impact',
    areas: 'Systems that store, rate or process this today',
  },
  { key: 'data', label: 'Data Impact', areas: 'Data models, warehouse feeds and reporting' },
  {
    key: 'operational',
    label: 'Operational Impact',
    areas: 'Day-to-day underwriting, service, claims and billing work',
  },
  {
    key: 'compliance',
    label: 'Compliance Impact',
    areas: 'State filings, mandated forms and regulator notices',
  },
  {
    key: 'testing',
    label: 'Testing Impact',
    areas: 'Test scripts and regression packs that must be re-run',
  },
];

export const CATEGORY_LABELS: Record<string, string> = {
  tasks: 'Tasks & process',
  roles: 'Roles & people',
  applications: 'Applications & systems',
  deliverables: 'Deliverables',
  compliance: 'Compliance',
  standards: 'Standards',
  checklists: 'Checklists',
  initiatives: 'Initiatives',
  products: 'Product model',
  testing: 'Testing & verification',
  external: 'External parties',
  org: 'Organization',
  scope: 'Scope',
};
