export const meta = {
  name: 'lob-corporate-regulation-research',
  description:
    'Deep-research real regs across all LOBs + Corporate-Functions regimes; market-tag; dedup vs existing; adversarially verify',
  phases: [
    { title: 'Research', detail: 'parallel web research per domain', model: 'opus' },
    { title: 'Verify', detail: 'adversarial fact-check per batch', model: 'opus' },
  ],
};

const EXISTING = args && args.existingRegimes ? args.existingRegimes : '';

const CATEGORIES = [
  'PRODUCT_FILING',
  'LICENSING',
  'PREMIUM_TAX',
  'SURPLUS_LINES',
  'WORKERS_COMP_REPORTING',
  'AUTO_VERIFICATION',
  'APCD_REPORTING',
  'FINANCIAL_REPORTING',
  'MARKET_CONDUCT',
  'DATA_CALL',
  'CYBERSECURITY',
  'DATA_PRIVACY',
  'AI_GOVERNANCE',
  'CLIMATE_RISK',
  'SANCTIONS_AML',
  'SUITABILITY',
  'OPERATIONAL_RESILIENCE',
  'CATASTROPHE_REPORTING',
  'UNCLAIMED_PROPERTY',
  'CONSUMER_PROTECTION',
  'CORPORATE_GOVERNANCE',
  'SOLVENCY_CAPITAL',
  'ACTUARIAL_VALUATION',
  'ACCOUNTING_AUDIT',
  'TAX_REPORTING',
  'EMPLOYMENT_BENEFITS',
  'ANTITRUST_CONDUCT',
  'ESG_SUSTAINABILITY',
  'SECURITIES_DISTRIBUTION',
  'RESIDUAL_MARKET',
];

const ROW_PROPS = {
  jurisdictionCode: {
    type: 'string',
    description:
      'USPS state code, or NAIC for a multistate NAIC Model Law/regulation, or FED-<AGENCY> (FED-SEC, FED-DOL, FED-IRS, FED-TREAS, FED-PCAOB, FED-OSHA, FED-FTC, FED-DOJ, FED-HHS, FED-CMS, FED-FEMA, FED-USDA), or country/region (UK, EU, IAIS for global standards, CA-NAT for Canada, BM for Bermuda)',
  },
  jurisdictionName: { type: 'string' },
  regulatorName: { type: 'string' },
  regulatorWebsite: { type: 'string' },
  regulatorType: {
    type: 'string',
    enum: ['STATE_INSURANCE_REGULATOR', 'FEDERAL', 'INTERNATIONAL'],
  },
  regime: {
    type: 'string',
    description:
      'Short named regulation/regime label, e.g. Sarbanes-Oxley Act, NAIC RBC, ORSA (Model 505), IFRS 17, Solvency II Pillar 3, IAIS ICP 8, NAIC Mortgage Guaranty Model 630',
  },
  title: { type: 'string', description: 'ONE atomic obligation, <=95 chars' },
  requirement: {
    type: 'string',
    description: '2-3 sentences: who must do what, to whom, by when/how often, pass condition',
  },
  category: { type: 'string', enum: CATEGORIES },
  markets: {
    type: 'array',
    items: { type: 'string', enum: ['PERSONAL', 'COMMERCIAL'] },
    description:
      'Which insurance market(s) the obligation applies to. Use both when it applies to personal AND commercial lines; a corporate/enterprise obligation applies to both.',
  },
  lines: {
    type: 'array',
    items: { type: 'string' },
    description:
      'Specific line-of-business labels this governs, from the provided vocabulary (verbatim). Empty/omit for enterprise-wide obligations that are not line-specific.',
  },
  obligationType: {
    type: 'string',
    enum: ['FILING_GATE', 'ONGOING', 'EVENT_DRIVEN', 'INFORMATIONAL'],
  },
  frequency: {
    type: 'string',
    description: 'annual | quarterly | monthly | per-event | continuous | one-time',
  },
  citation: { type: 'string', description: 'Real legal citation' },
  citationUrl: { type: 'string', description: 'URL of an OFFICIAL source' },
  sourceNote: {
    type: 'string',
    description: 'One line: where verified + effective date/current status as of 2026',
  },
};
const ROWS_SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        properties: ROW_PROPS,
        required: [
          'jurisdictionCode',
          'jurisdictionName',
          'regulatorName',
          'regulatorType',
          'regime',
          'title',
          'requirement',
          'category',
          'markets',
          'obligationType',
          'frequency',
          'citation',
          'citationUrl',
          'sourceNote',
        ],
      },
    },
    coverageNotes: { type: 'string' },
  },
  required: ['rows', 'coverageNotes'],
};
const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    keptIndexes: { type: 'array', items: { type: 'integer' } },
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          field: { type: 'string' },
          value: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['index', 'field', 'value', 'why'],
      },
    },
    droppedReasons: { type: 'array', items: { type: 'string' } },
  },
  required: ['keptIndexes', 'corrections', 'droppedReasons'],
};

