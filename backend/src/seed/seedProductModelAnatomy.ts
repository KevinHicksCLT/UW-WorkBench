// ── Product-model anatomy catalog (PM-02) ──
// The reference taxonomy for Product Model Rationalization: for each of the
// 11 product components × 3 scopes (COMMON | SEGMENT | GEOGRAPHY), the named
// sub-categories that belong there — insurance-domain-real (actual form
// numbers, statutes, bureaus, thresholds), mirroring seedAnatomyCatalog.ts
// (WR-06) including the BEHAVIOR and MISPLACED views. `slug` is the stable
// SKOS concept id (tbi:pma-<slug>) used by the taxonomy exporter and the
// semantic matcher. Idempotent: rows are replaced wholesale per company.
import type { PrismaClient } from '@prisma/client';
import { PRODUCT_COMPONENTS, type ProductComponent } from './seedWorkspaceVocabulary.js';

export type AnatomyScope = 'COMMON' | 'SEGMENT' | 'GEOGRAPHY';
export type AnatomyView = 'COMPONENT' | 'BEHAVIOR' | 'MISPLACED';

type Row = {
  name: string;
  description: string;
  view?: AnatomyView; // defaults to COMPONENT
  recommendedComponent?: ProductComponent; // MISPLACED rows: where it belongs
};
type Cell = Record<AnatomyScope, Row[]>;

// Stable kebab-case slug per component — also the SKOS top-concept id
// (tbi:pm-<component-slug>, plan §6.3).
export const COMPONENT_SLUGS: Record<ProductComponent, string> = {
  'Party & Roles': 'party-roles',
  'Product Hierarchy': 'product-hierarchy',
  'Coverage & Perils': 'coverage-perils',
  'Limits & Deductibles': 'limits-deductibles',
  'Rating & Pricing': 'rating-pricing',
  'Forms & Wordings': 'forms-wordings',
  'Eligibility & UW Rules': 'eligibility-uw-rules',
  'Exposures & Schedules': 'exposures-schedules',
  'Reinsurance & Layering': 'reinsurance-layering',
  'Regulatory & Filings': 'regulatory-filings',
  Distribution: 'distribution',
};

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('-');

// Compact row constructors.
const r = (name: string, description: string): Row => ({ name, description });
const b = (name: string, description: string): Row => ({ name, description, view: 'BEHAVIOR' });
const m = (name: string, description: string, recommendedComponent: ProductComponent): Row => ({
  name,
  description,
  view: 'MISPLACED',
  recommendedComponent,
});

