// verify-regs-atomic.ts — post-decomposition audit. Confirms every ACTIVE reg is
// atomic (1 regulation group), wired (owner + contributor + VS), and reports any
// leftover compound/unwired rows to chase.
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

async function main() {
  const c = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  const cid = c!.id;
  const active = await prisma.regulatoryRequirement.findMany({
    where: { companyId: cid, status: 'ACTIVE' },
    select: { id: true, title: true, requirement: true, regime: true,
      jurisdiction: { select: { code: true } },
      roleRegulations: { select: { role_: true } },
      _count: { select: { roleRegulations: true, nodeRegulations: true } } },
  });
  const byStatus = await prisma.regulatoryRequirement.groupBy({ by: ['status'], where: { companyId: cid }, _count: true });
  console.log('STATUS:', JSON.stringify(byStatus));
  console.log('ACTIVE total:', active.length);

  const isCompound = (t: string) => / AND /.test(t) || / via [A-Z][^;]*;\s*\S.* via /.test(t) || /;\s*(company|producer|and|the insurer must)/i.test(t);
  const compound = active.filter((a) => isCompound(a.requirement ?? ''));
  const noOwner = active.filter((a) => !a.roleRegulations.some((r) => r.role_ === 'Owner'));
  const noContrib = active.filter((a) => !a.roleRegulations.some((r) => r.role_ === 'Contributor'));
  const noVS = active.filter((a) => a._count.nodeRegulations === 0);
  const unwired = active.filter((a) => a._count.roleRegulations === 0);

  console.log('still-compound (heuristic):', compound.length);
  console.log('missing Owner:', noOwner.length, ' | missing Contributor:', noContrib.length, ' | missing VS link:', noVS.length, ' | fully unwired:', unwired.length);
  if (compound.length) { console.log('--- compound sample:'); for (const a of compound.slice(0, 20)) console.log(`  [${a.regime ?? '-'}|${a.jurisdiction?.code}] ${a.title} :: ${(a.requirement ?? '').slice(0, 140)}`); }
  if (unwired.length) { console.log('--- unwired sample:'); for (const a of unwired.slice(0, 20)) console.log(`  [${a.jurisdiction?.code}] ${a.title}`); }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
