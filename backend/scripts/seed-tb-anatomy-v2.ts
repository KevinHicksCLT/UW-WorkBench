// Transformation Bridge self-anatomy v2 — full per-screen deep dive.
// Replaces the workspace's findings with one detailed, code-grounded set:
// every catalog screen carries its UI / Integration (APIs) / Data /
// Infrastructure slice (Business Service only where a real derivation layer
// exists). All facts were extracted from the live codebase 2026-07-12 (file
// paths and endpoints are real). Everything is Common/Retain/Migrated — the
// app is live — and normalizes 1:1; the retired Edit-box modal is the one
// dead-code entry.
//
// Run from backend/:  npx tsx --env-file=.env scripts/seed-tb-anatomy-v2.ts
// Idempotent: deletes and reinserts this workspace's findings; upserts the
// missing "Product Models" screen into the catalog.
import { prisma } from '../src/db/prisma.js';

const WS = 'cmr9uk5530000j099hz8gcoid';
const APP_FE = 'cmr9uk57y0001j099csnaelza'; // TB Frontend (React SPA)
const APP_BE = 'cmr9uk57z0002j099731oqqaw'; // TB Backend (Express API)
const COMP: Record<Layer, string> = {
  UI: 'cmr9uk5qq0010j099yhfnwmpw',
  Integration: 'cmr9uk5t80011j099jrazsoxn',
  'Business Service': 'cmr9uk5uh0012j09968d2qj6o',
  Data: 'cmr9uk5y80013j099k5fkmcaw',
  Infrastructure: 'cmr9uk5zf0014j099yb8wria7',
};

type Layer = 'UI' | 'Integration' | 'Business Service' | 'Data' | 'Infrastructure';

interface Row {
  screen: string;
  layer: Layer;
  name: string;
  summary: string;
  codeRef: string;
  category: string;
  /** COMPONENT (structure) vs BEHAVIOR (logic); defaults to COMPONENT. */
  view?: 'COMPONENT' | 'BEHAVIOR';
  dead?: boolean;
}

const R = (
  screen: string,
  layer: Layer,
  name: string,
  category: string,
  summary: string,
  codeRef: string,
  view?: 'COMPONENT' | 'BEHAVIOR',
): Row => ({ screen, layer, name, category, summary, codeRef, view });

