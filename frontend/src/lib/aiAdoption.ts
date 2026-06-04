// aiAdoption.ts — the "Active AI" model, in plain language.
//
// Authored, illustrative content — NOT a database table. It describes HOW AI is
// applied across the company along two axes:
//   1. The autonomy spectrum (MODES): AI assistant → fully autonomous agent.
//      These are business-neutral — most value streams are run by underwriters,
//      claims handlers, actuaries, compliance etc. who do not write code.
//   2. The SDLC, augmented phase-by-phase (SDLC_FLOW) — the software-delivery view.
//
// The heat map crosses the real value streams (fetched from the API) with the
// MODES. Each value stream's adoption level + concrete use cases are authored
// per stream in STREAM_PROFILES, grounded in that stream's real L3 work areas.
// Role utilization and efficiency are then derived consistently from the level
// and the stream's real role count. Swap these for a live feed when adoption
// telemetry exists.

// ── Autonomy spectrum — the heat-map columns ────────────────────────────────
export type AiMode = {
  key: 'assistant' | 'augmented' | 'workflow' | 'agent';
  label: string;
  short: string;
  desc: string;
};

export const MODES: AiMode[] = [
  {
    key: 'assistant',
    label: 'AI Assistant',
    short: 'Assist',
    desc: 'In-the-moment help — people ask AI to draft, summarise, look up and explain as they work.',
  },
  {
    key: 'augmented',
    label: 'AI Augmented',
    short: 'Augment',
    desc: 'AI drafts whole work products (letters, assessments, reports); the person reviews and approves.',
  },
  {
    key: 'workflow',
    label: 'Workflow Agent',
    short: 'Workflow',
    desc: 'A scoped agent runs a defined multi-step task end-to-end, pausing at a human gate.',
  },
  {
    key: 'agent',
    label: 'Autonomous Agent',
    short: 'Autonomous',
    desc: 'A multi-step agent handles a whole sub-process within authority; people approve the outcomes.',
  },
];

export const MODE_INDEX: Record<AiMode['key'], number> = { assistant: 0, augmented: 1, workflow: 2, agent: 3 };

// ── Adoption level = the traffic light ──────────────────────────────────────
// The level itself is the RAG signal: red (early/behind) → green (embedded/ahead).
// Index 0–4 maps directly to a colour, so leaders and laggards read at a glance
// without any separate maturity indicator.
export type HeatStop = { name: string; short: string; bg: string; fg: string };

export const HEAT: HeatStop[] = [
  { name: 'Not used',  short: '—',        bg: '#f5f5f5', fg: '#a3a3a3' }, // grey
  { name: 'Piloting',  short: 'Pilot',    bg: '#fee2e2', fg: '#b91c1c' }, // red
  { name: 'Emerging',  short: 'Emerging', bg: '#fef3c7', fg: '#b45309' }, // amber
  { name: 'Scaling',   short: 'Scaling',  bg: '#bbf7d0', fg: '#15803d' }, // light green
  { name: 'Embedded',  short: 'Embedded', bg: '#16a34a', fg: '#ffffff' }, // green
];

// ── SDLC, augmented — the agent flow band (software-delivery view) ───────────
export type SdlcPhase = {
  phase: string;
  agent: string;
  personas: string[];
  sor: string;
  mode: AiMode['key'];
};

export const SDLC_FLOW: SdlcPhase[] = [
  { phase: 'Planning',     agent: 'Scope & Estimation Agent', personas: ['Product Owner', 'Business Analyst'], sor: 'PowerPoint · Excel · Word', mode: 'assistant' },
  { phase: 'Requirements', agent: 'Requirements Agents',      personas: ['Product Owner', 'Business Analyst'], sor: 'Office · Rally',           mode: 'augmented' },
  { phase: 'Design',       agent: 'Design Agents',            personas: ['Architect', 'UX Designer'],          sor: 'Office · Rally · Figma',   mode: 'augmented' },
  { phase: 'Development',  agent: 'Coding Agents',            personas: ['Developers', 'Engineers'],           sor: 'GitHub · VS · Rally',      mode: 'agent' },
  { phase: 'Testing',      agent: 'Testing Agents',           personas: ['QA Engineer', 'Test Lead'],          sor: 'GitHub · Rally',           mode: 'workflow' },
  { phase: 'Deployment',   agent: 'Deployment Agents',        personas: ['DevOps Engineer', 'Release Manager'], sor: 'GitHub · Rally',          mode: 'workflow' },
  { phase: 'Maintenance',  agent: 'Remediation Agents',       personas: ['SRE', 'PROD Support'],               sor: 'ServiceNow',               mode: 'agent' },
];

