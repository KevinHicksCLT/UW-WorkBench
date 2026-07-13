/**
 * One-off: apply the reviewed transcript-backlog decisions to Jira.
 *  - Creates 4 new epics (Programs & Initiatives + the 3 proposed ones).
 *  - Creates every approved story under its (user-corrected) epic, with the
 *    reviewed status: todo→To Do, partial→In Progress, done→Done.
 *  - Transitions the 4 confirmed-live existing tickets to Done.
 *
 * Decisions captured from the interactive review UI (July 2026). Idempotency:
 * guarded by label `transcript-backlog`; pass --force to add anyway.
 *
 * Run from backend/:  npx tsx --env-file=.env scripts/jira-transcript-stories.ts
 */

const BASE_URL = 'https://kevinhicksclt.atlassian.net';
const PROJECT_KEY = 'SCRUM';
const LABEL = 'transcript-backlog';
const EPIC_LABEL = 'transcript-epic';

type Status = 'todo' | 'partial' | 'done';
type Story = {
  id: string;
  title: string;
  status: Status;
  owner?: string;
  src?: string;
  comment?: string;
  /** Epic: an existing SCRUM key, or a NEW-epic name defined in NEW_EPICS. */
  epic: string;
};

const NEW_EPICS: { name: string; description: string }[] = [
  {
    name: 'Programs & Initiatives',
    description:
      'Transformation portfolio: programs, initiatives, charters, RAID, resource plans, financials roll-ups. (Split out of the Workspace tab per review.)',
  },
  {
    name: 'Onboarding & Personalization',
    description:
      'Role-aware first-run and personalization — how-to tab, site map, role-based landing pages, login role selection, tab visibility, user preferences, guided wizard, escalation.',
  },
  {
    name: 'Knowledge Base & Process Model',
    description:
      'Data-pipeline / institutional-memory track — KB architecture, canonical process library, L5 dedup/merge, agent enablement, delta analysis.',
  },
  {
    name: 'Integrations & Automation',
    description:
      'Live client-system connectivity (API/MCP to ServiceNow/SAP/Workday), onboarding portal, data lake/warehouse, change-impact assessment, cross-app dependency mapping.',
  },
];

