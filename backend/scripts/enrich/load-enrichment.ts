// Idempotent loader for task enrichment (SWE&D gold-standard rollout).
// Consumes scripts/output/enrichment-<slug>.json (authored per area) and
// reconciles each task's associations to the single-source-of-truth junctions.
// Everything downstream (Roles/Apps/Checklist/Testing/Governance tabs, Inspector)
// derives from these rows, so this one write updates every tab.
//
//   npx tsx --env-file=.env scripts/enrich/load-enrichment.ts scripts/output/enrichment-data-engineering-pipelines.json [--dry-run]
//
// Per task the spec is DESIRED-STATE for roles/apps (reconciled: adds missing,
// removes stale) and ADDITIVE for standards/regs/checklist/testing (never
// deletes human-curated links; only creates what is absent). Refuses unknown
// catalog ids and reports every skip.
import { readFileSync } from 'node:fs';
import { prisma } from '../../src/db/prisma.js';

type RoleLink = { roleId: string; rel: 'Owner' | 'Participant' };
type AppLink = { appId: string; use?: 'performed' | 'memorialized' };
type RegLink = { regId: string; rel?: string };
type Testing = {
  system?: string;
  location?: string;
  checkType?: 'presence' | 'absence';
  expected: string;
};
type TaskSpec = {
  taskId: string;
  roles: RoleLink[];
  apps: AppLink[];
  standards: string[];
  regs: RegLink[];
  checklistGeneric: string[];
  checklistSpecific: string[];
  testing: Testing[];
};

const dryRun = process.argv.includes('--dry-run');
const file = process.argv.find((a) => a.endsWith('.json'));
if (!file) throw new Error('usage: load-enrichment.ts <enrichment json> [--dry-run]');

let created = 0,
  removed = 0,
  skipped = 0;
const skip = (m: string) => {
  skipped++;
  console.warn('SKIP', m);
};

