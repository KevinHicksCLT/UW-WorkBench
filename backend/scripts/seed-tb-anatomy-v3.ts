// Transformation Bridge self-anatomy v3 — ATOMIC per-screen decomposition.
// One finding per component (UI), per API call with its verb and call site
// (Integration), one core purpose+logic finding (Business Service), one per
// table group with what it populates (Data), and the concrete tech stack +
// screen-specific runtime facts (Infrastructure). Facts extracted from the
// codebase 2026-07-12; file paths, endpoints and verbs are real.
//
// Run from backend/:  npx tsx --env-file=.env scripts/seed-tb-anatomy-v3.ts
// Idempotent: wipes and reinserts this workspace's findings.
import { prisma } from '../src/db/prisma.js';

const WS = 'cmr9uk5530000j099hz8gcoid';
const APP_FE = 'cmr9uk57y0001j099csnaelza';
const APP_BE = 'cmr9uk57z0002j099731oqqaw';
const COMP: Record<string, string> = {
  UI: 'cmr9uk5qq0010j099yhfnwmpw',
  Integration: 'cmr9uk5t80011j099jrazsoxn',
  'Business Service': 'cmr9uk5uh0012j09968d2qj6o',
  Data: 'cmr9uk5y80013j099k5fkmcaw',
  Infrastructure: 'cmr9uk5zf0014j099yb8wria7',
};

const STACK =
  'React 18 + TypeScript SPA (Vite, Tailwind) and an Express API (Node, TypeScript, ESM) both deployed on Vercel; Prisma 6 over Neon Postgres 18 (branch workspace-renovation); pino structured logging with X-Request-Id; JWT bearer auth.';

/** [component, role] — one UI finding each. */
type Ui = [string, string, string?];
/** [verb+path, purpose, call site] — one Integration finding each. */
type Api = [string, string, string];
/** [tables, what they populate] — one Data finding each. */
type Tbl = [string, string];

interface Spec {
  screen: string;
  ui: Ui[];
  apis: Api[];
  /** [what the screen accomplishes, the logic that achieves it, codeRef] */
  core: [string, string, string] | null;
  tables: Tbl[];
  /** screen-specific infrastructure facts appended after the shared stack row */
  infra: [string, string][];
}

