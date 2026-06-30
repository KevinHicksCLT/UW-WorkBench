// decompose-single-child.ts — eliminate structural one-to-one (single-child)
// relationships in the value-stream ProcessNode tree, scoped to L3/L4 parents.
//
// A clean tree has no L3 (Process) or L4 (Sub-Process) node with exactly one
// child. In practice the seeded `abc-insurance` tree has exactly 3 such L3
// parents, each pointing at a single L4 that owns ≥2 L5 task children. We SPLIT
// each offending L4 by redistributing its existing L5 grandchildren across 2–3
// coherent sibling sub-processes — no new tasks are invented, every L5 keeps all
// its junctions (NodeRole / NodeDeliverable / NodeAppUsage / NodeChecklist /
// TestingTemplate); only its parentId + closure changes.
//
// Approach: RENAME-ONE-KEEP. We rename the existing L4 to group A (keeping its
// own id, code, and any junctions), create the additional sibling L4(s) for the
// remaining groups, and move the group-B/C tasks under them via the closure
// service. Net per L3: 1 child → 2–3 wired children, total ProcessNode grows by
// (groups − 1) new L4s.
//
// Grouping is done by Claude (same model/SDK pattern as
// score-agent-automatability.ts). If Claude is unavailable it falls back to a
// deterministic even split.
//
// Idempotent: an L3 that already has ≥2 children is skipped, so re-running is a
// no-op. Each L3 is processed independently with its mutations ordered so a
// failure cannot leave a half-split parent (the original L4 + tasks remain a
// valid single subtree until every move succeeds).
//
// Run (cwd = backend):
//   npx tsx scripts/decompose-single-child.ts            # split the offenders
//   npx tsx scripts/decompose-single-child.ts --dry-run  # plan only, no writes
//   npx tsx scripts/decompose-single-child.ts --no-ai    # force deterministic split
//
// Also exported as `decomposeSingleChild(prisma, companyId, opts)` so the seed
// orchestrator can fold it in (a single `npm run db:seed` reproduces everything).
import 'dotenv/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '../src/db/prisma.js';
import { processClosure } from '../src/lib/closure.js';

const MODEL = process.env.ADMIN_AI_MODEL ?? process.env.CHATBOT_MODEL ?? 'claude-sonnet-4-6';

type Task = { id: string; displayValue: string };
type Group = { name: string; taskIndices: number[] };

// ── Claude grouping ──────────────────────────────────────────────────────────
let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM = `You partition the lowest-level tasks of a business sub-process into 2 (or at most 3) coherent sub-processes so a parent process area has more than one child. Rules:
- Use 2 groups unless 3 is clearly more natural; with 5 tasks prefer 2.
- Every group must contain at least 2 task indices; never leave a group empty.
- Every task index appears in exactly one group; cover all indices.
- Group names are short noun phrases (3–6 words), specific to the work, Title Case, and DISTINCT from each other and from the parent name. Do not number them.`;

const TOOL: Anthropic.Tool = {
  name: 'submit_groups',
  description: 'Return the sub-process groups partitioning the task indices.',
  input_schema: {
    type: 'object',
    properties: {
      groups: {
        type: 'array',
        minItems: 2,
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'short Title Case sub-process name' },
            taskIndices: { type: 'array', items: { type: 'integer' }, minItems: 2 },
          },
          required: ['name', 'taskIndices'],
        },
      },
    },
    required: ['groups'],
  },
};

function validateGroups(groups: Group[], n: number): Group[] | null {
  if (!Array.isArray(groups) || groups.length < 2 || groups.length > 3) return null;
  const seen = new Set<number>();
  for (const g of groups) {
    if (!g.name?.trim() || !Array.isArray(g.taskIndices) || g.taskIndices.length < 2) return null;
    for (const i of g.taskIndices) {
      if (!Number.isInteger(i) || i < 0 || i >= n || seen.has(i)) return null;
      seen.add(i);
    }
  }
  if (seen.size !== n) return null; // every task covered exactly once
  // de-dupe names defensively
  const names = new Set(groups.map((g) => g.name.trim().toLowerCase()));
  if (names.size !== groups.length) return null;
  return groups.map((g) => ({ name: g.name.trim(), taskIndices: g.taskIndices }));
}

