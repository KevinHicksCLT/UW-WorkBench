// enrich-grouping-skills.ts — HYBRID step for FB-57. The grounded generator
// (generate-grouping-skills.ts) builds every grouping pack's structure + the
// data-driven reference/phase/audit files. This pass has Claude rewrite each
// pack's SKILL.md into bespoke, domain-specific prose (operating principle,
// scope gate, four-gate narrative) — grounded in that grouping's real controls,
// not a template. ~one model call per pack.
//
// Idempotent: skips packs whose SKILL.md already carries the <!-- enriched:v1 -->
// marker unless --force. Test a slice first with --limit / --area.
//   npx tsx scripts/enrich-grouping-skills.ts --limit 9 --area Actuarial
//   npx tsx scripts/enrich-grouping-skills.ts            # all packs (gaps only)
//   npx tsx scripts/enrich-grouping-skills.ts --force
import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../src/db/prisma.js';

const SKILLS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../standards/skills');
const MODEL = process.env.SKILL_AUTHOR_MODEL ?? process.env.ADMIN_AI_MODEL ?? process.env.CHATBOT_MODEL ?? 'claude-sonnet-4-6';
const MARKER = '<!-- enriched:v1 -->';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, d = '') => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const FORCE = flag('force');
const LIMIT = Number(opt('limit', '0')) || 0;
const AREA = opt('area', '');
const CONCURRENCY = Number(opt('concurrency', '5')) || 5;

const slug = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const skillName = (cat: string) => `${slug(cat)}-sdlc-compliance`;

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

const SYSTEM = `You are a senior insurance compliance + software-delivery architect authoring a Claude Agent Skill file (SKILL.md) for an insurer's internal platform. You write precise, domain-specific, non-generic prose — every sentence reflects THIS grouping's controls, not a template. You match the house format exactly and never invent controls beyond those given.`;

function userPrompt(p: { name: string; departments: string; category: string; refSlug: string; controls: { name: string; description: string; owner: string | null; buildRun: string | null; test: string | null; evidence: string | null; citation: string | null; area: string }[] }) {
  const controlBlock = p.controls.map((c, i) =>
    `${i + 1}. ${c.name} [area: ${c.area}]${c.owner ? ` [owner: ${c.owner}]` : ''}${c.buildRun ? ` [${c.buildRun}]` : ''}${c.citation ? ` [cite: ${c.citation}]` : ''}\n   ${c.description || ''}`).join('\n');
  return `Write the complete SKILL.md for the agent skill **${p.name}**.

Context:
- Standards area(s) this grouping spans: ${p.departments}
- Grouping (category): ${p.category}
- These ${p.controls.length} controls are the ENTIRE scope — do not invent others:
${controlBlock}

Companion files already exist; reference them by these EXACT paths:
- references/requirements-phase.md, references/design-phase.md, references/development-phase.md, references/testing-phase.md
- references/${p.refSlug}-reference.md (source obligations)
- references/${p.refSlug}-quick-reference.md (one-line cheat sheet)
- references/audit-evidence-map.md (control → evidence crosswalk)

Output ONLY the SKILL.md markdown (no code fences). Required structure, matching our house SDLC-skill format:
1. YAML frontmatter delimited by --- with:
   name: ${p.name}
   description: > (a 5–9 line, specific paragraph: what the skill enforces, the concrete triggers/systems in THIS grouping that should invoke it — name real controls — and a "when unsure, run the scope gate" closer).
2. # <Category> Across the SDLC — <short bespoke subtitle>
3. ## What this skill does — 1 short paragraph specific to ${p.category} (note it spans ${p.departments}); point to the reference files.
4. ## Operating principle (read once, apply always) — a single sharp > blockquote insight unique to this grouping, then a line naming the "<Category> Compliance Record".
5. ## STEP 0 — Scope gate (always run first) — 4–6 numbered, domain-specific questions that decide whether these controls are in scope (reference real control names). End with the two "If no / If unsure" bullets.
6. ## The four phase gates — a short intro line, then FOUR subsections "### 1. Requirements → references/requirements-phase.md" etc. Each lists 2–4 bullet checks drawn from the real controls and ends with a bold **Evidence:** line naming the artifacts produced that phase.
7. ## Run / operate handoff (not build gates) — 1–3 lines on the run-phase controls (those marked [Run]) that aren't build gates.
8. ## How to use this skill in practice — 3 bullets.
9. ## Boundaries — 2–3 lines: this is engineering guidance + evidence, the owning roles make the substantive calls.

Keep it ~90–130 lines, tight and concrete. Use the control names verbatim where natural.`;
}

