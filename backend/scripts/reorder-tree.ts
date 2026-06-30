// reorder-tree.ts — (1) move "Corporate Functions Operations" out of Core Business
// into Corporate Functions (ProcessNode tree only; OrgUnit already homes it right),
// (2) set sortOrder across ProcessNode + OrgUnit so the UI orders left→right:
//   L1: Core Business, Technology, Corporate Functions
//   L2: insurance value-chain order (canonical list below)
//   L3 by l3num, L4 by l4num, L5 by l5num (workbook ordinal columns D/F/H)
// Run (cwd=backend): npx tsx scripts/reorder-tree.ts
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';
import { processClosure } from '../src/lib/closure.js';

const L1ORDER = ['Core Business', 'Technology', 'Corporate Functions'];
const L2ORDER = [
  // Core Business (value chain)
  'Product & Delivery', 'Sales, Distribution & Marketing', 'Underwriting', 'Business Operations', 'Claims', 'Reinsurance', 'Actuarial', 'Call Center',
  // Technology
  'Technology & Engineering', 'Data & AI', 'Cybersecurity & IAM',
  // Corporate Functions
  'Finance & Investments', 'Human Resources & Talent', 'Legal & Corporate Governance', 'Risk, Compliance & Audit', 'Program Management Office', 'Executive Office', 'Corporate Operations', 'Corporate Functions Operations',
];
const orderIdx = (list: string[], name: string) => { const i = list.indexOf(name); return i < 0 ? 10000 : i; };
const numOf = (v: any) => { const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER; };

async function bulkSortOrder(table: '"ProcessNode"' | '"OrgUnit"', pairs: [string, number][]) {
  for (let i = 0; i < pairs.length; i += 500) {
    const batch = pairs.slice(i, i + 500);
    const values = batch.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2}::int)`).join(',');
    const params = batch.flatMap(([id, so]) => [id, so]);
    await prisma.$executeRawUnsafe(
      `UPDATE ${table} AS t SET "sortOrder" = v.so FROM (VALUES ${values}) AS v(id, so) WHERE t.id = v.id`,
      ...params,
    );
  }
}

async function main() {
  const co = await prisma.company.findFirst({ select: { id: true } }); if (!co) throw new Error('no company');
  const c = co.id;

  // ── ProcessNode ────────────────────────────────────────────────────────────
  const plt = await prisma.processLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } });
  const PL = Object.fromEntries(plt.map((x) => [x.id, x.levelNumber]));
  const pn = await prisma.processNode.findMany({ where: { companyId: c }, select: { id: true, displayValue: true, parentId: true, processLevelTypeId: true, attributes: true } });
  const lvl = (n: typeof pn[number]) => PL[n.processLevelTypeId];
  const l1 = pn.filter((n) => lvl(n) === 1);
  const cb = l1.find((n) => n.displayValue === 'Core Business');
  const cf = l1.find((n) => n.displayValue === 'Corporate Functions');
  if (!cb || !cf) throw new Error('missing Core Business / Corporate Functions L1');

  // (1) move "Corporate Functions Operations" L2 from Core Business → Corporate Functions
  const cfo = pn.find((n) => lvl(n) === 2 && n.parentId === cb.id && n.displayValue === 'Corporate Functions Operations');
  if (cfo) {
    await processClosure.moveSubtree({ nodeId: cfo.id, newParentId: cf.id });
    cfo.parentId = cf.id; // reflect locally for ordering below
    console.log('Moved "Corporate Functions Operations" → Corporate Functions');
  } else console.log('Corporate Functions Operations not under Core Business (skip move)');

  // (2) sortOrder
  const num = (n: typeof pn[number], k: string) => numOf((n.attributes as any)?.[k]);
  const pairs: [string, number][] = [];
  // L1
  for (const n of l1) pairs.push([n.id, orderIdx(L1ORDER, n.displayValue)]);
  // L2 within each L1
  for (const p1 of l1) {
    const kids = pn.filter((n) => lvl(n) === 2 && n.parentId === p1.id);
    kids.sort((a, b) => orderIdx(L2ORDER, a.displayValue) - orderIdx(L2ORDER, b.displayValue) || a.displayValue.localeCompare(b.displayValue));
    kids.forEach((k, i) => pairs.push([k.id, i]));
  }
  // L3 by l3num, L4 by l4num, L5 by l5num — order children within each parent
  for (const [childLvl, key] of [[3, 'l3num'], [4, 'l4num'], [5, 'l5num']] as const) {
    const parents = pn.filter((n) => lvl(n) === childLvl - 1);
    for (const par of parents) {
      const kids = pn.filter((n) => lvl(n) === childLvl && n.parentId === par.id);
      kids.sort((a, b) => num(a, key) - num(b, key) || a.displayValue.localeCompare(b.displayValue));
      kids.forEach((k, i) => pairs.push([k.id, i]));
    }
  }
  await bulkSortOrder('"ProcessNode"', pairs);
  console.log('ProcessNode sortOrder set for', pairs.length, 'nodes');

  // ── OrgUnit (Organization tab) — L1/L2 only (no workbook basis below L2) ─────
  const olt = await prisma.orgLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } });
  const OL = Object.fromEntries(olt.map((x) => [x.id, x.levelNumber]));
  const ou = await prisma.orgUnit.findMany({ where: { companyId: c }, select: { id: true, displayValue: true, parentId: true, orgLevelTypeId: true } });
  const olvl = (n: typeof ou[number]) => OL[n.orgLevelTypeId];
  const oPairs: [string, number][] = [];
  const ol1 = ou.filter((n) => olvl(n) === 1);
  for (const n of ol1) oPairs.push([n.id, orderIdx(L1ORDER, n.displayValue)]);
  for (const p1 of ol1) {
    const kids = ou.filter((n) => olvl(n) === 2 && n.parentId === p1.id);
    kids.sort((a, b) => orderIdx(L2ORDER, a.displayValue) - orderIdx(L2ORDER, b.displayValue) || a.displayValue.localeCompare(b.displayValue));
    kids.forEach((k, i) => oPairs.push([k.id, i]));
  }
  if (oPairs.length) await bulkSortOrder('"OrgUnit"', oPairs);
  console.log('OrgUnit sortOrder set for', oPairs.length, 'nodes');

  // verify
  const l2cb = pn.filter((n) => lvl(n) === 2 && n.parentId === cb.id).length;
  const l2cf = pn.filter((n) => lvl(n) === 2 && n.parentId === cf.id).length;
  console.log(`Core Business L2 count now ${l2cb}; Corporate Functions L2 count now ${l2cf}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
