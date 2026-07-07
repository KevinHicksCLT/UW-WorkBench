/**
 * One-off: build the Jira backlog from documents/Feedback/Transformation
 * Bridge Feedback.xlsx — one Epic per feature theme, one Story per feedback
 * row, stories parented to their epic. Labels every issue `feedback-workbook`
 * so it is distinguishable from the live feedback-button pipeline (`feedback`).
 *
 * Run from backend/:  npx tsx --env-file=.env scripts/jira-create-backlog.ts
 * Refuses to run twice (checks for existing `feedback-workbook` issues);
 * pass --force to create anyway.
 */

const BASE_URL = 'https://kevinhicksclt.atlassian.net';
const PROJECT_KEY = 'SCRUM';
const LABEL = 'feedback-workbook';

type StoryDef = { summary: string; feedback: string; tab: string };
type EpicDef = { name: string; goal: string; stories: StoryDef[] };

const BACKLOG: EpicDef[] = [
  {
    name: 'Home Dashboard Enhancements',
    goal: 'Feedback on the Home tab: clearer financial definitions, program context, and role-based tailoring.',
    stories: [
      {
        tab: 'Home',
        summary: 'Add hover tooltip explaining Net Benefit calculation',
        feedback:
          'Net Benefit — Maybe a Hover to indicate that Net Benefit = (Cumulative Benefit - Cumulative Cost = Net Benefit',
      },
      {
        tab: 'Home',
        summary: 'Add descriptive subtext column for every Program',
        feedback:
          'Program → Data & AI Enablement — For ANY Program - need to add a sub text COLUMN to indicate what the user is looking at (Ex: for Data & AI Enablement add "foundation data governance and AI productivity tooling across the enterprise" so it is obvious)',
      },
      {
        tab: 'Home',
        summary: 'Decide and document whether the Home view is tailored per role',
        feedback:
          'Question - will the view be tailored to the Role? Or will everyone that goes in see the same set up?',
      },
    ],
  },
  {
    name: 'Value Streams & Organization Navigation',
    goal: 'Feedback on the Value Streams and Organization tabs: map-first navigation, self-service hierarchy edits with approvals, and map consistency.',
    stories: [
      {
        tab: 'Value Streams',
        summary: 'Default Value Streams tab to Map view instead of List',
        feedback:
          'Can you Default to Map instead of List — Visually easier to start with the picture - list is very daunting at 1st',
      },
      {
        tab: 'Organization',
        summary: 'Default Organization tab to Map view instead of List',
        feedback:
          'Can you Default to Map instead of List — Visually easier to start with the picture - list is very daunting at 1st',
      },
      {
        tab: 'Value Streams',
        summary: 'Provide a user flow to amend/add/remove L3, L4, L5 processes and steps',
        feedback:
          'If a user wanted to amend/add/remove an L3, L4, L5 Process or Step - how would they do that?',
      },
      {
        tab: 'Value Streams',
        summary: 'Add approval routing (checks and balances) for process hierarchy edits',
        feedback:
          'Checks and Balances on B9 [amend/add/remove L3-L5] - how is this routed for approvals',
      },
      {
        tab: 'Organization',
        summary: 'Provide a user flow to amend/add/remove Roles',
        feedback: 'If a user wanted to amend/add/remove Roles - how would they do that?',
      },
      {
        tab: 'Organization',
        summary:
          'Reconcile Executive Office presence between Organization map and Value Stream map',
        feedback:
          'Question: Value Stream Map v. Organization Map - why does Organization include the Executive Office teams & Roles, but Value Streams does not? Ex: Executive Teams Process not in the Value Streams?',
      },
    ],
  },
  {
    name: 'Standards Management',
    goal: 'Feedback on the Standards tab: editing flows and department-level rollups.',
    stories: [
      {
        tab: 'Standards',
        summary: 'Provide a user flow to amend/add/remove a Standard',
        feedback: 'If a user wanted to amend/add/remove a Standard, how would they do that?',
      },
      {
        tab: 'Standards',
        summary: 'Default to a drilldown showing the number of Standards by Department',
        feedback: 'Can you Default to the Drilldown to give the # of Standards by Department',
      },
    ],
  },
  {
    name: 'Regulations Experience',
    goal: 'Feedback on the Regulations tab: explain statuses and fields, wire requirements to value streams, and make cards drillable.',
    stories: [
      {
        tab: 'Regulations',
        summary: 'Clarify "Verified" status and the effect of editing Applicability',
        feedback:
          'What does Verified Under Regulations/Federal/FINRA (Fed Securities) mean? Also, I edited #1 (Applicability) to see what it did - not sure what these edits do? How does it roll up or figure in the tool?',
      },
      {
        tab: 'Regulations',
        summary: 'Define the action required per Requirement and its mapping to Value Streams',
        feedback:
          'Under Regulations/Requirements - What needs to be done on each of the Requirements? Do each of these need to be mapped (under Value Streams)?',
      },
      {
        tab: 'Regulations',
        summary:
          'Add hover tooltips for Obligation, Confidence (Baseline/Derived), and Value Stream columns',
        feedback:
          'Under Regulations/Requirements - what does Confidence (Baseline/Derived) mean - may be a hover over Obligation, Confidence and Value Stream may be helpful',
      },
      {
        tab: 'Regulations',
        summary: 'Clarify the purpose of the Coverage tab',
        feedback:
          'Under Regulations/coverage - what is the significance of this tab: Once all the requirements are mapped - is it just a way to monitor the coverage and what those requirements are?',
      },
      {
        tab: 'Regulations',
        summary: 'Explain monitored sources and expose the bulletins on file',
        feedback:
          'Under Regulations, what does monitored sources mean, and where are the 7 bulletins on file?',
      },
      {
        tab: 'Regulations',
        summary: 'Make each Regulations summary card drillable',
        feedback: 'Should be able to drill down when you click on each card',
      },
      {
        tab: 'Regulations',
        summary: 'Surface Compliance Rules (what they are and where they live)',
        feedback: 'What & Where are the Compliance Rules?',
      },
    ],
  },
  {
    name: 'Metrics & AI Adoption Reporting',
    goal: 'Feedback on the Metrics tab: terminology level-set, stage separation, augmented/manual visibility, and drillable cards. Flagged in the 7/2 review as needing a rethink.',
    stories: [
      {
        tab: 'Metrics',
        summary: 'Show AI Augmented % alongside Automated & Discarded at every level',
        feedback:
          'Under Metrics/Stage 2 AI Adoption - Why at the Org Group Level/Roles/Task Category/Deliverable Types/Value Streams - do you only show (Auto & Disc) and not AI Augmented %?',
      },
      {
        tab: 'Metrics',
        summary:
          'Rethink the Metrics section and level-set the Automated/Discarded/Augmented/Manual terminology',
        feedback:
          'As we discussed on 7/2 - Metrics section needs rethought. We need to think about if we use "Automated, Discarded, Augmented, Manual terminology" - how to level set user on what that means',
      },
      {
        tab: 'Metrics',
        summary:
          'Separate Stage 1 Current State Analysis from Stage 2 AI Adoption & Trackable Metrics',
        feedback:
          'Separate Current State Analysis Stage 1 / AI Adoption & Trackable Metrics Stage 2',
      },
      {
        tab: 'Metrics',
        summary: 'Make the Automated/Discarded/Augmented/Manual cards drillable',
        feedback:
          'Be able to drill down when you click on each card for: "Automated, Discarded, Augmented, Manual"',
      },
      {
        tab: 'Metrics',
        summary:
          'Reduce green bars; add drillable Augmented & Manual columns for Org Groups, Roles, Task Categories, Value Streams',
        feedback:
          'Reduce the green bars on the page; Add a column for Aug & Manual - Make each of those percentages drillable: for Org Groups, Roles, Task Categories, Value Streams',
      },
      {
        tab: 'Metrics',
        summary: 'Evaluate removing the Deliverable Types dimension from Metrics',
        feedback:
          'I question we need Deliverable Types - not sure I understand what those/that means',
      },
      {
        tab: 'Metrics',
        summary: 'Redesign the "Adoption by Value Stream" visualization',
        feedback: 'Adoption by Value Stream - not sure I understand this picture',
      },
    ],
  },
  {
    name: 'Work Library: Deliverables, Tasks & Automatable',
    goal: 'Feedback on the Deliverables, Tasks, and Automatable tabs: searchable long lists, hiding empty/N-A columns, and actionable AI set-up.',
    stories: [
      {
        tab: 'Deliverables',
        summary:
          'Improve deliverable search so long lists ("+360 more") are browsable, not memorized',
        feedback:
          'Under the Deliverable Search Feature - (scroll down... After Issue escalations - it says +360 more - type to narrow). How will they be able to memorize 360 more to type to narrow the search. No real other way than to have to scroll',
      },
      {
        tab: 'Deliverables',
        summary: 'Remove the Type dropdown when only one value (Deliverable) exists',
        feedback: 'Why do we need TYPE Drop Down - if there is only Deliverable??',
      },
      {
        tab: 'Deliverables',
        summary: 'Clarify what "Medium" means on a deliverable\'s task list',
        feedback:
          'When you click on the individual Deliverable - it brings up the # of Tasks and description of each - with who is tagged to that task. What does Medium mean??',
      },
      {
        tab: 'Deliverables',
        summary: 'Hide the Role column when it is always empty',
        feedback: 'Do we need the Role Column if nothing shows up there?',
      },
      {
        tab: 'Tasks',
        summary:
          'Improve Tasks search (Task, Deliverable, Process) — same long-list issue as Deliverables',
        feedback:
          'Under Tasks - Search Feature (for Task, Deliverable, Process) - same issue as A37',
      },
      {
        tab: 'Tasks',
        summary:
          'Allow launching AI set-up from the "Needs Set Up/Partial" AI Automatable dropdown',
        feedback:
          'Under Tasks; Column AI Automatable. One dropdown = Needs Set Up/Partial - can what is needed to be set up be launched from here???',
      },
      {
        tab: 'Tasks',
        summary: 'Hide N/A columns (e.g. Standards, Regulations) on the Tasks list',
        feedback: 'For UX - eliminate Columns that are NA (ex: Standards, Regulations)',
      },
      {
        tab: 'Automatable',
        summary: 'Remove redundant Value Stream element if the card already shows it',
        feedback: 'Under Automatable/Value Stream - is this needed if the card shows it already?',
      },
    ],
  },
  {
    name: 'Applications & Third Parties',
    goal: 'Feedback on the Applications and Third Parties tabs: TCO transparency and rollups, third-party catalog semantics.',
    stories: [
      {
        tab: 'Applications',
        summary: 'Document the source and methodology behind TCO/Yr figures',
        feedback: 'How was TCO/Yr - where did that # come from?',
      },
      {
        tab: 'Applications',
        summary: 'Add a Total TCO card that aggregates by Kind or Vendor',
        feedback:
          'Might be nice to have a Card that shows Total TCO by Kind or Vendor... So if you sort on KIND or Vendor, you can see a TCO for all the Core applications (for example)',
      },
      {
        tab: 'Third Parties',
        summary: 'Clarify whether third parties are ABC-specific or a taggable catalog',
        feedback:
          'Are these specific to ABC Insurance Group - or are these 3rd parties that ABC Insurance Group can tag?',
      },
    ],
  },
  {
    name: 'Platform UX & Reliability',
    goal: 'Cross-cutting feedback: in-app guidance, session reliability, and multi-select filters.',
    stories: [
      {
        tab: 'Data Admin',
        summary: 'Add "how to use this tool" guidance to Data Admin',
        feedback:
          'Need more information to describe "how to use this tool" — Purpose of the tool and how to use this tool is not intuitive',
      },
      {
        tab: 'General',
        summary: 'Fix "Failed to Fetch" error that forces sign-out and re-sign-in',
        feedback:
          'At one point I received a "Failed to Fetch" Error - had to go out and then re-sign in',
      },
      {
        tab: 'User Experience',
        summary: 'Support multi-select in filter dropdowns across the app',
        feedback:
          'All the Drop downs are "1 pick" only - can you do drop down so you can choose multiples?',
      },
    ],
  },
  {
    name: 'AI Transformation Readiness',
    goal: 'Strategic notes from the Regulation Screen sheet: human-vs-AI process tagging with validation, and EDI awareness — positioning the tool as a launch pad for transformation.',
    stories: [
      {
        tab: 'Regulation Screen',
        summary:
          'Tag processes as human vs AI-agent work (mapped to Value Streams) with a validation workflow',
        feedback:
          'With this tool, if we are trying to determine what a human needs to do and what an AI agent can do (thus mapped to Value Streams) and then tagged somehow to AI / in which the Processes need validated.',
      },
      {
        tab: 'Regulation Screen',
        summary: 'Flag EDI (Electronic Data Interchange) presence on AI-tagged processes',
        feedback:
          'In addition, for the Processes tagged to AI - we would probably need to know when there is an EDI (Electronic Data Interchange)',
      },
    ],
  },
];

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
const quote = (t: string): AdfNode => ({ type: 'blockquote', content: [p(t)] });
const doc = (content: AdfNode[]) => ({ type: 'doc', version: 1, content });