async function authorSkillMd(p: Parameters<typeof userPrompt>[0]): Promise<string> {
  const resp = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 2600,
    system: SYSTEM,
    messages: [{ role: 'user', content: userPrompt(p) }],
  });
  let md = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('').trim();
  md = md.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim(); // strip stray fences
  // Force the frontmatter name to the exact slug (the agent identity).
  md = md.replace(/^---\n([\s\S]*?)\n---/, (_m, fm: string) => `---\n${fm.replace(/^name:.*$/m, `name: ${p.name}`)}\n---`);
  return `${md}\n\n${MARKER}\n`;
}

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, name: true } });
  if (!company) throw new Error('No company');
  const companyId = company.id;

  const nonAreas = await prisma.standard.findMany({
    where: { companyId, isArea: false },
    select: { id: true, name: true, description: true, department: true, category: true, parentId: true, testProcedure: true, evidence: true, ownerLabel: true, buildRun: true, regCitation: true },
  });
  const hasChildren = new Set(nonAreas.map((n) => n.parentId).filter((p): p is string => !!p));
  let leaves = nonAreas.filter((n) => !hasChildren.has(n.id) && n.department && n.category);
  if (AREA) leaves = leaves.filter((l) => l.department === AREA); // partial: only this area's controls

  // Group by CATEGORY (matches the category-only skill packs).
  const byCat = new Map<string, typeof leaves>();
  for (const l of leaves) {
    if (!byCat.has(l.category!)) byCat.set(l.category!, []);
    byCat.get(l.category!)!.push(l);
  }

  let groupings = [...byCat.entries()].map(([category, controls]) => ({ category, controls }));
  // Skip already-enriched unless --force.
  groupings = groupings.filter((g) => {
    const f = resolve(SKILLS_ROOT, skillName(g.category), 'SKILL.md');
    if (!existsSync(f)) return false;
    return FORCE || !readFileSync(f, 'utf8').includes(MARKER);
  });
  if (LIMIT) groupings = groupings.slice(0, LIMIT);

  console.log(`${company.name}: enriching ${groupings.length} category SKILL.md packs with ${MODEL}…`);
  let done = 0, failed = 0;
  for (let i = 0; i < groupings.length; i += CONCURRENCY) {
    const batch = groupings.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (g) => {
      const name = skillName(g.category);
      const refSlug = slug(g.category);
      const departments = [...new Set(g.controls.map((c) => c.department))].sort().join(', ');
      try {
        const md = await authorSkillMd({
          name, departments, category: g.category, refSlug,
          controls: g.controls.map((c) => ({ name: c.name, description: c.description ?? '', owner: c.ownerLabel, buildRun: c.buildRun, test: c.testProcedure, evidence: c.evidence, citation: c.regCitation, area: c.department! })),
        });
        writeFileSync(resolve(SKILLS_ROOT, name, 'SKILL.md'), md, 'utf8');
        done++;
        console.log(`  ✓ ${name} (${g.controls.length} controls)`);
      } catch (e) {
        failed++;
        console.error(`  ✗ ${name}: ${(e as Error).message}`);
      }
    }));
  }
  console.log(`Done: ${done} enriched, ${failed} failed.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
