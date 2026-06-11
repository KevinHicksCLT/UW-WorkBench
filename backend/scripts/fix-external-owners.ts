import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// Defect backlog 02, D9.4 — re-point C-suite-owned third-party interactions at
// the operational role that actually runs the relationship. Dry-run by default
// (prints each high-level row + the best operational role candidates from the
// Role table); --fix applies the explicit MAPPING below. Idempotent.

const APPLY = process.argv.includes('--fix');
const HIGH = /chief|^ciso|general counsel/i;

async function main() {
  const rows = await prisma.externalInteraction.findMany({
    select: {
      id: true, externalRole: true, partyType: true, interactionType: true,
      internalRoleOwner: true, internalRoleId: true, relatedValueStream: true,
      internalRole: { select: { name: true } },
    },
  });
  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  const roleByName = new Map(roles.map((r) => [r.name.toLowerCase(), r]));
  const findRole = (...needles: string[]) => {
    for (const n of needles) {
      const hit = roles.find((r) => r.name.toLowerCase().includes(n.toLowerCase()));
      if (hit) return hit;
    }
    return null;
  };

  // Explicit owner re-mapping: external party (substring) → operational role
  // candidates, most-specific first. Only rows whose CURRENT owner is
  // chief-level get re-pointed.
  const MAPPING: { match: RegExp; candidates: string[] }[] = [
    { match: /cloud|aws|azure|hosting|infrastructure|technology vendor|software vendor|saas/i, candidates: ['Vendor Manager', 'IT Vendor', 'Procurement', 'Infrastructure Lead', 'Platform Engineer'] },
    { match: /auditor|audit firm/i, candidates: ['Internal Audit', 'Audit Manager', 'Auditor'] },
    { match: /bank|custodian|investment manager/i, candidates: ['Treasury Manager', 'Investment Ops', 'Finance Manager'] },
    { match: /actuar/i, candidates: ['Actuary', 'Actuarial'] },
    { match: /regulator|doi|naic/i, candidates: ['Head of Compliance', 'Compliance Manager', 'Regulatory'] },
    { match: /rating agency/i, candidates: ['Financial Reporting', 'Controller', 'Finance Manager'] },
    { match: /law firm|counsel|legal/i, candidates: ['Legal Counsel', 'Legal Ops', 'Paralegal'] },
    { match: /reinsur/i, candidates: ['Reinsurance Analyst', 'Reinsurance Manager', 'Ceded Re'] },
    { match: /underwrit/i, candidates: ['Underwriter', 'Underwriting Manager'] },
    { match: /data provider|data vendor|analytics/i, candidates: ['Data Engineer', 'Data Analyst', 'Data Steward'] },
    { match: /insured|customer|policyholder/i, candidates: ['Underwriter', 'Account Manager', 'Customer Service'] },
    // Generic catch-all for any remaining vendor/partner relationship — the
    // operational owner of supplier relationships, not the CTO/CIO.
    { match: /vendor|integrator|managed services|partner|provider/i, candidates: ['Vendor Manager', 'IT Vendor', 'Procurement', 'Service Delivery Manager', 'Sourcing'] },
  ];

  let changed = 0;
  for (const r of rows) {
    const owner = r.internalRole?.name ?? r.internalRoleOwner ?? '';
    if (!HIGH.test(owner)) continue;
    const rule = MAPPING.find((m) => m.match.test(r.externalRole));
    const target = rule ? findRole(...rule.candidates) : null;
    console.log(`HIGH-LEVEL  "${r.externalRole}" (${r.partyType ?? '—'} · ${r.relatedValueStream ?? '—'})`);
    console.log(`            owner: ${owner}  →  ${target ? target.name : '(no operational role found — keep)'}`);
    if (APPLY && target) {
      await prisma.externalInteraction.update({
        where: { id: r.id },
        data: { internalRoleId: target.id, internalRoleOwner: target.name },
      });
      changed++;
    }
  }
  console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN (--fix to apply)'}: ${changed} rows re-pointed.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
