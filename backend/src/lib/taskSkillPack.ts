// Task agent-skill packs. A task's plan (checklist + testing steps, generic and
// specific, plus its tied standards/regulations and their evidence steps) is the
// raw material for a self-contained "agent skill" — a SKILL.md an autonomous
// agent can follow to DO and VERIFY the task. This module turns a TaskPlan into
// the LLM input digest and calls Claude once (forced-tool structured output) to
// author the pack. The result is persisted as a SkillFile row (skill =
// taskSkillSlug(id), path = SKILL.md) and pointed to by ProcessNode.agentSkill,
// so it is generated once, then editable and preserved (see routes/work-library/
// skill.ts). Mirrors the Standards skill system (lib/skillPacks.ts) but task-
// scoped and stored rather than derived on read.
import Anthropic from '@anthropic-ai/sdk';
import type { TaskPlan, TiedPlanItem, PlanRow } from './workPlan.js';

// Opus for authoring quality, matching the feedback pipeline default. Override
// with SKILL_AUTHOR_MODEL / CHATBOT_MODEL if a cheaper tier is preferred.
const MODEL = process.env.SKILL_AUTHOR_MODEL ?? process.env.CHATBOT_MODEL ?? 'claude-opus-4-8';

export const TASK_SKILL_FILE = 'SKILL.md';

/** Stable, collision-free pack slug for a task node. */
export function taskSkillSlug(nodeId: string): string {
  return `task-${nodeId}`;
}

export type TaskSkillMeta = {
  name: string;
  path: string;
  description: string | null;
  owner: string | null;
};

// ── Input digest ───────────────────────────────────────────────────────────

function rowLines(rows: PlanRow[]): string[] {
  if (!rows.length) return ['  (none)'];
  return rows.map((r) => `  - ${r.key}${r.value ? ` → ${r.value}` : ''}`);
}

function tiedLines(items: TiedPlanItem[], kind: 'standard' | 'regulation'): string[] {
  if (!items.length) return [`  (no ${kind}s tied to this task)`];
  const out: string[] = [];
  for (const it of items) {
    out.push(`  • ${it.name}${it.source ? ` [${it.source}]` : ''}`);
    if (it.checklist.length) {
      out.push('    Implement (checklist):');
      out.push(...it.checklist.map((r) => `      - ${r.key}${r.value ? ` → ${r.value}` : ''}`));
    }
    if (it.testing.length) {
      out.push('    Verify (testing):');
      out.push(...it.testing.map((r) => `      - ${r.key}${r.value ? ` → ${r.value}` : ''}`));
    }
  }
  return out;
}

/** Assemble the plan into the exact digest the author prompt consumes. */
export function buildTaskSkillDigest(meta: TaskSkillMeta, plan: TaskPlan): string {
  const genChecklist = plan.checklist.filter((r) => r.generic);
  const spcChecklist = plan.checklist.filter((r) => !r.generic);
  const genTesting = plan.testing.filter((r) => r.generic);
  const spcTesting = plan.testing.filter((r) => !r.generic);
  return [
    `TASK: ${meta.name}`,
    `LOCATION: ${meta.path || '(unscoped)'}`,
    meta.owner ? `OWNER ROLE: ${meta.owner}` : null,
    meta.description ? `DEFINITION OF DONE: ${meta.description}` : null,
    '',
    'GENERIC CHECKLIST (shared pattern steps):',
    ...rowLines(genChecklist),
    '',
    'SPECIFIC CHECKLIST (steps unique to this task):',
    ...rowLines(spcChecklist),
    '',
    'GENERIC TESTING (shared verification pattern):',
    ...rowLines(genTesting),
    '',
    'SPECIFIC TESTING (verification unique to this task):',
    ...rowLines(spcTesting),
    '',
    'ASSIGNED STANDARDS (must comply; implement + verify steps below):',
    ...tiedLines(plan.standards, 'standard'),
    '',
    'ASSIGNED REGULATIONS (must comply; implement + verify steps below):',
    ...tiedLines(plan.regulations, 'regulation'),
  ]
    .filter((l) => l !== null)
    .join('\n');
}

// ── Author call ──────────────────────────────────────────────────────────────

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw Object.assign(
      new Error('Skill generation is not configured (ANTHROPIC_API_KEY missing)'),
      { status: 503 },
    );
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const AUTHOR_TOOL: Anthropic.Tool = {
  name: 'author_skill',
  description: 'Return the finished SKILL.md for the task agent skill.',
  input_schema: {
    type: 'object',
    properties: {
      skillMd: {
        type: 'string',
        description:
          'The complete SKILL.md file as Markdown. Must open with YAML frontmatter ' +
          '(--- name: ... description: ... ---) then the skill body.',
      },
    },
    required: ['skillMd'],
  },
};

function buildAuthorPrompt(digest: string): string {
  return [
    'You are authoring an "agent skill" — a self-contained SKILL.md that an',
    'autonomous software agent loads to correctly PERFORM and VERIFY one atomic',
    'task in an insurance/enterprise operating model. Ground every instruction in',
    'the task plan below; do not invent steps that contradict it, but you may add',
    'brief connective guidance so the procedure reads coherently.',
    '',
    'Write the SKILL.md with this structure:',
    '1. YAML frontmatter: `name` (kebab-case), `description` (one line: when an',
    '   agent should use this skill — start with a trigger verb).',
    '2. `## Purpose` — one short paragraph: what "done" means for this task.',
    '3. `## Procedure` — an ordered checklist merging the generic + specific',
    '   checklist steps into the real execution order. Fold each tied',
    "   standard's / regulation's implement steps in where they apply, and name",
    '   the standard/regulation inline so compliance is traceable.',
    '4. `## Verification` — how to confirm the task is complete and compliant:',
    '   merge generic + specific testing and every tied implement/verify step.',
    '5. `## Governance` — bullet the assigned standards and regulations this task',
    '   must satisfy (name + source). Omit the section if none are tied.',
    '',
    'Be concrete and terse. Prefer imperative steps. No preamble outside the',
    'frontmatter+sections. Output only via the author_skill tool.',
    '',
    '--- TASK PLAN ---',
    digest,
  ].join('\n');
}

/** One structured-output call → the pack's SKILL.md markdown. */
export async function authorTaskSkill(meta: TaskSkillMeta, plan: TaskPlan): Promise<string> {
  const digest = buildTaskSkillDigest(meta, plan);
  const response = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 4000,
    tools: [AUTHOR_TOOL],
    tool_choice: { type: 'tool', name: 'author_skill' },
    messages: [{ role: 'user', content: buildAuthorPrompt(digest) }],
  });
  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'author_skill',
  );
  if (!block) throw new Error('Skill generation returned no structured output');
  const skillMd = (block.input as { skillMd?: unknown }).skillMd;
  if (typeof skillMd !== 'string' || !skillMd.trim()) {
    throw new Error('Skill generation returned an empty SKILL.md');
  }
  return skillMd;
}