async function createIssue(fields: Record<string, unknown>): Promise<string> {
  const res = await jira('/rest/api/3/issue', {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
  const body = (await res.json()) as { key?: string };
  if (!body.key) throw new Error('issue create returned no key');
  return body.key;
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

  let storyCount = 0;
  for (const epic of BACKLOG) {
    const epicKey = await createIssue({
      project: { key: PROJECT_KEY },
      issuetype: { name: 'Epic' },
      labels: [LABEL],
      summary: epic.name,
      description: doc([
        p(epic.goal),
        p('Source: documents/Feedback/Transformation Bridge Feedback.xlsx'),
      ]),
    });
    console.log(`EPIC  ${epicKey}  ${epic.name}`);

    for (const story of epic.stories) {
      const storyKey = await createIssue({
        project: { key: PROJECT_KEY },
        issuetype: { name: 'Story' },
        parent: { key: epicKey },
        labels: [LABEL],
        summary: story.summary,
        description: doc([
          h3('Original feedback (verbatim)'),
          quote(story.feedback),
          h3('Source'),
          p(`Tab: ${story.tab} — Transformation Bridge Feedback.xlsx (Questions & Comments)`),
        ]),
      });
      storyCount += 1;
      console.log(`  STORY ${storyKey}  ${story.summary}`);
    }
  }
  console.log(`\nDone: ${BACKLOG.length} epics, ${storyCount} stories.`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
