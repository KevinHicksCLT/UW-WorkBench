// One-time extraction: parses docs/regulations/50-state-regulations-baseline.md
// (the pandoc conversion of "50 State Regulator Regulations.docx") into
// backend/seed/regulations-baseline.json — the reviewed, canonical baseline
// artifact that src/seed/seedRegulations.ts consumes.
//
// Layers extracted (design doc §2):
//   • 51 per-state narrative sections (Regulator / Statutes & Regulations /
//     Integration & Electronic Systems blocks)
//   • Cross-State Taxonomy Table (6 flags/state; raw text + normalized token)
//   • 12 full compliance profiles (GA FL TX NY MA CA NC WI MI CT MD CO)
//   • Machine-readable rules YAML (10 states — NC + CO headings exist but their
//     bodies are EMPTY in the doc → template-derived, flagged in meta.knownGaps)
//   • Master STATE_compliance_rules.yaml template → TEMPLATE_DERIVED rules for
//     the remaining states
//   • IntegrationSystem catalog + per-state usage, derived requirements,
//     bulletins, and the RegulatorySource monitoring registry
//
// Run: npx tsx scripts/extract-regulations-baseline.ts

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '../../docs/regulations/50-state-regulations-baseline.md');
const OUT = path.resolve(here, '../seed/regulations-baseline.json');

const STATES: [string, string][] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
  ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
  ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
  ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
  ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'],
  ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];
const NAME_TO_CODE = new Map(STATES.map(([c, n]) => [n, c]));
const PRIORITY = new Set(['FL', 'TX', 'NY', 'CA', 'NC']);
const FULL_PROFILE = new Set(['GA', 'FL', 'TX', 'NY', 'MA', 'CA', 'NC', 'WI', 'MI', 'CT', 'MD', 'CO']);

const raw = fs.readFileSync(SRC, 'utf8');
const lines = raw.split(/\r?\n/);

// ── Boundary detection ────────────────────────────────────────────────────────
// Sections are delimited by: bold whole-line state headings, bold artifact
// headings (*_compliance_profile.md / *_compliance_rules.yaml, incl. the NC/WI
// variants whose underscores were eaten by the docx conversion), setext
// headings (underlined with ----), and the bold Conclusion paragraph.
type Boundary = { line: number; kind: 'state' | 'profile' | 'rules' | 'section'; key?: string };
const boundaries: Boundary[] = [];
const ARTIFACT = /^\*\*([A-Z]{2})\\?_?compliance\\?_?(profile\.md|rules\.yaml)\*\*\s*$/;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const bold = l.match(/^\*\*(.+?)\*\*\s*$/);
  if (bold && NAME_TO_CODE.has(bold[1])) { boundaries.push({ line: i, kind: 'state', key: NAME_TO_CODE.get(bold[1])! }); continue; }
  const art = l.match(ARTIFACT);
  if (art) { boundaries.push({ line: i, kind: art[2].startsWith('profile') ? 'profile' : 'rules', key: art[1] }); continue; }
  if (/^-{4,}\s*$/.test(l) && i > 0 && lines[i - 1].trim() && !lines[i - 1].startsWith('  ')) { boundaries.push({ line: i - 1, kind: 'section' }); continue; }
  if (/^\*\*Conclusion/.test(l)) boundaries.push({ line: i, kind: 'section' });
}
boundaries.sort((a, b) => a.line - b.line);
const endOf = (start: number) => {
  const next = boundaries.find((b) => b.line > start);
  return next ? next.line : lines.length;
};
const block = (from: number, to: number) => lines.slice(from, to).join('\n').trim();