const COMMON = `You research REAL, CURRENTLY-IN-FORCE regulatory obligations for a large US-headquartered multi-line insurance group (writes every P&C personal & commercial line, life, annuities, health, workers' comp, surplus lines, reinsurance; SEC-registered parent; operates in all US states + EU/UK/Canada/Bermuda). Today is July 2026.

HARD RULES:
- ONLY real regulations verifiable on official sources via web search (.gov, eCFR, federalregister.gov, sec.gov, dol.gov, irs.gov, naic.org/content.naic.org, eur-lex.europa.eu, eiopa.europa.eu, legislation.gov.uk, iaisweb.org, ifrs.org, canada.ca, state DOI sites). NEVER invent a citation, model number, article, or status. If unverifiable, omit it and say so in coverageNotes.
- Each row = ONE atomic obligation (a filing, report, program duty, disclosure, certification), phrased crisply.
- Use web search extensively; fetch official pages to confirm citations + current status. Prefer obligations effective/amended 2018-2026.
- market tagging: set markets to ['PERSONAL'], ['COMMERCIAL'], or both. Corporate/enterprise obligations (governance, solvency, accounting, tax, employment, securities) apply to BOTH.
- lines: tag specific line-of-business labels ONLY from this vocabulary (verbatim), or leave empty for enterprise-wide obligations:
${args && args.lineVocab ? args.lineVocab : ''}
- DEDUP: the catalog ALREADY contains these regimes — do NOT re-add an obligation that clearly duplicates one already covered (add only genuinely NEW distinct obligations, including new atomic duties within an already-listed regime):
${EXISTING}
- Return AT MOST 40 rows; verifiability over volume.`;

