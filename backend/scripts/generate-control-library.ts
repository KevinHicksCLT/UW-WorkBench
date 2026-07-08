// generate-control-library.ts — materialize the real per-jurisdiction × per-line
// compliance-obligation matrix that gives a multinational insurer its true
// 15k-50k-row inventory. Each generated row is a REAL obligation (every US state
// genuinely requires rate/form filing, licensing, premium tax, market-conduct,
// financial reporting, data-security, unclaimed-property, etc.), cited at the
// governing-framework grain with the actual regulator named — no invented
// section numbers. This is exactly how GRC control libraries are built: a
// control library × a jurisdiction/line applicability matrix.
//
// Grounding: states, regulator names, and DOI URLs are read from the live
// Jurisdiction rows; lines/groups from LineOfBusiness. Owner/contributor roles
// resolve from the live Role catalog. Everything is written to the DB (single
// source of truth). Idempotent: prior CONTROL-LIB rows are deleted first.
//
// Run (cwd = backend):
//   npx tsx --env-file=.env scripts/generate-control-library.ts --dry-run
//   npx tsx --env-file=.env scripts/generate-control-library.ts
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/db/prisma.js';

const DRY = process.argv.includes('--dry-run');
const MARKER = 'CONTROL-LIB'; // sourceNote prefix — identifies generated rows for idempotent re-runs

// P&C line groups (rate/form/rating obligations apply here).
const PC_GROUPS = [
  'Property',
  'Personal Auto',
  'Commercial Auto',
  'Liability',
  "Workers' Compensation",
  'Marine & Aviation',
  'Financial & Credit',
  'Specialty & Other',
  'Alternative Risk',
];
const LIFE_GROUPS = ['Individual Life', 'Group Life'];
const ANNUITY_GROUPS = ['Individual Annuities', 'Group Annuities'];
const HEALTH_GROUPS = ['Medical & Health'];
const ALL_GROUPS = [
  ...PC_GROUPS,
  ...LIFE_GROUPS,
  ...ANNUITY_GROUPS,
  ...HEALTH_GROUPS,
  'Reinsurance',
  'Title',
];

type Tmpl = {
  key: string;
  regime: string;
  category: string;
  obligationType: string;
  frequency: string;
  markets: string[];
  ownerCat: string; // category key into the role map (defaults to category)
  // Applicability
  groups?: string[]; // per-line-group; omit for entity-level (no line links)
  perLine?: boolean; // true → iterate each individual line in `groups` (one row per line)
  citation: string; // framework-grain citation (state name interpolated as {ST})
  title: (state: string, group?: string) => string;
  requirement: (state: string, regulator: string, group?: string) => string;
};

const g = (state: string, group: string) => `${state} — ${group}`;

