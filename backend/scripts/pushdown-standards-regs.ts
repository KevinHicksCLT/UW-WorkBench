// Standards/regs move to the ATOMIC grain (user decision 2026-07-01): every
// NodeStandard/NodeRegulation link on a non-task node is materialized onto all
// its descendant task nodes, then the higher-level rows are deleted. From then
// on tasks are the single source of truth; value-stream/L2 views roll up via
// the closure (lib/govRollup.ts). Exclusion rows (excluded=true) already
// occupy the (node, entity) unique key, so ON CONFLICT DO NOTHING preserves
// them during the copy; they are dropped at the end (an exclusion is now just
// "no row"). Backs up the current rows to scripts/backups/ first. Idempotent.
// Run: npx tsx --env-file=.env scripts/pushdown-standards-regs.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { prisma } from '../src/db/prisma.js';

async function main() {
  const [stds, regs] = await Promise.all([
    prisma.nodeStandard.findMany(),
    prisma.nodeRegulation.findMany(),
  ]);
  mkdirSync('scripts/backups', { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const backup = `scripts/backups/node-standards-regs-${stamp}.json`;
  writeFileSync(backup, JSON.stringify({ nodeStandards: stds, nodeRegulations: regs }, null, 1));
  console.log(`backed up ${stds.length} NodeStandard + ${regs.length} NodeRegulation rows → ${backup}`);

  const pushedStd = await prisma.$executeRawUnsafe(`
    INSERT INTO public."NodeStandard" (id, "companyId", "processNodeId", "standardId", "excluded")
    SELECT gen_random_uuid()::text, ns."companyId", c."descendantId", ns."standardId", false
    FROM public."NodeStandard" ns
    JOIN public."ProcessNode" src ON src.id = ns."processNodeId" AND NOT src."isTask"
    JOIN public."ProcessNodeClosure" c ON c."ancestorId" = ns."processNodeId"
    JOIN public."ProcessNode" t ON t.id = c."descendantId" AND t."isTask"
    WHERE NOT ns.excluded
    ON CONFLICT ("processNodeId", "standardId") DO NOTHING`);
  console.log('NodeStandard task rows inserted:', pushedStd);

  const pushedReg = await prisma.$executeRawUnsafe(`
    INSERT INTO public."NodeRegulation" (id, "companyId", "processNodeId", "regId", relationship, notes, "excluded")
    SELECT DISTINCT ON (c."descendantId", nr."regId")
      gen_random_uuid()::text, nr."companyId", c."descendantId", nr."regId", nr.relationship, nr.notes, false
    FROM public."NodeRegulation" nr
    JOIN public."ProcessNode" src ON src.id = nr."processNodeId" AND NOT src."isTask"
    JOIN public."ProcessNodeClosure" c ON c."ancestorId" = nr."processNodeId"
    JOIN public."ProcessNode" t ON t.id = c."descendantId" AND t."isTask"
    WHERE NOT nr.excluded
    ON CONFLICT ("processNodeId", "regId") DO NOTHING`);
  console.log('NodeRegulation task rows inserted:', pushedReg);

  const delStd = await prisma.$executeRawUnsafe(`
    DELETE FROM public."NodeStandard" ns USING public."ProcessNode" p
    WHERE p.id = ns."processNodeId" AND NOT p."isTask"`);
  const delReg = await prisma.$executeRawUnsafe(`
    DELETE FROM public."NodeRegulation" nr USING public."ProcessNode" p
    WHERE p.id = nr."processNodeId" AND NOT p."isTask"`);
  console.log('non-task rows deleted:', { standards: delStd, regulations: delReg });

  const delExclStd = await prisma.nodeStandard.deleteMany({ where: { excluded: true } });
  const delExclReg = await prisma.nodeRegulation.deleteMany({ where: { excluded: true } });
  console.log('exclusion rows dropped:', { standards: delExclStd.count, regulations: delExclReg.count });

  const [stdTotal, regTotal] = await Promise.all([prisma.nodeStandard.count(), prisma.nodeRegulation.count()]);
  console.log(`final task-grain totals — NodeStandard: ${stdTotal} | NodeRegulation: ${regTotal}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
