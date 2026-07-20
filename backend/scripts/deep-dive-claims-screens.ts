// deep-dive-claims-screens.ts — atomic screen-level decomposition of openIMIS
// and OpenMRS (insurance claims module) for the Workspace board rw_claims_interop.
//
// Grounded in the real applications:
//   openIMIS  — openimis-fe-* React/Material modules over the Django/GraphQL
//               backend (openimis-be_py): core login, insuree, family, policy,
//               claim (entry / reviews / feedback), product administration.
//   OpenMRS   — reference application 2.x + openmrs-module-insuranceclaims
//               (api/omod): enrolment check on registration, FHIR R4 claim
//               submission to an external insurer, claim status tracking.
//
// Wholesale-replaces the board's screens, findings and normalization entries
// with the deep-dive set (idempotent — same ids each run). Screens point at
// rendered reconstructions under /screens/<slug>.png (frontend/public).
import { prisma } from '../src/db/prisma.js';

const WS = 'rw_claims_interop';
const A0 = 'rw_claims_interop_a0'; // openIMIS
const A1 = 'rw_claims_interop_a1'; // OpenMRS Insurance Claims
const COMP: Record<string, string> = {
  UI: 'rw_claims_interop_c0',
  Integration: 'rw_claims_interop_c1',
  'Business Service': 'rw_claims_interop_c2',
  Data: 'rw_claims_interop_c3',
  Infrastructure: 'rw_claims_interop_c4',
};

type Layer = 'UI' | 'Integration' | 'Business Service' | 'Data' | 'Infrastructure';

// ── Screens ──────────────────────────────────────────────────────────────────
const SCREENS: { app: string; name: string; slug: string; kind?: string }[] = [
  { app: A0, name: 'Login', slug: 'imis-login' },
  { app: A0, name: 'Insurees', slug: 'imis-insurees' },
  { app: A0, name: 'Families & Groups', slug: 'imis-families' },
  { app: A0, name: 'Insuree Enquiry', slug: 'imis-enquiry', kind: 'MODAL' },
  { app: A0, name: 'Health Facility Claims', slug: 'imis-hf-claims' },
  { app: A0, name: 'Claim Entry Form', slug: 'imis-claim-detail' },
  { app: A0, name: 'Claim Reviews', slug: 'imis-claim-reviews' },
  { app: A0, name: 'Claim Review Detail', slug: 'imis-review-detail' },
  { app: A0, name: 'Claim Feedback', slug: 'imis-feedback' },
  { app: A0, name: 'Policies', slug: 'imis-policies' },
  { app: A0, name: 'Products & Pricelists', slug: 'imis-products' },
  { app: A1, name: 'Login & Location', slug: 'omrs-login' },
  { app: A1, name: 'Home', slug: 'omrs-home' },
  { app: A1, name: 'Find Patient Record', slug: 'omrs-find-patient' },
  { app: A1, name: 'Register Patient', slug: 'omrs-register' },
  { app: A1, name: 'Patient Dashboard — Insurance', slug: 'omrs-dashboard-insurance' },
  { app: A1, name: 'Create Insurance Claim', slug: 'omrs-create-claim' },
  { app: A1, name: 'Claim Status Tracker', slug: 'omrs-claim-status' },
  { app: A1, name: 'Claimed Items Review', slug: 'omrs-claimed-items' },
];

// ── Findings (atomic) ────────────────────────────────────────────────────────
type F = {
  id: string;
  app: string;
  layer: Layer;
  screen: string;
  category: string;
  name: string;
  code: string;
  summary: string;
  capdan?: string; // default Common
  targetLayer?: Layer;
  view?: string; // COMPONENT | BEHAVIOR
  dead?: boolean;
  status?: string; // migrationStatus, default 'In Analysis'
  effort?: string;
  complexity?: string;
  approach?: string;
  rationale?: string;
  entry?: string; // normalization entry id this rolls into
  why?: Record<string, string>;
};

