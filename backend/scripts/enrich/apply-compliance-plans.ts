/**
 * Apply authored compliance-item work plans (generic template answers + atomic
 * checklist/testing steps) from JSON packs in backend/data/compliance-plans/.
 *
 * Idempotent replay: template assignments are set to exactly the pack's list,
 * generic answers are upserted per (item, templateKey), and the item's custom
 * step rows are deleted and rewritten from the pack.
 *
 *   npx tsx --env-file=.env scripts/enrich/apply-compliance-plans.ts [pack.json …]
 *   (no args → every *.json in backend/data/compliance-plans/)
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../src/db/prisma.js';

const PACK_DIR = path.resolve(process.cwd(), 'data/compliance-plans');

type Step = {
  step: string;
  value?: string;
  role?: string;
  app?: string;
  deliverable?: string;
};
type GenericAnswer = { value?: string; role?: string; app?: string; deliverable?: string };
type ItemPlan = {
  itemCode: string;
  templates: string[];
  generic: Record<string, GenericAnswer>;
  checklist: Step[];
  testing: Step[];
};
type Pack = { items: ItemPlan[] };

async function main() {
  const args = process.argv.slice(2);
  const files = args.length
    ? args.map((a) => (path.isAbsolute(a) ? a : path.resolve(PACK_DIR, a)))
    : (await readdir(PACK_DIR))
        .filter((f) => f.endsWith('.json'))
        .map((f) => path.join(PACK_DIR, f));

  // Reference caches — plan values bind to real Role/Application/Deliverable rows
  // by exact name; a miss is a hard error so packs can never point at nothing.
  const roles = new Map<string, string>();
  const apps = new Map<string, string>();
  const dels = new Map<string, string>();
  for (const r of await prisma.role.findMany({ select: { id: true, displayValue: true } }))
    roles.set(r.displayValue.toLowerCase(), r.id);
  for (const a of await prisma.application.findMany({ select: { id: true, name: true } }))
    apps.set(a.name.toLowerCase(), a.id);
  for (const d of await prisma.deliverable.findMany({ select: { id: true, title: true } }))
    dels.set(d.title.toLowerCase(), d.id);

  const templates = await prisma.workTemplate.findMany({
    include: { keys: { orderBy: { sortOrder: 'asc' } } },
  });
  const templateByName = new Map(templates.map((t) => [t.name.toLowerCase(), t]));

  const errors: string[] = [];
  const refs = (s: Step | GenericAnswer, where: string) => {
    const out: { roleId?: string; applicationId?: string; deliverableId?: string } = {};
    if (s.role) {
      const id = roles.get(s.role.toLowerCase());
      if (!id) errors.push(`${where}: unknown role "${s.role}"`);
      out.roleId = id;
    }
    if (s.app) {
      const id = apps.get(s.app.toLowerCase());
      if (!id) errors.push(`${where}: unknown application "${s.app}"`);
      out.applicationId = id;
    }
    if (s.deliverable) {
      const id = dels.get(s.deliverable.toLowerCase());
      if (!id) errors.push(`${where}: unknown deliverable "${s.deliverable}"`);
      out.deliverableId = id;
    }
    return out;
  };

  let itemsDone = 0;
  let genericDone = 0;
  let stepsDone = 0;

  for (const file of files) {
    const pack = JSON.parse(await readFile(file, 'utf8')) as Pack;
    for (const plan of pack.items) {
      const item = await prisma.complianceItem.findFirst({
        where: { itemCode: plan.itemCode },
        select: { id: true, companyId: true },
      });
      if (!item) {
        errors.push(`unknown compliance item ${plan.itemCode}`);
        continue;
      }

      // 1 — template assignments (exact set)
      const tpl = plan.templates.map((n) => {
        const t = templateByName.get(n.toLowerCase());
        if (!t) errors.push(`${plan.itemCode}: unknown template "${n}"`);
        return t;
      });
      const keep = tpl.filter(Boolean).map((t) => t!.id);
      await prisma.complianceItemWorkTemplate.deleteMany({
        where: { complianceItemId: item.id, templateId: { notIn: keep } },
      });
      await prisma.complianceItemWorkTemplate.createMany({
        data: keep.map((templateId) => ({
          companyId: item.companyId,
          complianceItemId: item.id,
          templateId,
        })),
        skipDuplicates: true,
      });

      // 2 — generic template-key answers
      const keyByText = new Map<string, string>();
      for (const t of tpl.filter(Boolean))
        for (const k of t!.keys) keyByText.set(k.key.toLowerCase(), k.id);
      for (const [keyText, ans] of Object.entries(plan.generic)) {
        const keyId = keyByText.get(keyText.toLowerCase());
        if (!keyId) {
          errors.push(`${plan.itemCode}: no assigned template key "${keyText}"`);
          continue;
        }
        const data = {
          value: ans.value ?? null,
          roleId: null as string | null,
          applicationId: null as string | null,
          deliverableId: null as string | null,
          ...refs(ans, `${plan.itemCode}/${keyText}`),
        };
        const existing = await prisma.complianceItemTemplateAnswer.findFirst({
          where: { complianceItemId: item.id, templateKeyId: keyId },
          select: { id: true },
        });
        if (existing)
          await prisma.complianceItemTemplateAnswer.update({ where: { id: existing.id }, data });
        else
          await prisma.complianceItemTemplateAnswer.create({
            data: {
              companyId: item.companyId,
              complianceItemId: item.id,
              templateKeyId: keyId,
              ...data,
            },
          });
        genericDone++;
      }

      // 3 — atomic custom steps (rewritten wholesale so replay is clean)
      await prisma.complianceItemTemplateAnswer.deleteMany({
        where: { complianceItemId: item.id, templateKeyId: null },
      });
      const rows = [
        ...plan.checklist.map((s, i) => ({ s, kind: 'CHECKLIST', sortOrder: i })),
        ...plan.testing.map((s, i) => ({ s, kind: 'TEST', sortOrder: i })),
      ];
      for (const { s, kind, sortOrder } of rows) {
        await prisma.complianceItemTemplateAnswer.create({
          data: {
            companyId: item.companyId,
            complianceItemId: item.id,
            customKey: s.step,
            kind,
            value: s.value ?? null,
            sortOrder,
            ...refs(s, `${plan.itemCode}/${kind} step ${sortOrder + 1}`),
          },
        });
        stepsDone++;
      }
      itemsDone++;
    }
  }

  console.log(`items=${itemsDone} genericAnswers=${genericDone} steps=${stepsDone}`);
  if (errors.length) {
    console.log(`\n${errors.length} problems:`);
    for (const e of errors) console.log(`  ! ${e}`);
    process.exitCode = 1;
  }
}

main().finally(() => prisma.$disconnect());
