// generate-sources-and-rules.ts — keep the Regulatory Sources and Agent Rules
// (ComplianceRule) catalogs in step with the expanded requirement catalog.
//   • Sources: ensure every jurisdiction has its official regulator site on file
//     (from Jurisdiction.regulatorWebsite) plus the shared NAIC filing systems.
//   • Agent rules: a machine-readable checkable control per state × core
//     obligation (form/rate filing approval, statutory filings, licensing, data
//     security, market conduct, unclaimed property, …), derived from the real
//     control library. Idempotent (upsert by unique keys).
//
// Run (cwd = backend): npx tsx --env-file=.env scripts/generate-sources-and-rules.ts
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// Shared national filing systems (real NAIC / affiliate platforms).
const NATIONAL_SOURCES = [
  {
    name: 'SERFF — System for Electronic Rate and Form Filing',
    url: 'https://www.serff.com',
    sourceType: 'FILING_SYSTEM',
  },
  {
    name: 'NIPR — National Insurance Producer Registry',
    url: 'https://nipr.com',
    sourceType: 'LICENSING_SYSTEM',
  },
  {
    name: 'OPTins — Online Premium Tax for Insurance',
    url: 'https://optins.org',
    sourceType: 'TAX_SYSTEM',
  },
  {
    name: 'NAIC iSite+ / Financial Data Repository',
    url: 'https://content.naic.org',
    sourceType: 'FINANCIAL_SYSTEM',
  },
  {
    name: 'NAIC Market Conduct Annual Statement (MCAS)',
    url: 'https://content.naic.org/industry/mcas',
    sourceType: 'DATA_SYSTEM',
  },
];

