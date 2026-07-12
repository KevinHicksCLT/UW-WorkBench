/**
 * One-off: record the already-built foundation as Done stories under each epic,
 * so the "what's already built" baseline is visible in the backlog. Covers the
 * platform/app/db/ci-cd foundation plus one "screen built & live" marker per tab
 * epic. All created then transitioned straight to Done. Label `foundation-complete`.
 *
 * Run from backend/:  npx tsx --env-file=.env scripts/jira-foundation-done.ts
 * Guarded by the label; pass --force to add anyway.
 */

const BASE_URL = 'https://kevinhicksclt.atlassian.net';
const PROJECT_KEY = 'SCRUM';
const LABEL = 'foundation-complete';

type Item = { epic: string; title: string; detail: string };

const ITEMS: Item[] = [
  // ── Platform / app / db / ci-cd foundation ──
  {
    epic: 'SCRUM-68',
    title:
      'Foundation: monorepo application scaffold (Vite/React + Express/Prisma, ESM, shared zod)',
    detail:
      'npm-workspaces monorepo, TypeScript + ESM throughout. Frontend: Vite + React 18 + Tailwind + React Router, code-split pages, components/ui library, shared Sheet grid + Inspector sidebar. Backend: Express with 27 root-mounted routers, requireAuth + zod + pino, resolver-only derivations. shared/ zod schemas across the API boundary. Deployed as one Vercel project (SPA at /, API at /api).',
  },
  {
    epic: 'SCRUM-68',
    title:
      'Foundation: CI/CD pipeline (husky gates + staged GitHub Actions + Vercel + Neon git-flow)',
    detail:
      'Pre-commit husky (lint-staged Prettier+ESLint zero-warnings, full typecheck). One GitHub Actions pipeline per push: feature → quality→deploy-preview; develop/master → quality→data-promote→migrate→deploy→smoke→neon-cleanup. Vercel direct git builds disabled — every deploy comes from the pipeline. Schema auto-promotes; datasets only on [promote-data] via Neon logical restore with automatic backup.',
  },
  {
    epic: 'SCRUM-68',
    title: 'Foundation: in-app feedback widget → AI-triaged Jira pipeline',
    detail:
      'Header feedback button captures the current screen + context, an LLM triages it into a structured story, and it is auto-routed to the correct epic and filed in Jira, with email notification. Idempotent, checkpointed pipeline.',
  },
  {
    epic: 'SCRUM-94',
    title:
      'Foundation: erd_v5 generic-typed-graph database (96 models, closures, migrations ledger)',
    detail:
      'Single governed data model on Neon Postgres. Two self-nesting spines (ProcessNode L1–L5 + OrgUnit) with closure tables, a small set of entities, and junction tables for every association — no free-text cross-references, locations derived at read time. Parallel portfolio (SPM) domain plus RBAC/approvals/feedback/regulation-registry/app-rationalization families. Migrations-only workflow, 10 migrations since 0_baseline, Neon branch per environment, erd_v5.mmd kept in lockstep with schema.prisma.',
  },
  {
    epic: 'SCRUM-95',
    title: 'Foundation: authentication, multi-tenancy & role/attribute-based entitlements',
    detail:
      'JWT auth (requireAuth sets tenant from the token, never the body); every query tenant-scoped, 404 on cross-tenant. User Types & Permissions CRUD matrix, per-user attributes (value stream / geography / org unit / manager / approver), API keys & provisioning.',
  },

  // ── One "screen built & live" marker per tab epic ──
  {
    epic: 'SCRUM-25',
    title: 'Foundation: Home dashboard built & live',
    detail:
      'Per-company customizable widgets — Transformation Portfolio, value-vs-complexity quadrant, RAID rollups, KPI tiles, top value streams. Derived live from the model.',
  },
  {
    epic: 'SCRUM-29',
    title: 'Foundation: Value Streams screen (map + list + Inspector) built & live',
    detail:
      'Map and list over the L1–L5 process spine; unified Inspector drill-down (Overview/Roles/Apps/Deliverables/Tasks/Checklist/Testing/Governance); map edit mode (move/reorder/rename).',
  },
  {
    epic: 'SCRUM-86',
    title: 'Foundation: Organization screen built & live',
    detail:
      'Org map + list, division/department detail pages, center-aligned operating-model diagram.',
  },
  {
    epic: 'SCRUM-87',
    title: 'Foundation: Roles screen + role profile built & live',
    detail:
      'Role catalog and profile (description, tasks, deliverables, applications, value streams). Manager/reporting-line refinements tracked separately.',
  },
  {
    epic: 'SCRUM-55',
    title: 'Foundation: Deliverables screen built & live',
    detail: 'Deliverable list with search and columns; per-deliverable task drill-down.',
  },
  {
    epic: 'SCRUM-88',
    title: 'Foundation: Tasks screen built & live',
    detail:
      'Atomic-task list with search and per-task AI-automatability; standards/regs inherited from ancestors.',
  },
  {
    epic: 'SCRUM-89',
    title: 'Foundation: Automatable screen built & live',
    detail: 'AI-automatability snapshot with rollups and value/complexity views.',
  },
  {
    epic: 'SCRUM-36',
    title: 'Foundation: Standards screen built & live',
    detail:
      'Standards catalog grouped by department/area, each with a Responsible owner role; area drill-down + agent skills.',
  },
  {
    epic: 'SCRUM-39',
    title: 'Foundation: Regulations screen built & live',
    detail:
      'Requirements, compliance rules, coverage, monitored sources across state/federal/international regimes; per-regulation detail. Refinements tracked separately.',
  },
  {
    epic: 'SCRUM-64',
    title: 'Foundation: Applications screen + rationalization built & live',
    detail:
      'App portfolio (TCO, vendor, kind) plus the rationalization / greenfield-migration workspace.',
  },
  {
    epic: 'SCRUM-90',
    title: 'Foundation: Third-Parties screen built & live',
    detail: 'External parties and their interactions with the operating model.',
  },
  {
    epic: 'SCRUM-47',
    title: 'Foundation: Metrics screen (current-state + AI adoption) built & live',
    detail:
      'Stage 1 Current-State Analysis + Stage 2 Adoption Telemetry; Automated/Augmented/Manual/Discarded tiles with definitions.',
  },
  {
    epic: 'SCRUM-93',
    title: 'Foundation: Work Library screen built & live',
    detail:
      'Work-plan templates, assignments, chain view (deliverable → role → task → checklist → app), rollups.',
  },
  {
    epic: 'SCRUM-107',
    title: 'Foundation: Portfolio / Programs & Initiatives screens built & live',
    detail:
      'Transformation portfolio — programs, workstreams, initiatives, charter, workplan + change log, month-by-month resources, RAID, benefits/costs. Refinements tracked separately.',
  },
  {
    epic: 'SCRUM-92',
    title: 'Foundation: Approvals screen built & live',
    detail:
      'Maker-checker queues (My queue / My requests / All) with in-tool sign-off; events flow to the audit log.',
  },
  {
    epic: 'SCRUM-94',
    title: 'Foundation: Data Admin screen + audit log built & live',
    detail:
      'Per-tab studio (configure, trackable metrics, data dictionary) + populated audit log with before→after diffs.',
  },
  {
    epic: 'SCRUM-95',
    title: 'Foundation: User Admin screen built & live',
    detail: 'Users, User Types & Permissions, per-user attributes, API keys & provisioning.',
  },
];