const STORIES: Story[] = [
  // ── Business Case (SCRUM-79) ──
  {
    id: 'BC1',
    epic: 'SCRUM-79',
    status: 'todo',
    owner: 'Kelly',
    src: 'Exec-slides',
    title:
      'Add a "Data benefits" section to the executive slides — portfolio rationalization, tech-debt reduction, data quality; circulate first three slides',
  },
  {
    id: 'BC2',
    epic: 'SCRUM-79',
    status: 'todo',
    owner: 'Kelly / Kevin',
    src: 'Deck-structure',
    comment: 'compare deck to World Insurance Report AI statistics',
    title: 'Ground the deck in World Insurance Report AI statistics (synthesize through Claude)',
  },
  {
    id: 'BC3',
    epic: 'SCRUM-79',
    status: 'partial',
    owner: 'Kevin',
    src: 'Deck-structure',
    title:
      'Reorder deck: move Transformation Bridge slides adjacent; revise duplicate telemetry taglines (13/15)',
  },
  {
    id: 'BC4',
    epic: 'SCRUM-79',
    status: 'done',
    owner: 'Kelly',
    src: 'Exec-slides',
    title:
      'Reframe messaging to workforce/capacity language — capacity for higher-value work, not headcount reduction',
  },
  {
    id: 'BC5',
    epic: 'SCRUM-79',
    status: 'todo',
    owner: 'Kevin',
    src: 'Economics',
    title:
      'Articulate value levers + ROI visualization — labor / licensing / synergy; cycle-time, opex, quality',
  },
  {
    id: 'BC6',
    epic: 'SCRUM-79',
    status: 'todo',
    owner: 'Kelly / Kevin',
    src: 'Financial-viz',
    title:
      'Build the "bubble cost" / payback / value-realization visual; exec summary + supporting detail',
  },
  {
    id: 'BC7',
    epic: 'SCRUM-79',
    status: 'todo',
    owner: 'Kevin / Kelly',
    src: 'Readiness',
    title: 'Readiness-assessment framework + deterministic rubric-tool content (weighted gaps)',
  },
  {
    id: 'BC8',
    epic: 'SCRUM-79',
    status: 'todo',
    owner: 'Kelly',
    src: 'Evergreen',
    title: 'Evergreen-portfolio narrative — self-*, opacity tax, bottom-up risk & dependency',
  },
  {
    id: 'BC9',
    epic: 'SCRUM-79',
    status: 'done',
    owner: 'Kevin / Kelly',
    src: 'Buildout',
    title:
      'Workflow-segmentation-by-complexity content — no/low/pro-code, model + deployment matching',
  },
  {
    id: 'BC10',
    epic: 'SCRUM-79',
    status: 'todo',
    owner: 'Kevin',
    src: 'Demos',
    title:
      'Create snippet demos incl. a start-to-finish actuarial use case for technical audiences',
  },
  {
    id: 'BC11',
    epic: 'SCRUM-79',
    status: 'done',
    owner: 'Kevin',
    src: 'Metrics',
    title: 'Validate / clarify the AIG use-case statistics scope in the executive summary',
  },
  {
    id: 'BC12',
    epic: 'SCRUM-79',
    status: 'todo',
    owner: 'Kevin / Kelly',
    src: 'Positioning',
    title:
      'Decide positioning & deployment model — SaaS vs open-source vs client-hosted; security & commercialization',
  },

  // ── Roles (SCRUM-87) ── (+ KB8 moved here)
  {
    id: 'RO1',
    epic: 'SCRUM-87',
    status: 'todo',
    owner: 'Xandor',
    src: 'Data-model',
    title:
      'Introduce a manager concept on operating roles — reporting relationships + capacity tracking',
  },
  {
    id: 'RO2',
    epic: 'SCRUM-87',
    status: 'todo',
    owner: 'Xandor',
    src: 'Data-model',
    title: 'Support dotted-line reporting relationships on roles',
  },
  {
    id: 'RO3',
    epic: 'SCRUM-87',
    status: 'partial',
    owner: 'Xandor',
    src: 'Data-model',
    title: 'Fix executives assigned to low-level tasks (e.g. Chief Actuary)',
  },
  {
    id: 'KB8',
    epic: 'SCRUM-87',
    status: 'todo',
    owner: 'Xandor',
    src: 'Dedup',
    title:
      'Split roles into contributing vs owner with responsibility descriptions (creator / reviewer / approver); remove [C] markers',
  },

  // ── Tasks (SCRUM-88) ── (+ KB7 moved here)
  {
    id: 'TA1',
    epic: 'SCRUM-88',
    status: 'todo',
    owner: 'Kelly',
    src: 'Role-nav',
    title:
      'Task-relevance validation per role — mark applicable / not-applicable and identify who performs the rest',
  },
  {
    id: 'TA2',
    epic: 'SCRUM-88',
    status: 'partial',
    owner: 'Xandor',
    src: 'Role-nav',
    title:
      'Reassign non-role tasks to another value stream / role / application / third-party, or mark not-performed',
  },
  {
    id: 'TA3',
    epic: 'SCRUM-88',
    status: 'partial',
    owner: 'Kelly',
    src: 'Checklist',
    title: 'Label sections "generic scope" vs "specific tasks"',
  },
  {
    id: 'TA4',
    epic: 'SCRUM-88',
    status: 'partial',
    owner: 'Xandor',
    src: 'Checklist',
    title: 'Checklist step add / edit / remove via dropdown UI',
  },
  {
    id: 'KB7',
    epic: 'SCRUM-88',
    status: 'todo',
    owner: 'Xandor',
    src: 'System-mapping',
    title:
      'Map each task / checklist item to its system of record (GitHub, Jira, ServiceNow, Vercel, Rally) with owner & evidence',
  },

  // ── Value Streams (SCRUM-29) ──
  {
    id: 'VS1',
    epic: 'SCRUM-29',
    status: 'todo',
    owner: 'Xandor',
    src: 'Role-nav',
    title: 'Fix breadcrumbs to return the user accurately to their last position',
  },
  {
    id: 'VS2',
    epic: 'SCRUM-29',
    status: 'todo',
    owner: 'Kevin',
    src: 'L5-delta',
    title: 'Allow multiple L4/L5 sections expanded simultaneously for review & screenshotting',
  },

  // ── Workspace (SCRUM-91) ── VS3 moved here
  {
    id: 'VS3',
    epic: 'SCRUM-91',
    status: 'todo',
    owner: 'Xandor',
    src: 'Migration',
    title:
      'Legacy→Greenfield mapping (not 1:1; fat app + microservices; validation logic in business-service layer)',
  },

  // ── Organization (SCRUM-86) ──
  {
    id: 'OR1',
    epic: 'SCRUM-86',
    status: 'done',
    owner: 'Xandor',
    src: 'Diagram',
    title:
      'Operating-model diagram: center-align ABC Insurance / core business / corporate functions',
  },

  // ── Programs & Initiatives (NEW) ── WS portfolio items
  {
    id: 'WS1',
    epic: 'Programs & Initiatives',
    status: 'done',
    owner: 'Xandor',
    src: 'Programs',
    title: 'Add a Programs tab / program-level view',
  },
  {
    id: 'WS2',
    epic: 'Programs & Initiatives',
    status: 'partial',
    owner: 'Xandor',
    src: 'Programs',
    title: 'Add an "add new program" button (top-right of the portfolio)',
  },
  {
    id: 'WS3',
    epic: 'Programs & Initiatives',
    status: 'partial',
    owner: 'Xandor',
    src: 'Programs',
    title: 'Show the Charter at program & workstream level (replace the Summary)',
  },
  {
    id: 'WS6',
    epic: 'Programs & Initiatives',
    status: 'partial',
    owner: 'Xandor',
    src: 'Resource',
    title: 'Resource view — add an onshore/offshore indicator, filterable, realistic data',
  },
  {
    id: 'WS7',
    epic: 'Programs & Initiatives',
    status: 'partial',
    owner: 'Xandor',
    src: 'Financials',
    title: 'Budget / forecast / actual-spend tracking per initiative & program',
  },
  {
    id: 'WS8',
    epic: 'Programs & Initiatives',
    status: 'done',
    owner: 'Xandor',
    src: 'Data-model',
    title: 'Ensure the change log is present and marked complete after the work plan',
  },
  {
    id: 'WS9',
    epic: 'Programs & Initiatives',
    status: 'partial',
    owner: 'Xandor',
    src: 'UI',
    title:
      'Remove redundant Net Benefit / Value Score cards from program & initiative views; replace with budget/spend',
  },
  {
    id: 'WS10',
    epic: 'Programs & Initiatives',
    status: 'todo',
    owner: 'Xandor',
    src: 'UI',
    title: 'Rename the initiative stage button to "Back" — currently ships as "Roll Back"',
  },
  {
    id: 'WS11',
    epic: 'Programs & Initiatives',
    status: 'partial',
    owner: 'Xandor',
    src: 'UI',
    title: 'Navigation label cleanup — capitalization, remove unnecessary stage labels',
  },

  // ── Home (SCRUM-25) ── WS4, WS5 moved here
  {
    id: 'WS4',
    epic: 'SCRUM-25',
    status: 'done',
    owner: 'Xandor',
    src: 'Programs',
    title: 'Move the strategic-bets (value vs complexity) grid below the RAID log',
  },
  {
    id: 'WS5',
    epic: 'SCRUM-25',
    status: 'todo',
    owner: 'Xandor',
    src: 'Financials',
    title:
      'Roll financials & work plans up from initiatives to the program level (accurate totals)',
  },

  // ── Deliverables (SCRUM-55) ──
  {
    id: 'DE1',
    epic: 'SCRUM-55',
    status: 'partial',
    owner: 'Xandor / Kevin',
    src: 'Deliverables',
    title:
      'Settle deliverables-vs-tasks modeling — tasks lowest, deliverables are task groupings; pick the rollup approach',
  },
  {
    id: 'DE2',
    epic: 'SCRUM-55',
    status: 'todo',
    owner: 'Xandor',
    src: 'Deliverables',
    title:
      'Edit feature — quick add/remove/move of deliverables & tasks, versioned, with dropdown associations',
  },

  // ── Third-Parties (SCRUM-90) ──
  {
    id: 'TP1',
    epic: 'SCRUM-90',
    status: 'todo',
    owner: 'Kevin / Kelly',
    src: '3rd-party',
    title:
      'Capture third-party (broker / MGA) interactions & dependencies within value streams — trigger & delay points',
  },
  {
    id: 'TP2',
    epic: 'SCRUM-90',
    status: 'todo',
    owner: 'Kelly',
    src: '3rd-party',
    title:
      'Tag dependencies at task level; AI agents monitor SOP adherence, alert unmet dependencies, heat-map / rate performance',
  },
  {
    id: 'TP3',
    epic: 'SCRUM-90',
    status: 'todo',
    owner: 'Kevin / Kelly',
    src: '3rd-party',
    title:
      'Data-driven third-party performance measurement against SOPs/SLAs, captured at contracting time',
  },

  // ── Applications (SCRUM-64) ── NF1 moved here
  {
    id: 'NF1',
    epic: 'SCRUM-64',
    status: 'todo',
    owner: 'Kevin / Xandor',
    src: 'Migration',
    title:
      'Multiple workspace types (app & tooling); background IT-asset-inventory load; track app migration (Oracle→Postgres)',
  },

  // ── Platform UX (SCRUM-68) ──
  {
    id: 'UX1',
    epic: 'SCRUM-68',
    status: 'todo',
    owner: 'Xandor',
    src: 'Feedback',
    title:
      'Make the feedback button more noticeable and rename it to reflect its dual feedback + fixes purpose',
  },
  {
    id: 'UX2',
    epic: 'SCRUM-68',
    status: 'todo',
    owner: 'Xandor',
    src: 'Export',
    title: 'Add export & print-to-PDF across the app for sharing large datasets',
  },
  {
    id: 'UX3',
    epic: 'SCRUM-68',
    status: 'todo',
    owner: 'Team',
    src: 'Editability',
    title: 'Make edit boxes resizable and move/edit actions more intuitive',
  },
  {
    id: 'UX4',
    epic: 'SCRUM-68',
    status: 'todo',
    owner: 'Team',
    src: 'Standards',
    title:
      'Clarify terminology (verified / unmapped / requires-integration) with hover; remove obsolete tags',
  },

  // ── User Admin (SCRUM-95) ──
  {
    id: 'UA1',
    epic: 'SCRUM-95',
    status: 'done',
    owner: 'Kevin / Xandor',
    src: 'Permissions',
    title:
      'Role-based + attribute-based permissions (scope by LOB / region / department; restrict edits to owned areas)',
  },
  {
    id: 'UA2',
    epic: 'SCRUM-95',
    status: 'todo',
    owner: 'Kelly',
    src: 'Permissions',
    title: 'Spell out CRUD (Create / Read / Update / Delete) in the permission UI',
  },
  {
    id: 'UA3',
    epic: 'SCRUM-95',
    status: 'todo',
    owner: 'Xandor',
    src: 'Permissions',
    title: 'Clarify the purpose of API keys & webhooks (integration points) in the UI',
  },
  {
    id: 'UA4',
    epic: 'SCRUM-95',
    status: 'partial',
    owner: 'Kevin / Xandor',
    src: 'Exec-slides',
    title:
      'Create user + approver test accounts for Kelly to exercise governance & approval workflows',
  },

  // ── Approvals (SCRUM-92) ──
  {
    id: 'AP1',
    epic: 'SCRUM-92',
    status: 'done',
    owner: 'Xandor',
    src: 'Governance',
    title: 'Maker-checker / reviewer approval workflow with in-tool sign-off',
  },
  {
    id: 'AP2',
    epic: 'SCRUM-92',
    status: 'todo',
    owner: 'Kevin',
    src: 'Governance',
    title: 'Adaptive cards in Teams / Outlook for approvals & notifications',
  },
  {
    id: 'AP3',
    epic: 'SCRUM-92',
    status: 'todo',
    owner: 'Team',
    src: 'Governance',
    title:
      'Change-data-capture — on personnel departures reassign responsibilities to prevent orphaned tasks',
  },

  // ── Data Admin (SCRUM-94) ── + 3 added stories
  {
    id: 'DA1',
    epic: 'SCRUM-94',
    status: 'done',
    owner: 'Kevin / Xandor',
    src: 'Governance',
    title: 'Audit log recording change history (who changed what, when)',
  },
  {
    id: 'DA2',
    epic: 'SCRUM-94',
    status: 'todo',
    src: 'Review UI',
    title: 'Ensure that the Audit log is working correctly',
  },
  {
    id: 'DA3',
    epic: 'SCRUM-94',
    status: 'todo',
    src: 'Review UI',
    title: 'Ensure the Data Admin tab is correctly wired to make updates',
  },
  {
    id: 'DA4',
    epic: 'SCRUM-94',
    status: 'todo',
    src: 'Review UI',
    title: 'Ensure everything within the app is editable across all tabs',
  },

  // ── Standards (SCRUM-36) ──
  {
    id: 'ST1',
    epic: 'SCRUM-36',
    status: 'done',
    owner: 'Kevin',
    src: 'Standards',
    title: 'Tag standards to departments / roles for accountability',
  },

  // ── Regulations (SCRUM-39) ── (blank added story skipped)
  {
    id: 'RG1',
    epic: 'SCRUM-39',
    status: 'todo',
    owner: 'Kelly',
    src: 'Compliance',
    title:
      'Link requirements to specific tasks & accountable roles; drill to actionable items; verify via system acknowledgment',
  },
  {
    id: 'RG2',
    epic: 'SCRUM-39',
    status: 'todo',
    owner: 'Team',
    src: 'Data-standardization',
    title:
      'Track data-standardization changes driven by regulation (e.g. new form fields) — implement, verify, tag & integrate with Jira',
  },

  // ── Metrics (SCRUM-47) ──
  {
    id: 'ME1',
    epic: 'SCRUM-47',
    status: 'todo',
    owner: 'Kevin / Kelly',
    src: 'Operating-model',
    title:
      'Metric-bar resizing, card-layout refinement & taxonomy standardization (engage a designer)',
  },

  // ── Onboarding & Personalization (NEW) ──
  {
    id: 'ON1',
    epic: 'Onboarding & Personalization',
    status: 'todo',
    owner: 'Kevin / Xandor',
    src: 'Onboarding',
    title: 'Add a "How to use / Purpose" onboarding tab with setup instructions',
  },
  {
    id: 'ON2',
    epic: 'Onboarding & Personalization',
    status: 'todo',
    owner: 'Team',
    src: 'Onboarding',
    title: 'Add a site map / site tree for an aerial overview',
  },
  {
    id: 'ON3',
    epic: 'Onboarding & Personalization',
    status: 'todo',
    owner: 'Kelly / Kevin',
    src: 'Personalization',
    title:
      'Role-based landing / home pages showing responsibilities, progress & remaining tasks per role/pod',
  },
  {
    id: 'ON4',
    epic: 'Onboarding & Personalization',
    status: 'todo',
    owner: 'Xandor',
    src: 'Onboarding',
    title:
      'Role selection at login / onboarding that sets the baseline home screen & accessible tabs',
  },
  {
    id: 'ON5',
    epic: 'Onboarding & Personalization',
    status: 'todo',
    owner: 'Xandor',
    src: 'Onboarding',
    title: 'Role-based tab visibility — users see only the sections relevant to them',
  },
  {
    id: 'ON6',
    epic: 'Onboarding & Personalization',
    status: 'todo',
    owner: 'Xandor',
    src: 'Personalization',
    title:
      'User preferences — default map/list view per tab, column widths, notification channel; persisted',
  },
  {
    id: 'ON7',
    epic: 'Onboarding & Personalization',
    status: 'todo',
    owner: 'Team',
    src: 'Personalization',
    title: 'Guided onboarding wizard / narration walking users through their required actions',
  },
  {
    id: 'ON8',
    epic: 'Onboarding & Personalization',
    status: 'todo',
    owner: 'Kelly / Kevin',
    src: 'Personalization',
    title:
      'Escalation / "capture difficulties" page — log blockers, escalate via adaptive cards to managers/committees',
  },

  // ── Knowledge Base & Process Model (NEW) ── (KB5,6→Work Library; KB7→Tasks; KB8→Roles)
  {
    id: 'KB1',
    epic: 'Knowledge Base & Process Model',
    status: 'todo',
    owner: 'Kevin / Xandor',
    src: 'KB',
    title:
      'Establish knowledge-base architecture & curation standards (SOP ingestion, regulation/policy capture, strategy & sentiment)',
  },
  {
    id: 'KB2',
    epic: 'Knowledge Base & Process Model',
    status: 'todo',
    owner: 'Xandor',
    src: 'Process-model',
    title:
      'Build a canonical process library — consolidate spreadsheet + DB inventories, resolve semantic duplicates',
  },
  {
    id: 'KB3',
    epic: 'Knowledge Base & Process Model',
    status: 'partial',
    owner: 'Xandor',
    src: 'Dedup',
    title:
      'L5 dedup / merge pipeline — merge high/med-confidence groups keeping richest detail, Merge Log audit, low-confidence to human review',
  },
  {
    id: 'KB4',
    epic: 'Knowledge Base & Process Model',
    status: 'done',
    owner: 'Xandor',
    src: 'L5-delta',
    title: 'Semantic dedup of the merged DB + workbook set (~12k rows), flagging duplicates per L4',
  },
  {
    id: 'KB9',
    epic: 'Knowledge Base & Process Model',
    status: 'todo',
    owner: 'Xandor / Kevin',
    src: 'Templates',
    title:
      'Fully implement one task end-to-end using the template + hydrated data as an AI-validation example',
  },
  {
    id: 'KB10',
    epic: 'Knowledge Base & Process Model',
    status: 'todo',
    owner: 'Xandor',
    src: 'Dedup',
    title:
      'Integrate the agent on top of the application (non-default, correctly configured, callable)',
  },
  {
    id: 'KB11',
    epic: 'Knowledge Base & Process Model',
    status: 'done',
    owner: 'Xandor',
    src: 'Data-reduction',
    title:
      'Reduce DB records to match the master spreadsheet (8k→3k) & run a delta vs the prior version to flag missing / dupes',
  },

  // ── Work Library (SCRUM-93) ── KB5, KB6 moved here
  {
    id: 'KB5',
    epic: 'SCRUM-93',
    status: 'partial',
    owner: 'Xandor / Kevin',
    src: 'Templates',
    title:
      'Testing template library — configurable testable patterns (validation / extraction / comparison) per SoR & task pattern',
  },
  {
    id: 'KB6',
    epic: 'SCRUM-93',
    status: 'partial',
    owner: 'Xandor / Kevin',
    src: 'Checklist',
    title:
      'Checklist template library — generic templates on atomic tasks, agent pre-fill from KB, human validate, testing-pattern sync',
  },

  // ── Integrations & Automation (NEW) ──
  {
    id: 'IN1',
    epic: 'Integrations & Automation',
    status: 'todo',
    owner: 'Kevin / Xandor',
    src: 'Integration',
    title:
      'Integrate with client systems via API keys + MCP servers (ServiceNow, SAP, Workday) to keep data current',
  },
  {
    id: 'IN2',
    epic: 'Integrations & Automation',
    status: 'todo',
    owner: 'Xandor / Kelly',
    src: 'Integration',
    title:
      'Client onboarding portal to connect knowledge bases / systems of record (integration over static upload)',
  },
  {
    id: 'IN3',
    epic: 'Integrations & Automation',
    status: 'todo',
    owner: 'Kelly / Kevin',
    src: 'Integration',
    title:
      'Homepage metric: "% of tool populated via automated collection," surfacing gaps & next steps',
  },
  {
    id: 'IN4',
    epic: 'Integrations & Automation',
    status: 'todo',
    owner: 'Kevin',
    src: 'Data',
    title:
      'Data-lake vs curated data-warehouse layer — sift/organize raw data; reconcile terminology & calc across groups',
  },
  {
    id: 'IN5',
    epic: 'Integrations & Automation',
    status: 'todo',
    owner: 'Kevin / Kelly',
    src: 'Change-impact',
    title:
      'Change-impact assessment tool — use application KBs to flag downstream effects before implementation, target testing',
  },
  {
    id: 'IN6',
    epic: 'Integrations & Automation',
    status: 'todo',
    owner: 'Kevin',
    src: 'Change-impact',
    title:
      'Cross-application dependency mapping (technical / process / people) with agent-based event coordination',
  },
];