// ── Pandoc-escape cleanup ─────────────────────────────────────────────────────
// Artifact blocks are hard-broken: each logical line ends with a trailing `\`,
// wrapped continuations carry no terminator, a lone `\` is a blank line, and
// `_ [ ] #` are backslash-escaped.
function logicalLines(text: string): string[] {
  const out: string[] = [];
  let acc: string | null = null;
  for (const physRaw of text.split('\n')) {
    // The docx conversion indents the artifact blocks with NO-BREAK SPACEs,
    // which YAML treats as content — normalize to regular spaces.
    const phys = physRaw.replace(/ /g, ' ').replace(/\s+$/, '');
    if (phys === '\\' || phys === '') { if (acc !== null) { out.push(acc); acc = null; } out.push(''); continue; }
    const ends = phys.endsWith('\\');
    const body = ends ? phys.slice(0, -1) : phys;
    acc = acc === null ? body : acc + ' ' + body.trim();
    if (ends) { out.push(acc); acc = null; }
  }
  if (acc !== null && acc.trim()) out.push(acc);
  return out.map((l) => l.replace(/\\([_\[\]#'"&<>$%~^])/g, '$1'));
}

// Profile blocks → clean markdown sections keyed by their `## ` heading.
function parseProfile(text: string): Record<string, string> {
  const ll = logicalLines(text);
  const sections: Record<string, string> = {};
  let current = '_preamble';
  let buf: string[] = [];
  const flush = () => { if (buf.length) sections[current] = buf.join('\n').trim(); buf = []; };
  for (const l of ll) {
    const h = l.match(/^##\s+(.+)$/);
    if (h) { flush(); current = h[1].trim(); continue; }
    if (/^#\s+/.test(l)) continue;
    buf.push(l);
  }
  flush();
  return sections;
}

// ── YAML reconstruction ───────────────────────────────────────────────────────
// The WI rules body (and NC profile) lost every underscore in conversion
// ("statecode", "insuranceregulator"). Restore tokens against a vocabulary
// built from the clean YAML bodies + the master template.
const vocab = new Map<string, string>(); // flattened → underscored
function feedVocab(text: string) {
  for (const m of text.matchAll(/[a-z][a-z0-9]*(?:_[a-z0-9]+)+/g)) {
    vocab.set(m[0].replace(/_/g, ''), m[0]);
  }
}
function restoreUnderscores(text: string): string {
  return text.replace(/[a-z][a-z0-9]{3,}/g, (w) => vocab.get(w) ?? w);
}
function parseRulesYaml(text: string, restore = false): any {
  let joined = logicalLines(text).join('\n');
  if (restore) joined = restoreUnderscores(joined);
  return YAML.parse(joined);
}

// ── Narrative section parsing ────────────────────────────────────────────────
type Narrative = {
  regulator: string; statutes: string; integration: string;
  regulatorName: string; regulatorWebsite: string | null; statutoryAuthority: string | null;
};
function parseNarrative(text: string): Narrative {
  const idx = (marker: RegExp) => {
    const m = text.match(marker);
    return m ? text.indexOf(m[0]) : -1;
  };
  const iReg = idx(/\*\*Regulator:\*\*/);
  const iStat = idx(/\*\*Statutes & Regulations:\*\*/);
  const iInt = idx(/\*\*Integration & Electronic Systems:\*\*/);
  const seg = (from: number, to: number, label: RegExp) =>
    (from >= 0 ? text.slice(from, to >= 0 ? to : undefined) : '').replace(label, '').trim();
  const regulator = seg(iReg, iStat, /\*\*Regulator:\*\*\s*/);
  const statutes = seg(iStat, iInt, /\*\*Statutes & Regulations:\*\*\s*/);
  const integration = iInt >= 0 ? text.slice(iInt).replace(/\*\*Integration & Electronic Systems:\*\*\s*/, '').trim() : '';

  const nameM = regulator.match(/\*\*([^*]+?)\*\*/);
  const regulatorName = (nameM ? nameM[1] : '').replace(/\s+/g, ' ').trim();
  const urlM = regulator.match(/https?:\/\/[^\s)\]>"']+/);
  let regulatorWebsite = urlM ? urlM[0] : null;
  if (regulatorWebsite) regulatorWebsite = regulatorWebsite.split(/%5B|\\\]|\*\*/)[0].replace(/[).,;]+$/, '');

  // First bold phrase in the statutes block that reads like a code citation.
  let statutoryAuthority: string | null = null;
  for (const m of statutes.matchAll(/\*\*([^*]+?)\*\*/g)) {
    const t = m[1].replace(/\s+/g, ' ').trim();
    if (/Title|Chapter|Code|Statut|§|Revised|Annotated|Laws/i.test(t) && t.length > 8) { statutoryAuthority = t; break; }
  }
  return { regulator, statutes, integration, regulatorName, regulatorWebsite, statutoryAuthority };
}

// ── Taxonomy table ────────────────────────────────────────────────────────────
type Taxonomy = {
  filingPortalRaw: string; compactRaw: string; autoVerifyRaw: string;
  workersCompRaw: string; apcdRaw: string; sbsRaw: string;
};
const taxonomy = new Map<string, Taxonomy>();
{
  const start = lines.findIndex((l) => l.includes('**State / DC**'));
  if (start < 0) throw new Error('taxonomy table header not found');
  for (let i = start + 2; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) break;
    const cols = l.trim().split(/\s{2,}/);
    if (cols.length < 7) throw new Error(`taxonomy row malformed: ${l}`);
    const [code, filingPortalRaw, compactRaw, autoVerifyRaw, workersCompRaw, apcdRaw, sbsRaw] = cols;
    taxonomy.set(code, { filingPortalRaw, compactRaw, autoVerifyRaw, workersCompRaw, apcdRaw, sbsRaw });
  }
  if (taxonomy.size !== 51) throw new Error(`expected 51 taxonomy rows, got ${taxonomy.size}`);
}

function normalizeTaxonomy(t: Taxonomy) {
  const filingPortal = t.filingPortalRaw === 'SERFF' ? 'SERFF' : /propriet/i.test(t.filingPortalRaw) ? 'PROPRIETARY' : 'MIXED';
  const compactStatus = /^member/i.test(t.compactRaw) ? 'MEMBER' : 'NON_MEMBER';
  const autoVerification = t.autoVerifyRaw === 'Yes' ? 'YES' : t.autoVerifyRaw === 'No' ? 'NO' : 'PARTIAL';
  const wc = t.workersCompRaw;
  const workersCompModel = wc === 'EDI' ? 'EDI'
    : /monopolistic/i.test(wc) ? 'MONOPOLISTIC_FUND'
    : /^non-edi/i.test(wc) ? 'NON_EDI'
    : /state-specific/i.test(wc) ? 'STATE_SPECIFIC'
    : /^edi/i.test(wc) ? 'EDI'
    : 'MIXED';
  const apcd = t.apcdRaw === 'Yes' ? 'YES' : t.apcdRaw === 'No' ? 'NO' : 'EMERGING';
  const sbs = t.sbsRaw === 'Yes' ? 'YES' : t.sbsRaw === 'No' ? 'NO' : /transition/i.test(t.sbsRaw) ? 'TRANSITIONING' : 'PARTIAL';
  return {
    filingPortal, filingPortalDetail: filingPortal === 'SERFF' ? null : t.filingPortalRaw,
    compactStatus,
    autoVerification, autoVerificationDetail: autoVerification === 'PARTIAL' ? t.autoVerifyRaw : null,
    workersCompModel, workersCompDetail: workersCompModel === 'EDI' && wc === 'EDI' ? null : wc,
    apcd, sbs,
  };
}

// ── Collect per-state blocks ──────────────────────────────────────────────────
const narrativeByState = new Map<string, Narrative>();
const profileByState = new Map<string, Record<string, string>>();
const rulesTextByState = new Map<string, string>();
const knownGaps: string[] = [];

for (const b of boundaries) {
  const body = block(b.line + (b.kind === 'state' || b.kind === 'profile' || b.kind === 'rules' ? 1 : 0), endOf(b.line));
  if (b.kind === 'state' && !narrativeByState.has(b.key!)) narrativeByState.set(b.key!, parseNarrative(body));
  if (b.kind === 'profile' && body) profileByState.set(b.key!, parseProfile(body));
  if (b.kind === 'rules' && body) rulesTextByState.set(b.key!, body);
}
// Rules headings whose body is empty in the doc (NC, CO — and WI's first,
// duplicated heading, which IS followed by a body under its second heading).
for (const b of boundaries) {
  if (b.kind === 'rules' && b.key && !rulesTextByState.has(b.key)) {
    knownGaps.push(`${b.key} rules YAML heading present but body empty in source doc → TEMPLATE_DERIVED`);
  }
}
if (narrativeByState.size !== 51) {
  const missing = STATES.filter(([c]) => !narrativeByState.has(c)).map(([c]) => c);
  throw new Error(`expected 51 narrative sections, got ${narrativeByState.size}; missing: ${missing.join(',')}`);
}

// Master rules template (the `**STATE_compliance_rules.yaml**` artifact).
const templateBoundary = boundaries.find((b) => {
  if (b.kind !== 'rules') return false;
  return /^\*\*STATE\\?_compliance/.test(lines[b.line]);
});
// ARTIFACT regex captures 2 uppercase letters, so "STATE_…" matched key "ST"… find it explicitly:
const tmplLine = lines.findIndex((l) => /^\*\*STATE\\?_compliance\\?_rules\.yaml\*\*\s*$/.test(l));
if (tmplLine < 0) throw new Error('master rules template not found');
const templateText = block(tmplLine + 1, endOf(tmplLine));
void templateBoundary;

// Build the underscore vocabulary from clean sources, then parse.
feedVocab(logicalLines(templateText).join('\n'));
for (const [code, text] of rulesTextByState) if (code !== 'WI') feedVocab(logicalLines(text).join('\n'));

const parsedRules = new Map<string, any>();
for (const [code, text] of rulesTextByState) {
  try {
    parsedRules.set(code, parseRulesYaml(text, code === 'WI'));
  } catch (e) {
    knownGaps.push(`${code} rules YAML failed to parse (${(e as Error).message.slice(0, 80)}) → TEMPLATE_DERIVED`);
  }
}

// Template instantiation for states without a document YAML.
function templateRules(code: string, name: string, regulatorName: string, tax: ReturnType<typeof normalizeTaxonomy>) {
  const fill = (s: string) => s
    .replace(/\{\{STATE_CODE\}\}/g, code)
    .replace(/\{\{STATE_NAME\}\}/g, name)
    .replace(/\{\{REGULATOR_NAME\}\}/g, regulatorName)
    .replace(/\{\{DATE\}\}/g, '2026-06-10')
    .replace(/\{\{PRIMARY_FILING_PLATFORM\}\}/g, tax.filingPortal === 'PROPRIETARY' ? (tax.filingPortalDetail ?? 'state portal') : 'SERFF')
    .replace(/\{\{SECONDARY_PLATFORM_OR_NA\}\}/g, 'NAIC systems for licensing and reporting')
    .replace(/\{\{COMPACT_STATUS\}\}/g, tax.compactStatus)
    .replace(/\{\{SBS_STATUS\}\}/g, tax.sbs)
    .replace(/\{\{APCD_STATUS\}\}/g, tax.apcd)
    .replace(/\{\{STATE_SPECIFIC_TYPE_[123]\}\}/g, 'string');
  const joined = fill(logicalLines(templateText).join('\n'));
  return YAML.parse(joined);
}

// ── Integration systems catalog ───────────────────────────────────────────────
const integrationSystems = [
  { name: 'SERFF', kind: 'FILING', operator: 'NAIC', website: 'https://www.serff.com/', apiAvailability: 'WEB_SERVICES', description: 'System for Electronic Rate and Form Filing — the near-universal NAIC platform for rate, rule, and form filings. Web-services interfaces allow carriers to automate filings and track review status.' },
  { name: 'IRFS', kind: 'FILING', operator: 'STATE', website: 'https://irfs.fldfs.com/', apiAvailability: 'PORTAL_ONLY', description: "Florida's Insurance Regulation Filing System (formerly I-File) — the mandatory proprietary portal for all product filings in Florida (one of the few states not using SERFF for most filings)." },
  { name: 'UCAA', kind: 'LICENSING', operator: 'NAIC', website: 'https://content.naic.org/industry_ucaa.htm', apiAvailability: 'PORTAL_ONLY', description: 'Uniform Certificate of Authority Application — standardized company licensing used nationwide; electronic submission of insurer licensing and corporate changes.' },
  { name: 'NIPR', kind: 'LICENSING', operator: 'NAIC', website: 'https://nipr.com/', apiAvailability: 'API', description: 'National Insurance Producer Registry — agent/producer licensing, renewals, and appointments for all states, with APIs and batch processing.' },
  { name: 'SBS', kind: 'LICENSING', operator: 'NAIC', website: 'https://sbs.naic.org/', apiAvailability: 'PORTAL_ONLY', description: 'NAIC State Based Systems — licensing (producers and companies), regulatory actions, and consumer services platform used by 30+ states.' },
  { name: 'IIPRC Compact Portal', kind: 'FILING', operator: 'COMPACT', website: 'https://www.insurancecompact.org/', apiAvailability: 'PORTAL_ONLY', description: 'Interstate Insurance Product Regulation Commission — single-point SERFF filings for eligible life, annuity, LTC, and disability products covering all member states.' },
  { name: 'MCAS / iSite+', kind: 'DATA_REPORTING', operator: 'NAIC', website: 'https://content.naic.org/mcas.htm', apiAvailability: 'PORTAL_ONLY', description: "NAIC Market Conduct Annual Statement and financial data repositories — standardized multi-state submission of annual financial statements and market conduct data via NAIC's secure iSite+ environment." },
  { name: 'NAIC EFT', kind: 'PAYMENT', operator: 'NAIC', website: 'https://www.serff.com/', apiAvailability: 'PORTAL_ONLY', description: "NAIC Electronic Funds Transfer — electronic payment of filing fees, integrated into SERFF." },
  { name: 'OPTins', kind: 'TAX', operator: 'NAIC', website: 'https://www.optins.org/', apiAvailability: 'PORTAL_ONLY', description: 'Online Premium Tax for Insurance — NAIC system for electronic premium tax payments and surplus lines tax filings.' },
  { name: 'SLIP+ for States', kind: 'TAX', operator: 'VENDOR', website: null, apiAvailability: 'PORTAL_ONLY', description: 'Surplus lines data and tax reporting platform adopted by several states (e.g. Alabama, effective Jan 1 2026) as an OPTins replacement for surplus lines transactions.' },
  { name: 'IAIABC Workers’ Comp EDI', kind: 'CLAIMS_EDI', operator: 'STATE', website: 'https://www.iaiabc.org/', apiAvailability: 'SFTP_BATCH', description: 'IAIABC-standard EDI for First/Subsequent Reports of Injury (FROI/SROI) to state workers’ compensation regulators — trading-partner registration plus batch or real-time transmission.' },
  { name: 'State auto insurance verification program', kind: 'VERIFICATION', operator: 'STATE', website: null, apiAvailability: 'WEB_SERVICES', description: 'Compulsory auto insurance verification feeds/queries to state or DMV databases (e.g. GEICS in Georgia, TexasSure in Texas) — recurring policy data feeds or query-response web services from policy admin systems.' },
  { name: 'WCIS', kind: 'CLAIMS_EDI', operator: 'STATE', website: 'https://www.dir.ca.gov/dwc/wcis.htm', apiAvailability: 'SFTP_BATCH', description: "California's Workers' Compensation Information System — EDI collection of comprehensive claim data from insurers' systems." },
  { name: 'State APCD submission system', kind: 'DATA_REPORTING', operator: 'STATE', website: null, apiAvailability: 'SFTP_BATCH', description: 'All-payer claims database reporting regimes — recurring health claims data extracts submitted to state-designated APCD platforms.' },
];

// ── Per-state assembly ────────────────────────────────────────────────────────
function deriveIntegrations(code: string, tax: ReturnType<typeof normalizeTaxonomy>, narrative: Narrative) {
  const text = `${narrative.integration}\n${narrative.statutes}`;
  const out: { system: string; usage: string; scope: string; notes: string | null }[] = [];
  const add = (system: string, usage: string, scope: string, notes: string | null = null) => out.push({ system, usage, scope, notes });

  if (tax.filingPortal === 'PROPRIETARY') {
    add('IRFS', 'REQUIRED', 'all product filings', 'Proprietary portal — Florida does not use SERFF for most filings.');
    add('SERFF', 'NOT_USED', 'rate & form filings', 'Outlier: product filings flow through the proprietary state portal instead.');
  } else {
    add('SERFF', 'REQUIRED', 'rate & form filings', null);
  }
  add('NIPR', 'REQUIRED', 'producer licensing & appointments', null);
  add('UCAA', 'REQUIRED', 'company licensing', null);
  add('MCAS / iSite+', 'REQUIRED', 'financial & market conduct data', null);
  if (/\bEFT\b/.test(text)) add('NAIC EFT', 'ACCEPTED', 'filing fee payments', null);
  if (/OPTins/i.test(text)) add('OPTins', 'ACCEPTED', 'premium tax / surplus lines tax', null);
  if (/SLIP\+/i.test(text)) add('SLIP+ for States', 'REQUIRED', 'surplus lines tax', 'Replacing OPTins for surplus lines transactions per state adoption.');
  if (tax.compactStatus === 'MEMBER') add('IIPRC Compact Portal', 'ACCEPTED', 'eligible life/annuity products', null);
  if (tax.sbs === 'YES') add('SBS', 'REQUIRED', 'licensing & regulatory workflows', null);
  else if (tax.sbs === 'TRANSITIONING' || tax.sbs === 'PARTIAL') add('SBS', 'TRANSITIONING', 'licensing & regulatory workflows', `Taxonomy: ${tax.sbs === 'PARTIAL' ? 'partial / evolving' : 'transitioning'}.`);
  if (tax.workersCompModel === 'EDI') add('IAIABC Workers’ Comp EDI', 'REQUIRED', "workers' comp FROI/SROI", null);
  else if (tax.workersCompModel === 'MIXED') add('IAIABC Workers’ Comp EDI', 'TRANSITIONING', "workers' comp FROI/SROI", `Taxonomy: ${tax.workersCompDetail}.`);
  else if (tax.workersCompModel === 'STATE_SPECIFIC') add('IAIABC Workers’ Comp EDI', 'NOT_USED', "workers' comp FROI/SROI", `State-specific / non-IAIABC standard (${tax.workersCompDetail}).`);
  else if (tax.workersCompModel === 'MONOPOLISTIC_FUND') add('IAIABC Workers’ Comp EDI', 'NOT_USED', "workers' comp FROI/SROI", 'Monopolistic state fund — private carriers have no WC claim-EDI obligations.');
  if (tax.autoVerification === 'YES') add('State auto insurance verification program', 'REQUIRED', 'auto policy verification', null);
  else if (tax.autoVerification === 'PARTIAL') add('State auto insurance verification program', 'TRANSITIONING', 'auto policy verification', `Taxonomy: ${tax.autoVerificationDetail}.`);
  if (code === 'CA') add('WCIS', 'REQUIRED', "workers' comp claim data", null);
  if (tax.apcd === 'YES') add('State APCD submission system', 'REQUIRED', 'health claims data (APCD)', null);
  else if (tax.apcd === 'EMERGING') add('State APCD submission system', 'TRANSITIONING', 'health claims data (APCD)', 'Taxonomy: emerging.');
  return out;
}

function deriveRequirements(code: string, name: string, tax: ReturnType<typeof normalizeTaxonomy>, narrative: Narrative) {
  const cite = narrative.statutoryAuthority;
  const text = `${narrative.integration}\n${narrative.statutes}`;
  const reqs: any[] = [];
  const add = (r: any) => reqs.push({ lineOfBusiness: 'ALL', obligationType: 'ONGOING', frequency: null, citation: cite, citationUrl: null, confidence: 'BASELINE', ...r });

  if (tax.filingPortal === 'PROPRIETARY') {
    add({ category: 'PRODUCT_FILING', obligationType: 'FILING_GATE', title: `Product filings must be submitted via the proprietary state portal (${tax.filingPortalDetail ?? 'state portal'})`, requirement: `${name} requires all rate, rule, and form filings through its proprietary filing system rather than SERFF. Insurer product/rate systems must produce the electronic filing components this portal requires.`, sourceNote: 'Cross-State Taxonomy Table + Integration & Electronic Systems narrative' });
  } else {
    add({ category: 'PRODUCT_FILING', obligationType: 'FILING_GATE', title: 'Rate, rule, and form filings via SERFF', requirement: `${name} accepts or requires NAIC SERFF for electronic submission of rate, rule, and form filings. Filing evidence (receipt id, status, submission date) must be preserved before product implementation.`, frequency: 'per filing', sourceNote: 'Cross-State Taxonomy Table + Integration & Electronic Systems narrative' });
  }
  if (tax.compactStatus === 'MEMBER') {
    add({ category: 'PRODUCT_FILING', obligationType: 'INFORMATIONAL', lineOfBusiness: 'LIFE_ANNUITY', title: 'Interstate Compact filing path available for eligible life/annuity products', requirement: `${name} is a member of the Interstate Insurance Product Regulation Compact (IIPRC): eligible life insurance, annuity, LTC, and disability products may be filed once through the Compact's SERFF portal covering all member states.`, sourceNote: 'Cross-State Taxonomy Table (Compact column)' });
  } else {
    add({ category: 'PRODUCT_FILING', obligationType: 'FILING_GATE', lineOfBusiness: 'LIFE_ANNUITY', title: 'Separate state filings required for Compact-eligible products (non-member)', requirement: `${name} is NOT a member of the Interstate Insurance Product Regulation Compact. Life, annuity, LTC, and disability products that would qualify for Compact filing elsewhere require separate direct filings in this state.`, sourceNote: 'Cross-State Taxonomy Table (Compact column)' });
  }
  add({ category: 'LICENSING', title: 'Producer licensing via NIPR; company licensing via UCAA', requirement: `Producer/agent licensing, renewals, and appointments in ${name} flow through the National Insurance Producer Registry (NIPR); insurer company licensing and corporate changes use the NAIC Uniform Certificate of Authority Application (UCAA).`, frequency: 'per license event / renewal cycle', sourceNote: 'National/shared systems narrative' });
  add({ category: 'FINANCIAL_REPORTING', title: 'Annual financial statements and MCAS via NAIC systems', requirement: `Insurers in ${name} submit annual financial statements and Market Conduct Annual Statement (MCAS) data through NAIC's centralized repositories (iSite+), which distribute the information to the state regulator.`, frequency: 'annual', sourceNote: 'National/shared systems narrative' });
  if (tax.autoVerification !== 'NO') {
    add({ category: 'AUTO_VERIFICATION', lineOfBusiness: 'AUTO', title: tax.autoVerification === 'YES' ? 'Electronic auto insurance verification reporting' : `Auto insurance verification — ${tax.autoVerificationDetail}`, requirement: `${name} ${tax.autoVerification === 'YES' ? 'requires ongoing electronic insurer participation in its motor vehicle insurance verification program: policy admin systems must provide recurring policy data feeds or respond to state/DMV verification queries.' : `has a partial/evolving auto-verification posture ("${tax.autoVerificationDetail}"). State-specific review is required before automating decisions on this obligation.`}`, frequency: tax.autoVerification === 'YES' ? 'continuous / per state schedule' : null, confidence: tax.autoVerification === 'YES' ? 'BASELINE' : 'DERIVED', sourceNote: 'Cross-State Taxonomy Table (Auto verification column)' });
  }
  if (tax.workersCompModel === 'MONOPOLISTIC_FUND') {
    add({ category: 'WORKERS_COMP_REPORTING', obligationType: 'INFORMATIONAL', lineOfBusiness: 'WORKERS_COMP', title: "Monopolistic workers' comp fund — no private-carrier EDI obligations", requirement: `${name} is a monopolistic workers' compensation state: coverage is written only by the state fund, so private carriers have no FROI/SROI claim-EDI filing obligations here.`, sourceNote: 'Cross-State Taxonomy Table (Workers’ comp column)' });
  } else {
    add({ category: 'WORKERS_COMP_REPORTING', lineOfBusiness: 'WORKERS_COMP', title: tax.workersCompModel === 'EDI' ? "Workers' comp FROI/SROI reporting via IAIABC EDI" : `Workers' comp reporting — ${tax.workersCompDetail}`, requirement: tax.workersCompModel === 'EDI' ? `${name}'s workers' compensation regulator requires electronic First/Subsequent Reports of Injury (FROI/SROI) using IAIABC EDI standards — trading-partner registration plus transmission and acknowledgment evidence.` : `${name} uses a ${tax.workersCompDetail} approach to workers' compensation claim reporting. State-specific review of the exact reporting channel and format is required ("${tax.workersCompDetail}").`, frequency: 'per claim event', confidence: tax.workersCompModel === 'EDI' ? 'BASELINE' : 'DERIVED', sourceNote: 'Cross-State Taxonomy Table (Workers’ comp column)' });
  }
  if (tax.apcd !== 'NO') {
    add({ category: 'APCD_REPORTING', lineOfBusiness: 'HEALTH', title: tax.apcd === 'YES' ? 'All-payer claims database (APCD) reporting' : 'APCD reporting regime emerging', requirement: tax.apcd === 'YES' ? `${name} operates a material all-payer claims database: health insurers must submit recurring claims data extracts per the state's APCD submission guide.` : `${name}'s APCD reporting regime is emerging; monitor for finalized health-claims submission obligations.`, frequency: tax.apcd === 'YES' ? 'per APCD schedule (typically monthly/quarterly)' : null, confidence: tax.apcd === 'YES' ? 'BASELINE' : 'DERIVED', sourceNote: 'Cross-State Taxonomy Table (APCD column)' });
  }
  if (/OPTins/i.test(text) || /premium tax/i.test(text)) {
    add({ category: 'PREMIUM_TAX', title: /SLIP\+/i.test(text) ? 'Premium tax via OPTins; surplus lines via SLIP+' : 'Premium tax payments via OPTins', requirement: /SLIP\+/i.test(text) ? `${name} uses NAIC's OPTins for premium tax payments and has adopted SLIP+ for surplus lines data and tax reporting (replacing OPTins for those transactions).` : `${name} accepts or requires electronic premium tax payments (and in some cases surplus lines tax filings) via NAIC's OPTins system.`, frequency: 'annual / quarterly per tax calendar', sourceNote: 'Integration & Electronic Systems narrative' });
  }
  if (/surplus lines/i.test(text) && /SLIP\+|stamping|SLAS|surplus lines.{0,40}(portal|system|filing)/i.test(text)) {
    add({ category: 'SURPLUS_LINES', lineOfBusiness: 'SURPLUS_LINES', title: 'Surplus lines tax/data filings via the state-designated platform', requirement: `${name} requires surplus lines tax and transaction data through its designated electronic platform (see integration narrative for the current system).`, confidence: 'DERIVED', sourceNote: 'Integration & Electronic Systems narrative' });
  }
  return reqs;
}

function deriveBulletins(narrative: Narrative) {
  const text = `${narrative.statutes}\n${narrative.integration}`;
  const seen = new Set<string>();
  const out: { reference: string; title: string; summary: string | null; url: string | null }[] = [];
  const re = /\b(?:Bulletin|Directive|Circular Letter)s?\s+(?:No\.\s*)?((?:[A-Z]{1,3}[- ]?)?\d{2,4}-\d{1,3})\b/g;
  for (const m of text.matchAll(re)) {
    const kind = m[0].match(/^(Bulletin|Directive|Circular Letter)/)![1];
    const refNum = m[1].replace(/\s+/g, '');
    const reference = `${kind} ${refNum}`;
    if (seen.has(reference)) continue;
    seen.add(reference);
    // Context window around the mention as the summary snippet.
    const idx = m.index ?? 0;
    let summary = text.slice(Math.max(0, idx - 100), idx + m[0].length + 220)
      .replace(/\s+/g, ' ').replace(/\*\*/g, '').replace(/\[\\?\[[^\]]*\]\([^)]*\)/g, '').trim();
    summary = `…${summary.replace(/^\S*\s/, '').replace(/\s\S*$/, '')}…`;
    // A PDF link whose URL contains the bulletin digits.
    const digits = refNum.replace(/[^0-9-]/g, '');
    const urlM = text.match(new RegExp(`https?://[^\\s)\\]"']*${digits.replace('-', '[%\\s-]*0*')}[^\\s)\\]"']*`));
    out.push({ reference, title: reference, summary: summary || null, url: urlM ? urlM[0] : null });
  }
  // Bulletins that only appear as PDF links (e.g. AL Bulletin 2025-06 shows as
  // a "[7]" footnote in prose but the URL names it).
  for (const m of text.matchAll(/https?:\/\/[^\s)\]"']*Bulletin%20(\d{4}-\d{2,3})[^\s)\]"']*/gi)) {
    const reference = `Bulletin ${m[1]}`;
    if (seen.has(reference)) continue;
    seen.add(reference);
    out.push({ reference, title: reference, summary: null, url: m[0] });
  }
  return out;
}

function deriveSources(code: string, name: string, narrative: Narrative) {
  const tier = PRIORITY.has(code) ? 'PRIORITY_DAILY' : 'WEEKLY';
  const out: any[] = [];
  const urls = new Set<string>();
  const push = (s: any) => { if (s.url && !urls.has(s.url)) { urls.add(s.url); out.push(s); } };
  if (narrative.regulatorWebsite) push({ name: `${narrative.regulatorName || name} — official site`, url: narrative.regulatorWebsite, sourceType: 'OTHER', authority: 'OFFICIAL_REGULATOR', monitor: false, checkTier: tier });
  for (const m of narrative.statutes.matchAll(/https?:\/\/[^\s)\]>"']+/g)) {
    const url = m[0].replace(/[).,;\\]+$/, '');
    if (/ulletin/i.test(url)) push({ name: `${name} bulletins page`, url, sourceType: 'BULLETINS_PAGE', authority: 'OFFICIAL_REGULATOR', monitor: true, checkTier: tier });
    else if (/egulation/i.test(url)) push({ name: `${name} regulations page`, url, sourceType: 'REGULATIONS_PAGE', authority: 'OFFICIAL_REGULATOR', monitor: true, checkTier: tier });
    else if (/code|statut/i.test(url)) push({ name: `${name} statutes page`, url, sourceType: 'STATUTES_PAGE', authority: 'OFFICIAL_REGULATOR', monitor: true, checkTier: tier });
  }
  push({ name: `SERFF participation — ${name}`, url: `https://www.serff.com/serff_participation_${name.toLowerCase().replace(/ /g, '_')}.htm`, sourceType: 'SERFF_PARTICIPATION', authority: 'NAIC', monitor: true, checkTier: tier });
  return out;
}

// ── Assemble ──────────────────────────────────────────────────────────────────
const jurisdictions: any[] = [];
for (const [code, name] of STATES) {
  const narrative = narrativeByState.get(code)!;
  const taxRaw = taxonomy.get(code)!;
  const tax = normalizeTaxonomy(taxRaw);
  const profile = profileByState.get(code);
  const parsed = parsedRules.get(code);

  const sectionsOf = (re: RegExp) => profile && Object.entries(profile).find(([k]) => re.test(k))?.[1];
  const executiveSummary = sectionsOf(/executive summary/i) ?? null;
  const operatingModel = sectionsOf(/operating model|operationally/i) ?? null;

  const ruleSet = parsed ?? templateRules(code, name, narrative.regulatorName || `${name} insurance regulator`, tax);
  const origin = parsed ? 'DOCUMENT' : 'TEMPLATE_DERIVED';
  const rules = (ruleSet?.rules ?? []).map((r: any) => ({
    ruleCode: String(r.id ?? '').trim(),
    category: String(r.category ?? 'other'),
    description: r.description ?? null,
    ruleJson: { if: r.if ?? null, then: r.then ?? null },
    origin,
  })).filter((r: any) => r.ruleCode);
  const signalsJson = ruleSet ? {
    signals: ruleSet.signals ?? null,
    principles: ruleSet.principles ?? null,
    defaultActions: ruleSet.default_actions ?? null,
    humanReviewTriggers: ruleSet.human_review_triggers ?? null,
    metadata: ruleSet.metadata ?? null,
    origin,
  } : null;

  jurisdictions.push({
    code, name,
    regulatorName: narrative.regulatorName || `${name} insurance regulator`,
    regulatorWebsite: narrative.regulatorWebsite,
    regulatorType: 'STATE_INSURANCE_REGULATOR',
    ...tax,
    statutoryAuthority: narrative.statutoryAuthority,
    summaryRegulator: narrative.regulator || null,
    summaryStatutes: narrative.statutes || null,
    summaryIntegration: narrative.integration || null,
    executiveSummary, operatingModel, signalsJson,
    priorityTier: PRIORITY.has(code) ? 'PRIORITY' : 'STANDARD',
    profileDepth: FULL_PROFILE.has(code) ? 'FULL_PROFILE' : 'NARRATIVE',
    requirements: deriveRequirements(code, name, tax, narrative),
    integrations: deriveIntegrations(code, tax, narrative),
    bulletins: deriveBulletins(narrative),
    rules,
    sources: deriveSources(code, name, narrative),
  });
}

const nationalSources = [
  { name: 'NAIC State Insurance Department Directory', url: 'https://content.naic.org/state-insurance-departments', sourceType: 'NAIC_DIRECTORY', authority: 'NAIC', monitor: true, checkTier: 'WEEKLY' },
  { name: 'IIPRC (Insurance Compact) industry resources / member list', url: 'https://www.insurancecompact.org/industry-resources', sourceType: 'COMPACT_MEMBERSHIP', authority: 'COMPACT', monitor: true, checkTier: 'WEEKLY' },
  { name: 'SERFF home', url: 'https://www.serff.com/', sourceType: 'OTHER', authority: 'NAIC', monitor: false, checkTier: 'WEEKLY' },
];

const out = {
  meta: {
    generatedFrom: 'docs/regulations/50-state-regulations-baseline.md',
    generatedBy: 'backend/scripts/extract-regulations-baseline.ts',
    generatedAt: new Date().toISOString(),
    counts: {
      jurisdictions: jurisdictions.length,
      fullProfiles: jurisdictions.filter((j) => j.profileDepth === 'FULL_PROFILE').length,
      documentRuleSets: [...parsedRules.keys()].sort(),
      requirements: jurisdictions.reduce((n, j) => n + j.requirements.length, 0),
      integrations: jurisdictions.reduce((n, j) => n + j.integrations.length, 0),
      bulletins: jurisdictions.reduce((n, j) => n + j.bulletins.length, 0),
      rules: jurisdictions.reduce((n, j) => n + j.rules.length, 0),
      sources: jurisdictions.reduce((n, j) => n + j.sources.length, 0) + nationalSources.length,
      integrationSystems: integrationSystems.length,
    },
    knownGaps,
  },
  integrationSystems,
  nationalSources,
  jurisdictions,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`Wrote ${OUT}`);
console.log(JSON.stringify(out.meta, null, 2));

// Spot-check assertions from the design doc (§4.9) — fail loudly on drift.
function assert(cond: boolean, msg: string) { if (!cond) { console.error(`ASSERTION FAILED: ${msg}`); process.exitCode = 1; } }
const byCode = new Map(jurisdictions.map((j) => [j.code, j]));
assert(jurisdictions.length === 51, '51 jurisdictions');
assert(byCode.get('FL')!.filingPortal === 'PROPRIETARY', 'FL filingPortal PROPRIETARY');
for (const c of ['CA', 'NY', 'FL']) assert(byCode.get(c)!.compactStatus === 'NON_MEMBER', `${c} NON_MEMBER`);
assert(byCode.get('TX')!.compactStatus === 'NON_MEMBER', 'TX NON_MEMBER');
for (const c of ['ND', 'OH', 'WA', 'WY']) assert(byCode.get(c)!.workersCompModel === 'MONOPOLISTIC_FUND', `${c} MONOPOLISTIC_FUND`);
assert(byCode.get('GA')!.rules.some((r: any) => r.ruleCode === 'GA-FILING-001'), 'GA-FILING-001 present');
assert(jurisdictions.filter((j) => j.profileDepth === 'FULL_PROFILE').length === 12, '12 FULL_PROFILE');