// Checkable controls (agent rules) — one per state, derived from the control
// library. Each becomes a ComplianceRule with a small ruleJson check spec.
const RULE_CONTROLS: {
  key: string;
  category: string;
  desc: string;
  check: Record<string, unknown>;
}[] = [
  {
    key: 'form-filing-approved',
    category: 'PRODUCT_FILING',
    desc: 'Verify policy forms are filed and approved (or file-and-use satisfied) via SERFF before issuance.',
    check: {
      type: 'filing_status',
      system: 'SERFF',
      artifact: 'form',
      gate: 'approved_or_file_and_use',
    },
  },
  {
    key: 'rate-filing-approved',
    category: 'PRODUCT_FILING',
    desc: 'Verify P&C rates are filed with actuarial support and effective under the state rating law before use.',
    check: { type: 'filing_status', system: 'SERFF', artifact: 'rate', gate: 'effective' },
  },
  {
    key: 'coa-active',
    category: 'LICENSING',
    desc: 'Verify the certificate of authority is active for every line written in the state.',
    check: { type: 'license_status', license: 'certificate_of_authority', state: 'active' },
  },
  {
    key: 'producer-appointed',
    category: 'LICENSING',
    desc: 'Verify each transacting producer holds a current state license and appointment via NIPR.',
    check: { type: 'producer_status', source: 'NIPR', requires: ['license', 'appointment'] },
  },
  {
    key: 'annual-statement-filed',
    category: 'FINANCIAL_REPORTING',
    desc: 'Verify the statutory annual statement is filed with the state and NAIC by March 1.',
    check: { type: 'deadline', artifact: 'annual_statement', due: '03-01' },
  },
  {
    key: 'quarterly-statement-filed',
    category: 'FINANCIAL_REPORTING',
    desc: 'Verify quarterly statements are filed within 45 days of quarter-end.',
    check: { type: 'deadline', artifact: 'quarterly_statement', due: 'quarter_end+45d' },
  },
  {
    key: 'rbc-above-action-level',
    category: 'SOLVENCY_CAPITAL',
    desc: 'Verify total adjusted capital remains above RBC action levels and the RBC report is filed.',
    check: { type: 'threshold', metric: 'rbc_ratio', min: 'company_action_level' },
  },
  {
    key: 'premium-tax-paid',
    category: 'PREMIUM_TAX',
    desc: 'Verify premium (and retaliatory) tax is filed and paid via OPTins by the state due date.',
    check: { type: 'deadline', artifact: 'premium_tax_return', system: 'OPTins' },
  },
  {
    key: 'mcas-submitted',
    category: 'MARKET_CONDUCT',
    desc: 'Verify the Market Conduct Annual Statement is submitted for designated lines.',
    check: { type: 'deadline', artifact: 'mcas', system: 'NAIC_MCAS' },
  },
  {
    key: 'data-security-program',
    category: 'CYBERSECURITY',
    desc: 'Verify a written information security program exists and cyber events are reported within 72 hours.',
    check: { type: 'program', program: 'information_security', breach_notice_hours: 72 },
  },
  {
    key: 'privacy-notice-current',
    category: 'DATA_PRIVACY',
    desc: 'Verify GLBA/Model 672 privacy notices are current and opt-outs honored.',
    check: { type: 'program', program: 'privacy_notice', cadence: 'annual' },
  },
  {
    key: 'unclaimed-property-reported',
    category: 'UNCLAIMED_PROPERTY',
    desc: 'Verify unclaimed insurance proceeds are due-diligenced, reported and remitted by the deadline.',
    check: { type: 'deadline', artifact: 'unclaimed_property_report' },
  },
  {
    key: 'unfair-claims-compliance',
    category: 'MARKET_CONDUCT',
    desc: 'Verify claims handling meets the state unfair claims settlement practices timeframes.',
    check: { type: 'program', program: 'claims_handling', standard: 'unfair_claims_act' },
  },
  {
    key: 'guaranty-assessment-paid',
    category: 'RESIDUAL_MARKET',
    desc: 'Verify guaranty-association membership is active and assessments are paid.',
    check: { type: 'membership', body: 'guaranty_association', status: 'active' },
  },
  {
    key: 'actuarial-opinion-filed',
    category: 'ACTUARIAL_VALUATION',
    desc: 'Verify the statement of actuarial opinion on reserves is filed annually.',
    check: { type: 'deadline', artifact: 'actuarial_opinion' },
  },
];

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true } });
  if (!company) throw new Error('no company');
  const { id: companyId, tenantId } = company;

  const jurs = await prisma.jurisdiction.findMany({
    where: { companyId },
    select: {
      id: true,
      code: true,
      name: true,
      regulatorName: true,
      regulatorWebsite: true,
      regulatorType: true,
    },
  });
  const states = jurs.filter((j) => j.regulatorType === 'STATE_INSURANCE_REGULATOR');

  // ── Sources ────────────────────────────────────────────────────────────────
  let srcCreated = 0;
  const existingSources = await prisma.regulatorySource.findMany({
    where: { companyId },
    select: { url: true, jurisdictionId: true },
  });
  const srcKey = new Set(existingSources.map((s) => `${s.jurisdictionId ?? ''}|${s.url}`));
  for (const j of jurs) {
    if (!j.regulatorWebsite) continue;
    if (srcKey.has(`${j.id}|${j.regulatorWebsite}`)) continue;
    await prisma.regulatorySource.create({
      data: {
        tenantId,
        companyId,
        jurisdictionId: j.id,
        name: `${j.regulatorName} — official site`,
        url: j.regulatorWebsite,
        sourceType: 'REGULATOR_SITE',
        authority: 'OFFICIAL_REGULATOR',
        monitor: false,
        checkTier: 'WEEKLY',
        healthStatus: 'OK',
      },
    });
    srcCreated++;
  }
  // National shared systems (no jurisdiction).
  for (const s of NATIONAL_SOURCES) {
    if ([...srcKey].some((k) => k.endsWith(`|${s.url}`))) continue;
    const exists = await prisma.regulatorySource.findFirst({
      where: { companyId, url: s.url },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.regulatorySource.create({
      data: {
        tenantId,
        companyId,
        jurisdictionId: null,
        name: s.name,
        url: s.url,
        sourceType: s.sourceType,
        authority: 'OFFICIAL_REGULATOR',
        monitor: false,
        checkTier: 'WEEKLY',
        healthStatus: 'OK',
      },
    });
    srcCreated++;
  }

  // ── Agent rules ──────────────────────────────────────────────────────────────
  let ruleCreated = 0;
  const rows: {
    id?: string;
    tenantId: string;
    companyId: string;
    jurisdictionId: string;
    ruleCode: string;
    category: string;
    description: string;
    ruleJson: object;
    origin: string;
    active: boolean;
  }[] = [];
  for (const st of states) {
    for (const c of RULE_CONTROLS) {
      rows.push({
        tenantId,
        companyId,
        jurisdictionId: st.id,
        ruleCode: `${st.code}-${c.key}`,
        category: c.category,
        description: `${st.name}: ${c.desc}`,
        ruleJson: { jurisdiction: st.code, control: c.key, ...c.check },
        origin: 'TEMPLATE_DERIVED',
        active: true,
      });
    }
  }
  // Upsert by unique [companyId, ruleCode].
  const existingRules = new Set(
    (
      await prisma.complianceRule.findMany({ where: { companyId }, select: { ruleCode: true } })
    ).map((r) => r.ruleCode),
  );
  const toCreate = rows.filter((r) => !existingRules.has(r.ruleCode));
  for (let i = 0; i < toCreate.length; i += 1000) {
    await prisma.complianceRule.createMany({
      data: toCreate.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  ruleCreated = toCreate.length;

  const [srcTotal, ruleTotal] = await Promise.all([
    prisma.regulatorySource.count({ where: { companyId } }),
    prisma.complianceRule.count({ where: { companyId, active: true } }),
  ]);
  console.log(
    `sources +${srcCreated} (total ${srcTotal}) · agent rules +${ruleCreated} (total ${ruleTotal})`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
