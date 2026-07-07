/**
 * One-off: add follow-up tasks from the 2026-07 Kelly/Kevin/Xandor
 * Transformation Bridge review meeting to the Jira backlog. Deduplicated by
 * hand against the existing `feedback-workbook` backlog (SCRUM-25..74) and the
 * feedback-button tickets — items already covered (compliance-rule
 * discoverability SCRUM-44/45/46) are NOT re-created. New regulations stories
 * parent to the existing "Regulations Experience" epic; two new epics cover
 * business-case and segmentation work. All labelled `meeting-followup`.
 *
 * Run from backend/:  npx tsx --env-file=.env scripts/jira-add-meeting-tasks.ts
 * Refuses to run twice (checks the label); pass --force to add anyway.
 */

const BASE_URL = 'https://kevinhicksclt.atlassian.net';
const PROJECT_KEY = 'SCRUM';
const LABEL = 'meeting-followup';
const REGULATIONS_EPIC = 'SCRUM-39';

type StoryDef = { summary: string; detail: string; owner: string; related?: string };
type EpicDef = { name: string; goal: string; stories: StoryDef[] };

/** Stories added under the existing Regulations Experience epic. */
const REGULATIONS_STORIES: StoryDef[] = [
  {
    summary: 'Move requirement numbers and last-updated details to the individual state view',
    detail:
      'UI improvement from the review: requirement numbers and last-updated metadata clutter the aggregate view — relocate them to the individual state drill-down where they carry context.',
    owner: 'Xandor, Kevin',
    related:
      'Complements SCRUM-44/SCRUM-45/SCRUM-46 (compliance-rule and monitored-source accessibility).',
  },
  {
    summary: 'Visually distinguish compliance rules from active requirements',
    detail:
      'Identify and clarify the distinction between compliance rules and active requirements within the tool, and add a visual indicator (badge/color/category) marking which requirements are compliance-related, so users can focus on critical compliance obligations versus general monitoring.',
    owner: 'Xandor, Kevin',
    related:
      'Builds on SCRUM-46 (surface Compliance Rules) — this adds the visual differentiation.',
  },
  {
    summary: 'Audit regulations data for coverage across all lines of business',
    detail:
      "Audit and review the regulations data to ensure all relevant lines of business (e.g., auto, property) are included and not just workers' comp. Kelly questioned completeness for different lines of business; logical grouping and filtering should reduce noise.",
    owner: 'Xandor',
  },
];

const NEW_EPICS: EpicDef[] = [
  {
    name: 'Business Case & Stakeholder Communication',
    goal: 'Articulate the Transformation Bridge purpose, benefits, and boundaries to business and technology stakeholders: not a system of record, a transformation-period launchpad (~24-48 months) that hands processes off to operational systems (e.g. Jira) once the North Star state is reached.',
    stories: [
      {
        summary: 'Draft elevator pitch and business case (business version, then technical input)',
        detail:
          'Kelly drafts the initial elevator pitch and business case from a business standpoint, then passes to Kevin for technical detail. Must cover: launchpad-not-system-of-record positioning, defined lifecycle ending when transformation goals are achieved, investment plus one-time and ongoing costs, and qualitative/quantitative benefits (employee experience, retention, process efficiency). Message tailored to both business and technical audiences, targeting large insurers, specialty carriers, and consulting firms.',
        owner: 'Kelly (draft), Kevin (technical input)',
      },
      {
        summary: 'Create draft benefits slide (benefits vs investments)',
        detail:
          'Create a draft of the benefits slide for the Transformation Bridge, considering how to represent benefits and investments, and share with Kevin for feedback.',
        owner: 'Kelly',
      },
    ],
  },
  {
    name: 'Process Segmentation by Line of Business, Segment & Region',
    goal: "Represent organizational processes segmented by line of business (auto, property, workers' comp), segment (small commercial, large commercial, multinational, specialty), and region (North America, Japan, London market) — flexible structures for multinational/specialty operations, plus side-by-side comparison to surface synergies and standardization opportunities.",
    stories: [
      {
        summary: 'Research how process flows differ by segment and region',
        detail:
          'Research and provide examples of how process flows differ by segment (e.g., small commercial, specialty, multinational) and region, and share findings with Kevin for technical representation in the tool.',
        owner: 'Kelly',
      },
      {
        summary: 'Research lines of business and segments; compare against existing templates',
        detail:
          'Use a research assistant to gather information on different lines of business and segments, and compare with existing templates to identify gaps or additional needs. Reference material: the L5 Process Complexity Comparison matrix (Sheet1 of the feedback workbook) comparing Personal / Small Comm / Mid-Market / Large Comm / Specialty.',
        owner: 'Kelly',
      },
      {
        summary: 'Support flexible segmentation structures in the process model',
        detail:
          'Team agreed the tool needs flexible structures to represent processes that differ by line of business, segment, and region — especially multinational operations where processes and regulatory requirements vary significantly. Should enable identifying common processes across segments and visualizing/comparing process flows side by side.',
        owner: 'Kevin, Xandor',
      },
    ],
  },
];

// ── Jira REST helpers (same shape as jira-create-backlog.ts) ────────────────

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
    throw new Error(`Jira ${path} failed: HTTP ${res.status} ${body.slice(0, 500)}`);
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
const doc = (content: AdfNode[]) => ({ type: 'doc', version: 1, content });

function storyDescription(story: StoryDef): unknown {
  const content: AdfNode[] = [
    p(story.detail),
    h3('Owner'),
    p(story.owner),
    h3('Source'),
    p('Follow-up task — Transformation Bridge review meeting (Kelly / Kevin / Xandor), July 2026.'),
  ];
  if (story.related) content.push(h3('Related'), p(story.related));
  return doc(content);
}

async function createIssue(fields: Record<string, unknown>): Promise<string> {
  const res = await jira('/rest/api/3/issue', {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
  const body = (await res.json()) as { key?: string };
  if (!body.key) throw new Error('issue create returned no key');
  return body.key;
}

async function createStory(parentKey: string, story: StoryDef): Promise<void> {
  const key = await createIssue({
    project: { key: PROJECT_KEY },
    issuetype: { name: 'Story' },
    parent: { key: parentKey },
    labels: [LABEL],
    summary: story.summary,
    description: storyDescription(story),
  });
  console.log(`  STORY ${key}  (under ${parentKey})  ${story.summary}`);
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

  console.log(`Adding regulations stories under existing epic ${REGULATIONS_EPIC}:`);
  for (const story of REGULATIONS_STORIES) await createStory(REGULATIONS_EPIC, story);

  for (const epic of NEW_EPICS) {
    const epicKey = await createIssue({
      project: { key: PROJECT_KEY },
      issuetype: { name: 'Epic' },
      labels: [LABEL],
      summary: epic.name,
      description: doc([
        p(epic.goal),
        p('Source: Transformation Bridge review meeting (Kelly / Kevin / Xandor), July 2026.'),
      ]),
    });
    console.log(`EPIC  ${epicKey}  ${epic.name}`);
    for (const story of epic.stories) await createStory(epicKey, story);
  }

  console.log('\nDone.');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
