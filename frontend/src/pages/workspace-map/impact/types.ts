// Shared vocabulary for the workspace's common change-impact assessment —
// the frontend mirror of backend routes/impact/types.ts. Every lens
// (Applications / Value streams / Roles / Products) builds an ImpactRequest
// from its own decision surface and shows the same prioritized report before
// the change is applied.

export type ImpactSeverity = 'BREAKING' | 'HIGH' | 'MEDIUM' | 'LOW';

/** The legacy rationalization verbs — still the vocabulary the Applications and
 *  Products boards emit. The per-lens taxonomies (value-stream / role /
 *  deliverable / plan) add many more tokens; the API accepts any of them, so
 *  the type stays open (`& {}` preserves autocomplete for the legacy nine). */
export type LegacyChangeType =
  'RETIRE' | 'DROP' | 'DEPRECATE' | 'REPLACE' | 'MERGE' | 'CONSOLIDATE' | 'MOVE' | 'ADOPT' | 'HOLD';
export type ChangeType = LegacyChangeType | (string & {});

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
    }
  | { kind: 'deliverable'; deliverableIds: string[] }
  | { kind: 'plan'; programId?: string; workstreamId?: string; initiativeId?: string };

export interface ImpactRequest {
  changeType: ChangeType;
  label?: string;
  subject: ImpactSubject;
  /** A pure assessment (opened from a subject's detail surface, not gating a
   *  board action). The panel then offers the lens's change-type picker and a
   *  Save-assessment action instead of a Proceed button. Board gates leave this
   *  unset, so their flow is byte-identical (Workstream C / AC7). */
  pickable?: boolean;
}

/** Which lens a subject kind belongs to — drives the change-type picker. Mirrors
 *  the backend ChangeLens; product/application keep the legacy vocabulary. */
export type ChangeLens =
  'value-stream' | 'role' | 'deliverable' | 'plan' | 'application' | 'product';

export function lensForKind(kind: string): ChangeLens {
  switch (kind) {
    case 'process-nodes':
      return 'value-stream';
    case 'role':
      return 'role';
    case 'deliverable':
      return 'deliverable';
    case 'plan':
      return 'plan';
    case 'product-element':
      return 'product';
    default:
      return 'application';
  }
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

/** An auto-identified reviewer for the change — derived from the graph, never
 *  free-text (Change Impact v2, Workstream C). Mirrors backend Stakeholder. */
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
 *  Consumers, Information Components, Milestone Impact, …). Deterministic rows
 *  come from the graph walk; AI-derived rows are editable. Kept generic so one
 *  panel renders every lens's stages. Mirrors backend ImpactSection. */
export interface ImpactSectionRow {
  label: string;
  detail?: string | null;
  entityType?: string;
  entityId?: string | null;
}
export interface ImpactSection {
  key: string;
  title: string;
  blurb?: string;
  rows: ImpactSectionRow[];
}

export interface ImpactReport {
  subject: { kind: string; id: string | null; name: string; context: string | null };
  changeType: ChangeType;
  changeClass: 'destructive' | 'restructure' | 'additive' | 'adopt';
  summary: { breaking: number; high: number; medium: number; low: number; total: number };
  impacts: Impact[];
  /** Auto-identified reviewers — present on every v2 report. */
  stakeholders?: Stakeholder[];
  /** Lens-specific staged artifacts (deliverable / plan / role stages). */
  sections?: ImpactSection[];
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

/** Button/verb labels for the legacy rationalization vocabulary — what
 *  "Proceed" actually does on the Applications and Products boards. */
export const CHANGE_LABELS: Record<LegacyChangeType, string> = {
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

/** Human label for ANY change-type token. Legacy verbs use the curated map; the
 *  per-lens taxonomy tokens (SNAKE_CASE) title-case cleanly as a fallback, so
 *  the panel header renders every lens's verb without duplicating 55 strings. */
export function changeLabel(token: string): string {
  const legacy = CHANGE_LABELS[token as LegacyChangeType];
  if (legacy) return legacy;
  return token
    .toLowerCase()
    .split('_')
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

const DESTRUCTIVE_LEGACY = new Set<string>(['RETIRE', 'DROP', 'DEPRECATE', 'REPLACE']);
/** Whether a change reads as destructive — used for the red accent. Falls back
 *  to the report's changeClass for the new taxonomy tokens. */
export function isDestructive(token: string, changeClass?: ImpactReport['changeClass']): boolean {
  if (changeClass) return changeClass === 'destructive';
  return DESTRUCTIVE_LEGACY.has(token);
}

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