const TASKS = [
  {
    key: 'corp-naic-solvency',
    prompt: `${COMMON}\n\nDOMAIN: NAIC multistate corporate/solvency model laws (jurisdictionCode NAIC, regulatorType STATE_INSURANCE_REGULATOR, category CORPORATE_GOVERNANCE/SOLVENCY_CAPITAL/ACCOUNTING_AUDIT, markets both). Research atomic obligations under: NAIC Statutory Accounting Principles (SSAPs) & Annual/Quarterly Statement Blanks filing, Model Audit Rule (Model 205) audited financials + internal control, Corporate Governance Annual Disclosure (Model 305), Insurance Holding Company System Act (Models 440/450) Form A/B/C/D/F filings, Risk-Based Capital (Model 312) annual RBC report, ORSA (Model 505) summary report, Group Capital Calculation, VM-20/VM-21/VM-31 principle-based reserving, Standard Valuation Law (Model 820) actuarial opinion, Actuarial Opinion & Memorandum (Model 822), Investments of Insurers Model Act, NAIC SVO filings. Cite the NAIC model # and note it is adopted state-by-state.`,
  },
  {
    key: 'corp-fed-securities-tax',
    prompt: `${COMMON}\n\nDOMAIN: US FEDERAL securities, audit & tax (regulatorType FEDERAL, markets both). Research atomic obligations: Sarbanes-Oxley §302/§404/§802 (CEO/CFO certification, ICFR, records), SEC periodic reporting (10-K, 10-Q, 8-K, proxy/DEF 14A), SEC executive-comp clawback (Rule 10D-1 / listing standards), PCAOB auditing standards for the issuer, Investment Advisers Act 1940 & Investment Company Act 1940 duties for any registered adviser/fund/separate account, Volcker Rule, IRC Subchapter L (§801-848) tax return, IRC §7702/§7702A life-insurance definitional testing, §7702B LTC, FATCA (Ch. 4) reporting. jurisdictionCode FED-SEC/FED-PCAOB/FED-IRS/FED-TREAS.`,
  },
  {
    key: 'corp-fed-employment-conduct',
    prompt: `${COMMON}\n\nDOMAIN: US FEDERAL employment, benefits, antitrust & anti-corruption (regulatorType FEDERAL, markets both). Research atomic obligations: ERISA fiduciary/reporting (5500) for the group's own benefit plans AND for group products it administers, Title VII/ADA/ADEA/FMLA/FLSA core employer duties, OSHA recordkeeping/reporting, Foreign Corrupt Practices Act books-&-records + anti-bribery, Sherman/Clayton antitrust compliance (incl. McCarran-Ferguson boundaries), FTC Act §5 UDAP. jurisdictionCode FED-DOL/FED-EEOC/FED-OSHA/FED-DOJ/FED-FTC. Keep to real, enforceable duties with citations.`,
  },
  {
    key: 'intl-solvency2-detail',
    prompt: `${COMMON}\n\nDOMAIN: EU Solvency II system-of-governance & reporting detail (regulatorType INTERNATIONAL, jurisdictionCode EU, markets both). Research atomic obligations per Directive 2009/138/EC as amended: System of Governance (Arts 41-50), Risk Management Function (44), Internal Audit Function (47), Actuarial Function (48), Outsourcing (49), Fit & Proper (42), Prudent Person Principle (132), Pillar 1 SCR/MCR/Own Funds, Pillar 3 SFCR/RSR/QRTs, ORSA (45), Internal Model approval (112-127). One atomic duty per article/report. Verify against eur-lex + EIOPA.`,
  },
  {
    key: 'intl-accounting-esg',
    prompt: `${COMMON}\n\nDOMAIN: International accounting & sustainability reporting (regulatorType INTERNATIONAL, markets both). Research atomic obligations: IFRS 17 Insurance Contracts measurement/disclosure, IFRS 9 Financial Instruments, EU Audit Regulation 537/2014 (auditor rotation/PIE), EIOPA Cloud Outsourcing Guidelines, PRIIPs KID, CSRD/ESRS sustainability statement, SFDR entity/product disclosures, EU Taxonomy Regulation, CSDDD due diligence, ISSB IFRS S1/S2, UK operational resilience PS21/3 & PS24/16. jurisdictionCode EU or UK. Verify effective dates (many phase 2024-2028).`,
  },
  {
    key: 'intl-conduct-aml-global',
    prompt: `${COMMON}\n\nDOMAIN: International conduct, financial-crime & global standards (regulatorType INTERNATIONAL, markets both). Research: EU AMLD5/6 & AML Regulation (AMLR) 2024 duties, EU Whistleblowing Directive 2019/1937, EU Pay Transparency Directive 2023/970, NIS2 Directive, EU Data Act, Insurance Distribution Directive (IDD) POG/IPID (new atomic duties only), PRIIPs, UK Bribery Act 2010, FATF Recommendations, IAIS Insurance Core Principles (ICPs) + ComFrame + ICS + Holistic Framework + Recovery & Resolution (ICP 12). Use jurisdictionCode EU, UK, or IAIS (regulatorName International Association of Insurance Supervisors). Verify.`,
  },
  {
    key: 'state-market-conduct-models',
    prompt: `${COMMON}\n\nDOMAIN: NAIC market-conduct & privacy model laws (jurisdictionCode NAIC, regulatorType STATE_INSURANCE_REGULATOR). Research atomic obligations: Unfair Trade Practices Act (Model 880), Unfair Claims Settlement Practices Act (Model 900), Producer Licensing Model Act (Model 218), Insurance Fraud Prevention Model Act (Model 680) SIU/anti-fraud plan, Advertising of Life Insurance & A&H Model Regs, Privacy of Consumer Financial & Health Information (Model 672), Insurance Information and Privacy Protection (Model 670), Suitability in Annuity Transactions (Model 275 — only NEW atomic duties). Tag markets appropriately (claims/UTPA = both; annuity suitability = both). Cite model #.`,
  },
  {
    key: 'lob-personal-property',
    prompt: `${COMMON}\n\nDOMAIN: PERSONAL-LINES property & specialty line-specific obligations (markets ['PERSONAL']). Research REAL distinct regs (not generic SERFF filing): Homeowners/mobile-home rate & form rules, Earthquake disclosure (e.g. CA CEA), Private Flood (state private-flood laws + NFIP interplay), NAIC Pet Insurance Model (Model 633, 2022 — states adopting), Title Insurance (Model 628 / state title rules, escrow/closing-protection), Credit Insurance (Model 360 rate/refund), Service Warranty/vehicle service contracts (state VSC/warranty acts), Automobile Club registration, Family Leave Insurance (state paid-family-leave insurer duties), Livestock/farmowners. Use state codes or NAIC. Tag lines from vocab. Verify each.`,
  },
  {
    key: 'lob-commercial-pc',
    prompt: `${COMMON}\n\nDOMAIN: COMMERCIAL-LINES P&C line-specific obligations (markets ['COMMERCIAL']). Research REAL distinct regs: Commercial Multiple Peril, Boiler & Machinery/equipment breakdown inspection laws, Aircraft/aviation, Multiple Peril Crop (Federal Crop Insurance / RMA SRA — jurisdictionCode FED-USDA), Fidelity/Surety (state surety & bail-bond licensing), Mortgage Guaranty (NAIC Model 630 contingency reserve + monoline), Financial Guaranty (NY Art 69 / NAIC Model 1626), Medical Professional Liability, Products Liability, Nuclear liability (Price-Anderson, FED), Terrorism Risk (TRIA at commercial-policy level — new atomic duties), Excess Workers' Comp. Tag lines. Verify.`,
  },
  {
    key: 'lob-surplus-alt',
    prompt: `${COMMON}\n\nDOMAIN: Surplus lines & alternative-risk vehicles (markets ['COMMERCIAL']). Research REAL distinct regs: Nonadmitted & Reinsurance Reform Act (NRRA — home-state surplus-lines tax, FED-TREAS), state surplus-lines stamping-office & diligent-search filings, Surplus Lines Model Act (Model 870), Captive insurer annual reporting (VT/DE/etc. captive statutes), Risk Retention Groups (federal LRRA registration + state registration), Fraternal Benefit Societies (Model 560), Residual Market Mechanisms (FAIR/JUA/assigned-risk — NEW obligations only; state assessments). Tag lines. Verify.`,
  },
  {
    key: 'lob-life-detail',
    prompt: `${COMMON}\n\nDOMAIN: Life-insurance line-specific obligations across individual & group life sub-lines (markets: individual=['PERSONAL'], group=['COMMERCIAL']). Research REAL distinct regs beyond generic filing: Variable Life/VUL SEC registration + NAIC Variable Life Model (Model 250/270), Life Illustrations (Model 582), Nonforfeiture (Model 808), Universal Life Model (Model 585), Indexed products (AG 49-A illustration), Replacement (Model 613), Advertising (Model 570), Accelerated Benefits (Model 620), Group life certificate delivery, YRT reserving. Tag lines (Individual Life — Whole Life, Group Life — Term, etc.). Verify.`,
  },
  {
    key: 'lob-annuity-detail',
    prompt: `${COMMON}\n\nDOMAIN: Annuity line-specific obligations (individual=['PERSONAL'], group=['COMMERCIAL']). Research REAL distinct regs: Variable Annuity SEC registration + prospectus, Registered Index-Linked Annuity (RILA) SEC Form N-4 (2024 rule), NAIC Variable Annuity reserving/VM-21 & AG 43, Indexed Annuity illustration (AG 49-A), Annuity Disclosure (Model 245), Buyer's Guide, Free-look, Contingent Deferred Annuity, Pension Risk Transfer group annuity, Life Contingent Payout. Tag annuity lines. jurisdictionCode NAIC/FED-SEC/state. Verify.`,
  },
  {
    key: 'lob-health-detail',
    prompt: `${COMMON}\n\nDOMAIN: Health line-specific obligations (individual=['PERSONAL'], group=['COMMERCIAL']). Research REAL distinct regs beyond existing MLR/parity/APCD: Medicare Supplement (Model 651 + NAIC), Medicare Advantage/Part D (CMS), Medicaid managed care (42 CFR 438), FEHB (OPM), Long-Term Care (Model 640/641 rate stability + Model 642 suitability), Disability Income, Dental/Vision plan rules, HMO Model Act (Model 430) + Health Care Center, Network Adequacy (Model 74), Utilization Review (Model 73), external review (Model 75), RxDC/Consolidated Approps (NEW only). Tag health lines. Verify.`,
  },
  {
    key: 'lob-specialty-credit-title',
    prompt: `${COMMON}\n\nDOMAIN: Specialty/financial lines cross-cutting (markets vary). Research REAL distinct regs: Title Insurance (RESPA §8 anti-kickback FED-CFPB, ALTA best practices, state title rating bureaus), Mortgage Guaranty (private MI Master Policy, GSE PMIERs — jurisdictionCode FED for FHFA), Credit / Credit Life / Credit A&H (Model 360, Reg Z credit insurance disclosure), Warranty/Service Contracts, Prepaid Legal, Bail Bond, Glass/Burglary&Theft inland-marine filing, Residual Value, Aggregate write-ins. Tag lines. Cite. Verify. Avoid duplicating existing GLBA/FCRA rows.`,
  },
];

