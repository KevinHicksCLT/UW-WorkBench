// seed-scrum104-regulations.ts — SCRUM-104: load the deep-researched, adversarially
// verified catalog of real, currently-in-force insurance regulations (federal /
// international / state, across every line of business) into the DB and wire each
// one to the operating model.
//
// Source data: scripts/scrum104-regulations.json — 315 rows produced by the
// scrum104-regulation-research workflow (each row verified against an official
// source: eCFR, eur-lex, legislation.gov.uk, canada.ca, naic.org, state DOI sites).
//
// For every row this script:
//   • upserts the issuing Jurisdiction (states already exist; FED-* agencies and
//     UK/EU/CA-NAT/BM regulators are created with non-state taxonomy placeholders)
//   • upserts the RegulatoryRequirement (idempotent by companyId+jurisdiction+title)
//   • wires an accountable owner + contributor roles via RoleRegulation, resolved
//     from the live Role catalog by category (first matching real role wins)
//
// Value-stream (NodeRegulation) mapping is intentionally NOT auto-materialized here
// — that stays curated per-requirement through the tree-grain link editor, to keep
// the task-grain junction honest instead of blanket-tagging whole streams.
//
// Idempotent: re-running updates existing rows in place and never duplicates.
//
// Run (cwd = backend):
//   npx tsx --env-file=.env scripts/seed-scrum104-regulations.ts --dry-run
//   npx tsx --env-file=.env scripts/seed-scrum104-regulations.ts
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const DRY = process.argv.includes('--dry-run');
const here = dirname(fileURLToPath(import.meta.url));

type Row = {
  jurisdictionCode: string;
  jurisdictionName: string;
  regulatorName: string;
  regulatorWebsite?: string;
  regulatorType: string; // STATE_INSURANCE_REGULATOR | FEDERAL | INTERNATIONAL
  regime: string;
  title: string;
  requirement: string;
  category: string;
  lineOfBusiness: string;
  obligationType: string;
  frequency?: string;
  citation: string;
  citationUrl?: string;
  sourceNote?: string;
};

