// Export pilot tasks' generic template keys (currently suppressed) with their
// old values + task context, for the single-fact profile rewrite.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const HERE = dirname(fileURLToPath(import.meta.url));

async function main() {
  const exp = JSON.parse(readFileSync(join(HERE, 'pilot-role-app-export.json'), 'utf8')) as {
    pilot: { l3Id: string; path: string };
    tasks: { id: string; name: string; description: string | null; l4: string | null }[];
  };
  const taskIds = exp.tasks.map((t) => t.id);

  const [links, answers, roles, apps, steps] = await Promise.all([
    prisma.nodeWorkTemplate.findMany({
      where: { processNodeId: { in: taskIds } },
      select: {
        processNodeId: true,
        template: {
          select: {
            kind: true,
            name: true,
            keys: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, key: true, valueKind: true },
            },
          },
        },
      },
    }),
    prisma.nodeTemplateAnswer.findMany({
      where: { processNodeId: { in: taskIds }, templateKeyId: { not: null } },
      select: {
        processNodeId: true,
        templateKeyId: true,
        value: true,
        application: { select: { name: true } },
        role: { select: { displayValue: true } },
      },
    }),
    prisma.nodeRole.findMany({
      where: { processNodeId: { in: taskIds } },
      select: { processNodeId: true, role_: true, role: { select: { displayValue: true } } },
    }),
    prisma.nodeAppUsage.findMany({
      where: { processNodeId: { in: taskIds } },
      select: { processNodeId: true, application: { select: { name: true } } },
    }),
    prisma.nodeTemplateAnswer.findMany({
      where: { processNodeId: { in: taskIds }, templateKeyId: null, kind: 'CHECKLIST' },
      orderBy: { sortOrder: 'asc' },
      select: { processNodeId: true, customKey: true },
    }),
  ]);

  const by = <T extends { processNodeId: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const l = m.get(r.processNodeId) ?? [];
      l.push(r);
      m.set(r.processNodeId, l);
    }
    return m;
  };
  const linksBy = by(links),
    rolesBy = by(roles),
    appsBy = by(apps),
    stepsBy = by(steps);
  const ansByPair = new Map(answers.map((a) => [`${a.processNodeId}|${a.templateKeyId}`, a]));

  const out = {
    pilot: exp.pilot,
    tasks: exp.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      l4: t.l4,
      owner: rolesBy.get(t.id)?.find((r) => r.role_ === 'Owner')?.role.displayValue ?? null,
      participants: (rolesBy.get(t.id) ?? [])
        .filter((r) => r.role_ === 'Participant')
        .map((r) => r.role.displayValue),
      apps: [...new Set((appsBy.get(t.id) ?? []).map((a) => a.application.name))],
      steps: (stepsBy.get(t.id) ?? []).map((s) => s.customKey),
      keys: (linksBy.get(t.id) ?? []).flatMap((l) =>
        l.template.keys.map((k) => {
          const old = ansByPair.get(`${t.id}|${k.id}`);
          return {
            keyId: k.id,
            key: k.key,
            block: l.template.kind,
            template: l.template.name,
            valueKind: k.valueKind,
            oldValue: old?.application?.name ?? old?.role?.displayValue ?? old?.value ?? null,
          };
        }),
      ),
    })),
  };
  writeFileSync(join(HERE, 'pilot-profile-export.json'), JSON.stringify(out, null, 2));
  const keyRows = out.tasks.reduce((s, t) => s + t.keys.length, 0);
  console.log(
    `Wrote pilot-profile-export.json — ${out.tasks.length} tasks, ${keyRows} generic key slots`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
