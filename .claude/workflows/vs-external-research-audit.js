export const meta = {
  name: 'vs-external-research-audit',
  description: 'External industry research validating all value streams L1→L5 for completeness and logic; verified additions/fixes',
  phases: [
    { title: 'Research', detail: 'web-grounded review of 29 streams, 3 per agent' },
    { title: 'Verify', detail: 'adversarial check: standard practice, true absence, valid wiring' },
  ],
}

const ROOT = 'C:/Users/xando/Code/transform-platform'

const STREAMS = ['AIOps & Intelligent Operations','Actuarial Pricing, Reserving & Capital Modeling','Audit & Assurance','Billing, Collections & Receivables','Change Management & Adoption','Claims Intake-to-Settlement','Claims Recoveries & Subrogation','Customer Service, Complaints & Experience','Cybersecurity, Identity & Resilience','Data, Analytics & AI Management','Delegated Authority Management','Distribution & Channel Management','Enterprise Strategy & Portfolio Management','FinOps / Cloud Financial Management','Finance, Treasury & Capital Management','Investment & Asset Management','Legal, Governance & Privacy Management','MLOps / ML Lifecycle Management','Marketing, Growth & Customer Insights','Policy Administration & Servicing','Product & Proposition Management','Reinsurance & Retrocession Management','Risk, Compliance & Regulatory Management','Service Operations, Incident & Production Support','Submission-to-Bind / Underwriting','Talent & Workforce Management','Technology Delivery & Change','Technology Strategy, Architecture & Delivery','Third-Party & Vendor Management']

const ENV = `Company: "Meridian Insurance Group", a combined P&C + Life & Retirement insurer. Its operating model decomposes 29 value streams into L3 process areas → L4 sub-processes (each with an activity code like CI-02-01) → L5 process steps (coded like CI-02-01-S03, ordered by stepNumber, each naming lead + supporting roles, inputs, outputs).
Files to read:
- ${ROOT}/vs-outline.json — the COMPLETE current model: every stream with its L4s and L5 steps (names, codes, roles, I/O). This is your ground truth of what exists.
- ${ROOT}/role-inventory.json — the 261 valid role names. Proposed leads/supporting MUST come from this list.
- ${ROOT}/app-inventory.json — the 61 application names. A proposed deliverable's system of record SHOULD be one of these (or null).`

const ADD_ITEM = {
  type: 'object',
  required: ['stream','l3','l4','l4Code','name','insertAfterStepNumber','description','leads','supporting','inputs','outputs','deliverable','rationale','sources'],
  additionalProperties: false,
  properties: {
    stream: { enum: STREAMS },
    l3: { type: 'string' }, l4: { type: 'string' },
    l4Code: { type: ['string','null'], description: 'existing L4 activity code from the outline, or null if proposing a NEW L4 (then l4 = the new L4 name)' },
    name: { type: 'string', description: 'the new L5 step name, Title Case verb phrase like existing steps' },
    insertAfterStepNumber: { type: 'integer', description: 'stepNumber of the existing step this follows; 0 = first step of the L4' },
    description: { type: 'string' },
    leads: { type: 'string', description: 'role name(s) from role-inventory.json, comma-separated' },
    supporting: { type: 'string', description: 'role name(s) from role-inventory.json, comma-separated' },
    inputs: { type: 'string' }, outputs: { type: 'string' },
    deliverable: { type: ['string','null'], description: 'the primary work product memorialized, or null' },
    sorApplication: { type: ['string','null'], description: 'app from app-inventory.json where the deliverable lives' },
    rationale: { type: 'string', description: 'why a practitioner/regulator would flag its absence' },
    sources: { type: 'array', items: { type: 'string' }, description: 'URLs or named industry references (ACORD, NAIC, OFAC guidance, etc.)' },
  },
}
const MOD_ITEM = {
  type: 'object', required: ['stream','stepCode','type','issue','proposedFix','rationale'], additionalProperties: false,
  properties: {
    stream: { enum: STREAMS }, stepCode: { type: 'string' },
    type: { enum: ['ordering','naming','logic','roles','io'] },
    issue: { type: 'string' }, proposedFix: { type: 'string' }, rationale: { type: 'string' },
    sources: { type: 'array', items: { type: 'string' } },
  },
}
const RESEARCH_SCHEMA = {
  type: 'object', required: ['additions','modifications','coverageNotes'], additionalProperties: false,
  properties: {
    additions: { type: 'array', items: ADD_ITEM },
    modifications: { type: 'array', items: MOD_ITEM },
    coverageNotes: { type: 'array', items: { type: 'string' }, description: 'per assigned stream: one line on overall fitness vs industry standard' },
  },
}
const VERIFY_SCHEMA = {
  type: 'object', required: ['additions','modifications','dropped'], additionalProperties: false,
  properties: {
    additions: { type: 'array', items: ADD_ITEM },
    modifications: { type: 'array', items: MOD_ITEM },
    dropped: { type: 'array', items: { type: 'object', required: ['name','reason'], additionalProperties: false, properties: { name: { type: 'string' }, reason: { type: 'string' } } } },
  },
}