phase('Research');
const results = await pipeline(
  TASKS,
  async (t) => {
    let r = await agent(t.prompt, {
      label: `research:${t.key}`,
      phase: 'Research',
      schema: ROWS_SCHEMA,
      effort: 'high',
      model: 'opus',
    });
    if (!r)
      r = await agent(t.prompt, {
        label: `research-retry:${t.key}`,
        phase: 'Research',
        schema: ROWS_SCHEMA,
        effort: 'high',
        model: 'opus',
      });
    return r ? { key: t.key, ...r } : null;
  },
  async (batch, t) => {
    if (!batch || !batch.rows.length)
      return batch && { ...batch, verified: [], dropped: ['batch empty'] };
    const listing = batch.rows
      .map(
        (r, i) =>
          `[${i}] ${r.jurisdictionCode} | ${r.regime} | ${r.title} | markets:${(r.markets || []).join('+')} | cite:${r.citation} | url:${r.citationUrl}`,
      )
      .join('\n');
    let v = await agent(
      `Adversarial fact-checker. Today July 2026. Candidate regulatory rows for domain "${t.key}". REFUTE anything not real, not currently in force, wrongly cited, misattributed, or a duplicate of a well-known already-catalogued regime. Web-search + fetch an official source for EVERY row kept; drop what you cannot verify (default drop when uncertain). Provide field-level corrections for real rows with a wrong field.\n\nROWS:\n${listing}`,
      {
        label: `verify:${t.key}`,
        phase: 'Verify',
        schema: VERIFY_SCHEMA,
        effort: 'high',
        model: 'opus',
      },
    );
    if (!v)
      return {
        ...batch,
        verified: batch.rows,
        dropped: ['verifier unavailable — kept unverified'],
      };
    const byIdx = new Map(batch.rows.map((r, i) => [i, { ...r }]));
    for (const c of v.corrections) {
      const row = byIdx.get(c.index);
      if (row && c.field in ROW_PROPS) row[c.field] = c.value;
    }
    const verified = v.keptIndexes.filter((i) => byIdx.has(i)).map((i) => byIdx.get(i));
    return {
      key: batch.key,
      coverageNotes: batch.coverageNotes,
      verified,
      dropped: v.droppedReasons,
    };
  },
);

const batches = results.filter(Boolean);
const total = batches.reduce((s, b) => s + (b.verified?.length ?? 0), 0);
log(`verified rows total: ${total}`);
return {
  total,
  batches: batches.map((b) => ({
    key: b.key,
    kept: b.verified?.length ?? 0,
    coverageNotes: b.coverageNotes,
    dropped: b.dropped,
    rows: b.verified,
  })),
};
