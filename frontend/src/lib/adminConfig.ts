// ─── Data Admin tab configuration ────────────────────────────────────────────
// The Data Admin console mirrors the application's own navigation: one tab here
// per tab the user sees in the product, so "where do I change what's on screen X?"
// has an obvious answer. Each tab declares one or more sections, and each section
// picks the editor SHAPE that fits its data — a drill-down tree for the deep level
// hierarchies, a master-detail for container/line-item data, or a flat list for
// simple tables. This is deliberately NOT one-size-fits-all (see AC: "every tab
// will not have the same approach").

export type ChildRef = { slug: string; fk: string; title?: string; newLabel?: string };

export type EditorSpec =
  | { kind: 'company' }
  | { kind: 'dashboard' }
  | { kind: 'tree'; entity: 'valueStreams' | 'organization'; rootLabel: string; levelNames: string[] }
  | { kind: 'masterDetail'; parent: string; parentTitle?: string; intro?: string; children: ChildRef[] }
  | { kind: 'list'; slug: string; intro?: string }
  | { kind: 'group'; intro?: string; lists: { slug: string; title?: string }[] }
  | { kind: 'roleStudio' }
  | { kind: 'skills' }
  | { kind: 'validations' }
  | { kind: 'catalog' };

export type Section = { key: string; label: string; hint?: string; editor: EditorSpec };
export type TabConfig = { key: string; label: string; description: string; sections: Section[] };

// Friendly per-level names for the value-stream tree (index = level number).
const VS_LEVELS = ['Enterprise', 'Domain', 'Division', 'Value Stream', 'Sub-Process', 'Process Step'];