async function main() {
  const spec = JSON.parse(readFileSync(file!, 'utf8')) as {
    area: string;
    companyId: string;
    tasks: TaskSpec[];
  };
  const companyId = spec.companyId;

  // preload valid catalog ids
  const [roleIds, appIds, stdIds, regIds] = await Promise.all([
    prisma.role.findMany({ where: { companyId }, select: { id: true } }),
    prisma.application.findMany({ where: { companyId }, select: { id: true } }),
    prisma.standard.findMany({ where: { companyId }, select: { id: true } }),
    prisma.regulatoryRequirement.findMany({ where: { companyId }, select: { id: true } }),
  ]);
  const validRole = new Set(roleIds.map((r) => r.id));
  const validApp = new Set(appIds.map((a) => a.id));
  const validStd = new Set(stdIds.map((s) => s.id));
  const validReg = new Set(regIds.map((r) => r.id));

  // shared generic checklist items are deduped company-wide by exact text so we
  // never create a second row for text that already exists (tasks already carry
  // 7 shared generic items from earlier seeding, in other Checklists).
  const genericPool = new Map<string, string>(); // text -> checklistItemId (first seen)
  const allItems = await prisma.checklistItem.findMany({
    where: { checklist: { companyId } },
    select: { id: true, text: true },
    orderBy: { createdAt: 'asc' },
  });
  for (const it of allItems) if (!genericPool.has(it.text)) genericPool.set(it.text, it.id);
  const genericChecklist = await prisma.checklist.findFirst({
    where: { companyId, name: 'Generic Task Checklist' },
  });
  let genericChecklistId = genericChecklist?.id ?? null;

  for (const t of spec.tasks) {
    const task = await prisma.processNode.findUnique({
      where: { id: t.taskId },
      select: { id: true, isTask: true },
    });
    if (!task || !task.isTask) {
      skip(`task ${t.taskId} missing/not-a-task`);
      continue;
    }

    // ── ROLES (desired-state reconcile) ──
    const wantRoles = t.roles.filter(
      (r) => validRole.has(r.roleId) || (skip(`role ${r.roleId} on ${t.taskId}`), false),
    );
    const curRoles = await prisma.nodeRole.findMany({
      where: { processNodeId: t.taskId },
      select: { id: true, roleId: true, role_: true },
    });
    const wantKey = new Set(wantRoles.map((r) => `${r.roleId}|${r.rel}`));
    for (const c of curRoles) {
      if (!wantKey.has(`${c.roleId}|${c.role_}`)) {
        if (!dryRun) await prisma.nodeRole.delete({ where: { id: c.id } });
        removed++;
      }
    }
    for (const r of wantRoles) {
      if (!curRoles.some((c) => c.roleId === r.roleId && c.role_ === r.rel)) {
        if (!dryRun)
          await prisma.nodeRole.create({
            data: { companyId, processNodeId: t.taskId, roleId: r.roleId, role_: r.rel },
          });
        created++;
      }
    }

    // ── APPS (desired-state reconcile) ──
    const wantApps = t.apps.filter(
      (a) => validApp.has(a.appId) || (skip(`app ${a.appId} on ${t.taskId}`), false),
    );
    const curApps = await prisma.nodeAppUsage.findMany({
      where: { processNodeId: t.taskId },
      select: { id: true, applicationId: true, usageType: true },
    });
    const wantAppKey = new Set(wantApps.map((a) => `${a.appId}|${a.use ?? 'performed'}`));
    for (const c of curApps) {
      if (!wantAppKey.has(`${c.applicationId}|${c.usageType}`)) {
        if (!dryRun) await prisma.nodeAppUsage.delete({ where: { id: c.id } });
        removed++;
      }
    }
    for (const a of wantApps) {
      const use = a.use ?? 'performed';
      if (!curApps.some((c) => c.applicationId === a.appId && c.usageType === use)) {
        if (!dryRun)
          await prisma.nodeAppUsage.create({
            data: { companyId, processNodeId: t.taskId, applicationId: a.appId, usageType: use },
          });
        created++;
      }
    }

    // ── STANDARDS (additive, task-level NodeStandard) ──
    for (const sid of t.standards) {
      if (!validStd.has(sid)) {
        skip(`standard ${sid} on ${t.taskId}`);
        continue;
      }
      const exists = await prisma.nodeStandard.findUnique({
        where: { processNodeId_standardId: { processNodeId: t.taskId, standardId: sid } },
      });
      if (!exists) {
        if (!dryRun)
          await prisma.nodeStandard.create({
            data: { companyId, processNodeId: t.taskId, standardId: sid },
          });
        created++;
      }
    }

    // ── REGS (additive, task-level NodeRegulation) ──
    for (const rl of t.regs) {
      if (!validReg.has(rl.regId)) {
        skip(`reg ${rl.regId} on ${t.taskId}`);
        continue;
      }
      const exists = await prisma.nodeRegulation.findUnique({
        where: { processNodeId_regId: { processNodeId: t.taskId, regId: rl.regId } },
      });
      if (!exists) {
        if (!dryRun)
          await prisma.nodeRegulation.create({
            data: {
              companyId,
              processNodeId: t.taskId,
              regId: rl.regId,
              relationship: rl.rel ?? 'GOVERNS',
            },
          });
        created++;
      }
    }

    // ── CHECKLIST ──
    // generic: dedupe by text into a shared "Generic Task Checklist"; link via NodeChecklist.
    for (const text of t.checklistGeneric) {
      let itemId = genericPool.get(text);
      if (!itemId) {
        if (!genericChecklistId) {
          if (!dryRun) {
            const cl = await prisma.checklist.create({
              data: { companyId, name: 'Generic Task Checklist' },
            });
            genericChecklistId = cl.id;
          } else genericChecklistId = 'DRY';
        }
        if (!dryRun) {
          const ci = await prisma.checklistItem.create({
            data: { checklistId: genericChecklistId!, text },
          });
          itemId = ci.id;
          genericPool.set(text, itemId);
        } else {
          itemId = 'DRY';
        }
      }
      await linkChecklist(t.taskId, itemId!, companyId);
    }
    // specific: a per-area checklist of task-unique items.
    if (t.checklistSpecific.length) {
      const clName = `Task-Specific — ${spec.area}`;
      let cl = await prisma.checklist.findFirst({ where: { companyId, name: clName } });
      if (!cl && !dryRun) cl = await prisma.checklist.create({ data: { companyId, name: clName } });
      for (const text of t.checklistSpecific) {
        // task-unique: reuse an existing identical link if already present for this task
        const existingLink = await prisma.nodeChecklist.findFirst({
          where: { processNodeId: t.taskId, checklistItem: { text } },
          select: { id: true },
        });
        if (existingLink) continue;
        if (dryRun) {
          created++;
          continue;
        }
        const ci = await prisma.checklistItem.create({ data: { checklistId: cl!.id, text } });
        await prisma.nodeChecklist.create({
          data: { companyId, processNodeId: t.taskId, checklistItemId: ci.id },
        });
        created++;
      }
    }

    // ── TESTING (additive; needs a deliverable to hang on) ──
    if (t.testing.length) {
      const nd = await prisma.nodeDeliverable.findFirst({
        where: { processNodeId: t.taskId },
        select: { deliverableId: true },
      });
      if (!nd) {
        skip(`no deliverable for testing on ${t.taskId}`);
      } else {
        for (const tt of t.testing) {
          const dup = await prisma.testingTemplate.findFirst({
            where: { taskNodeId: t.taskId, expected: tt.expected },
          });
          if (dup) continue;
          if (!dryRun)
            await prisma.testingTemplate.create({
              data: {
                deliverableId: nd.deliverableId,
                taskNodeId: t.taskId,
                system: tt.system ?? null,
                location: tt.location ?? null,
                checkType: tt.checkType ?? 'presence',
                expected: tt.expected,
              },
            });
          created++;
        }
      }
    }
  }
  console.log(
    `${dryRun ? '[DRY] ' : ''}created=${created} removed=${removed} skipped=${skipped} tasks=${spec.tasks.length}`,
  );
}

async function linkChecklist(taskId: string, itemId: string, companyId: string) {
  if (dryRun || itemId === 'DRY') {
    created++;
    return;
  }
  const exists = await prisma.nodeChecklist.findUnique({
    where: { processNodeId_checklistItemId: { processNodeId: taskId, checklistItemId: itemId } },
  });
  if (!exists) {
    await prisma.nodeChecklist.create({
      data: { companyId, processNodeId: taskId, checklistItemId: itemId },
    });
    created++;
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
