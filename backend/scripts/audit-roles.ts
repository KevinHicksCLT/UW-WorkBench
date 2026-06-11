// audit-roles.ts — comprehensive role-catalog audit from the UI's perspective:
// duplicates (exact + normalized + near), value-stream linkage (RVS rows AND
// whether they map onto a canonical value_stream node), and whether the role
// drawer will show any process tasks / deliverables (step + IO text matches).
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';
import { roleMatcher, splitRoleRefs, candidates } from '../src/lib/roleMatch.js';
import { canonicalVs } from '../src/lib/vsMapping.js';

const company = await prisma.company.findFirst({ select: { id: true } });
const c = company!.id;

const roles = await prisma.role.findMany({
  where: { companyId: c },
  select: {
    id: true, name: true, itemRole: true,
    department: { select: { name: true, division: { select: { name: true } } } },
    valueStreamLinks: { select: { valueStream: { select: { name: true } }, participationType: true } },
  },
  orderBy: { name: 'asc' },
});
const steps = await prisma.processStep.findMany({ select: { leads: true, supporting: true, valueStream: { select: { name: true } } } });
const ios = await prisma.ioItem.findMany({ select: { keyRoles: true } });
const vsNodes = await prisma.node.findMany({ where: { companyId: c, typeKey: 'value_stream' }, select: { name: true } });
const vsNodeNames = new Set(vsNodes.map((v) => v.name));
const legacyVs = await prisma.valueStream.findMany({ where: { companyId: c }, select: { name: true } });

// ── duplicates ────────────────────────────────────────────────────────────────
const byExact = new Map<string, typeof roles>();
for (const r of roles) {
  const k = r.name.toLowerCase();
  if (!byExact.has(k)) byExact.set(k, [] as any);
  (byExact.get(k) as any).push(r);
}
console.log('== EXACT duplicate names ==');
for (const [k, rs] of byExact) if (rs.length > 1) console.log(`  ${rs.length}× "${rs[0].name}" → ${rs.map((r) => `${r.department?.division.name}/${r.department?.name}`).join(' | ')}`);

console.log('\n== NORMALIZED duplicate names (roleMatch candidates collide) ==');
const byNorm = new Map<string, string[]>();
for (const r of roles) for (const cand of candidates(r.name)) {
  if (!byNorm.has(cand)) byNorm.set(cand, []);
  byNorm.get(cand)!.push(r.name);
}
for (const [k, names] of byNorm) {
  const uniq = [...new Set(names)];
  if (uniq.length > 1) console.log(`  "${k}" ← ${uniq.join(' | ')}`);
}

console.log('\n== NEAR duplicates (token overlap ≥ 0.7) ==');
const tok = (n: string) => new Set(candidates(n)[0].split(' ').filter((w) => !['of', 'and', 'the'].includes(w)));
for (let i = 0; i < roles.length; i++) for (let j = i + 1; j < roles.length; j++) {
  const a = tok(roles[i].name), b = tok(roles[j].name);
  const inter = [...a].filter((x) => b.has(x)).length;
  const jac = inter / new Set([...a, ...b]).size;
  if (jac >= 0.7 && roles[i].name !== roles[j].name) console.log(`  ${jac.toFixed(2)} "${roles[i].name}" ~ "${roles[j].name}"`);
}

// ── value-stream linkage ──────────────────────────────────────────────────────
console.log('\n== Legacy ValueStream rows with NO canonical node (participation renders unlinked) ==');
for (const v of legacyVs) if (!vsNodeNames.has(canonicalVs(v.name))) console.log(`  ${v.name}`);

console.log('\n== Roles with NO RoleValueStream rows ==');
const noRvs = roles.filter((r) => r.valueStreamLinks.length === 0);
for (const r of noRvs) console.log(`  ${r.name} (${r.department?.division.name}/${r.department?.name})`);

console.log('\n== Roles whose RVS rows ALL point at non-canonical streams (UI shows no linked stream) ==');
for (const r of roles) {
  if (r.valueStreamLinks.length === 0) continue;
  const mapped = r.valueStreamLinks.filter((l) => vsNodeNames.has(canonicalVs(l.valueStream.name)));
  if (mapped.length === 0) console.log(`  ${r.name} → ${[...new Set(r.valueStreamLinks.map((l) => l.valueStream.name))].join(', ')}`);
}

// ── drawer tasks/deliverables (text-matched) ─────────────────────────────────
console.log('\n== Roles with ZERO process-step matches AND ZERO io matches (drawer shows no tasks/deliverables) ==');
let zero = 0;
for (const r of roles) {
  const m = roleMatcher({ name: r.name, itemRole: r.itemRole });
  let stepHits = 0, ioHits = 0;
  for (const s of steps) {
    for (const cell of [s.leads, s.supporting]) for (const t of splitRoleRefs(cell)) if (m(t)) { stepHits++; break; }
    if (stepHits > 2) break;
  }
  for (const io of ios) { for (const t of splitRoleRefs(io.keyRoles)) if (m(t)) { ioHits++; break; } if (ioHits > 2) break; }
  if (stepHits === 0 && ioHits === 0) { zero++; console.log(`  ${r.name} (${r.department?.division.name}/${r.department?.name})`); }
}
console.log(`  → ${zero} of ${roles.length} roles`);

console.log('\n== Canonical value_stream nodes ==');
console.log('  ' + [...vsNodeNames].sort().join(' | '));

await prisma.$disconnect();
