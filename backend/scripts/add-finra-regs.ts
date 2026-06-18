// E-02 — add FINRA / SEC / MSRB securities-distribution requirements.
// ABC distributes variable/registered products (variable annuities & life,
// 529s) through a broker-dealer, so FINRA applies; Reg BI is SEC; 529s are MSRB.
// Source: defect tracker 'FINRA Mapping' sheet (researched, VERIFIED).
//
// Idempotent: deletes the three federal jurisdictions + any requirement tagged
// sourceNote LIKE 'E-02%' for the company, then rebuilds. Re-runnable.
//   npx tsx scripts/add-finra-regs.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const FEDERAL = 'FEDERAL_SECURITIES';
const TAG = 'E-02 (FINRA Mapping sheet)';

// regulator code -> jurisdiction definition
const REGULATORS = [
  { code: 'FINRA', name: 'FINRA (Federal — Securities)', regulatorName: 'Financial Industry Regulatory Authority', regulatorWebsite: 'https://www.finra.org/rules-guidance' },
  { code: 'SEC', name: 'SEC (Federal — Securities)', regulatorName: 'U.S. Securities and Exchange Commission', regulatorWebsite: 'https://www.sec.gov' },
  { code: 'MSRB', name: 'MSRB (Federal — Municipal Securities)', regulatorName: 'Municipal Securities Rulemaking Board', regulatorWebsite: 'https://www.msrb.org' },
];

// requirement -> value streams it governs (names must match ValueStream rows)
type Req = {
  reg: 'FINRA' | 'SEC' | 'MSRB';
  category: string;
  title: string;
  requirement: string;
  citation: string;
  citationUrl: string;
  obligationType: string;
  lineOfBusiness: string;
  vs: { name: string; relationship: string }[];
};

const DIST = 'Distribution & Channel Management';
const COMPL = 'Risk, Compliance & Regulatory Management';
const MKTG = 'Marketing, Growth & Customer Insights';
const ANN = 'Annuity New Business & Servicing';
const LIFE = 'Life New Business & Underwriting';
const PROD = 'Product & Proposition Management';