const SPECS: Spec[] = [
  {
    screen: 'Home',
    ui: [
      [
        'Overview.tsx (page)',
        'Executive dashboard grid; owns edit-mode state and widget order',
        'frontend/src/pages/overview/Overview.tsx',
      ],
      [
        'WIDGET_MAP widget renderers',
        'Catalog of KPI/rollup cards (totals, top value streams, programs, RAID, financials) — each widget renders one slice of the /dashboard payload',
        'frontend/src/lib/dashboardWidgets.tsx',
      ],
      [
        'DashboardCustomizer',
        'Customize mode: add/remove/reorder cards, persisted per user',
        'frontend/src/components/home/DashboardCustomizer.tsx',
      ],
      [
        'ui Card/Button/LoadingState/ErrorMessage',
        'Shared primitives framing every widget cell',
        'frontend/src/components/ui',
      ],
    ],
    apis: [
      [
        'GET /dashboard?companyId=',
        'Single aggregate payload feeding every widget',
        'Overview.tsx via api.get',
      ],
      [
        'GET+PATCH /me/preferences',
        'Reads/writes the per-user widget layout (debounced auto-save)',
        'lib/preferences.tsx flush()',
      ],
    ],
    core: [
      'Give an executive one screen that answers "where is the transformation?" without opening a single tab.',
      'One aggregate endpoint gathers counts and rollups across both model domains (operating model + portfolio); structureCounts derives spine numbers from the ProcessNode closure at read time so the dashboard can never disagree with the tabs; layout is user preference, not data.',
      'backend/src/routes/dashboard.ts · lib/resolvers (structureCounts)',
    ],
    tables: [
      [
        'ProcessNode, OrgUnit, NodeRole, Role (+ closures)',
        'Spine counts: value streams, levels, role totals per widget',
      ],
      [
        'PortfolioInitiative, Program, Workstream, RaidItem, StrategicObjective',
        'Transformation-program, RAID and objective widgets',
      ],
      [
        'Metric, TelemetrySignal, Scenario, Standard, Application, Company',
        'KPI, telemetry, standards and app-count widgets; Company.dashboardConfig stores the default layout',
      ],
      ['UserPreference', 'Per-user widget order/visibility overrides'],
    ],
    infra: [
      [
        'Runtime',
        'requirePermission(home); no response cache (aggregate is cheap); page is a React.lazy chunk behind RouteGuard; hosted as Vercel static + function, data from Neon',
      ],
    ],
  },
  {
    screen: 'Organization',
    ui: [
      [
        'Organization.tsx (page)',
        'URL-driven view switch ?view=map|list|departments',
        'frontend/src/pages/organization/Organization.tsx',
      ],
      ['OrgDrillToc', 'Division→department TOC drill', 'frontend/src/components/OrgDrillToc.tsx'],
      [
        'OrgListExplorer',
        'Excel-style drill grid with metrics sidebar',
        'frontend/src/components/OrgListExplorer.tsx',
      ],
      [
        'OrgMapCanvas (React Flow)',
        'Org chart canvas; edit mode moves nodes',
        'frontend/src/viz/org-map/OrgMapCanvas.tsx',
      ],
      [
        'RoleDrawerHost (global)',
        'Role deep-links (?role=) open the quick-peek drawer',
        'frontend/src/components/RoleDrawerHost.tsx',
      ],
    ],
    apis: [
      [
        'GET /explorer/org-table',
        'Org tree + per-unit counts for TOC, grid and map',
        'OrgDrillToc/OrgListExplorer/OrgMapCanvas via useApi',
      ],
      [
        'GET /explorer/roles/:level/:id',
        'Metrics sidebar dashboards per org level',
        'OrgListExplorer + OrgMapCanvas',
      ],
      [
        'POST /builder/nodes/batch?companyId=',
        'Commits map edit-mode node moves in one batch',
        'OrgMapCanvas save',
      ],
    ],
    core: [
      'Show who the enterprise is — divisions, departments and the roles inside them — and how much work each unit carries.',
      'OrgUnitClosure walks ancestry once per request (structureCounts/streamAncestry); role dashboards batch-load NodeRole junctions and aggregate in memory — never per-row queries.',
      'backend/src/routes/explorer/{standards,dashboards}.ts',
    ],
    tables: [
      [
        'OrgUnit + OrgUnitClosure + OrgLevelType',
        'The org tree itself: L2 divisions, L3 departments, ancestor walks',
      ],
      ['Role, NodeRole', 'Role homes per unit and their process participation counts'],
      ['ProcessNode + ProcessNodeClosure', 'Work volume per unit (via owner roles)'],
    ],
    infra: [
      [
        'Runtime',
        'Explorer router: requirePermission(value-streams) BEFORE cacheResponses(15s); gzip; builder writes clear the cache',
      ],
    ],
  },
  {
    screen: 'Value Streams',
    ui: [
      [
        'Explorer.tsx (page)',
        'Operating-model explorer; TOC/Map/List state in URL (?view, ?focus, ?vs)',
        'frontend/src/pages/explorer/Explorer.tsx',
      ],
      [
        'MapCanvas (React Flow)',
        'L1→L5 drill map with count chips and drill-depth tags',
        'frontend/src/viz/map/MapCanvas.tsx',
      ],
      [
        'VariantLensBar',
        'Market/Segment/LOB lens pills over the map',
        'frontend/src/viz/map/VariantLensBar.tsx',
      ],
      [
        'ListExplorer + Sheet',
        'Flat Domain|Division|VS|L4|L5 spreadsheet with combobox filters',
        'frontend/src/components/ListExplorer.tsx',
      ],
      [
        'TocView/ViewPills',
        'Domain→value-stream TOC and the view switcher',
        'frontend/src/components/TocView.tsx',
      ],
    ],
    apis: [
      ['GET /explorer/overview', 'Bootstrap: domains + top-level counts', 'Explorer.tsx mount'],
      ['GET /explorer/tree', 'Full drill structure for TOC/List', 'ValueStreamToc + ListExplorer'],
      [
        'GET /explorer/value-stream/:id/focus',
        'Resolves a VS id to its map focus node',
        'ListExplorer deep links',
      ],
      [
        'GET /inspector/:nodeId',
        'Docked Inspector load for the selected node',
        'ListExplorer/MapCanvas',
      ],
    ],
    core: [
      'Show how work flows — every domain, value stream and task in one navigable model.',
      'processSubtree(s) computes the drill tree from ProcessNodeClosure per request (no stored snapshots); the map renders whatever depth the closure returns, so structure edits appear instantly.',
      'backend/src/routes/explorer/{overview,treeFlow}.ts · lib/resolvers',
    ],
    tables: [
      [
        'ProcessNode + ProcessNodeClosure + ProcessLevelType',
        'The L1 domain → L5 task spine and its drill counts',
      ],
      ['NodeRole', 'Owner/participant chips on map nodes and list rows'],
    ],
    infra: [
      [
        'Runtime',
        'value-streams permission; 15s response cache after the permission check; MB-scale payloads gzip-compressed; lazy route chunk',
      ],
    ],
  },
  {
    screen: 'Value stream drawer',
    ui: [
      [
        'Inspector (docked)',
        'The unified node inspector docked beside List/Map; ?node= mirrors the open node',
        'frontend/src/components/Inspector.tsx',
      ],
      [
        'DrawerShell pattern',
        '560px aside with collapsible rail',
        'frontend/src/components/Inspector.tsx (aside)',
      ],
    ],
    apis: [
      [
        'GET /inspector/:nodeId',
        'One call returns the node’s full association set',
        'ListExplorer/MapCanvas dock',
      ],
      [
        'GET /explorer/value-stream/:id/focus',
        'VS-id → focus-node resolution for deep links',
        'Explorer deep links',
      ],
    ],
    core: [
      'Let a user click any node and immediately see everything attached to it without leaving the canvas.',
      'The inspector endpoint joins every junction for one node in a single query set; the drawer is the only surface where a node’s associations appear, so there is exactly one code path to keep correct.',
      'backend/src/routes/inspector/detail.ts',
    ],
    tables: [
      [
        'NodeRole, NodeAppUsage, NodeDeliverable, NodeChecklist, TestingTemplate',
        'The tabs: roles, applications, deliverables, checklist and testing rows for the node',
      ],
      ['ProcessNode + ProcessNodeClosure', 'The node itself, its ancestry line and child rollups'],
    ],
    infra: [
      [
        'Runtime',
        '/inspector deliberately uncached so edits render immediately; value-streams permission',
      ],
    ],
  },
  {
    screen: 'Roles',
    ui: [
      [
        'Roles.tsx (page)',
        'URL-driven TOC/List/Map switch; permission-gated “+ New role”',
        'frontend/src/pages/roles/Roles.tsx',
      ],
      [
        'RolesListSheet (Sheet)',
        'Flat sheet: Department/Division/Role/Type/VS/deliverables/tasks/standards columns',
        'frontend/src/components/RolesListSheet.tsx',
      ],
      [
        'RolesOrgChart (React Flow)',
        'Manager-edge org chart',
        'frontend/src/components/RolesOrgChart.tsx',
      ],
      [
        'RoleEditorDrawer',
        'Create/amend drawer with org-unit + type pickers',
        'frontend/src/components/RoleEditorDrawer.tsx',
      ],
    ],
    apis: [
      ['GET /roles', 'Role list with junction counts per row', 'RolesListSheet useApi'],
      ['GET /roles/org-chart', 'Manager-edge chart data', 'RolesOrgChart useApi'],
      ['GET /roles/manage/options', 'Org units/types for the editor pickers', 'RoleEditorDrawer'],
      [
        'POST /roles · PATCH /roles/:id · DELETE /roles/:id',
        'Create, amend, remove a role (delete preceded by impact count)',
        'RoleEditorDrawer/RoleDrawer',
      ],
    ],
    core: [
      'Catalog every role in the operating model with what it owns, touches and is accountable for.',
      'One $queryRaw over NodeRole × ProcessNodeClosure counts each role’s participation in a single pass; ancestorNames maps each role’s OrgUnit to division/department; writes are audited diffs.',
      'backend/src/routes/roles.ts · roleManage.ts',
    ],
    tables: [
      ['Role (homes on OrgUnit)', 'The catalog rows themselves'],
      [
        'NodeRole, RoleDeliverable, RoleStandard, RoleRegulation',
        'Participation, deliverable, standard and regulation counts per role',
      ],
      ['OrgUnit + OrgLevelType', 'Division/department columns'],
    ],
    infra: [
      [
        'Runtime',
        'roles permission (method-derived CRUD); no cache on /roles; every mutation writes an AuditEntry via services/audit',
      ],
    ],
  },
  {
    screen: 'Role drawer',
    ui: [
      [
        'RoleDrawer (DrawerShell 720px)',
        'Quick peek: description, headline stats, VS participation, amend/delete',
        'frontend/src/components/RoleDrawer.tsx',
      ],
      [
        'RoleDrawerHost',
        'Mounts once in Layout; lazily renders whenever ?role=<id> appears anywhere',
        'frontend/src/components/RoleDrawerHost.tsx',
      ],
      [
        'useDialogs typedConfirm',
        'Delete requires the impact-count confirm',
        'frontend/src/lib/dialogs.tsx',
      ],
    ],
    apis: [
      ['GET /roles/:id', 'Loads the peek payload', 'RoleDrawer'],
      ['GET /roles/:id/impact', 'Counts affected junctions before delete', 'RoleDrawer pre-delete'],
      [
        'DELETE /roles/:id · PATCH /roles/:id',
        'Remove or amend through the manage router',
        'RoleDrawer/RoleEditorDrawer',
      ],
    ],
    core: [
      'Answer "who is this role?" from anywhere in the app in one click, and make destructive changes honest.',
      'The global ?role= pattern means every surface shares one drawer; impact counts across seven junction tables turn delete into an informed decision instead of a surprise.',
      'backend/src/routes/roleManage.ts (impact)',
    ],
    tables: [
      ['Role + OrgUnit', 'Identity, description, home unit'],
      [
        'NodeRole, RoleDeliverable, ChecklistItem, RoleStandard, RoleRegulation',
        'Blast-radius counts in the delete confirm',
      ],
    ],
    infra: [['Runtime', 'Drawer is its own lazy chunk; delete/patch audited; roles permission']],
  },
  {
    screen: 'Inspector drawer',
    ui: [
      [
        'Inspector.tsx (9 tabs)',
        'Overview/Work/Tasks/Roles/Applications/Deliverables/Checklist/Testing/Governance over one node',
        'frontend/src/components/Inspector.tsx',
      ],
      [
        'inspector/OverviewTab + WorkTab + entityTabs + planTabs',
        'Tab bodies; containers roll up, L5 leaves edit inline',
        'frontend/src/components/inspector/',
      ],
      [
        'GovernancePanel',
        'Inherited standards/regulations with evidence state',
        'frontend/src/components/GovernancePanel.tsx',
      ],
      [
        'Optimistic edit + Undo toast',
        'Writes render instantly and can be undone',
        'frontend/src/components/inspector/atoms.tsx',
      ],
    ],
    apis: [
      ['GET /inspector/:nodeId', 'Full association payload for the node', 'Inspector load'],
      [
        'GET /inspector/search/{roles,applications,deliverables}',
        'Typeahead pickers for adding links',
        'entityTabs',
      ],
      [
        'POST /inspector/:nodeId/{roles,applications,checklist,deliverables}',
        'Create a junction row',
        'entityTabs add',
      ],
      [
        'PATCH /inspector/{roles,applications,checklist}/:linkId',
        'Amend a junction (role_, usage, checklist item)',
        'entityTabs edit',
      ],
      [
        'DELETE /inspector/{roles,applications,checklist,deliverables}/:linkId',
        'Remove a junction',
        'entityTabs remove',
      ],
      ['PUT /inspector/:nodeId/testing', 'Replace the node’s testing rows', 'planTabs'],
    ],
    core: [
      'Make one ProcessNode fully editable — every association CRUD-able in place, no admin round-trip.',
      'Governance inherits from L2/L3 ancestors via the closure (nothing attaches to tasks directly); every write is a FK junction mutation, so the graph stays the single source of truth.',
      'backend/src/routes/inspector/{detail,mutations}.ts',
    ],
    tables: [
      [
        'NodeRole, NodeAppUsage, NodeDeliverable, NodeChecklist + ChecklistItem, TestingTemplate',
        'Created/updated/deleted by the tab mutations',
      ],
      ['NodeStandard, NodeRegulation (ancestors)', 'The inherited Governance tab content'],
    ],
    infra: [
      [
        'Runtime',
        'Uncached reads; any non-GET clears the global response cache so /explorer refreshes after edits; value-streams permission',
      ],
    ],
  },
  {
    screen: 'Deliverables',
    ui: [
      [
        'Work.tsx tab=deliverables',
        'TOC or flat Sheet with drill sidebar',
        'frontend/src/pages/work/Work.tsx',
      ],
      [
        'Sheet/SheetCell',
        'Deliverable/Description/VS L2/L3/L4/Owner/Contributors/Tasks columns with combobox filters',
        'frontend/src/components/Sheet.tsx',
      ],
      [
        'Detail sidebar (DetailBody)',
        'Roles, plan rollup, inputs consumed, downstream impact per deliverable',
        'frontend/src/pages/work/Work.tsx Sidebar',
      ],
      [
        'AutomatableMeter',
        'Task-automatability meter reused in the drill',
        'frontend/src/components (AutomatableMeter)',
      ],
    ],
    apis: [
      [
        'GET /work?take=30000',
        'One payload carries deliverables AND tasks for both tabs',
        'Work.tsx via api.get + withCompany',
      ],
      ['GET /work/deliverable/:id', 'Drill sidebar association set', 'DetailBody'],
    ],
    core: [
      'List every deliverable the operating model produces, who owns it and what work feeds it.',
      'Batch pattern end-to-end: one {in: ids} junction load, one ancestorNames resolve, aggregate in memory; taskPlans rolls checklist/testing status per deliverable — no per-row fan-out anywhere.',
      'backend/src/routes/work.ts · lib/workPlan.ts',
    ],
    tables: [
      [
        'Deliverable, NodeDeliverable, RoleDeliverable',
        'The rows, their producing nodes and owner/contributor roles',
      ],
      [
        'NodeStandard, NodeRegulation, NodeWorkTemplate',
        'Inherited governance + plan-pattern columns',
      ],
    ],
    infra: [
      [
        'Runtime',
        'requireAnyPermission([tasks,deliverables]); tenant-keyed cacheResponses(15s); 30k row cap',
      ],
    ],
  },
  {
    screen: 'Tasks',
    ui: [
      [
        'Work.tsx tab=tasks',
        'Task sheet with plan + governance columns',
        'frontend/src/pages/work/Work.tsx',
      ],
      [
        'AutomatableMeter',
        '1–5 agent-automatability meter per task',
        'frontend/src/components (AutomatableMeter)',
      ],
      [
        'Detail sidebar (task branch)',
        'Checklist/testing plan groups, feeds-deliverable, outputs, Work Library link',
        'frontend/src/pages/work/Work.tsx',
      ],
    ],
    apis: [
      ['GET /work?take=30000', 'Shared payload (same call as Deliverables)', 'Work.tsx'],
      ['GET /work/task/:id', 'Task drill: plans, deliverable, outputs', 'DetailBody'],
    ],
    core: [
      'Expose every L5 task with its owner, governance and how automatable it is.',
      'Standards/regs per task are inherited from L2/L3 ancestors through the closure at read time; SCORE_OF maps the stored 1–5 automatability into the meter; plans resolve via NodeWorkTemplate (TEST kind = testing pattern).',
      'backend/src/routes/work.ts (SCORE_OF, inheritance)',
    ],
    tables: [
      ['ProcessNode (isTask, automatability)', 'The task rows and their agent scores'],
      ['NodeWorkTemplate + NodeTemplateAnswer', 'Checklist/testing plan patterns and values'],
      ['NodeStandard, NodeRegulation, Deliverable', 'Governance columns and the fed deliverable'],
    ],
    infra: [['Runtime', 'Same router as Deliverables: either-of permission, 15s cache, 30k cap']],
  },
  {
    screen: 'Standards',
    ui: [
      [
        'Standards.tsx (page)',
        'TOC (area cards) or flat List view',
        'frontend/src/pages/standards/Standards.tsx',
      ],
      [
        'Sheet + ListSearch',
        'Department/Category/Group/Standard/Description/Responsible columns',
        'frontend/src/components/Sheet.tsx',
      ],
      [
        'StandardDrawer',
        'In-place detail drawer from list rows',
        'frontend/src/components/StandardDrawer.tsx',
      ],
    ],
    apis: [
      ['GET /explorer/standards', 'Area totals + TOC rows', 'Standards.tsx useApi'],
      ['GET /explorer/standards-flat', 'Flat leaf list for the sheet', 'Standards.tsx api.get'],
    ],
    core: [
      'Publish the standards library — 1,300+ atomic, evidenceable rules grouped by department area.',
      'vsForStandards derives applies-to value streams from NodeStandard junctions; skillName labels each standard’s agent skill; areas/groups/leaves are one self-nesting table walked by parentId.',
      'backend/src/routes/explorer/standards.ts · lib/govRollup.ts',
    ],
    tables: [
      ['Standard (self-nesting: isArea → groups → leaves)', 'The whole library'],
      ['RoleStandard, NodeStandard', 'Responsible/applier roles and value-stream links'],
    ],
    infra: [
      [
        'Runtime',
        'Rides the explorer router (value-streams permission — known mismatch with the standards menu key) + 15s cache',
      ],
    ],
  },
  {
    screen: 'Standard drawer',
    ui: [
      [
        'StandardDrawer (DrawerShell 560px)',
        'Description, sibling hop, skill viewer, SDLC gates, responsible role, plan keys, VS chips',
        'frontend/src/components/StandardDrawer.tsx',
      ],
      [
        'SkillViewer (nested)',
        'Renders the standard’s agent-skill markdown',
        'frontend/src/components/SkillViewer.tsx',
      ],
    ],
    apis: [
      [
        'GET /explorer/standards/:areaId',
        'Loads the whole area once; drawer selects the clicked item client-side',
        'StandardDrawer',
      ],
    ],
    core: [
      'Show one standard completely — what it demands, who applies it, how it is tested and where it applies.',
      'Loading the area (not the leaf) makes sibling navigation instant; generic vs specific plan keys split server-side from StandardTemplateAnswer rows.',
      'backend/src/routes/explorer/standards.ts (GET /standards/:id)',
    ],
    tables: [
      ['Standard + ownerRole + roleStandards', 'Identity, responsibility, appliers'],
      ['StandardWorkTemplate + StandardTemplateAnswer', 'Checklist/testing plan keys and values'],
    ],
    infra: [['Runtime', 'Bundled with the Standards chunk; 15s explorer cache']],
  },
  {
    screen: 'Regulations',
    ui: [
      [
        'Regulations.tsx (page)',
        'International/Federal/State lens tabs (sessionStorage) + four headline tiles',
        'frontend/src/pages/regulations/Regulations.tsx',
      ],
      [
        'RequirementsTable',
        'Server-driven infinite-scroll grid with per-column combobox filters',
        'frontend/src/pages/regulations/RequirementsTable.tsx',
      ],
      [
        'LinkChips/LinksEditor',
        'Requirement ↔ value-stream link chips',
        'frontend/src/components/RequirementLinks.tsx',
      ],
    ],
    apis: [
      [
        'GET /regulations/lens-stats?lens=',
        'Headline tile numbers per lens',
        'Regulations.tsx useApi',
      ],
      [
        'GET /regulations/requirement-filters',
        'Combobox option sets for the grid',
        'RequirementsTable',
      ],
      [
        'GET /regulations/requirements?page=&pageSize=100',
        'Paged requirement rows (infinite scroll)',
        'RequirementsTable',
      ],
      [
        'GET /regulations/overview',
        'Value-stream options for the links editor',
        'RequirementsTable list variant',
      ],
    ],
    core: [
      'Make a 24,000-row regulatory catalog navigable by lens, regulator, market and line of business.',
      'Paging, filtering and counting all happen server-side (the catalog never ships whole); coverage per value stream derives from raw SQL over NodeRegulation × ProcessNodeClosure; lensRegulatorTypes classifies regulators per lens.',
      'backend/src/routes/regulations/lenses.ts · helpers.ts',
    ],
    tables: [
      ['RegulatoryRequirement (24k rows)', 'The catalog grid'],
      [
        'Jurisdiction, RegulatorySource, RegulatoryBulletin, ComplianceRule',
        'Lens tiles and drill-in context',
      ],
      [
        'RoleRegulation, RequirementLineOfBusiness, NodeRegulation',
        'Owner, LOB and value-stream link columns',
      ],
    ],
    infra: [
      [
        'Runtime',
        'regulations permission (method-derived CRUD); deliberately uncached (writes share the router); cross-tenant miss → 404',
      ],
    ],
  },
  {
    screen: 'Work Library',
    ui: [
      [
        'WorkLibrary.tsx (page)',
        'URL-param-driven plans/templates views (?view,?type,?id + filters)',
        'frontend/src/pages/work-library/WorkLibrary.tsx',
      ],
      [
        'SubjectPicker',
        'Left rail choosing task/standard/regulation subjects',
        'frontend/src/pages/work-library/SubjectPicker.tsx',
      ],
      [
        'PatternDropdown ×2',
        'Checklist (multi) + testing (single) pattern assignment',
        'frontend/src/pages/work-library/controls.tsx',
      ],
      [
        'PlanBlock',
        'Key/value answer matrix per assigned pattern',
        'frontend/src/pages/work-library/PlanBlock.tsx',
      ],
      [
        'TiedBlock',
        'Standards/regs tied to the task',
        'frontend/src/pages/work-library/TiedBlock.tsx',
      ],
      [
        'TemplatesEditor (admin)',
        'Template catalog CRUD',
        'frontend/src/pages/work-library/TemplatesEditor.tsx',
      ],
    ],
    apis: [
      ['GET /work-library/templates', 'Template + key catalog', 'WorkLibrary useApi'],
      [
        'GET /work-library/plan/:type/:id',
        'The subject’s assigned patterns + answers',
        'WorkLibrary useApi',
      ],
      [
        'PUT /work-library/plan/:type/:id/templates',
        'Replace pattern assignments',
        'pattern dropdown save',
      ],
      [
        'PUT /work-library/plan/:type/:id/answers · DELETE …/answers/:answerId',
        'Write/remove answer values',
        'PlanBlock',
      ],
      [
        'POST+DELETE /work-library/plan/task/:id/{standards,regulations}',
        'Tie/untie governance to a task',
        'TiedBlock',
      ],
      [
        'PUT /work-library/plan/task/:id/evidence',
        'Attach evidence to a plan',
        'PlanBlock evidence',
      ],
    ],
    core: [
      'One place to author HOW work is done: which checklist/testing pattern applies and the concrete values per subject.',
      'Answers persist per (subject, templateKey) independent of assignment junctions — re-linking a pattern never loses values; findSubject dispatches the three subject types through one code path.',
      'backend/src/routes/work-library/{plan,templates}.ts · helpers.ts',
    ],
    tables: [
      ['WorkTemplate + WorkTemplateKey', 'The pattern catalog and its keys'],
      ['Node/Standard/Regulation WorkTemplate junctions', 'Which pattern applies to which subject'],
      ['Node/Standard/Regulation TemplateAnswer', 'The concrete plan values'],
      ['NodeStandardEvidence, NodeRegulationEvidence', 'Evidence tied to task plans'],
    ],
    infra: [
      [
        'Runtime',
        'work-library permission; uncached (heavy writes); frontend re-gates template editing via can(update)',
      ],
    ],
  },
  {
    screen: 'Testing template modal',
    ui: [
      [
        'TestingTemplateModal (600px aside)',
        'Meta columns + parsed generic pattern + specific "Pass =" tests',
        'frontend/src/components/TestingTemplateModal.tsx',
      ],
      [
        'CSV export button',
        'Client-side Blob download of the table',
        'TestingTemplateModal downloadCsv',
      ],
    ],
    apis: [
      [
        'GET /explorer/testing-templates/:nodeId',
        'Subtree testing rows (cap 500) with joined titles',
        'TestingTemplateModal',
      ],
    ],
    core: [
      'Show every test that guards a node’s subtree, split into the reusable pattern vs the concrete assertions.',
      'parseTestingPlan splits each template server-side by regex ("In <system>, verify:" / "Pass =") so the UI renders pattern and specifics without client parsing; processSubtree collects descendants via the closure.',
      'backend/src/routes/explorer/testingTemplates.ts',
    ],
    tables: [
      ['TestingTemplate', 'The rows, joined to Deliverable titles and task node names'],
      ['ProcessNodeClosure', 'The subtree sweep that finds every descendant’s rows'],
    ],
    infra: [
      [
        'Runtime',
        '500-row cap; 15s explorer cache; bundled with its caller chunks (map, metrics sidebar)',
      ],
    ],
  },
  {
    screen: 'Applications',
    ui: [
      [
        'Applications.tsx (page)',
        'TOC per app kind (+count/TCO) or List; ?focus= scrolls to a row',
        'frontend/src/pages/applications/Applications.tsx',
      ],
      [
        'Sheet',
        'Name/kind/category/vendor/division/TCO columns',
        'frontend/src/components/Sheet.tsx',
      ],
      [
        'AppDrawer',
        'What it does, value streams, using roles — zero extra fetches',
        'frontend/src/pages/applications/AppDrawer.tsx',
      ],
      [
        'ApplicationKind (drill page)',
        'Per-kind drill at /applications/kinds/:kind',
        'frontend/src/pages/applications/ApplicationKind.tsx',
      ],
    ],
    apis: [
      [
        'GET /applications',
        'Whole portfolio incl. drawer content in one call',
        'Applications.tsx useApi',
      ],
    ],
    core: [
      'Inventory the application estate with cost and usage so rationalization has a factual base.',
      'ancestorNames + rolesForNodes resolve each app’s value-stream placement and users from NodeAppUsage in one batch; TCO aggregates per kind for the TOC.',
      'backend/src/routes/applications.ts',
    ],
    tables: [
      ['Application (+ orgUnit, TCO fields)', 'The portfolio rows'],
      ['NodeAppUsage', 'Where each app is used across the process spine'],
    ],
    infra: [['Runtime', 'applications permission; cacheResponses(15s); lazy chunk']],
  },
  {
    screen: 'Third-Parties',
    ui: [
      [
        'External.tsx (page + InteractionDrawer)',
        'Sheet of external parties; drawer synthesizes “what they do”',
        'frontend/src/pages/external/External.tsx',
      ],
      [
        'Sheet/SheetCell + Chip',
        'Party/type/VS/owner/interaction/dependency columns',
        'frontend/src/components/Sheet.tsx',
      ],
    ],
    apis: [
      ['GET /external-interactions', 'One list powers sheet and drawer', 'External.tsx useApi'],
    ],
    core: [
      'Map who outside the company the operating model depends on, and through which value streams.',
      'streamAncestry resolves each interaction’s value-stream context; the internal owner derives from NodeRole; tenancy walks externalParty → company → tenant.',
      'backend/src/routes/externalInteractions.ts',
    ],
    tables: [
      ['ExternalParty + ExternalInteraction', 'The parties and each interaction row'],
      ['Role, ProcessNode, NodeRole', 'Owner and value-stream columns'],
    ],
    infra: [['Runtime', 'third-parties permission; uncached router']],
  },
  {
    screen: 'Workspace',
    ui: [
      [
        'WorkspaceMap.tsx',
        'Three-column rationalization map: lens bar, board picker, zoom, trace breadcrumb',
        'frontend/src/pages/workspace-map/WorkspaceMap.tsx',
      ],
      [
        'BrownfieldPanel + ScreenView',
        'Current state per screen: live preview + per-layer findings',
        'frontend/src/pages/workspace-map/{BrownfieldPanel,ScreenView}.tsx',
      ],
      [
        'NormalizeColumn',
        'Per-layer T-chart / pass-through cards scoped to the active screen',
        'frontend/src/pages/workspace-map/NormalizeColumn.tsx',
      ],
      [
        'GreenfieldColumn',
        'Target micro-site cutaway with layer slots and progress',
        'frontend/src/pages/workspace-map/GreenfieldColumn.tsx',
      ],
      [
        'FlowEdges (SVG)',
        'Smooth-step connectors with per-layer gutter lanes and count pills',
        'frontend/src/pages/workspace-map/FlowEdges.tsx',
      ],
    ],
    apis: [
      [
        'GET /rationalization',
        'Board list per lens (applicationIds/valueStreamIds/roleIds params)',
        'useBoard.ts useBoardList',
      ],
      [
        'GET /rationalization/:id',
        'Full board payload: apps, findings, components, microservices, screens',
        'useBoard.ts useBoardDetail',
      ],
      [
        'POST /rationalization/:id/layout',
        'Commits user-curated layout overlays (not used by the read-only map)',
        'boards.ts',
      ],
    ],
    core: [
      'Visualize an application’s decomposition → normalization → target so rationalization decisions are legible.',
      'columnStatsOf/normalizeStatsOf/progressOf compute stay/move counts and lifecycle progress from findings at read time; the map you are reading renders THIS board’s rows about itself.',
      'backend/src/lib/rationalization.ts · routes/rationalization/boards.ts',
    ],
    tables: [
      [
        'RationalizationWorkspace/App/Capability/Component/Microservice',
        'The board: sources, findings, normalized components, target',
      ],
      [
        'ScreenAsset, NormalizationEntry, WorkspaceVocabulary',
        'Screen catalog, T-chart entries and classification vocabulary',
      ],
    ],
    infra: [
      [
        'Runtime',
        'rationalization router reuses the applications permission; tab guards with the workspace menu key; uncached',
      ],
    ],
  },
  {
    screen: 'Workspace › Edit box modal',
    ui: [
      [
        'EditBoxModal — RETIRED',
        'The old board’s 355-line box editor (scope picker, segment/geography, target component, dead-code flag) was deleted with the whole greenfield-migration tree in 30d55bc; edits now flow through Data Admin CRUD and the map stays read-only.',
        'was frontend/src/pages/greenfield-migration/EditBoxModal.tsx (removed 2026-07-12)',
      ],
    ],
    apis: [],
    core: null,
    tables: [],
    infra: [],
  },
  {
    screen: 'Automatable',
    ui: [
      [
        'Automatable.tsx (page)',
        'Headline % automatable, five-tier distribution bar, rollups by Division/Department/VS/Role',
        'frontend/src/pages/automatable/Automatable.tsx',
      ],
      ['Stat + Card', 'Shared stat tiles framing the tiers', 'frontend/src/components/ui'],
    ],
    apis: [
      [
        'GET /work?companyId=',
        'Reuses the Tasks feed — no bespoke endpoint',
        'Automatable.tsx api.get',
      ],
    ],
    core: [
      'Quantify how much of the operating model AI agents could take on today.',
      '“Automatable” = agent score ≤ 2; automatablePct aggregates the stored 1–5 ProcessNode.automatability scores (scored per task by live Claude) into headline and per-dimension percentages, entirely client-side.',
      'frontend/src/lib/automatable.ts',
    ],
    tables: [['ProcessNode.automatability', 'The single input: 1–5 agent score per L5 task']],
    infra: [['Runtime', 'Rides /work’s 15s cache + tasks|deliverables permission']],
  },
  {
    screen: 'Metrics',
    ui: [
      [
        'ActiveAI.tsx (page, route /metrics)',
        'Stage 1 current-state analysis + Stage 2 adoption telemetry + VS × mode heat map',
        'frontend/src/pages/active-ai/ActiveAI.tsx',
      ],
      [
        'ActiveAIDetail (drill)',
        'Per-value-stream drill at /metrics/:id',
        'frontend/src/pages/active-ai-detail/ActiveAIDetail.tsx',
      ],
    ],
    apis: [
      [
        'GET /explorer/value-stream-adoption',
        'Adoption % per value stream × AI mode',
        'ActiveAI Promise.all',
      ],
      [
        'GET /ai-analysis/summary?companyId=',
        'Baseline inventory + analysis coverage',
        'ActiveAI Promise.all',
      ],
    ],
    core: [
      'Track the AI transformation itself: how much is analyzed, and of that, what is automated/augmented/discarded/manual.',
      'Adoption rolls up from NodeAiAdoption levels and automatability via the closure; AnalysisStatus tracks coverage per subject so the “analyzed” denominator is honest.',
      'backend/src/routes/aiAnalysis.ts · explorer/telemetry.ts',
    ],
    tables: [
      ['NodeAiAdoption', 'Adoption mode per node → the heat map'],
      ['AnalysisStatus', 'Coverage per value stream/division/role'],
      ['ProcessNode (automatability)', 'Baseline tier inputs'],
    ],
    infra: [
      [
        'Runtime',
        'Two keys serve one page: value-streams (cached explorer feed) + metrics (uncached summary); /active-ai redirects',
      ],
    ],
  },
  {
    screen: 'Product Models',
    ui: [
      [
        'ProductModels.tsx (page)',
        'TOC per segment or List with disposition pills; ?focus= scroll',
        'frontend/src/pages/product-models/ProductModels.tsx',
      ],
      [
        'ProductModelDrawer (DrawerShell)',
        'Coverage, components, canonical mapping, workspace links',
        'frontend/src/pages/product-models/ProductModelDrawer.tsx',
      ],
      [
        'ProductModelSegment (drill)',
        'Per-segment drill page',
        'frontend/src/pages/product-models/ProductModelSegment.tsx',
      ],
    ],
    apis: [
      [
        'GET /product-models',
        'Catalog with workspace links and finding counts in one call',
        'ProductModels useApi',
      ],
    ],
    core: [
      'Catalog legacy product models and their path to canonical ones — the product twin of application rationalization.',
      'LegacyProductModel rows link into ProductModelWorkspace boards; deep links carry ?workspace= into /portfolio so the same map UI serves both domains.',
      'backend/src/routes/product-models/models.ts',
    ],
    tables: [
      ['LegacyProductModel + CanonicalProductModel', 'The catalog and its normalization targets'],
      [
        'ProductModelWorkspace, ProductModelComponent/Finding/NormalizationEntry',
        'Board linkage mirroring the application anatomy shape',
      ],
    ],
    infra: [
      [
        'Runtime',
        'Router checks the workspace permission (menu key product-models differs); mutations audited',
      ],
    ],
  },
  {
    screen: 'Login',
    ui: [
      [
        'Login.tsx (page)',
        'Centered card, email+password form, error surface',
        'frontend/src/pages/login/Login.tsx',
      ],
      [
        'ui Input/Label/Button/ErrorMessage',
        'The form primitives',
        'frontend/src/components/ui/Field.tsx',
      ],
      [
        'AuthProvider (lib/auth)',
        'Owns login()/refreshMe(); routes to defaultRoute(permissions, startPage) on success',
        'frontend/src/lib/auth.tsx',
      ],
    ],
    apis: [
      ['POST /auth/login', 'bcrypt compare → signs the 7-day JWT', 'lib/auth.tsx login()'],
      [
        'GET /auth/me',
        'Profile + effective permission snapshot (login, mount, refresh)',
        'lib/auth.tsx',
      ],
    ],
    core: [
      'Establish who you are and what you may see, then land you on your start page.',
      'getEffectivePermissions merges the user type’s PermissionSet grants with per-user overrides across MENU_TREE — one decision path both frontend RouteGuard and backend requirePermission trust; unknown and deactivated users fail identically (no account oracle).',
      'backend/src/routes/auth.ts · services/permissions',
    ],
    tables: [
      ['User (bcrypt hash)', 'Credential check + identity'],
      [
        'PermissionSet + PermissionSetGrant + UserPermissionOverride',
        'The effective permission snapshot',
      ],
      ['UserPreference (startPage), UserValueStream', 'Landing route + scope display'],
    ],
    infra: [
      [
        'Runtime',
        'JWT {sub, tenantId, email, role} exp 7d in localStorage; requireAuth re-loads the user per request and 401s DEACTIVATED even on a valid token; 401 client-side clears storage → /login',
      ],
    ],
  },
  {
    screen: 'Settings',
    ui: [
      [
        'Settings.tsx (page)',
        'Personal preference cards, all auto-saving',
        'frontend/src/pages/settings/Settings.tsx',
      ],
      [
        'StartPageCard',
        'Start-page picker limited to readable pages',
        'frontend/src/components/settings/StartPageCard.tsx',
      ],
      [
        'NotificationCard + DashboardCard',
        'Notification + dashboard layout preferences',
        'frontend/src/components/settings/',
      ],
      [
        'usePreferences store',
        '~800ms debounced writer with visibilitychange/beforeunload flush',
        'frontend/src/lib/preferences.tsx',
      ],
    ],
    apis: [
      ['GET /me/preferences', 'Loads the row-per-key store', 'PreferencesProvider mount'],
      [
        'PATCH /me/preferences',
        'Debounced upsert; sent with invalidate:none so the warm GET cache survives',
        'preferences flush()',
      ],
    ],
    core: [
      'Let each user shape their own workspace without admin involvement.',
      'Reserved keys validate against shared zod schemas, dynamic keys against allowed patterns; startPage re-validates against effective permissions server-side so nobody can bookmark themselves into a page they cannot read.',
      'backend/src/routes/me/preferences.ts',
    ],
    tables: [
      ['UserPreference (userId+key unique)', 'Every setting row; 32KB/value, 50 keys/request caps'],
    ],
    infra: [
      [
        'Runtime',
        '/me router is requireAuth-only (operates on req.user.id, no menu key); deliberately unaudited high-frequency writes',
      ],
    ],
  },
  {
    screen: 'Send feedback panel',
    ui: [
      [
        'FeedbackWidget (portaled aside)',
        'Non-blocking panel — deliberately NOT DrawerShell so the page stays interactive',
        'frontend/src/components/FeedbackWidget.tsx',
      ],
      ['Category Select + Textarea (10k cap)', 'The submission form', 'FeedbackWidget fields'],
      [
        'modern-screenshot capture',
        'Silent domToBlob screenshot of the page, excluding the panel itself',
        'FeedbackWidget submit',
      ],
    ],
    apis: [
      [
        'GET /feedback/config',
        'Widget on/off + categories from feedback.config.json',
        'FeedbackWidget mount',
      ],
      [
        'POST /feedback (multipart)',
        'text + category + route + commitSha + userAgent + screenshot blob',
        'api.upload',
      ],
    ],
    core: [
      'Turn a user’s "this is wrong" into a triaged Jira ticket without them leaving the page.',
      'runFeedbackPipeline (async, waitUntil) classifies the text with an LLM, routes the story to the right Jira epic by captured page, and emails the requester — the request itself returns instantly.',
      'backend/src/lib/feedback/pipeline.ts',
    ],
    tables: [
      [
        'Feedback (screenshot bytea + mime)',
        'The submission + its screenshot; also drives the rate limit count',
      ],
    ],
    infra: [
      [
        'Runtime',
        'DB-backed 5/min/user rate limit; multer 5MB image cap; identity strictly from JWT; commitSha baked in at build (__COMMIT_SHA__)',
      ],
    ],
  },
  {
    screen: 'Confirm / prompt dialogs',
    ui: [
      [
        'DialogProvider + useDialogs()',
        'Promise-based confirm/prompt/alert replacing window.* natives',
        'frontend/src/lib/dialogs.tsx',
      ],
      ['typedConfirm', 'Destructive flows require typing the exact label', 'lib/dialogs.tsx'],
      [
        'DialogModal',
        'fixed z-60 overlay, aria-modal, Escape/backdrop cancel, Enter submit',
        'lib/dialogs.tsx',
      ],
    ],
    apis: [],
    core: [
      'One consistent, testable confirmation UX for every destructive action in the app.',
      'A single pending-dialog slot resolves a Promise<boolean|string|null> to the caller; consumers await it and then run their own mutation — the dialog layer itself owns no data and makes no calls.',
      'frontend/src/lib/dialogs.tsx',
    ],
    tables: [],
    infra: [
      [
        'Runtime',
        'Pure client primitive; repo rule bans window.confirm/alert/prompt everywhere (lint + review gate)',
      ],
    ],
  },
  {
    screen: 'Data Admin',
    ui: [
      [
        'Admin.tsx (Studio)',
        'Left nav mirrors product tabs (ADMIN_TABS); view switch Configure/Signals/Audit/Dictionary',
        'frontend/src/pages/admin/Admin.tsx',
      ],
      [
        'AdminSection (generic editor)',
        'Paginated, searchable, field-filterable CRUD per entity',
        'frontend/src/components/admin/AdminSection.tsx',
      ],
      [
        'AdminAssistant (AI overlay)',
        'Assisted edits over the same CRUD',
        'frontend/src/components/admin/AdminAssistant.tsx',
      ],
      ['SignalCatalog', 'Trackable-metrics tab', 'frontend/src/components/SignalCatalog.tsx'],
    ],
    apis: [
      ['GET /admin/_meta', 'Entity registry powering the studio', 'Admin.tsx mount'],
      [
        'GET/POST /admin/:entity · GET/PATCH/DELETE /admin/:entity/:id',
        'Generic CRUD (?take/skip, ?search, ?f_<field>=)',
        'AdminSection editors',
      ],
      ['PATCH /admin/company/:id/dashboard', 'Default dashboard layout', 'Home admin tab'],
      [
        'GET /admin/validations?companyId=',
        'On-demand data-quality checks',
        'Admin validations panel',
      ],
      ['GET/PATCH /admin/ai-adoption[/:levelId]', 'Adoption level editing', 'Admin AI tab'],
    ],
    core: [
      'Give admins direct, safe CRUD over every registered entity without bespoke screens per table.',
      'lib/adminRegistry maps entity names to Prisma delegates with tenant scoping baked in; every write funnels through logAudit + computeDiff so the ledger captures field-level change history.',
      'backend/src/routes/admin/{meta,crud}.ts · lib/adminRegistry',
    ],
    tables: [
      ['Every registered admin entity (via delegate())', 'The generic editors'],
      ['Company.dashboardConfig (jsonb), NodeAiAdoption', 'The specials'],
      ['AuditEntry (written)', 'Field-level diffs for every admin write'],
    ],
    infra: [
      [
        'Runtime',
        'data-admin.configure permission (SITE_ADMIN always passes); uncached by design; company validated against tenant',
      ],
    ],
  },
  {
    screen: 'Data Admin › Audit Log',
    ui: [
      [
        'AuditTrail.tsx (embedded)',
        'When | action pill | entity | actor | DiffView table',
        'frontend/src/pages/audit-trail/AuditTrail.tsx',
      ],
      ['DiffView', 'Field-level {from,to} rendering per entry', 'AuditTrail.tsx'],
    ],
    apis: [
      [
        'GET /audit?limit=200&entityType=',
        'Tenant-scoped ledger read, newest first (cap 500)',
        'AuditTrail on filter change',
      ],
      ['GET /admin/_meta', 'Entity-type filter options', 'AuditTrail mount'],
    ],
    core: [
      'Answer “who changed what, when” for every governed write in the app.',
      'AuditEntry rows are written by services/audit across roles, admin, users, api-keys and product-models; this screen only reads — the ledger is append-only from the UI’s perspective.',
      'backend/src/routes/audit.ts · services/audit.ts',
    ],
    tables: [
      ['AuditEntry (tenantId, actorEmail, entityType/Id, action, JSON diff)', 'The whole screen'],
    ],
    infra: [
      [
        'Runtime',
        'Own permission key data-admin.audit-log — read-the-ledger without grant-the-pen',
      ],
    ],
  },
  {
    screen: 'Data Admin › Data Dictionary',
    ui: [
      [
        'DataDictionary.tsx (embedded)',
        'Jump-list sidebar + grouped term cards + search',
        'frontend/src/pages/data-dictionary/DataDictionary.tsx',
      ],
      [
        'GLOSSARY constant',
        'The content itself — typed groups of term/aka/definition/values',
        'frontend/src/lib/glossary.ts',
      ],
    ],
    apis: [],
    core: [
      'Define the platform’s vocabulary so every tab’s labels mean one thing.',
      'Pure client-side filter over a typed constant; search matches term, aka, definition and values case-insensitively — zero network, instant results.',
      'frontend/src/pages/data-dictionary/DataDictionary.tsx',
    ],
    tables: [],
    infra: [
      [
        'Runtime',
        'Content ships in the JS bundle (no table, no permission surface); embedded prop suppresses the page header inside Admin',
      ],
    ],
  },
  {
    screen: 'User Admin › Users',
    ui: [
      [
        'UsersAdmin.tsx (Sheet)',
        'name/email/type/org/geography/VS chips/manager/approver/status columns',
        'frontend/src/components/user-admin/UsersAdmin.tsx',
      ],
      [
        'UserDetail (DrawerShell)',
        'Create/edit drawer incl. per-user permission overrides',
        'frontend/src/components/user-admin/UserDetail.tsx',
      ],
      ['StatusPill + Chip', 'Status and value-stream chips', 'frontend/src/components/ui'],
    ],
    apis: [
      ['GET /users · GET /users?managersOnly=1', 'The sheet + reports-to picker', 'UsersAdmin'],
      ['GET /users/pickers', 'Org/role/VS picker option sets', 'UserDetail'],
      [
        'GET /users/:id/permissions · PUT /users/:id/overrides',
        'Effective snapshot + override editing',
        'UserDetail',
      ],
      [
        'POST /users · PATCH /users/:id · DELETE /users/:id',
        'Provision, amend, deactivate',
        'UserDetail',
      ],
    ],
    core: [
      'Provision and govern user access with scope-aware admins and second-eyes on privilege.',
      'requireUserAdmin() scopes domain admins to their OrgUnit subtree (out-of-scope = 404, not 403); writes funnel through userProvisioning (validate refs, sanitize, upsert); privileged-role mints return 202 and park in the approvals engine until a second admin approves.',
      'backend/src/services/userProvisioning · lib/approvals/engine',
    ],
    tables: [
      ['User (password omitted from reads)', 'The sheet rows'],
      ['UserPermissionOverride, UserValueStream', 'Per-user grants and scope'],
      ['OrgUnit + OrgUnitClosure', 'Admin scope boundaries and org pickers'],
    ],
    infra: [
      [
        'Runtime',
        'user-admin.users permission + ABAC scope; overrides audited as PERMISSIONS_OVERRIDE and invalidate the target’s permission snapshot immediately',
      ],
    ],
  },
  {
    screen: 'User Admin › User Types & Permissions',
    ui: [
      [
        'PermissionSetsAdmin.tsx',
        'Six user types in a rail; CRUD grant tree per menu key (SITE_ADMIN read-only full)',
        'frontend/src/components/user-admin/PermissionSetsAdmin.tsx',
      ],
      [
        'GrantTree (PermissionTree)',
        'The editable create/read/update/delete tree',
        'frontend/src/components/user-admin/PermissionTree.tsx',
      ],
    ],
    apis: [
      [
        'GET /users/permission-sets',
        'Auto-creates any missing set (one per user type)',
        'PermissionSetsAdmin mount',
      ],
      [
        'PUT /users/permission-sets/:userType',
        'Replaces the grant list wholesale; may return 202 (held)',
        'PermissionSetsAdmin save',
      ],
    ],
    core: [
      'Define what each user type may do, with four-eyes on the definition itself.',
      'maybeHold parks grant replacements as ApprovalRequests (decisionKey user-admin.permission-sets.replace) until a second admin approves, then replacePermissionSetGrants applies atomically; the saver’s own snapshot refreshes via refreshMe().',
      'backend/src/routes/users/permissionSets.ts · services/permissionSetWrites',
    ],
    tables: [
      ['PermissionSet (per userType) + PermissionSetGrant', 'The grant trees'],
      ['ApprovalRequest (via engine)', 'Held replacements awaiting the second approver'],
    ],
    infra: [
      [
        'Runtime',
        'requireRole(SITE_ADMIN) — role gate, not menu key; other sessions pick changes up within ~1min snapshot staleness',
      ],
    ],
  },
  {
    screen: 'User Admin › API Keys & Provisioning',
    ui: [
      [
        'IntegrationsAdmin.tsx',
        'Create form + keys table (prefix, created, last used, status, revoke)',
        'frontend/src/components/user-admin/IntegrationsAdmin.tsx',
      ],
      [
        'reveal-once block',
        'Raw key + webhook secret shown exactly once after mint',
        'IntegrationsAdmin (data-testid reveal-once)',
      ],
      ['useDialogs confirm', 'Typed revoke confirmation', 'frontend/src/lib/dialogs.tsx'],
    ],
    apis: [
      [
        'GET /users/api-keys',
        'Lists prefixes only (hash + secret never returned)',
        'IntegrationsAdmin',
      ],
      [
        'POST /users/api-keys',
        'Mints tbk_ key (+optional webhook secret); raw returned once',
        'IntegrationsAdmin create',
      ],
      ['POST /users/api-keys/:id/revoke', 'Stamps revokedAt', 'IntegrationsAdmin revoke'],
      [
        'PUT/DELETE /provisioning/users/:externalId · POST /provisioning/webhook',
        'The machine-to-machine surface those keys unlock',
        'external SCIM-style callers',
      ],
    ],
    core: [
      'Let external identity systems provision users without a human in the loop — safely.',
      'Keys store hash+prefix only; webhook calls authenticate Bearer tbk_ plus HMAC-SHA256 X-Signature over the raw body keyed by the webhook secret; every mint/revoke is an audited event.',
      'backend/src/middleware/apiKeyAuth.ts · routes/provisioning/*',
    ],
    tables: [
      ['ApiKey (keyHash, keyPrefix, scopes, lastUsedAt, revokedAt)', 'The key inventory'],
      ['User (via provisioning writes)', 'What the external callers create/update'],
    ],
    infra: [
      [
        'Runtime',
        'requireRole(SITE_ADMIN) for management; provisioning surface authenticated by apiKeyAuth middleware, not JWT',
      ],
    ],
  },
];