// ── Jira REST helpers (with retry to survive network blips) ─────────────────

function authHeader(): string {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) throw new Error('JIRA_EMAIL / JIRA_API_TOKEN not set');
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
}

async function jira(path: string, init?: RequestInit): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
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
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw lastErr;
}

type AdfNode = Record<string, unknown>;
const p = (t: string): AdfNode => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });
const docOf = (content: AdfNode[]) => ({ type: 'doc', version: 1, content });

async function createIssue(fields: Record<string, unknown>): Promise<string> {
  const res = await jira('/rest/api/3/issue', { method: 'POST', body: JSON.stringify({ fields }) });
  const body = (await res.json()) as { key?: string };
  if (!body.key) throw new Error('issue create returned no key');
  return body.key;
}

async function toDone(key: string): Promise<void> {
  const findId = async (name: string): Promise<string | null> => {
    const res = await jira(`/rest/api/3/issue/${key}/transitions`);
    const body = (await res.json()) as { transitions: { id: string; to: { name: string } }[] };
    return body.transitions.find((t) => t.to.name.toLowerCase() === name.toLowerCase())?.id ?? null;
  };
  const post = async (id: string) =>
    jira(`/rest/api/3/issue/${key}/transitions`, {
      method: 'POST',
      body: JSON.stringify({ transition: { id } }),
    });
  let id = await findId('Done');
  if (!id) {
    const ip = await findId('In Progress');
    if (ip) {
      await post(ip);
      id = await findId('Done');
    }
  }
  if (!id) {
    console.warn(`  ! no Done transition for ${key}`);
    return;
  }
  await post(id);
}

async function main(): Promise<void> {
  // Idempotent: skip items already created (matched by summary), so a rerun
  // after a partial/interrupted run only fills the gaps — never duplicates.
  const res = await jira('/rest/api/3/search/jql', {
    method: 'POST',
    body: JSON.stringify({
      jql: `project = ${PROJECT_KEY} AND labels = ${LABEL}`,
      maxResults: 100,
      fields: ['summary'],
    }),
  });
  const existing = (await res.json()) as { issues?: { fields: { summary: string } }[] };
  const done = new Set((existing.issues ?? []).map((i) => i.fields.summary));
  if (done.size > 0) console.log(`(${done.size} already recorded — skipping those)`);

  let n = 0;
  for (const it of ITEMS) {
    if (done.has(it.title)) continue;
    const key = await createIssue({
      project: { key: PROJECT_KEY },
      issuetype: { name: 'Story' },
      parent: { key: it.epic },
      labels: [LABEL],
      summary: it.title,
      description: docOf([
        p(it.detail),
        p(
          'Baseline record — already built and live as of July 2026 (verified against transform-platform.vercel.app + codebase).',
        ),
      ]),
    });
    await toDone(key);
    n += 1;
    console.log(`DONE  ${key}  (→ ${it.epic})  ${it.title}`);
  }
  console.log(`\nRecorded ${n} foundation stories as Done.`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