const IMIS: F[] = [
  // Login
  {
    id: 'dd_i_login_form',
    app: A0,
    layer: 'UI',
    screen: 'Login',
    category: 'Authentication',
    name: 'Username & password sign-in form',
    code: 'openimis-fe-core: pages/LoginPage.js',
    summary: 'Username + password with forgot-password link; errors render inline under the form.',
    entry: 'ddn_signin',
  },
  {
    id: 'dd_i_login_lang',
    app: A0,
    layer: 'UI',
    screen: 'Login',
    category: 'Authentication',
    name: 'Interface language selector',
    code: 'openimis-fe-core: LanguagePicker (en/fr)',
    summary: 'Per-user interface language chosen at sign-in and stored on the profile.',
  },
  {
    id: 'dd_i_login_jwt',
    app: A0,
    layer: 'Infrastructure',
    screen: 'Login',
    category: 'Session & rights',
    name: 'JWT session with integer rights (e.g. 101002)',
    code: 'openimis-be core: jwt auth + role rights',
    summary:
      'Backend issues a JWT; every menu/action gates on numeric rights codes cached client-side.',
    entry: 'ddn_session',
  },
  // Insurees
  {
    id: 'dd_i_ins_search',
    app: A0,
    layer: 'UI',
    screen: 'Insurees',
    category: 'Member search',
    name: 'Insuree search grid (CHF ID, names, DOB, gender)',
    code: 'openimis-fe-insuree: components/InsureeSearcher.js',
    summary: 'Filterable, paginated grid (10/20/50/100 per page) over the insuree register.',
    entry: 'ddn_membersearch',
  },
  {
    id: 'dd_i_ins_chfid',
    app: A0,
    layer: 'Business Service',
    screen: 'Insurees',
    category: 'Identifier rules',
    name: 'CHF ID format & checksum validation (12 chars)',
    code: 'openimis-be insuree: chf_id validation (module config chfIdMaxLength)',
    summary:
      'Member number validated for length and checksum before any search or enrolment proceeds.',
    entry: 'ddn_idvalidation',
  },
  {
    id: 'dd_i_ins_gql',
    app: A0,
    layer: 'Integration',
    screen: 'Insurees',
    category: 'Query APIs',
    name: 'GraphQL insurees query with server-side filters',
    code: 'openimis-be: insuree_qgl { insurees(chfId, lastName, dob…) }',
    summary:
      'Search grid is backed by one GraphQL query; filters translate to server-side predicates.',
  },
  // Families & Groups
  {
    id: 'dd_i_fam_wizard',
    app: A0,
    layer: 'UI',
    screen: 'Families & Groups',
    category: 'Enrolment',
    name: 'Family creation wizard (head insuree + location cascade)',
    code: 'openimis-fe-insuree: FamilyForm.js (Region→District→Municipality→Village)',
    summary:
      'Creates a family/group with its head member; location picked down a 4-level cascade; poverty status flag.',
  },
  {
    id: 'dd_i_fam_kinship',
    app: A0,
    layer: 'Business Service',
    screen: 'Families & Groups',
    category: 'Membership rules',
    name: 'Family membership & kinship management',
    code: 'openimis-be insuree: family members, relation picker',
    summary: 'Members join/leave families with kinship codes; policy retention prompts on removal.',
  },
  {
    id: 'dd_i_fam_schema',
    app: A0,
    layer: 'Data',
    screen: 'Families & Groups',
    category: 'Member master',
    name: 'tblFamilies / tblInsuree relational master',
    code: 'openimis-be db: tblFamilies, tblInsuree (FamilyID FK, CHFID unique)',
    summary:
      'Member master keyed by CHFID with family FK — the system of record for coverage lookups.',
    entry: 'ddn_membermaster',
  },
  // Insuree Enquiry
  {
    id: 'dd_i_enq_dialog',
    app: A0,
    layer: 'UI',
    screen: 'Insuree Enquiry',
    category: 'Coverage panel',
    name: 'Enquiry dialog (photo, family, active policy, balance)',
    code: 'openimis-fe-insuree: EnquiryDialog.js',
    summary:
      'One dialog answers "is this member covered": photo, family, product, expiry and remaining ceiling.',
    entry: 'ddn_coveragepanel',
  },
  {
    id: 'dd_i_enq_elig',
    app: A0,
    layer: 'Business Service',
    screen: 'Insuree Enquiry',
    category: 'Eligibility rules',
    name: 'Item/service eligibility with remaining counts',
    code: 'openimis-be policy: eligibility service (ceilings, deductibles, remaining visits)',
    summary:
      'Native rules engine computes remaining ceiling/counts per item and service for the active policy.',
  },
  {
    id: 'dd_i_enq_gql',
    app: A0,
    layer: 'Integration',
    screen: 'Insuree Enquiry',
    category: 'Query APIs',
    name: 'GraphQL policy-values & eligibility query',
    code: 'openimis-be: policy_qgl { policyValues, eligibility(chfId, item/service) }',
    summary:
      'Coverage panel and eligibility checks resolve through GraphQL against the native policy engine.',
    entry: 'ddn_eligquery',
  },
  // Health Facility Claims
  {
    id: 'dd_i_hfc_list',
    app: A0,
    layer: 'UI',
    screen: 'Health Facility Claims',
    category: 'Claim worklist',
    name: 'Claims worklist with status chips',
    code: 'openimis-fe-claim: ClaimSearcher.js (Entered/Checked/Processed/Valuated/Rejected)',
    summary: 'Facility-scoped claims list; status chip per claim tracks the pipeline stage.',
    entry: 'ddn_claimlist',
  },
  {
    id: 'dd_i_hfc_batch',
    app: A0,
    layer: 'UI',
    screen: 'Health Facility Claims',
    category: 'Claim worklist',
    name: 'Multi-select batch actions (submit / delete selected)',
    code: 'openimis-fe-claim: ClaimSearcher selection actions',
    view: 'BEHAVIOR',
    summary: 'Facility clerk submits or deletes many entered claims in one action.',
  },
  {
    id: 'dd_i_hfc_state',
    app: A0,
    layer: 'Business Service',
    screen: 'Health Facility Claims',
    category: 'Claim lifecycle',
    name: 'Claim status state machine',
    code: 'openimis-be claim: status transitions (Entered→Checked→Processed→Valuated)',
    summary: 'Server-enforced lifecycle; illegal transitions rejected regardless of caller.',
  },
  // Claim Entry Form
  {
    id: 'dd_i_ce_header',
    app: A0,
    layer: 'UI',
    screen: 'Claim Entry Form',
    category: 'Claim capture',
    name: 'Claim header (code ≤8, HF, CHF ID, dates, visit type)',
    code: 'openimis-fe-claim: ClaimMasterPanel.js (visit type Emergency/Referral/Other)',
    summary:
      'Claim code (auto-generate optional), facility, member, visit dates and visit type in one header panel.',
    entry: 'ddn_claimform',
  },
  {
    id: 'dd_i_ce_icd',
    app: A0,
    layer: 'UI',
    screen: 'Claim Entry Form',
    category: 'Claim capture',
    name: 'ICD diagnosis pickers (main + up to 4 secondary)',
    code: 'openimis-fe-claim: ClaimForm.js diagnosis pickers',
    summary:
      'Main diagnosis mandatory; up to four secondary ICD codes from the configured code list.',
  },
  {
    id: 'dd_i_ce_lines',
    app: A0,
    layer: 'UI',
    screen: 'Claim Entry Form',
    category: 'Claim capture',
    name: 'Services & items grid (qty × unit price, running total)',
    code: 'openimis-fe-claim: ClaimForm services/items panels',
    summary:
      'Line items from the product pricelists; quantity and price per line with a running claim total.',
  },
  {
    id: 'dd_i_ce_attach',
    app: A0,
    layer: 'UI',
    screen: 'Claim Entry Form',
    category: 'Claim capture',
    name: 'Claim attachments upload',
    code: 'openimis-fe-claim: ClaimAttachmentsDialog',
    summary: 'Supporting documents attach to the claim before submission.',
    entry: 'ddn_attachments',
  },
  {
    id: 'dd_i_ce_prior',
    app: A0,
    layer: 'Business Service',
    screen: 'Claim Entry Form',
    category: 'Eligibility rules',
    name: 'Insuree eligibility summary + prior-claim history on entry',
    code: 'openimis-fe-claim: ClaimMasterPanel eligibility strip',
    summary:
      'The form front-loads coverage state and recent claims so ineligible entries stop early.',
  },
  {
    id: 'dd_i_ce_total',
    app: A0,
    layer: 'Business Service',
    screen: 'Claim Entry Form',
    category: 'Amount calculation',
    name: 'Claimed amount calculation (Σ qty × price)',
    code: 'openimis-be claim: claimed = Σ(items+services)',
    summary: 'Claim total derives from the lines — never hand-entered.',
    entry: 'ddn_billcalc',
  },
  {
    id: 'dd_i_ce_gql',
    app: A0,
    layer: 'Integration',
    screen: 'Claim Entry Form',
    category: 'Submission APIs',
    name: 'GraphQL createClaim / submitClaims mutations',
    code: 'openimis-be: claim_qgl mutations { createClaim, submitClaims }',
    summary:
      'Claim create/submit are GraphQL mutations against the native backend — no FHIR on this path.',
    capdan: 'Different',
    entry: 'ddn_submit',
    approach: 'Converge on FHIR R4 Claim submission.',
    rationale: 'Two submission protocols for the same business act.',
    why: {
      captured: 'Claim header + lines from the entry form',
      sent: 'GraphQL mutation to openimis-be',
      processed: 'Native claim service persists tblClaim',
      validation: 'Server-side status + eligibility checks',
      landsIn: 'FHIR R4 claim & eligibility APIs',
    },
  },
  {
    id: 'dd_i_ce_schema',
    app: A0,
    layer: 'Data',
    screen: 'Claim Entry Form',
    category: 'Claim schema',
    name: 'tblClaim / tblClaimItems / tblClaimServices',
    code: 'openimis-be db: tblClaim(ClaimCode, DateFrom/To, Status), tblClaimItems, tblClaimServices',
    summary:
      'Claim header + two line tables (items, services), each with qty/price/approval columns.',
    entry: 'ddn_claimschema',
  },
  // Claim Reviews
  {
    id: 'dd_i_rev_list',
    app: A0,
    layer: 'UI',
    screen: 'Claim Reviews',
    category: 'Adjudication',
    name: 'Review workbench (filter by status, facility, batch)',
    code: 'openimis-fe-claim: claim/reviews route',
    summary: 'Insurer-side queue of submitted claims awaiting medical/financial review.',
  },
  {
    id: 'dd_i_rev_select',
    app: A0,
    layer: 'Business Service',
    screen: 'Claim Reviews',
    category: 'Adjudication',
    name: 'Review selection rules (random %, value threshold), bypass',
    code: 'openimis-be claim: select for review / bypass',
    summary:
      'Claims route to review by configurable sampling and amount thresholds; the rest bypass.',
  },
  // Claim Review Detail
  {
    id: 'dd_i_rd_grid',
    app: A0,
    layer: 'UI',
    screen: 'Claim Review Detail',
    category: 'Adjudication',
    name: 'Line-item adjudication grid (approve qty/price, reject codes)',
    code: 'openimis-fe-claim: claim/review/:claim_uuid',
    summary: 'Reviewer edits approved quantity/price per line and applies rejection reason codes.',
    entry: 'ddn_lineoutcomes',
  },
  {
    id: 'dd_i_rd_valuate',
    app: A0,
    layer: 'Business Service',
    screen: 'Claim Review Detail',
    category: 'Valuation',
    name: 'Claim valuation (approved − deductibles, ceiling caps)',
    code: 'openimis-be claim_batch: valuation run',
    summary: 'Approved amount computed against product deductibles and remaining ceilings.',
  },
  {
    id: 'dd_i_rd_reject',
    app: A0,
    layer: 'Data',
    screen: 'Claim Review Detail',
    category: 'Reference data',
    name: 'Rejection reason code catalog',
    code: 'openimis-be db: rejection reasons (-1..16)',
    summary: 'Canonical reject codes drive both the review UI and downstream reporting.',
  },
  // Claim Feedback
  {
    id: 'dd_i_fb_form',
    app: A0,
    layer: 'UI',
    screen: 'Claim Feedback',
    category: 'Beneficiary feedback',
    name: 'Feedback form (visit confirmed, satisfaction 1–5, payment asked)',
    code: 'openimis-fe-claim: claim/feedback/:claim_uuid',
    summary:
      'Community feedback on a claimed visit — did it happen, was payment requested, satisfaction score.',
  },
  {
    id: 'dd_i_fb_flow',
    app: A0,
    layer: 'Business Service',
    screen: 'Claim Feedback',
    category: 'Beneficiary feedback',
    name: 'Feedback assignment workflow (sampling → officer)',
    code: 'openimis-be claim: feedback selection & delivery',
    summary: 'Sampled claims route to enrolment officers for beneficiary confirmation.',
  },
  // Policies
  {
    id: 'dd_i_pol_list',
    app: A0,
    layer: 'UI',
    screen: 'Policies',
    category: 'Coverage admin',
    name: 'Policies list (idle/ready/active/suspended/expired; new/renew)',
    code: 'openimis-fe-policy: policy/policies',
    summary: 'Family policies with status + stage; renew and suspend inline.',
  },
  {
    id: 'dd_i_pol_balance',
    app: A0,
    layer: 'Data',
    screen: 'Policies',
    category: 'Coverage master',
    name: 'Policy value & contribution balance tracking',
    code: 'openimis-be db: tblPolicy (PolicyValue, effective/expiry), tblPremium',
    summary:
      'Policy value vs paid contributions decides activation — the coverage source of truth.',
    entry: 'ddn_coveragemaster',
  },
  // Products & Pricelists
  {
    id: 'dd_i_prod_cfg',
    app: A0,
    layer: 'UI',
    screen: 'Products & Pricelists',
    category: 'Product config',
    name: 'Product configuration (ceilings, deductibles, grace periods)',
    code: 'openimis-fe-product: product admin pages',
    summary: 'Benefit-package parameters that the eligibility and valuation engines read.',
  },
  {
    id: 'dd_i_prod_pl',
    app: A0,
    layer: 'Data',
    screen: 'Products & Pricelists',
    category: 'Reference data',
    name: 'Medical items & services pricelists',
    code: 'openimis-be db: tblItems, tblServices + HF pricelists',
    summary: 'Priced catalog per facility; claim lines must reference it.',
  },
  // Legacy (eliminate)
  {
    id: 'dd_i_legacy_profile',
    app: A0,
    layer: 'UI',
    screen: 'Insurees',
    category: 'Legacy',
    name: 'Legacy insuree profile page (insuree/profile)',
    code: 'openimis-fe-insuree: legacy profile route',
    summary: 'Superseded by the enquiry dialog + family overview; kept only for old links.',
    capdan: 'Eliminate',
    dead: true,
    status: 'Identified',
    approach: 'Retire with the migration.',
    rationale: 'Duplicate of enquiry + family overview.',
  },
];