const ROWS: Row[] = [
  // ── Home ──
  R(
    'Home',
    'UI',
    'Customizable KPI dashboard grid',
    'Cards & Panels',
    'Six-column grid of KPI/rollup widgets (totals, top value streams, transformation programs, RAID, financials) from the WIDGET_MAP catalog; Customize mode reorders/hides cards and auto-saves per user.',
    'frontend/src/pages/overview/Overview.tsx · lib/dashboardWidgets',
  ),
  R(
    'Home',
    'Integration',
    'GET /dashboard aggregate feed',
    'API orchestration',
    'One company-scoped call returns every widget’s numbers in a single payload; widget layout persists separately through the debounced preference store.',
    'backend/src/routes/dashboard.ts',
  ),
  R(
    'Home',
    'Business Service',
    'structureCounts dashboard rollup',
    'Derivations / resolvers',
    'Value-stream and level counts derive on read from the ProcessNode closure — dashboard numbers always match what the tabs render, nothing denormalized.',
    'backend/src/lib/resolvers (structureCounts)',
    'BEHAVIOR',
  ),
  R(
    'Home',
    'Data',
    'Cross-domain widget read set',
    'Reference data',
    'Reads Company, PortfolioInitiative, Program, RaidItem, Metric, Scenario, TelemetrySignal, the ProcessNode/OrgUnit spines and Standard to feed the widget catalog; the dashboard writes nothing.',
    'backend/src/routes/dashboard.ts (prisma reads)',
  ),
  R(
    'Home',
    'Infrastructure',
    'home permission gate + lazy route chunk',
    'Permissions',
    'requireAuth JWT then requirePermission(home); the page is a React.lazy chunk behind RouteGuard; pino logs each request with an X-Request-Id echo.',
    'backend/src/routes/dashboard.ts · frontend/src/App.tsx',
  ),

  // ── Organization ──
  R(
    'Organization',
    'UI',
    'Org drill: TOC, Excel grid, React Flow map',
    'Grids / Tables',
    'URL-driven view switch (?view=map|list|departments): OrgDrillToc, the OrgListExplorer drill grid with a metrics sidebar, and the org-map canvas; role deep-links open the global role drawer.',
    'frontend/src/pages/organization/Organization.tsx · viz/org-map/OrgMapCanvas.tsx',
  ),
  R(
    'Organization',
    'Integration',
    '/explorer/org-table + per-level role dashboards',
    'API orchestration',
    'The org table and /explorer/roles/:level dashboards load from the shared explorer router; map edit-mode commits node moves through POST /builder/nodes/batch.',
    'backend/src/routes/explorer/standards.ts · explorer/dashboards.ts',
  ),
  R(
    'Organization',
    'Business Service',
    'Org rollups from the closure resolvers',
    'Derivations / resolvers',
    'structureCounts, streamAncestry, processSubtree, rolesForNodes and appsForNodes derive division/department rollups from OrgUnitClosure at read time.',
    'backend/src/lib/resolvers',
    'BEHAVIOR',
  ),
  R(
    'Organization',
    'Data',
    'Org spine tables',
    'Schema & migrations',
    'OrgLevelType names each depth (L2 division · L3 department); OrgUnit self-nests with OrgUnitClosure; Role homes on an OrgUnit; NodeRole ties roles into the process spine.',
    'backend/prisma/schema.prisma (OrgUnit, OrgUnitClosure, Role)',
  ),
  R(
    'Organization',
    'Infrastructure',
    'value-streams key + 15s response cache',
    'Caching',
    'The /explorer router checks requirePermission(value-streams) BEFORE cacheResponses(15s) so cached bodies never leak across permissions; any mutation clears the cache.',
    'backend/src/routes/explorer/index.ts',
  ),

  // ── Value Streams ──
  R(
    'Value Streams',
    'UI',
    'Operating-model explorer (TOC · Map · List)',
    'Charts & Visualizations',
    'Domains drill to value streams: React Flow map with the variant lens bar, a flat Domain|Division|VS|L4|L5 sheet with combobox filters, and a docked Inspector; all state lives in the URL.',
    'frontend/src/pages/explorer/Explorer.tsx · viz/map/MapCanvas.tsx',
  ),
  R(
    'Value Streams',
    'Integration',
    '/explorer tree, overview and focus feeds',
    'API orchestration',
    'Bootstrap via /explorer/overview, drill data via /explorer/tree, id-to-focus resolution via /explorer/value-stream/:id/focus; MB-scale payloads ship gzip-compressed.',
    'backend/src/routes/explorer/treeFlow.ts · overview.ts',
  ),
  R(
    'Value Streams',
    'Business Service',
    'processSubtree drill derivation',
    'Derivations / resolvers',
    'The L1→L5 drill structure is computed from ProcessNodeClosure per request — no stored tree snapshots; rolesForNodes decorates owner and participant roles.',
    'backend/src/lib/resolvers (processSubtree, processSubtrees)',
    'BEHAVIOR',
  ),
  R(
    'Value Streams',
    'Data',
    'Process spine tables',
    'Schema & migrations',
    'ProcessLevelType names the depths (L1 domain … L5 task, isTask leaves); ProcessNode self-nests with the ProcessNodeClosure ancestor/descendant table; NodeRole wires owners.',
    'backend/prisma/schema.prisma (ProcessNode, ProcessNodeClosure)',
  ),
  R(
    'Value Streams',
    'Infrastructure',
    'Permission-before-cache + gzip',
    'Caching',
    'cacheResponses(15s) sits after requirePermission(value-streams); gzip compression carries the map payloads; the page is a lazy route chunk.',
    'backend/src/routes/explorer/index.ts',
  ),

  // ── Value stream drawer ──
  R(
    'Value stream drawer',
    'UI',
    'Docked Inspector from List/Map',
    'Modals / Dialogs / Drawers',
    'Clicking a sheet cell or map node docks the unified Inspector (560px) beside the canvas; ?node= mirrors the open node so drawers deep-link.',
    'frontend/src/components/ListExplorer.tsx · viz/map/MapCanvas.tsx',
  ),
  R(
    'Value stream drawer',
    'Integration',
    'GET /inspector/:nodeId single feed',
    'API orchestration',
    'One endpoint returns the node’s complete association set (roles, apps, deliverables, checklist, testing, governance); retargeting re-calls the same path.',
    'backend/src/routes/inspector/detail.ts',
  ),
  R(
    'Value stream drawer',
    'Data',
    'Association junctions per node',
    'Reference data',
    'NodeRole, NodeAppUsage, NodeDeliverable, NodeChecklist and TestingTemplate rows join to their entities — every association is a FK, never free text.',
    'backend/prisma/schema.prisma (Node* junctions)',
  ),
  R(
    'Value stream drawer',
    'Infrastructure',
    'Deliberately uncached inspector reads',
    'Caching',
    '/inspector skips the response cache so drawer edits render immediately; value-streams permission; JWT + pino as everywhere.',
    'backend/src/routes/inspector/index.ts',
  ),

  // ── Roles ──
  R(
    'Roles',
    'UI',
    'Roles TOC · list sheet · org chart',
    'Grids / Tables',
    'URL-driven TOC/List/Map: RolesListSheet (Department/Division/Role/Type/value streams/deliverables/tasks/standards columns), a React Flow org chart, and the permission-gated “+ New role” editor drawer.',
    'frontend/src/pages/roles/Roles.tsx · components/RolesListSheet.tsx',
  ),
  R(
    'Roles',
    'Integration',
    'Read + manage router pair on /roles',
    'API orchestration',
    'GET /roles and /roles/org-chart serve the lists; the roleManage router (mounted first) serves options, POST/PATCH/DELETE and the pre-delete /roles/:id/impact count.',
    'backend/src/routes/roles.ts · roleManage.ts',
  ),
  R(
    'Roles',
    'Business Service',
    'Role rollups via one raw closure query',
    'Derivations / resolvers',
    'Role participation counts fan across NodeRole with a single $queryRaw over the closure; ancestorNames resolves each role’s division/department from its OrgUnit — no per-row queries.',
    'backend/src/routes/roles.ts ($queryRaw) · lib/roleProfile',
    'BEHAVIOR',
  ),
  R(
    'Roles',
    'Data',
    'Role + junction tables',
    'Schema & migrations',
    'Role (homed on an OrgUnit) with NodeRole, RoleDeliverable, RoleStandard and RoleRegulation junctions; deletes are impact-counted across all of them first.',
    'backend/prisma/schema.prisma (Role, NodeRole, Role*)',
  ),
  R(
    'Roles',
    'Infrastructure',
    'roles permission + audited writes',
    'Logging & observability',
    'requirePermission(roles) derives create/update/delete from the HTTP method; every mutation writes an AuditEntry diff via services/audit.',
    'backend/src/routes/roleManage.ts · services/audit.ts',
  ),

  // ── Role drawer ──
  R(
    'Role drawer',
    'UI',
    'Global ?role= quick-peek drawer',
    'Modals / Dialogs / Drawers',
    'RoleDrawerHost mounts once in Layout and lazily renders a 720px DrawerShell whenever ?role=<id> appears: description, headline stats, value-stream participation, amend and delete.',
    'frontend/src/components/RoleDrawer.tsx · RoleDrawerHost.tsx',
  ),
  R(
    'Role drawer',
    'Integration',
    'Load / impact / delete call set',
    'API orchestration',
    'GET /roles/:id loads the peek; GET /roles/:id/impact counts affected junctions before DELETE /roles/:id; amendments PATCH through the same manage router.',
    'backend/src/routes/roles.ts · roleManage.ts',
  ),
  R(
    'Role drawer',
    'Data',
    'Impact-count read set',
    'Reference data',
    'Impact tallies NodeRole, RoleDeliverable, ChecklistItem, owned Standards, manager reports, RoleStandard and RoleRegulation so the confirm dialog shows the real blast radius.',
    'backend/src/routes/roleManage.ts (impact)',
  ),
  R(
    'Role drawer',
    'Infrastructure',
    'Lazy drawer chunk + audit on delete',
    'Logging & observability',
    'The drawer stays out of the main bundle (React.lazy); delete/patch write AuditEntry diffs; permission key roles.',
    'frontend/src/components/RoleDrawerHost.tsx',
  ),

  // ── Inspector drawer ──
  R(
    'Inspector drawer',
    'UI',
    'Unified node inspector (9 tabs)',
    'Modals / Dialogs / Drawers',
    'Overview/Work/Tasks/Roles/Applications/Deliverables/Checklist/Testing/Governance over one ProcessNode; containers roll up, L5 leaves edit inline with optimistic writes and an Undo toast.',
    'frontend/src/components/Inspector.tsx · components/inspector/*',
  ),
  R(
    'Inspector drawer',
    'Integration',
    'One read + 11 mutation endpoints',
    'API orchestration',
    'GET /inspector/:nodeId plus role/application/deliverable search and POST/PATCH/DELETE for roles, applications, checklist, deliverables and PUT testing — the node’s whole association CRUD surface.',
    'backend/src/routes/inspector/{detail,mutations}.ts',
  ),
  R(
    'Inspector drawer',
    'Business Service',
    'Governance inherited from L2/L3 ancestors',
    'Rules engines',
    'Standards and regulations applicable to an L5 task are inherited from its ancestors through the closure — nothing attaches directly to tasks; streamAncestry names the context.',
    'backend/src/routes/inspector/detail.ts · lib/resolvers',
    'BEHAVIOR',
  ),
  R(
    'Inspector drawer',
    'Data',
    'Full junction CRUD set',
    'Schema & migrations',
    'NodeRole, NodeAppUsage, NodeDeliverable, NodeChecklist/ChecklistItem and TestingTemplate rows are created, updated and deleted here; erd_v5 keeps every association a FK.',
    'backend/prisma/schema.prisma',
  ),
  R(
    'Inspector drawer',
    'Infrastructure',
    'Mutation-driven cache invalidation',
    'Caching',
    'Any non-GET clears the global response cache, so 15s-cached /explorer reads refresh right after inspector edits; the endpoint itself is uncached.',
    'backend/src/app.ts (clearResponseCache)',
  ),

  // ── Deliverables ──
  R(
    'Deliverables',
    'UI',
    'Deliverables TOC + sheet with drill sidebar',
    'Grids / Tables',
    'Work page in deliverables mode: TOC or flat Sheet (Deliverable/Description/VS L2/L3/L4/Owner/Contributors/Tasks); a row click slides a detail sidebar with roles, plan rollup and downstream impact.',
    'frontend/src/pages/work/Work.tsx (tab=deliverables)',
  ),
  R(
    'Deliverables',
    'Integration',
    'GET /work?take=30000 shared feed',
    'API orchestration',
    'One company-scoped call returns deliverables AND tasks (30k cap); the drill sidebar fetches /work/deliverable/:id for the full association set.',
    'backend/src/routes/work.ts',
  ),
  R(
    'Deliverables',
    'Business Service',
    'Batch ancestry + plan rollups',
    'Derivations / resolvers',
    'ancestorNames and rolesForNodes resolve the VS/L3/L4 and owner columns in one batch; taskPlans rolls checklist/testing plan status per deliverable — never per-row fan-out.',
    'backend/src/lib/resolvers · lib/workPlan.ts',
    'BEHAVIOR',
  ),
  R(
    'Deliverables',
    'Data',
    'Deliverable + node junction reads',
    'Reference data',
    'Deliverable, NodeDeliverable, RoleDeliverable and ProcessNode rows feed the sheet; standards and regulations arrive through NodeStandard/NodeRegulation.',
    'backend/src/routes/work.ts (prisma reads)',
  ),
  R(
    'Deliverables',
    'Infrastructure',
    'Either-of permission + tenant-keyed cache',
    'Permissions',
    'requireAnyPermission([tasks, deliverables]) — either key grants; cacheResponses(15s) is tenant-keyed and sits after auth.',
    'backend/src/routes/work.ts (router middleware)',
  ),

  // ── Tasks ──
  R(
    'Tasks',
    'UI',
    'Tasks sheet with AI-automatable meter',
    'Grids / Tables',
    'Work page in tasks mode: Task (L5)/L4/Deliverable/Owner/Contributors/Standards/Regulations/Testing-pattern columns plus the AutomatableMeter; the sidebar links each plan into the Work Library.',
    'frontend/src/pages/work/Work.tsx (tab=tasks)',
  ),
  R(
    'Tasks',
    'Integration',
    'Shared /work feed + /work/task/:id drill',
    'API orchestration',
    'The same 30k-cap /work payload serves this tab; the task drill returns checklist/testing plan groups, the deliverable it feeds and its outputs.',
    'backend/src/routes/work.ts',
  ),
  R(
    'Tasks',
    'Business Service',
    'Inherited governance + automatability score',
    'Rules engines',
    'Standards/regs per task inherit from L2/L3 ancestors via the closure; SCORE_OF maps ProcessNode.automatability into the 1–5 meter.',
    'backend/src/routes/work.ts (SCORE_OF, inheritance)',
    'BEHAVIOR',
  ),
  R(
    'Tasks',
    'Data',
    'L5 task rows + template answers',
    'Reference data',
    'ProcessNode(isTask) rows with NodeWorkTemplate (the TEST kind drives the testing pattern), NodeStandard/NodeRegulation and Deliverable links.',
    'backend/prisma/schema.prisma (ProcessNode isTask)',
  ),
  R(
    'Tasks',
    'Infrastructure',
    'Row cap + 15s tenant-keyed cache',
    'Caching',
    'take=30000 bounds the payload; cacheResponses(15s) is tenant-keyed; permission is tasks|deliverables either-of.',
    'backend/src/routes/work.ts',
  ),

  // ── Standards ──
  R(
    'Standards',
    'UI',
    'Standards TOC areas + flat list with drawer',
    'Grids / Tables',
    'TOC view (one card per department area) or flat Sheet (Department/Category/Group/Standard/Description/Responsible); list rows open the Standard drawer in place.',
    'frontend/src/pages/standards/Standards.tsx',
  ),
  R(
    'Standards',
    'Integration',
    '/explorer/standards + standards-flat feeds',
    'API orchestration',
    'Area totals come from /explorer/standards; the flat leaf list from /explorer/standards-flat — both on the cached explorer router.',
    'backend/src/routes/explorer/standards.ts',
  ),
  R(
    'Standards',
    'Business Service',
    'vsForStandards + per-standard skill naming',
    'Derivations / resolvers',
    'govRollup.vsForStandards derives which value streams each standard applies to via NodeStandard; skillPacks.skillName labels the standard’s agent skill.',
    'backend/src/lib/govRollup.ts · lib/skillPacks.ts',
    'BEHAVIOR',
  ),
  R(
    'Standards',
    'Data',
    'Standard hierarchy: areas → groups → leaves',
    'Schema & migrations',
    'Standard rows self-nest via parentId (isArea areas, groups, 1,300+ atomic leaves) with ownerRole, RoleStandard appliers and NodeStandard VS links.',
    'backend/prisma/schema.prisma (Standard)',
  ),
  R(
    'Standards',
    'Infrastructure',
    'Known explorer-router key wrinkle',
    'Permissions',
    'The tab guards with the standards key but the backend /explorer router checks value-streams — a v1 wrinkle worth normalizing; the 15s cache applies.',
    'backend/src/routes/explorer/index.ts vs frontend App.tsx',
  ),

  // ── Standard drawer ──
  R(
    'Standard drawer',
    'UI',
    'Standard detail drawer with sibling hop',
    'Modals / Dialogs / Drawers',
    'DrawerShell (560px): description, group context with sibling navigation, agent-skill viewer, SDLC gate chips, responsible role, appliers, plan keys and applies-to value-stream chips.',
    'frontend/src/components/StandardDrawer.tsx',
  ),
  R(
    'Standard drawer',
    'Integration',
    'Area-load GET /explorer/standards/:areaId',
    'API orchestration',
    'The drawer loads the whole area once and selects the clicked item client-side — sibling hops are instant with no extra round-trips.',
    'backend/src/routes/explorer/standards.ts (GET /standards/:id)',
  ),
  R(
    'Standard drawer',
    'Data',
    'Plan keys + role links per standard',
    'Reference data',
    'StandardWorkTemplate and StandardTemplateAnswer rows split generic vs specific plan keys; ownerRole and roleStandards joins name responsibility.',
    'backend/prisma/schema.prisma (Standard*Template*)',
  ),
  R(
    'Standard drawer',
    'Infrastructure',
    'Rides the cached explorer router',
    'Caching',
    'Same 15s response cache and value-streams permission as its host page; the drawer bundles with the Standards chunk.',
    'backend/src/routes/explorer/index.ts',
  ),

  // ── Regulations ──
  R(
    'Regulations',
    'UI',
    'Three-lens catalog with infinite scroll',
    'Grids / Tables',
    'International/Federal/State lens tabs (sessionStorage-persisted), four headline tiles, and a server-driven requirements grid with per-column combobox filters and Plan links.',
    'frontend/src/pages/regulations/Regulations.tsx · RequirementsTable.tsx',
  ),
  R(
    'Regulations',
    'Integration',
    'Paged /regulations API family',
    'API orchestration',
    'lens-stats, requirement-filters, requirements (pageSize 100, infinite scroll), overview and jurisdictions — all company-scoped; a 24k-row catalog makes paging server-side.',
    'backend/src/routes/regulations/lenses.ts',
  ),
  R(
    'Regulations',
    'Business Service',
    'Coverage rollup over closure SQL',
    'Derivations / resolvers',
    'vsForRegulations plus raw SQL across NodeRegulation/ProcessNodeClosure derives per-value-stream coverage; lensRegulatorTypes classifies regulators per lens.',
    'backend/src/lib/govRollup.ts · routes/regulations/helpers.ts',
    'BEHAVIOR',
  ),
  R(
    'Regulations',
    'Data',
    '24k-row RegulatoryRequirement catalog',
    'Reference data',
    'RegulatoryRequirement with Jurisdiction, RegulatorySource, RegulatoryBulletin, ComplianceRule, RoleRegulation and RequirementLineOfBusiness relations.',
    'backend/prisma/schema.prisma (Regulatory*)',
  ),
  R(
    'Regulations',
    'Infrastructure',
    'Uncached read-write router, 404 on cross-tenant',
    'Permissions',
    'requirePermission(regulations) with method-derived CRUD; deliberately no response cache because writes share the router; cross-company misses return 404 not 403.',
    'backend/src/routes/regulations/index.ts',
  ),

  // ── Work Library ──
  R(
    'Work Library',
    'UI',
    'Plan editor: subject picker + answer matrix',
    'Input Fields',
    'URL-param-driven plans/templates views: SubjectPicker, checklist (multi) and testing (single) pattern dropdowns, the PlanBlock key/value matrix and tied standards/regs; TemplatesEditor for admins.',
    'frontend/src/pages/work-library/WorkLibrary.tsx',
  ),
  R(
    'Work Library',
    'Integration',
    'CRUD /work-library plan endpoints',
    'API orchestration',
    'GET templates and plan/:type/:id; PUT template assignments and answers; DELETE answers; POST/DELETE tied standards/regulations and task evidence.',
    'backend/src/routes/work-library/{templates,plan,options}.ts',
  ),
  R(
    'Work Library',
    'Business Service',
    'Per-subject plan resolution',
    'Workflow orchestration',
    'findSubject dispatches task/standard/regulation subjects; answers persist per (subject, templateKey) independent of assignment junctions, so re-linking a pattern never loses values.',
    'backend/src/routes/work-library/helpers.ts',
    'BEHAVIOR',
  ),
  R(
    'Work Library',
    'Data',
    'Ten-table work-plan domain',
    'Schema & migrations',
    'WorkTemplate/WorkTemplateKey catalogs; Node/Standard/Regulation WorkTemplate junctions with *TemplateAnswer values; evidence tables tie proof to plans.',
    'backend/prisma/schema.prisma (WorkTemplate*)',
  ),
  R(
    'Work Library',
    'Infrastructure',
    'work-library permission, uncached writes',
    'Permissions',
    'requirePermission(work-library) with method-derived CRUD; no response cache; the frontend additionally gates template editing via can(update).',
    'backend/src/routes/work-library/index.ts',
  ),

  // ── Testing template modal ──
  R(
    'Testing template modal',
    'UI',
    'Per-node testing plan slide-over + CSV export',
    'Modals / Dialogs / Drawers',
    'A 600px aside opened from map/metrics surfaces: meta columns, the parsed generic pattern (numbered checklist) and specific “Pass =” tests, with client-side CSV download.',
    'frontend/src/components/TestingTemplateModal.tsx',
  ),
  R(
    'Testing template modal',
    'Integration',
    'GET /explorer/testing-templates/:nodeId',
    'API orchestration',
    'One call returns the node subtree’s testing rows (cap 500) with deliverable and task titles joined server-side.',
    'backend/src/routes/explorer/testingTemplates.ts',
  ),
  R(
    'Testing template modal',
    'Business Service',
    'parseTestingPlan generic/specific split',
    'Data transformation',
    'A server-side regex splits each template into the generic pattern vs the specific “In <system>, verify / Pass =” directives so the UI renders both cleanly.',
    'backend/src/routes/explorer/testingTemplates.ts (parseTestingPlan)',
    'BEHAVIOR',
  ),
  R(
    'Testing template modal',
    'Data',
    'TestingTemplate rows per subtree',
    'Reference data',
    'TestingTemplate joined to Deliverable and task ProcessNode via processSubtree — the closure picks up every descendant’s rows.',
    'backend/prisma/schema.prisma (TestingTemplate)',
  ),
  R(
    'Testing template modal',
    'Infrastructure',
    '500-row cap on the cached explorer route',
    'Caching',
    'The row cap bounds the payload; 15s cache and the value-streams permission come from the shared explorer router.',
    'backend/src/routes/explorer/index.ts',
  ),

  // ── Applications ──
  R(
    'Applications',
    'UI',
    'App portfolio TOC + list with drawer',
    'Grids / Tables',
    'TOC (one row per app kind with count and TCO) or List (name, kind, category, vendor, division, TCO/yr); a row opens AppDrawer (what it does, value streams, roles that use it); ?focus= scrolls to a row.',
    'frontend/src/pages/applications/Applications.tsx · AppDrawer.tsx',
  ),
  R(
    'Applications',
    'Integration',
    'Single GET /applications feed',
    'API orchestration',
    'One call carries the whole portfolio including drawer content — AppDrawer opens with zero extra fetches.',
    'backend/src/routes/applications.ts',
  ),
  R(
    'Applications',
    'Business Service',
    'Usage ancestry via shared resolvers',
    'Derivations / resolvers',
    'ancestorNames and rolesForNodes resolve each app’s value-stream placement and using roles from NodeAppUsage in one batch.',
    'backend/src/routes/applications.ts (resolvers)',
    'BEHAVIOR',
  ),
  R(
    'Applications',
    'Data',
    'Application + NodeAppUsage reads',
    'Reference data',
    'Application rows (with orgUnit and usage counts) plus NodeAppUsage junctions to the process spine; TCO fields aggregate per kind for the TOC.',
    'backend/prisma/schema.prisma (Application, NodeAppUsage)',
  ),
  R(
    'Applications',
    'Infrastructure',
    'applications permission + 15s cache',
    'Permissions',
    'requireAuth → requirePermission(applications) → cacheResponses(15s); lazy route chunk behind RouteGuard.',
    'backend/src/routes/applications.ts (middleware)',
  ),

  // ── Third-Parties ──
  R(
    'Third-Parties',
    'UI',
    'External interactions sheet + drawer',
    'Grids / Tables',
    'Sheet of external parties (party, type, value stream, internal owner, interaction, dependency); the drawer synthesizes “what they do”, division/function, frequency and links to the owner role.',
    'frontend/src/pages/external/External.tsx',
  ),
  R(
    'Third-Parties',
    'Integration',
    'GET /external-interactions feed',
    'API orchestration',
    'One list call powers sheet and drawer; the drawer needs no extra fetch.',
    'backend/src/routes/externalInteractions.ts',
  ),
  R(
    'Third-Parties',
    'Business Service',
    'Primary value stream via streamAncestry',
    'Derivations / resolvers',
    'streamAncestry resolves each interaction’s value-stream context from its ProcessNode; NodeRole derives the internal owner.',
    'backend/src/routes/externalInteractions.ts (streamAncestry)',
    'BEHAVIOR',
  ),
  R(
    'Third-Parties',
    'Data',
    'ExternalParty + ExternalInteraction rows',
    'Reference data',
    'ExternalInteraction joins ExternalParty (name, partyType), Role and ProcessNode; tenancy walks externalParty → company → tenant.',
    'backend/prisma/schema.prisma (ExternalParty, ExternalInteraction)',
  ),
  R(
    'Third-Parties',
    'Infrastructure',
    'third-parties permission, uncached',
    'Permissions',
    'requirePermission(third-parties) with no response cache on this router; JWT + pino standard.',
    'backend/src/routes/externalInteractions.ts (middleware)',
  ),

  // ── Workspace ──
  R(
    'Workspace',
    'UI',
    'Three-column rationalization map',
    'Charts & Visualizations',
    'Brown-field decomposition → Normalize T-charts → green-field cutaway, with lens switch, board picker, per-screen drill with live preview, smooth-step connectors and zoom.',
    'frontend/src/pages/workspace-map/WorkspaceMap.tsx · pages/portfolio/Portfolio.tsx',
  ),
  R(
    'Workspace',
    'Integration',
    '/rationalization board API',
    'API orchestration',
    'GET /rationalization lists boards per lens (applicationIds/valueStreamIds/roleIds params); GET /rationalization/:id returns the full board; layout overlays commit via POST /:id/layout.',
    'backend/src/routes/rationalization/boards.ts',
  ),
  R(
    'Workspace',
    'Business Service',
    'Board rollup math (columnStats, progressOf)',
    'Derivations / resolvers',
    'columnStatsOf, normalizeStatsOf and progressOf compute per-column stay/move counts, normalize stats and lifecycle progress from the findings at read time.',
    'backend/src/lib/rationalization.ts',
    'BEHAVIOR',
  ),
  R(
    'Workspace',
    'Data',
    'Rationalization domain tables',
    'Schema & migrations',
    'RationalizationWorkspace/App/Capability/Component/Microservice, ScreenAsset, NormalizationEntry and WorkspaceVocabulary — the board you are reading is these rows.',
    'backend/prisma/schema.prisma (Rationalization*)',
  ),
  R(
    'Workspace',
    'Infrastructure',
    'applications permission on the workspace tab',
    'Permissions',
    'The rationalization router reuses requirePermission(applications) (uncached, writes share it); the tab itself guards with the workspace menu key — a mapping worth knowing.',
    'backend/src/routes/rationalization/index.ts',
  ),

  // ── Workspace › Edit box modal (retired) ──
  {
    screen: 'Workspace › Edit box modal',
    layer: 'UI',
    name: 'Edit-box modal — retired with the old board',
    category: 'Modals / Dialogs / Drawers',
    summary:
      'The 355-line box editor (double-click a board box to edit scope, segment, target component, dead-code flag) was deleted with the whole greenfield-migration tree in 30d55bc; the rebuilt map is read-only and edits flow through Data Admin CRUD.',
    codeRef: 'was frontend/src/pages/greenfield-migration/EditBoxModal.tsx (removed 2026-07-12)',
    view: 'COMPONENT',
    dead: true,
  },

  // ── Automatable ──
  R(
    'Automatable',
    'UI',
    'AI-transformation snapshot page',
    'Charts & Visualizations',
    'Headline % automatable, a five-tier distribution bar and %-automatable rollups by Division, Department, Value stream and Role; read-only.',
    'frontend/src/pages/automatable/Automatable.tsx',
  ),
  R(
    'Automatable',
    'Integration',
    'Reuses the /work feed',
    'API orchestration',
    'The page derives everything client-side from the same company-scoped /work payload the Tasks tab uses — no bespoke endpoint.',
    'backend/src/routes/work.ts',
  ),
  R(
    'Automatable',
    'Business Service',
    'Tier math from agent scores',
    'Data transformation',
    '“Automatable” = agent score ≤ 2; automatablePct aggregates the 1–5 ProcessNode.automatability scores into headline and per-dimension percentages.',
    'frontend/src/lib/automatable.ts · backend SCORE_OF',
    'BEHAVIOR',
  ),
  R(
    'Automatable',
    'Data',
    'ProcessNode.automatability scores',
    'Reference data',
    'The 1–5 automatability score persisted per L5 task node (scored via live Claude in the agent-automatability workflow) is the single input.',
    'backend/prisma/schema.prisma (ProcessNode.automatability)',
  ),
  R(
    'Automatable',
    'Infrastructure',
    'Shared work cache + either-of permission',
    'Caching',
    'Rides /work’s 15s tenant-keyed cache and tasks|deliverables either-of permission; lazy route chunk.',
    'backend/src/routes/work.ts (middleware)',
  ),

  // ── Metrics ──
  R(
    'Metrics',
    'UI',
    'Two-stage adoption telemetry page',
    'Charts & Visualizations',
    'Stage 1 current-state analysis (baseline inventory + coverage table), Stage 2 adoption telemetry (% automated/discarded/augmented/manual with a dimension switcher) and a value-stream × AI-mode heat map.',
    'frontend/src/pages/active-ai/ActiveAI.tsx (route /metrics)',
  ),
  R(
    'Metrics',
    'Integration',
    'Adoption + analysis summary feeds',
    'API orchestration',
    'Promise.all over /explorer/value-stream-adoption (cached explorer route) and /ai-analysis/summary (uncached, metrics-gated); rows drill to /metrics/:id.',
    'backend/src/routes/explorer/telemetry.ts · aiAnalysis.ts',
  ),
  R(
    'Metrics',
    'Business Service',
    'Adoption rollups per value stream',
    'Derivations / resolvers',
    'Value-stream × mode percentages roll up from NodeAiAdoption levels and ProcessNode automatability via the closure; ancestorNames names the dimensions.',
    'backend/src/routes/aiAnalysis.ts (resolvers)',
    'BEHAVIOR',
  ),
  R(
    'Metrics',
    'Data',
    'AnalysisStatus + NodeAiAdoption rows',
    'Reference data',
    'AnalysisStatus tracks coverage per subject (value stream/division/role); NodeAiAdoption stores adoption mode per node; Company scopes everything.',
    'backend/prisma/schema.prisma (AnalysisStatus, NodeAiAdoption)',
  ),
  R(
    'Metrics',
    'Infrastructure',
    'Split permission surface',
    'Permissions',
    'Two keys serve one page: value-streams for the explorer adoption feed (15s cache) and metrics for the analysis summary (uncached); legacy /active-ai redirects.',
    'backend/src/routes/explorer/index.ts · aiAnalysis.ts',
  ),

  // ── Product Models ──
  R(
    'Product Models',
    'UI',
    'Product-model catalog TOC + list with drawer',
    'Grids / Tables',
    'TOC per segment or List (name, source system, segment, geography, disposition pill, workspaces, findings); the drawer shows coverage, components, canonical mapping and links into the Workspace board.',
    'frontend/src/pages/product-models/ProductModels.tsx · ProductModelDrawer.tsx',
  ),
  R(
    'Product Models',
    'Integration',
    'GET /product-models feed',
    'API orchestration',
    'One call returns the catalog with workspace links and finding counts; the drawer opens with no extra fetch; deep links carry ?workspace= into /portfolio.',
    'backend/src/routes/product-models/models.ts',
  ),
  R(
    'Product Models',
    'Data',
    'Product-model domain tables',
    'Schema & migrations',
    'LegacyProductModel and CanonicalProductModel under ProductModelWorkspace, with ProductModelComponent/Finding/NormalizationEntry mirroring the application anatomy shape.',
    'backend/prisma/schema.prisma (ProductModel*)',
  ),
  R(
    'Product Models',
    'Infrastructure',
    'workspace permission, audited writes',
    'Permissions',
    'The /product-models router checks requirePermission(workspace) (menu key product-models differs — same wrinkle as Standards); mutations audit via logAudit.',
    'backend/src/routes/product-models/index.ts',
  ),

  // ── Login ──
  R(
    'Login',
    'UI',
    'Credential form + permission-aware landing',
    'Input Fields',
    'Centered card with email/password (ui Input/Label/Button); on success routes to the user’s start page or the first readable tab via defaultRoute(permissions).',
    'frontend/src/pages/login/Login.tsx · lib/auth.tsx',
  ),
  R(
    'Login',
    'Integration',
    'POST /auth/login + GET /auth/me pair',
    'API orchestration',
    'Login mints the JWT; /auth/me returns the profile and effective permission snapshot on login, mount and refresh.',
    'backend/src/routes/auth.ts',
  ),
  R(
    'Login',
    'Business Service',
    'Effective-permission resolution',
    'Access decisions',
    'getEffectivePermissions merges the user type’s PermissionSet grants with per-user overrides across the MENU_TREE — the single access-decision path both sides trust.',
    'backend/src/services/permissions (getEffectivePermissions)',
    'BEHAVIOR',
  ),
  R(
    'Login',
    'Data',
    'User + preference reads',
    'Reference data',
    'User (bcrypt hash compare), UserValueStream, OrgUnitClosure for scope display and the startPage UserPreference row.',
    'backend/src/routes/auth.ts (prisma reads)',
  ),
  R(
    'Login',
    'Infrastructure',
    '7-day JWT + deactivation kill-switch',
    'Secrets & config',
    'jsonwebtoken signs {sub, tenantId, email, role} for 7d; requireAuth re-loads the user per request and 401s DEACTIVATED users even on a valid token; token lives in localStorage; unknown vs deactivated fail identically.',
    'backend/src/middleware/auth.ts',
    'BEHAVIOR',
  ),

  // ── Settings ──
  R(
    'Settings',
    'UI',
    'Personal preference cards, auto-saved',
    'Input Fields',
    'Start page, notifications and dashboard cards write through the preference store with ~800ms debounce; the start-page picker only offers pages the user can read.',
    'frontend/src/pages/settings/Settings.tsx · lib/preferences.tsx',
  ),
  R(
    'Settings',
    'Integration',
    '/me/preferences GET + debounced PATCH',
    'API orchestration',
    'PATCH flushes with invalidate:none so the high-frequency auto-save never wipes the warm GET cache; flush also fires on visibilitychange/beforeunload.',
    'backend/src/routes/me/preferences.ts',
  ),
  R(
    'Settings',
    'Business Service',
    'Preference key validation',
    'Request validation',
    'Reserved keys validate against shared zod schemas and dynamic keys against allowed patterns; startPage re-validates against effective permissions server-side.',
    'backend/src/routes/me/preferences.ts (schemas)',
    'BEHAVIOR',
  ),
  R(
    'Settings',
    'Data',
    'Row-per-key UserPreference store',
    'Reference data',
    'UserPreference rows (userId+key unique) upsert in a transaction; 32KB per value, 50 keys per request caps.',
    'backend/prisma/schema.prisma (UserPreference)',
  ),
  R(
    'Settings',
    'Infrastructure',
    'Auth-only router, deliberately unaudited',
    'Permissions',
    '/me needs only requireAuth (operates strictly on req.user.id — no menu key); high-frequency user-owned writes skip the audit trail by design.',
    'backend/src/routes/me/index.ts',
  ),

  // ── Send feedback panel ──
  R(
    'Send feedback panel',
    'UI',
    'Non-blocking panel with silent screenshot',
    'Modals / Dialogs / Drawers',
    'A portaled aside (deliberately not DrawerShell — the page stays interactive): category, optional name, 10k-char text; on submit it captures a screenshot of the page (excluding itself) via modern-screenshot.',
    'frontend/src/components/FeedbackWidget.tsx',
  ),
  R(
    'Send feedback panel',
    'Integration',
    'Multipart POST /feedback + config gate',
    'API orchestration',
    'GET /feedback/config toggles the widget from feedback.config.json; the submission uploads text + route + commitSha + screenshot blob as multipart.',
    'backend/src/routes/feedback.ts',
  ),
  R(
    'Send feedback panel',
    'Business Service',
    'Async LLM → Jira → email pipeline',
    'Workflow orchestration',
    'runFeedbackPipeline turns the submission into a classified ticket, routes it to the right Jira epic by captured page and emails the requester — wrapped in waitUntil so the request returns instantly.',
    'backend/src/lib/feedback/pipeline.ts',
    'BEHAVIOR',
  ),
  R(
    'Send feedback panel',
    'Data',
    'Feedback rows with screenshot bytes',
    'Reference data',
    'Feedback rows store the screenshot (bytea + mime) and drive the DB-backed rate limit; admin list/retry reads the same table.',
    'backend/prisma/schema.prisma (Feedback)',
  ),
  R(
    'Send feedback panel',
    'Infrastructure',
    '5/min rate limit + identity from JWT',
    'Policies',
    'Rate limit is 5 submissions/min/user enforced in the DB; tenantId/userId always come from the JWT, never the body; multer caps images at 5MB.',
    'backend/src/routes/feedback.ts (limits)',
    'BEHAVIOR',
  ),

  // ── Confirm / prompt dialogs ──
  R(
    'Confirm / prompt dialogs',
    'UI',
    'Promise-based dialog system',
    'Modals / Dialogs / Drawers',
    'useDialogs() replaces window.confirm/prompt/alert with in-app modals: danger styling, typedConfirm (type the exact label for cascading deletes), Escape/backdrop cancel, Enter submit, aria-modal.',
    'frontend/src/lib/dialogs.tsx',
  ),
  R(
    'Confirm / prompt dialogs',
    'Integration',
    'Zero network surface',
    'State management',
    'Pure client primitive — no API calls; consumers await the promise and then fire their own mutations (revoke key, deactivate user, delete role).',
    'frontend/src/lib/dialogs.tsx (no api usage)',
  ),
  R(
    'Confirm / prompt dialogs',
    'Data',
    'In-memory pending slot only',
    'State management',
    'A single pending-dialog slot in React state; nothing persists — by design the dialog layer owns no data.',
    'frontend/src/lib/dialogs.tsx (DialogProvider state)',
  ),
  R(
    'Confirm / prompt dialogs',
    'Infrastructure',
    'Repo-wide no-native-dialog rule',
    'Component reuse',
    'window.confirm/alert/prompt are banned across the codebase; every destructive flow must pass through this provider, which keeps confirmation UX consistent and testable.',
    'CLAUDE.md · frontend standards (useDialogs rule)',
  ),

  // ── Data Admin ──
  R(
    'Data Admin',
    'UI',
    'Per-tab Studio with generic entity editors',
    'Grids / Tables',
    'Left nav mirrors the product tabs (ADMIN_TABS); each tab renders a tailored editor over the generic CRUD; view switch adds Trackable Metrics, Audit Log and Data Dictionary; AI overlay assists edits.',
    'frontend/src/pages/admin/Admin.tsx · components/admin/AdminSection.tsx',
  ),
  R(
    'Data Admin',
    'Integration',
    'Registry-driven generic CRUD API',
    'API orchestration',
    'GET /admin/_meta publishes the entity registry; /admin/:entity[/:id] serves paginated, searchable, field-filterable CRUD for every registered model, plus dashboard/validations/ai-adoption specials.',
    'backend/src/routes/admin/{meta,crud}.ts',
  ),
  R(
    'Data Admin',
    'Business Service',
    'Entity registry + validation service',
    'Rules engines',
    'lib/adminRegistry maps entity names to Prisma delegates with tenant scoping; services/validations.runValidations executes data-quality checks on demand.',
    'backend/src/lib/adminRegistry · services/validations',
    'BEHAVIOR',
  ),
  R(
    'Data Admin',
    'Data',
    'Whole registered model set',
    'Schema & migrations',
    'The generic delegate reaches every registered admin entity; Company.dashboardConfig (jsonb) and NodeAiAdoption are touched by the specials.',
    'backend/src/routes/admin/helpers.ts (delegate, tenantWhere)',
  ),
  R(
    'Data Admin',
    'Infrastructure',
    'data-admin.configure key + full audit',
    'Logging & observability',
    'requirePermission(data-admin.configure); every write logs an AuditEntry with a computed field-level diff; the admin router is deliberately uncached.',
    'backend/src/routes/admin/index.ts · services/audit.ts',
  ),

  // ── Data Admin › Audit Log ──
  R(
    'Data Admin › Audit Log',
    'UI',
    'Read-only audit table with diff view',
    'Grids / Tables',
    'When | Action pill (CREATE green / UPDATE amber / DELETE red) | Entity | Actor | field-level {from,to} DiffView; the entity-type filter populates from the admin registry.',
    'frontend/src/pages/audit-trail/AuditTrail.tsx',
  ),
  R(
    'Data Admin › Audit Log',
    'Integration',
    'GET /audit with entityType filter',
    'API orchestration',
    'One tenant-scoped query (limit ≤ 500, default 100, newest first); filter options come from /admin/_meta.',
    'backend/src/routes/audit.ts',
  ),
  R(
    'Data Admin › Audit Log',
    'Data',
    'AuditEntry ledger',
    'Reference data',
    'AuditEntry rows (tenantId, actorEmail, entityType/entityId, action, JSON diff) are written by services/audit across the whole app and only read here.',
    'backend/prisma/schema.prisma (AuditEntry)',
  ),
  R(
    'Data Admin › Audit Log',
    'Infrastructure',
    'Separate data-admin.audit-log key',
    'Permissions',
    'Audit reads carry their own permission key, distinct from configure — you can grant read-the-ledger without grant-the-pen.',
    'backend/src/routes/audit.ts (middleware)',
  ),

  // ── Data Admin › Data Dictionary ──
  R(
    'Data Admin › Data Dictionary',
    'UI',
    'Static glossary with jump-list + search',
    'Labels & Text Elements',
    'Grouped term/definition cards with a jump-list sidebar and case-insensitive search over term/aka/definition/values; embeddable in the Admin tab or standalone.',
    'frontend/src/pages/data-dictionary/DataDictionary.tsx',
  ),
  R(
    'Data Admin › Data Dictionary',
    'Integration',
    'No API — glossary ships in the bundle',
    'Reference data',
    'Content is a typed constant (GLOSSARY in lib/glossary.ts); zero network calls — an earlier finding flagged this for a future move to the Data layer.',
    'frontend/src/lib/glossary.ts',
  ),
  R(
    'Data Admin › Data Dictionary',
    'Data',
    'Frontend-resident dictionary content',
    'Reference data',
    'The glossary’s terms live in the JS bundle rather than a table — acceptable for static docs, revisit if the dictionary must become editable per company.',
    'frontend/src/lib/glossary.ts (GLOSSARY)',
  ),
  R(
    'Data Admin › Data Dictionary',
    'Infrastructure',
    'Embedded rendering, no permission surface',
    'Component reuse',
    'The embedded prop suppresses the page header when hosted inside Admin; being static, the screen adds no backend permission surface of its own.',
    'frontend/src/pages/data-dictionary/DataDictionary.tsx (embedded)',
  ),

  // ── User Admin › Users ──
  R(
    'User Admin › Users',
    'UI',
    'Users sheet + detail drawer',
    'Grids / Tables',
    'Sheet (name, email, user type, org unit, geography, value-stream chips, manager, approver, status pill); row click edits in a DrawerShell; Add user creates through the same drawer.',
    'frontend/src/components/user-admin/UsersAdmin.tsx · UserDetail.tsx',
  ),
  R(
    'User Admin › Users',
    'Integration',
    '/users CRUD + pickers + overrides',
    'API orchestration',
    'GET /users (+managersOnly), /users/pickers, /users/:id/permissions; POST/PATCH/DELETE users; PUT per-user permission overrides — all on the users router.',
    'backend/src/routes/users/{manage,pickers,permissions}.ts',
  ),
  R(
    'User Admin › Users',
    'Business Service',
    'ABAC scope + provisioning service + four-eyes',
    'Access decisions',
    'requireUserAdmin() scopes domain admins to their OrgUnit subtree (out-of-scope reads 404); writes funnel through userProvisioning; privileged-role mints are HELD (202) by the approvals engine for a second approver.',
    'backend/src/services/userProvisioning · lib/approvals/engine (maybeHold)',
    'BEHAVIOR',
  ),
  R(
    'User Admin › Users',
    'Data',
    'User + override + scope tables',
    'Reference data',
    'User (password omitted from reads), UserValueStream, UserPermissionOverride, OrgUnit/OrgUnitClosure for scope and Role/ProcessNode for pickers.',
    'backend/prisma/schema.prisma (User, UserPermissionOverride)',
  ),
  R(
    'User Admin › Users',
    'Infrastructure',
    'user-admin.users key + audited overrides',
    'Logging & observability',
    'Override writes audit as PERMISSIONS_OVERRIDE with added/removed/kept diffs and invalidate the user’s permission snapshot immediately.',
    'backend/src/routes/users/permissions.ts',
  ),

  // ── User Admin › User Types & Permissions ──
  R(
    'User Admin › User Types & Permissions',
    'UI',
    'Per-type CRUD grant tree',
    'Grids / Tables',
    'Six user types in a left rail; the right pane edits a CRUD grant tree per menu key (SITE_ADMIN rendered always-full, not editable); saving refreshes the caller’s own permission snapshot.',
    'frontend/src/components/user-admin/PermissionSetsAdmin.tsx · PermissionTree.tsx',
  ),
  R(
    'User Admin › User Types & Permissions',
    'Integration',
    'GET/PUT /users/permission-sets',
    'API orchestration',
    'GET auto-creates any missing set (one per user type); PUT replaces the grant list wholesale and can return 202 when held for approval.',
    'backend/src/routes/users/permissionSets.ts',
  ),
  R(
    'User Admin › User Types & Permissions',
    'Business Service',
    'Four-eyes grant replacement',
    'Access decisions',
    'maybeHold (decisionKey user-admin.permission-sets.replace) parks the change as an ApprovalRequest until a second admin approves; then replacePermissionSetGrants applies it atomically.',
    'backend/src/lib/approvals/engine · services/permissionSetWrites',
    'BEHAVIOR',
  ),
  R(
    'User Admin › User Types & Permissions',
    'Data',
    'PermissionSet + grant rows',
    'Reference data',
    'PermissionSet per userType with PermissionSetGrant children; grants resolve against the shared MENU_TREE keys.',
    'backend/prisma/schema.prisma (PermissionSet, PermissionSetGrant)',
  ),
  R(
    'User Admin › User Types & Permissions',
    'Infrastructure',
    'SITE_ADMIN role gate + ~1min propagation',
    'Permissions',
    'The tab and API are requireRole(SITE_ADMIN) — a role gate, not a menu key; other sessions pick changes up within about a minute of snapshot staleness.',
    'backend/src/routes/users/permissionSets.ts (requireRole)',
  ),

  // ── User Admin › API Keys & Provisioning ──
  R(
    'User Admin › API Keys & Provisioning',
    'UI',
    'Key manager with reveal-once',
    'Input Fields',
    'Create form (name + optional webhook secret), a keys table (prefix, created, last used, status, revoke via typed confirm) and static docs for the provisioning endpoints; raw key shows exactly once.',
    'frontend/src/components/user-admin/IntegrationsAdmin.tsx',
  ),
  R(
    'User Admin › API Keys & Provisioning',
    'Integration',
    '/users/api-keys + the provisioning surface',
    'API orchestration',
    'GET lists prefixes only; POST mints tbk_ keys (hash stored, raw returned once); revoke stamps revokedAt; the documented PUT/DELETE /provisioning/users/:externalId + webhook run on apiKeyAuth.',
    'backend/src/routes/users/apiKeys.ts · routes/provisioning/*',
  ),
  R(
    'User Admin › API Keys & Provisioning',
    'Business Service',
    'HMAC-verified webhook intake',
    'Request validation',
    'Provisioning webhooks authenticate with Bearer tbk_ keys plus an HMAC-SHA256 X-Signature over the raw body keyed by the webhook secret.',
    'backend/src/middleware/apiKeyAuth.ts',
    'BEHAVIOR',
  ),
  R(
    'User Admin › API Keys & Provisioning',
    'Data',
    'ApiKey rows: hash + prefix only',
    'Reference data',
    'ApiKey stores keyHash and keyPrefix (never the raw key), scopes, lastUsedAt and revokedAt; webhook secrets are stripped from list reads.',
    'backend/prisma/schema.prisma (ApiKey)',
  ),
  R(
    'User Admin › API Keys & Provisioning',
    'Infrastructure',
    'SITE_ADMIN gate + audited mint/revoke',
    'Logging & observability',
    'requireRole(SITE_ADMIN); every create/revoke writes an AuditEntry (entityType ApiKey); raw material is only ever in the POST response.',
    'backend/src/routes/users/apiKeys.ts (audit)',
  ),
];