// category → accountable owner + contributor roles + governing value streams.
// Titles/names are matched against the live catalog; the first that exists wins,
// so the script degrades gracefully if a role/stream is renamed.
const MAP: Record<string, { owner: string[]; contributors: string[]; valueStreams: string[] }> = {
  DATA_PRIVACY: {
    owner: ['Privacy Officer', 'Data Protection Officer', 'Compliance Officer'],
    contributors: ['Data Protection Officer', 'Data Privacy Steward', 'Compliance Analyst'],
    valueStreams: ['Legal & Corporate Governance', 'Data & AI'],
  },
  CYBERSECURITY: {
    owner: ['Chief Info Security Officer', 'IT Security Manager', 'Compliance Officer'],
    contributors: ['Cybersecurity Lead', 'IT Security Manager', 'Compliance Analyst'],
    valueStreams: ['Cybersecurity & IAM', 'Risk, Compliance & Audit'],
  },
  AI_GOVERNANCE: {
    owner: ['Chief Data Officer', 'Model Risk Manager', 'Head of Compliance'],
    contributors: ['Model Risk Manager', 'Data Governance Lead', 'Compliance Manager'],
    valueStreams: ['Data & AI', 'Risk, Compliance & Audit'],
  },
  SANCTIONS_AML: {
    owner: ['Financial Crime AML Officer', 'Compliance Officer', 'Head of Compliance'],
    contributors: ['Sanctions Analyst', 'AML Analyst', 'Financial Crime Investigator'],
    valueStreams: ['Risk, Compliance & Audit', 'Legal & Corporate Governance'],
  },
  FINANCIAL_REPORTING: {
    owner: ['Statutory Reporting Manager', 'Controller', 'Chief Financial Officer'],
    contributors: ['Controller', 'Accountant', 'Compliance Analyst'],
    valueStreams: ['Finance & Investments', 'Risk, Compliance & Audit'],
  },
  CLIMATE_RISK: {
    owner: ['Chief Risk Officer', 'Enterprise Risk Manager', 'Head of Compliance'],
    contributors: [
      'Enterprise Risk Manager',
      'Catastrophe & Exposure Manager',
      'Compliance Analyst',
    ],
    valueStreams: ['Risk, Compliance & Audit', 'Underwriting'],
  },
  CATASTROPHE_REPORTING: {
    owner: ['Catastrophe & Exposure Manager', 'Chief Risk Officer', 'Statutory Reporting Manager'],
    contributors: ['Enterprise Risk Manager', 'Statutory Reporting Manager', 'Data Analyst'],
    valueStreams: ['Underwriting', 'Finance & Investments'],
  },
  OPERATIONAL_RESILIENCE: {
    owner: ['Operational Resilience Lead', 'Business Continuity Manager', 'Chief Risk Officer'],
    contributors: ['Business Continuity Manager', 'Third-Party Risk Manager', 'Cybersecurity Lead'],
    valueStreams: ['Risk, Compliance & Audit', 'Technology & Engineering'],
  },
  CONSUMER_PROTECTION: {
    owner: [
      'Market Conduct / Consumer Compliance Manager',
      'Compliance Manager',
      'Head of Compliance',
    ],
    contributors: ['Consumer Affairs Manager', 'Consumer Affairs Analyst', 'Compliance Analyst'],
    valueStreams: ['Risk, Compliance & Audit', 'Sales, Distribution & Marketing'],
  },
  MARKET_CONDUCT: {
    owner: ['Market Conduct / Consumer Compliance Manager', 'Compliance Manager'],
    contributors: ['Compliance Analyst', 'Consumer Affairs Analyst'],
    valueStreams: ['Risk, Compliance & Audit'],
  },
  SUITABILITY: {
    owner: ['Producer Compliance Manager', 'Compliance Manager', 'Head of Compliance'],
    contributors: ['Compliance Analyst', 'Market Conduct / Consumer Compliance Manager'],
    valueStreams: ['Sales, Distribution & Marketing', 'Risk, Compliance & Audit'],
  },
  UNCLAIMED_PROPERTY: {
    owner: ['Compliance Manager', 'Statutory Reporting Manager', 'Compliance Officer'],
    contributors: ['Life Claims Examiner', 'Compliance Analyst'],
    valueStreams: ['Claims', 'Risk, Compliance & Audit'],
  },
  PRODUCT_FILING: {
    owner: ['Product Filing Specialist', 'Regulatory Affairs Manager'],
    contributors: ['Regulatory Filing Specialist', 'Compliance Analyst'],
    valueStreams: ['Product & Delivery', 'Underwriting'],
  },
  LICENSING: {
    owner: ['Producer Compliance Manager', 'Regulatory Affairs Manager'],
    contributors: ['Producer Licensing Coordinator', 'Regulatory Filing Specialist'],
    valueStreams: ['Sales, Distribution & Marketing'],
  },
  PREMIUM_TAX: {
    owner: ['Tax Director', 'Tax Manager'],
    contributors: ['Tax Manager', 'Tax Analyst'],
    valueStreams: ['Finance & Investments'],
  },
  SURPLUS_LINES: {
    owner: ['Regulatory Affairs Manager', 'Compliance Manager'],
    contributors: ['Regulatory Filing Specialist', 'Tax Analyst'],
    valueStreams: ['Underwriting', 'Finance & Investments'],
  },
  WORKERS_COMP_REPORTING: {
    owner: ['Claims Director / Manager', 'Compliance Manager'],
    contributors: ['Claims Analyst', 'Compliance Analyst'],
    valueStreams: ['Claims'],
  },
  AUTO_VERIFICATION: {
    owner: ['Compliance Manager', 'Statutory Reporting Manager'],
    contributors: ['Regulatory Filing Specialist', 'Data Engineer'],
    valueStreams: ['Claims', 'Technology & Engineering'],
  },
  APCD_REPORTING: {
    owner: ['Statutory Reporting Manager', 'Compliance Manager'],
    contributors: ['Data Engineer', 'Compliance Analyst'],
    valueStreams: ['Data & AI', 'Claims'],
  },
  DATA_CALL: {
    owner: ['Statutory Reporting Manager', 'Compliance Manager'],
    contributors: ['Data Analyst', 'Compliance Analyst'],
    valueStreams: ['Finance & Investments', 'Risk, Compliance & Audit'],
  },
};
const DEFAULT_MAP = {
  owner: ['Compliance Officer', 'Head of Compliance', 'Compliance Manager'],
  contributors: ['Compliance Analyst'],
  valueStreams: ['Risk, Compliance & Audit'],
};