const OMRS: F[] = [
  // Login & Location
  {
    id: 'dd_o_login_form',
    app: A1,
    layer: 'UI',
    screen: 'Login & Location',
    category: 'Authentication',
    name: 'Sign-in with mandatory session location',
    code: 'referenceapplication: login.gsp (username, password, location list)',
    summary:
      'Username + password plus a required care-location pick that scopes the whole session.',
    entry: 'ddn_signin',
  },
  {
    id: 'dd_o_login_session',
    app: A1,
    layer: 'Infrastructure',
    screen: 'Login & Location',
    category: 'Session & rights',
    name: 'Session context with string privileges + location',
    code: 'openmrs-core: UserContext (privileges, sessionLocation)',
    summary: 'Privileges are named strings; the chosen location stamps every encounter and claim.',
    entry: 'ddn_session',
  },
  // Home
  {
    id: 'dd_o_home_grid',
    app: A1,
    layer: 'UI',
    screen: 'Home',
    category: 'Navigation',
    name: 'App grid dashboard (Find Patient, Register, Insurance)',
    code: 'referenceapplication: home apps grid',
    summary: 'Role-filtered tiles are the entire top-level navigation.',
  },
  // Find Patient Record
  {
    id: 'dd_o_find_search',
    app: A1,
    layer: 'UI',
    screen: 'Find Patient Record',
    category: 'Member search',
    name: 'Incremental patient search (name/ID) + recent patients',
    code: 'coreapps: findpatient (as-you-type, last-viewed strip)',
    summary: 'Search-as-you-type over names and identifiers with a recent-patients shortcut row.',
    entry: 'ddn_membersearch',
  },
  {
    id: 'dd_o_find_luhn',
    app: A1,
    layer: 'Business Service',
    screen: 'Find Patient Record',
    category: 'Identifier rules',
    name: 'OpenMRS ID Luhn Mod-30 check digit',
    code: 'openmrs-core: LuhnMod30IdentifierValidator',
    summary: 'Patient identifiers self-verify with a Mod-30 check digit before any lookup.',
    entry: 'ddn_idvalidation',
  },
  // Register Patient
  {
    id: 'dd_o_reg_wizard',
    app: A1,
    layer: 'UI',
    screen: 'Register Patient',
    category: 'Enrolment',
    name: 'Registration wizard (demographics, address hierarchy, relationships)',
    code: 'registrationapp: patient registration steps',
    summary:
      'Stepwise capture of person, address (hierarchical) and relationships; confirmation summary at the end.',
  },
  {
    id: 'dd_o_reg_enrolcheck',
    app: A1,
    layer: 'Integration',
    screen: 'Register Patient',
    category: 'Eligibility APIs',
    name: 'External insurance enrolment check on registration',
    code: 'insuranceclaims api: FHIR CoverageEligibilityRequest at registration',
    summary:
      'Registration asks the external insurer (openIMIS) whether the person is enrolled before care starts.',
    entry: 'ddn_eligquery',
  },
  // Patient Dashboard — Insurance
  {
    id: 'dd_o_dash_widget',
    app: A1,
    layer: 'UI',
    screen: 'Patient Dashboard — Insurance',
    category: 'Coverage panel',
    name: 'Insurance eligibility widget (policy no, status, balance)',
    code: 'insuranceclaims omod: patientDashboard fragment',
    summary: 'Point-of-care coverage card on the patient dashboard before a visit is billed.',
    entry: 'ddn_coveragepanel',
  },
  {
    id: 'dd_o_dash_fhirclient',
    app: A1,
    layer: 'Integration',
    screen: 'Patient Dashboard — Insurance',
    category: 'Eligibility APIs',
    name: 'FHIR CoverageEligibilityRequest/Response client',
    code: 'insuranceclaims api: FhirRequestClient → external IMIS FHIR endpoint',
    summary: 'Widget data comes from a live FHIR eligibility round-trip to the insurer.',
  },
  {
    id: 'dd_o_dash_cache',
    app: A1,
    layer: 'Data',
    screen: 'Patient Dashboard — Insurance',
    category: 'Coverage cache',
    name: 'insurance_claim_* policy cache tables',
    code: 'insuranceclaims api: liquibase tables (policy/enrolment cache)',
    summary:
      'Last-known enrolment cached locally so the dashboard renders when the insurer is unreachable.',
    capdan: 'Relocate',
    targetLayer: 'Data',
    entry: 'ddn_coveragemaster',
    approach: 'Fold the cache into the shared coverage master.',
    rationale: 'A second, drift-prone copy of coverage truth.',
    why: {
      captured: 'Eligibility responses from the insurer',
      processed: 'Cached to module tables',
      validation: 'Staleness window only',
      location: 'insuranceclaims liquibase changesets',
      landsIn: 'Member, coverage & claims master schema',
    },
  },
  // Create Insurance Claim
  {
    id: 'dd_o_cc_form',
    app: A1,
    layer: 'UI',
    screen: 'Create Insurance Claim',
    category: 'Claim capture',
    name: 'Claim form from the encounter (visit type, diagnoses, items, guarantee no)',
    code: 'insuranceclaims omod: create-claim fragment',
    summary:
      'Claim pre-fills from the clinical encounter — diagnoses and consumed items arrive as defaults.',
    entry: 'ddn_claimform',
  },
  {
    id: 'dd_o_cc_bill',
    app: A1,
    layer: 'Business Service',
    screen: 'Create Insurance Claim',
    category: 'Amount calculation',
    name: 'Bill calculation from consumed items/services',
    code: 'insuranceclaims api: bill total = Σ(consumed × price)',
    summary:
      'Billable total derives from what the visit consumed; the clerk adjusts quantities, not totals.',
    entry: 'ddn_billcalc',
  },
  {
    id: 'dd_o_cc_fhirbuild',
    app: A1,
    layer: 'Integration',
    screen: 'Create Insurance Claim',
    category: 'Submission APIs',
    name: 'FHIR R4 Claim construction & POST to insurer',
    code: 'insuranceclaims api: ClaimBuilder → POST {fhir}/Claim',
    summary:
      'The claim serializes to a FHIR R4 Claim (patient, diagnoses, items) and posts to the external insurer.',
    entry: 'ddn_submit',
    why: {
      captured: 'Encounter-derived claim from the create form',
      sent: 'FHIR R4 Claim over HTTPS',
      processed: 'External insurer adjudicates',
      validation: 'FHIR profile + insurer-side rules',
      landsIn: 'FHIR R4 claim & eligibility APIs',
    },
  },
  {
    id: 'dd_o_cc_practitioner',
    app: A1,
    layer: 'Business Service',
    screen: 'Create Insurance Claim',
    category: 'Mapping rules',
    name: 'Provider/practitioner → FHIR Practitioner mapping',
    code: 'insuranceclaims api: practitioner reference mapping',
    summary:
      'The claiming clinician maps to a FHIR Practitioner reference the insurer can resolve.',
  },
  {
    id: 'dd_o_cc_schema',
    app: A1,
    layer: 'Data',
    screen: 'Create Insurance Claim',
    category: 'Claim schema',
    name: 'insurance_claim / insurance_claim_item tables',
    code: 'insuranceclaims api: liquibase insurance_claim, insurance_claim_item, insurance_claim_diagnosis',
    summary: 'Local claim header + line + diagnosis tables mirror what was sent to the insurer.',
    entry: 'ddn_claimschema',
  },
  {
    id: 'dd_o_cc_attach',
    app: A1,
    layer: 'UI',
    screen: 'Create Insurance Claim',
    category: 'Claim capture',
    name: 'Attachment of supporting documents to the claim',
    code: 'insuranceclaims omod: claim attachments (complex obs)',
    summary: 'Clinical documents ride along with the claim as attachments.',
    entry: 'ddn_attachments',
  },
  // Claim Status Tracker
  {
    id: 'dd_o_cs_list',
    app: A1,
    layer: 'UI',
    screen: 'Claim Status Tracker',
    category: 'Claim worklist',
    name: 'Submitted-claims list with external adjudication status',
    code: 'insuranceclaims omod: claim list page',
    summary: 'Facility-side view of every submitted claim and where the insurer has it.',
    entry: 'ddn_claimlist',
  },
  {
    id: 'dd_o_cs_poll',
    app: A1,
    layer: 'Integration',
    screen: 'Claim Status Tracker',
    category: 'Status APIs',
    name: 'FHIR ClaimResponse polling & status sync',
    code: 'insuranceclaims api: GET {fhir}/ClaimResponse?claim=…',
    summary: 'Statuses refresh by polling the insurer for ClaimResponse resources.',
    entry: 'ddn_statussync',
  },
  {
    id: 'dd_o_cs_map',
    app: A1,
    layer: 'Business Service',
    screen: 'Claim Status Tracker',
    category: 'Mapping rules',
    name: 'External outcome → module status mapping',
    code: 'insuranceclaims api: ClaimResponse.outcome → local enum',
    summary: 'Insurer outcomes normalize to the module’s local status vocabulary.',
  },
  // Claimed Items Review
  {
    id: 'dd_o_ci_grid',
    app: A1,
    layer: 'UI',
    screen: 'Claimed Items Review',
    category: 'Adjudication',
    name: 'Read-only line outcomes (approved vs requested qty/price)',
    code: 'insuranceclaims omod: claimed items page',
    summary: 'Provider-side view of what the insurer approved per line — no editing.',
    entry: 'ddn_lineoutcomes',
  },
  {
    id: 'dd_o_ci_groovy',
    app: A1,
    layer: 'Business Service',
    screen: 'Claimed Items Review',
    category: 'Legacy',
    name: 'Groovy claim-summary reporting script',
    code: 'insuranceclaims omod: legacy groovy report',
    summary:
      'Ad-hoc Groovy script duplicating the list page — nothing calls it from the UI anymore.',
    capdan: 'Eliminate',
    dead: true,
    status: 'Identified',
    approach: 'Delete with the migration.',
    rationale: 'Dead code; the list page owns this view.',
  },
  // Audit (infrastructure, screenless)
  {
    id: 'dd_o_audit',
    app: A1,
    layer: 'Infrastructure',
    screen: 'Claim Status Tracker',
    category: 'Audit',
    name: 'Claim action audit via OpenMRS event log',
    code: 'openmrs-core: event/audit log on claim create/submit',
    summary: 'Every claim action lands in the platform audit trail with user + location.',
    entry: 'ddn_audit',
  },
];