const TRANSITION_TO_DONE = ['SCRUM-71', 'SCRUM-48', 'SCRUM-49', 'SCRUM-50'];

// ── Jira REST helpers ────────────────────────────────────────────────────────

function authHeader(): string {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) throw new Error('JIRA_EMAIL / JIRA_API_TOKEN not set');
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
}

async function jira(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Jira ${init?.method ?? 'GET'} ${path} failed: HTTP ${res.status} ${body.slice(0, 400)}`,
    );
  }
  return res;
}

type AdfNode = Record<string, unknown>;
const p = (t: string): AdfNode => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });
const h3 = (t: string): AdfNode => ({
  type: 'heading',
  attrs: { level: 3 },
  content: [{ type: 'text', text: t }],
});
const docOf = (content: AdfNode[]) => ({ type: 'doc', version: 1, content });

function storyDescription(s: Story): unknown {
  const content: AdfNode[] = [p(s.title)];
  if (s.owner) content.push(h3('Owner'), p(s.owner));
  if (s.comment) content.push(h3('Reviewer note'), p(s.comment));
  content.push(
    h3('Source'),
    p(`Transcript-backlog review, July 2026${s.src ? ` — ${s.src}` : ''}.`),
  );
  return docOf(content);
}

async function createIssue(fields: Record<string, unknown>): Promise<string> {
  const res = await jira('/rest/api/3/issue', { method: 'POST', body: JSON.stringify({ fields }) });
  const body = (await res.json()) as { key?: string };
  if (!body.key) throw new Error('issue create returned no key');
  return body.key;
}

/** Transition an issue to a named status; walks via In Progress if no direct edge. */
async function transitionTo(key: string, target: 'In Progress' | 'Done'): Promise<void> {
  const find = async (): Promise<{ id: string } | null> => {
    const res = await jira(`/rest/api/3/issue/${key}/transitions`);
    const body = (await res.json()) as { transitions: { id: string; to: { name: string } }[] };
    return body.transitions.find((t) => t.to.name.toLowerCase() === target.toLowerCase()) ?? null;
  };
  let t = await find();
  if (!t && target === 'Done') {
    // Some workflows require In Progress before Done.
    const ip = await transitionToRaw(key, 'In Progress');
    if (ip) t = await find();
  }
  if (!t) {
    console.warn(`  ! no "${target}" transition available for ${key} — left as-is`);
    return;
  }
  await jira(`/rest/api/3/issue/${key}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: t.id } }),
  });
}

