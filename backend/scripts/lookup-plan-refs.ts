/** Lookup helper: apps / roles / deliverables whose names match search terms, for plan value binding. */
import { prisma } from '../src/db/prisma.js';

const terms = process.argv.slice(2);

async function main() {
  for (const t of terms) {
    const apps = await prisma.application.findMany({
      where: { name: { contains: t, mode: 'insensitive' } },
      select: { id: true, name: true, category: true },
      take: 10,
    });
    const roles = await prisma.role.findMany({
      where: { displayValue: { contains: t, mode: 'insensitive' } },
      select: { id: true, displayValue: true },
      take: 10,
    });
    const dels = await prisma.deliverable.findMany({
      where: { title: { contains: t, mode: 'insensitive' } },
      select: { id: true, title: true },
      take: 10,
    });
    console.log(`\n=== ${t} ===`);
    apps.forEach((a) => console.log(`  APP  ${a.id} ${a.name} (${a.category ?? ''})`));
    roles.forEach((r) => console.log(`  ROLE ${r.id} ${r.displayValue}`));
    dels.forEach((d) => console.log(`  DEL  ${d.id} ${d.title}`));
  }
}

main().finally(() => prisma.$disconnect());