interface RowOut {
  layer: string;
  name: string;
  category: string;
  summary: string;
  codeRef: string;
  view: 'COMPONENT' | 'BEHAVIOR';
  dead?: boolean;
}

function expand(spec: Spec): RowOut[] {
  const rows: RowOut[] = [];
  const dead = spec.screen === 'Workspace › Edit box modal';
  for (const [name, role, ref] of spec.ui) {
    rows.push({
      layer: 'UI',
      name,
      category: 'Component reuse',
      summary: role,
      codeRef: ref ?? '',
      view: 'COMPONENT',
      dead,
    });
  }
  for (const [call, purpose, site] of spec.apis) {
    const write = /POST|PATCH|PUT|DELETE/.test(call);
    rows.push({
      layer: 'Integration',
      name: call,
      category: 'API orchestration',
      summary: `${purpose}. Called from ${site}.`,
      codeRef: site,
      view: write ? 'BEHAVIOR' : 'COMPONENT',
    });
  }
  if (spec.core) {
    const [what, logic, ref] = spec.core;
    rows.push({
      layer: 'Business Service',
      name: 'Core purpose & logic',
      category: 'Workflow orchestration',
      summary: `${what} ${logic}`,
      codeRef: ref,
      view: 'BEHAVIOR',
    });
  }
  for (const [tables, populates] of spec.tables) {
    rows.push({
      layer: 'Data',
      name: tables,
      category: 'Schema & migrations',
      summary: `Populates: ${populates}.`,
      codeRef: 'backend/prisma/schema.prisma',
      view: 'COMPONENT',
    });
  }
  if (!dead) {
    rows.push({
      layer: 'Infrastructure',
      name: 'Tech stack & hosting',
      category: 'Environment-specific settings',
      summary: STACK,
      codeRef: 'vercel.json · backend/prisma/schema.prisma (Neon)',
      view: 'COMPONENT',
    });
    for (const [name, detail] of spec.infra) {
      rows.push({
        layer: 'Infrastructure',
        name: `${name} — this screen`,
        category: 'Policies',
        summary: detail,
        codeRef: 'backend/src (router middleware)',
        view: 'BEHAVIOR',
      });
    }
  }
  return rows;
}

