import type { PlanRow } from './workPlan.js';

// AAA (Actor · Action · Application) read-model for a task's sub-tasks.
//
// Sub-tasks live as CUSTOM NodeTemplateAnswer rows whose text follows the
// authoring convention:
//
//   key   "3. Set the MoSCoW priority on every requirement in Confluence"
//   value "By the Business Analyst:
//          1) Open the spec in Confluence and click Edit
//          2) Set the MoSCoW column ...
//          Done when no requirement lacks a MoSCoW value"
//
// with a paired verification row keyed "3. Verify: …" whose value ends in
// "Pass when …". This module DERIVES the structure on read (no schema change,
// no data rewrite): actor from the "By the <role>:" line, action from the key,
// numbered steps, the Done-when definition of done, the Pass-when check folded
// into it, and the application + artifact ("the spec in Confluence" →
// artifact "spec", app "Confluence") matched against the task's linked apps.
// Rows that don't parse fall through untouched so nothing is ever hidden.
//
// This is the playbook/template layer: at run time an agent binds the
// specifics (which epic, which page) and executes the steps — the parse keeps
// every element it needs (actor to impersonate, app to open, artifact to
// produce, DoD to self-verify against).

export interface AaaVerify {
  actor: string | null;
  steps: string[];
  passWhen: string | null;
}

export interface AaaSubTask {
  n: number;
  /** The action — the sub-task key minus its number. */
  action: string;
  /** The actor — who performs it ("By the <actor>:"). */
  actor: string | null;
  steps: string[];
  /** Definition of done ("Done when …"). */
  doneWhen: string | null;
  /** Linked application names referenced by the action/steps. */
  apps: string[];
  /** Per-app artifact chips, e.g. ["document → Microsoft Word", "spec → Confluence"];
   *  falls back to the bare app name when no artifact phrase is found. */
  artifacts: string[];
  /** Paired "N. Verify:" row, folded into the DoD area. */
  verify: AaaVerify | null;
  defined: boolean;
}

const NUM_KEY = /^(\d+)\. (.+)$/;
const VERIFY_KEY = /^(\d+)\. Verify: (.+)$/i;

interface ParsedBody {
  actor: string | null;
  steps: string[];
  doneWhen: string | null;
  passWhen: string | null;
}

function parseBody(value: string | null): ParsedBody {
  const out: ParsedBody = { actor: null, steps: [], doneWhen: null, passWhen: null };
  if (!value) return out;
  for (const raw of value.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const by = line.match(/^By the ([^:]+):?$/i);
    if (by) {
      out.actor = by[1].trim();
      continue;
    }
    if (/^\d+\)/.test(line)) {
      out.steps.push(line.replace(/^\d+\)\s*/, '').trim());
      continue;
    }
    const done = line.match(/^Done when (.+)$/i);
    if (done) {
      out.doneWhen = done[1].trim();
      continue;
    }
    const pass = line.match(/^Pass when (.+)$/i);
    if (pass) {
      out.passWhen = pass[1].trim();
      continue;
    }
    // Unrecognized line: treat as a step so no instruction is lost.
    out.steps.push(line);
  }
  return out;
}

/** "Open the spec in Confluence …" → the artifact ("spec") worked in the app.
 *  Capped at three words so action-title phrases don't swallow the sentence. */
function findArtifact(text: string, app: string): string | null {
  const safeApp = app.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = text.match(
    new RegExp(`(?:the|a|an) ((?:[\\w-]+ ){0,2}[\\w-]+) (?:in|on|into) ${safeApp}`, 'i'),
  );
  return m ? m[1].trim() : null;
}

/**
 * Split a task's custom checklist/testing rows into structured AAA sub-tasks
 * (checklist row N + "N. Verify:" testing row folded together) and the
 * leftover rows that don't follow the convention.
 */
export function parseAaaSubTasks(
  checklist: PlanRow[],
  testing: PlanRow[],
  appNames: string[],
): { subTasks: AaaSubTask[]; checklistRest: PlanRow[]; testingRest: PlanRow[] } {
  const subTasks: AaaSubTask[] = [];
  const checklistRest: PlanRow[] = [];
  const testingRest: PlanRow[] = [];

  // Verification rows by number — consumed when their sibling action matches.
  const verifyByN = new Map<number, { row: PlanRow; body: ParsedBody }>();
  const plainTests: PlanRow[] = [];
  for (const row of testing) {
    const m = row.generic ? null : row.key.match(VERIFY_KEY);
    if (m) verifyByN.set(Number(m[1]), { row, body: parseBody(row.value) });
    else plainTests.push(row);
  }

  for (const row of checklist) {
    const m = row.generic ? null : row.key.match(NUM_KEY);
    if (!m) {
      checklistRest.push(row);
      continue;
    }
    const n = Number(m[1]);
    const action = m[2].trim();
    const body = parseBody(row.value);
    const text = `${action}\n${body.steps.join('\n')}`;
    const apps = appNames.filter((a) => new RegExp(`\\b${a}\\b`, 'i').test(text));
    // Steps carry the concrete artifact ("Open the spec in Confluence");
    // action titles state the outcome — prefer the former. One chip per app so
    // an authoring-tool → container path reads whole ("document → Word",
    // "page → Confluence").
    const artifacts = apps.map((a) => {
      const art = findArtifact(body.steps.join('\n'), a) ?? findArtifact(action, a);
      return art ? `${art} → ${a}` : a;
    });
    const paired = verifyByN.get(n);
    if (paired) verifyByN.delete(n);
    subTasks.push({
      n,
      action,
      actor: body.actor,
      steps: body.steps,
      // Verification rows promoted to sub-tasks state "Pass when …" — that IS
      // their definition of done.
      doneWhen: body.doneWhen ?? body.passWhen,
      apps,
      artifacts,
      verify: paired
        ? {
            actor: paired.body.actor,
            steps: paired.body.steps,
            passWhen: paired.body.passWhen,
          }
        : null,
      defined: row.defined,
    });
  }

  // Verify rows whose action row didn't parse stay visible as plain testing.
  testingRest.push(...plainTests, ...[...verifyByN.values()].map((v) => v.row));
  subTasks.sort((a, b) => a.n - b.n);
  return { subTasks, checklistRest, testingRest };
}