const CATALOG: Record<ProductComponent, Cell> = {
  'Party & Roles': {
    COMMON: [
      r(
        'Named insured',
        'The party whose insurable interest the contract covers; anchors all other roles.',
      ),
      r(
        'Additional named insured',
        'Further parties sharing full policy rights, e.g. co-owners or affiliated entities.',
      ),
      r(
        'Applicant',
        'The party requesting coverage during quote/submission, before a policy exists.',
      ),
      r(
        'Beneficiary',
        'The party entitled to proceeds (life/annuity primary and contingent designations).',
      ),
      r(
        'Producer of record',
        'The agent/broker credited with the account; controls servicing and commission.',
      ),
      r(
        'Premium payer',
        'The party billed for premium — may differ from the insured (e.g. employer, financing company).',
      ),
      r(
        'Loss payee',
        'A party paid first on covered property losses, typically an equipment lender.',
      ),
      r(
        'Additional interest',
        'A party notified of policy events without coverage rights, e.g. a landlord.',
      ),
      r(
        'Mortgagee',
        'The lender on real property, with standard mortgage-clause rights on property losses.',
      ),
      r('Lienholder', 'The secured lender on titled vehicles or equipment paid on total losses.'),
      r(
        'Claimant',
        'A first- or third-party asserting damages; linked to claims but defined by the product model.',
      ),
      r(
        'Third-party administrator (TPA)',
        'A delegated servicing party for claims or policy administration.',
      ),
      b(
        'Party deduplication & householding',
        'Matching and merging duplicate parties across sources; grouping household members.',
      ),
      b(
        'Sanctions screening at bind',
        'OFAC/OFSI list screening of all parties before a contract is formed.',
      ),
      m(
        'Producer commission percentages on party records',
        'Commission terms belong to the distribution agreement, not the person.',
        'Distribution',
      ),
      m(
        'Rate modifiers keyed to party type',
        'Party attributes may feed rating, but the factors themselves are pricing content.',
        'Rating & Pricing',
      ),
    ],
    SEGMENT: [
      r(
        'First named insured',
        'Commercial convention: the first named insured holds notice, cancellation and audit duties.',
      ),
      r(
        'Officers & directors schedule',
        'Large commercial: named executives for D&O sides A/B/C and WC officer inclusion/exclusion.',
      ),
      r(
        'Certificate holder',
        'Commercial GL/WC: parties issued ACORD 25 certificates of insurance as evidence.',
      ),
      r('Named driver', 'Personal auto: rated household drivers listed on the declarations.'),
      r(
        'Excluded driver',
        'Personal auto: household members formally excluded by endorsement (e.g. CA named-driver exclusion).',
      ),
      r(
        'Household member roster',
        'Personal lines: resident relatives who are insureds by definition, not by listing.',
      ),
      r('Key person', 'SMB life/disability: the employee whose loss the business insures against.'),
      r(
        "Lloyd's coverholder",
        'London market: the delegated authority writing on behalf of a syndicate under a binder.',
      ),
      r(
        'Group master policyholder',
        'Benefits: the employer/association holding the master contract; members hold certificates.',
      ),
    ],
    GEOGRAPHY: [
      r(
        'Community-property spouse',
        'US community-property states: spouses hold automatic insurable interest in shared assets.',
      ),
      r(
        'Registered keeper',
        'UK motor: the DVLA registered keeper is a distinct role from owner and policyholder.',
      ),
      r(
        'Data protection contact (GDPR)',
        'EU: a designated contact for data-subject requests tied to policyholder records.',
      ),
      r(
        'Monopolistic state-fund employer account',
        'OH/WA/WY/ND: the WC "insurer" role is the state fund, not a carrier.',
      ),
      r(
        'Attorney-in-fact',
        'Reciprocal exchanges (common in US West): the management entity acting for subscribers.',
      ),
      r(
        'FATCA/CRS payee tax status',
        'Cross-border payees carry W-8/W-9 or CRS self-certification status.',
      ),
      r(
        'Quebec French-language correspondent',
        'Canada-QC: Bill 96 requires French-first party communications.',
      ),
      r(
        'EU representative for non-EU insureds',
        'Freedom-of-services business: a local fiscal/legal representative role.',
      ),
    ],
  },
  'Product Hierarchy': {
    COMMON: [
      r(
        'Line of business',
        'The top grouping (auto, property, GL, WC, life, annuity) aligned to statutory reporting lines.',
      ),
      r(
        'Product family',
        'Marketing/actuarial grouping under a line, e.g. "Commercial Package" or "Term Life".',
      ),
      r(
        'Product / program',
        'The sellable definition a policy instantiates, with its own rates, rules and forms.',
      ),
      r(
        'Plan / variant',
        'A configuration of the product (tier, package level) sharing the same filings.',
      ),
      r(
        'Coverage part',
        'The modular building block a package assembles (GL part, property part, auto part).',
      ),
      r(
        'Package vs monoline indicator',
        'Whether the product bundles multiple coverage parts or writes one.',
      ),
      r(
        'Product version & effective dating',
        'Versioned definitions with new/renewal effective dates per change.',
      ),
      r(
        'Lifecycle status',
        'Draft, filed, approved, live, closed-to-new, withdrawn — with the dates of each transition.',
      ),
      r('Rate book linkage', 'Which rate manual edition each product version rates against.'),
      r('Form portfolio linkage', 'Which form editions each product version attaches.'),
      r(
        'Successor-product mapping',
        'Where renewals land when a product is withdrawn or replaced.',
      ),
      r(
        'Statistical code taxonomy',
        'NAIC annual-statement line and stat-plan codes each product maps to.',
      ),
      b(
        'Version cloning & promotion',
        'Copying a product version, amending it, and promoting it with effective dating.',
      ),
      b(
        'Withdrawal & renewal-rights handling',
        'Closing to new business while honoring renewal obligations by state.',
      ),
      m(
        'State availability rules on hierarchy nodes',
        'Jurisdiction availability is a filing outcome, not a structural attribute.',
        'Regulatory & Filings',
      ),
      m(
        'Commission schedule keyed to product nodes',
        'Producer economics belong to distribution agreements.',
        'Distribution',
      ),
    ],
    SEGMENT: [
      r(
        'Commercial package (CPP) part structure',
        'ISO CPP: independent coverage parts under one policy with shared declarations.',
      ),
      r(
        'BOP bundled structure',
        'SMB: property + liability pre-bundled with simplified class rating (businessowners).',
      ),
      r(
        'Personal auto tier structure',
        'Preferred/standard/non-standard companies or tiers within one program.',
      ),
      r(
        'Umbrella over-underlying structure',
        'The umbrella product references required underlying policies and limits.',
      ),
      r(
        'MGA program shell',
        'Program business: a carrier product shell configured per managing general agent.',
      ),
      r(
        "Lloyd's binder section structure",
        'London market: binder sections by class with their own limits and TSI caps.',
      ),
      r(
        'Group master + certificate structure',
        'Benefits: one master contract generating member certificates.',
      ),
      r(
        'Association / franchise programs',
        'Endorsed programs with association-specific variants of a base product.',
      ),
    ],
    GEOGRAPHY: [
      r(
        '50-state product matrix',
        'Per-state availability, edition and deviation tracking for one logical product.',
      ),
      r(
        'IIPRC compact products',
        'Life/annuity products filed once through the Interstate Compact vs state-by-state.',
      ),
      r(
        'Admitted vs surplus-lines split',
        'The same risk appetite offered as admitted product or E&S paper.',
      ),
      r(
        'Solvency II line mapping',
        'EU: products mapped to Solvency II lines of business for QRT reporting.',
      ),
      r(
        'IDD product-governance family',
        'UK/EU: POG target-market definitions grouped at product-family level.',
      ),
      r(
        'Canadian province variants',
        'Provincial auto regimes (e.g. ON OAP 1, BC ICBC interplay) as product variants.',
      ),
      r(
        'Local statutory bundles',
        'Mandatory local covers bundled in, e.g. France Cat Nat on property policies.',
      ),
      r(
        'Takaful window products',
        'Shariah-compliant variants operated alongside conventional products.',
      ),
    ],
  },
  'Coverage & Perils': {
    COMMON: [
      r(
        'Coverage / peril catalog',
        'The master list of coverages and covered perils a product can grant.',
      ),
      r(
        'Insuring agreement',
        'The core promise: who/what is covered, for which losses, on what trigger.',
      ),
      r(
        'Named perils vs open perils',
        'Whether covered causes of loss are enumerated or all-risk with exclusions.',
      ),
      r(
        'Exclusions',
        'Carve-outs from the insuring agreement (e.g. wear and tear, intentional acts, war).',
      ),
      r(
        'Coverage extensions',
        'Automatic add-ons of the base form, e.g. debris removal, newly acquired property.',
      ),
      r(
        'Optional endorsements catalog',
        'Elective coverage modifications available to attach for premium.',
      ),
      r(
        'Valuation basis',
        'ACV, replacement cost, agreed value, functional replacement — per coverage.',
      ),
      r(
        'Coverage trigger',
        'Occurrence vs claims-made (with retro dates and extended reporting periods).',
      ),
      r(
        'Defense costs treatment',
        'Whether defense erodes limits (inside) or is in addition (outside).',
      ),
      r(
        'Waiting periods',
        'Time thresholds before time-element coverages respond (e.g. 72-hour BI wait).',
      ),
      r('Coverage territory', 'The geographic scope clause of each coverage grant.'),
      r('Sub-coverages', 'Nested grants with their own terms, e.g. spoilage under property.'),
      b(
        'Coverage compatibility validation',
        'Prerequisite/conflict checks when coverages are combined on one policy.',
      ),
      b(
        'Endorsement attach/detach with effective dating',
        'Mid-term coverage changes producing the correct in-force picture.',
      ),
      m(
        'Rate factors embedded in coverage text',
        'Premium-bearing factors belong in the rate manual, not the wording.',
        'Rating & Pricing',
      ),
      m(
        'State-mandated variations hardcoded in base coverage',
        'Jurisdictional deviations belong with amendatory filings.',
        'Regulatory & Filings',
      ),
    ],
    SEGMENT: [
      r(
        'Hired & non-owned auto (CA 20 01)',
        'SMB: the endorsement adding hired/non-owned auto liability to a BAP or BOP.',
      ),
      r(
        'Business income & extra expense',
        'Commercial property: time-element coverage with period-of-restoration mechanics.',
      ),
      r(
        'Cyber first-party / third-party modules',
        'Breach response, business interruption, media and network liability grants.',
      ),
      r(
        'D&O Side A / B / C structure',
        'Large commercial: individual, reimbursement and entity coverage sides.',
      ),
      r(
        'UM/UIM stacking options',
        'Personal auto: uninsured/underinsured motorist limits and stacking elections.',
      ),
      r(
        'HO-3 vs HO-5 peril sets',
        'Personal lines: open-peril dwelling with named-peril vs open-peril contents.',
      ),
      r(
        'Equipment breakdown add-on',
        'SMB: mechanical/electrical breakdown coverage replacing old boiler & machinery.',
      ),
      r(
        'Employment practices liability',
        'SMB endorsement vs standalone EPL with defense-inside limits.',
      ),
      r(
        'War & strikes clauses',
        'Marine/London market: institute clauses adding or excluding war/SRCC perils.',
      ),
    ],
    GEOGRAPHY: [
      r(
        'Windstorm/hail percentage-deductible perils',
        'Coastal states: named-storm and wind/hail perils carved to % deductibles.',
      ),
      r(
        'Earthquake cover variants',
        'CA mini-policy standards, NZ EQC first-layer interplay, JP quake riders.',
      ),
      r(
        'Flood carve-out to NFIP',
        'US: flood excluded on homeowners and written through the National Flood Insurance Program.',
      ),
      r(
        'Terrorism certification',
        'US TRIA certified-act coverage offer vs UK Pool Re participation.',
      ),
      r(
        'UK subsidence peril',
        'UK property: subsidence/heave/landslip as a standard peril with its own deductible.',
      ),
      r(
        'EU natural-catastrophe pools',
        'FR Cat Nat, ES Consorcio, CH cantonal schemes replacing private peril grants.',
      ),
      r(
        'No-fault PIP medical benefits',
        'US no-fault states: statutory personal injury protection grants (e.g. MI unlimited-electable PIP).',
      ),
      r(
        'Civil-law liability wording differences',
        'QC/EU: liability grants restated for civil-code regimes.',
      ),
    ],
  },
  'Limits & Deductibles': {
    COMMON: [
      r('Per-occurrence limit', 'The maximum paid for one occurrence/claim under a coverage.'),
      r(
        'Aggregate limit',
        'The policy-period cap across all occurrences (general vs products/completed ops).',
      ),
      r('Sub-limits', 'Lower caps inside a grant, e.g. $25k for money & securities under crime.'),
      r(
        'Split vs combined single limits',
        'Auto liability expressed per person/per accident/PD or as one CSL.',
      ),
      r('Flat deductible', 'A fixed dollar amount the insured retains per loss.'),
      r('Percentage deductible', 'Retention as % of TIV or limit, typical for wind/quake.'),
      r(
        'Self-insured retention (SIR)',
        'Insured-managed retention beneath the policy that must be exhausted first.',
      ),
      r(
        'Franchise deductible',
        'No payment below the threshold, full payment above it (marine heritage).',
      ),
      r(
        'Waiting-period deductible',
        'Time-based retention for time-element covers (hours, not dollars).',
      ),
      r(
        'Application order rules',
        'How deductibles, sub-limits and limits interact and in which order.',
      ),
      r('Aggregate erosion tracking', 'Running exhaustion of aggregates by paid loss and expense.'),
      r('Coinsurance clause', 'Insurance-to-value penalty mechanics on property coverages.'),
      b(
        'Tower gap & adequacy checking',
        'Detecting gaps/overlaps across primary, umbrella and excess layers.',
      ),
      b(
        'Aggregate exhaustion & reinstatement',
        'Applying reinstatement provisions when aggregates exhaust.',
      ),
      m(
        'ITV valuation calculations stored with limits',
        'Insurance-to-value derivation belongs with exposures and schedules.',
        'Exposures & Schedules',
      ),
      m(
        'Deductible credits expressed as rate factors',
        'The premium effect of a deductible is rate-manual content.',
        'Rating & Pricing',
      ),
    ],
    SEGMENT: [
      r(
        'Fixed deductible tiers (SMB)',
        'Simple menus like $500 / $1,000 / $2,500 across property coverages.',
      ),
      r(
        'Layered excess towers',
        'Large commercial: primary + excess layers with attachment points to $100M+.',
      ),
      r('Quota-share within a layer', 'Multiple carriers sharing one layer by percentage.'),
      r(
        "Lloyd's line size & order %",
        'Subscription market: each syndicate takes a signed line of the order.',
      ),
      r(
        'Personal lines deductible menu',
        'Standard homeowner/auto options with wind/hail split-outs.',
      ),
      r(
        'Wind % deductible by TIV band',
        'Coastal commercial property: 2/3/5% options scaled to insured values.',
      ),
      r(
        'Maintenance deductible under excess',
        'A retained amount that continues within an excess layer.',
      ),
      r(
        'Corridor retention (programs)',
        'Program business: an MGA-retained loss corridor between layers.',
      ),
    ],
    GEOGRAPHY: [
      r(
        'State minimum auto liability limits',
        'Financial-responsibility minima, e.g. NY 25/50/10 vs CA 30/60/15 (2025).',
      ),
      r(
        'UK motor unlimited BI',
        'UK: third-party bodily injury is unlimited by law; property capped (£1.2M).',
      ),
      r(
        'EU green-card compulsory minima',
        'Cross-border motor: directive minimum limits per member state.',
      ),
      r(
        'Hurricane deductible triggers',
        'State-defined named-storm windows that switch the % deductible on.',
      ),
      r(
        'CA earthquake deductible norms',
        '10–25% CEA-style deductibles with dwelling/contents splits.',
      ),
      r(
        'WC statutory (unlimited) limits',
        'US workers comp Part One has no dollar limit; employers liability is capped.',
      ),
      r(
        'NFIP maximum limits',
        'US flood: $250k building / $100k contents residential caps drive excess flood.',
      ),
      r(
        'Umbrella drop-down rules',
        'Jurisdiction-specific rules on when the umbrella drops down over exhausted underlying.',
      ),
    ],
  },
  'Rating & Pricing': {
    COMMON: [
      r('Base rates', 'The per-exposure-unit starting rates by class and coverage.'),
      r(
        'Rate order of calculation',
        'The algorithm: which factors apply, in what order, with what rounding.',
      ),
      r(
        'Rating factors & relativities',
        'Multiplicative/additive factors (territory, class, limit, deductible credits).',
      ),
      r('Minimum premium', 'The floor the policy premium cannot go below, per policy or coverage.'),
      r(
        'Fees & surcharges',
        'Policy fees, inspection fees, installment fees itemized outside premium.',
      ),
      r('Rounding rules', 'Where rounding happens in the algorithm (per step vs final).'),
      r('Short-rate & pro-rata tables', 'Cancellation return-premium computation methods.'),
      r('Premium audit provisions', 'Estimated vs audited exposure true-ups (payroll, sales).'),
      r('Experience modification', 'Loss-history-based debits/credits, e.g. WC e-mod.'),
      r(
        'Schedule rating credits/debits',
        'Judgment modifications within filed ranges (e.g. ±25%).',
      ),
      r(
        'Rate capping / transition rules',
        'Renewal premium change caps smoothing rate-revision impacts.',
      ),
      r('Installment payment plan factors', 'Pay-plan loadings and per-installment fee schedules.'),
      b(
        'Effective-date rate resolution',
        'Selecting the correct rate edition for new, renewal and endorsement dates.',
      ),
      b('Delta premium on endorsement', 'Recomputing and prorating premium for mid-term changes.'),
      m(
        'Eligibility knock-outs inside the rate routine',
        'Acceptability is an underwriting decision, not a rating step.',
        'Eligibility & UW Rules',
      ),
      m(
        'Producer commission inside premium calculation',
        'Commission is distribution economics, netted after premium.',
        'Distribution',
      ),
    ],
    SEGMENT: [
      r(
        'ISO loss costs + LCM',
        'Commercial: bureau loss costs multiplied by the carrier loss-cost multiplier.',
      ),
      r(
        'NCCI class codes & e-mod',
        'WC: 4-digit class rates with experience modification factors.',
      ),
      r('Telematics / UBI factors', 'Personal auto: driving-behavior scores feeding rating tiers.'),
      r(
        'Credit-based insurance score',
        'Personal lines factor where permitted (banned in CA/MA/HI).',
      ),
      r(
        'Composite rating',
        'Large commercial: one rate per composite exposure base across coverages.',
      ),
      r(
        'Retrospective rating plans',
        'National accounts: premium adjusted by actual losses within min/max.',
      ),
      r('BOP class rating', 'SMB: simplified whole-dollar class rates instead of ISO CGL rating.'),
      r('Judgment / A-rating', 'Specialty: underwriter-set rates where no manual rate exists.'),
      r(
        'Burning-cost rating',
        'London market: rate derived from the account’s historical loss burn.',
      ),
    ],
    GEOGRAPHY: [
      r(
        'State rate filings & effective dates',
        'Prior-approval vs file-and-use vs use-and-file regimes per state.',
      ),
      r(
        'CA Prop 103 prior approval',
        'California: rates need DOI approval; factors restricted by regulation.',
      ),
      r('Territory definitions', 'Filed territory boundary sets (zip, county) per state.'),
      r(
        'Cat-model load by region',
        'Modeled AAL loadings for wind/quake/wildfire embedded per territory.',
      ),
      r(
        'State taxes & surcharges in rating',
        'FL FHCF assessments, second-injury funds, fire marshal taxes.',
      ),
      r('UK IPT', 'Insurance premium tax at 12% standard rate applied at quote.'),
      r('German insurance tax', '19% Versicherungsteuer collected with premium (varies by line).'),
      r(
        'FCA GI pricing rules',
        'UK: renewal price must not exceed equivalent new-business price (price-walking ban).',
      ),
    ],
  },
  'Forms & Wordings': {
    COMMON: [
      r(
        'Declarations & policy jacket',
        'The dec page structure and jacket housing the form assembly.',
      ),
      r('Coverage forms library', 'Base insuring forms with numbers and edition dates.'),
      r(
        'Endorsement forms library',
        'Modifying forms, mandatory and optional, with attach conditions.',
      ),
      r(
        'Form attachment rules',
        'Which forms attach for which product, coverage, state and options.',
      ),
      r(
        'Form numbering & edition dates',
        'Identity scheme, e.g. CG 00 01 04 13 — number plus edition.',
      ),
      r('Merge variables', 'Dynamic fields resolved at issuance (names, limits, schedules).'),
      r('Clause library', 'Reusable wording fragments assembled into manuscript forms.'),
      r('Assembly order', 'The sequence forms print/render within the policy document.'),
      r(
        'Cancellation / nonrenewal notices',
        'Statutory notice documents with reason codes and timing.',
      ),
      r('Renewal offer documents', 'Renewal certificates/dec packages and change summaries.'),
      r(
        'Signature & countersignature blocks',
        'Officer signatures and any required countersignature placements.',
      ),
      r(
        'Mandatory vs optional flags',
        'Whether a form must attach (state amendatory) or is elective.',
      ),
      b(
        'Attachment rule evaluation',
        'Resolving the complete form set for a policy at issuance and renewal.',
      ),
      b(
        'Edition supersession on renewal',
        'Rolling policies onto newer filed editions at the correct renewal.',
      ),
      m(
        'Rating factors embedded in form text',
        'Rates quoted in wordings drift from the filed rate manual.',
        'Rating & Pricing',
      ),
      m(
        'Attachment eligibility logic duplicated in UI',
        'Form applicability is a product rule, not screen logic.',
        'Eligibility & UW Rules',
      ),
    ],
    SEGMENT: [
      r(
        'ISO standard forms',
        'Commercial: CG 00 01 (CGL), CP 10 30 (special causes of loss) and kin.',
      ),
      r('ACORD applications', 'ACORD 125/126/140 intake forms feeding commercial submissions.'),
      r('Manuscript wordings', 'Large commercial/specialty: bespoke negotiated policy language.'),
      r("Lloyd's MRC", 'London market: the Market Reform Contract slip structure.'),
      r('Personal auto form sets', 'PP 00 01 and state-specific personal auto policy editions.'),
      r(
        'BOP combined form',
        'SMB: the businessowners combined property/liability form (BP 00 03).',
      ),
      r('Group certificates', 'Benefits: certificate wordings issued under the master contract.'),
      r('Binders & cover notes', 'Temporary evidence of coverage pending policy issuance.'),
    ],
    GEOGRAPHY: [
      r(
        'State-approved editions & amendatories',
        'Per-state form editions and mandatory amendatory endorsements.',
      ),
      r(
        'SERFF form-filing references',
        'Tracking numbers tying each form edition to its state filing.',
      ),
      r('UK Consumer Duty wordings', 'FCA: plain-language, fair-value-tested customer documents.'),
      r(
        'EU IPID',
        'IDD: the standardized insurance product information document per product/market.',
      ),
      r(
        'Multi-language issuance',
        'QC French, EU local-language and bilingual document requirements.',
      ),
      r(
        'Countersignature requirements',
        'Residual state rules requiring resident-agent countersignature.',
      ),
      r(
        'State cancellation notice wording & timing',
        'Days-notice and reason wording that vary by state and line.',
      ),
      r(
        'WC statutory endorsements by state',
        'State-fund, USL&H and other jurisdiction-mandated WC forms.',
      ),
    ],
  },
  'Eligibility & UW Rules': {
    COMMON: [
      r('Appetite statements', 'Target classes, sizes and hazards the carrier wants, by product.'),
      r('Knock-out questions', 'Hard-stop application questions that decline or refer on answer.'),
      r('Class eligibility', 'Acceptable/prohibited classification lists per program.'),
      r('Prior-loss thresholds', 'Loss count/severity rules gating acceptance or referral.'),
      r(
        'Underwriting authority levels',
        'Who can approve what — limits, hazard grades, premium sizes.',
      ),
      r(
        'Referral rules & routing',
        'Conditions that push a risk to an underwriter and to which desk.',
      ),
      r('Declination reason catalog', 'Standardized reasons supporting adverse-action notices.'),
      r('Risk scoring inputs', 'The model features and thresholds behind accept/refer scores.'),
      r(
        'Inspection requirements',
        'When a physical/virtual inspection is ordered before or after bind.',
      ),
      r('Cat moratorium rules', 'Binding suspensions when a named storm or wildfire is active.'),
      r(
        'Clearance & dedup rules',
        'Blocking duplicate submissions and broker-of-record conflicts.',
      ),
      r('Guideline documentation links', 'The published UW guide sections each rule enforces.'),
      b(
        'Referral triage & authority escalation',
        'Routing referrals up the authority chain with SLAs.',
      ),
      b(
        'Automated clearance at submission',
        'Checking incoming risks against in-force and in-flight records.',
      ),
      m(
        'Pricing modifiers implemented as eligibility rules',
        'Surcharging a risk is rating; gating a risk is underwriting.',
        'Rating & Pricing',
      ),
      m(
        'Regulatory form triggers inside UW rules',
        'Form attachment mandates belong with filings and form rules.',
        'Regulatory & Filings',
      ),
    ],
    SEGMENT: [
      r(
        'SIC/NAICS class restrictions',
        'Commercial: appetite expressed against industry classification codes.',
      ),
      r(
        'Straight-through processing rules',
        'SMB/personal: criteria allowing no-touch quote-bind-issue.',
      ),
      r(
        'MVR point thresholds',
        'Personal auto: motor vehicle record points gating driver acceptability.',
      ),
      r(
        'Protection class restrictions',
        'Property: ISO PPC fire-protection classes 1–10 acceptability.',
      ),
      r(
        'Roof age / building age rules',
        'Homeowners: age-based eligibility and inspection triggers.',
      ),
      r(
        'Minimum premium thresholds',
        'Large accounts: floors below which the desk declines to quote.',
      ),
      r('Coastal wind capacity rules', 'TIV-band capacity budgets by wind zone.'),
      r(
        "Lloyd's delegated authority eligibility",
        'Binder rules limiting what a coverholder may bind.',
      ),
    ],
    GEOGRAPHY: [
      r('Take-all-comers rules', 'States like MA personal auto restricting declination freedom.'),
      r(
        'FAIR plan interplay',
        'Residual property markets and voluntary-market eligibility interaction.',
      ),
      r(
        'Credit-score usage prohibitions',
        'CA, MA, HI ban credit-based insurance scores in eligibility/rating.',
      ),
      r(
        'EU gender-rating ban',
        'Test-Achats: gender may not drive eligibility or price in the EU.',
      ),
      r(
        'FEMA flood-zone restrictions',
        'Zone-based eligibility (e.g. no V-zone binding without referral).',
      ),
      r(
        'CA wildfire-score rules',
        'Safer-from-Wildfires mitigation credits and score-based restrictions.',
      ),
      r(
        'Sanctioned-jurisdiction exclusions',
        'No binding for embargoed territories or SDN-linked parties.',
      ),
      r(
        'Surplus-lines diligence rules',
        'Declinations from admitted market required before E&S placement.',
      ),
    ],
  },
  'Exposures & Schedules': {
    COMMON: [
      r(
        'Exposure base definitions',
        'Payroll, sales, TIV, vehicle-years, units — the denominators of rating.',
      ),
      r('Location schedule', 'Insured premises with addresses, occupancy and per-location values.'),
      r(
        'Building & contents values',
        'Scheduled values feeding insurance-to-value and property rating.',
      ),
      r('Vehicle schedule', 'VIN-level list with garaging, class, cost-new and use.'),
      r('Driver schedule', 'Listed drivers with license data feeding auto rating.'),
      r('Equipment schedule', 'Contractors/inland-marine items with serial numbers and values.'),
      r(
        'Statement of values (SOV)',
        'The insured-supplied value declaration underlying blanket property.',
      ),
      r(
        'Blanket vs scheduled election',
        'Whether limits apply per schedule line or across the blanket.',
      ),
      r(
        'Geocoding & address standardization',
        'Normalized locations enabling territory and cat assignment.',
      ),
      r(
        'Exposure audit trail',
        'Versioned exposure changes with sources (audit, endorsement, renewal).',
      ),
      r('Schedule import formats', 'SOV/fleet spreadsheet ingestion mappings.'),
      r('Named-insured schedule', 'Entity lists for multi-entity accounts with FEINs.'),
      b(
        'SOV ingest & COPE enrichment',
        'Parsing statements of values and enriching construction/occupancy/protection/exposure data.',
      ),
      b(
        'Accumulation rollup by zone',
        'Aggregating exposures into cat accumulation zones for capacity control.',
      ),
      m(
        'Rating factor derivations stored on schedules',
        'Schedules carry facts; factor math belongs in the rate engine.',
        'Rating & Pricing',
      ),
      m(
        'Limits recorded per schedule line',
        'Limit structure is contract content, not exposure data.',
        'Limits & Deductibles',
      ),
    ],
    SEGMENT: [
      r('Payroll by class code', 'WC: audited payroll split across NCCI/state class codes.'),
      r('Fleet schedules', 'Commercial auto: unit-level fleets with radius and use classes.'),
      r('Contractors equipment floaters', 'SMB inland marine: scheduled tools and machinery.'),
      r(
        'COPE data',
        'Commercial property: construction, occupancy, protection, exposure attributes.',
      ),
      r('Garaging address', 'Personal auto: the rating location as distinct from mailing address.'),
      r(
        'Scheduled personal property',
        'Personal lines: jewelry, art and collectibles riders with appraisals.',
      ),
      r(
        'Shared-limit TIV rollups',
        'Programs: total insured values across members sharing a limit.',
      ),
      r('Cargo & voyage schedules', 'Marine: shipment declarations under open cargo covers.'),
    ],
    GEOGRAPHY: [
      r(
        'Cat accumulation zones',
        'Coastal wind bands, quake zones and wildfire brush zones by region.',
      ),
      r(
        'FEMA flood-zone determination',
        'US: zone lookups (A/V/X) per location with elevation certificates.',
      ),
      r(
        'Windstorm mitigation features',
        'FL OIR-B1-1802 inspection attributes discounting wind rates.',
      ),
      r('Green-card territory exposures', 'EU motor: cross-border exposure declarations.'),
      r(
        'Cross-border premium-tax allocation',
        'Multinational: exposure split by country driving tax apportionment.',
      ),
      r('UK postcode flood scoring', 'Flood Re eligibility and postcode-level flood risk grades.'),
      r('Soil-type quake zonation', 'CA/JP: site-class layers refining earthquake exposure.'),
      r('WC officer payroll caps', 'State-specific min/max payroll for owners and officers.'),
    ],
  },
  'Reinsurance & Layering': {
    COMMON: [
      r(
        'Treaty register',
        'Quota-share, surplus and excess-of-loss treaties with terms and periods.',
      ),
      r(
        'Facultative certificates',
        'Risk-by-risk cessions with their own terms and reinsurer panels.',
      ),
      r('Cession rules', 'Which business cedes to which treaty, by product, class and limit.'),
      r('Retention definitions', 'Net retentions per risk and per occurrence the carrier holds.'),
      r(
        'Attachment & exhaustion tracking',
        'Layer boundaries and running erosion per program year.',
      ),
      r('Reinstatement provisions', 'Number, cost and mechanics of restoring exhausted layers.'),
      r('Ceding commissions', 'Flat and sliding-scale commissions on proportional treaties.'),
      r(
        'Reinsurer participation panels',
        'Signed shares per reinsurer per layer with security ratings.',
      ),
      r('Cat program structure', 'The occurrence tower protecting the retained book.'),
      r('Inuring order', 'Which recoveries apply first when treaties overlap.'),
      r('Recovery allocation', 'Attributing reinsurance recoveries back to claims and layers.'),
      r('Bordereaux definitions', 'Premium/claims bordereau formats owed to reinsurers.'),
      b('Automatic cession on bind', 'Applying cession rules the moment a policy attaches.'),
      b(
        'Large-loss recovery calculation',
        'Computing recoveries across fac, treaty and cat layers on an event.',
      ),
      m(
        'Reinsurance cost loads inside base rates',
        'The net-cost-of-reinsurance load is a rating input, sourced from here.',
        'Rating & Pricing',
      ),
      m(
        'Treaty eligibility duplicated in UW rules',
        'Capacity constraints derive from treaties; UW rules should reference, not restate.',
        'Eligibility & UW Rules',
      ),
    ],
    SEGMENT: [
      r(
        'Facultative placement for single large risks',
        'Large commercial: per-risk fac above treaty capacity.',
      ),
      r(
        'Surplus treaty lines',
        'Mid-market property: automatic capacity as multiples of retention.',
      ),
      r(
        'Program / MGA quota shares',
        'Program business: proportional treaties dedicated to an MGA book.',
      ),
      r(
        "Lloyd's line slips & consortia",
        'Subscription arrangements with pre-agreed following capacity.',
      ),
      r('Per-risk vs per-occurrence XoL', 'Working-layer excess by book of business.'),
      r(
        'Captive participations',
        'National accounts: client captives taking quota shares of their own risk.',
      ),
      r(
        'Fronting arrangements',
        'Issuing carrier fronting for a reinsurer or captive at 80–100% cession.',
      ),
      r(
        'Structured / finite covers',
        'Specialty: multi-year aggregate covers with experience accounts.',
      ),
    ],
    GEOGRAPHY: [
      r(
        'FL FHCF layers',
        'Florida Hurricane Catastrophe Fund mandatory layer inuring to private cat.',
      ),
      r('TRIA federal backstop', 'US terrorism: federal share above insurer deductibles.'),
      r('Pool Re participation', 'UK terrorism pool membership and retrocession structure.'),
      r('National cat schemes', 'FR CCR, ES Consorcio, NZ EQC interacting with private towers.'),
      r(
        'Credit-for-reinsurance collateral',
        'US: collateral/trust requirements for non-admitted reinsurers.',
      ),
      r(
        'Solvency II risk-mitigation recognition',
        'EU: treaty structures qualifying for capital relief.',
      ),
      r(
        'Localized compulsory cessions',
        'Markets with mandatory local cessions (historic Brazil IRB, India GIC obligatory).',
      ),
      r('Currency-matched layers', 'Multinational programs: layers arranged per currency zone.'),
    ],
  },
  'Regulatory & Filings': {
    COMMON: [
      r(
        'Rate/rule/form filing register',
        'Every filing with jurisdiction, type, status and disposition.',
      ),
      r(
        'Filing status tracking',
        'Submitted, objected, approved, disapproved, withdrawn with dates.',
      ),
      r(
        'Statistical reporting codes',
        'Stat-plan and annual-statement line codes per product/coverage.',
      ),
      r(
        'Compliance calendar',
        'Recurring obligations: data calls, renewals of authority, report dates.',
      ),
      r(
        'Regulator correspondence log',
        'Objection letters, interrogatories and responses per filing.',
      ),
      r(
        'Product approval evidence',
        'The approved filing artifacts each live product version rests on.',
      ),
      r(
        'Mandatory offer tracking',
        'Required offers/rejections, e.g. UM/UIM offers with signed waivers.',
      ),
      r(
        'Jurisdiction filing matrix',
        'Which states/countries each product version is filed and approved in.',
      ),
      r(
        'Bureau adoption tracking',
        'ISO/NCCI circular adoptions, modifications and non-adoptions.',
      ),
      r('Objection response library', 'Reusable support exhibits for common regulator objections.'),
      r('Withdrawal filings', 'Market exit filings with renewal-rights and notice obligations.'),
      r(
        'Filing exhibit templates',
        'Actuarial memoranda, side-by-sides and checklists per filing type.',
      ),
      b(
        'Filing-to-product traceability',
        'Verifying every live rate/form traces to an approved filing.',
      ),
      b(
        'Edition-change compliance alerts',
        'Flagging products still on superseded editions past deadlines.',
      ),
      m(
        'Availability toggles managed as code deploys',
        'Where a product may sell is product-hierarchy data driven by filings.',
        'Product Hierarchy',
      ),
      m(
        'Premium tax computed ad hoc in rating',
        'Tax regimes are jurisdictional reference data applied by the rater.',
        'Rating & Pricing',
      ),
    ],
    SEGMENT: [
      r(
        'Personal lines prior-approval sensitivity',
        'Personal products face stricter rate review in many states.',
      ),
      r(
        'Large-risk rating exemptions',
        'Commercial: exempt/deregulated filings for qualifying large insureds.',
      ),
      r(
        'Surplus-lines stamping & diligence',
        'Specialty: stamping-office filings and diligent-search affidavits.',
      ),
      r('WC bureau plan adherence', 'NCCI/independent-bureau plan rules binding WC products.'),
      r('Group certificate filings', 'Benefits: master/certificate filing regimes by situs state.'),
      r("Lloyd's coverholder permissions", 'Delegated authority registrations per territory.'),
      r(
        'Program filing ownership',
        'Whether the carrier or MGA owns and maintains program filings.',
      ),
      r('Monoline special regimes', 'Credit, title, mortgage insurers under dedicated statutes.'),
    ],
    GEOGRAPHY: [
      r(
        'SERFF state filings',
        'US: rate/rule/form filings via the NAIC System for Electronic Rate and Form Filing.',
      ),
      r(
        'IIPRC compact filings',
        'Life/annuity: single-point Interstate Compact product approvals.',
      ),
      r('Solvency II reporting lines', 'EU: QRT line-of-business mappings per product.'),
      r(
        'IFRS 17 cohorts',
        'Annual cohorts and profitability groupings (CSM) by product portfolio.',
      ),
      r('Premium tax regimes', 'State premium taxes, retaliatory taxes, UK IPT, EU country taxes.'),
      r('FATCA/CRS reporting', 'Cross-border tax reporting on cash-value and annuity products.'),
      r(
        'NYDFS Part 500 attestation',
        'NY: cybersecurity program certification touching product data systems.',
      ),
      r(
        'State data calls',
        'FL wind, CA wildfire, TX weather data calls sourced from product/claims data.',
      ),
      r('Guaranty fund assessments', 'Per-state assessment bases tied to written premium by line.'),
    ],
  },
  Distribution: {
    COMMON: [
      r('Producer / agency master', 'The canonical register of agencies and individual producers.'),
      r(
        'Licenses & appointments',
        'Resident/non-resident licenses and carrier appointments with terms.',
      ),
      r(
        'Commission schedules',
        'New/renewal commission rates by product, channel and volume tier.',
      ),
      r(
        'Channel definitions',
        'Independent agency, direct, broker, digital and embedded channels.',
      ),
      r(
        'Producer hierarchy',
        'Agency → branch → producer rollups driving reporting and overrides.',
      ),
      r('Book-of-business assignment', 'Which producer services and is credited for each policy.'),
      r('Book transfers', 'Broker-of-record changes and bulk book moves with effective dates.'),
      r('Override commissions', 'Master-agency and aggregator overrides above base commission.'),
      r(
        'Producer agreements',
        'Contract terms: authority granted, ownership of expirations, termination.',
      ),
      r(
        'Onboarding & background checks',
        'Licensing verification, E&O evidence and appointment setup.',
      ),
      r('Portal entitlements', 'What each producer may quote, bind and service online.'),
      r('Lead source tracking', 'Attribution of business to campaigns, aggregators and referrers.'),
      b(
        'Appointment verification at submission',
        'Blocking business from unappointed or lapsed producers.',
      ),
      b(
        'Commission calculation & statements',
        'Computing earned commission and issuing producer statements.',
      ),
      m(
        'Commission percentages hardcoded in rating',
        'Commission nets against premium downstream; it is not a rate factor.',
        'Rating & Pricing',
      ),
      m(
        'Producer eligibility checks inside form logic',
        'Who may sell a product is a distribution rule, not a form rule.',
        'Eligibility & UW Rules',
      ),
    ],
    SEGMENT: [
      r(
        'Wholesale / MGA / MGU agreements',
        'Specialty: delegated underwriting authority contracts.',
      ),
      r(
        'Retail agency SMB channel',
        'Independent agents quoting BOP/WC/auto through carrier portals.',
      ),
      r('Direct-to-consumer digital', 'Personal lines: carrier-owned web/mobile acquisition.'),
      r(
        'National broker house accounts',
        'Large commercial: Aon/Marsh/WTW-serviced accounts with fee terms.',
      ),
      r(
        'Aggregator / comparison sites',
        'UK personal motor: price-comparison-website distribution terms.',
      ),
      r(
        'Bank & affinity distribution',
        'Benefits/personal: partner-branded programs with revenue shares.',
      ),
      r(
        'Program administrator binding',
        'Program business: PA-delegated quote/bind within binder limits.',
      ),
      r('Captive agent networks', 'Exclusive agents selling one carrier’s products.'),
    ],
    GEOGRAPHY: [
      r(
        'NIPR licensing & appointments',
        'US: producer licensing/appointment transactions via NIPR per state.',
      ),
      r(
        'Resident-agent countersignature rules',
        'Residual state rules requiring local agent involvement.',
      ),
      r('Surplus-lines broker licensing', 'Separate per-state E&S broker licenses and filings.'),
      r(
        'FCA authorization & appointed representatives',
        'UK: firms and ARs authorized for insurance distribution.',
      ),
      r(
        'EU IDD passporting',
        'Intermediaries passporting distribution rights across member states.',
      ),
      r(
        'Commission disclosure rules',
        'NY Reg 194 and UK disclosure duties on producer remuneration.',
      ),
      r(
        'Cross-border solicitation restrictions',
        'Where non-admitted products may not be marketed.',
      ),
      r(
        'Retaliatory fee accounting',
        'US: state fees mirrored against out-of-state carriers’ home levies.',
      ),
    ],
  },
};