const REQS: Req[] = [
  {
    reg: 'FINRA', category: 'SECURITIES_DISTRIBUTION',
    title: 'Applicability — registered products distributed via broker-dealer',
    requirement:
      'FINRA rules apply because ABC distributes registered products (variable annuities, variable life, RILAs, mutual funds, 529s) through an affiliated/third-party broker-dealer. Fixed annuities and traditional life are not securities (state/NAIC only). All FINRA/SEC/MSRB requirements below are conditional on this distribution gate.',
    citation: 'SEC variable-annuities investor bulletin', citationUrl: 'https://www.sec.gov/resources-for-investors/investor-alerts-bulletins/varannty',
    obligationType: 'INFORMATIONAL', lineOfBusiness: 'LIFE_ANNUITY',
    vs: [{ name: COMPL, relationship: 'GOVERNS' }, { name: DIST, relationship: 'INFORMS' }],
  },
  {
    reg: 'FINRA', category: 'SECURITIES_DISTRIBUTION',
    title: 'FINRA Rule 2330 — Deferred variable annuity transactions',
    requirement:
      "Members' responsibilities for deferred variable annuities: disclosure of surrender charges/fees/tax/risk, principal review within 7 business days, plus training and exchange surveillance programs.",
    citation: 'FINRA Rule 2330', citationUrl: 'https://www.finra.org/rules-guidance/rulebooks/finra-rules/2330',
    obligationType: 'EVENT_DRIVEN', lineOfBusiness: 'LIFE_ANNUITY',
    vs: [{ name: DIST, relationship: 'GOVERNS' }, { name: ANN, relationship: 'GOVERNS' }, { name: COMPL, relationship: 'GOVERNS' }],
  },
  {
    reg: 'FINRA', category: 'SECURITIES_DISTRIBUTION',
    title: 'FINRA Rule 2111 — Suitability',
    requirement:
      'Reasonable-basis, customer-specific and quantitative suitability for recommended securities/strategies. Largely superseded by SEC Reg BI for retail recommendations.',
    citation: 'FINRA Rule 2111', citationUrl: 'https://www.finra.org/rules-guidance/rulebooks/finra-rules/2111',
    obligationType: 'EVENT_DRIVEN', lineOfBusiness: 'LIFE_ANNUITY',
    vs: [{ name: ANN, relationship: 'GOVERNS' }, { name: LIFE, relationship: 'GOVERNS' }, { name: DIST, relationship: 'GOVERNS' }],
  },
  {
    reg: 'SEC', category: 'SECURITIES_DISTRIBUTION',
    title: 'SEC Regulation Best Interest (Reg BI)',
    requirement:
      'Broker-dealer must act in the retail customer’s best interest at the time of recommendation (Disclosure, Care, Conflict-of-Interest and Compliance obligations). Largely supersedes Rule 2111 for retail; FINRA examines for it.',
    citation: 'SEC Regulation Best Interest (17 CFR 240.15l-1)', citationUrl: 'https://www.sec.gov/regulation-best-interest',
    obligationType: 'ONGOING', lineOfBusiness: 'LIFE_ANNUITY',
    vs: [{ name: DIST, relationship: 'GOVERNS' }, { name: COMPL, relationship: 'GOVERNS' }],
  },
  {
    reg: 'FINRA', category: 'SECURITIES_DISTRIBUTION',
    title: 'FINRA Rule 2210 — Communications with the public',
    requirement:
      'Communications must be fair, balanced and not misleading; principal pre-approval required; certain retail communications filed with FINRA.',
    citation: 'FINRA Rule 2210', citationUrl: 'https://www.finra.org/rules-guidance/rulebooks/finra-rules/2210',
    obligationType: 'ONGOING', lineOfBusiness: 'LIFE_ANNUITY',
    vs: [{ name: MKTG, relationship: 'GOVERNS' }, { name: COMPL, relationship: 'GOVERNS' }],
  },
  {
    reg: 'FINRA', category: 'SECURITIES_DISTRIBUTION',
    title: 'FINRA Rule 3110 — Supervision',
    requirement:
      'Supervisory system plus written supervisory procedures (WSPs); designated principals; review of business, communications and complaints.',
    citation: 'FINRA Rule 3110', citationUrl: 'https://www.finra.org/rules-guidance/rulebooks/finra-rules/3110',
    obligationType: 'ONGOING', lineOfBusiness: 'LIFE_ANNUITY',
    vs: [{ name: COMPL, relationship: 'GOVERNS' }],
  },
  {
    reg: 'FINRA', category: 'SECURITIES_DISTRIBUTION',
    title: 'FINRA Rule 2320 — Variable contracts of an insurance company',
    requirement:
      'Receipt/transmittal of payments, sales-charge limits, and member-as-principal-underwriter requirements for variable contracts.',
    citation: 'FINRA Rule 2320', citationUrl: 'https://www.finra.org/rules-guidance/rulebooks/finra-rules/2320',
    obligationType: 'ONGOING', lineOfBusiness: 'LIFE_ANNUITY',
    vs: [{ name: PROD, relationship: 'GOVERNS' }, { name: DIST, relationship: 'GOVERNS' }],
  },
  {
    reg: 'MSRB', category: 'SECURITIES_DISTRIBUTION',
    title: 'MSRB rules — 529 plan (municipal fund securities) distribution',
    requirement:
      '529 college-savings plans are municipal fund securities governed by MSRB rules (FINRA enforces): suitability/care (Rule G-19), fair dealing (G-17), supervision (G-27) and advertising (G-21). Applies where 529 distribution is in scope.',
    citation: 'MSRB Rules G-17/G-19/G-21/G-27', citationUrl: 'https://www.finra.org/investors/insights/529-savings-plans',
    obligationType: 'ONGOING', lineOfBusiness: 'LIFE_ANNUITY',
    vs: [{ name: DIST, relationship: 'GOVERNS' }, { name: COMPL, relationship: 'INFORMS' }],
  },
];

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;
  console.log(`Company: ${company.name} (${companyId})`);

  // Clean prior E-02 rows (idempotent re-run).
  await prisma.regulatoryRequirement.deleteMany({ where: { companyId, sourceNote: { startsWith: 'E-02' } } });
  await prisma.jurisdiction.deleteMany({ where: { companyId, regulatorType: FEDERAL } });

  // Federal jurisdictions. State-flag columns are NOT NULL — use NA sentinels.
  const jurId = new Map<string, string>();
  for (const r of REGULATORS) {
    const j = await prisma.jurisdiction.create({
      data: {
        tenantId, companyId, code: r.code, name: r.name,
        regulatorName: r.regulatorName, regulatorWebsite: r.regulatorWebsite, regulatorType: FEDERAL,
        filingPortal: 'NA', compactStatus: 'NA', autoVerification: 'NA', workersCompModel: 'NA', apcd: 'NA', sbs: 'NA',
        priorityTier: 'STANDARD', profileDepth: 'NARRATIVE',
        summaryRegulator: `${r.regulatorName} — federal securities regulator. Applies to ABC's registered-product distribution via broker-dealer.`,
      },
    });
    jurId.set(r.code, j.id);
  }

  const vsRows = await prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true } });
  const vsId = new Map(vsRows.map((v) => [v.name, v.id]));

  let nReq = 0, nLink = 0, missing = new Set<string>();
  for (const req of REQS) {
    const row = await prisma.regulatoryRequirement.create({
      data: {
        tenantId, companyId, jurisdictionId: jurId.get(req.reg)!,
        category: req.category, title: req.title, requirement: req.requirement,
        lineOfBusiness: req.lineOfBusiness, citation: req.citation, citationUrl: req.citationUrl,
        obligationType: req.obligationType, status: 'ACTIVE', confidence: 'VERIFIED',
        sourceNote: TAG,
      },
    });
    nReq++;
    for (const link of req.vs) {
      const id = vsId.get(link.name);
      if (!id) { missing.add(link.name); continue; }
      await prisma.requirementValueStream.create({
        data: { requirementId: row.id, valueStreamId: id, relationship: link.relationship, notes: TAG },
      });
      nLink++;
    }
  }
  console.log(`Created ${REGULATORS.length} federal jurisdictions, ${nReq} requirements, ${nLink} value-stream links.`);
  if (missing.size) console.log('MISSING value streams (links skipped):', [...missing].join(', '));
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
