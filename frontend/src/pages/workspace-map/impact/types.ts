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

export interface Impact {
  severity: ImpactSeverity;
  category: string;
  entityType: string;
  entityId: string | null;
  entityName: string;
  description: string;
  count?: number;
}

/** Rationalization steer the walker derives from the subject's footprint —
 *  advisory; the reviewer still makes the call. */
export interface ImpactRecommendation {
  option: 'RETAIN' | 'STANDARDIZE' | 'RETIRE';
  reason: string;
}

export interface ImpactReport {
  subject: { kind: string; id: string | null; name: string; context: string | null };
  changeType: ChangeType;
  changeClass: 'destructive' | 'restructure' | 'adopt';
  summary: { breaking: number; high: number; medium: number; low: number; total: number };
  impacts: Impact[];
  recommendation?: ImpactRecommendation;
}

export const RECOMMENDATION_META: Record<
  ImpactRecommendation['option'],
  { label: string; fg: string; bg: string; border: string }
> = {
  RETAIN: { label: 'Retain', fg: '#166534', bg: '#f0fdf4', border: '#86efac' },
  STANDARDIZE: { label: 'Standardize', fg: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  RETIRE: { label: 'Retire', fg: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
};

export const SEVERITY_META: Record<
  ImpactSeverity,
  { label: string; fg: string; bg: string; border: string }
> = {
  BREAKING: { label: 'Breaking', fg: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
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
  external: 'External parties',
  org: 'Organization',
  scope: 'Scope',
  'knock-on': 'Knock-on areas',
};