export type AnatomyRowBuilt = {
  component: ProductComponent;
  scope: AnatomyScope;
  view: AnatomyView;
  slug: string;
  name: string;
  description: string;
  recommendedComponent: string | null;
  sortOrder: number;
};

// Flatten the catalog into insertable rows with stable slugs; throws on slug
// collision so the SKOS identifiers stay unique per company.
export function buildAnatomyRows(): AnatomyRowBuilt[] {
  const rows: AnatomyRowBuilt[] = [];
  const seen = new Set<string>();
  for (const component of PRODUCT_COMPONENTS) {
    const cell = CATALOG[component];
    (['COMMON', 'SEGMENT', 'GEOGRAPHY'] as const).forEach((scope) => {
      cell[scope].forEach((row, i) => {
        const slug = `${COMPONENT_SLUGS[component]}-${slugify(row.name)}`;
        if (seen.has(slug)) throw new Error(`Duplicate anatomy slug: ${slug}`);
        seen.add(slug);
        rows.push({
          component,
          scope,
          view: row.view ?? 'COMPONENT',
          slug,
          name: row.name,
          description: row.description,
          recommendedComponent: row.recommendedComponent ?? null,
          sortOrder: i,
        });
      });
    });
  }
  return rows;
}

export async function seedProductModelAnatomy(
  p: PrismaClient,
  ctx: { tenantId: string; companyId: string },
) {
  await p.productModelAnatomyCategory.deleteMany({ where: { companyId: ctx.companyId } });
  const rows = buildAnatomyRows().map((row) => ({
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    ...row,
  }));
  await p.productModelAnatomyCategory.createMany({ data: rows });
  console.log(
    `   + ${rows.length} product-model anatomy categories (11 components x 3 scopes, PM-02)`,
  );
}
