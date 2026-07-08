import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../lib/company';
import { useApi } from '../../lib/useApi';
import { withCompany, Tile } from '../../lib/portfolio';
import { useRegisterCrumb } from '../../lib/breadcrumbs';
import { RequirementsTable } from './RequirementsTable';

// Regulations — three lenses, each a FLAT table where every row is ONE atomic
// regulation. Rows open the regulation's own page (/regulations/requirement/:id);
// the jurisdiction cell links to the regulator page (/regulations/:code); the
// four headline cards open their insight pages (RegulationsInsight.tsx).
//   International: non-US / supranational regulators (EU/GDPR today).
//   Federal: the federal / national securities regime (FINRA/SEC/MSRB).
//   State (default): the 50-state (+DC) insurance regulatory baseline.

type LobLink = { lob: { code: string; label: string; group?: string } };

// Market-segment display helpers (shared with the detail page).
export const MARKET_LABEL: Record<string, string> = {
  PERSONAL: 'Personal',
  COMMERCIAL: 'Commercial',
};
export const marketValues = (m: string[]): string[] => (m ?? []).map((x) => MARKET_LABEL[x] ?? x);
// Both segments → "Commercial & Personal Lines" (never the bare "Both").
export const BOTH_MARKETS_LABEL = 'Commercial & Personal Lines';
export const marketDisplay = (m: string[]): string => {
  const v = marketValues(m);
  if (v.length >= 2) return BOTH_MARKETS_LABEL;
  return v[0] ?? '—';
};
// Granular lines from the junction; fall back to the coarse scalar label.
export const lobLabels = (r: {
  lineOfBusinessLinks?: LobLink[];
  lineOfBusiness: string;
}): string[] => {
  const links = (r.lineOfBusinessLinks ?? []).map((l) => l.lob.label);
  if (links.length) return links;
  return [r.lineOfBusiness === 'ALL' ? 'All lines' : flagLabel(r.lineOfBusiness)];
};
// Distinct family groups the requirement's lines roll up to (table roll-up view;
// the requirement detail page still lists the specific lines).
export const lobGroups = (r: { lineOfBusinessLinks?: { lob: { group: string } }[] }): string[] => [
  ...new Set((r.lineOfBusinessLinks ?? []).map((l) => l.lob.group)),
];

export type Overview = {
  jurisdictionCount: number;
  flags: Record<string, Record<string, number>>;
  requirements: {
    total: number;
    mapped: number;
    unmapped: number;
    byCategory: Record<string, number>;
    byConfidence: Record<string, number>;
  };
  coverageByValueStream: {
    valueStreamId: string;
    valueStream: string | null;
    requirementCount: number;
  }[];
  bulletinCount: number;
  ruleCount: number;
  sourceCount: number;
  verifiedJurisdictions: number;
};

// Provenance legend for the Confidence pill/column (SCRUM-40/42) — shared by
// the overview drawer, the table hint, and the state-detail pills.
export const CONFIDENCE_HELP: Record<string, string> = {
  BASELINE: 'sourced from the 50-state baseline research document, not yet independently verified',
  DERIVED: 'decomposed or inferred from a broader regime or grouped requirement',
  VERIFIED: 'confirmed against the official regulator source',
  STALE: 'the source has changed since last verification — needs re-review',
};

// What each obligation type means (SCRUM-42/77) — filing gates are the
// critical blockers; informational rows are monitoring-only.
export const OBLIGATION_HELP: Record<string, string> = {
  FILING_GATE: 'Blocks a transaction until the regulator approves the filing',
  ONGOING: 'Continuous obligation — always in force',
  EVENT_DRIVEN: 'Fires when a triggering event occurs',
  INFORMATIONAL: 'Monitoring-only — no direct action required',
};
const TABS = ['International', 'Federal', 'State'] as const;
type Tab = (typeof TABS)[number];

