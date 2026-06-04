// connect-levels.ts — connect each L3 Value Stream to its owning L2 Division.
// The E2E catalog has no value-stream→division column, so ownership is mapped
// explicitly here (value stream → the division that owns it). Idempotent.
//   npm run connect:levels -w cascade-backend
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// Value Stream (E2E col B) → owning Division name (exact L2 names).
const OWNER: Record<string, string> = {
  'Actuarial & Reserving': 'Actuarial',
  'Billing, Collections & Receivables': 'Finance & Investments',
  'Capital & Treasury Management': 'Finance & Investments',
  'Claims Intake-to-Settlement': 'Claims',
  'Customer Service & Experience': 'Operations & Customer Service',
  'Cybersecurity, Identity & Resilience': 'Cybersecurity & IAM',
  'Data & Analytics': 'Data & AI',
  'Delegated Authority Management': 'Underwriting',
  'Distribution Management': 'Sales, Distribution & Marketing',
  'Enterprise Risk Management': 'Risk, Compliance & Audit',
  'Financial Planning & Reporting': 'Finance & Investments',
  'Human Capital Management': 'Human Resources & Talent',
  'Investment Management': 'Finance & Investments',
  'Legal & Compliance': 'Legal & Corporate Governance',
  'Policy Administration & Servicing': 'Operations & Customer Service',
  'Product Design & Management': 'Product, Delivery & PMO',
  'Reinsurance Management': 'Reinsurance',
  'Risk & Compliance Management': 'Risk, Compliance & Audit',
  'Submission-to-Bind': 'Underwriting',
  'Technology Delivery & Change': 'Technology & Engineering',
  'Vendor & Third-Party Management': 'Risk, Compliance & Audit',
};

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error('No company');
  const companyId = company.id;

  const divisions = await prisma.level.findMany({ where: { companyId, levelNumber: 2 }, select: { id: true, name: true } });
  const divId = new Map(divisions.map((d) => [d.name, d.id] as const));
  const streams = await prisma.level.findMany({ where: { companyId, levelNumber: 3 }, select: { id: true, name: true } });

  let connected = 0;
  const unmatched: string[] = [];
  for (const s of streams) {
    const owner = OWNER[s.name];
    const pid = owner ? divId.get(owner) : undefined;
    if (pid) {
      await prisma.level.update({ where: { id: s.id }, data: { parentId: pid } });
      connected++;
    } else {
      unmatched.push(`${s.name}${owner ? ` (division "${owner}" not found)` : ' (no mapping)'}`);
    }
  }
  console.log(`Connected ${connected}/${streams.length} value streams to their division.`);
  if (unmatched.length) console.log('Unmatched:\n  ' + unmatched.join('\n  '));
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
