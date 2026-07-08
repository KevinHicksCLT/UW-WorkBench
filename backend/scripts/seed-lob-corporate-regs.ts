// seed-lob-corporate-regs.ts — seed the deep-researched LOB-gap + Corporate-
// Functions regulation catalog (lob-corporate-regulations.json) produced by the
// lob-corporate-regulation-research workflow. Each row is a real, adversarially
// verified obligation with a market tag and (where line-specific) granular lines.
//
// For every row: upsert the issuing Jurisdiction (states/EU/UK exist; NAIC,
// IAIS, FED and new FED-* agencies are created with non-state placeholders),
// upsert the RegulatoryRequirement (idempotent by company+jurisdiction+title)
// with VERIFIED confidence + markets, wire owner + contributor roles by category,
// and link granular lines of business through RequirementLineOfBusiness.
//
// Idempotent. Run (cwd = backend):
//   npx tsx --env-file=.env scripts/seed-lob-corporate-regs.ts --dry-run
//   npx tsx --env-file=.env scripts/seed-lob-corporate-regs.ts
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
  regulatorType: string;
  regime: string;
  title: string;
  requirement: string;
  category: string;
  markets?: string[];
  lines?: string[];
  obligationType: string;
  frequency?: string;
  citation: string;
  citationUrl?: string;
  sourceNote?: string;
};