async function groupWithClaude(l3Name: string, l4Name: string, tasks: Task[]): Promise<Group[] | null> {
  const lines = tasks.map((t, i) => `[${i}] ${t.displayValue}`).join('\n');
  const resp = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'submit_groups' },
    messages: [{
      role: 'user',
      content: `Process area (L3): "${l3Name}"\nCurrent single sub-process (L4): "${l4Name}"\nIts ${tasks.length} tasks:\n${lines}\n\nSplit these tasks into 2 (or 3) coherent sub-processes.`,
    }],
  });
  for (const block of resp.content) {
    if (block.type === 'tool_use' && block.name === 'submit_groups') {
      const groups = (block.input as { groups?: Group[] }).groups ?? [];
      return validateGroups(groups, tasks.length);
    }
  }
  return null;
}

// Deterministic even split into 2 groups: first ceil(n/2) → A, rest → B.
function evenSplit(l4Name: string, tasks: Task[]): Group[] {
  const half = Math.ceil(tasks.length / 2);
  return [
    { name: `${l4Name} — Intake & Setup`, taskIndices: tasks.map((_, i) => i).slice(0, half) },
    { name: `${l4Name} — Execution & Closeout`, taskIndices: tasks.map((_, i) => i).slice(half) },
  ];
}

// ── Deliverable re-wire on split (one-per-L4 grain) ──────────────────────────
// When an L4 is split, the new sibling L4 needs its own Deliverable and the tasks
// that moved under it must re-group from the original L4's deliverable to the new
// one. Touches NodeDeliverable, TestingTemplate, and RoleDeliverable so the L4-grain
// invariant (1 Deliverable per L4; NodeDeliverable links L4 node + its task nodes)
// holds after decomposition.
async function rewireDeliverableForSplit(
  prisma: PrismaClient,
  companyId: string,
  { newL4Id, newL4Name, originalL4Id, movedTaskIds }: { newL4Id: string; newL4Name: string; originalL4Id: string; movedTaskIds: string[] },
): Promise<void> {
  // Original L4's deliverable (its self-link from seedMaster).
  const origLink = await prisma.nodeDeliverable.findFirst({
    where: { companyId, processNodeId: originalL4Id },
    select: { deliverableId: true },
  });

  // automatability roll-up for the moved tasks (most common; null if none).
  const movedNodes = movedTaskIds.length
    ? await prisma.processNode.findMany({ where: { id: { in: movedTaskIds } }, select: { id: true, automatability: true } })
    : [];
  const counts = new Map<string, number>();
  for (const n of movedNodes) if (n.automatability) counts.set(n.automatability, (counts.get(n.automatability) ?? 0) + 1);
  const automatability = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;

  const newDeliv = await prisma.deliverable.create({
    data: { companyId, title: newL4Name, automatability },
    select: { id: true },
  });

  // NodeDeliverable: new L4 node self-link + each moved task → new deliverable.
  await prisma.nodeDeliverable.createMany({
    data: [newL4Id, ...movedTaskIds].map((processNodeId) => ({ companyId, processNodeId, deliverableId: newDeliv.id })),
    skipDuplicates: true,
  });
  // Drop the moved tasks' stale links to the ORIGINAL L4 deliverable.
  if (origLink && movedTaskIds.length) {
    await prisma.nodeDeliverable.deleteMany({
      where: { companyId, processNodeId: { in: movedTaskIds }, deliverableId: origLink.deliverableId },
    });
  }

  // TestingTemplate: re-point moved tasks' rows to the new deliverable.
  if (movedTaskIds.length) {
    await prisma.testingTemplate.updateMany({
      where: { taskNodeId: { in: movedTaskIds } },
      data: { deliverableId: newDeliv.id },
    });
  }

  // RoleDeliverable: moved tasks' Owner roles → new deliverable (deduped).
  const owners = movedTaskIds.length
    ? await prisma.nodeRole.findMany({ where: { companyId, processNodeId: { in: movedTaskIds }, role_: 'Owner' }, select: { roleId: true } })
    : [];
  const ownerRoleIds = [...new Set(owners.map((o) => o.roleId))];
  if (ownerRoleIds.length) {
    await prisma.roleDeliverable.createMany({
      data: ownerRoleIds.map((roleId) => ({ companyId, roleId, deliverableId: newDeliv.id, role_: 'Owner' })),
      skipDuplicates: true,
    });
  }
}

