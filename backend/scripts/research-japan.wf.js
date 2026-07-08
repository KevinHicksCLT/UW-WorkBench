export const meta = {
  name: 'japan-regulation-research',
  description:
    'Deep-research real, current Japan insurance regulations (FSA / Insurance Business Act) for the International lens',
  phases: [
    { title: 'Research', detail: 'web research Japan regs', model: 'opus' },
    { title: 'Verify', detail: 'adversarial fact-check', model: 'opus' },
  ],
};

const ROW_PROPS = {
  jurisdictionCode: { type: 'string', description: 'Always JP' },
  jurisdictionName: { type: 'string', description: 'Japan' },
  regulatorName: { type: 'string', description: 'e.g. Financial Services Agency (FSA), Japan' },
  regulatorWebsite: { type: 'string' },
  regulatorType: { type: 'string', enum: ['INTERNATIONAL'] },
  regime: {
    type: 'string',
    description: 'e.g. Insurance Business Act, FSA Comprehensive Guidelines, APPI',
  },
  title: { type: 'string', description: 'ONE atomic obligation, <=95 chars' },
  requirement: {
    type: 'string',
    description: '2-3 sentences: who must do what, by when/how often, pass condition',
  },
  category: {
    type: 'string',
    enum: [
      'PRODUCT_FILING',
      'LICENSING',
      'SOLVENCY_CAPITAL',
      'FINANCIAL_REPORTING',
      'MARKET_CONDUCT',
      'DATA_PRIVACY',
      'CYBERSECURITY',
      'SANCTIONS_AML',
      'CORPORATE_GOVERNANCE',
      'ACTUARIAL_VALUATION',
      'CONSUMER_PROTECTION',
      'OPERATIONAL_RESILIENCE',
      'ESG_SUSTAINABILITY',
      'SUITABILITY',
      'ACCOUNTING_AUDIT',
    ],
  },
  markets: { type: 'array', items: { type: 'string', enum: ['PERSONAL', 'COMMERCIAL'] } },
  lines: { type: 'array', items: { type: 'string' } },
  obligationType: {
    type: 'string',
    enum: ['FILING_GATE', 'ONGOING', 'EVENT_DRIVEN', 'INFORMATIONAL'],
  },
  frequency: { type: 'string' },
  citation: {
    type: 'string',
    description: 'Real citation, e.g. Insurance Business Act Art. 4; FSA Notification No. X',
  },
  citationUrl: {
    type: 'string',
    description: 'Official source (fsa.go.jp, japaneselawtranslation.go.jp, elaws.e-gov.go.jp)',
  },
  sourceNote: { type: 'string' },
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

const LINEVOCAB =
  "Individual Life — Whole Life · Individual Life — Term · Individual Annuities — Fixed · Individual Annuities — Variable with Guarantees · Comprehensive (Hospital & Medical) — Individual · Long-Term Care · Fire · Earthquake · Private Passenger Auto Physical Damage · Other Private Passenger Auto Liability · Commercial Multiple Peril (non-liability portion) · General Liability · Workers' Compensation · Ocean Marine · Aircraft · Non-Life Reinsurance · Life Reinsurance";

const COMMON = `You research REAL, CURRENTLY-IN-FORCE Japan insurance-regulatory obligations for a foreign multi-line insurance group operating in Japan (life, non-life/general, and reinsurance). Today is July 2026.
HARD RULES:
- ONLY real obligations verifiable on official sources (fsa.go.jp, japaneselawtranslation.go.jp, elaws.e-gov.go.jp, boj.or.jp). NEVER invent an article number, notification number, or status. If unverifiable, omit and note in coverageNotes.
- Each row = ONE atomic obligation. regulatorName must be the actual regulator (Financial Services Agency (FSA), or the General Insurance Rating Organization of Japan (GIROJ), or the Life Insurance Association of Japan where applicable).
- market tagging PERSONAL/COMMERCIAL; lines from this vocabulary verbatim where line-specific, else empty: ${LINEVOCAB}
- Cover: Insurance Business Act licensing (Art. 3-4) & change filings, product/rate approval & GIROJ reference rates, solvency margin ratio (Art. 130) & ESR (economic value-based solvency, 2025-2026), statutory reserves/policy reserves & liability adequacy, actuary (Appointed Actuary) opinion, business report/financial statements to FSA, FSA Comprehensive Supervisory Guidelines conduct, customer-oriented business conduct principles, firewall/solicitation control (Insurance Solicitation rules 2016 amendments), APPI personal-data protection & PPC breach reporting, AML/CFT (FSA Guidelines + FIU/JAFIC reporting), cyber (FSA cyber guidelines), IFRS/J-GAAP reporting, sustainability/TCFD disclosure, group supervision & IAIG/ICS, anti-monopoly, policyholder protection corporation contributions.
- Return AT MOST 40 rows; verifiability over volume.`;

phase('Research');
let r = await agent(COMMON + '\n\nReturn the atomic obligations now.', {
  label: 'research:japan',
  phase: 'Research',
  schema: ROWS_SCHEMA,
  effort: 'high',
  model: 'opus',
});
if (!r)
  r = await agent(COMMON, {
    label: 'research:japan:retry',
    phase: 'Research',
    schema: ROWS_SCHEMA,
    effort: 'high',
    model: 'opus',
  });
if (!r) return { total: 0, batches: [] };
phase('Verify');
const listing = r.rows
  .map((x, i) => `[${i}] ${x.regime} | ${x.title} | cite:${x.citation} | url:${x.citationUrl}`)
  .join('\n');
const v = await agent(
  `Adversarial fact-checker, July 2026. Candidate Japan insurance-reg rows. REFUTE anything not real/in-force/wrongly-cited; web-search + fetch an official Japanese source (fsa.go.jp etc.) for each kept row; drop what you cannot verify. Field-level corrections for real rows with a wrong field.\n\nROWS:\n${listing}`,
  { label: 'verify:japan', phase: 'Verify', schema: VERIFY_SCHEMA, effort: 'high', model: 'opus' },
);
let verified = r.rows;
if (v) {
  const byIdx = new Map(r.rows.map((x, i) => [i, { ...x }]));
  for (const c of v.corrections) {
    const row = byIdx.get(c.index);
    if (row && c.field in ROW_PROPS) row[c.field] = c.value;
  }
  verified = v.keptIndexes.filter((i) => byIdx.has(i)).map((i) => byIdx.get(i));
}
log(`japan verified: ${verified.length}`);
return {
  total: verified.length,
  batches: [
    {
      key: 'japan',
      kept: verified.length,
      coverageNotes: r.coverageNotes,
      dropped: v ? v.droppedReasons : ['unverified'],
      rows: verified,
    },
  ],
};