// category → owner + contributor role candidates (first existing wins).
const MAP: Record<string, { owner: string[]; contributors: string[] }> = {
  DATA_PRIVACY: {
    owner: ['Privacy Officer', 'Data Protection Officer', 'Compliance Officer'],
    contributors: ['Data Protection Officer', 'Data Privacy Steward', 'Compliance Analyst'],
  },
  CYBERSECURITY: {
    owner: ['Chief Info Security Officer', 'IT Security Manager', 'Compliance Officer'],
    contributors: ['Cybersecurity Lead', 'IT Security Manager', 'Compliance Analyst'],
  },
  AI_GOVERNANCE: {
    owner: ['Chief Data Officer', 'Model Risk Manager', 'Head of Compliance'],
    contributors: ['Model Risk Manager', 'Data Governance Lead', 'Compliance Manager'],
  },
  SANCTIONS_AML: {
    owner: ['Financial Crime AML Officer', 'Compliance Officer', 'Head of Compliance'],
    contributors: ['Sanctions Analyst', 'AML Analyst', 'Financial Crime Investigator'],
  },
  FINANCIAL_REPORTING: {
    owner: ['Statutory Reporting Manager', 'Controller', 'Chief Financial Officer'],
    contributors: ['Controller', 'Accountant', 'Compliance Analyst'],
  },
  ACCOUNTING_AUDIT: {
    owner: ['Controller', 'Statutory Reporting Manager', 'Chief Financial Officer'],
    contributors: ['Accountant', 'Statutory Reporting Manager', 'Compliance Analyst'],
  },
  CORPORATE_GOVERNANCE: {
    owner: ['General Counsel', 'Head of Compliance', 'Chief Risk Officer'],
    contributors: ['Compliance Officer', 'Legal Counsel', 'Compliance Analyst'],
  },
  SOLVENCY_CAPITAL: {
    owner: ['Chief Actuary', 'Chief Risk Officer', 'Chief Financial Officer'],
    contributors: [
      'Capital Model Actuary',
      'Enterprise Risk Manager',
      'Statutory Reporting Manager',
    ],
  },
  ACTUARIAL_VALUATION: {
    owner: ['Appointed Actuary', 'Chief Actuary', 'Reserving Actuary'],
    contributors: ['Reserving Actuary', 'Actuarial Analyst', 'Capital Model Actuary'],
  },
  TAX_REPORTING: {
    owner: ['Tax Director', 'Tax Manager'],
    contributors: ['Tax Manager', 'Tax Analyst'],
  },
  EMPLOYMENT_BENEFITS: {
    owner: ['Employment Counsel', 'Head of Compliance', 'General Counsel'],
    contributors: ['Legal Counsel', 'Compliance Analyst'],
  },
  ANTITRUST_CONDUCT: {
    owner: ['General Counsel', 'Head of Compliance'],
    contributors: ['Legal Counsel', 'Compliance Analyst'],
  },
  ESG_SUSTAINABILITY: {
    owner: ['Chief Risk Officer', 'Head of Compliance'],
    contributors: ['Enterprise Risk Manager', 'Compliance Analyst'],
  },
  SECURITIES_DISTRIBUTION: {
    owner: ['Producer Compliance Manager', 'Head of Compliance', 'Compliance Officer'],
    contributors: ['Compliance Analyst', 'Market Conduct / Consumer Compliance Manager'],
  },
  OPERATIONAL_RESILIENCE: {
    owner: ['Operational Resilience Lead', 'Business Continuity Manager', 'Chief Risk Officer'],
    contributors: ['Business Continuity Manager', 'Third-Party Risk Manager', 'Cybersecurity Lead'],
  },
  CLIMATE_RISK: {
    owner: ['Chief Risk Officer', 'Enterprise Risk Manager', 'Head of Compliance'],
    contributors: [
      'Enterprise Risk Manager',
      'Catastrophe & Exposure Manager',
      'Compliance Analyst',
    ],
  },
  CATASTROPHE_REPORTING: {
    owner: ['Catastrophe & Exposure Manager', 'Chief Risk Officer', 'Statutory Reporting Manager'],
    contributors: ['Enterprise Risk Manager', 'Statutory Reporting Manager', 'Data Analyst'],
  },
  CONSUMER_PROTECTION: {
    owner: [
      'Market Conduct / Consumer Compliance Manager',
      'Compliance Manager',
      'Head of Compliance',
    ],
    contributors: ['Consumer Affairs Manager', 'Consumer Affairs Analyst', 'Compliance Analyst'],
  },
  MARKET_CONDUCT: {
    owner: ['Market Conduct / Consumer Compliance Manager', 'Compliance Manager'],
    contributors: ['Compliance Analyst', 'Consumer Affairs Analyst'],
  },
  SUITABILITY: {
    owner: ['Producer Compliance Manager', 'Compliance Manager', 'Head of Compliance'],
    contributors: ['Compliance Analyst', 'Market Conduct / Consumer Compliance Manager'],
  },
  UNCLAIMED_PROPERTY: {
    owner: ['Compliance Manager', 'Statutory Reporting Manager', 'Compliance Officer'],
    contributors: ['Life Claims Examiner', 'Compliance Analyst'],
  },
  PRODUCT_FILING: {
    owner: ['Product Filing Specialist', 'Regulatory Affairs Manager'],
    contributors: ['Regulatory Filing Specialist', 'Compliance Analyst'],
  },
  LICENSING: {
    owner: ['Producer Compliance Manager', 'Regulatory Affairs Manager'],
    contributors: ['Producer Licensing Coordinator', 'Regulatory Filing Specialist'],
  },
  PREMIUM_TAX: {
    owner: ['Tax Director', 'Tax Manager'],
    contributors: ['Tax Manager', 'Tax Analyst'],
  },
  SURPLUS_LINES: {
    owner: ['Regulatory Affairs Manager', 'Compliance Manager'],
    contributors: ['Regulatory Filing Specialist', 'Tax Analyst'],
  },
  RESIDUAL_MARKET: {
    owner: ['Regulatory Affairs Manager', 'Compliance Manager'],
    contributors: ['Statutory Reporting Manager', 'Compliance Analyst'],
  },
  WORKERS_COMP_REPORTING: {
    owner: ['Claims Director / Manager', 'Compliance Manager'],
    contributors: ['Claims Analyst', 'Compliance Analyst'],
  },
  AUTO_VERIFICATION: {
    owner: ['Compliance Manager', 'Statutory Reporting Manager'],
    contributors: ['Regulatory Filing Specialist', 'Data Engineer'],
  },
  APCD_REPORTING: {
    owner: ['Statutory Reporting Manager', 'Compliance Manager'],
    contributors: ['Data Engineer', 'Compliance Analyst'],
  },
  DATA_CALL: {
    owner: ['Statutory Reporting Manager', 'Compliance Manager'],
    contributors: ['Data Analyst', 'Compliance Analyst'],
  },
};
const DEFAULT_MAP = {
  owner: ['Compliance Officer', 'Head of Compliance', 'Compliance Manager'],
  contributors: ['Compliance Analyst'],
};

// Regulator name per synthetic multistate / global jurisdiction code.
const JUR_META: Record<string, { name: string; regName: string; site: string; type: string }> = {
  NAIC: {
    name: 'NAIC model (adopted state-by-state)',
    regName: 'State insurance commissioner (domiciliary)',
    site: 'https://content.naic.org',
    type: 'STATE_INSURANCE_REGULATOR',
  },
  IAIS: {
    name: 'International (IAIS global standards)',
    regName: 'International Association of Insurance Supervisors',
    site: 'https://www.iaisweb.org',
    type: 'INTERNATIONAL',
  },
  FED: {
    name: 'United States (Federal)',
    regName: 'U.S. federal regulators',
    site: 'https://www.usa.gov',
    type: 'FEDERAL',
  },
};

