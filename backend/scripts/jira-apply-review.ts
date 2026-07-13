/**
 * Apply the reviewed "what's already built + feedback" decisions.
 *  1. Create the 22 foundation baseline markers (label foundation-complete),
 *     status per the review (F-AUTH → In Progress, rest Done). Idempotent by summary.
 *  2. Create the one genuinely-new story (ADD-1) under Metrics.
 *  3. Update the existing tickets the FB-* items map to (no duplicates created).
 *  4. Dropped FB items (FB-MULTI/FB-TPCAT/FB-EDI) are intentionally skipped.
 *
 * Run from backend/:  npx tsx --env-file=.env scripts/jira-apply-review.ts
 */

const BASE = 'https://kevinhicksclt.atlassian.net';
const PROJECT = 'SCRUM';
const FOUNDATION_LABEL = 'foundation-complete';

type St = 'todo' | 'partial' | 'done';

const FOUNDATION: { epic: string; st: St; t: string; note: string }[] = [
  {
    epic: 'SCRUM-68',
    st: 'done',
    t: 'Monorepo application scaffold (Vite/React 18 + Express/Prisma, ESM, shared zod)',
    note: '27 root-mounted routers, requireAuth+zod+pino, components/ui + Sheet + Inspector; one Vercel project.',
  },
  {
    epic: 'SCRUM-68',
    st: 'done',
    t: 'CI/CD pipeline — husky gates + staged GitHub Actions + Vercel + Neon git-flow',
    note: 'quality→migrate→deploy→smoke; schema auto-promotes, data on [promote-data].',
  },
  {
    epic: 'SCRUM-68',
    st: 'done',
    t: 'In-app feedback widget → AI-triaged, epic-routed Jira pipeline',
    note: 'Header button captures screen+context; LLM triage; auto-routed to epic.',
  },
  {
    epic: 'SCRUM-94',
    st: 'done',
    t: 'erd_v5 generic-typed-graph database (96 models, closures, migrations ledger)',
    note: 'Two spines + junctions, no free-text refs; SPM + RBAC/approvals/feedback families; 10 migrations since 0_baseline.',
  },
  {
    epic: 'SCRUM-94',
    st: 'done',
    t: 'Data Admin screen + populated audit log built & live',
    note: 'Per-tab studio + before→after audit diffs.',
  },
  {
    epic: 'SCRUM-95',
    st: 'partial',
    t: 'Authentication, multi-tenancy & role/attribute-based entitlements',
    note: 'JWT tenant scoping; User Types & Permissions matrix; per-user attributes; API keys & provisioning.',
  },
  {
    epic: 'SCRUM-95',
    st: 'done',
    t: 'User Admin screen built & live',
    note: 'Users, permissions, attributes, API keys.',
  },
  {
    epic: 'SCRUM-25',
    st: 'done',
    t: 'Home dashboard built & live',
    note: 'Customizable widgets — portfolio, value-vs-complexity, RAID rollups, KPI tiles.',
  },
  {
    epic: 'SCRUM-29',
    st: 'done',
    t: 'Value Streams screen (map + list + Inspector) built & live',
    note: 'L1–L5 spine; tabbed Inspector; map edit mode.',
  },
  {
    epic: 'SCRUM-86',
    st: 'done',
    t: 'Organization screen built & live',
    note: 'Org map + list, division/department detail, center-aligned diagram.',
  },
  {
    epic: 'SCRUM-87',
    st: 'done',
    t: 'Roles screen + role profile built & live',
    note: 'Catalog + profile. Manager line tracked separately.',
  },
  {
    epic: 'SCRUM-55',
    st: 'done',
    t: 'Deliverables screen built & live',
    note: 'List with search/columns + task drill-down.',
  },
  {
    epic: 'SCRUM-88',
    st: 'done',
    t: 'Tasks screen built & live',
    note: 'Atomic-task list, search, AI-automatability, inherited standards/regs.',
  },
  {
    epic: 'SCRUM-89',
    st: 'done',
    t: 'Automatable screen built & live',
    note: 'Automatability snapshot, rollups, value/complexity views.',
  },
  {
    epic: 'SCRUM-36',
    st: 'done',
    t: 'Standards screen built & live',
    note: 'Catalog by department/area with Responsible role; area drill-down + agent skills.',
  },
  {
    epic: 'SCRUM-39',
    st: 'done',
    t: 'Regulations screen built & live',
    note: 'Requirements, compliance rules, coverage, monitored sources; per-reg detail.',
  },
  {
    epic: 'SCRUM-64',
    st: 'done',
    t: 'Applications screen + rationalization built & live',
    note: 'App portfolio + rationalization / greenfield-migration workspace.',
  },
  {
    epic: 'SCRUM-90',
    st: 'done',
    t: 'Third-Parties screen built & live',
    note: 'External parties and their interactions.',
  },
  {
    epic: 'SCRUM-47',
    st: 'done',
    t: 'Metrics screen (current-state + AI adoption) built & live',
    note: 'Stage 1 + Stage 2; Automated/Augmented/Manual/Discarded tiles with definitions.',
  },
  {
    epic: 'SCRUM-93',
    st: 'done',
    t: 'Work Library screen built & live',
    note: 'Templates, assignments, chain view, rollups.',
  },
  {
    epic: 'SCRUM-107',
    st: 'done',
    t: 'Portfolio / Programs & Initiatives screens built & live',
    note: 'Programs, workstreams, initiatives, charter, workplan+change log, resources, RAID.',
  },
  {
    epic: 'SCRUM-92',
    st: 'done',
    t: 'Approvals screen built & live',
    note: 'Maker-checker queues with in-tool sign-off; events to audit log.',
  },
];

