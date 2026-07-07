// Audit part 2: standards/regs attach level + role/app coverage; sample noisy task.
import { prisma } from '../src/db/prisma.js';

async function main() {
  const stdByLevel = await prisma.$queryRaw<{ junction: string; level: number; links: bigint }[]>`
    SELECT 'NodeStandard' AS junction, plt."levelNumber" AS level, COUNT(*)::bigint AS links
    FROM "NodeStandard" ns JOIN "ProcessNode" pn ON pn.id = ns."processNodeId"
    JOIN "ProcessLevelType" plt ON plt.id = pn."processLevelTypeId"
    GROUP BY plt."levelNumber"
    UNION ALL
    SELECT 'NodeRegulation', plt."levelNumber", COUNT(*)::bigint
    FROM "NodeRegulation" nr JOIN "ProcessNode" pn ON pn.id = nr."processNodeId"
    JOIN "ProcessLevelType" plt ON plt.id = pn."processLevelTypeId"
    GROUP BY plt."levelNumber" ORDER BY 1, 2
  `;
  console.log('=== NodeStandard / NodeRegulation by level ===');
  for (const r of stdByLevel) console.log(`${r.junction}  L${r.level}  links=${r.links}`);

  const [stdTotal, stdWithRole, regTotal, regWithRole, regWithApp] = await Promise.all([
    prisma.standard.count(),
    prisma.$queryRaw<
      { c: bigint }[]
    >`SELECT COUNT(DISTINCT "standardId")::bigint c FROM "RoleStandard"`,
    prisma.regulatoryRequirement.count(),
    prisma.$queryRaw<
      { c: bigint }[]
    >`SELECT COUNT(DISTINCT "regId")::bigint c FROM "RoleRegulation"`,
    prisma.$queryRaw<
      { c: bigint }[]
    >`SELECT COUNT(DISTINCT "regId")::bigint c FROM "RegulationApplication"`,
  ]);
  console.log('\n=== Standards/Regs role & app coverage ===');
  console.log(`Standards: ${stdTotal} total, ${stdWithRole[0].c} with RoleStandard appliers`);
  console.log(
    `Regulations: ${regTotal} total, ${regWithRole[0].c} with RoleRegulation, ${regWithApp[0].c} with RegulationApplication`,
  );

  // Sample: the 38-role task — list its roles + apps to eyeball relatedness
  const task = await prisma.processNode.findFirst({
    where: { displayValue: 'Document structured settlement in claim file', isTask: true },
    select: { id: true, displayValue: true },
  });
  if (task) {
    const roles = await prisma.nodeRole.findMany({
      where: { processNodeId: task.id },
      select: { role_: true, role: { select: { displayValue: true } } },
      orderBy: { role_: 'asc' },
    });
    console.log(`\n=== Roles on "${task.displayValue}" (${roles.length}) ===`);
    for (const r of roles) console.log(`${r.role_}  ${r.role.displayValue}`);
    const apps = await prisma.nodeAppUsage.findMany({
      where: { processNodeId: task.id },
      select: { usageType: true, application: { select: { name: true } } },
    });
    console.log(`\n=== Apps on same task (${apps.length}) ===`);
    for (const a of apps) console.log(`${a.usageType}  ${a.application.name}`);
  }

  // App assignment pattern: are the "4 apps" tasks sharing one identical app set?
  const combos = await prisma.$queryRaw<{ combo: string; tasks: bigint }[]>`
    SELECT combo, COUNT(*)::bigint AS tasks FROM (
      SELECT na."processNodeId", STRING_AGG(DISTINCT a.name, ' | ' ORDER BY a.name) AS combo
      FROM "NodeAppUsage" na
      JOIN "Application" a ON a.id = na."applicationId"
      JOIN "ProcessNode" pn ON pn.id = na."processNodeId" AND pn."isTask" = true
      GROUP BY na."processNodeId"
    ) t GROUP BY combo ORDER BY COUNT(*) DESC LIMIT 12
  `;
  console.log('\n=== Most common app combos on tasks ===');
  for (const r of combos) console.log(`${r.tasks} tasks: ${r.combo}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
