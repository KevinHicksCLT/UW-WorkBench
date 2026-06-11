// Accurate pass: unresolved role refs via the app's own resolver, + content
// coverage counts (checklists / tasks / VS participation / people per role).
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';
import { buildRoleResolver, resolveRoleCell } from '../src/lib/roleMatch.js';

async function main() {
  const c = (await prisma.company.findMany({ select: { id: true } }))[0];
  const roles = await prisma.role.findMany({ where: { companyId: c.id }, select: { id: true, name: true, itemRole: true } });
  const resolve = buildRoleResolver(roles);

  const io = await prisma.ioItem.findMany({ select: { keyRoles: true } });
  const steps = await prisma.processStep.findMany({ select: { leads: true, supporting: true } });
  const delivs = await prisma.stepDeliverable.findMany({ select: { approverRoleId: true } });

  const unresolved = new Map<string, number>();
  const tally = (cell: string | null) => {
    for (const u of resolveRoleCell(cell, resolve).unresolved) {
      const k = u.toLowerCase();
      unresolved.set(k, (unresolved.get(k) ?? 0) + 1);
    }
  };
  io.forEach((x) => tally(x.keyRoles));
  steps.forEach((x) => { tally(x.leads); tally(x.supporting); });

  const sorted = [...unresolved.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`TRUE unresolved role refs: ${sorted.length} distinct`);
  for (const [name, n] of sorted) console.log(`  ${n}× ${name}`);

  // Content coverage
  const [cl, rt, vs, asg] = await Promise.all([
    prisma.checklistItem.groupBy({ by: ['roleId'], _count: { _all: true } }),
    prisma.roleTask.groupBy({ by: ['roleId'], _count: { _all: true } }),
    prisma.roleValueStream.groupBy({ by: ['roleId'], _count: { _all: true } }),
    prisma.assignment.groupBy({ by: ['roleId'], _count: { _all: true } }),
  ]);
  const has = (g: { roleId: string }[]) => new Set(g.map((x) => x.roleId));
  const hcl = has(cl), hrt = has(rt), hvs = has(vs), hasg = has(asg);
  const noCl = roles.filter((r) => !hcl.has(r.id)).map((r) => r.name);
  const noRt = roles.filter((r) => !hrt.has(r.id)).map((r) => r.name);
  const noVs = roles.filter((r) => !hvs.has(r.id)).map((r) => r.name);
  const noAsg = roles.filter((r) => !hasg.has(r.id)).map((r) => r.name);
  console.log(`\ncoverage gaps of ${roles.length} roles:`);
  console.log(`no checklist items (${noCl.length}): ${noCl.join(' | ')}`);
  console.log(`\nno role tasks (${noRt.length}): ${noRt.join(' | ')}`);
  console.log(`\nno value-stream participation (${noVs.length}): ${noVs.join(' | ')}`);
  console.log(`\nno people assigned (${noAsg.length}): ${noAsg.slice(0, 40).join(' | ')}${noAsg.length > 40 ? ' …' : ''}`);

  await prisma.$disconnect();
}
main();
