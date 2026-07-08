/**
 * Shared types for the unified Value-Streams Inspector — the GET
 * /inspector/:nodeId payload shapes, the tab model and the per-tab badge
 * counts. Extracted verbatim from Inspector.tsx.
 */

// ── Payload (mirrors GET /inspector/:nodeId) ─────────────────────────────────
export type Relation = 'Owner' | 'Participant';
export type RoleDetail = {
  nodeRoleId: string;
  roleId: string;
  name: string;
  relation: Relation;
  raci?: string | null;
  validationStatus?: string;
};
export type RoleRollup = { roleId: string; name: string; relation: Relation; tasks: number };
export type AppDetail = { usageId: string; appId: string; name: string; usageType: string };
export type AppRollup = { appId: string; name: string; usageType: string; tasks: number };
export type DelivDetail = { linkId: string; deliverableId: string; title: string };
export type DelivRollup = { deliverableId: string; title: string };
export type CheckDetail = { nodeChecklistId: string; checklistItemId: string; text: string };
export type CheckRollup = { checklistItemId: string; text: string };
export type TestingDetail = {
  id: string | null;
  deliverableId: string | null;
  system: string | null;
  location: string | null;
  checkType: string | null;
  expected: string | null;
};
export type TestingRollup = {
  id: string;
  system: string | null;
  location: string | null;
  checkType: string | null;
  expected: string | null;
};
// Work Library plan surfacing (defined value → green ✓, missing → red ✗).
// generic — true = generic template key (from the assigned pattern), false =
// item-specific step; the tabs label the two groups distinctly.
export type PlanRow = { key: string; value: string | null; defined: boolean; generic: boolean };
export type TiedPlan = {
  id: string;
  name: string;
  source: string | null;
  checklist: PlanRow[];
  testing: PlanRow[];
};
export type TaskPlan = {
  checklist: PlanRow[];
  testing: PlanRow[];
  standards: TiedPlan[];
  regulations: TiedPlan[];
  defined: number;
  total: number;
};
export type PlanRollup = { tasks: number; tasksWithPlan: number; defined: number; total: number };

export type Payload = {
  id: string;
  name: string;
  levelNumber: number;
  levelLabel: string;
  isTask: boolean;
  detail: boolean;
  automatability: string | null;
  code: string | null;
  attributes: {
    l3num?: string | null;
    l4num?: string | null;
    l5num?: string | null;
    how?: string | null;
    testByPattern?: string | null;
    checklistPattern?: string | null;
    checklistDifferences?: string | null;
    l4l5Mapping?: string | null;
    disposition?: string | null;
  } | null;
  domain: string | null;
  valueStreamId: string | null;
  breadcrumb: { id: string; name: string }[];
  counts: {
    roles: number;
    applications: number;
    deliverables: number;
    tasks: number;
    checklist: number;
    testing: number;
    standards: number;
    regulations: number;
  };
  automation: {
    score: number | null;
    scored: number;
    auto: number;
    pct: number | null;
    tiers: Record<number, number>;
    byChild: {
      id: string;
      name: string;
      isTask: boolean;
      scored: number;
      auto: number;
      pct: number | null;
    }[];
    byChildLabel: string | null;
  };
  roles: (RoleDetail | RoleRollup)[];
  applications: (AppDetail | AppRollup)[];
  deliverables: (DelivDetail | DelivRollup)[];
  checklist: (CheckDetail | CheckRollup)[];
  testing: TestingDetail | TestingRollup[];
  plan: TaskPlan | null;
  planRollup: PlanRollup | null;
  standards: { standardId: string; name: string }[];
  regulations: { regId: string; title: string }[];
  children: { id: string; name: string; isTask: boolean }[];
};

export type Tab =
  | 'Overview'
  | 'Work'
  | 'Tasks'
  | 'Roles'
  | 'Applications'
  | 'Deliverables'
  | 'Checklist'
  | 'Testing'
  | 'Governance';
export const TABS: Tab[] = [
  'Overview',
  'Work',
  'Tasks',
  'Roles',
  'Applications',
  'Deliverables',
  'Checklist',
  'Testing',
  'Governance',
];

export const RACI = ['Responsible', 'Accountable', 'Consulted', 'Informed'];

// Live count for a tab badge.
export function tabCount(d: Payload, t: Tab): number | null {
  switch (t) {
    case 'Work':
      return d.counts.deliverables;
    case 'Tasks':
      return d.counts.tasks;
    case 'Roles':
      return d.counts.roles;
    case 'Applications':
      return d.counts.applications;
    case 'Deliverables':
      return d.counts.deliverables;
    case 'Checklist':
      return d.counts.checklist;
    case 'Testing':
      return d.counts.testing;
    case 'Governance':
      return d.counts.standards + d.counts.regulations;
    default:
      return null;
  }
}

// Props shared by the writeable entity tabs.
export type AfterFn = (msg: string, sub: string, undo?: () => void) => void;
export type PropTextFn = (p?: { places: string[]; streams: number }) => string;
