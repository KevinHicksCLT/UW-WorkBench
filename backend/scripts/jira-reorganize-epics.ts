/**
 * One-off: reorganize the SCRUM backlog to one-epic-per-workspace-tab plus
 * general epics (New Functionality / Platform UX & Reliability / Performance /
 * Business Case). Tab list mirrors shared/src/menuRegistry.ts MENU_TREE.
 *
 *  - Retitles existing epics that map 1:1 onto a tab (key kept, history kept).
 *  - Creates missing tab epics + the Performance epic.
 *  - Re-parents stories whose feedback page differs from their old epic.
 *  - Dissolves SCRUM-82 (segmentation) into New Functionality and deletes it.
 *
 * Run from backend/:  npx tsx --env-file=.env scripts/jira-reorganize-epics.ts
 * Idempotent-ish: retitles and moves are safe to re-run; epic creation is NOT
 * (guarded by a label check on `tab-epic`), delete of SCRUM-82 404s harmlessly.
 */

const BASE_URL = 'https://kevinhicksclt.atlassian.net';
const PROJECT_KEY = 'SCRUM';
const NEW_EPIC_LABEL = 'tab-epic';

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
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Jira ${init?.method ?? 'GET'} ${path} failed: HTTP ${res.status} ${body.slice(0, 400)}`,
    );
  }
  return res;
}

const doc = (text: string) => ({
  type: 'doc',
  version: 1,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

// ── Target structure ─────────────────────────────────────────────────────────

/** Existing epics that become tab/general epics — retitle + redescribe. */
const RETITLES: { key: string; summary: string; description: string }[] = [
  {
    key: 'SCRUM-25',
    summary: 'Home',
    description: 'Home tab (route /): dashboard widgets, program cards, KPI tiles.',
  },
  {
    key: 'SCRUM-29',
    summary: 'Value Streams',
    description:
      'Value Streams tab (routes /overview, /value-streams, /n/): map/list views, Inspector side panel, process hierarchy L3/L4/L5.',
  },
  {
    key: 'SCRUM-36',
    summary: 'Standards',
    description: 'Standards tab (route /standards): standards catalog, drilldowns, agent skills.',
  },
  {
    key: 'SCRUM-39',
    summary: 'Regulations',
    description:
      'Regulations tab (route /regulations): requirements, compliance rules, coverage, monitored sources.',
  },
  {
    key: 'SCRUM-47',
    summary: 'Metrics',
    description: 'Metrics tab (route /metrics): AI adoption stages, rollups, trackable metrics.',
  },
  {
    key: 'SCRUM-55',
    summary: 'Deliverables',
    description:
      'Deliverables tab (routes /deliverables, /work): deliverable list, search, columns, detail drill-down.',
  },
  {
    key: 'SCRUM-64',
    summary: 'Applications',
    description: 'Applications tab (route /applications): app portfolio, TCO, vendors.',
  },
  {
    key: 'SCRUM-68',
    summary: 'Platform UX & Reliability',
    description:
      'General: cross-cutting UI/UX, auth/session reliability, dialogs, filters, the feedback widget itself.',
  },
  {
    key: 'SCRUM-72',
    summary: 'New Functionality',
    description:
      'General: new capabilities that do not belong to a single existing tab (AI/human process tagging, EDI awareness, segmentation by LOB/segment/region, ...).',
  },
];

/** Missing tab epics + Performance — created fresh. */
const NEW_EPICS: { summary: string; description: string }[] = [
  {
    summary: 'Organization',
    description:
      'Organization tab (routes /organization, /divisions, /departments): org map/list, divisions, departments, exec office.',
  },
  {
    summary: 'Roles',
    description: 'Roles tab (route /roles): role catalog, role detail, role associations.',
  },
  {
    summary: 'Tasks',
    description:
      'Tasks tab (route /tasks): task list, search, columns, AI automatability per task.',
  },
  {
    summary: 'Automatable',
    description:
      'Automatable tab (route /automatable): automatability snapshot, rollups, value/complexity views.',
  },
  {
    summary: 'Third-Parties',
    description: 'Third-Parties tab (route /external): external parties and interactions.',
  },
  {
    summary: 'Workspace',
    description:
      'Workspace tab (routes /portfolio, /programs, /initiatives, /raid): programs, initiatives, RAID, benefits/costs.',
  },
  {
    summary: 'Approvals',
    description: 'Approvals tab (route /approvals): approval queues and routing.',
  },
  {
    summary: 'Work Library',
    description:
      'Work Library tab (route /work-library): work plan templates, assignments, chains.',
  },
  {
    summary: 'Data Admin',
    description:
      'Data Admin tab (routes /admin, /audit): configure, trackable metrics, audit log, data dictionary.',
  },
  {
    summary: 'User Admin',
    description: 'User Admin tab (route /user-admin): users, user types & permissions, API keys.',
  },
  {
    summary: 'Performance',
    description:
      'General: slowness, load times, timeouts, rendering performance anywhere in the app.',
  },
];

/** Story moves: page the feedback was captured on decides the epic. */
const MOVES: { story: string; toEpic: string }[] = [
  // Organization-tab feedback out of the old combined VS & Org epic
  { story: 'SCRUM-31', toEpic: 'Organization' },
  { story: 'SCRUM-34', toEpic: 'Organization' },
  { story: 'SCRUM-35', toEpic: 'Organization' },
  // /roles page feedback
  { story: 'SCRUM-21', toEpic: 'Roles' },
  // Tasks-tab feedback out of the old combined Work Library epic
  { story: 'SCRUM-9', toEpic: 'Tasks' },
  { story: 'SCRUM-60', toEpic: 'Tasks' },
  { story: 'SCRUM-61', toEpic: 'Tasks' },
  { story: 'SCRUM-62', toEpic: 'Tasks' },
  // Automatable-tab feedback
  { story: 'SCRUM-63', toEpic: 'Automatable' },
  // Third-Parties feedback out of the old combined Applications epic
  { story: 'SCRUM-67', toEpic: 'Third-Parties' },
  // Page-specific admin feedback out of Platform UX
  { story: 'SCRUM-69', toEpic: 'Data Admin' },
  { story: 'SCRUM-19', toEpic: 'User Admin' },
  // Segmentation epic dissolves into New Functionality (SCRUM-72)
  { story: 'SCRUM-83', toEpic: 'SCRUM-72' },
  { story: 'SCRUM-84', toEpic: 'SCRUM-72' },
  { story: 'SCRUM-85', toEpic: 'SCRUM-72' },
];

const DELETE_AFTER: string[] = ['SCRUM-82']; // emptied by the moves above

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Guard: new epics must not already exist.
  const guard = await jira('/rest/api/3/search/jql', {
    method: 'POST',
    body: JSON.stringify({
      jql: `project = ${PROJECT_KEY} AND labels = ${NEW_EPIC_LABEL}`,
      maxResults: 1,
      fields: ['key'],
    }),
  });
  const existing = (await guard.json()) as { issues?: unknown[] };
  if (existing.issues && existing.issues.length > 0 && !process.argv.includes('--force')) {
    console.error(
      `Epics labelled ${NEW_EPIC_LABEL} already exist — reorg already ran. --force to override.`,
    );
    process.exit(1);
  }

  for (const r of RETITLES) {
    await jira(`/rest/api/3/issue/${r.key}`, {
      method: 'PUT',
      body: JSON.stringify({ fields: { summary: r.summary, description: doc(r.description) } }),
    });
    console.log(`RETITLE ${r.key} → "${r.summary}"`);
  }

  const created: Record<string, string> = {}; // summary → key
  for (const e of NEW_EPICS) {
    const res = await jira('/rest/api/3/issue', {
      method: 'POST',
      body: JSON.stringify({
        fields: {
          project: { key: PROJECT_KEY },
          issuetype: { name: 'Epic' },
          labels: [NEW_EPIC_LABEL],
          summary: e.summary,
          description: doc(e.description),
        },
      }),
    });
    const body = (await res.json()) as { key: string };
    created[e.summary] = body.key;
    console.log(`CREATE  ${body.key}  ${e.summary}`);
  }

  for (const m of MOVES) {
    const target = m.toEpic.startsWith('SCRUM-') ? m.toEpic : created[m.toEpic];
    if (!target) throw new Error(`no epic key for "${m.toEpic}"`);
    await jira(`/rest/api/3/issue/${m.story}`, {
      method: 'PUT',
      body: JSON.stringify({ fields: { parent: { key: target } } }),
    });
    console.log(`MOVE    ${m.story} → ${target} (${m.toEpic})`);
  }

  for (const key of DELETE_AFTER) {
    const res = await jira(`/rest/api/3/issue/${key}`, { method: 'DELETE' });
    console.log(`DELETE  ${key} ${res.status === 404 ? '(already gone)' : 'OK'}`);
  }

  console.log('\nEpic keys for feedback.config.json:');
  for (const [name, key] of Object.entries(created)) console.log(`  ${key}  ${name}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
