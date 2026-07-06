// Audit: where NodeRole / NodeAppUsage attach in the process tree, and how
// noisy task-level assignments are. Read-only.
import { prisma } from '../src/db/prisma.js';

async function main() {
  // 1. Distribution of NodeRole / NodeAppUsage by process level
  const byLevel = await prisma.$queryRaw<
    { junction: string; level: number; links: bigint; nodes: bigint }[]
  >`
    SELECT 'NodeRole' AS junction, plt."levelNumber" AS level,
           COUNT(*)::bigint AS links, COUNT(DISTINCT nr."processNodeId")::bigint AS nodes
    FROM "NodeRole" nr
    JOIN "ProcessNode" pn ON pn.id = nr."processNodeId"
    JOIN "ProcessLevelType" plt ON plt.id = pn."processLevelTypeId"
    GROUP BY plt."levelNumber"
    UNION ALL
    SELECT 'NodeAppUsage', plt."levelNumber",
           COUNT(*)::bigint, COUNT(DISTINCT na."processNodeId")::bigint
    FROM "NodeAppUsage" na
    JOIN "ProcessNode" pn ON pn.id = na."processNodeId"
    JOIN "ProcessLevelType" plt ON plt.id = pn."processLevelTypeId"
    GROUP BY plt."levelNumber"
    ORDER BY 1, 2
  `;
  console.log('=== Junction rows by process level ===');
  for (const r of byLevel)
    console.log(`${r.junction}  L${r.level}  links=${r.links}  nodes=${r.nodes}`);

  // 2. Task-level noise: roles per task and apps per task histograms
  const roleHist = await prisma.$queryRaw<{ n: bigint; tasks: bigint }[]>`
    SELECT cnt AS n, COUNT(*)::bigint AS tasks FROM (
      SELECT nr."processNodeId", COUNT(*)::bigint AS cnt
      FROM "NodeRole" nr
      JOIN "ProcessNode" pn ON pn.id = nr."processNodeId"
      WHERE pn."isTask" = true
      GROUP BY nr."processNodeId"
    ) t GROUP BY cnt ORDER BY cnt
  `;
  console.log('\n=== Roles-per-task histogram (isTask=true) ===');
  for (const r of roleHist) console.log(`${r.n} roles -> ${r.tasks} tasks`);

  const appHist = await prisma.$queryRaw<{ n: bigint; tasks: bigint }[]>`
    SELECT cnt AS n, COUNT(*)::bigint AS tasks FROM (
      SELECT na."processNodeId", COUNT(DISTINCT na."applicationId")::bigint AS cnt
      FROM "NodeAppUsage" na
      JOIN "ProcessNode" pn ON pn.id = na."processNodeId"
      WHERE pn."isTask" = true
      GROUP BY na."processNodeId"
    ) t GROUP BY cnt ORDER BY cnt
  `;
  console.log('\n=== Distinct apps-per-task histogram ===');
  for (const r of appHist) console.log(`${r.n} apps -> ${r.tasks} tasks`);

  // 3. Do non-task nodes carry links a rollup would NOT produce?
  //    i.e. role/app linked at L2-L4 but at zero descendant tasks.
  const phantomRoles = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*)::bigint AS cnt
    FROM "NodeRole" nr
    JOIN "ProcessNode" pn ON pn.id = nr."processNodeId"
    WHERE pn."isTask" = false
      AND NOT EXISTS (
        SELECT 1 FROM "ProcessNodeClosure" c
        JOIN "ProcessNode" d ON d.id = c."descendantId" AND d."isTask" = true
        JOIN "NodeRole" nr2 ON nr2."processNodeId" = d.id AND nr2."roleId" = nr."roleId"
        WHERE c."ancestorId" = pn.id AND c.depth > 0
      )
  `;
  const phantomApps = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*)::bigint AS cnt
    FROM "NodeAppUsage" na
    JOIN "ProcessNode" pn ON pn.id = na."processNodeId"
    WHERE pn."isTask" = false
      AND NOT EXISTS (
        SELECT 1 FROM "ProcessNodeClosure" c
        JOIN "ProcessNode" d ON d.id = c."descendantId" AND d."isTask" = true
        JOIN "NodeAppUsage" na2 ON na2."processNodeId" = d.id AND na2."applicationId" = na."applicationId"
        WHERE c."ancestorId" = pn.id AND c.depth > 0
      )
  `;
  console.log('\n=== Non-task links NOT backed by any descendant task link ===');
  console.log(`NodeRole (phantom, would vanish under pure rollup): ${phantomRoles[0].cnt}`);
  console.log(`NodeAppUsage (phantom): ${phantomApps[0].cnt}`);

  // 4. Reverse: rollup coverage — how many non-task links ARE just duplicates of task-level links
  const dupRoles = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*)::bigint AS cnt
    FROM "NodeRole" nr
    JOIN "ProcessNode" pn ON pn.id = nr."processNodeId"
    WHERE pn."isTask" = false
      AND EXISTS (
        SELECT 1 FROM "ProcessNodeClosure" c
        JOIN "ProcessNode" d ON d.id = c."descendantId" AND d."isTask" = true
        JOIN "NodeRole" nr2 ON nr2."processNodeId" = d.id AND nr2."roleId" = nr."roleId"
        WHERE c."ancestorId" = pn.id AND c.depth > 0
      )
  `;
  console.log(`NodeRole non-task links that ARE derivable from tasks: ${dupRoles[0].cnt}`);

  // 5. Worst offender tasks — sample 10 tasks with most roles
  const worst = await prisma.$queryRaw<{ name: string; roles: bigint }[]>`
    SELECT pn."displayValue" AS name, COUNT(*)::bigint AS roles
    FROM "NodeRole" nr JOIN "ProcessNode" pn ON pn.id = nr."processNodeId"
    WHERE pn."isTask" = true
    GROUP BY pn.id, pn."displayValue"
    ORDER BY COUNT(*) DESC LIMIT 10
  `;
  console.log('\n=== Tasks with most roles ===');
  for (const r of worst) console.log(`${r.roles}  ${r.name}`);

  const worstApps = await prisma.$queryRaw<{ name: string; apps: bigint }[]>`
    SELECT pn."displayValue" AS name, COUNT(DISTINCT na."applicationId")::bigint AS apps
    FROM "NodeAppUsage" na JOIN "ProcessNode" pn ON pn.id = na."processNodeId"
    WHERE pn."isTask" = true
    GROUP BY pn.id, pn."displayValue"
    ORDER BY COUNT(DISTINCT na."applicationId") DESC LIMIT 10
  `;
  console.log('\n=== Tasks with most distinct apps ===');
  for (const r of worstApps) console.log(`${r.apps}  ${r.name}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