function researchPrompt(streams) {
  return `${ENV}
You are an insurance operating-model expert doing EXTERNAL RESEARCH to validate value streams. Your assigned streams: ${streams.map((s) => `"${s}"`).join(', ')}.
For EACH assigned stream:
1. Read its full L4/L5 outline from vs-outline.json.
2. Web-research the industry-standard end-to-end process for that capability at a combined P&C + Life & Retirement insurer (ACORD capability/process models, NAIC model regulations, OFAC/FinCEN guidance, Lloyd's delegated-authority standards, ITIL/SAFe for tech streams, COSO/IIA for audit, etc. — whatever fits the domain).
3. Compare: are steps in a logical industry order? Is anything MATERIALLY missing that a practitioner or regulator would flag? Classic gaps in models like this: sanctions/OFAC and watchlist screening (at claims payment, underwriting clearance, vendor onboarding, premium refund), AML/KYC, fraud detection and SIU referral, escheatment/unclaimed property, Medicare Section 111 reporting, premium audit, catastrophe response, complaints/DOI handling, beneficiary verification, surrender/replacement suitability (life), recordkeeping/retention. Research what applies to YOUR streams — do not force these examples.
4. CRITICAL before proposing an addition: search the ENTIRE vs-outline.json (all 29 streams) for the concept under every plausible synonym. If it already exists in the stream where it belongs, do NOT propose it. If it exists elsewhere but is genuinely also required inside your stream's flow (e.g. a sanctions check inside the claims-payment L4 even though Compliance owns the sanctions program), you may propose it, saying so in the rationale.
5. Quality over quantity: only material, defensible gaps — typically 0-4 additions per stream. Each addition must name real roles from role-inventory.json (leads = who runs the step day-to-day, not executives) and a sensible position in the existing step order. Modifications: only clear logic/ordering/naming defects, not stylistic preferences.
Return structured output only. Do not modify any file or database.`
}

function verifyPrompt(result, streams) {
  return `${ENV}
You are an adversarial reviewer. Below are proposed additions/modifications to the value streams ${streams.map((s) => `"${s}"`).join(', ')} from another researcher. For EACH addition, verify HARD and DROP anything that fails:
1. Standard practice — web-check: is this step genuinely part of the industry-standard flow for this capability (cite why)? Drop invented or niche steps.
2. True absence — search vs-outline.json (ALL streams) for the concept under synonyms; drop if it already exists where proposed, and amend the rationale if it exists elsewhere but is still legitimately needed here.
3. Wiring validity — every lead/supporting role must appear EXACTLY in role-inventory.json (fix near-miss names); l4Code must exist in the outline for that stream (or be null with a sensible new L4 name); insertAfterStepNumber must be a real stepNumber in that L4 (or 0); sorApplication must be in app-inventory.json or null.
4. Placement logic — does it belong at this point of the flow? Amend insertAfterStepNumber if obviously wrong.
For modifications: keep only ones whose stepCode exists in the outline and whose fix a practitioner would clearly endorse. Anything dropped goes in 'dropped' with the reason. Return the surviving (possibly amended) items in the same shape. Do not modify any file or database.
PROPOSALS:
${JSON.stringify(result)}`
}

const batches = []
for (let i = 0; i < STREAMS.length; i += 3) batches.push(STREAMS.slice(i, i + 3))
log(`Researching ${STREAMS.length} streams in ${batches.length} batches of up to 3`)

const results = await pipeline(
  batches,
  (streams) => agent(researchPrompt(streams), { label: `research:${streams[0].slice(0, 18)}…`, phase: 'Research', schema: RESEARCH_SCHEMA }),
  (res, streams) => res ? agent(verifyPrompt(res, streams), { label: `verify:${streams[0].slice(0, 18)}…`, phase: 'Verify', schema: VERIFY_SCHEMA }) : null,
)

const ok = results.filter(Boolean)
const additions = ok.flatMap((r) => r.additions)
const modifications = ok.flatMap((r) => r.modifications)
const dropped = ok.flatMap((r) => r.dropped)
const coverage = (await Promise.resolve([])).concat() // coverageNotes live on research results, not verify — collected below
log(`Verified: ${additions.length} additions, ${modifications.length} modifications; ${dropped.length} proposals dropped`)
return { additions, modifications, dropped }