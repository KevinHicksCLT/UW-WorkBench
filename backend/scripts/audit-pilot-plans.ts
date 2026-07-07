// Audit Work Library templates + pilot task plan assignments (read-only).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const HERE = dirname(fileURLToPath(import.meta.url));

async function main() {
  const templates = await prisma.workTemplate.findMany({
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      kind: true,
      name: true,
      isDefault: true,
      keys: { orderBy: { sortOrder: 'asc' }, select: { id: true, key: true, valueKind: true } },
      _count: { select: { nodeLinks: true } },
    },
  });
  console.log('=== WorkTemplates ===');
  for (const t of templates) {
    console.log(
      `\n[${t.kind}] "${t.name}" (default=${t.isDefault}, assigned to ${t._count.nodeLinks} nodes) id=${t.id}`,
    );
    for (const k of t.keys) console.log(`   - ${k.key} [${k.valueKind}]`);
  }

  const exp = JSON.parse(readFileSync(join(HERE, 'pilot-role-app-export.json'), 'utf8')) as {
    tasks: { id: string; name: string }[];
  };
  const taskIds = exp.tasks.map((t) => t.id);

  const links = await prisma.nodeWorkTemplate.findMany({
    where: { processNodeId: { in: taskIds } },
    select: { processNodeId: true, template: { select: { name: true, kind: true } } },
  });
  const combo = new Map<string, number>();
  const byTask = new Map<string, string[]>();
  for (const l of links) {
    const arr = byTask.get(l.processNodeId) ?? [];
    arr.push(`${l.template.kind}:${l.template.name}`);
    byTask.set(l.processNodeId, arr);
  }
  for (const arr of byTask.values()) {
    const k = arr.sort().join(' + ');
    combo.set(k, (combo.get(k) ?? 0) + 1);
  }
  console.log(
    `\n=== Pilot template assignment combos (${byTask.size}/${taskIds.length} tasks have templates) ===`,
  );
  for (const [k, n] of [...combo.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`${n} tasks: ${k}`);

  // Custom steps + answer coverage in pilot
  const answers = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: { in: taskIds } },
    select: {
      processNodeId: true,
      templateKeyId: true,
      customKey: true,
      kind: true,
      suppressed: true,
      value: true,
      applicationId: true,
      roleId: true,
      deliverableId: true,
    },
  });
  const custom = answers.filter((a) => !a.templateKeyId && a.customKey);
  const defined = answers.filter(
    (a) => !a.suppressed && (a.value || a.applicationId || a.roleId || a.deliverableId),
  );
  console.log(
    `\nPilot answers: ${answers.length} total, ${defined.length} defined, ${custom.length} custom steps, ${answers.filter((a) => a.suppressed).length} suppressed`,
  );

  // Sample: full plan values for one task (find one about requirements elicitation)
  const sample = exp.tasks.find((t) => /requirement/i.test(t.name)) ?? exp.tasks[0];
  console.log(`\n=== Sample task: ${sample.name} (${sample.id}) ===`);
  const sAns = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: sample.id },
    orderBy: { sortOrder: 'asc' },
    select: {
      customKey: true,
      kind: true,
      value: true,
      suppressed: true,
      templateKey: { select: { key: true, template: { select: { kind: true, name: true } } } },
    },
  });
  for (const a of sAns) {
    const key = a.templateKey
      ? `${a.templateKey.template.kind}/${a.templateKey.key}`
      : `CUSTOM(${a.kind})/${a.customKey}`;
    console.log(` ${a.suppressed ? 'SUPPRESSED ' : ''}${key} = ${(a.value ?? '').slice(0, 120)}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
