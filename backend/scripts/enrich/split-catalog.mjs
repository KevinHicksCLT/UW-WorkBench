// Split the domain-wide enrich-catalog.json into per-value-stream catalogs.
//
// The Corporate Functions catalog is ~465KB (797 standards + 1767 regulations),
// which is far too large for an authoring agent to read alongside its area task
// file. Roles and apps are small and stay whole; standards are filtered to the
// departments that value stream actually works in, and regulations to the
// categories it can plausibly trigger. Result is ~40-70KB per stream.
//
//   node scripts/enrich/split-catalog.mjs
//
// Reads  scripts/output/enrich-catalog.json
// Writes scripts/output/enrich-catalog-<vs-slug>.json
import { readFileSync, writeFileSync } from 'node:fs';

const STREAMS = {
  'finance-investments': {
    depts: [
      'Finance & Accounting',
      'Compliance & Risk Management',
      'Data & Analytics',
      'Operations & Customer Service',
    ],
    regs: [
      'FINANCIAL_REPORTING',
      'SOLVENCY_CAPITAL',
      'ACCOUNTING_AUDIT',
      'TAX_REPORTING',
      'CORPORATE_GOVERNANCE',
      'ESG_SUSTAINABILITY',
      'CLIMATE_RISK',
      'DATA_CALL',
    ],
  },
  'human-resources-talent': {
    depts: [
      'Human Resources',
      'Compliance & Risk Management',
      'Legal & Governance',
      'Data & Analytics',
    ],
    regs: ['EMPLOYMENT_BENEFITS', 'DATA_PRIVACY', 'CORPORATE_GOVERNANCE', 'LICENSING'],
  },
  'legal-corporate-governance': {
    depts: ['Legal & Governance', 'Compliance & Risk Management', 'Finance & Accounting'],
    regs: [
      'CORPORATE_GOVERNANCE',
      'MARKET_CONDUCT',
      'CONSUMER_PROTECTION',
      'LICENSING',
      'ANTITRUST_CONDUCT',
      'SECURITIES_DISTRIBUTION',
      'ESG_SUSTAINABILITY',
      'DATA_PRIVACY',
    ],
  },
  'risk-compliance-audit': {
    depts: [
      'Compliance & Risk Management',
      'Information Security',
      'Legal & Governance',
      'Data & Analytics',
      'Finance & Accounting',
    ],
    regs: [
      'SANCTIONS_AML',
      'MARKET_CONDUCT',
      'CONSUMER_PROTECTION',
      'OPERATIONAL_RESILIENCE',
      'DATA_PRIVACY',
      'CYBERSECURITY',
      'CORPORATE_GOVERNANCE',
      'SOLVENCY_CAPITAL',
      'AI_GOVERNANCE',
      'SUITABILITY',
      'ACCOUNTING_AUDIT',
    ],
  },
  'program-management-office': {
    depts: [
      'PMO & Agile Delivery',
      'Data & Analytics',
      'Compliance & Risk Management',
      'Finance & Accounting',
    ],
    regs: ['CORPORATE_GOVERNANCE', 'OPERATIONAL_RESILIENCE', 'AI_GOVERNANCE'],
  },
  'corporate-operations': {
    depts: [
      'Operations & Customer Service',
      'Compliance & Risk Management',
      'Data & Analytics',
      'PMO & Agile Delivery',
    ],
    regs: [
      'OPERATIONAL_RESILIENCE',
      'CONSUMER_PROTECTION',
      'CORPORATE_GOVERNANCE',
      'CYBERSECURITY',
    ],
  },
};

const cat = JSON.parse(readFileSync('scripts/output/enrich-catalog.json', 'utf8'));

for (const [slug, { depts, regs }] of Object.entries(STREAMS)) {
  const out = {
    companyId: cat.companyId,
    roles: cat.roles,
    apps: cat.apps,
    standards: cat.standards.filter((s) => depts.includes(s.department)),
    regs: cat.regs.filter((r) => regs.includes(r.category)),
  };
  const path = `scripts/output/enrich-catalog-${slug}.json`;
  writeFileSync(path, JSON.stringify(out, null, 2));
  const kb = Math.round(JSON.stringify(out).length / 1024);
  console.log(`${path}\t${out.standards.length} std\t${out.regs.length} regs\t${kb}KB`);
}
