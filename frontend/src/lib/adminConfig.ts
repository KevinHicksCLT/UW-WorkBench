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
  | { kind: 'builder'; scope?: 'all' | 'map' | 'external' | 'org' }
  | { kind: 'stepLens' };

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
    description: 'Two surfaces cover the whole map: "Map structure" builds the hierarchy (add, rename, move, connect, delete any node), and "Sidebar content" edits everything a node shows when clicked — steps, sub-process detail, roles, deliverables, and applications.',
    sections: [
      { key: 'builder', label: 'Map structure', hint: 'add, move & connect', editor: { kind: 'builder', scope: 'map' } },
      { key: 'sidebar', label: 'Sidebar content', hint: 'what a node shows when clicked', editor: { kind: 'stepLens' } },
      { key: 'io', label: 'Inputs & outputs', editor: { kind: 'list', slug: 'ioItem', intro: 'The inputs, outputs, and deliverables inventoried per value stream — the "Inputs / outputs" panel of the value-stream drawer and the source of role deliverables.' } },
    ],
  },
  {
    key: 'organization',
    label: 'Organization',
    description: 'The Organization view shows Segment → Division → Department → Role. "Org structure" moves and reshapes the spine; "Divisions & departments" edits their fields (including the CEO segment a division rolls up to); roles, their work, and task categories live in the role studio.',
    sections: [
      {
        key: 'structure', label: 'Org structure', hint: 'add, move & reshape',
        editor: { kind: 'builder', scope: 'org' },
      },
      {
        key: 'divisions', label: 'Divisions & departments',
        editor: { kind: 'masterDetail', parent: 'division', parentTitle: 'Divisions', intro: 'Pick a division to edit it (including its "Higher category" — the CEO segment it rolls up to) and manage its departments.', children: [{ slug: 'department', fk: 'divisionId', title: 'Departments' }] },
      },
      {
        key: 'roles', label: 'Roles & responsibilities', hint: 'full role studio',
        editor: { kind: 'roleStudio' },
      },
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
    key: 'telemetry',
    label: 'Metrics',
    description: 'The Metrics tab is built from KPI/metric definitions and the application landscape.',
    sections: [
      { key: 'metrics', label: 'Metrics (KPIs)', editor: { kind: 'list', slug: 'metric', intro: 'Value-stream KPIs — definition, target, unit, and current reading.' } },
      { key: 'trackable', label: 'Trackable signals', editor: { kind: 'list', slug: 'telemetrySignal', intro: 'The Trackable Metrics inventory — live signals (isLive on) and the workbook reference catalog of everything the company could measure.' } },
      { key: 'aiAdoption', label: 'AI adoption', hint: 'per value stream', editor: { kind: 'aiAdoption' } },
      { key: 'analysisCoverage', label: 'Analysis coverage', editor: { kind: 'list', slug: 'analysisStatus', intro: 'The AI analysis plan the Metrics tab tracks — one row per analyzed subject (value stream, org group, or role) with its status and planned/actual dates.' } },
    ],
  },
  {
    key: 'initiatives',
    label: 'Workspace',
    description: 'The Workspace screen renders the portfolio tracker: Program → Workstream → Initiative. "Programs & workstreams" manages the containers; "Portfolio initiatives" manages each initiative and everything inside it (move one by editing its workstream). Plus the operating-model initiatives, risks, scenarios, and application-rationalization workspaces.',
    sections: [
      {
        key: 'portfolio', label: 'Programs & workstreams',
        editor: { kind: 'masterDetail', parent: 'program', parentTitle: 'Programs', intro: 'The containers of the portfolio tracker. Select a program to manage its workstreams; the initiatives themselves live in "Portfolio initiatives".', children: [{ slug: 'workstream', fk: 'programId', title: 'Workstreams' }] },
      },
      {
        key: 'initiativeDetail', label: 'Portfolio initiatives',
        editor: {
          kind: 'masterDetail', parent: 'portfolioInitiative', parentTitle: 'Portfolio initiatives',
          intro: 'Every portfolio initiative and everything its drill-down screen renders. Select one to edit it (changing its workstream moves it), and to manage its benefit and cost lines, milestones, and RAID log.',
          children: [
            { slug: 'benefitLine', fk: 'initiativeId', title: 'Benefit lines' },
            { slug: 'costLine', fk: 'initiativeId', title: 'Cost lines' },
            { slug: 'milestone', fk: 'initiativeId', title: 'Milestones' },
            { slug: 'raidItem', fk: 'initiativeId', title: 'RAID log' },
          ],
        },
      },
      {
        key: 'initiatives', label: 'Operating-model initiatives',
        editor: { kind: 'masterDetail', parent: 'initiative', parentTitle: 'Initiatives', intro: 'Transformation initiatives that power the dashboard and the operating-model map. Select one to manage its value-stream and division links.', children: [{ slug: 'initiativeValueStream', fk: 'initiativeId', title: 'Value-stream links' }, { slug: 'initiativeDivision', fk: 'initiativeId', title: 'Division links' }] },
      },
      { key: 'risks', label: 'Risks', editor: { kind: 'group', intro: 'The operating-model risk register, plus how a 5×5 probability × impact score (1–25) reads as a rating — every severity cell in the tracker colors itself from these bands.', lists: [{ slug: 'risk', title: 'Risks' }, { slug: 'riskScoringBand', title: 'Risk scoring bands' }] } },
      { key: 'scenarios', label: 'Scenarios', editor: { kind: 'list', slug: 'scenario', intro: 'Change-impact economics — one-time cost, recurring benefit, net impact, confidence.' } },
      {
        key: 'rationalization', label: 'App Rationalization Workspace',
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
    key: 'applications',
    label: 'Applications',
    description: 'The application landscape the Applications screen renders — each system, its catalog code and System-of-Record flag, and which value streams and process steps it supports.',
    sections: [
      {
        key: 'apps', label: 'Applications',
        editor: { kind: 'masterDetail', parent: 'application', parentTitle: 'Applications', intro: 'Select an application to edit it (including its APP-nnn code and System-of-Record flag from the Bridge Input catalog) and manage which value streams and process steps it supports.', children: [{ slug: 'applicationValueStream', fk: 'applicationId', title: 'Value-stream links' }, { slug: 'stepAppUsage', fk: 'applicationId', title: 'Step usage' }] },
      },
    ],
  },
  {
    key: 'external',
    label: 'Third-Parties',
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
];
