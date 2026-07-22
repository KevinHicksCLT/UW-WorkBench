// Idempotent loader for Work Library PLANS (NodeTemplateAnswer) — the surface the
// Work tab / PlanBlock renders. Brings tasks to the SWE&D gold standard: fills the
// two default templates' generic keys (Core evidence checklist + Expected evidence
// + SOR tracing) AND the item-specific custom steps (paired checklist + test
// procedures, "By the <actor>: 1) … Done when/Pass when …").
//
//   npx tsx --env-file=.env scripts/enrich/load-workplan.ts scripts/output/workplan-<slug>.json [--dry-run]
//
// ROLE generic keys resolve to the task's OWNER NodeRole and the APPLICATION key
// to its primary NodeAppUsage (single source of truth — never author-supplied
// ids). TEXT generic values + the step procedures come from the authored JSON.
// Generic answers are upserted; custom step rows are replaced (delete+insert).
import { readFileSync } from 'node:fs';
import { prisma } from '../../src/db/prisma.js';

type Step = { n: number; title: string; actor: string; sop: string[]; verify: string[] };
type TaskWP = { taskId: string; verifier?: string; generic: Record<string, string>; steps: Step[] };

const dryRun = process.argv.includes('--dry-run');
const file = process.argv.find((a) => a.endsWith('.json'));
if (!file) throw new Error('usage: load-workplan.ts <workplan json> [--dry-run]');

const numbered = (lines: string[]) =>
  lines.map((ln, i) => (i === lines.length - 1 ? ln : `${i + 1}) ${ln}`)).join('\n');

let genUpsert = 0,
  custDel = 0,
  custIns = 0,
  linkIns = 0,
  skipped = 0,
  tasks = 0;
const skip = (m: string) => {
  skipped++;
  console.warn('SKIP', m);
};

async function main() {
  const spec = JSON.parse(readFileSync(file!, 'utf8')) as { area: string; tasks: TaskWP[] };
  if (!spec.tasks.length) {
    console.log('no tasks');
    return;
  }

  const anyNode = await prisma.processNode.findUnique({
    where: { id: spec.tasks[0].taskId },
    select: { companyId: true },
  });
  if (!anyNode) throw new Error(`unknown task ${spec.tasks[0].taskId}`);
  const companyId = anyNode.companyId;

  // The two seeded default templates (always applied) + their keys.
  const defaults = await prisma.workTemplate.findMany({
    where: { companyId, isDefault: true },
    select: { id: true, kind: true, keys: { select: { id: true, key: true, valueKind: true } } },
  });
  const ckTpl = defaults.find((t) => t.kind === 'CHECKLIST');
  const tsTpl = defaults.find((t) => t.kind === 'TEST');
  if (!ckTpl || !tsTpl) throw new Error('default CHECKLIST/TEST templates not found');
  const defaultTemplateIds = [ckTpl.id, tsTpl.id];
  const allKeys = [...ckTpl.keys, ...tsTpl.keys]; // {id,key,valueKind}

  for (const t of spec.tasks) {
    const node = await prisma.processNode.findUnique({
      where: { id: t.taskId },
      select: { id: true, isTask: true },
    });
    if (!node || !node.isTask) {
      skip(`task ${t.taskId} missing/not-a-task`);
      continue;
    }
    tasks++;

    // Owner + primary app from the (already de-bloated) junctions.
    const ownerRole = await prisma.nodeRole.findFirst({
      where: { processNodeId: t.taskId, role_: 'Owner' },
      select: { roleId: true },
    });
    const primaryApp = await prisma.nodeAppUsage.findFirst({
      where: { processNodeId: t.taskId },
      orderBy: { id: 'asc' },
      select: { applicationId: true },
    });

    // Ensure the two default templates are linked (so keys render).
    for (const templateId of defaultTemplateIds) {
      const exists = await prisma.nodeWorkTemplate.findUnique({
        where: { processNodeId_templateId: { processNodeId: t.taskId, templateId } },
      });
      if (!exists) {
        if (!dryRun)
          await prisma.nodeWorkTemplate.create({
            data: { companyId, processNodeId: t.taskId, templateId },
          });
        linkIns++;
      }
    }

    // Generic key answers.
    for (const k of allKeys) {
      let data: {
        value?: string | null;
        roleId?: string | null;
        applicationId?: string | null;
      } | null = null;
      if (k.valueKind === 'ROLE') {
        if (ownerRole) data = { roleId: ownerRole.roleId, value: null };
        else {
          skip(`no owner for ROLE key "${k.key}" on ${t.taskId}`);
          continue;
        }
      } else if (k.valueKind === 'APPLICATION') {
        if (primaryApp) data = { applicationId: primaryApp.applicationId, value: null };
        else continue; // no app → leave blank
      } else {
        const v = t.generic?.[k.key];
        if (!v || !v.trim()) {
          skip(`no TEXT value for "${k.key}" on ${t.taskId}`);
          continue;
        }
        data = { value: v.trim() };
      }
      if (dryRun) {
        genUpsert++;
        continue;
      }
      await prisma.nodeTemplateAnswer.upsert({
        where: { processNodeId_templateKeyId: { processNodeId: t.taskId, templateKeyId: k.id } },
        create: { companyId, processNodeId: t.taskId, templateKeyId: k.id, ...data },
        update: { ...data, suppressed: false },
      });
      genUpsert++;
    }

    // Custom step rows (replace).
    const verifier = t.verifier?.trim();
    const rows: {
      companyId: string;
      processNodeId: string;
      customKey: string;
      kind: string;
      value: string;
      sortOrder: number;
    }[] = [];
    for (const s of t.steps ?? []) {
      if (!s.sop?.length || !s.verify?.length || !s.actor?.trim() || !s.title?.trim()) {
        skip(`bad step ${s.n} on ${t.taskId}`);
        continue;
      }
      rows.push({
        companyId,
        processNodeId: t.taskId,
        customKey: `${s.n}. ${s.title.trim()}`,
        kind: 'CHECKLIST',
        value: `By the ${s.actor}:\n${numbered(s.sop)}`,
        sortOrder: s.n,
      });
      rows.push({
        companyId,
        processNodeId: t.taskId,
        customKey: `${s.n}. Verify: ${s.title.trim()}`,
        kind: 'TEST',
        value: `By the ${verifier || s.actor}:\n${numbered(s.verify)}`,
        sortOrder: s.n,
      });
    }
    if (!dryRun) {
      const del = await prisma.nodeTemplateAnswer.deleteMany({
        where: { processNodeId: t.taskId, templateKeyId: null },
      });
      custDel += del.count;
      if (rows.length) {
        const ins = await prisma.nodeTemplateAnswer.createMany({ data: rows });
        custIns += ins.count;
      }
    } else {
      custIns += rows.length;
    }
  }
  console.log(
    `${dryRun ? '[DRY] ' : ''}tasks=${tasks} genKeys=${genUpsert} customIns=${custIns} customDel=${custDel} links+=${linkIns} skipped=${skipped}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
