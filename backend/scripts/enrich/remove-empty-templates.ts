// Remove empty NON-DEFAULT WorkTemplate assignments from Technology-domain tasks:
// a NodeWorkTemplate link is dropped when its template is not a seeded default
// AND none of that template's keys have a value on the task (so the block renders
// as all-blank "Enter value / Select or add…" rows). The two default templates
// (Core evidence checklist, Expected evidence + SOR tracing) are never touched,
// and non-default templates that DO carry values on a task are kept.
// Backs up deleted link rows. Dry-run by default; --apply mutates.
//   npx tsx --env-file=.env scripts/enrich/remove-empty-templates.ts [--apply]
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { prisma } from '../../src/db/prisma.js';

const APPLY = process.argv.includes('--apply');
const di = process.argv.indexOf('--domain');
const DOMAIN = di >= 0 ? process.argv[di + 1] : 'Technology';

async function main() {
  const tech = await prisma.processNode.findFirstOrThrow({
    where: { displayValue: DOMAIN, processLevelType: { levelNumber: 1 } },
    select: { id: true },
  });
  const desc = await prisma.processNodeClosure.findMany({
    where: { ancestorId: tech.id },
    select: { descendantId: true },
  });
  const taskIds = desc.map((d) => d.descendantId);

  const links = await prisma.nodeWorkTemplate.findMany({
    where: { processNodeId: { in: taskIds }, template: { isDefault: false } },
    select: {
      id: true,
      companyId: true,
      processNodeId: true,
      templateId: true,
      template: { select: { name: true, keys: { select: { id: true } } } },
    },
  });

  // defined answers per (task, templateKey)
  const answers = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: { in: taskIds }, templateKeyId: { not: null } },
    select: {
      processNodeId: true,
      templateKeyId: true,
      value: true,
      roleId: true,
      applicationId: true,
      deliverableId: true,
    },
  });
  const definedKey = new Set(
    answers
      .filter(
        (a) =>
          a.value !== null ||
          a.roleId !== null ||
          a.applicationId !== null ||
          a.deliverableId !== null,
      )
      .map((a) => `${a.processNodeId}|${a.templateKeyId}`),
  );

  const toDelete = links.filter((l) => {
    const keyIds = l.template.keys.map((k) => k.id);
    const anyDefined = keyIds.some((kid) => definedKey.has(`${l.processNodeId}|${kid}`));
    return !anyDefined;
  });

  const byTemplate = new Map<string, number>();
  for (const l of toDelete)
    byTemplate.set(l.template.name, (byTemplate.get(l.template.name) ?? 0) + 1);
  console.log(
    `Non-default links: ${links.length} | empty (to remove): ${toDelete.length} | kept (have values): ${links.length - toDelete.length}`,
  );
  for (const [name, n] of [...byTemplate.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`  - ${name}: ${n}`);

  if (!APPLY) {
    console.log('\nDRY RUN — pass --apply to delete.');
    await prisma.$disconnect();
    return;
  }

  const bakDir = 'scripts/backups';
  if (!existsSync(bakDir)) mkdirSync(bakDir, { recursive: true });
  const bak = `${bakDir}/removed-empty-templates-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(
    bak,
    JSON.stringify(
      toDelete.map((l) => ({
        id: l.id,
        companyId: l.companyId,
        processNodeId: l.processNodeId,
        templateId: l.templateId,
        template: l.template.name,
      })),
      null,
      2,
    ),
  );
  console.log(`Backup: ${bak}`);

  const ids = toDelete.map((l) => l.id);
  let removed = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const r = await prisma.nodeWorkTemplate.deleteMany({
      where: { id: { in: ids.slice(i, i + 500) } },
    });
    removed += r.count;
  }
  console.log(`Removed ${removed} empty non-default template links.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