async function transitionToRaw(key: string, target: string): Promise<boolean> {
  const res = await jira(`/rest/api/3/issue/${key}/transitions`);
  const body = (await res.json()) as { transitions: { id: string; to: { name: string } }[] };
  const t = body.transitions.find((x) => x.to.name.toLowerCase() === target.toLowerCase());
  if (!t) return false;
  await jira(`/rest/api/3/issue/${key}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: t.id } }),
  });
  return true;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!process.argv.includes('--force')) {
    const res = await jira('/rest/api/3/search/jql', {
      method: 'POST',
      body: JSON.stringify({
        jql: `project = ${PROJECT_KEY} AND labels = ${LABEL}`,
        maxResults: 1,
        fields: ['key'],
      }),
    });
    const existing = (await res.json()) as { issues?: unknown[] };
    if (existing.issues && existing.issues.length > 0) {
      console.error(`Issues labelled ${LABEL} already exist — rerun with --force to add anyway.`);
      process.exit(1);
    }
  }

  // 1) new epics
  const epicKey: Record<string, string> = {};
  for (const e of NEW_EPICS) {
    const key = await createIssue({
      project: { key: PROJECT_KEY },
      issuetype: { name: 'Epic' },
      labels: [EPIC_LABEL],
      summary: e.name,
      description: docOf([p(e.description)]),
    });
    epicKey[e.name] = key;
    console.log(`EPIC  ${key}  ${e.name}`);
  }

  const resolveEpic = (epic: string): string =>
    epic.startsWith('SCRUM-')
      ? epic
      : (epicKey[epic] ??
        (() => {
          throw new Error(`unknown epic ${epic}`);
        })());

  // 2) stories
  let created = 0;
  for (const s of STORIES) {
    const parent = resolveEpic(s.epic);
    const key = await createIssue({
      project: { key: PROJECT_KEY },
      issuetype: { name: 'Story' },
      parent: { key: parent },
      labels: [LABEL],
      summary: s.title,
      description: storyDescription(s),
    });
    if (s.status === 'partial') await transitionTo(key, 'In Progress');
    else if (s.status === 'done') await transitionTo(key, 'Done');
    created += 1;
    console.log(
      `  ${key}  [${s.status.toUpperCase()}]  (${s.id} → ${parent})  ${s.title.slice(0, 62)}`,
    );
  }

  // 3) transition confirmed-live existing tickets to Done
  for (const key of TRANSITION_TO_DONE) {
    await transitionTo(key, 'Done');
    console.log(`DONE  ${key}  (existing, confirmed live)`);
  }

  console.log(
    `\nCreated ${NEW_EPICS.length} epics + ${created} stories; transitioned ${TRANSITION_TO_DONE.length} existing to Done.`,
  );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