export const KNOWLEDGE_AGENT = {
  agent: 'Knowledge Agents',
  blurb: 'Capture, standardize and reuse SDLC outputs across every phase — keeping documentation always-current and maintaining end-to-end data fidelity.',
};

// ── Per-value-stream adoption + real use cases ──────────────────────────────
export type UseCase = { title: string; persona: string; detail: string };
export type ModeProfile = { level: number; useCases: UseCase[] };
export type StreamProfile = Record<AiMode['key'], ModeProfile>;

const uc = (title: string, persona: string, detail: string): UseCase => ({ title, persona, detail });
const m = (level: number, ...useCases: UseCase[]): ModeProfile => ({ level, useCases });

// Keyed by exact value-stream name. Use cases are grounded in each stream's real
// L3 process areas and written for the people who actually do the work.
export const STREAM_PROFILES: Record<string, StreamProfile> = {
  // ── Core Insurance ───────────────────────────────────────────────────────
  'Delegated Authority Management': {
    assistant: m(4,
      uc('Coverholder query desk', 'DA Managers · Underwriters', 'Answer binder, authority-limit and class-of-business questions straight from the coverholder agreements in plain language.'),
      uc('Bordereaux query drafting', 'DA Analysts', 'Draft follow-ups to coverholders chasing missing or malformed bordereaux fields.')),
    augmented: m(3,
      uc('Binder & onboarding drafting', 'Underwriting Governance', 'AI drafts binding-authority schedules and due-diligence packs from the submission for an underwriter to approve.')),
    workflow: m(3,
      uc('Bordereaux validation', 'Operational Oversight', 'A scoped agent ingests premium/claims bordereaux, validates them against the binder rules and flags breaches at a human gate.'),
      uc('Coverholder onboarding checks', 'Partner Onboarding', 'Agent runs sanctions, licensing and financial-standing checks and assembles the onboarding file.')),
    agent: m(2,
      uc('Continuous authority-breach monitoring', 'Audit & Remediation', 'Agent monitors written business against authority limits and auto-raises remediation cases for breaches.')),
  },
  'Claims Intake-to-Settlement': {
    assistant: m(4,
      uc('FNOL summarisation', 'Claims Intake Handlers', 'Summarise first-notice-of-loss calls and documents into a structured claim record with missing-info flags.'),
      uc('Policy coverage Q&A', 'Claims Adjusters', 'Ask coverage questions against the policy wording and endorsements in plain language.')),
    augmented: m(3,
      uc('Reserve & decision drafting', 'Claims Adjusters', 'AI drafts the reserve rationale and settlement letter from the investigation file for the adjuster to approve.')),
    workflow: m(3,
      uc('Coverage & assignment triage', 'Coverage & Assignment', 'Agent validates coverage, sets segment/severity and routes the claim to the right adjuster team.')),
    agent: m(2,
      uc('Straight-through simple claims', 'Resolution & Recovery', 'Agent adjudicates and settles low-value, low-complexity claims within authority, escalating exceptions.')),
  },
  'Policy Administration & Servicing': {
    assistant: m(4,
      uc('Endorsement drafting', 'Policy Servicing', 'Draft endorsement wording and customer confirmations from the change request.'),
      uc('Policy wording lookup', 'Service Agents', 'Plain-language search across policy schedules, endorsements and servicing procedures.')),
    augmented: m(3,
      uc('Mid-term change packs', 'Policy Change Processing', 'AI assembles and drafts the documentation for mid-term adjustments and renewals for checker approval.')),
    workflow: m(2,
      uc('Routine change processing', 'Policy Change Processing', 'Agent applies standard endorsements to the policy admin system and queues non-standard ones for review.')),
    agent: m(1,
      uc('Auto-issue clean renewals', 'Policy Lifecycle', 'Pilot agent prepares and issues in-rule renewals, routing referrals to underwriters.')),
  },
  'Submission-to-Bind / Underwriting': {
    assistant: m(4,
      uc('Submission triage assistant', 'Underwriters', 'Extract and summarise risk data from broker submissions and flag appetite mismatches.'),
      uc('Guidance & appetite Q&A', 'Underwriting Assistants', 'Ask underwriting-guideline and appetite questions in plain language.')),
    augmented: m(3,
      uc('Quote & terms drafting', 'Underwriters', 'AI drafts quotes, subjectivities and terms from the risk assessment for underwriter approval.'),
      uc('Risk write-up drafting', 'Underwriters', 'Draft the risk narrative and referral rationale from exposure and loss data.')),
    workflow: m(2,
      uc('Clearance & data enrichment', 'Submission Intake', 'Agent clears submissions, enriches with external risk data and assembles the underwriting file.')),
    agent: m(1,
      uc('Auto-quote in-appetite SME', 'Bind & Handover', 'Pilot agent quotes and binds in-appetite SME risks within authority, referring the rest.')),
  },
  'Reinsurance & Retrocession Management': {
    assistant: m(3,
      uc('Treaty wording Q&A', 'Reinsurance Analysts', 'Ask questions against treaty and slip wordings; surface inuring clauses and exclusions.'),
      uc('Placement summarisation', 'Cession Analysts', 'Summarise broker placement submissions and exposure data.')),
    augmented: m(2,
      uc('Ceded reporting drafting', 'Ceded Administration', 'AI drafts ceded statements and recovery narratives from the treaty terms for review.')),
    workflow: m(2,
      uc('Recovery calculation', 'Recoveries & Reporting', 'Agent computes ceded recoveries on large losses and prepares reinsurer billing for sign-off.')),
    agent: m(0),
  },
  'Billing, Collections & Receivables': {
    assistant: m(3,
      uc('Dunning & dispute drafting', 'Collections Analysts', 'Draft payment-reminder and dispute-response messages from the account history, ready to send.'),
      uc('Account lookups', 'Billing Specialists', 'Natural-language lookups across invoices, installment plans and tax/fee rules instead of report pulls.')),
    augmented: m(2,
      uc('Reconciliation commentary', 'Receivables Manager', 'AI drafts the month-end reconciliation narrative and exception summary for finance review.')),
    workflow: m(3,
      uc('Cash application', 'Billing Operations', 'A scoped agent matches incoming payments to receivables and routes unmatched items to a human queue.'),
      uc('Aged-debt prioritisation', 'Collections Management', 'Agent ranks overdue accounts by recovery likelihood and proposes the next collections action.')),
    agent: m(1,
      uc('Reconciliation auto-close', 'Reconciliation & Close', 'Pilot agent clears low-value reconciling items and prepares the close pack for sign-off.')),
  },
  'Claims Recoveries & Subrogation': {
    assistant: m(3,
      uc('File review assistant', 'Recovery Specialists', 'Surface subrogation potential and liability indicators from the claim file.'),
      uc('Demand-letter drafting', 'Recovery Specialists', 'Draft subrogation demand and negotiation letters from the file.')),
    augmented: m(2,
      uc('Liability-analysis drafting', 'Liability & Transfer Analysis', 'AI drafts liability and recovery-prospects assessments for review.')),
    workflow: m(2,
      uc('Recovery identification', 'Recovery Identification', 'Agent scans closed claims for missed recovery opportunities and builds the case file.')),
    agent: m(0),
  },

  // ── Finance & Actuarial ──────────────────────────────────────────────────
  'Finance, Treasury & Capital Management': {
    assistant: m(3,
      uc('Variance commentary drafting', 'Finance Analysts', 'Draft month-end variance commentary from the ledger movements.'),
      uc('Accounting-policy Q&A', 'Financial Controllers', 'Ask technical accounting and tax questions against policy and standards.')),
    augmented: m(3,
      uc('Forecast & MD&A drafting', 'Planning & Forecasting', 'AI drafts forecast narratives and management commentary from the numbers for review.')),
    workflow: m(2,
      uc('Close reconciliations', 'Record to Report', 'Agent runs intercompany and balance-sheet reconciliations and routes breaks to a human gate.')),
    agent: m(1,
      uc('Continuous controls testing', 'Capital, Tax & Regulatory', 'Pilot agent tests financial controls continuously and drafts exceptions for sign-off.')),
  },
  'Investment & Asset Management': {
    assistant: m(3,
      uc('Research summarisation', 'Investment Analysts', 'Summarise broker research, filings and economic data into investment briefs.'),
      uc('Mandate & guideline Q&A', 'Portfolio Managers', 'Ask mandate and IMA-compliance questions in plain language.')),
    augmented: m(2,
      uc('Performance commentary drafting', 'Performance & Risk Reporting', 'AI drafts portfolio performance and attribution commentary for review.')),
    workflow: m(1,
      uc('Guideline-breach monitoring', 'ALM & Liquidity Coordination', 'Agent monitors holdings against mandate limits and flags pre- and post-trade breaches.')),
    agent: m(0),
  },
  'Actuarial Pricing, Reserving & Capital Modeling': {
    assistant: m(3,
      uc('Methodology & model Q&A', 'Actuaries', 'Ask questions across model documentation, assumptions and prior analyses.'),
      uc('Reserving commentary drafting', 'Reserving Actuaries', 'Draft reserving-movement commentary from triangle outputs.')),
    augmented: m(3,
      uc('Assumption & report drafting', 'Pricing Analytics', 'AI drafts pricing assumption rationales and capital report sections for actuarial review.')),
    workflow: m(2,
      uc('Experience-data validation', 'Reserving', 'Agent prepares and validates experience data and flags anomalies before modeling.')),
    agent: m(1,
      uc('Capital model-run orchestration', 'Capital Modeling', 'Pilot agent runs capital model scenarios and assembles results for actuarial sign-off.')),
  },

  // ── Risk, Compliance & Audit ─────────────────────────────────────────────
  'Risk, Compliance & Regulatory Management': {
    assistant: m(3,
      uc('Regulatory-text Q&A', 'Compliance Officers', 'Ask questions across regulations and obligations; surface the applicable rules.'),
      uc('Horizon-scanning summaries', 'Compliance Analysts', 'Summarise regulatory updates and assess applicability to the business.')),
    augmented: m(3,
      uc('Policy & filing drafting', 'Regulatory Response', 'AI drafts policies, attestations and first-draft regulatory filings for review.')),
    workflow: m(2,
      uc('Control monitoring', 'Control Monitoring', 'Agent runs continuous control checks and raises issues with evidence at a human gate.')),
    agent: m(1,
      uc('Transaction surveillance', 'Incident & Regulatory Response', 'Pilot agent screens transactions for AML/sanctions risk and assembles SAR packs for review.')),
  },
  'Audit & Assurance': {
    assistant: m(3,
      uc('Workpaper & evidence Q&A', 'Internal Auditors', 'Ask questions across prior workpapers, policies and standards.'),
      uc('Finding write-up drafting', 'Auditors', 'Draft audit findings and risk ratings from the evidence.')),
    augmented: m(3,
      uc('Audit report drafting', 'Audit Reporting', 'AI drafts the audit report and executive summary from fieldwork results for review.')),
    workflow: m(2,
      uc('Full-population control testing', 'Fieldwork & Testing', 'Agent tests controls over entire populations and flags exceptions for auditor judgement.')),
    agent: m(1,
      uc('Continuous assurance', 'Issue Follow-up', 'Pilot agent re-tests remediated issues continuously and updates their status.')),
  },
  'Third-Party & Vendor Management': {
    assistant: m(3,
      uc('RFP & SoW drafting', 'Procurement', 'Draft RFPs, scoring criteria and statements of work.'),
      uc('Contract obligation lookup', 'Vendor Managers', 'Ask questions across vendor contracts; surface SLAs, renewals and exit terms.')),
    augmented: m(2,
      uc('Due-diligence packs', 'Due Diligence & Contracting', 'AI assembles and drafts vendor due-diligence and risk assessments for review.')),
    workflow: m(2,
      uc('Vendor risk monitoring', 'Risk & Exit Management', 'Agent screens vendors for financial, sanctions and adverse-news risk and raises cases on triggers.')),
    agent: m(0),
  },

  // ── Corporate & Enterprise ───────────────────────────────────────────────
  'Legal, Governance & Privacy Management': {
    assistant: m(3,
      uc('Contract & clause Q&A', 'Legal Counsel', 'Ask questions across contracts and precedent; surface obligations and risky clauses.'),
      uc('Privacy guidance lookup', 'Privacy Officers', 'Plain-language answers on data-handling rules from internal policy.')),
    augmented: m(3,
      uc('Contract & response drafting', 'Commercial Legal', 'AI drafts NDAs, contract markups and first-draft regulatory responses for counsel review.')),
    workflow: m(2,
      uc('Contract review triage', 'Commercial Legal Support', 'Agent reviews inbound contracts against the clause playbook and flags deviations for a lawyer.')),
    agent: m(0),
  },
  'Talent & Workforce Management': {
    assistant: m(3,
      uc('JD & interview drafting', 'Talent Acquisition', 'Draft job descriptions, screening questions and interview scorecards.'),
      uc('HR policy query desk', 'HR Business Partners', 'Answer employee policy and benefits questions from the HR knowledge base.')),
    augmented: m(2,
      uc('Candidate shortlisting', 'Talent Acquisition', 'AI screens applications against the role profile and drafts a ranked shortlist for review.'),
      uc('Workforce-plan drafting', 'Workforce Planning', 'Draft capacity and skills-gap analyses from headcount and demand data.')),
    workflow: m(1,
      uc('Onboarding orchestration', 'Capability Development', 'Agent assembles onboarding and learning plans and tracks completion.')),
    agent: m(0),
  },
  'Enterprise Strategy & Portfolio Management': {
    assistant: m(3,
      uc('Board-pack drafting', 'Strategy Team', 'Draft strategy narratives and board-pack sections from inputs and prior decks.'),
      uc('Market & competitor research', 'Strategy Analysts', 'Summarise market, competitor and analyst sources into briefing notes.')),
    augmented: m(2,
      uc('Business-case drafting', 'Portfolio Office', 'AI drafts and scores business cases against the prioritisation framework.')),
    workflow: m(1,
      uc('Portfolio reporting', 'Performance Governance', 'Agent consolidates initiative status and flags delivery and benefit risks.')),
    agent: m(0),
  },
  'Change Management & Adoption': {
    assistant: m(3,
      uc('Comms & collateral drafting', 'Change Managers', 'Draft stakeholder comms, FAQs and training collateral tailored to each impacted group.'),
      uc('Feedback summarisation', 'Change Analysts', 'Summarise survey and workshop feedback into themes and sentiment.')),
    augmented: m(2,
      uc('Impact & readiness assessments', 'Impact Assessment', 'AI drafts change-impact and readiness assessments from the project scope for review.')),
    workflow: m(1,
      uc('Adoption tracking', 'Adoption Sustainment', 'Agent compiles adoption metrics and flags groups lagging on the change curve.')),
    agent: m(0),
  },

  // ── Distribution & Customer ──────────────────────────────────────────────
  'Customer Service, Complaints & Experience': {
    assistant: m(4,
      uc('Agent-assist responses', 'Service Agents', 'Suggest next-best responses and surface account context live during interactions.'),
      uc('Call & case summarisation', 'Service Agents', 'Auto-summarise calls and cases with disposition and follow-ups.')),
    augmented: m(3,
      uc('Complaint-response drafting', 'Complaint Handlers', 'AI drafts regulator-compliant complaint responses from the case file for review.')),
    workflow: m(3,
      uc('Interaction triage & routing', 'Interaction Intake', 'Agent classifies and routes inbound contacts and proposes resolutions for simple cases.')),
    agent: m(2,
      uc('Self-service resolution', 'Case Resolution', 'Agent resolves routine service requests end-to-end through the assistant, escalating exceptions.')),
  },
  'Marketing, Growth & Customer Insights': {
    assistant: m(4,
      uc('Content & copy generation', 'Marketing Team', 'Generate campaign copy, social posts and landing-page variants on brand.'),
      uc('Insight summarisation', 'Insight Analysts', 'Summarise market and customer research into briefs.')),
    augmented: m(3,
      uc('Campaign-plan drafting', 'Campaign Planning', 'AI drafts segmentation, messaging and channel plans for review.')),
    workflow: m(2,
      uc('Campaign execution & A/B', 'Campaign Execution', 'Agent assembles, schedules and A/B-tests campaign variants at a human approval gate.')),
    agent: m(1,
      uc('Always-on spend optimisation', 'Performance Insights', 'Pilot agent reallocates spend across channels against targets, within human guardrails.')),
  },
  'Distribution & Channel Management': {
    assistant: m(3,
      uc('Broker comms drafting', 'Distribution Managers', 'Draft broker and partner communications and enablement materials.'),
      uc('Producer performance Q&A', 'Distribution Analysts', 'Ask questions on producer production, hit-rate and mix.')),
    augmented: m(2,
      uc('Appointment & pipeline packs', 'Pipeline Development', 'AI drafts partner appointment packs and pipeline reviews.')),
    workflow: m(1,
      uc('Producer compliance monitoring', 'Partner Governance', 'Agent monitors licensing and appointment status and flags lapses.')),
    agent: m(0),
  },
  'Product & Proposition Management': {
    assistant: m(3,
      uc('Concept & PRD drafting', 'Product Managers', 'Draft proposition concepts, PRDs and value propositions from opportunity inputs.'),
      uc('Competitor scan', 'Product Analysts', 'Summarise competitor products and customer needs.')),
    augmented: m(2,
      uc('Business-case & pricing drafts', 'Proposition Design', 'AI drafts proposition business cases and pricing scenarios for review.')),
    workflow: m(1,
      uc('Launch-feedback synthesis', 'Launch Feedback', 'Agent consolidates post-launch feedback and performance into actions.')),
    agent: m(0),
  },

  // ── Technology & Data (these teams do build software) ────────────────────
  'Technology Delivery & Change': {
    assistant: m(4,
      uc('Code & test assist', 'Engineers', 'Inline code completion, refactoring and unit-test generation in the IDE.'),
      uc('Story & spec Q&A', 'Business Analysts', 'Ask questions across the backlog, specs and acceptance criteria.')),
    augmented: m(4,
      uc('Story-to-spec drafting', 'Business Analysts', 'AI drafts user stories, acceptance criteria and test cases from intake for review.')),
    workflow: m(3,
      uc('CI/CD & regression', 'QA · Release', 'Agent runs regression suites, triages failures and prepares release notes at a human gate.')),
    agent: m(2,
      uc('Story-to-PR delivery', 'Engineers', 'Agent implements well-scoped stories end-to-end and raises human-approved pull requests.')),
  },
  'Technology Strategy, Architecture & Delivery': {
    assistant: m(3,
      uc('Architecture & standards Q&A', 'Architects', 'Ask questions across reference architectures, standards and ADRs.'),
      uc('Roadmap-narrative drafting', 'Tech Strategy', 'Draft roadmap narratives and options papers.')),
    augmented: m(3,
      uc('Design & ADR drafting', 'Architecture Design', 'AI drafts solution designs and architecture decision records for review.')),
    workflow: m(2,
      uc('Architecture-compliance checks', 'Platform Governance', 'Agent checks designs and changes against standards and flags deviations.')),
    agent: m(1,
      uc('Delivery-assurance monitoring', 'Delivery Assurance', 'Pilot agent monitors delivery health and surfaces architecture and delivery risks.')),
  },
  'Data, Analytics & AI Management': {
    assistant: m(4,
      uc('SQL & pipeline assist', 'Data Engineers', 'Generate SQL, transformations and pipeline code from natural language.'),
      uc('Data-catalog Q&A', 'Analysts', 'Ask questions across the data catalog, lineage and definitions.')),
    augmented: m(3,
      uc('Insight & report drafting', 'Analytics & AI Delivery', 'AI drafts analysis narratives and dashboard commentary for review.')),
    workflow: m(3,
      uc('Data-quality monitoring', 'Governance & Quality', 'Agent profiles data, runs quality rules and opens remediation tickets at a human gate.')),
    agent: m(2,
      uc('Pipeline self-healing', 'Analytics & AI Delivery', 'Agent diagnoses and fixes routine pipeline failures, escalating non-routine ones.')),
  },
  'Cybersecurity, Identity & Resilience': {
    assistant: m(4,
      uc('Threat-intel & log Q&A', 'SOC Analysts', 'Query logs, alerts and threat intel in plain language during triage.')),
    augmented: m(3,
      uc('Policy & report drafting', 'Security Governance', 'AI drafts security policies, control narratives and incident reports for review.')),
    workflow: m(3,
      uc('Alert triage & enrichment', 'Threat Detection & Response', 'Agent triages and enriches SIEM alerts and proposes containment for analyst approval.')),
    agent: m(2,
      uc('Automated containment', 'Threat Detection & Response', 'Agent executes pre-approved containment (isolate host, revoke token) on confirmed threats.')),
  },
  'Service Operations, Incident & Production Support': {
    assistant: m(4,
      uc('Runbook & log assist', 'SRE · Support Engineers', 'Query logs and runbooks in plain language during incidents.')),
    augmented: m(3,
      uc('Incident & RCA drafting', 'Incident Managers', 'AI drafts incident timelines and root-cause analyses from telemetry and chat.')),
    workflow: m(3,
      uc('Alert triage & enrichment', 'Event Monitoring', 'Agent correlates alerts, enriches with context and proposes the runbook at a human gate.')),
    agent: m(2,
      uc('Auto-remediation', 'Incident Restoration', 'Agent executes known-good remediations for recurring incidents; humans approve risky actions.')),
  },
};