const VALID_MARKETS = new Set(['PERSONAL', 'COMMERCIAL']);
const normMarkets = (m?: string[]): string[] => {
  const out = new Set<string>();
  for (const raw of m ?? []) {
    const u = String(raw).toUpperCase();
    if (u.includes('PERSONAL')) out.add('PERSONAL');
    if (u.includes('COMMERCIAL')) out.add('COMMERCIAL');
  }
  const arr = [...out].filter((x) => VALID_MARKETS.has(x));
  return arr.length ? arr : ['PERSONAL', 'COMMERCIAL'];
};

const normLabel = (s: string) =>
  s.replace(/[–—�]/g, '-').replace(/&/g, ' and ').replace(/\s+/g, ' ').trim().toLowerCase();

// Research used common line variants not verbatim in the taxonomy vocabulary —
// map each to the canonical label(s) it corresponds to (one variant may fan out
// to several taxonomy lines). Keyed by normLabel().
const LINE_ALIASES: Record<string, string[]> = {
  'individual life': [
    'Individual Life — Whole Life',
    'Individual Life — Term',
    'Individual Life — Universal',
    'Individual Life — Variable',
  ],
  'whole life': ['Individual Life — Whole Life'],
  'term life': ['Individual Life — Term'],
  'universal life': ['Individual Life — Universal'],
  'individual life - universal life': ['Individual Life — Universal'],
  'individual life - variable universal life': ['Individual Life — Variable Universal'],
  'individual life - indexed universal life': ['Individual Life — Indexed'],
  'individual life - term life': ['Individual Life — Term'],
  'individual health': ['Comprehensive (Hospital & Medical) — Individual'],
  annuities: ['Individual Annuities — Fixed'],
  annuity: ['Individual Annuities — Fixed'],
  'individual annuity': ['Individual Annuities — Fixed'],
  'individual annuities': ['Individual Annuities — Fixed'],
  'fixed annuity': ['Individual Annuities — Fixed'],
  'fixed annuities': ['Individual Annuities — Fixed'],
  'variable annuity': [
    'Individual Annuities — Variable with Guarantees',
    'Individual Annuities — Variable without Guarantees',
  ],
  'fixed indexed annuity': ['Individual Annuities — Indexed'],
  'registered index-linked annuity': ['Registered Index-Linked Annuities'],
  'contingent deferred annuity': ['Individual Annuities — Variable with Guarantees'],
  'group annuity': ['Group Annuities / Pension Risk Transfer'],
  'group annuities': ['Group Annuities / Pension Risk Transfer'],
  'pension risk transfer': ['Group Annuities / Pension Risk Transfer'],
  homeowners: ['Homeowners Multiple Peril'],
  renters: ['Homeowners Multiple Peril'],
  condominium: ['Homeowners Multiple Peril'],
  'dwelling fire': ['Fire', 'Allied Lines'],
  'personal auto': [
    'Private Passenger Auto Physical Damage',
    'Other Private Passenger Auto Liability',
  ],
  automobile: ['Private Passenger Auto Physical Damage', 'Other Private Passenger Auto Liability'],
  'commercial auto': ['Commercial Auto Physical Damage', 'Other Commercial Auto Liability'],
  'commercial property': ['Commercial Multiple Peril (non-liability portion)', 'Fire'],
  flood: ['Private Flood', 'Federal Flood'],
  pet: ['Pet Insurance Plans'],
  travel: ['Assistance'],
  'service contract': ['Service Warranties', 'Warranty'],
  'warranty / service contracts': ['Service Warranties', 'Warranty'],
  'boiler & machinery': ['Boiler and Machinery'],
  'other liability': ['Other Liability — occurrence', 'Other Liability — claims-made'],
  'professional liability / e and o': [
    'Medical Professional Liability — occurrence',
    'Medical Professional Liability — claims-made',
  ],
  'medical professional liability': [
    'Medical Professional Liability — occurrence',
    'Medical Professional Liability — claims-made',
  ],
  'medical malpractice': [
    'Medical Professional Liability — occurrence',
    'Medical Professional Liability — claims-made',
  ],
  'directors and officers (d and o)': ['Other Liability — claims-made'],
  'workers compensation': ["Workers' Compensation"],
  'excess workers comp': ["Excess Workers' Compensation"],
  'medicare advantage': ['Medicare Title XVIII'],
  'medicare part d': ['Medicare Title XVIII'],
  'medicaid managed care': ['Medicaid Title XIX'],
  'credit / credit life / credit a and h': ['Credit', 'Credit Life', 'Credit Accident & Health'],
  'mortgage guaranty / mi': ['Mortgage Guaranty'],
};