// Genuinely-new story added in the review UI.
const NEW_STORY = {
  epic: 'SCRUM-47',
  st: 'todo' as St,
  t: 'Rethink the coverage dashboard of percentage automatable',
  note: 'Added in the review UI. Related to the Metrics adoption/coverage visuals (SCRUM-52/54).',
  label: 'review-add',
};

// FB-* decisions → existing tickets. Only entries whose desired status differs
// from the current To Do are transitioned; the rest are already correct.
const UPDATES: { key: string; to: 'In Progress' | 'Done'; from: string }[] = [
  { key: 'SCRUM-32', to: 'In Progress', from: 'FB-VSEDIT (partial)' },
  { key: 'SCRUM-33', to: 'In Progress', from: 'FB-VSAPPR (partial)' },
  { key: 'SCRUM-46', to: 'Done', from: 'FB-REGRULES (done)' },
  { key: 'SCRUM-51', to: 'In Progress', from: 'FB-METDRILL (partial)' },
  { key: 'SCRUM-66', to: 'In Progress', from: 'FB-TCO (partial)' },
  { key: 'SCRUM-169', to: 'Done', from: 'FB-REGTRACE (done)' },
];
// No-ops (already To Do, decision was todo): SCRUM-34, 37, 28, 172, 73, and
// SCRUM-49/50 already Done (FB-METRETHINK). Dropped: FB-MULTI, FB-TPCAT, FB-EDI.

const auth =
  'Basic ' +
  Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');

async function jira(path: string, init?: RequestInit): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < 6; i += 1) {
    try {
      const r = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...init?.headers,
        },
      });
      if (!r.ok) {
        const b = await r.text().catch(() => '');
        throw new Error(`HTTP ${r.status} ${init?.method ?? 'GET'} ${path}: ${b.slice(0, 300)}`);
      }
      return r;
    } catch (e) {
      last = e;
      await new Promise((x) => setTimeout(x, 5000));
    }
  }
  throw last;
}

const P = (t: string) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });
const docOf = (c: object[]) => ({ type: 'doc', version: 1, content: c });

async function transitionTo(key: string, target: string): Promise<boolean> {
  const find = async () => {
    const r = await jira(`/rest/api/3/issue/${key}/transitions`);
    const b = (await r.json()) as { transitions: { id: string; to: { name: string } }[] };
    return b.transitions.find((t) => t.to.name.toLowerCase() === target.toLowerCase())?.id ?? null;
  };
  let id = await find();
  if (!id && target === 'Done') {
    const ipId = await (async () => {
      const r = await jira(`/rest/api/3/issue/${key}/transitions`);
      const b = (await r.json()) as { transitions: { id: string; to: { name: string } }[] };
      return b.transitions.find((t) => t.to.name.toLowerCase() === 'in progress')?.id ?? null;
    })();
    if (ipId) {
      await jira(`/rest/api/3/issue/${key}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ transition: { id: ipId } }),
      });
      id = await find();
    }
  }
  if (!id) {
    console.warn(`  ! no "${target}" transition for ${key}`);
    return false;
  }
  await jira(`/rest/api/3/issue/${key}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id } }),
  });
  return true;
}

async function createStory(
  epic: string,
  title: string,
  label: string,
  note: string,
  st: St,
): Promise<string> {
  const r = await jira('/rest/api/3/issue', {
    method: 'POST',
    body: JSON.stringify({
      fields: {
        project: { key: PROJECT },
        issuetype: { name: 'Story' },
        parent: { key: epic },
        labels: [label],
        summary: title,
        description: docOf([
          P(note),
          P('Recorded from the "what\'s already built" review, July 2026.'),
        ]),
      },
    }),
  });
  const key = ((await r.json()) as { key: string }).key;
  if (st === 'partial') await transitionTo(key, 'In Progress');
  else if (st === 'done') await transitionTo(key, 'Done');
  return key;
}

async function existingSummaries(label: string): Promise<Set<string>> {
  const r = await jira('/rest/api/3/search/jql', {
    method: 'POST',
    body: JSON.stringify({
      jql: `project = ${PROJECT} AND labels = ${label}`,
      maxResults: 100,
      fields: ['summary'],
    }),
  });
  const b = (await r.json()) as { issues?: { fields: { summary: string } }[] };
  return new Set((b.issues ?? []).map((i) => i.fields.summary));
}

async function main(): Promise<void> {
  // 1) foundation markers (idempotent by summary)
  const have = await existingSummaries(FOUNDATION_LABEL);
  if (have.size) console.log(`(${have.size} foundation markers already present — filling gaps)`);
  let f = 0;
  for (const it of FOUNDATION) {
    if (have.has(it.t)) continue;
    const key = await createStory(it.epic, it.t, FOUNDATION_LABEL, it.note, it.st);
    f += 1;
    console.log(`FOUND ${key} [${it.st.toUpperCase()}] → ${it.epic}  ${it.t.slice(0, 54)}`);
  }

  // 2) new story
  const addHave = await existingSummaries(NEW_STORY.label);
  if (!addHave.has(NEW_STORY.t)) {
    const key = await createStory(
      NEW_STORY.epic,
      NEW_STORY.t,
      NEW_STORY.label,
      NEW_STORY.note,
      NEW_STORY.st,
    );
    console.log(`ADDED ${key} [TODO] → ${NEW_STORY.epic}  ${NEW_STORY.t}`);
  } else {
    console.log('ADDED skipped — already present');
  }

  // 3) FB updates on existing tickets
  for (const u of UPDATES) {
    const ok = await transitionTo(u.key, u.to);
    console.log(`UPDATE ${u.key} → ${u.to} ${ok ? '' : '(failed)'}  [${u.from}]`);
  }

  console.log(
    `\nDone: ${f} foundation markers created, 6 existing tickets updated, 3 dropped FB items skipped.`,
  );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