async function main() {
  const rows: Row[] = JSON.parse(readFileSync(join(here, 'scrum104-regulations.json'), 'utf-8'));

  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true } });
  if (!company) throw new Error('no company');
  const { id: companyId, tenantId } = company;

  // Resolve the role + value-stream catalogs once.
  const roles = await prisma.role.findMany({
    where: { companyId },
    select: { id: true, displayValue: true },
  });
  const roleByName = new Map(roles.map((r) => [r.displayValue, r.id]));
  const pick = (names: string[]) => {
    for (const n of names) if (roleByName.has(n)) return roleByName.get(n)!;
    return null;
  };

  // Existing jurisdictions by code.
  const jurs = await prisma.jurisdiction.findMany({
    where: { companyId },
    select: { id: true, code: true },
  });
  const jurByCode = new Map(jurs.map((j) => [j.code, j.id]));

  let jCreated = 0,
    rCreated = 0,
    rUpdated = 0,
    roleLinks = 0,
    skippedRoles = 0;

  for (const row of rows) {
    // 1. Jurisdiction — create non-state regulators with neutral taxonomy
    //    placeholders (the state filing-facts UI only renders for state regulators).
    let jurisdictionId = jurByCode.get(row.jurisdictionCode);
    if (!jurisdictionId) {
      const isState = row.regulatorType === 'STATE_INSURANCE_REGULATOR';
      if (!DRY) {
        const created = await prisma.jurisdiction.create({
          data: {
            tenantId,
            companyId,
            code: row.jurisdictionCode,
            name: row.jurisdictionName,
            regulatorName: row.regulatorName,
            regulatorWebsite: row.regulatorWebsite ?? null,
            regulatorType: row.regulatorType,
            filingPortal: isState ? 'MIXED' : 'NA',
            compactStatus: isState ? 'NON_MEMBER' : 'NA',
            autoVerification: isState ? 'NO' : 'NA',
            workersCompModel: isState ? 'STATE_SPECIFIC' : 'NA',
            apcd: isState ? 'NO' : 'NA',
            sbs: isState ? 'NO' : 'NA',
            priorityTier: 'STANDARD',
            profileDepth: 'NARRATIVE',
            lastVerifiedAt: new Date(),
          },
          select: { id: true },
        });
        jurisdictionId = created.id;
      } else {
        jurisdictionId = `dry-${row.jurisdictionCode}`;
      }
      jurByCode.set(row.jurisdictionCode, jurisdictionId);
      jCreated++;
    }

    // 2. RegulatoryRequirement — idempotent by (company, jurisdiction, title)
    const data = {
      category: row.category,
      requirement: row.requirement,
      lineOfBusiness: row.lineOfBusiness,
      citation: row.citation,
      citationUrl: row.citationUrl ?? null,
      obligationType: row.obligationType,
      frequency: row.frequency ?? null,
      status: 'ACTIVE',
      confidence: 'VERIFIED',
      regime: row.regime,
      sourceNote: row.sourceNote ?? 'SCRUM-104 verified research',
      lastVerifiedAt: new Date(),
    };
    let regId: string;
    const existing = await prisma.regulatoryRequirement.findFirst({
      where: { companyId, jurisdictionId, title: row.title },
      select: { id: true },
    });
    if (existing) {
      regId = existing.id;
      if (!DRY) await prisma.regulatoryRequirement.update({ where: { id: existing.id }, data });
      rUpdated++;
    } else {
      if (!DRY) {
        const created = await prisma.regulatoryRequirement.create({
          data: { tenantId, companyId, jurisdictionId, title: row.title, ...data },
          select: { id: true },
        });
        regId = created.id;
      } else {
        regId = `dry-reg-${rCreated}`;
      }
      rCreated++;
    }

    // 3. Owner + contributor roles (RoleRegulation)
    const m = MAP[row.category] ?? DEFAULT_MAP;
    const ownerId = pick(m.owner);
    const contribIds = [
      ...new Set(m.contributors.map((n) => roleByName.get(n)).filter(Boolean)),
    ].filter((id) => id !== ownerId) as string[];
    if (!ownerId) skippedRoles++;
    if (!DRY) {
      await prisma.roleRegulation.deleteMany({ where: { regId } });
      if (ownerId) {
        await prisma.roleRegulation.create({
          data: { companyId, regId, roleId: ownerId, role_: 'Owner' },
        });
        roleLinks++;
      }
      for (const roleId of contribIds) {
        await prisma.roleRegulation.create({
          data: { companyId, regId, roleId, role_: 'Contributor' },
        });
        roleLinks++;
      }
    }
  }

  console.log(
    `${DRY ? '[dry-run] ' : ''}jurisdictions +${jCreated} · requirements +${rCreated} updated ${rUpdated} · roleLinks ${roleLinks} · rows with no owner role ${skippedRoles}`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