// ── Control library: real obligation templates ────────────────────────────────
const TEMPLATES: Tmpl[] = [
  // Entity-level, every state
  {
    key: 'coa',
    regime: 'Certificate of Authority',
    category: 'LICENSING',
    obligationType: 'FILING_GATE',
    frequency: 'annual',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'LICENSING',
    citation: '{ST} Insurance Code — certificate of authority / admission',
    title: (s) => `${s}: Maintain certificate of authority to transact insurance`,
    requirement: (s, r) =>
      `The insurer must hold and annually continue a certificate of authority from the ${r} to transact the lines it writes in ${s}, meeting the state's capital, deposit and good-standing conditions. Lapse or non-renewal bars writing business in the state.`,
  },
  {
    key: 'producer-lic',
    regime: 'Producer Licensing (NAIC Model 218)',
    category: 'LICENSING',
    obligationType: 'ONGOING',
    frequency: 'continuous',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'LICENSING',
    citation: '{ST} Insurance Code producer licensing (NAIC Model 218); via NIPR',
    title: (s) => `${s}: License and appoint producers before solicitation`,
    requirement: (s, r) =>
      `Every producer soliciting or selling on the insurer's behalf in ${s} must hold a current ${r} license and (for captive/exclusive appointments) a company appointment filed via NIPR before transacting business; terminations must be reported.`,
  },
  {
    key: 'premium-tax',
    regime: 'Premium Tax',
    category: 'PREMIUM_TAX',
    obligationType: 'ONGOING',
    frequency: 'annual',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'PREMIUM_TAX',
    citation: '{ST} premium tax statute; filed via OPTins',
    title: (s) => `${s}: File and pay annual premium tax`,
    requirement: (s, r) =>
      `The insurer must file the annual premium-tax return and remit tax on ${s}-written premium to the ${r} (or state revenue authority) by the statutory due date, with estimated/prepayment instalments where required.`,
  },
  {
    key: 'retaliatory-tax',
    regime: 'Retaliatory Tax',
    category: 'PREMIUM_TAX',
    obligationType: 'ONGOING',
    frequency: 'annual',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'PREMIUM_TAX',
    citation: '{ST} retaliatory tax provision',
    title: (s) => `${s}: Compute and pay retaliatory tax`,
    requirement: (s, r) =>
      `As a foreign insurer, compute ${s} retaliatory tax by comparing ${s}'s aggregate burden to the domiciliary state's and remit any excess to the ${r} with the premium-tax return.`,
  },
  {
    key: 'annual-stmt',
    regime: 'NAIC Annual Statement',
    category: 'FINANCIAL_REPORTING',
    obligationType: 'ONGOING',
    frequency: 'annual',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'FINANCIAL_REPORTING',
    citation: '{ST} financial reporting statute; NAIC Annual Statement Blank',
    title: (s) => `${s}: File statutory annual statement`,
    requirement: (s, r) =>
      `File the statutory annual statement (NAIC Blank, SAP basis) with the ${r} and the NAIC by March 1 for the prior year, including all state-required supplements and schedules.`,
  },
  {
    key: 'quarterly-stmt',
    regime: 'NAIC Quarterly Statement',
    category: 'FINANCIAL_REPORTING',
    obligationType: 'ONGOING',
    frequency: 'quarterly',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'FINANCIAL_REPORTING',
    citation: '{ST} financial reporting statute; NAIC Quarterly Blank',
    title: (s) => `${s}: File statutory quarterly statements`,
    requirement: (s, r) =>
      `File quarterly statutory statements with the ${r} within 45 days of each of the first three quarter-ends, prepared under the NAIC AP&P Manual (SAP).`,
  },
  {
    key: 'audited-fin',
    regime: 'Model Audit Rule (NAIC 205)',
    category: 'ACCOUNTING_AUDIT',
    obligationType: 'ONGOING',
    frequency: 'annual',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'ACCOUNTING_AUDIT',
    citation: '{ST} adoption of NAIC Model 205',
    title: (s) => `${s}: File CPA-audited statutory financial report`,
    requirement: (s, r) =>
      `File the annual CPA-audited statutory financial report with the ${r} by June 1 under ${s}'s adoption of the NAIC Annual Financial Reporting Model Regulation (Model 205).`,
  },
  {
    key: 'rbc',
    regime: 'Risk-Based Capital (NAIC 312)',
    category: 'SOLVENCY_CAPITAL',
    obligationType: 'ONGOING',
    frequency: 'annual',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'SOLVENCY_CAPITAL',
    citation: '{ST} adoption of NAIC RBC Model Act (312)',
    title: (s) => `${s}: File annual risk-based capital report`,
    requirement: (s, r) =>
      `File the annual RBC report with the ${r} by March 1 and maintain total adjusted capital above the action levels under ${s}'s RBC for Insurers Model Act.`,
  },
  {
    key: 'mcas',
    regime: 'Market Conduct Annual Statement (MCAS)',
    category: 'MARKET_CONDUCT',
    obligationType: 'ONGOING',
    frequency: 'annual',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'MARKET_CONDUCT',
    citation: '{ST} MCAS data-call participation',
    title: (s) => `${s}: Submit Market Conduct Annual Statement`,
    requirement: (s, r) =>
      `Submit the annual MCAS covering the lines and thresholds designated by the ${r} (claims, underwriting, complaints, lawsuits) via the NAIC MCAS system.`,
  },
  {
    key: 'unfair-claims',
    regime: 'Unfair Claims Settlement Practices (NAIC 900)',
    category: 'MARKET_CONDUCT',
    obligationType: 'ONGOING',
    frequency: 'continuous',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'MARKET_CONDUCT',
    citation: '{ST} adoption of NAIC Model 900',
    title: (s) => `${s}: Comply with unfair claims settlement practices rules`,
    requirement: (s, r) =>
      `Handle claims in ${s} in conformity with the ${r}'s unfair claims settlement practices act — timely acknowledgement, investigation, good-faith evaluation, and prompt payment — with records evidencing compliance.`,
  },
  {
    key: 'unfair-trade',
    regime: 'Unfair Trade Practices (NAIC 880)',
    category: 'MARKET_CONDUCT',
    obligationType: 'ONGOING',
    frequency: 'continuous',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'MARKET_CONDUCT',
    citation: '{ST} adoption of NAIC Model 880',
    title: (s) => `${s}: Comply with unfair trade practices act`,
    requirement: (s, r) =>
      `Avoid misrepresentation, unfair discrimination, rebating and false advertising prohibited by ${s}'s unfair trade practices act, enforced by the ${r}.`,
  },
  {
    key: 'complaints',
    regime: 'Complaint Handling & Record',
    category: 'CONSUMER_PROTECTION',
    obligationType: 'ONGOING',
    frequency: 'continuous',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'CONSUMER_PROTECTION',
    citation: '{ST} complaint-record requirement',
    title: (s) => `${s}: Maintain complaint register and respond to DOI inquiries`,
    requirement: (s, r) =>
      `Maintain a complaint record and respond within the statutory period to consumer complaints forwarded by the ${r}, tracking disposition for market-conduct review.`,
  },
  {
    key: 'privacy-notice',
    regime: 'Privacy of Consumer Financial Information (NAIC 672)',
    category: 'DATA_PRIVACY',
    obligationType: 'ONGOING',
    frequency: 'annual',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'DATA_PRIVACY',
    citation: '{ST} adoption of NAIC Model 672 (GLBA)',
    title: (s) => `${s}: Deliver GLBA privacy notices and honor opt-outs`,
    requirement: (s, r) =>
      `Provide initial and annual privacy notices and honor opt-out rights for nonpublic personal information under ${s}'s adoption of the NAIC privacy regulation (Model 672), enforced by the ${r}.`,
  },
  {
    key: 'data-security',
    regime: 'Insurance Data Security Law (NAIC 668)',
    category: 'CYBERSECURITY',
    obligationType: 'ONGOING',
    frequency: 'continuous',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'CYBERSECURITY',
    citation: '{ST} adoption of NAIC Model 668',
    title: (s) => `${s}: Maintain information security program and notify breaches`,
    requirement: (s, r) =>
      `Maintain a written information security program and notify the ${r} of a cybersecurity event within 72 hours under ${s}'s Insurance Data Security Law (NAIC Model 668).`,
  },
  {
    key: 'unclaimed-property',
    regime: 'Unclaimed Property / Escheat',
    category: 'UNCLAIMED_PROPERTY',
    obligationType: 'ONGOING',
    frequency: 'annual',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'UNCLAIMED_PROPERTY',
    citation: '{ST} unclaimed property act',
    title: (s) => `${s}: Report and remit unclaimed property`,
    requirement: (s, r) =>
      `Identify, due-diligence, report and remit unclaimed insurance proceeds and uncashed drafts to ${s}'s unclaimed-property administrator by the annual reporting deadline.`,
  },
  {
    key: 'guaranty-assoc',
    regime: 'Guaranty Association Membership',
    category: 'RESIDUAL_MARKET',
    obligationType: 'ONGOING',
    frequency: 'annual',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'RESIDUAL_MARKET',
    citation: '{ST} guaranty association act',
    title: (s) => `${s}: Guaranty association membership and assessments`,
    requirement: (s, r) =>
      `Maintain mandatory membership in ${s}'s insurance guaranty association(s) and pay assessments levied to cover insolvent-insurer obligations; recoup via premium-tax offset where allowed.`,
  },
  {
    key: 'fraud-siu',
    regime: 'Insurance Fraud Prevention (NAIC 680)',
    category: 'MARKET_CONDUCT',
    obligationType: 'ONGOING',
    frequency: 'continuous',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'MARKET_CONDUCT',
    citation: '{ST} anti-fraud plan / SIU requirement',
    title: (s) => `${s}: Maintain anti-fraud plan and report suspected fraud`,
    requirement: (s, r) =>
      `Maintain a fraud-prevention plan / special investigations unit and report suspected insurance fraud to the ${r} or state fraud bureau as required in ${s}.`,
  },
  {
    key: 'actuarial-opinion',
    regime: 'Actuarial Opinion (NAIC 820/822)',
    category: 'ACTUARIAL_VALUATION',
    obligationType: 'ONGOING',
    frequency: 'annual',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'ACTUARIAL_VALUATION',
    citation: '{ST} Standard Valuation Law / AOMR',
    title: (s) => `${s}: File statement of actuarial opinion on reserves`,
    requirement: (s, r) =>
      `File the annual statement of actuarial opinion (and supporting memorandum) on reserve adequacy with the ${r} under ${s}'s Standard Valuation Law / Actuarial Opinion & Memorandum Regulation.`,
  },
  {
    key: 'cont-ed',
    regime: 'Producer Continuing Education',
    category: 'LICENSING',
    obligationType: 'ONGOING',
    frequency: 'biennial',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'LICENSING',
    citation: '{ST} producer CE requirement',
    title: (s) => `${s}: Ensure producer continuing-education compliance`,
    requirement: (s, r) =>
      `Ensure appointed producers meet ${s}'s continuing-education hours (including ethics and any LTC/annuity training) each renewal cycle, per the ${r}.`,
  },

  // Per-LINE × per-state — form filing (every product line files its forms)
  {
    key: 'form-filing',
    regime: 'Policy Form Filing',
    category: 'PRODUCT_FILING',
    obligationType: 'FILING_GATE',
    frequency: 'per-filing',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'PRODUCT_FILING',
    groups: ALL_GROUPS,
    perLine: true,
    citation: '{ST} form-filing statute; filed via SERFF',
    title: (s, ln) => `${s}: File ${ln} policy forms for approval`,
    requirement: (s, r, ln) =>
      `File ${ln} policy forms and endorsements with the ${r} via SERFF and obtain approval (or satisfy file-and-use) before issuing ${ln} coverage in ${s}.`,
  },
  // Per-LINE × per-state — rate filing (P&C lines)
  {
    key: 'rate-filing',
    regime: 'Rate Filing',
    category: 'PRODUCT_FILING',
    obligationType: 'FILING_GATE',
    frequency: 'per-filing',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'PRODUCT_FILING',
    groups: PC_GROUPS,
    perLine: true,
    citation: '{ST} rate-filing statute; filed via SERFF',
    title: (s, ln) => `${s}: File ${ln} rates for approval`,
    requirement: (s, r, ln) =>
      `File ${ln} rates and supporting actuarial justification with the ${r} via SERFF under ${s}'s prior-approval or file-and-use rating law before use.`,
  },
  {
    key: 'rating-rules',
    regime: 'Rating Rule / Manual Filing',
    category: 'PRODUCT_FILING',
    obligationType: 'ONGOING',
    frequency: 'per-filing',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'PRODUCT_FILING',
    groups: PC_GROUPS,
    citation: '{ST} rating rule filing; SERFF',
    title: (s, grp) => `${s}: File ${grp} rating rules and manual pages`,
    requirement: (s, r, grp) =>
      `File ${grp} underwriting/rating rules and manual pages with the ${r} and apply them uniformly and non-discriminatorily under ${s} law.`,
  },
  {
    key: 'stat-reporting',
    regime: 'Statistical Data Reporting',
    category: 'DATA_CALL',
    obligationType: 'ONGOING',
    frequency: 'annual',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'DATA_CALL',
    groups: PC_GROUPS,
    citation: '{ST} statistical plan / designated statistical agent',
    title: (s, grp) => `${s}: Report ${grp} statistical data to the designated agent`,
    requirement: (s, r, grp) =>
      `Report ${grp} premium and loss statistical data through the ${r}'s designated statistical agent (e.g., ISO, NCCI, AIPSO) per ${s}'s statistical plan.`,
  },
  {
    key: 'cancel-nonrenew',
    regime: 'Cancellation & Non-Renewal Notice',
    category: 'CONSUMER_PROTECTION',
    obligationType: 'EVENT_DRIVEN',
    frequency: 'per-event',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'CONSUMER_PROTECTION',
    groups: PC_GROUPS,
    citation: '{ST} cancellation/non-renewal notice statute',
    title: (s, grp) => `${s}: Give ${grp} cancellation/non-renewal notice`,
    requirement: (s, r, grp) =>
      `Provide the statutory advance written notice and stated reasons for ${grp} cancellations and non-renewals in ${s}, within the timeframes enforced by the ${r}.`,
  },

  // Life / annuity specific
  {
    key: 'life-illustration',
    regime: 'Life Insurance Illustrations (NAIC 582)',
    category: 'MARKET_CONDUCT',
    obligationType: 'ONGOING',
    frequency: 'continuous',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'MARKET_CONDUCT',
    groups: LIFE_GROUPS,
    citation: '{ST} adoption of NAIC Model 582',
    title: (s, grp) => `${s}: Comply with ${grp} illustration rules`,
    requirement: (s, r, grp) =>
      `Deliver compliant ${grp} sales illustrations and annual reports and avoid misleading projections under ${s}'s life illustrations regulation.`,
  },
  {
    key: 'nonforfeiture',
    regime: 'Standard Nonforfeiture Law',
    category: 'ACTUARIAL_VALUATION',
    obligationType: 'ONGOING',
    frequency: 'continuous',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'ACTUARIAL_VALUATION',
    groups: LIFE_GROUPS,
    citation: '{ST} Standard Nonforfeiture Law',
    title: (s, grp) => `${s}: Meet ${grp} nonforfeiture value requirements`,
    requirement: (s, r, grp) =>
      `Ensure ${grp} contracts provide minimum nonforfeiture values and comply with ${s}'s Standard Nonforfeiture Law as filed with the ${r}.`,
  },
  {
    key: 'annuity-suitability',
    regime: 'Annuity Suitability & Best Interest (NAIC 275)',
    category: 'SUITABILITY',
    obligationType: 'ONGOING',
    frequency: 'continuous',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'SUITABILITY',
    groups: ANNUITY_GROUPS,
    citation: '{ST} adoption of NAIC Model 275',
    title: (s, grp) => `${s}: Apply best-interest standard to ${grp} sales`,
    requirement: (s, r, grp) =>
      `Apply the care, disclosure, conflict-of-interest and documentation duties of ${s}'s best-interest annuity suitability regulation to ${grp} recommendations, with producer training.`,
  },
  {
    key: 'annuity-disclosure',
    regime: 'Annuity Disclosure (NAIC 245)',
    category: 'CONSUMER_PROTECTION',
    obligationType: 'ONGOING',
    frequency: 'continuous',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'CONSUMER_PROTECTION',
    groups: ANNUITY_GROUPS,
    citation: '{ST} adoption of NAIC Model 245',
    title: (s, grp) => `${s}: Deliver ${grp} disclosure and buyer's guide`,
    requirement: (s, r, grp) =>
      `Deliver the required ${grp} disclosure document and Buyer's Guide at or before application and honor the free-look period under ${s} law.`,
  },

  // Health specific
  {
    key: 'health-rate-review',
    regime: 'Health Rate Review',
    category: 'PRODUCT_FILING',
    obligationType: 'FILING_GATE',
    frequency: 'annual',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'PRODUCT_FILING',
    groups: HEALTH_GROUPS,
    citation: '{ST} health rate review / ACA rate filing',
    title: (s, grp) => `${s}: File ${grp} rates for rate review`,
    requirement: (s, r, grp) =>
      `Submit ${grp} rate filings and actuarial memoranda for ${s} rate review (and federal ACA review where applicable) to the ${r} before use.`,
  },
  {
    key: 'network-adequacy',
    regime: 'Network Adequacy (NAIC 74)',
    category: 'CONSUMER_PROTECTION',
    obligationType: 'ONGOING',
    frequency: 'annual',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'CONSUMER_PROTECTION',
    groups: HEALTH_GROUPS,
    citation: '{ST} network adequacy standard',
    title: (s, grp) => `${s}: Demonstrate ${grp} network adequacy`,
    requirement: (s, r, grp) =>
      `File and maintain access plans demonstrating ${grp} provider-network adequacy (time/distance, appointment wait times) to the ${r} under ${s} law.`,
  },
  // Per-LINE reserve/valuation for life, annuity and health lines
  {
    key: 'reserve-valuation',
    regime: 'Statutory Reserve Valuation',
    category: 'ACTUARIAL_VALUATION',
    obligationType: 'ONGOING',
    frequency: 'annual',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'ACTUARIAL_VALUATION',
    groups: [...LIFE_GROUPS, ...ANNUITY_GROUPS, ...HEALTH_GROUPS],
    perLine: true,
    citation: '{ST} Standard Valuation Law / Valuation Manual',
    title: (s, ln) => `${s}: Hold statutory reserves for ${ln}`,
    requirement: (s, r, ln) =>
      `Establish and annually certify statutory policy reserves for ${ln} under ${s}'s Standard Valuation Law and the NAIC Valuation Manual (VM-20/VM-21/VM-25 as applicable), reported to the ${r}.`,
  },
  // Per-LINE producer product-training (annuity/LTC/life)
  {
    key: 'product-training',
    regime: 'Producer Product Training',
    category: 'LICENSING',
    obligationType: 'ONGOING',
    frequency: 'continuous',
    markets: ['PERSONAL', 'COMMERCIAL'],
    ownerCat: 'LICENSING',
    groups: [...ANNUITY_GROUPS, ...LIFE_GROUPS],
    perLine: true,
    citation: '{ST} product-specific producer training requirement',
    title: (s, ln) => `${s}: Complete producer training before selling ${ln}`,
    requirement: (s, r, ln) =>
      `Ensure producers complete the required ${ln} product-specific training (and any state annuity/LTC training) before soliciting ${ln} in ${s}, per the ${r}.`,
  },
];

