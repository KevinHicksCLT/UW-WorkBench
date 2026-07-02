// Backfill the flat-column gaps the Roles + Applications list views surface but
// have no derivation source: Role.roleType (all roles), Application.vendor and
// Application.totalTco (where missing). Division for apps + deliverable/standard
// links for roles are derived at read-time in the routes — not here.
//
// Idempotent: only writes rows whose target column is still null/empty.
import { prisma } from '../src/db/prisma.js';

// ── Role type ─────────────────────────────────────────────────────────────────
// Classify each role by its title into the RACI-ish participation type the list
// column expects. Ordered: executive sign-off → management → assurance → doer.
function classifyRole(name: string): string {
  const n = name.toLowerCase();
  if (/\b(chief|officer|ceo|cfo|coo|cto|cio|ciso|chro|cro|cdo|caio|president|vice[- ]president|\bvp\b|head of|director|board|general counsel)\b/.test(n)) return 'Approver';
  if (/\b(manager|lead|supervisor|principal|head)\b/.test(n)) return 'Manager';
  if (/\b(audit|review|examiner|compliance|quality|assurance|validation|governance|inspector)\b/.test(n)) return 'Reviewer';
  return 'Contributor';
}

// ── App vendor + TCO ──────────────────────────────────────────────────────────
const VENDORS = ['Guidewire', 'Duck Creek', 'Sapiens', 'Salesforce', 'ServiceNow', 'SAP', 'Oracle', 'Microsoft', 'Workday', 'Snowflake', 'Pegasystems', 'FIS'];
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
// realistic annual TCO band by criticality (USD), deterministic by id.
function genTco(id: string, criticality: string | null): number {
  const h = hash(id);
  const [base, span] = criticality === 'High' ? [900_000, 1_500_000]
    : criticality === 'Low' ? [60_000, 200_000]
    : [250_000, 650_000];
  return Math.round((base + (h % span)) / 1000) * 1000;
}

async function main() {
  // roleType — fill every role (they're all null but one).
  const roles = await prisma.role.findMany({ select: { id: true, displayValue: true, roleType: true } });
  let rt = 0;
  for (const r of roles) {
    if (r.roleType) continue;
    await prisma.role.update({ where: { id: r.id }, data: { roleType: classifyRole(r.displayValue) } });
    rt++;
  }
  console.log(`roleType filled: ${rt}/${roles.length}`);

  // vendor + totalTco.
  const apps = await prisma.application.findMany({ select: { id: true, name: true, isInternal: true, criticality: true, vendor: true, totalTco: true } });
  let ven = 0, tco = 0;
  for (const a of apps) {
    const data: { vendor?: string; totalTco?: number } = {};
    if (!a.vendor) { data.vendor = a.isInternal ? 'In-house' : VENDORS[hash(a.id) % VENDORS.length]; ven++; }
    if (a.totalTco == null) { data.totalTco = genTco(a.id, a.criticality); tco++; }
    if (Object.keys(data).length) await prisma.application.update({ where: { id: a.id }, data });
  }
  console.log(`vendor filled: ${ven}/${apps.length}, totalTco filled: ${tco}/${apps.length}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
