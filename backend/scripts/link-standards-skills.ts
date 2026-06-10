// Ties every standards area to its SDLC-compliance agent skill: stamps
// StandardItem.agentSkill (the field the Standards page renders as the
// "Agent skill: … · view & download" chip) with the area's skill slug, for
// items that don't already carry one. Regulatory items (GDPR / CCPA-CPRA /
// NYDFS-500 packs inside Cybersecurity & ISO) keep their specific pack skill.
// Idempotent. Skill slugs are verified to exist under standards/skills/.
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db/prisma.js';

const SKILLS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../standards/skills');

const AREA_SKILL: Record<string, string> = {
  'Actuarial': 'actuarial-sdlc-compliance',
  'Claims Operations': 'claims-operations-sdlc-compliance',
  'Compliance & Risk Management': 'compliance-risk-management-sdlc-compliance',
  'Cybersecurity & ISO': 'cybersecurity-iso-sdlc-compliance',
  'Data & Analytics': 'data-analytics-sdlc-compliance',
  'Engineering & Development': 'engineering-development-sdlc-compliance',
  'Enterprise & Solution Architecture': 'enterprise-solution-architecture-sdlc-compliance',
  'Finance & Accounting': 'finance-accounting-sdlc-compliance',
  'Human Resources': 'human-resources-sdlc-compliance',
  'Legal & Governance': 'legal-governance-sdlc-compliance',
  'Operations & Customer Service': 'operations-customer-service-sdlc-compliance',
  'PMO & Agile Delivery': 'pmo-agile-delivery-sdlc-compliance',
  'Underwriting': 'underwriting-sdlc-compliance',
};

async function main() {
  const areas = await prisma.standard.findMany({ select: { id: true, department: true } });
  let total = 0;
  for (const a of areas) {
    const slug = AREA_SKILL[a.department];
    if (!slug) { console.log(`  ⚠ no skill mapped for area: ${a.department}`); continue; }
    if (!existsSync(resolve(SKILLS_ROOT, slug, 'SKILL.md'))) { console.log(`  ⚠ skill folder missing: ${slug}`); continue; }
    const r = await prisma.standardItem.updateMany({
      where: { standardId: a.id, agentSkill: null },
      data: { agentSkill: slug },
    });
    total += r.count;
    console.log(`  ${a.department.padEnd(36)} → ${slug} (${r.count} items linked)`);
  }
  const unlinked = await prisma.standardItem.count({ where: { agentSkill: null } });
  console.log(`linked ${total} items · ${unlinked} still without a skill`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