// openIMIS audit twin (screenless — recorded against the worklist screen).
IMIS.push({
  id: 'dd_i_audit',
  app: A0,
  layer: 'Infrastructure',
  screen: 'Health Facility Claims',
  category: 'Audit',
  name: 'Claim mutation audit (GraphQL mutation log)',
  code: 'openimis-be: core mutation log (tblMutationLog)',
  summary: 'Every claim mutation is journaled with user, time and payload.',
  entry: 'ddn_audit',
});

// ── Normalization entries (the REAL cross-app flow) ─────────────────────────
type E = {
  id: string;
  layer: Layer;
  notation: string;
  name: string;
  status: 'AUTO' | 'REVIEW' | 'HELD';
  basis?: string;
  note?: string;
  resolution?: string;
  cards?: { source: string; title: string; lines?: string[]; does?: string }[];
};

const ENTRIES: E[] = [
  {
    id: 'ddn_signin',
    layer: 'UI',
    notation: 'N-201',
    name: 'User sign-in',
    status: 'REVIEW',
    basis: 'Both apps authenticate with username + password on a dedicated screen.',
    note: 'OpenMRS additionally binds the session to a care location; openIMIS has no location context.',
    resolution:
      'Target keeps optional facility context on sign-in; insurer-side users sign in without one.',
    cards: [
      {
        source: 'openIMIS',
        title: 'LoginPage.js',
        lines: [
          'username — text',
          'password — masked',
          'language — en/fr',
          'forgot password — link',
        ],
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'login.gsp',
        lines: ['username — text', 'password — masked', 'session location — REQUIRED pick'],
      },
    ],
  },
  {
    id: 'ddn_session',
    layer: 'Infrastructure',
    notation: 'N-202',
    name: 'Session & permission model',
    status: 'HELD',
    note: 'openIMIS gates on integer rights codes (e.g. 101002); OpenMRS uses named string privileges plus a session location. The vocabularies do not map 1:1.',
    resolution:
      'Adopt role→named-permission model in shared IAM; generate a compatibility map for openIMIS rights codes during migration.',
    cards: [
      {
        source: 'openIMIS',
        title: 'JWT + rights',
        does: 'JWT carries numeric rights; UI menus test right codes client-side.',
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'UserContext',
        does: 'Server session holds named privileges and the chosen care location.',
      },
    ],
  },
  {
    id: 'ddn_membersearch',
    layer: 'UI',
    notation: 'N-203',
    name: 'Member / patient search',
    status: 'REVIEW',
    basis:
      'Both expose a primary search screen over the person registry with identifier + name lookup.',
    note: 'openIMIS filters a paginated grid on demand; OpenMRS searches as-you-type and offers a recent-patients strip.',
    resolution:
      'Target adopts incremental search with a recents strip; grid filters remain for back-office bulk work.',
    cards: [
      {
        source: 'openIMIS',
        title: 'InsureeSearcher.js',
        lines: ['CHF ID — 12-char', 'last/other names', 'gender, DOB', 'page size 10/20/50/100'],
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'findpatient app',
        lines: ['free text — name or ID', 'as-you-type results', 'recent patients strip'],
      },
    ],
  },
  {
    id: 'ddn_idvalidation',
    layer: 'Business Service',
    notation: 'N-204',
    name: 'Member identifier validation',
    status: 'REVIEW',
    basis: 'Both validate the person identifier with a checksum before any workflow proceeds.',
    note: 'CHF ID uses a 12-char configurable checksum; OpenMRS ID uses Luhn Mod-30. Different alphabets and check algorithms.',
    resolution:
      'Target validates per identifier TYPE — both algorithms register in one identifier service.',
    cards: [
      {
        source: 'openIMIS',
        title: 'chf_id validation',
        does: 'Length + checksum on the 12-char CHF ID (config chfIdMaxLength).',
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'LuhnMod30IdentifierValidator',
        does: 'Base-30 Luhn check digit on the OpenMRS ID.',
      },
    ],
  },
  {
    id: 'ddn_membermaster',
    layer: 'Data',
    notation: 'N-205',
    name: 'Person / member master',
    status: 'REVIEW',
    basis: 'Both persist a person registry that claims reference.',
    note: 'openIMIS: tblInsuree keyed by CHFID with tblFamilies grouping. OpenMRS: patient + patient_identifier with typed identifiers, no family construct.',
    resolution:
      'Master keeps person + typed identifiers; family/group becomes an explicit relationship aggregate.',
    cards: [
      {
        source: 'openIMIS',
        title: 'tblInsuree / tblFamilies',
        lines: ['CHFID — unique', 'FamilyID — FK', 'photo, DOB, gender', 'head-of-family flag'],
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'patient / patient_identifier',
        lines: [
          'identifier — typed (OpenMRS ID…)',
          'person_name, birthdate',
          'no family aggregate',
        ],
      },
    ],
  },
  {
    id: 'ddn_coveragepanel',
    layer: 'UI',
    notation: 'N-206',
    name: 'Coverage & eligibility panel',
    status: 'AUTO',
    basis:
      'Same six data points on both sides: member, photo/context, policy number, status, expiry, remaining balance — matched field for field.',
    cards: [
      {
        source: 'openIMIS',
        title: 'EnquiryDialog.js',
        lines: ['photo', 'family & product', 'policy status + expiry', 'remaining ceiling'],
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'Insurance dashboard widget',
        lines: ['patient banner', 'policy number', 'enrolment status + expiry', 'balance'],
      },
    ],
  },
  {
    id: 'ddn_eligquery',
    layer: 'Integration',
    notation: 'N-207',
    name: 'Eligibility query to the insurer',
    status: 'REVIEW',
    basis: 'Both resolve coverage from the insurer’s policy engine at point of use.',
    note: 'openIMIS answers natively over GraphQL; OpenMRS round-trips FHIR CoverageEligibilityRequest to the same engine.',
    resolution:
      'One FHIR CoverageEligibility API — openIMIS’ native GraphQL becomes an internal detail behind it.',
    cards: [
      {
        source: 'openIMIS',
        title: 'policy_qgl',
        does: 'GraphQL eligibility(chfId, item/service) straight into the native rules engine.',
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'FhirRequestClient',
        does: 'FHIR R4 CoverageEligibilityRequest/Response over HTTPS to the insurer.',
      },
    ],
  },
  {
    id: 'ddn_claimform',
    layer: 'UI',
    notation: 'N-208',
    name: 'Claim entry form',
    status: 'REVIEW',
    basis:
      'Both capture the same claim: member, visit type, diagnoses, item/service lines, attachments.',
    note: 'openIMIS is form-first (manual claim code ≤8, hand-picked lines from pricelists); OpenMRS is encounter-first (lines and diagnoses pre-fill from the visit).',
    resolution:
      'Target is encounter-first with manual fallback; claim number always system-generated.',
    cards: [
      {
        source: 'openIMIS',
        title: 'ClaimForm.js',
        lines: [
          'claim code — ≤8 chars (auto opt.)',
          'visit type — Emergency/Referral/Other',
          'ICD main + 4 secondary',
          'services & items — qty × price',
        ],
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'create-claim fragment',
        lines: [
          'visit — from encounter',
          'diagnoses — pre-filled',
          'consumed items — pre-filled',
          'guarantee no, explanation',
        ],
      },
    ],
  },
  {
    id: 'ddn_billcalc',
    layer: 'Business Service',
    notation: 'N-209',
    name: 'Claim amount calculation',
    status: 'AUTO',
    basis:
      'Both compute the claimed total as Σ(quantity × unit price) over the lines — totals are never hand-entered.',
    cards: [
      {
        source: 'openIMIS',
        title: 'claimed amount',
        does: 'Σ over tblClaimItems + tblClaimServices at entry and on submit.',
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'bill calculation',
        does: 'Σ over consumed items/services priced from the concept catalog.',
      },
    ],
  },
  {
    id: 'ddn_attachments',
    layer: 'UI',
    notation: 'N-210',
    name: 'Claim attachments',
    status: 'AUTO',
    basis: 'Both attach supporting documents to a claim before submission.',
    cards: [
      {
        source: 'openIMIS',
        title: 'ClaimAttachmentsDialog',
        does: 'File uploads bound to the claim record.',
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'complex obs attachments',
        does: 'Documents stored as complex observations linked to the claim.',
      },
    ],
  },
  {
    id: 'ddn_submit',
    layer: 'Integration',
    notation: 'N-211',
    name: 'Submit claim to insurer',
    status: 'HELD',
    note: 'Same business act, two protocols: openIMIS submits via native GraphQL mutations; OpenMRS posts a FHIR R4 Claim. Field coverage differs (FHIR carries practitioner + coded diagnoses; GraphQL carries claim admin + batch context).',
    resolution:
      'Converge on FHIR R4 Claim as the only submission API; native mutations retire after parity checks.',
    cards: [
      {
        source: 'openIMIS',
        title: 'claim_qgl mutations',
        lines: ['createClaim / submitClaims', 'claim admin + officer', 'batch context'],
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'POST {fhir}/Claim',
        lines: ['FHIR R4 Claim resource', 'Practitioner reference', 'coded diagnoses + items'],
      },
    ],
  },
  {
    id: 'ddn_claimschema',
    layer: 'Data',
    notation: 'N-212',
    name: 'Claim & line-item schema',
    status: 'REVIEW',
    basis: 'Both persist claim header + line items + diagnoses.',
    note: 'Column-level map: ClaimCode↔claim uuid/code, DateFrom/DateTo↔period, tblClaimItems/Services↔insurance_claim_item(kind), Status↔status+outcome. openIMIS splits items vs services into two tables; OpenMRS uses one line table with a kind column.',
    resolution:
      'Master schema keeps one line table with a type discriminator; approved qty/price columns carried from openIMIS.',
    cards: [
      {
        source: 'openIMIS',
        title: 'tblClaim + 2 line tables',
        lines: [
          'tblClaim: ClaimCode, DateFrom/To, Status',
          'tblClaimItems: qty, price, approved',
          'tblClaimServices: qty, price, approved',
        ],
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'insurance_claim + items',
        lines: [
          'insurance_claim: uuid, period, status',
          'insurance_claim_item: kind, qty, price',
          'insurance_claim_diagnosis',
        ],
      },
    ],
  },
  {
    id: 'ddn_claimlist',
    layer: 'UI',
    notation: 'N-213',
    name: 'Claims worklist with status',
    status: 'AUTO',
    basis:
      'Both list the facility’s claims with a per-claim pipeline status — matched on purpose, columns and status semantics.',
    cards: [
      {
        source: 'openIMIS',
        title: 'ClaimSearcher.js',
        lines: ['status chips Entered→Valuated', 'facility scope', 'batch multi-select'],
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'claim list page',
        lines: ['external adjudication status', 'facility scope', 'per-claim drill-down'],
      },
    ],
  },
  {
    id: 'ddn_statussync',
    layer: 'Integration',
    notation: 'N-214',
    name: 'Claim status retrieval',
    status: 'AUTO',
    basis:
      'Both surface the insurer’s adjudication state to the facility; OpenMRS polls FHIR ClaimResponse, openIMIS reads its own tblClaim status — one API in the target.',
    cards: [
      {
        source: 'openIMIS',
        title: 'native status',
        does: 'Status lives in tblClaim; the UI reads it directly.',
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'ClaimResponse polling',
        does: 'GET ClaimResponse?claim=… and map outcome → local status.',
      },
    ],
  },
  {
    id: 'ddn_lineoutcomes',
    layer: 'UI',
    notation: 'N-215',
    name: 'Line-item outcome grid',
    status: 'HELD',
    note: 'openIMIS EDITS line outcomes (insurer-side adjudication); OpenMRS only READS them (provider-side). Same grid, opposite writability.',
    resolution:
      'Split by audience in the target: adjudication edit grid stays insurer-side; provider portal gets the read-only outcome view.',
    cards: [
      {
        source: 'openIMIS',
        title: 'review grid (edit)',
        lines: ['approve qty/price per line', 'rejection reason codes', 'valuation preview'],
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'claimed items (read)',
        lines: ['approved vs requested', 'per-line outcome badge'],
      },
    ],
  },
  {
    id: 'ddn_coveragemaster',
    layer: 'Data',
    notation: 'N-216',
    name: 'Coverage / policy source of truth',
    status: 'REVIEW',
    basis: 'Both hold policy state the claim flow depends on.',
    note: 'openIMIS tblPolicy/tblPremium IS the source of truth; the OpenMRS module keeps a local cache that can go stale.',
    resolution:
      'Coverage master lives insurer-side only; provider side reads through the eligibility API with a bounded cache TTL.',
    cards: [
      {
        source: 'openIMIS',
        title: 'tblPolicy / tblPremium',
        does: 'Policy value vs contributions decides activation; expiry drives eligibility.',
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'insurance_claim_* cache',
        does: 'Last-known enrolment cached locally for offline rendering.',
      },
    ],
  },
  {
    id: 'ddn_audit',
    layer: 'Infrastructure',
    notation: 'N-217',
    name: 'Claim action audit trail',
    status: 'AUTO',
    basis:
      'Both journal every claim action with user and timestamp — merged into one audit stream.',
    cards: [
      {
        source: 'openIMIS',
        title: 'tblMutationLog',
        does: 'GraphQL mutation journal with payloads.',
      },
      {
        source: 'OpenMRS Insurance Claims',
        title: 'platform event log',
        does: 'Audit events with user + session location.',
      },
    ],
  },
];

