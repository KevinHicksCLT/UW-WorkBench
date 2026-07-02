// Apply the Software Engineering & Delivery enrichment decisions
// (scripts/sed-enrichment/dec-*.json, produced by research subagents):
//   answers  → NodeTemplateAnswer values (generic keys by templateKeyId upsert,
//              custom keys by answerId update). Entity-typed values resolve to
//              Application/Role FKs; "newApplication" creates the catalog row
//              (kind SystemOfRecord) exactly like the UI "add new".
//   standards/regulations → NodeStandard/NodeRegulation ties on the task +
//              NodeStandardEvidence/NodeRegulationEvidence steps WITH values.
// Idempotent: answer upserts overwrite; ties skipDuplicates; evidence deduped
// by (node, entity, kind, step).
// Run: npx tsx --env-file=.env scripts/apply-sed-enrichment.ts
import { readdirSync, readFileSync } from 'node:fs';
import { prisma } from '../src/db/prisma.js';

type Step = { step: string; value?: string | null };
type Tie = { standardId?: string; regId?: string; checklist?: Step[]; testing?: Step[] };
type AnswerDec = { templateKeyId?: string; answerId?: string; value?: string | null; applicationId?: string | null; roleId?: string | null; newApplication?: string };
type TaskDec = { id: string; answers?: AnswerDec[]; standards?: Tie[]; regulations?: Tie[] };

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error('no company');
  const companyId = company.id;

  const dir = 'scripts/sed-enrichment';
  const files = readdirSync(dir).filter((f) => /^dec-\d+\.json$/.test(f)).sort();
  console.log('decision files:', files.join(', '));

  const [keys, roles, apps, stds, regs] = await Promise.all([
    prisma.workTemplateKey.findMany({ select: { id: true } }),
    prisma.role.findMany({ where: { companyId }, select: { id: true } }),
    prisma.application.findMany({ where: { companyId }, select: { id: true, name: true } }),
    prisma.standard.findMany({ where: { companyId }, select: { id: true } }),
    prisma.regulatoryRequirement.findMany({ where: { companyId }, select: { id: true } }),
  ]);
  const keyIds = new Set(keys.map((x) => x.id));
  const roleIds = new Set(roles.map((x) => x.id));
  const appByName = new Map(apps.map((a) => [a.name.toLowerCase(), a.id]));
  const appIds = new Set(apps.map((x) => x.id));
  const stdIds = new Set(stds.map((x) => x.id));
  const regIds = new Set(regs.map((x) => x.id));

  const stats = { tasks: 0, generic: 0, custom: 0, newApps: 0, stdTies: 0, regTies: 0, stdSteps: 0, regSteps: 0, skipped: 0 };

  for (const file of files) {
    const dec = JSON.parse(readFileSync(`${dir}/${file}`, 'utf-8')) as { tasks: TaskDec[] };
    for (const t of dec.tasks) {
      const node = await prisma.processNode.findFirst({ where: { id: t.id, companyId, isTask: true }, select: { id: true } });
      if (!node) { stats.skipped++; continue; }
      stats.tasks++;

      for (const a of t.answers ?? []) {
        let applicationId = a.applicationId && appIds.has(a.applicationId) ? a.applicationId : null;
        if (!applicationId && a.newApplication) {
          const name = a.newApplication.trim();
          const existing = appByName.get(name.toLowerCase());
          if (existing) applicationId = existing;
          else {
            const created = await prisma.application.create({ data: { companyId, name, kind: 'SystemOfRecord', illustrative: false } });
            appByName.set(name.toLowerCase(), created.id);
            appIds.add(created.id);
            applicationId = created.id;
            stats.newApps++;
          }
        }
        const roleId = a.roleId && roleIds.has(a.roleId) ? a.roleId : null;
        const data = {
          value: a.value ?? null,
          applicationId,
          roleId,
        };
        if (a.templateKeyId && keyIds.has(a.templateKeyId)) {
          await prisma.nodeTemplateAnswer.upsert({
            where: { processNodeId_templateKeyId: { processNodeId: node.id, templateKeyId: a.templateKeyId } },
            update: data,
            create: { companyId, processNodeId: node.id, templateKeyId: a.templateKeyId, ...data },
          });
          stats.generic++;
        } else if (a.answerId) {
          const upd = await prisma.nodeTemplateAnswer.updateMany({
            where: { id: a.answerId, processNodeId: node.id },
            data,
          });
          if (upd.count) stats.custom++;
          else stats.skipped++;
        } else {
          stats.skipped++;
        }
      }

      for (const tie of t.standards ?? []) {
        if (!tie.standardId || !stdIds.has(tie.standardId)) { stats.skipped++; continue; }
        await prisma.nodeStandard.upsert({
          where: { processNodeId_standardId: { processNodeId: node.id, standardId: tie.standardId } },
          update: { excluded: false },
          create: { companyId, processNodeId: node.id, standardId: tie.standardId },
        });
        stats.stdTies++;
        const existing = await prisma.nodeStandardEvidence.findMany({
          where: { processNodeId: node.id, standardId: tie.standardId },
          select: { kind: true, step: true },
        });
        const seen = new Set(existing.map((e) => `${e.kind}|${e.step}`));
        const rows = [
          ...(tie.checklist ?? []).map((s, i) => ({ kind: 'CHECKLIST', step: s.step, value: s.value ?? null, sortOrder: i })),
          ...(tie.testing ?? []).map((s, i) => ({ kind: 'TEST', step: s.step, value: s.value ?? null, sortOrder: i })),
        ].filter((r) => r.step && !seen.has(`${r.kind}|${r.step}`));
        if (rows.length) {
          await prisma.nodeStandardEvidence.createMany({
            data: rows.map((r) => ({ companyId, processNodeId: node.id, standardId: tie.standardId!, ...r })),
          });
          stats.stdSteps += rows.length;
        }
      }

      for (const tie of t.regulations ?? []) {
        if (!tie.regId || !regIds.has(tie.regId)) { stats.skipped++; continue; }
        await prisma.nodeRegulation.upsert({
          where: { processNodeId_regId: { processNodeId: node.id, regId: tie.regId } },
          update: { excluded: false },
          create: { companyId, processNodeId: node.id, regId: tie.regId },
        });
        stats.regTies++;
        const existing = await prisma.nodeRegulationEvidence.findMany({
          where: { processNodeId: node.id, regId: tie.regId },
          select: { kind: true, step: true },
        });
        const seen = new Set(existing.map((e) => `${e.kind}|${e.step}`));
        const rows = [
          ...(tie.checklist ?? []).map((s, i) => ({ kind: 'CHECKLIST', step: s.step, value: s.value ?? null, sortOrder: i })),
          ...(tie.testing ?? []).map((s, i) => ({ kind: 'TEST', step: s.step, value: s.value ?? null, sortOrder: i })),
        ].filter((r) => r.step && !seen.has(`${r.kind}|${r.step}`));
        if (rows.length) {
          await prisma.nodeRegulationEvidence.createMany({
            data: rows.map((r) => ({ companyId, processNodeId: node.id, regId: tie.regId!, ...r })),
          });
          stats.regSteps += rows.length;
        }
      }
    }
  }
  console.log('applied:', stats);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
