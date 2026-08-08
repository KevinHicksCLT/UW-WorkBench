// SDLC composite map — the underwriting value chain, step by step, with the
// UW-WORK capability ids, requirement refs, guarding invariants, the artifacts
// implementing each step IN THIS APP, and the source SDLC deliverables each
// step derives from. Rendered by SdlcComposite.tsx.

export type SdlcStep = {
  step: number;
  title: string;
  summary: string;
  capabilities: string[];
  requirements: string[];
  invariants: string[];
  /** What implements the step here: API endpoints + the workbench screen. */
  implementedBy: { api: string[]; screen: string };
  /** Source SDLC deliverables the step derives from. */
  derivedFrom: string[];
  /** Documented gap — specified but not yet implemented. */
  gap?: boolean;
};

const UW_CORE_DOCS = [
  'UW-WORK v0.1 requirements workbook',
  'UW-WORK v0.1 HLD',
  'UW-WORK v0.1 LLD',
  'UW-WORK v0.1 validation & integration spec',
];

export const SDLC_STEPS: SdlcStep[] = [
  {
    step: 1,
    title: 'Intake & Extraction',
    summary:
      'Normalizes every channel (email, portal, API, file) into one submission path; extracted fields carry per-field confidence + provenance, and low-confidence fields are quarantined to the exception lane.',
    capabilities: ['CAP-01'],
    requirements: ['HLR-01', 'HLR-02', 'LLR-01'],
    invariants: [],
    implementedBy: {
      api: ['POST /uw/submissions'],
      screen: 'Pipeline tab · Workspace evidence table',
    },
    derivedFrom: [...UW_CORE_DOCS, 'UW-WORK v0.1 wireframes', 'UW-WORK v0.1 ontology'],
  },
  {
    step: 2,
    title: 'Clearance & Sanctions',
    summary:
      'Duplicate, blocked-account, and watchlist screening at intake and on demand. A watchlist hit can only be released dual-control: two signatures from distinct roles.',
    capabilities: ['CAP-02'],
    requirements: ['HLR-03', 'LLR-02'],
    invariants: ['INV-4'],
    implementedBy: {
      api: ['POST /uw/submissions/:id/clearance', 'POST /uw/clearance/:checkId/release'],
      screen: 'Workspace clearance panel (dual-control release flow)',
    },
    derivedFrom: [...UW_CORE_DOCS, 'UW-WORK v0.1 ontology views'],
  },
  {
    step: 3,
    title: 'Enrichment',
    summary:
      'Jurisdiction-filtered fan-out across registered third-party sources, with TTL-respecting caching per source. A source restricted to jurisdictions is never called where not permitted.',
    capabilities: ['CAP-05'],
    requirements: ['HLR-07', 'LLR-06', 'NFR-06'],
    invariants: [],
    implementedBy: {
      api: ['POST /uw/risk-objects/:id/enrich'],
      screen: 'Workspace risk-object cards',
    },
    derivedFrom: [...UW_CORE_DOCS, 'UW-WORK v0.1 ontology'],
  },
  {
    step: 4,
    title: 'Appetite',
    summary:
      'Appetite as a governed, versioned, effective-dated artifact. Publish always creates ref@v+1; verdicts (IN / EDGE / OUT) always cite the statement ids they derived from.',
    capabilities: ['CAP-03'],
    requirements: ['HLR-04', 'HLR-05', 'LLR-03', 'LLR-04'],
    invariants: ['INV-3'],
    implementedBy: {
      api: ['GET/POST /uw/appetite/statements', 'GET /uw/appetite/evaluate'],
      screen: 'Appetite tab (Appetite Studio)',
    },
    derivedFrom: [...UW_CORE_DOCS, 'UW-WORK v0.1 wireframes'],
  },
  {
    step: 5,
    title: 'Triage',
    summary:
      'Four explainable lenses (appetite fit, winnability, expected value, effort) composited by a versioned weight set. Re-score appends — a score is never overwritten.',
    capabilities: ['CAP-04'],
    requirements: ['HLR-06', 'LLR-05'],
    invariants: [],
    implementedBy: {
      api: ['POST /uw/triage/rescore'],
      screen: 'Pipeline triage column · Workspace score card',
    },
    derivedFrom: UW_CORE_DOCS,
  },
  {
    step: 6,
    title: 'Risk Workspace / Decision',
    summary:
      'Desk mode for one submission: evidence, exposures, clearance, scores, referrals, decisions, and quotes resolved into a single projection the underwriter decides from.',
    capabilities: ['CAP-06'],
    requirements: ['HLR-08', 'LLR-07'],
    invariants: [],
    implementedBy: { api: ['GET /uw/submissions/:id'], screen: 'Workspace tab (desk mode)' },
    derivedFrom: [...UW_CORE_DOCS, 'UW-WORK v0.1 wireframes', 'UW-WORK v0.1 ontology views'],
  },
  {
    step: 7,
    title: 'Guideline Rules & Agent Proposals',
    summary:
      'Versioned decision-table rules evaluated by a pure, replayable evaluator; agent output is always a ProposalEnvelope a human must accept, modify, or reject — it never auto-applies.',
    capabilities: ['CAP-07'],
    requirements: ['HLR-09', 'HLR-10', 'LLR-08', 'LLR-09'],
    invariants: ['ADR-02'],
    implementedBy: {
      api: ['POST /uw/submissions/:id/proposals', 'POST /uw/agent-actions/:id/disposition'],
      screen: 'Workspace proposal cards (accept / modify / reject)',
    },
    derivedFrom: UW_CORE_DOCS,
  },
  {
    step: 8,
    title: 'Authority & Referral',
    summary:
      'Authority as data: grants bind to the Roles catalog, never user ids. Every decision passes the pure authority validator; a breach auto-opens a referral routed up the escalation chain.',
    capabilities: ['CAP-08'],
    requirements: ['HLR-11', 'HLR-12', 'LLR-10', 'LLR-11'],
    invariants: ['INV-1'],
    implementedBy: {
      api: [
        'GET/POST /uw/authority/grants',
        'POST /uw/decisions',
        'POST /uw/referrals/:id/resolve',
      ],
      screen: 'Authority tab · Workspace decision form + referral panel',
    },
    derivedFrom: [...UW_CORE_DOCS, 'UW-WORK v0.1 ontology'],
  },
  {
    step: 9,
    title: 'Delegated Authority',
    summary:
      'Delegable grants are blocked until a bordereaux schedule is attached; the trailing-90-day breach counter surfaces drift in delegated books.',
    capabilities: ['CAP-13'],
    requirements: ['HLR-17'],
    invariants: [],
    implementedBy: {
      api: ['POST /uw/authority/grants (delegable + bordereaux gate)'],
      screen: 'Authority tab (delegable / breaches 90d columns)',
    },
    derivedFrom: UW_CORE_DOCS,
  },
  {
    step: 10,
    title: 'Rating (RATE-PRICING)',
    summary:
      'Pricing lives in the RATE-PRICING module; a quote references its rating model via the priced-by edge (modelRef M-XX-##) which must resolve before bind.',
    capabilities: ['CAP-09'],
    requirements: ['HLR-13'],
    invariants: ['INV-7'],
    implementedBy: { api: ['POST /uw/quotes (modelRef)'], screen: 'Workspace quote & bind panel' },
    derivedFrom: ['RATE-PRICING module design set', 'UW-WORK v0.1 validation & integration spec'],
  },
  {
    step: 11,
    title: 'Forms (FORMS-RATION)',
    summary:
      'Policy forms live in the FORMS-RATION module; a quote references its form set via the documented-by edge (formSetRef FS-XXX-##) which must resolve before bind.',
    capabilities: ['CAP-09'],
    requirements: ['HLR-13'],
    invariants: ['INV-7'],
    implementedBy: {
      api: ['POST /uw/quotes (formSetRef)'],
      screen: 'Workspace quote & bind panel',
    },
    derivedFrom: [
      'FORMS-RATION module design set',
      'UW-WORK v0.1 validation & integration spec',
    ],
  },
  {
    step: 12,
    title: 'Quote & Bind (PAS)',
    summary:
      'Bind executes only on a human-dispositioned QUOTE decision, with both cross-module refs resolved, onto a registered PAS Application node — idempotent on correlationId.',
    capabilities: ['CAP-09'],
    requirements: ['HLR-13', 'LLR-12'],
    invariants: ['INV-2', 'INV-7'],
    implementedBy: {
      api: ['POST /uw/quotes', 'POST /uw/bind'],
      screen: 'Workspace quote & bind panel',
    },
    derivedFrom: [...UW_CORE_DOCS, 'UW-WORK v0.1 ontology views'],
  },
  {
    step: 13,
    title: 'Governance & Audit',
    summary:
      'The audit IS the event log: an append-only governance spine every human, agent, and system action lands on, correlation-stitched intake → bind. Agents also reach it via the MCP surface.',
    capabilities: ['CAP-10'],
    requirements: ['HLR-14', 'LLR-13', 'NFR-04'],
    invariants: ['INV-5'],
    implementedBy: {
      api: ['GET /uw/events', 'GET /uw/agent-actions', 'POST /uw/mcp'],
      screen: 'Governance tab',
    },
    derivedFrom: UW_CORE_DOCS,
  },
  {
    step: 14,
    title: 'Knowledge QA',
    summary:
      'Grounded Q&A over the underwriting knowledge base (guidelines, appetite, precedent) with citations. Specified in the requirements workbook; not yet implemented in this app.',
    capabilities: ['CAP-11'],
    requirements: ['HLR-15'],
    invariants: [],
    implementedBy: { api: [], screen: '—' },
    derivedFrom: ['UW-WORK v0.1 requirements workbook', 'UW-WORK v0.1 HLD'],
    gap: true,
  },
  {
    step: 15,
    title: 'Pipeline Steering',
    summary:
      'Portfolio-level steering of the live pipeline: open counts, SLA breach risk, appetite mix, and the pending-proposal backlog, over the ranked triage queue.',
    capabilities: ['CAP-12'],
    requirements: ['HLR-16'],
    invariants: [],
    implementedBy: { api: ['GET /uw/submissions'], screen: 'Pipeline tab KPI strip' },
    derivedFrom: [...UW_CORE_DOCS, 'UW-WORK v0.1 wireframes'],
  },
  {
    step: 16,
    title: 'Cross-Estate Rationalization',
    summary:
      'Detects divergent appetite / rule / authority artifacts across estates, weighs their similarity, and resolves them merge / retire / keep-both — impact-previewed and CUO-gated.',
    capabilities: ['CAP-14'],
    requirements: ['HLR-18', 'HLR-19', 'LLR-14', 'LLR-15'],
    invariants: ['INV-6'],
    implementedBy: {
      api: [
        'GET /uw/rationalization/divergence',
        'GET /uw/rationalization/divergence/:id/impact',
        'POST /uw/rationalization/divergence/:id/action',
      ],
      screen: 'Rationalization tab',
    },
    derivedFrom: [...UW_CORE_DOCS, 'UW-WORK v0.1 ontology'],
  },
];