// ── Apply ────────────────────────────────────────────────────────────────────
const ws = await prisma.rationalizationWorkspace.findFirstOrThrow({
  where: { id: WS },
  select: { tenantId: true, companyId: true },
});
const { tenantId, companyId } = ws;

await prisma.rationalizationCapability.deleteMany({ where: { workspaceId: WS } });
await prisma.normalizationEntry.deleteMany({ where: { workspaceId: WS } });
await prisma.screenAsset.deleteMany({ where: { workspaceId: WS } });

await prisma.screenAsset.createMany({
  data: SCREENS.map((s) => ({
    id: `dds_${s.slug}`,
    tenantId,
    companyId,
    workspaceId: WS,
    appId: s.app,
    name: s.name,
    kind: s.kind ?? 'SCREEN',
    url: `/screens/${s.slug}.png`,
  })),
});

let sort = 0;
await prisma.normalizationEntry.createMany({
  data: ENTRIES.map((e) => ({
    id: e.id,
    tenantId,
    companyId,
    workspaceId: WS,
    layer: e.layer,
    notation: e.notation,
    name: e.name,
    matchStatus: e.status,
    matchBasis: e.basis ?? null,
    differenceNote: e.note ?? null,
    proposedResolution: e.resolution ?? null,
    sourceCards: e.cards ?? undefined,
    componentId: COMP[e.layer],
    sortOrder: sort++,
    illustrative: false,
  })),
});

