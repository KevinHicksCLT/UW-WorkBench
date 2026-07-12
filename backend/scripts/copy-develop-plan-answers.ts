/**
 * One-off: sync Work Library plan answers (NodeTemplateAnswer) from a source
 * DB branch (develop/production) into the active DB — brings over the
 * specific-step procedure rows ("By the <role>: / steps / Done when …")
 * authored there after this branch was forked.
 *
 * Source rows are authoritative: rows are matched by id (shared cuid lineage),
 * existing target copies are overwritten, target-only rows are left alone
 * (except rows colliding on the (processNodeId, templateKeyId) unique key,
 * which are replaced). Rows whose ProcessNode is missing on the target are
 * skipped and reported.
 *
 * Dry-run by default; pass --apply to write. Idempotent. Run from backend/:
 *   SOURCE_DB_URL="<develop-direct-url>" npx tsx --env-file=.env \
 *     scripts/copy-develop-plan-answers.ts [--apply]
 */
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/db/prisma.js';

const apply = process.argv.includes('--apply');
const sourceUrl = process.env.SOURCE_DB_URL;
if (!sourceUrl) {
  console.error('Set SOURCE_DB_URL to the source branch connection string.');
  process.exit(1);
}
const source = new PrismaClient({ datasourceUrl: sourceUrl });

const srcRows = await source.nodeTemplateAnswer.findMany();
const tgtRows = await prisma.nodeTemplateAnswer.findMany({
  select: { id: true, processNodeId: true, templateKeyId: true },
});
const tgtNodeIds = new Set(
  (await prisma.processNode.findMany({ select: { id: true } })).map((n) => n.id),
);
// Entity FKs (application/role/deliverable) may point at rows the target
// branch doesn't have (catalogs diverged since the fork) — null those out
// rather than fail; the answer's text value is what matters here.
const tgtAppIds = new Set(
  (await prisma.application.findMany({ select: { id: true } })).map((a) => a.id),
);
const tgtRoleIds = new Set((await prisma.role.findMany({ select: { id: true } })).map((r) => r.id));
const tgtDelivIds = new Set(
  (await prisma.deliverable.findMany({ select: { id: true } })).map((d) => d.id),
);
let sanitized = 0;
for (const r of srcRows) {
  const drop =
    (r.applicationId && !tgtAppIds.has(r.applicationId)) ||
    (r.roleId && !tgtRoleIds.has(r.roleId)) ||
    (r.deliverableId && !tgtDelivIds.has(r.deliverableId));
  if (drop) {
    sanitized += 1;
    if (r.applicationId && !tgtAppIds.has(r.applicationId)) r.applicationId = null;
    if (r.roleId && !tgtRoleIds.has(r.roleId)) r.roleId = null;
    if (r.deliverableId && !tgtDelivIds.has(r.deliverableId)) r.deliverableId = null;
  }
}

const tgtById = new Map(tgtRows.map((r) => [r.id, r]));
const tgtByNodeKey = new Map(
  tgtRows.filter((r) => r.templateKeyId).map((r) => [`${r.processNodeId}|${r.templateKeyId}`, r]),
);

const usable = srcRows.filter((r) => tgtNodeIds.has(r.processNodeId));
const skippedNodes = srcRows.length - usable.length;
const overwrites = usable.filter((r) => tgtById.has(r.id));
const inserts = usable.filter((r) => !tgtById.has(r.id));
// Target-only rows occupying an incoming row's (processNodeId, templateKeyId)
// unique slot under a different id must be replaced, not collided with.
const collisions = inserts
  .filter((r) => r.templateKeyId)
  .map((r) => tgtByNodeKey.get(`${r.processNodeId}|${r.templateKeyId}`))
  .filter((t): t is NonNullable<typeof t> => Boolean(t) && !overwrites.some((o) => o.id === t!.id));

console.log(`source rows: ${srcRows.length} (target: ${tgtRows.length})`);
console.log(`  inserts: ${inserts.length}, overwrites: ${overwrites.length}`);
console.log(`  unique-slot collisions replaced: ${collisions.length}`);
console.log(`  skipped (node missing on target): ${skippedNodes}`);
console.log(`  rows with dangling entity FKs nulled: ${sanitized}`);

if (!apply) {
  console.log('\nDry-run only — pass --apply to write.');
} else {
  const replaceIds = [...usable.map((r) => r.id), ...collisions.map((c) => c.id)];
  const CHUNK = 2000;
  for (let i = 0; i < replaceIds.length; i += CHUNK)
    await prisma.nodeTemplateAnswer.deleteMany({
      where: { id: { in: replaceIds.slice(i, i + CHUNK) } },
    });
  for (let i = 0; i < usable.length; i += CHUNK)
    await prisma.nodeTemplateAnswer.createMany({ data: usable.slice(i, i + CHUNK) });
  const after = await prisma.nodeTemplateAnswer.count();
  const multi = await prisma.nodeTemplateAnswer.count({
    where: { customKey: { not: null }, value: { contains: '\n' } },
  });
  console.log(`applied — target now ${after} rows, ${multi} multi-line specific steps`);
}

await source.$disconnect();
await prisma.$disconnect();