async function main() {
  const ws = await prisma.rationalizationWorkspace.findUnique({ where: { id: WS } });
  if (!ws) throw new Error('workspace not found');

  // The Product Models page shipped after the screen catalog was seeded.
  const pmScreen = await prisma.screenAsset.findFirst({
    where: { workspaceId: WS, name: 'Product Models' },
  });
  if (!pmScreen) {
    await prisma.screenAsset.create({
      data: {
        tenantId: ws.tenantId,
        companyId: ws.companyId,
        workspaceId: WS,
        appId: APP_FE,
        name: 'Product Models',
        kind: 'SCREEN',
        url: '/product-models',
      },
    });
    console.log('added "Product Models" screen to the catalog');
  }

  const del = await prisma.rationalizationCapability.deleteMany({ where: { workspaceId: WS } });
  console.log(`deleted ${del.count} old findings`);

  const data = ROWS.map((r) => ({
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
    codeRef: r.codeRef,
    plainSummary: r.summary,
    screenRef: r.screen,
    view: r.view ?? 'COMPONENT',
    illustrative: false,
    deadCode: r.dead ?? false,
  }));
  const ins = await prisma.rationalizationCapability.createMany({ data });
  const screens = new Set(ROWS.map((r) => r.screen)).size;
  console.log(`inserted ${ins.count} findings across ${screens} screens`);

  // Sanity: every catalog screen must now have at least one finding.
  const catalog = await prisma.screenAsset.findMany({
    where: { workspaceId: WS },
    select: { name: true },
  });
  const covered = new Set(ROWS.map((r) => r.screen));
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
