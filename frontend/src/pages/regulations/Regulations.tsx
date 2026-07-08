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
export const marketDisplay = (m: string[]): string => {
  const v = marketValues(m);
  if (v.length >= 2) return 'Both';
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

  const { data: overview } = useApi<Overview>(
    companyId ? withCompany('/regulations/overview', companyId) : null,
  );

  return (
    <div>
      {/* Headline tiles — compact strip; each card opens its own insight page (SCRUM-45). */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          <Tile
            compact
            label="Jurisdictions"
            value={overview.jurisdictionCount}
            hint={`${overview.flags.priorityTier?.PRIORITY ?? 0} priority states`}
            onClick={() => navigate('/regulations/jurisdictions')}
          />
          <Tile
            compact
            label="Requirements"
            value={overview.requirements.total.toLocaleString()}
            hint={`${overview.requirements.mapped} mapped to value streams`}
            onClick={() => navigate('/regulations/catalog')}
          />
          <Tile
            compact
            label="Agent rules"
            value={overview.ruleCount.toLocaleString()}
            hint="machine-readable checks"
            onClick={() => navigate('/regulations/rules')}
          />
          <Tile
            compact
            label="Regulatory sources"
            value={overview.sourceCount.toLocaleString()}
            hint="official regulator sites & feeds"
            onClick={() => navigate('/regulations/sources')}
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

      <RequirementsTable baseParams={{ lens: LENS_PARAM[tab] }} />
    </div>
  );
}