const FINDINGS = [...IMIS, ...OMRS];
await prisma.rationalizationCapability.createMany({
  data: FINDINGS.map((f) => ({
    id: f.id,
    tenantId,
    companyId,
    workspaceId: WS,
    appId: f.app,
    layer: f.layer,
    name: f.name,
    category: f.category,
    view: f.view ?? 'COMPONENT',
    screenRef: f.screen,
    plainSummary: f.summary,
    capdan: f.capdan ?? 'Common',
    targetLayer: f.targetLayer ?? null,
    treatment: f.capdan === 'Eliminate' ? 'Eliminate' : 'Retain',
    migrationStatus: f.status ?? 'In Analysis',
    componentId: f.capdan === 'Eliminate' || f.capdan === 'Relocate' ? null : COMP[f.layer],
    codeRef: f.code,
    migrationApproach: f.approach ?? null,
    rationale: f.rationale ?? null,
    effort: f.effort ?? 'M',
    complexity: f.complexity ?? 'Medium',
    normalizationEntryId: f.entry ?? null,
    deadCode: f.dead ?? false,
    whyThisMoves: f.why ?? undefined,
    illustrative: false,
  })),
});

await prisma.rationalizationApp.update({
  where: { id: A0 },
  data: {
    techStack:
      'React 16 + Material-UI FE modules · Django/GraphQL backend (openimis-be_py) · MSSQL/PostgreSQL',
    description:
      'Insurer-side IMIS: insuree & family register, policies/products, claim entry, review, valuation and feedback.',
  },
});
await prisma.rationalizationApp.update({
  where: { id: A1 },
  data: {
    techStack:
      'OpenMRS 2.x reference application · Java/Spring omod module · Hibernate/MySQL · FHIR R4 client',
    description:
      'Provider-side EMR module: enrolment check at registration, encounter-driven claim creation, FHIR submission and status tracking.',
  },
});

const counts = {
  screens: await prisma.screenAsset.count({ where: { workspaceId: WS } }),
  findings: await prisma.rationalizationCapability.count({ where: { workspaceId: WS } }),
  entries: await prisma.normalizationEntry.count({ where: { workspaceId: WS } }),
  shared: ENTRIES.length,
};
console.log(counts);
await prisma.$disconnect();
