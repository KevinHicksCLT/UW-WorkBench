// Node-side audit: the Organization screen renders role NODES, so duplicate
// nodes, code-less nodes, or missing twins all show up as UI defects even when
// the Role table is clean.
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

const company = await prisma.company.findFirst({ select: { id: true } });
const c = company!.id;
const roleNodes = await prisma.node.findMany({ where: { companyId: c, typeKey: 'role' }, select: { id: true, name: true, code: true, parentId: true, parent: { select: { name: true } } } });
const roles = await prisma.role.findMany({ where: { companyId: c }, select: { id: true, name: true } });
const roleIds = new Set(roles.map((r) => r.id));
const nodeCodes = new Set(roleNodes.map((n) => n.code).filter(Boolean));

console.log(`role rows: ${roles.length} · role nodes: ${roleNodes.length}`);

console.log('\n== Duplicate role-node names (render twice in the org UI) ==');
const byName = new Map<string, typeof roleNodes>();
for (const n of roleNodes) { const k = n.name.toLowerCase(); if (!byName.has(k)) byName.set(k, [] as any); (byName.get(k) as any).push(n); }
for (const [, ns] of byName) if (ns.length > 1) console.log(`  ${ns.length}× "${ns[0].name}" → parents: ${ns.map((n) => `${n.parent?.name}(code=${n.code ? 'set' : 'NULL'})`).join(' | ')}`);

console.log('\n== Role nodes with NO matching Role row (code null or dangling — no participation/people in UI) ==');
for (const n of roleNodes) if (!n.code || !roleIds.has(n.code)) console.log(`  "${n.name}" under ${n.parent?.name} (code=${n.code ?? 'NULL'})`);

console.log('\n== Role rows with NO node twin (invisible on the Organization screen) ==');
for (const r of roles) if (!nodeCodes.has(r.id)) console.log(`  ${r.name}`);

await prisma.$disconnect();
