import { prisma } from '../../src/db/prisma.js';
const D = '540fdf27-7c07-4d72-ae95-de26e9e05276';
async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
WITH vs AS (SELECT v.id, v."displayValue" n FROM "ProcessNode" v WHERE v."parentId"='${D}'),
tasks AS (SELECT vs.n vs, t.id tid FROM vs JOIN "ProcessNodeClosure" c ON c."ancestorId"=vs.id JOIN "ProcessNode" t ON t.id=c."descendantId" AND t."isTask"=true)
SELECT vs, count(*) tasks,
 round(avg((SELECT count(*) FROM "NodeRole" x WHERE x."processNodeId"=tid)),2) roles,
 round(avg((SELECT count(*) FROM "NodeAppUsage" x WHERE x."processNodeId"=tid)),2) apps,
 round(avg((SELECT count(*) FROM "NodeStandard" x WHERE x."processNodeId"=tid)),2) std,
 count(*) FILTER (WHERE (SELECT count(*) FROM "NodeRole" x WHERE x."processNodeId"=tid AND x.role_='Owner')=0) no_owner
FROM tasks GROUP BY vs ORDER BY vs`);
  for (const r of rows)
    console.log(
      `${r.vs}\t${r.tasks}\troles=${r.roles}\tapps=${r.apps}\tstd=${r.std}\tno_owner=${r.no_owner}`,
    );
}
main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
