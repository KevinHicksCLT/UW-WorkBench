// normalize-step-roles.ts — rewrites ProcessStep leads/supporting tokens to the
// canonical Role.name whenever the app's own role resolver (roleMatch.ts —
// aliases, parentheticals, itemRole) can resolve them. Rendering-neutral data
// cleanup: the sidebar resolves these cells at query time anyway; this makes
// the raw cells match the inventory so every screen shows one spelling.
// Unresolvable free-text names are left in place and reported.
// Run from backend/:  npx tsx scripts/normalize-step-roles.ts
import { PrismaClient } from '@prisma/client';
import { buildRoleResolver, resolveRoleCell } from '../src/lib/roleMatch.js';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error('No company');
  const roles = await prisma.role.findMany({ where: { companyId: company.id }, select: { id: true, name: true, itemRole: true } });
  const resolve = buildRoleResolver(roles);
  const steps = await prisma.processStep.findMany({ select: { id: true, code: true, leads: true, supporting: true } });

  const canon = (cell: string | null) => {
    if (!cell) return cell;
    const r = resolveRoleCell(cell, resolve);
    const out: string[] = [];
    for (const m of r.roles) if (!out.includes(m.name)) out.push(m.name);
    for (const u of r.unresolved) if (!out.some((x) => x.toLowerCase() === u.toLowerCase())) out.push(u);
    return out.length ? out.join(', ') : null;
  };

  let changed = 0;
  const unresolved = new Map<string, number>();
  for (const s of steps) {
    const leads = canon(s.leads), supporting = canon(s.supporting);
    for (const cell of [leads, supporting]) {
      const r = resolveRoleCell(cell, resolve);
      for (const u of r.unresolved) unresolved.set(u, (unresolved.get(u) ?? 0) + 1);
    }
    if (leads === s.leads && supporting === s.supporting) continue;
    await prisma.processStep.update({ where: { id: s.id }, data: { leads, supporting } });
    const n = await prisma.node.findFirst({ where: { companyId: company.id, typeKey: 'step', code: s.id }, select: { id: true, attributes: true } });
    if (n) await prisma.node.update({ where: { id: n.id }, data: { attributes: { ...(n.attributes as object ?? {}), leads, supporting } } });
    changed++;
  }
  console.log(`Normalized ${changed}/${steps.length} steps.`);
  const top = [...unresolved.entries()].sort((a, b) => b[1] - a[1]);
  if (top.length) console.log('Still unresolved (count):', JSON.stringify(top));
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
