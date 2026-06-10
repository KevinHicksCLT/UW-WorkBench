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
  | { kind: 'masterDetail'; parent: string; parentTitle?: string; intro?: string; children: ChildRef[] }
  | { kind: 'list'; slug: string; intro?: string; fixed?: Record<string, string | number> }
  | { kind: 'group'; intro?: string; lists: { slug: string; title?: string }[] }
  | { kind: 'roleStudio' }
  | { kind: 'skills' }
  | { kind: 'validations' }
  | { kind: 'aiAdoption' }
  | { kind: 'builder'; scope?: 'all' | 'map' | 'external' }
  | { kind: 'stepLens' }
  | { kind: 'catalog' };

export type Section = { key: string; label: string; hint?: string; editor: EditorSpec };
export type TabConfig = { key: string; label: string; description: string; sections: Section[] };

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
      { key: 'builder', label: 'Map structure', hint: 'levels & connections', editor: { kind: 'builder', scope: 'map' } },
      { key: 'subProcesses', label: 'Sub-processes', editor: { kind: 'list', slug: 'subValueStream', fixed: { level: 4 }, intro: 'The L4 sub-process details — inputs, outputs, upstream/downstream hand-offs, and notes — rendered in the map sidebar and the value-stream drawer. Edits here also refresh the sub-process node on the map.' } },
      { key: 'steps', label: 'Process steps', editor: { kind: 'list', slug: 'processStep', intro: 'Sequenced E2E process steps attached to a value stream (the "how the work flows" detail). The `code` / `parentProcessId` columns are the workbook Activity IDs (CI-01-01-S03 / CI-01-01) the step lens joins on. For a guided, sidebar-shaped editor use the "Sidebar content" section.' } },
      { key: 'io', label: 'Inputs / outputs', editor: { kind: 'list', slug: 'ioItem', intro: 'Inputs, outputs, and deliverables inventoried per value stream.' } },
      { key: 'sidebar', label: 'Sidebar content', hint: 'what the map sidebar shows', editor: { kind: 'stepLens' } },
      { key: 'stepApps', label: 'Step applications', hint: 'raw table', editor: { kind: 'list', slug: 'stepAppUsage', intro: 'Which application a process step runs on, and how (Execution / System of Record / Approval / Reporting / Support) — the "Applications & systems" section of the map sidebar. Rows match a step by its id or by Activity ID. For a guided editor use "Sidebar content".' } },
      { key: 'stepDeliverables', label: 'Step deliverables', hint: 'raw table', editor: { kind: 'list', slug: 'stepDeliverable', intro: 'The deliverable each step produces, where it is memorialized (system of record) and who approves it in which system — the "Deliverables" chain of the map sidebar. For a guided editor use "Sidebar content".' } },
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
      { key: 'trackable', label: 'Trackable signals', editor: { kind: 'list', slug: 'telemetrySignal', intro: 'The Trackable Metrics inventory — live workforce signals (isLive on; per-person readings drill by role) and the workbook reference catalog of everything the company could measure.' } },
      {
        key: 'apps', label: 'Applications',
        editor: { kind: 'masterDetail', parent: 'application', parentTitle: 'Applications', intro: 'Select an application to edit it (including its APP-nnn code and System-of-Record flag from the Bridge Input catalog) and manage which value streams and process steps it supports.', children: [{ slug: 'applicationValueStream', fk: 'applicationId', title: 'Value-stream links' }, { slug: 'stepAppUsage', fk: 'applicationId', title: 'Step usage' }] },
      },
      { key: 'signals', label: 'People signals', editor: { kind: 'group', intro: 'Per-person digital-productivity signals, performance metrics, and app-usage mix.', lists: [{ slug: 'personSignal', title: 'Signals' }, { slug: 'personMetric', title: 'Performance metrics' }, { slug: 'personAppUsage', title: 'App usage' }] } },
      { key: 'aiAdoption', label: 'AI adoption', hint: 'per value stream', editor: { kind: 'aiAdoption' } },
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
      { key: 'riskBands', label: 'Risk scoring bands', editor: { kind: 'list', slug: 'riskScoringBand', intro: 'How a 5×5 probability × impact score (1–25) reads as a rating — the standard enterprise risk matrix (ISO 31000-style). Every severity cell in the tracker colors itself from these bands.' } },
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
    key: 'regulations',
    label: 'Regulations',
    description: 'The 50-state regulatory baseline behind the Regulations tab — jurisdictions (taxonomy flags + narratives), their obligations and where they apply, bulletins, machine-readable compliance rules, the shared filing-system catalog, and the monitored source registry.',
    sections: [
      {
        key: 'jurisdictions', label: 'Jurisdictions', hint: 'states + their data',
        editor: {
          kind: 'masterDetail', parent: 'jurisdiction', parentTitle: 'Jurisdictions',
          intro: 'One row per state + DC. Select a jurisdiction to edit its regulator, taxonomy flags, and narratives, and to manage its requirements, bulletins, rules, system links, and monitored sources.',
          children: [
            { slug: 'regulatoryRequirement', fk: 'jurisdictionId', title: 'Requirements' },
            { slug: 'regulatoryBulletin', fk: 'jurisdictionId', title: 'Bulletins' },
            { slug: 'complianceRule', fk: 'jurisdictionId', title: 'Compliance rules' },
            { slug: 'jurisdictionIntegration', fk: 'jurisdictionId', title: 'System links' },
            { slug: 'regulatorySource', fk: 'jurisdictionId', title: 'Monitored sources' },
          ],
        },
      },
      {
        key: 'requirements', label: 'Requirements',
        editor: {
          kind: 'masterDetail', parent: 'regulatoryRequirement', parentTitle: 'Requirements',
          intro: 'Every discrete obligation across states. Select a requirement to edit it and manage which value streams it applies to (the Regulations tab also offers an inline link editor).',
          children: [{ slug: 'requirementValueStream', fk: 'requirementId', title: 'Value-stream links' }],
        },
      },
      {
        key: 'systems', label: 'Integration systems',
        editor: {
          kind: 'masterDetail', parent: 'integrationSystem', parentTitle: 'Systems',
          intro: 'The shared catalog of regulatory filing/reporting systems (SERFF, NIPR, OPTins…). Select a system to manage which states use it.',
          children: [{ slug: 'jurisdictionIntegration', fk: 'systemId', title: 'State usage' }],
        },
      },
      { key: 'sources', label: 'All sources', editor: { kind: 'list', slug: 'regulatorySource', intro: 'The full monitoring registry, including national sources (NAIC, Insurance Compact) not tied to a state. The Phase 2 update pipeline sweeps the rows with Monitor enabled.' } },
    ],
  },
  {
    key: 'external',
    label: 'External',
    description: 'External parties the organization interacts with — the party catalog (model nodes) and the interaction inventory.',
    sections: [
      { key: 'parties', label: 'External parties', hint: 'model nodes + connections', editor: { kind: 'builder', scope: 'external' } },
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