// Fallback for any value stream not yet authored — modest, non-coding posture.
const DEFAULT_PROFILE: StreamProfile = {
  assistant: m(3, uc('Drafting & lookup assistant', 'Team', 'Draft routine documents and answer questions from the value stream’s own records and procedures.')),
  augmented: m(2, uc('Work-product drafting', 'Team', 'AI drafts standard reports and assessments for a person to review and approve.')),
  workflow: m(1, uc('Task automation', 'Team', 'A scoped agent runs a recurring multi-step task and stops at a human gate.')),
  agent: m(0),
};

export function profileFor(streamName: string): StreamProfile {
  return STREAM_PROFILES[streamName] ?? DEFAULT_PROFILE;
}

export function levelsFor(streamName: string): number[] {
  const p = profileFor(streamName);
  return MODES.map((mode) => p[mode.key].level);
}

// ── Consistent role-utilization + efficiency derivations ────────────────────
// Roles utilizing is COUNT-first so the count and the % can never contradict
// (with N=1 you get 0/1 or 1/1, i.e. 0% or 100% — coarse but honest).
const SHARE = [0, 0.12, 0.35, 0.6, 0.85];

export function rolesUsing(level: number, roleCount: number): { count: number; pct: number } {
  if (level <= 0 || roleCount <= 0) return { count: 0, pct: 0 };
  const count = Math.min(roleCount, Math.max(1, Math.round(roleCount * SHARE[level])));
  return { count, pct: Math.round((100 * count) / roleCount) };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const EFF_BASE = [0, 9, 14, 21, 29];

export function efficiencyGain(streamName: string, modeKey: AiMode['key'], level: number): number {
  if (level <= 0) return 0;
  return EFF_BASE[level] + (hash(streamName + ':' + modeKey) % 6); // +0..5 stable jitter
}