async function main() {
  const rows: Row[] = JSON.parse(
    readFileSync(join(here, 'lob-corporate-regulations.json'), 'utf-8'),
  );
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true } });
  if (!company) throw new Error('no company');
  const { id: companyId, tenantId } = company;

  const roles = await prisma.role.findMany({
    where: { companyId },
    select: { id: true, displayValue: true },
  });
  const roleByName = new Map(roles.map((r) => [r.displayValue, r.id]));
  const pick = (names: string[]) => {
    for (const n of names) if (roleByName.has(n)) return roleByName.get(n)!;
    return null;
  };

  const lobs = await prisma.lineOfBusiness.findMany({
    where: { companyId },
    select: { id: true, label: true },
  });
  const lobByLabel = new Map(lobs.map((l) => [normLabel(l.label), l.id]));

  const jurs = await prisma.jurisdiction.findMany({
    where: { companyId },
    select: { id: true, code: true },
  });
  const jurByCode = new Map(jurs.map((j) => [j.code, j.id]));

  let jCreated = 0,
    rCreated = 0,
    rUpdated = 0,
    roleLinks = 0,
    lobLinks = 0;
  const unmatchedLines = new Set<string>();

  for (const row of rows) {
    // 1. Jurisdiction
    let jurisdictionId = jurByCode.get(row.jurisdictionCode);
    if (!jurisdictionId) {
      const meta = JUR_META[row.jurisdictionCode];
      const isState = (meta?.type ?? row.regulatorType) === 'STATE_INSURANCE_REGULATOR';
      if (!DRY) {
        const created = await prisma.jurisdiction.create({
          data: {
            tenantId,
            companyId,
            code: row.jurisdictionCode,
            name: meta?.name ?? row.jurisdictionName,
            regulatorName: meta?.regName ?? row.regulatorName,
            regulatorWebsite: meta?.site ?? row.regulatorWebsite ?? null,
            regulatorType: meta?.type ?? row.regulatorType,
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
      } else jurisdictionId = `dry-${row.jurisdictionCode}`;
      jurByCode.set(row.jurisdictionCode, jurisdictionId);
      jCreated++;
    }

    // 2. Requirement
    const data = {
      category: row.category,
      requirement: row.requirement,
      markets: normMarkets(row.markets),
      // Granular lines live in the RequirementLineOfBusiness junction; the coarse
      // scalar stays ALL (the junction is the source of truth for line display).
      lineOfBusiness: 'ALL',
      citation: row.citation,
      citationUrl: row.citationUrl ?? null,
      obligationType: row.obligationType,
      frequency: row.frequency ?? 'periodic',
      status: 'ACTIVE',
      confidence: 'VERIFIED',
      regime: row.regime,
      sourceNote: row.sourceNote ?? 'LOB/corporate verified research',
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
      } else regId = `dry-reg-${rCreated}`;
      rCreated++;
    }

    // 3. Roles
    const m = MAP[row.category] ?? DEFAULT_MAP;
    const ownerId = pick(m.owner);
    const contribIds = [
      ...new Set(m.contributors.map((n) => roleByName.get(n)).filter(Boolean)),
    ].filter((id) => id !== ownerId) as string[];
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

    // 4. Line-of-business junction links (resolve variants via alias map;
    //    a variant may fan out to several canonical taxonomy lines).
    if (!DRY) await prisma.requirementLineOfBusiness.deleteMany({ where: { regId } });
    const targetLobIds = new Set<string>();
    for (const lineLabel of row.lines ?? []) {
      const key = normLabel(lineLabel);
      const direct = lobByLabel.get(key);
      const candidates = direct
        ? [direct]
        : (LINE_ALIASES[key] ?? []).map((c) => lobByLabel.get(normLabel(c))).filter(Boolean);
      if (!candidates.length) {
        unmatchedLines.add(lineLabel);
        continue;
      }
      for (const id of candidates) targetLobIds.add(id as string);
    }
    for (const lobId of targetLobIds) {
      if (!DRY) {
        await prisma.requirementLineOfBusiness.upsert({
          where: { regId_lobId: { regId, lobId } },
          update: {},
          create: { companyId, regId, lobId },
        });
      }
      lobLinks++;
    }
  }

  console.log(
    `${DRY ? '[dry-run] ' : ''}jurisdictions +${jCreated} · requirements +${rCreated} updated ${rUpdated} · roleLinks ${roleLinks} · lobLinks ${lobLinks}`,
  );
  if (unmatchedLines.size)
    console.log(
      `  unmatched line labels (${unmatchedLines.size}): ${[...unmatchedLines].slice(0, 20).join(' | ')}`,
    );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
