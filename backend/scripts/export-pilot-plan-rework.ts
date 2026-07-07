// Export pilot tasks' current Work Library plans (generic answers + custom
// steps) plus cleaned roles/apps, as source material for the atomic-step
// rework. Writes pilot-plan-export.json next to this script.
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

  const [roles, apps, links, answers] = await Promise.all([
    prisma.nodeRole.findMany({
      where: { processNodeId: { in: taskIds } },
      select: { processNodeId: true, role_: true, role: { select: { displayValue: true } } },
    }),
    prisma.nodeAppUsage.findMany({
      where: { processNodeId: { in: taskIds } },
      select: { processNodeId: true, usageType: true, application: { select: { name: true } } },
    }),
    prisma.nodeWorkTemplate.findMany({
      where: { processNodeId: { in: taskIds } },
      select: { processNodeId: true, template: { select: { kind: true, name: true } } },
    }),
    prisma.nodeTemplateAnswer.findMany({
      where: { processNodeId: { in: taskIds } },
      orderBy: { sortOrder: 'asc' },
      select: {
        processNodeId: true,
        customKey: true,
        kind: true,
        value: true,
        suppressed: true,
        templateKey: { select: { key: true, template: { select: { kind: true } } } },
        application: { select: { name: true } },
        role: { select: { displayValue: true } },
        deliverable: { select: { title: true } },
      },
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
  const rolesBy = by(roles),
    appsBy = by(apps),
    linksBy = by(links),
    ansBy = by(answers);

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
      apps: (appsBy.get(t.id) ?? []).map((a) => ({
        name: a.application.name,
        usageType: a.usageType,
      })),
      templates: (linksBy.get(t.id) ?? []).map((l) => `${l.template.kind}:${l.template.name}`),
      currentPlan: (ansBy.get(t.id) ?? []).map((a) => ({
        key: a.templateKey ? a.templateKey.key : a.customKey,
        block: a.templateKey ? a.templateKey.template.kind : (a.kind ?? 'CHECKLIST'),
        value:
          a.application?.name ?? a.role?.displayValue ?? a.deliverable?.title ?? a.value ?? null,
        suppressed: a.suppressed,
        custom: !a.templateKey,
      })),
    })),
  };
  writeFileSync(join(HERE, 'pilot-plan-export.json'), JSON.stringify(out, null, 2));
  const planRows = out.tasks.reduce((s, t) => s + t.currentPlan.length, 0);
  console.log(
    `Wrote pilot-plan-export.json — ${out.tasks.length} tasks, ${planRows} current plan rows`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