// category → owner + contributor role candidates (first existing wins).
const ROLE_MAP: Record<string, { owner: string[]; contributors: string[] }> = {
  LICENSING: {
    owner: ['Producer Compliance Manager', 'Regulatory Affairs Manager'],
    contributors: ['Producer Licensing Coordinator', 'Regulatory Filing Specialist'],
  },
  PREMIUM_TAX: {
    owner: ['Tax Director', 'Tax Manager'],
    contributors: ['Tax Manager', 'Tax Analyst'],
  },
  FINANCIAL_REPORTING: {
    owner: ['Statutory Reporting Manager', 'Controller'],
    contributors: ['Controller', 'Accountant', 'Compliance Analyst'],
  },
  ACCOUNTING_AUDIT: {
    owner: ['Controller', 'Statutory Reporting Manager'],
    contributors: ['Accountant', 'Compliance Analyst'],
  },
  SOLVENCY_CAPITAL: {
    owner: ['Chief Actuary', 'Chief Risk Officer'],
    contributors: ['Capital Model Actuary', 'Enterprise Risk Manager'],
  },
  ACTUARIAL_VALUATION: {
    owner: ['Appointed Actuary', 'Chief Actuary'],
    contributors: ['Reserving Actuary', 'Actuarial Analyst'],
  },
  MARKET_CONDUCT: {
    owner: ['Market Conduct / Consumer Compliance Manager', 'Compliance Manager'],
    contributors: ['Compliance Analyst', 'Consumer Affairs Analyst'],
  },
  CONSUMER_PROTECTION: {
    owner: ['Market Conduct / Consumer Compliance Manager', 'Compliance Manager'],
    contributors: ['Consumer Affairs Manager', 'Compliance Analyst'],
  },
  DATA_PRIVACY: {
    owner: ['Privacy Officer', 'Compliance Officer'],
    contributors: ['Data Protection Officer', 'Compliance Analyst'],
  },
  CYBERSECURITY: {
    owner: ['Chief Info Security Officer', 'IT Security Manager'],
    contributors: ['Cybersecurity Lead', 'Compliance Analyst'],
  },
  UNCLAIMED_PROPERTY: {
    owner: ['Compliance Manager', 'Statutory Reporting Manager'],
    contributors: ['Life Claims Examiner', 'Compliance Analyst'],
  },
  RESIDUAL_MARKET: {
    owner: ['Regulatory Affairs Manager', 'Compliance Manager'],
    contributors: ['Statutory Reporting Manager', 'Compliance Analyst'],
  },
  PRODUCT_FILING: {
    owner: ['Product Filing Specialist', 'Regulatory Affairs Manager'],
    contributors: ['Regulatory Filing Specialist', 'Compliance Analyst'],
  },
  DATA_CALL: {
    owner: ['Statutory Reporting Manager', 'Compliance Manager'],
    contributors: ['Data Analyst', 'Compliance Analyst'],
  },
  SUITABILITY: {
    owner: ['Producer Compliance Manager', 'Compliance Manager'],
    contributors: ['Compliance Analyst', 'Market Conduct / Consumer Compliance Manager'],
  },
};
const DEFAULT_ROLE = {
  owner: ['Compliance Officer', 'Head of Compliance', 'Compliance Manager'],
  contributors: ['Compliance Analyst'],
};

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true } });
  if (!company) throw new Error('no company');
  const { id: companyId, tenantId } = company;

  const states = await prisma.jurisdiction.findMany({
    // Real US states + DC only — the multistate NAIC model-law body is not a
    // filing state and must not receive per-state/per-line filing obligations.
    where: { companyId, regulatorType: 'STATE_INSURANCE_REGULATOR', code: { not: 'NAIC' } },
    select: { id: true, code: true, name: true, regulatorName: true, regulatorWebsite: true },
    orderBy: { code: 'asc' },
  });
  const lobs = await prisma.lineOfBusiness.findMany({
    where: { companyId },
    select: { id: true, label: true, group: true },
  });
  const linesByGroup = new Map<string, { id: string; label: string }[]>();
  for (const l of lobs)
    (linesByGroup.get(l.group) ?? linesByGroup.set(l.group, []).get(l.group)!).push({
      id: l.id,
      label: l.label,
    });

  const roles = await prisma.role.findMany({
    where: { companyId },
    select: { id: true, displayValue: true },
  });
  const roleByName = new Map(roles.map((r) => [r.displayValue, r.id]));
  const pick = (names: string[]) => {
    for (const n of names) if (roleByName.has(n)) return roleByName.get(n)!;
    return null;
  };

  // Idempotent: drop prior generated rows (cascades role + lob links).
  if (!DRY) {
    const del = await prisma.regulatoryRequirement.deleteMany({
      where: { companyId, sourceNote: { startsWith: MARKER } },
    });
    console.log(`deleted ${del.count} prior CONTROL-LIB rows`);
  }

  type RegRow = {
    id: string;
    tenantId: string;
    companyId: string;
    jurisdictionId: string;
    category: string;
    title: string;
    requirement: string;
    lineOfBusiness: string;
    markets: string[];
    citation: string;
    citationUrl: string | null;
    obligationType: string;
    frequency: string;
    status: string;
    confidence: string;
    regime: string;
    sourceNote: string;
    lastVerifiedAt: Date;
  };
  const regRows: RegRow[] = [];
  const roleRows: {
    id: string;
    companyId: string;
    regId: string;
    roleId: string;
    role_: string;
  }[] = [];
  const lobRows: { id: string; companyId: string; regId: string; lobId: string }[] = [];
  const now = new Date();

  const addRow = (
    t: Tmpl,
    st: (typeof states)[number],
    displayName: string | undefined,
    lobIds: string[],
    ownerId: string | null,
    contribIds: string[],
  ) => {
    const id = randomUUID();
    regRows.push({
      id,
      tenantId,
      companyId,
      jurisdictionId: st.id,
      category: t.category,
      title: t.title(st.name, displayName).slice(0, 190),
      requirement: t.requirement(st.name, st.regulatorName, displayName),
      lineOfBusiness: 'ALL',
      markets: t.markets,
      citation: t.citation.replace('{ST}', st.name),
      citationUrl: st.regulatorWebsite,
      obligationType: t.obligationType,
      frequency: t.frequency,
      status: 'ACTIVE',
      confidence: 'DERIVED',
      regime: t.regime,
      sourceNote: `${MARKER}: real ${t.regime} obligation as administered by ${st.regulatorName}; framework-grain citation`,
      lastVerifiedAt: now,
    });
    if (ownerId)
      roleRows.push({ id: randomUUID(), companyId, regId: id, roleId: ownerId, role_: 'Owner' });
    for (const rid of contribIds)
      roleRows.push({ id: randomUUID(), companyId, regId: id, roleId: rid, role_: 'Contributor' });
    for (const lobId of lobIds) lobRows.push({ id: randomUUID(), companyId, regId: id, lobId });
  };

  for (const t of TEMPLATES) {
    const roleDef = ROLE_MAP[t.ownerCat] ?? DEFAULT_ROLE;
    const ownerId = pick(roleDef.owner);
    const contribIds = [
      ...new Set(roleDef.contributors.map((n) => roleByName.get(n)).filter(Boolean)),
    ].filter((x) => x !== ownerId) as string[];
    for (const st of states) {
      if (!t.groups) {
        // Entity-level — one row, no line links.
        addRow(t, st, undefined, [], ownerId, contribIds);
      } else if (t.perLine) {
        // One row per individual line in the applicable groups (specific LOB).
        for (const grp of t.groups)
          for (const ln of linesByGroup.get(grp) ?? [])
            addRow(t, st, ln.label, [ln.id], ownerId, contribIds);
      } else {
        // One row per group; link all lines in the group.
        for (const grp of t.groups) {
          const lines = linesByGroup.get(grp) ?? [];
          addRow(
            t,
            st,
            grp,
            lines.map((l) => l.id),
            ownerId,
            contribIds,
          );
        }
      }
    }
  }

  console.log(
    `${DRY ? '[dry-run] ' : ''}generated ${regRows.length} requirements · ${roleRows.length} role links · ${lobRows.length} lob links`,
  );
  if (DRY) {
    await prisma.$disconnect();
    return;
  }

  const chunk = <T>(a: T[], n: number) => {
    const o: T[][] = [];
    for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n));
    return o;
  };
  for (const c of chunk(regRows, 1000))
    await prisma.regulatoryRequirement.createMany({ data: c, skipDuplicates: true });
  for (const c of chunk(roleRows, 2000))
    await prisma.roleRegulation.createMany({ data: c, skipDuplicates: true });
  for (const c of chunk(lobRows, 2000))
    await prisma.requirementLineOfBusiness.createMany({ data: c, skipDuplicates: true });

  const total = await prisma.regulatoryRequirement.count({
    where: { companyId, status: 'ACTIVE' },
  });
  console.log(`inserted. active requirements now: ${total}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