export const ADMIN_TABS: TabConfig[] = [
  {
    key: 'company',
    label: 'Company',
    description: 'Onboard a new company or edit an existing one. Everything else in Data Admin is scoped to the company selected in the top bar.',
    sections: [{ key: 'company', label: 'Companies', editor: { kind: 'company' } }],
  },
  {
    key: 'home',
    label: 'Home',
    description: 'Configure the Home dashboard — set its title and choose which areas appear, in what order. Each area is a live rollup that updates as you edit the underlying data.',
    sections: [
      { key: 'dashboard', label: 'Dashboard', editor: { kind: 'dashboard' } },
    ],
  },
  {
    key: 'valueStreams',
    label: 'Value Streams',
    description: 'The operating-model map is driven by a single configurable level hierarchy (Enterprise → Domain → Division → Value Stream → Sub-Process → Process Step). Drill in to edit any node and its detail.',
    sections: [
      { key: 'levels', label: 'Levels (the map)', hint: 'Drill-down tree', editor: { kind: 'tree', entity: 'valueStreams', rootLabel: 'Value Streams', levelNames: VS_LEVELS } },
      { key: 'steps', label: 'Process steps', editor: { kind: 'list', slug: 'processStep', intro: 'Sequenced E2E process steps attached to a value stream (the "how the work flows" detail).' } },
      { key: 'io', label: 'Inputs / outputs', editor: { kind: 'list', slug: 'ioItem', intro: 'Inputs, outputs, and deliverables inventoried per value stream.' } },
    ],
  },
  {
    key: 'organization',
    label: 'Organization',
    description: 'The Organization view shows Segment → Division → Department → Role → People. The CEO segment grouping comes from each division’s "Higher category" (Core Business / IT / Corporate Function). Edit the org spine here — these are the exact tables the Organization screen reads.',
    sections: [
      {
        key: 'divisions', label: 'Divisions & departments',
        editor: { kind: 'masterDetail', parent: 'division', parentTitle: 'Divisions', intro: 'Pick a division to edit it (including its "Higher category" — the CEO segment it rolls up to) and manage its departments.', children: [{ slug: 'department', fk: 'divisionId', title: 'Departments' }] },
      },
      {
        key: 'roles', label: 'Roles & responsibilities', hint: 'Full role studio',
        editor: { kind: 'roleStudio' },
      },
      { key: 'categories', label: 'Task categories', editor: { kind: 'list', slug: 'category', intro: 'Categories used to group role tasks and checklist items.' } },
    ],
  },
  {
    key: 'standards',
    label: 'Standards',
    description: 'Standards are organized as departmental areas, each holding individual guidelines. Pick an area to manage its items.',
    sections: [
      {
        key: 'standards', label: 'Standards areas',
        editor: { kind: 'masterDetail', parent: 'standard', parentTitle: 'Standards areas', intro: 'Select a standards area to edit it and manage its guidelines.', children: [{ slug: 'standardItem', fk: 'standardId', title: 'Guidelines & standards' }] },
      },
      { key: 'skills', label: 'Agent skills', hint: 'edit SKILL.md & files', editor: { kind: 'skills' } },
    ],
  },
  {
    key: 'telemetry',
    label: 'Telemetry',
    description: 'Telemetry is built from KPI/metric definitions, the application landscape, and per-person digital signals.',
    sections: [
      { key: 'metrics', label: 'Metrics (KPIs)', editor: { kind: 'list', slug: 'metric', intro: 'Value-stream KPIs — definition, target, unit, and current reading.' } },
      {
        key: 'apps', label: 'Applications',
        editor: { kind: 'masterDetail', parent: 'application', parentTitle: 'Applications', intro: 'Select an application to edit it and manage which value streams it supports.', children: [{ slug: 'applicationValueStream', fk: 'applicationId', title: 'Value-stream links' }] },
      },
      { key: 'signals', label: 'People signals', editor: { kind: 'group', intro: 'Per-person digital-productivity signals, performance metrics, and app-usage mix.', lists: [{ slug: 'personSignal', title: 'Signals' }, { slug: 'personMetric', title: 'Performance metrics' }, { slug: 'personAppUsage', title: 'App usage' }] } },
    ],
  },
  {
    key: 'initiatives',
    label: 'Initiatives',
    description: 'The Initiatives screen renders the portfolio tracker: Program → Workstream → Initiative. Edit that here, plus the operating-model initiatives (which power the dashboard and map), risks, scenarios, and application-rationalization workspaces.',
    sections: [
      {
        key: 'portfolio', label: 'Portfolio (programs)', hint: 'what the screen shows',
        editor: { kind: 'masterDetail', parent: 'program', parentTitle: 'Programs', intro: 'The portfolio tracker the Initiatives screen renders. Select a program to manage its workstreams; each workstream holds the portfolio initiatives.', children: [{ slug: 'workstream', fk: 'programId', title: 'Workstreams' }] },
      },
      {
        key: 'workstreams', label: 'Workstream initiatives',
        editor: { kind: 'masterDetail', parent: 'workstream', parentTitle: 'Workstreams', intro: 'Select a workstream to manage the portfolio initiatives under it.', children: [{ slug: 'portfolioInitiative', fk: 'workstreamId', title: 'Portfolio initiatives' }] },
      },
      {
        key: 'initiatives', label: 'Operating-model initiatives',
        editor: { kind: 'masterDetail', parent: 'initiative', parentTitle: 'Initiatives', intro: 'Transformation initiatives that power the dashboard and the operating-model map. Select one to manage its value-stream and division links.', children: [{ slug: 'initiativeValueStream', fk: 'initiativeId', title: 'Value-stream links' }, { slug: 'initiativeDivision', fk: 'initiativeId', title: 'Division links' }] },
      },
      { key: 'risks', label: 'Risks', editor: { kind: 'list', slug: 'risk' } },
      { key: 'scenarios', label: 'Scenarios', editor: { kind: 'list', slug: 'scenario', intro: 'Change-impact economics — one-time cost, recurring benefit, net impact, confidence.' } },
      {
        key: 'rationalization', label: 'App rationalization',
        editor: {
          kind: 'masterDetail', parent: 'rationalizationWorkspace', parentTitle: 'Workspaces',
          intro: 'Each workspace rationalizes a business process. Select one to manage its legacy apps, target services, components, capabilities, and plan.',
          children: [
            { slug: 'rationalizationApp', fk: 'workspaceId', title: 'Legacy apps' },
            { slug: 'rationalizationMicroservice', fk: 'workspaceId', title: 'Target services' },
            { slug: 'rationalizationComponent', fk: 'workspaceId', title: 'Target components' },
            { slug: 'rationalizationCapability', fk: 'workspaceId', title: 'Capabilities' },
            { slug: 'rationalizationPlanStep', fk: 'workspaceId', title: 'Migration plan' },
          ],
        },
      },
    ],
  },
  {
    key: 'work',
    label: 'Deliverables & Tasks',
    description: 'The work tracker — tangible deliverables and the tasks that roll up to them.',
    sections: [
      {
        key: 'deliverables', label: 'Deliverables',
        editor: { kind: 'masterDetail', parent: 'deliverable', parentTitle: 'Deliverables', intro: 'Select a deliverable to edit it and manage its tasks.', children: [{ slug: 'task', fk: 'deliverableId', title: 'Tasks' }] },
      },
      { key: 'tasks', label: 'All tasks', editor: { kind: 'list', slug: 'task', intro: 'Every task, including standalone tasks not tied to a deliverable.' } },
    ],
  },
  {
    key: 'people',
    label: 'People',
    description: 'The people who staff roles, their assignments, and their work.',
    sections: [
      {
        key: 'people', label: 'People',
        editor: { kind: 'masterDetail', parent: 'person', parentTitle: 'People', intro: 'Select a person to edit them and manage their assignments and tasks.', children: [{ slug: 'assignment', fk: 'personId', title: 'Assignments' }, { slug: 'personTask', fk: 'personId', title: 'Tasks' }] },
      },
    ],
  },
  {
    key: 'external',
    label: 'External',
    description: 'External parties the organization interacts with.',
    sections: [
      { key: 'external', label: 'External interactions', editor: { kind: 'list', slug: 'externalInteraction' } },
    ],
  },
  {
    key: 'health',
    label: 'Data Health',
    description: 'Read-only integrity checks across the operating model — count reconciliation, singular-role over-fill, region/employment plausibility, and financial-rollup staleness. Use this to spot what the next data pass needs to fix.',
    sections: [{ key: 'validations', label: 'Validation checks', editor: { kind: 'validations' } }],
  },
  {
    key: 'catalog',
    label: 'Data Catalog',
    description: 'Every editable table in one place — the power-user view. Use the tailored tabs above for day-to-day editing.',
    sections: [{ key: 'catalog', label: 'All tables', editor: { kind: 'catalog' } }],
  },
];