// ── Core (exported for the seed orchestrator) ────────────────────────────────
export async function decomposeSingleChild(
  db: PrismaClient,
  companyId: string,
  opts: { dryRun?: boolean; noAi?: boolean } = {},
): Promise<{ acted: number; createdL4s: number; remaining: number }> {
  const DRY = !!opts.dryRun;
  const NO_AI = !!opts.noAi;
  const prisma = db;
  const c = companyId;
  console.log(`Grouping mode: ${NO_AI ? 'deterministic (--no-ai)' : `Claude (${MODEL})`}${DRY ? '  [DRY RUN]' : ''}`);

  const l4LevelType = await prisma.processLevelType.findFirst({ where: { companyId: c, levelNumber: 4 }, select: { id: true } });
  if (!l4LevelType) throw new Error('No L4 (Sub-Process) level type found');

  // Generic find: L3 or L4 parents with exactly one child. (L4-single-child would
  // mean an L4 with a single L5 child — none expected, but handled identically:
  // its single child's grandchildren would be split. We only act on parents whose
  // single child itself has ≥2 children to split.)
  const singles = await prisma.$queryRawUnsafe<{ parentId: string; lvl: number; pname: string }[]>(
    `SELECT p."parentId" AS "parentId", t."levelNumber" AS lvl, pp."displayValue" AS pname
       FROM "ProcessNode" p
       JOIN "ProcessNode" pp ON pp."id" = p."parentId"
       JOIN "ProcessLevelType" t ON t."id" = pp."processLevelTypeId"
      WHERE p."companyId" = $1 AND p."parentId" IS NOT NULL AND t."levelNumber" IN (3, 4)
      GROUP BY p."parentId", t."levelNumber", pp."displayValue"
      HAVING COUNT(*) = 1
      ORDER BY t."levelNumber", pp."displayValue"`, c);

  console.log(`Found ${singles.length} single-child L3/L4 parent(s).\n`);
  if (singles.length === 0) { console.log('Nothing to do — tree already clean.'); return { acted: 0, createdL4s: 0, remaining: 0 }; }

  const totalBefore = await prisma.processNode.count({ where: { companyId: c } });
  let createdL4s = 0;
  let acted = 0;

  for (const s of singles) {
    // Re-read the single child + its task children fresh (idempotency guard).
    const child = await prisma.processNode.findFirst({
      where: { parentId: s.parentId },
      select: { id: true, displayValue: true, sortOrder: true, code: true, processLevelTypeId: true },
    });
    if (!child) continue;
    // If the parent now has ≥2 children, a prior run handled it — skip.
    const siblingCount = await prisma.processNode.count({ where: { parentId: s.parentId } });
    if (siblingCount >= 2) { console.log(`L${s.lvl} "${s.pname}" — already has ${siblingCount} children, skipping.`); continue; }

    const tasks = await prisma.processNode.findMany({
      where: { parentId: child.id },
      select: { id: true, displayValue: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (tasks.length < 2) {
      console.log(`L${s.lvl} "${s.pname}" → "${child.displayValue}" has ${tasks.length} task(s); cannot split, skipping.`);
      continue;
    }

    // Decide groups (Claude → fallback).
    let groups: Group[] | null = null;
    if (!NO_AI) {
      try {
        groups = await groupWithClaude(s.pname, child.displayValue, tasks);
        if (!groups) console.warn(`  Claude returned an invalid partition for "${child.displayValue}"; using even split.`);
      } catch (e) {
        console.warn(`  Claude call failed (${(e as Error).message}); using even split.`);
      }
    }
    if (!groups) groups = evenSplit(child.displayValue, tasks);

    console.log(`L${s.lvl} "${s.pname}" → "${child.displayValue}" (${tasks.length} tasks) splits into ${groups.length}:`);
    groups.forEach((g, gi) => console.log(`   ${gi === 0 ? '[rename]' : '[new]   '} "${g.name}"  (${g.taskIndices.length} tasks)`));

    if (DRY) { acted++; continue; }

    // ── Apply: rename-one-keep ────────────────────────────────────────────────
    // Group A reuses the existing L4 (child) — rename it, then move only the
    // tasks that DON'T belong to A out to fresh sibling L4s. Order matters for
    // crash-safety: create each new sibling (with closure) and move its tasks
    // before touching the next; the original child stays a valid subtree
    // throughout. The rename is last (cosmetic) so a mid-run failure still leaves
    // the original name on the still-valid node.
    const groupA = groups[0];
    const others = groups.slice(1);
    const baseSort = child.sortOrder ?? 0;

    for (let gi = 0; gi < others.length; gi++) {
      const g = others[gi];
      const newL4 = await prisma.processNode.create({
        data: {
          companyId: c,
          processLevelTypeId: l4LevelType.id,
          parentId: s.parentId,
          dbValue: g.name,
          displayValue: g.name,
          isTask: false,
          sortOrder: baseSort + (gi + 1) * 10,
          code: `${child.code ?? child.id}-D${gi + 1}`,
          attributes: { provenance: 'decomposed-1to1', splitFrom: child.id },
        },
        select: { id: true },
      });
      await processClosure.insertNode({ nodeId: newL4.id, parentId: s.parentId });
      createdL4s++;
      const movedTaskIds: string[] = [];
      for (const idx of g.taskIndices) {
        await processClosure.moveSubtree({ nodeId: tasks[idx].id, newParentId: newL4.id });
        movedTaskIds.push(tasks[idx].id);
      }
      // Deliverable grain is one-per-L4: a new L4 needs its own Deliverable, and the
      // tasks that moved here must re-point their grouping from the original L4's
      // deliverable to this new one (NodeDeliverable, RoleDeliverable, TestingTemplate).
      await rewireDeliverableForSplit(prisma, c, {
        newL4Id: newL4.id, newL4Name: g.name, originalL4Id: child.id, movedTaskIds,
      });
    }

    // Rename the surviving original L4 to group A and tag its provenance.
    await prisma.processNode.update({
      where: { id: child.id },
      data: {
        dbValue: groupA.name,
        displayValue: groupA.name,
        attributes: { provenance: 'decomposed-1to1', keptOriginal: true },
      },
    });
    // Keep the original L4's Deliverable title in sync with its new (group A) name.
    {
      const origLink = await prisma.nodeDeliverable.findFirst({
        where: { companyId: c, processNodeId: child.id }, select: { deliverableId: true },
      });
      if (origLink) await prisma.deliverable.update({ where: { id: origLink.deliverableId }, data: { title: groupA.name } });
    }
    // (Group A's tasks already point at child — nothing to move.)
    acted++;
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log(`\nActed on ${acted} parent(s). New L4 nodes created: ${createdL4s}.`);
  if (DRY) { console.log('(dry run — no writes)'); return { acted, createdL4s, remaining: -1 }; }

  const totalAfter = await prisma.processNode.count({ where: { companyId: c } });
  console.log(`ProcessNode total: ${totalBefore} → ${totalAfter} (+${totalAfter - totalBefore})`);

  // Verify: 0 single-child L3/L4 parents remain.
  const remaining = await prisma.$queryRawUnsafe<{ parentId: string; lvl: number }[]>(
    `SELECT p."parentId" AS "parentId", t."levelNumber" AS lvl
       FROM "ProcessNode" p
       JOIN "ProcessNode" pp ON pp."id" = p."parentId"
       JOIN "ProcessLevelType" t ON t."id" = pp."processLevelTypeId"
      WHERE p."companyId" = $1 AND p."parentId" IS NOT NULL AND t."levelNumber" IN (3, 4)
      GROUP BY p."parentId", t."levelNumber"
      HAVING COUNT(*) = 1`, c);
  console.log(`Single-child L3/L4 parents remaining: ${remaining.length} (expect 0).`);

  // Show the resulting child counts for the parents we acted on.
  console.log('\nAfter-state for acted parents:');
  for (const s of singles) {
    const kids = await prisma.processNode.findMany({ where: { parentId: s.parentId }, select: { id: true, displayValue: true }, orderBy: { sortOrder: 'asc' } });
    console.log(`  L${s.lvl} "${s.pname}": ${kids.length} children`);
    for (const k of kids) {
      const tc = await prisma.processNode.count({ where: { parentId: k.id } });
      console.log(`     - "${k.displayValue}" (${tc} tasks)`);
    }
  }

  return { acted, createdL4s, remaining: remaining.length };
}

// ── CLI entry point ──────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const company = await prisma.company.findFirst({ where: { slug: 'abc-insurance' }, select: { id: true, name: true } });
  if (!company) throw new Error('No "abc-insurance" company found');
  console.log(`Company: ${company.name} (${company.id})`);
  await decomposeSingleChild(prisma, company.id, { dryRun: args.includes('--dry-run'), noAi: args.includes('--no-ai') });
  await prisma.$disconnect();
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
