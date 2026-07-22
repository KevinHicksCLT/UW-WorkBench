// Per-value-stream Work Library (Phase B) completeness check for a domain.
// Expect generic_defined = 15.0 and zero_text = 0 on every value stream.
//
//   npx tsx --env-file=.env scripts/enrich/verify-phase-b.ts "Core Business"
import { prisma } from '../../src/db/prisma.js';

async function main() {
  const domainName = process.argv[2] ?? 'Core Business';
  const domain = await prisma.processNode.findFirstOrThrow({
    where: { displayValue: domainName, processLevelType: { levelNumber: 1 } },
    select: { id: true },
  });
  const rows = await prisma.$queryRawUnsafe<
    {
      vs: string;
      tasks: bigint;
      generic_defined: string;
      custom_steps: string;
      zero_text: bigint;
    }[]
  >(
    `WITH vs AS (SELECT v.id, v."displayValue" n FROM "ProcessNode" v WHERE v."parentId"=$1),
     tasks AS (SELECT vs.n vs, t.id tid FROM vs
       JOIN "ProcessNodeClosure" c ON c."ancestorId"=vs.id
       JOIN "ProcessNode" t ON t.id=c."descendantId" AND t."isTask"=true)
     SELECT vs, count(*) tasks,
      round(avg((SELECT count(*) FROM "NodeTemplateAnswer" x WHERE x."processNodeId"=tid
        AND x."templateKeyId" IS NOT NULL
        AND (x.value IS NOT NULL OR x."roleId" IS NOT NULL OR x."applicationId" IS NOT NULL))),1) generic_defined,
      round(avg((SELECT count(*) FROM "NodeTemplateAnswer" x WHERE x."processNodeId"=tid
        AND x."templateKeyId" IS NULL)),1) custom_steps,
      count(*) FILTER (WHERE (SELECT count(*) FROM "NodeTemplateAnswer" x WHERE x."processNodeId"=tid
        AND x."templateKeyId" IS NOT NULL AND x.value IS NOT NULL)=0) zero_text
     FROM tasks GROUP BY vs ORDER BY vs`,
    domain.id,
  );
  for (const r of rows)
    console.log(
      `${r.vs}\t${r.tasks}\tgeneric=${r.generic_defined}\tsteps=${r.custom_steps}\tzero_text=${r.zero_text}`,
    );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