async function main() {
  const ws = await prisma.rationalizationWorkspace.findUnique({ where: { id: WS } });
  if (!ws) throw new Error('workspace not found');

  const del = await prisma.rationalizationCapability.deleteMany({ where: { workspaceId: WS } });
  console.log(`deleted ${del.count} old findings`);

  const data = SPECS.flatMap((spec) =>
    expand(spec).map((r) => ({
      tenantId: ws.tenantId,
      companyId: ws.companyId,
      workspaceId: WS,
      appId: r.layer === 'UI' ? APP_FE : APP_BE,
      layer: r.layer,
      name: r.name,
      category: r.category,
      capdan: r.dead ? 'Eliminate' : 'Common',
      targetLayer: null,
      treatment: r.dead ? 'Eliminate' : 'Retain',
      migrationStatus: r.dead ? 'Retired' : 'Migrated',
      componentId: COMP[r.layer],
      codeRef: r.codeRef || null,
      plainSummary: r.summary,
      screenRef: spec.screen,
      view: r.view,
      illustrative: false,
      deadCode: r.dead ?? false,
    })),
  );
  const ins = await prisma.rationalizationCapability.createMany({ data });
  console.log(`inserted ${ins.count} findings across ${SPECS.length} screens`);

  const catalog = await prisma.screenAsset.findMany({
    where: { workspaceId: WS },
    select: { name: true },
  });
  const covered = new Set(SPECS.map((s) => s.screen));
  const missing = catalog.map((s) => s.name).filter((n) => !covered.has(n));
  console.log(
    missing.length
      ? `MISSING coverage: ${missing.join(', ')}`
      : 'coverage: every catalog screen has findings',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