// Flag display helpers — normalized token → short label + pill tone. Kept here
// (with FlagPill) because RegulationDetail imports both for the state flag strip.
const FLAG_PILL: Record<string, string> = {
  SERFF: 'pill-slate',
  PROPRIETARY: 'pill-red',
  MIXED: 'pill-amber',
  MEMBER: 'pill-green',
  NON_MEMBER: 'pill-red',
  YES: 'pill-green',
  NO: 'pill-slate',
  PARTIAL: 'pill-amber',
  EMERGING: 'pill-amber',
  TRANSITIONING: 'pill-amber',
  EDI: 'pill-green',
  NON_EDI: 'pill-slate',
  MONOPOLISTIC_FUND: 'pill-blue',
  STATE_SPECIFIC: 'pill-amber',
};
const ACRONYMS = new Set(['SERFF', 'EDI', 'APCD', 'SBS']);
const flagLabel = (v: string) =>
  v
    .split('_')
    .map((w, i) =>
      ACRONYMS.has(w)
        ? w
        : i === 0
          ? w.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
          : w.toLowerCase(),
    )
    .join(' ')
    .replace('Non EDI', 'Non-EDI');
export function FlagPill({ value, detail }: { value: string; detail?: string | null }) {
  return (
    <span className={FLAG_PILL[value] ?? 'pill-slate'} title={detail ?? undefined}>
      {flagLabel(value)}
    </span>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  PRODUCT_FILING: 'Product filing',
  LICENSING: 'Licensing',
  PREMIUM_TAX: 'Premium tax',
  SURPLUS_LINES: 'Surplus lines',
  WORKERS_COMP_REPORTING: "Workers' comp",
  AUTO_VERIFICATION: 'Auto verification',
  APCD_REPORTING: 'APCD',
  FINANCIAL_REPORTING: 'Financial reporting',
  MARKET_CONDUCT: 'Market conduct',
  DATA_CALL: 'Data call',
  CYBERSECURITY: 'Cybersecurity',
  DATA_PRIVACY: 'Data privacy',
  AI_GOVERNANCE: 'AI governance',
  CLIMATE_RISK: 'Climate risk',
  SANCTIONS_AML: 'Sanctions & AML',
  SUITABILITY: 'Suitability',
  OPERATIONAL_RESILIENCE: 'Operational resilience',
  CATASTROPHE_REPORTING: 'Catastrophe reporting',
  UNCLAIMED_PROPERTY: 'Unclaimed property',
  CONSUMER_PROTECTION: 'Consumer protection',
  CORPORATE_GOVERNANCE: 'Corporate governance',
  SOLVENCY_CAPITAL: 'Solvency & capital',
  ACTUARIAL_VALUATION: 'Actuarial & valuation',
  ACCOUNTING_AUDIT: 'Accounting & audit',
  TAX_REPORTING: 'Tax reporting',
  EMPLOYMENT_BENEFITS: 'Employment & benefits',
  ANTITRUST_CONDUCT: 'Antitrust & conduct',
  ESG_SUSTAINABILITY: 'ESG & sustainability',
  SECURITIES_DISTRIBUTION: 'Securities distribution',
  RESIDUAL_MARKET: 'Residual market',
  OTHER: 'Other',
};
export const catLabel = (c: string) => CATEGORY_LABEL[c] ?? flagLabel(c);

// One-line definitions for the classification facets (surfaced on the
// requirement page and as tooltips) — keep these as the single copy source.
export const CATEGORY_HELP: Record<string, string> = {
  PRODUCT_FILING:
    'Submitting policy forms, rates, and rules to the regulator for approval before sale',
  LICENSING: 'Company and producer licenses, appointments, and renewals required to do business',
  PREMIUM_TAX: 'Taxes and assessments owed on written premium',
  SURPLUS_LINES: 'Obligations on non-admitted / surplus-lines placements',
  WORKERS_COMP_REPORTING: "Claims and policy reporting to workers' compensation bureaus and funds",
  AUTO_VERIFICATION: 'Reporting insured vehicles to state insurance-verification systems',
  APCD_REPORTING: 'Submitting claims data to all-payer claims databases',
  FINANCIAL_REPORTING: 'Statutory financial statements and solvency filings',
  MARKET_CONDUCT: 'Sales, claims, and consumer-treatment conduct standards and exams',
  DATA_CALL: 'Ad-hoc or recurring data requests issued by the regulator',
  CYBERSECURITY: 'Information-security program, incident-notification, and certification duties',
  DATA_PRIVACY: 'Collection, use, and protection of personal data',
  AI_GOVERNANCE: 'Governance, testing, and documentation of AI systems used in insurance decisions',
  CLIMATE_RISK: 'Climate-risk disclosure, scenario analysis, and related supervisory reporting',
  SANCTIONS_AML: 'Anti-money-laundering programs and sanctions (OFAC) screening',
  SUITABILITY: 'Best-interest / suitability standards for product recommendations',
  OPERATIONAL_RESILIENCE: 'ICT risk, business continuity, and third-party resilience duties',
  CATASTROPHE_REPORTING: 'Event-driven catastrophe and residual-market reporting',
  UNCLAIMED_PROPERTY: 'Death-benefit matching and unclaimed-property escheat duties',
  CONSUMER_PROTECTION: 'Consumer disclosures, marketing conduct, and fair-treatment duties',
  CORPORATE_GOVERNANCE: 'Board governance, holding-company, and enterprise-risk disclosure duties',
  SOLVENCY_CAPITAL: 'Capital adequacy, RBC/SCR, and own-risk & solvency assessment',
  ACTUARIAL_VALUATION: 'Reserving, principle-based valuation, and actuarial opinions',
  ACCOUNTING_AUDIT: 'Statutory accounting, financial statements, and external audit',
  TAX_REPORTING: 'Insurance-tax return, information reporting, and withholding duties',
  EMPLOYMENT_BENEFITS: 'Employer, benefits (ERISA), and workplace-law obligations',
  ANTITRUST_CONDUCT: 'Antitrust, anti-bribery, and corporate-conduct duties',
  ESG_SUSTAINABILITY: 'Sustainability, climate, and ESG disclosure regimes',
  SECURITIES_DISTRIBUTION: 'Securities registration and distribution-conduct duties',
  RESIDUAL_MARKET: 'Residual-market and guaranty-association participation duties',
  OTHER: 'Obligations outside the named compliance domains',
};
// What each named regulation / regime IS — shown on the regime page header.
// Static copy map (regime is a string on the requirement rows, not an entity);
// unknown regimes fall back to a generic line via regimeHelp().
export const REGIME_HELP: Record<string, string> = {
  IIPRC:
    'The Interstate Insurance Product Regulation Commission — a multi-state compact for filing life, annuity, disability and LTC products once, with effect in every member state.',
  'NAIC iSite+':
    "The NAIC's centralized regulatory data repository — insurers submit statutory financial statements and market conduct data here for distribution to state regulators.",
  SERFF:
    'The System for Electronic Rate and Form Filing — the NAIC platform through which insurers file product rates, rules, and forms with state regulators.',
  'IAIABC EDI':
    "The IAIABC's electronic data interchange standard for workers' compensation — insurers report first and subsequent reports of injury (FROI/SROI) to state agencies through it.",
  GDPR: 'The EU General Data Protection Regulation — governs collection, processing, and protection of EU residents’ personal data, with extraterritorial reach.',
  NIPR: 'The National Insurance Producer Registry — the NAIC-affiliated gateway for producer licensing, renewals, and appointments across states.',
  UCAA: 'The Uniform Certificate of Authority Application — the standardized process for insurer company licensing and corporate amendments across states.',
  'CCPA-CPRA':
    'The California Consumer Privacy Act as amended by the CPRA — consumer rights over personal data and business obligations for companies handling California residents’ data.',
  'NAIC MCAS':
    'The NAIC Market Conduct Annual Statement — yearly line-of-business conduct data (claims handling, underwriting, lawsuits) filed with participating states.',
  'NYDFS 500':
    'New York DFS Cybersecurity Regulation (23 NYCRR 500) — cybersecurity program, incident notification, and annual certification duties for NY-licensed financial institutions.',
  OPTins:
    "The NAIC's Online Premium Tax for Insurance — electronic filing and payment of state premium taxes and assessments.",
  'Reg BI':
    'SEC Regulation Best Interest — the broker-dealer conduct standard for recommendations to retail customers.',
  // ── EU prudential, conduct & digital regimes ──
  'Solvency II':
    'The EU prudential regime for insurers (Directive 2009/138/EC + Delegated Reg 2015/35) — market-consistent valuation, risk-based SCR/MCR capital, system of governance/ORSA, and Pillar 3 disclosure.',
  'Solvency II — EIOPA Guidelines':
    'EIOPA guidelines and technical standards elaborating Solvency II — supervisory expectations on governance, ORSA, reporting templates, and internal models.',
  IDD: 'The EU Insurance Distribution Directive (2016/97) — distribution conduct, IPID, demands-and-needs, product oversight & governance, and remuneration/conflict rules.',
  PRIIPs:
    'The EU Packaged Retail and Insurance-based Investment Products Regulation (1286/2014) — the Key Information Document with performance scenarios and cost disclosure.',
  SFDR: 'The EU Sustainable Finance Disclosure Regulation (2019/2088) — entity- and product-level sustainability disclosures and principal-adverse-impact reporting.',
  'CSRD/ESRS':
    'The EU Corporate Sustainability Reporting Directive and European Sustainability Reporting Standards — double-materiality sustainability reporting with assurance.',
  'EU Taxonomy':
    'The EU Taxonomy Regulation (2020/852) — turnover/CapEx/OpEx and insurer underwriting/investment alignment disclosure against environmental objectives.',
  DORA: 'The EU Digital Operational Resilience Act (2022/2554) — ICT risk management, incident reporting, resilience testing, and ICT third-party oversight for financial entities.',
  'EU AI Act':
    'The EU Artificial Intelligence Act (2024/1689) — obligations for high-risk AI, including insurance life & health risk-assessment and pricing systems.',
  'AMLD/AMLR':
    'The EU anti-money-laundering package — customer due diligence, beneficial-ownership, and suspicious-transaction duties for life insurers.',
  // ── United Kingdom ──
  'Solvency UK':
    'The UK prudential regime for insurers (reformed retained Solvency II) — SCR/MCR, matching-adjustment reform, technical provisions, ORSA, and SFCR reporting under the PRA Rulebook.',
  'SM&CR':
    'The UK Senior Managers & Certification Regime — senior-manager functions, statements of responsibilities, certification, and conduct rules.',
  'FCA Consumer Duty':
    'The FCA Consumer Duty (Principle 12 / PRIN 2A) — the four consumer outcomes, fair-value assessments, and board reporting.',
  'FCA Handbook':
    'FCA conduct-of-business rules — ICOBS, COBS, SYSC, PROD, and DISP governing UK insurance conduct.',
  'Operational Resilience (PRA/FCA)':
    'UK operational-resilience rules (PS21/3 and PS24/16) — important business services, impact tolerances, and critical-third-party oversight.',
  'UK GDPR':
    'The UK GDPR and Data Protection Act 2018 — lawful basis, data-subject rights, breach notification, and data-transfer duties.',
  // ── IAIS (global supervisory standards) ──
  'IAIS ICPs':
    'The IAIS Insurance Core Principles — the global baseline supervisory standards for insurer licensing, governance, risk, capital, and conduct that jurisdictions adopt.',
  'IAIS ComFrame':
    'The IAIS Common Framework — supervisory standards for internationally active insurance groups (IAIGs) layered inside the ICPs.',
  'IAIS ICS':
    'The IAIS Insurance Capital Standard — the risk-based group-capital standard (valuation, capital resources, and the ICS capital requirement).',
  // ── Canada ──
  'Insurance Companies Act':
    'The Canadian federal Insurance Companies Act — incorporation, capital adequacy, related-party limits, and the appointed-actuary regime, supervised by OSFI.',
  LICAT:
    "OSFI's Life Insurance Capital Adequacy Test — the risk-based capital ratio and its components for federally-regulated life insurers.",
  MCT: "OSFI's Minimum Capital Test — the risk-based capital requirement for federally-regulated property & casualty insurers.",
  'OSFI Guidelines':
    "OSFI's supervisory guidelines (E- and B-series) — regulatory compliance, ORSA, third-party/outsourcing, technology & cyber, and operational-resilience expectations.",
  'Fair Treatment of Customers':
    'Canadian market-conduct expectations (CCIR/CISRO FTC guidance, FCAC, and provincial acts) — fair treatment across the product and claims lifecycle.',
  PIPEDA:
    "Canada's Personal Information Protection and Electronic Documents Act — the ten fair-information principles and mandatory breach reporting.",
  PCMLTFA:
    "Canada's Proceeds of Crime (Money Laundering) and Terrorist Financing Act — FINTRAC-supervised AML duties for life insurers.",
  // ── Japan ──
  'Insurance Business Act':
    "Japan's Insurance Business Act — licensing, minimum capital, policy reserves, solvency margin, and solicitation-conduct duties supervised by the FSA.",
  'FSA Supervisory Guidelines':
    'Japan FSA Comprehensive Guidelines for Supervision of Insurance Companies — governance, risk management, conduct, and disclosure expectations.',
  ESR: "Japan's Economic Value-based Solvency Ratio regime (effective 2025) — market-consistent valuation and risk-based group solvency aligned to the IAIS ICS.",
  APPI: "Japan's Act on the Protection of Personal Information — data-protection duties including sensitive-data consent and breach reporting to the PPC.",
  // ── Bermuda ──
  'Insurance Act 1978':
    "Bermuda's Insurance Act 1978 and BMA rules — registration/classification, minimum solvency margin, and statutory financial returns.",
  'BSCR/EBS':
    'The Bermuda Solvency Capital Requirement and Economic Balance Sheet — the risk-based capital and economic valuation framework for commercial insurers.',
  'CISSA/GSSA':
    "Bermuda's Commercial Insurer's / Group Solvency Self-Assessment — the BMA's ORSA-equivalent own-risk-and-solvency assessment.",
  'Insurance Code of Conduct':
    'The BMA Insurance Code of Conduct — corporate governance, risk management, outsourcing, and operational-cyber-risk duties.',
  // ── US health (CMS) ──
  'Medicare Advantage (Part C)':
    'CMS Medicare Advantage rules (42 CFR 422) — bid submission, network adequacy, marketing, Star Ratings, risk adjustment, and appeals.',
  'Medicare Part D':
    'CMS Medicare prescription-drug rules (42 CFR 423) — formulary, bid, marketing, and compliance-program duties.',
  'Medicaid Managed Care':
    'CMS Medicaid managed-care rules (42 CFR 438) — contract standards, network adequacy, medical loss ratio, and encounter data.',
  'ACA / PHSA':
    'ACA and Public Health Service Act market reforms (45 CFR 144–158) — MLR and rebates, rate review, essential health benefits, and actuarial value.',
  'Medicare Supplement':
    'Medicare Supplement (Medigap) minimum standards — standardized benefit plans and consumer-protection requirements.',
  // ── US securities (SEC) ──
  'Securities Act 1933':
    'The Securities Act of 1933 — registration and prospectus delivery for variable annuity and variable life products (Forms N-4 / N-6).',
  'Investment Company Act 1940':
    'The Investment Company Act of 1940 — separate-account duties for variable products (forward pricing, substitutions, and pass-through voting).',
  'Exchange Act Reporting':
    'Securities Exchange Act reporting for the public holding company — 10-K/10-Q/8-K, Regulation S-K, Section 16, and cybersecurity disclosure.',
  'Investment Advisers Act':
    'The Investment Advisers Act of 1940 — Form ADV, fiduciary duty, custody, and compliance-program duties for a registered advisory affiliate.',
  // ── US labor/benefits (DOL) ──
  ERISA:
    'The Employee Retirement Income Security Act — fiduciary standards, prohibited transactions, reporting/disclosure (Form 5500), and the claims-procedure rule for group benefit products.',
  'OWCP (FECA/Longshore/Black Lung/DBA)':
    "US Department of Labor workers'-compensation schemes — FECA, the Longshore & Harbor Workers' Act, Black Lung, and the Defense Base Act.",
  // ── US tax (IRS) ──
  'IRC Subchapter L':
    'Internal Revenue Code Subchapter L (§§801–848) — the insurance-company tax rules for reserves, DAC, and taxable income.',
  'IRC §7702/§7702A':
    'IRC §7702 and §7702A — the definition of a life insurance contract and the modified-endowment-contract (MEC) tests.',
  'IRC §7702B':
    'IRC §7702B — the tax qualification rules for qualified long-term-care insurance contracts.',
  FATCA:
    'The Foreign Account Tax Compliance Act — due diligence, withholding, and reporting for cash-value and annuity products.',
  'Information Reporting':
    'IRS information-reporting duties — Forms 1099-R, 5498, 1035-exchange reporting, and backup withholding.',
  // ── US financial crime / sanctions ──
  'BSA/AML (FinCEN)':
    'FinCEN Bank Secrecy Act / anti-money-laundering rules for insurers (31 CFR 1025) — AML program, suspicious-activity reporting, and covered-product scoping.',
  'BSA/AML':
    'Bank Secrecy Act / anti-money-laundering duties — AML program, suspicious-activity and currency reporting, and recordkeeping.',
  'OFAC Sanctions':
    'US Treasury OFAC sanctions rules — SDN/consolidated-list screening, blocking and rejecting transactions, and blocked-property reporting.',
  'TRIA/TRIPRA':
    'The Terrorism Risk Insurance Program (TRIA/TRIPRA) — mandatory availability, policyholder disclosures, and the annual Treasury data call.',
  // ── US audit / governance ──
  'Sarbanes-Oxley':
    'The Sarbanes-Oxley Act — CEO/CFO certification, internal control over financial reporting (§404), audit-committee, and auditor-independence duties.',
  'PCAOB Standards':
    'PCAOB auditing standards — the integrated ICFR audit, audit-committee communications, and critical-audit-matter requirements.',
  // ── US privacy / consumer (FTC / HHS / CFPB / FCC) ──
  'GLBA Safeguards':
    'The GLBA Safeguards Rule (16 CFR 314) — the required information-security program and service-provider oversight.',
  'GLBA Privacy':
    'The GLBA Privacy Rule (16 CFR 313 / Reg P) — privacy notices, opt-out rights, and limits on sharing nonpublic personal information.',
  FCRA: 'The Fair Credit Reporting Act — permissible use of consumer reports in underwriting, adverse-action notices, and credit-based insurance scores.',
  'FTC Act §5':
    'FTC Act §5 — the prohibition on unfair or deceptive acts and practices in marketing and sales.',
  'CAN-SPAM':
    'The CAN-SPAM Act (16 CFR 316) — commercial-email identification, opt-out, and content requirements.',
  'HIPAA Privacy':
    'The HIPAA Privacy Rule (45 CFR 164 Subpart E) — permitted uses/disclosures, minimum necessary, and individual rights over protected health information.',
  'HIPAA Security':
    'The HIPAA Security Rule (45 CFR 164 Subpart C) — administrative, physical, and technical safeguards for electronic protected health information.',
  'HIPAA Breach Notification':
    'The HIPAA Breach Notification Rule (45 CFR 164 Subpart D) — individual, media, and HHS notification of breaches of protected health information.',
  'ACA §1557':
    'Section 1557 of the ACA (45 CFR Part 92) — nondiscrimination in health programs, including language access and accessibility.',
  UDAAP:
    'The prohibition on unfair, deceptive, or abusive acts and practices (12 USC 5531/5536) enforced by the CFPB.',
  RESPA:
    'The Real Estate Settlement Procedures Act §8 (12 CFR 1024) — the anti-kickback and affiliated-business-disclosure rules for title insurance.',
  'TILA/ECOA':
    'The Truth in Lending Act and Equal Credit Opportunity Act — credit-insurance disclosures, adverse-action notices, and nondiscrimination.',
  TCPA: 'The Telephone Consumer Protection Act (47 USC 227) — prior-express-written-consent, revocation, and calling-restriction rules for marketing calls and texts.',
  'Do-Not-Call':
    'The Do-Not-Call rules — national registry scrubbing, internal do-not-call lists, and company-specific request handling.',
  // ── US programs / employment ──
  'NFIP (Write-Your-Own)':
    "FEMA's National Flood Insurance Program Write-Your-Own arrangement — the financial control plan, SFIP policy issuance, and NFIP claims handling.",
  'Federal Crop Insurance (SRA/FCIC)':
    'The USDA federal crop-insurance program — the Standard Reinsurance Agreement, FCIC policy provisions, and RMA loss-adjustment and data-reporting standards.',
  PMIERs:
    'Private Mortgage Insurer Eligibility Requirements — the GSE minimum-required-assets test, operational standards, and master-policy requirements for mortgage-guaranty insurers.',
  FEHB: 'The Federal Employees Health Benefits Program (5 CFR 890) — carrier benefit standards, rate submission, MLR-equivalent, and OPM audit duties.',
  'Title VII':
    'Title VII of the Civil Rights Act — workplace nondiscrimination, harassment prevention, and accommodation duties for the enterprise as employer.',
  'ADA (Employment)':
    'The Americans with Disabilities Act (Title I) — employment nondiscrimination, reasonable accommodation, and medical-confidentiality duties.',
  'ADA Title III':
    'ADA Title III — accessibility of public accommodations, including website and digital accessibility for customer-facing services.',
  ADEA: 'The Age Discrimination in Employment Act — age-based nondiscrimination and OWBPA severance-waiver requirements.',
  'EEO-1 Reporting':
    'EEO-1 Component reporting — annual workforce demographic filings and related recordkeeping and posting duties.',
  OSHA: 'Occupational Safety and Health Administration rules (29 CFR 1904/1910) — injury recordkeeping (300/300A), the general-duty clause, and workplace-safety standards.',
  'Antitrust (Sherman/Clayton)':
    'The Sherman and Clayton Antitrust Acts — limits on information-sharing and rate collusion (within McCarran-Ferguson) and merger review.',
  FCPA: 'The Foreign Corrupt Practices Act — anti-bribery, books-and-records, and internal-accounting-controls duties.',
};
/** Regime description with graceful fallbacks for regime families. */
export const regimeHelp = (regime: string): string => {
  if (REGIME_HELP[regime]) return REGIME_HELP[regime];
  if (/finra/i.test(regime))
    return `FINRA conduct rule (${regime}) — a binding rule of the Financial Industry Regulatory Authority governing broker-dealer conduct.`;
  if (/msrb/i.test(regime))
    return `MSRB rule (${regime}) — a Municipal Securities Rulemaking Board rule governing municipal securities dealers.`;
  if (/apcd/i.test(regime))
    return `${regime} — an all-payer claims database mandate: submitting health claims data to the state's APCD.`;
  if (/cpra|cppa/i.test(regime))
    return `${regime} — California privacy regime obligations (CPRA amendments / the California Privacy Protection Agency).`;
  if (/^PTE\b/i.test(regime))
    return `${regime} — a US Department of Labor prohibited-transaction exemption under ERISA permitting an otherwise-restricted transaction on stated conditions.`;
  if (/ERISA Part 6/i.test(regime) || /COBRA/i.test(regime))
    return `${regime} — an ERISA Part 6 group-health continuation-coverage duty (COBRA) co-enforced by the Department of Labor.`;
  if (/ERISA Part 7/i.test(regime) || /MHPAEA|WHCRA|NMHPA/i.test(regime))
    return `${regime} — an ERISA Part 7 group-health mandate (parity / coverage protection) co-enforced by the Department of Labor.`;
  if (/^IRC\b/i.test(regime))
    return `${regime} — an Internal Revenue Code provision governing the taxation of insurance companies or contracts.`;
  if (/^HIPAA/i.test(regime))
    return `${regime} — a HIPAA duty governing the privacy, security, or breach notification of protected health information.`;
  if (/^IAIS/i.test(regime))
    return `${regime} — an International Association of Insurance Supervisors standard adopted through jurisdictional supervision.`;
  if (/GINA/i.test(regime))
    return `${regime} — the Genetic Information Nondiscrimination Act limits on acquiring or using genetic information.`;
  if (/Equal Pay Act/i.test(regime))
    return `${regime} — the federal equal-pay requirement for substantially equal work.`;
  if (/PWFA/i.test(regime))
    return `${regime} — the Pregnant Workers Fairness Act requirement to accommodate pregnancy-related limitations.`;
  if (/Reg S-P|Reg S-ID|Form CRS|SEC (Books|Net Capital|Customer Protection)/i.test(regime))
    return `${regime} — a US Securities and Exchange Commission broker-dealer or adviser rule governing conduct, disclosure, or safeguarding of customer assets and data.`;
  return 'A named regulation or regulatory regime from the baseline research.';
};

export const LOB_HELP: Record<string, string> = {
  ALL: 'Applies to every line of business the company writes',
  LIFE_ANNUITY: 'Life insurance and annuity products',
  WORKERS_COMP: "Workers' compensation",
  AUTO: 'Personal and commercial auto',
  HEALTH: 'Health insurance',
  SURPLUS_LINES: 'Surplus-lines / non-admitted business',
  PROPERTY: 'Property & homeowners lines',
  COMMERCIAL_LIABILITY: 'Commercial / general liability lines',
  REINSURANCE: 'Assumed and ceded reinsurance',
};

// The active lens survives drill-down navigation (sessionStorage) so history
// back lands the user on the lens they left, not the default.
const TAB_KEY = 'regulations.lens';
const initialTab = (): Tab => {
  const saved = sessionStorage.getItem(TAB_KEY);
  return TABS.includes(saved as Tab) ? (saved as Tab) : 'International';
};

const LENS_PARAM: Record<Tab, string> = {
  International: 'international',
  Federal: 'federal',
  State: 'state',
};

export default function Regulations() {
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const [tab, setTabState] = useState<Tab>(initialTab);
  const setTab = (t: Tab) => {
    sessionStorage.setItem(TAB_KEY, t);
    setTabState(t);
  };
  useRegisterCrumb('Regulations');

  // Per-lens headline stats — the cards reflect the active tab.
  const { data: stats } = useApi<{
    requirements: number;
    jurisdictions: number;
    rules: number;
    sources: number;
  }>(companyId ? withCompany(`/regulations/lens-stats?lens=${LENS_PARAM[tab]}`, companyId) : null);
  const jurLabel =
    tab === 'State' ? 'Jurisdictions' : tab === 'Federal' ? 'Agencies' : 'Regulators';

  return (
    <div>
      {/* Headline tiles — scoped to the active lens; each opens its insight page. */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          <Tile
            compact
            label={jurLabel}
            value={stats.jurisdictions.toLocaleString()}
            hint={`${tab.toLowerCase()} regulators`}
            onClick={() => navigate(`/regulations/jurisdictions?lens=${LENS_PARAM[tab]}`)}
          />
          <Tile
            compact
            label="Requirements"
            value={stats.requirements.toLocaleString()}
            hint={`in the ${tab} lens`}
            onClick={() => navigate(`/regulations/catalog?lens=${LENS_PARAM[tab]}`)}
          />
          <Tile
            compact
            label="Agent rules"
            value={stats.rules.toLocaleString()}
            hint="machine-readable checks"
            onClick={() => navigate(`/regulations/rules?lens=${LENS_PARAM[tab]}`)}
          />
          <Tile
            compact
            label="Regulatory sources"
            value={stats.sources.toLocaleString()}
            hint="official regulator sites & feeds"
            onClick={() => navigate(`/regulations/sources?lens=${LENS_PARAM[tab]}`)}
          />
        </div>
      )}

      {/* Lens tabs */}
      <div
        className="inline-flex items-center gap-0.5 rounded-full border border-[#eaeaea] bg-white p-0.5 mb-2"
        role="tablist"
        aria-label="Regulations lenses"
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={
              'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ' +
              (tab === t ? 'bg-[#171717] text-white' : 'text-[#525252] hover:text-[#171717]')
            }
          >
            {t}
          </button>
        ))}
      </div>

      {/* key by lens so switching tabs remounts with cleared filters */}
      <RequirementsTable key={LENS_PARAM[tab]} baseParams={{ lens: LENS_PARAM[tab] }} />
    </div>
  );
}
