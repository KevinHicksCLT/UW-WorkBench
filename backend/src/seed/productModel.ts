// ── Product Model Rationalization demo workspace (PM-02) ──
// "Commercial & Personal Lines North Star" for ABC Insurance: 4 legacy product
// models that echo the seeded application estate, decomposed into atomic-grain
// findings per product component, normalized (AUTO / REVIEW / HELD) and landed
// on one canonical product model per major line. All content is
// insurance-domain-real (form numbers, statutes, thresholds, rate routines).
// Idempotent: rows are replaced wholesale per company.
import type { PrismaClient, Prisma } from '@prisma/client';
import type { SpineRefs } from './resolveSpineRefs.js';
import type { ProductComponent } from './seedWorkspaceVocabulary.js';
import { COMPONENT_SLUGS } from './seedProductModelAnatomy.js';

type Scope = 'Common' | 'Segment' | 'Geography' | 'Eliminate';
type Why = {
  captured?: string;
  sent?: string;
  processed?: string;
  validated?: string;
  lands?: string;
};

type FindingDef = {
  cmp: ProductComponent;
  name: string;
  detail: string;
  scope: Scope;
  seg?: string; // segmentValue
  geo?: string; // geographyValue
  ref?: string; // sourceRef in the legacy system
  slug?: string; // ProductModelAnatomyCategory slug (without validation — tests check it)
  norm?: string; // normalization-entry key
  target?: string; // canonical-model key override (default: the model's own canonical)
  dead?: boolean;
  why?: Why;
  status?: string;
};

type LegacyDef = {
  key: string;
  name: string;
  description: string;
  sourceSystem: string;
  segment: string;
  geography: string;
  disposition: string;
  canonical: string; // default canonical-model key its findings land on
  findings: FindingDef[];
};

type NormDef = {
  key: string;
  cmp: ProductComponent;
  notation: string;
  name: string;
  matchStatus: 'AUTO' | 'REVIEW' | 'HELD';
  matchBasis?: string;
  differenceNote?: string;
  proposedResolution?: string;
  canonical: string; // whose component this entry folds into
};

type CanonicalDef = {
  key: string;
  name: string;
  description: string;
  line: string;
  ownerRole: string;
  components: ProductComponent[];
};

const WS_ID = 'pmw_northstar';
const WS_NAME = 'Commercial & Personal Lines North Star';

const CANONICALS: CanonicalDef[] = [
  {
    key: 'com',
    name: 'Canonical Commercial Package',
    description:
      'One effective-dated commercial package definition: ISO-aligned coverage parts, filed state deviations as data, single rating algorithm with jurisdictional tables.',
    line: 'Commercial Package',
    ownerRole: 'Chief Underwriting Officer',
    components: [
      'Party & Roles',
      'Product Hierarchy',
      'Coverage & Perils',
      'Limits & Deductibles',
      'Rating & Pricing',
      'Forms & Wordings',
      'Eligibility & UW Rules',
      'Exposures & Schedules',
      'Reinsurance & Layering',
      'Regulatory & Filings',
      'Distribution',
    ],
  },
  {
    key: 'pa',
    name: 'Canonical Personal Auto',
    description:
      'Single personal auto product with tier as a rating dimension (not clone products), state minima and PIP modules as jurisdiction data.',
    line: 'Personal Auto',
    ownerRole: 'Insurance Product Manager',
    components: [
      'Party & Roles',
      'Coverage & Perils',
      'Limits & Deductibles',
      'Rating & Pricing',
      'Forms & Wordings',
      'Eligibility & UW Rules',
      'Exposures & Schedules',
      'Distribution',
    ],
  },
  {
    key: 'ann',
    name: 'Canonical Individual Annuity',
    description:
      'Versioned annuity chassis replacing the generation-suffix mainframe products; crediting rates, surrender schedules and suitability rules as configuration.',
    line: 'Annuity',
    ownerRole: 'Chief Actuary',
    components: [
      'Party & Roles',
      'Product Hierarchy',
      'Rating & Pricing',
      'Forms & Wordings',
      'Regulatory & Filings',
      'Distribution',
    ],
  },
  {
    key: 'ldn',
    name: 'Canonical London Market Binder',
    description:
      'Delegated-authority binder product with MRC-native sections, line-size mechanics and UK regulatory artifacts generated from the same canonical definition.',
    line: 'Specialty (London Market)',
    ownerRole: 'Underwriting Director / Manager',
    components: [
      'Party & Roles',
      'Product Hierarchy',
      'Coverage & Perils',
      'Limits & Deductibles',
      'Rating & Pricing',
      'Forms & Wordings',
      'Regulatory & Filings',
    ],
  },
];

// v3 Normalize-column entries — stable notations, wireframe-grain narratives.
const NORMS: NormDef[] = [
  {
    key: 'parties',
    cmp: 'Party & Roles',
    notation: 'N-101',
    name: 'Named insured & interested parties',
    matchStatus: 'AUTO',
    matchBasis:
      'Named insured — text (120); Mortgagee — text (100) ×2 per location; Loss payee — text (100); Lienholder — text (100) — all core party roles match on name, type and role semantics across PolicyPro and QuoteMaster.',
    canonical: 'com',
  },
  {
    key: 'beneficiary',
    cmp: 'Party & Roles',
    notation: 'N-102',
    name: 'Beneficiary designation',
    matchStatus: 'AUTO',
    matchBasis:
      'Primary/contingent beneficiaries with percentage splits — single source (Annuity Master); lifted as-is into the canonical party model.',
    canonical: 'ann',
  },
  {
    key: 'versions',
    cmp: 'Product Hierarchy',
    notation: 'N-103',
    name: 'Product structure & versioning',
    matchStatus: 'HELD',
    differenceNote:
      'Same product concepts — version mechanics differ: PolicyPro toggles CPP parts by flag, Annuity Master clones whole products per generation (ANN85/ANN92/ANN01), QuoteMaster clones per tier.',
    proposedResolution:
      'Adopt canonical effective-dated product versions; map generation suffixes and tier clones to versions of one product each.',
    canonical: 'com',
  },
  {
    key: 'coverage',
    cmp: 'Coverage & Perils',
    notation: 'N-104',
    name: 'Coverage grants & endorsement catalog',
    matchStatus: 'AUTO',
    matchBasis:
      'Coverage code — text (8); Limit applicability — pick list; Trigger — occurrence; Edition — date — grants and optional endorsements match on structure across both P&C sources.',
    canonical: 'com',
  },
  {
    key: 'pip',
    cmp: 'Coverage & Perils',
    notation: 'N-105',
    name: 'No-fault / PIP module',
    matchStatus: 'REVIEW',
    differenceNote:
      'Same statutory benefits captured — QuoteMaster models PIP as a coverage; the canonical model carries it as a jurisdiction module switched by state, with MI electable-limit mechanics.',
    proposedResolution: 'Model PIP as a Geography module keyed to the no-fault state table.',
    canonical: 'pa',
  },
  {
    key: 'deductibles',
    cmp: 'Limits & Deductibles',
    notation: 'N-106',
    name: 'Deductible menus',
    matchStatus: 'AUTO',
    matchBasis:
      'Deductible amount — money; Type — pick list (flat / % / split wind); Default — boolean — all 3 menu tiers match on amount, type and default across PolicyPro ($500/$1,000/$2,500) and QuoteMaster ($250–$1,000).',
    canonical: 'com',
  },
  {
    key: 'minlimits',
    cmp: 'Limits & Deductibles',
    notation: 'N-107',
    name: 'State minimum limits & statutory floors',
    matchStatus: 'REVIEW',
    differenceNote:
      'Both sources hold state minima — QuoteMaster in a filed table, PolicyPro partially hard-coded; UK unlimited-BI rule has no US analogue and needs a jurisdiction override lane.',
    proposedResolution:
      'One statutory-minimum table keyed by jurisdiction, with unlimited as a representable value.',
    canonical: 'pa',
  },
  {
    key: 'minprem',
    cmp: 'Rating & Pricing',
    notation: 'N-108',
    name: 'Minimum premium & policy fees',
    matchStatus: 'HELD',
    differenceNote:
      'Both floors apply after all credits — PolicyPro hard-codes $500 in rate routine RT-114 (overriding filed NY minimums); QuoteMaster reads a filed minimum table; installment fees differ ($6 flat vs plan-based).',
    proposedResolution:
      'Adopt the filed state minimum-premium table for all lines; retire the RT-114 constant with sign-off.',
    canonical: 'com',
  },
  {
    key: 'ratefactors',
    cmp: 'Rating & Pricing',
    notation: 'N-109',
    name: 'Rate factor tables',
    matchStatus: 'AUTO',
    matchBasis:
      'Factor code — text (12); Territory — pick list; Effective date — date; Relativity — decimal (6,4) — all 14 fields match on name, type and order between the ISO LCM tables and the auto territory tables.',
    canonical: 'com',
  },
  {
    key: 'forms',
    cmp: 'Forms & Wordings',
    notation: 'N-110',
    name: 'Form library & editions',
    matchStatus: 'AUTO',
    matchBasis:
      'Form number — text (10); Edition date — date; State — pick list, 51 options; Mandatory flag — boolean — attachment metadata matches on name, type and order across PolicyPro and QuoteMaster form tables.',
    canonical: 'com',
  },
  {
    key: 'mrc',
    cmp: 'Forms & Wordings',
    notation: 'N-111',
    name: 'London MRC slip assembly',
    matchStatus: 'REVIEW',
    differenceNote:
      'Same contract data — flow shape differs: MRC slips assemble sections before signing lines, US dec packages assemble after issuance; validation timing differs at bind vs signing.',
    proposedResolution: 'Keep MRC assembly as a Segment variant over the shared clause library.',
    canonical: 'ldn',
  },
  {
    key: 'uwrules',
    cmp: 'Eligibility & UW Rules',
    notation: 'N-112',
    name: 'Acceptance rules & referral thresholds',
    matchStatus: 'REVIEW',
    differenceNote:
      'Same rule shapes (threshold + referral route) — inputs differ per segment: SIC appetite lists vs MVR points vs binder authority limits.',
    proposedResolution:
      'One rules schema with segment-scoped rule sets; retire the frozen 2016 SIC list.',
    canonical: 'com',
  },
  {
    key: 'filings',
    cmp: 'Regulatory & Filings',
    notation: 'N-113',
    name: 'Filing register & product approvals',
    matchStatus: 'AUTO',
    matchBasis:
      'Filing id — text (20); Jurisdiction — pick list; Type — rate/rule/form; Status — pick list, 6 options; Disposition date — date — SERFF and IIPRC references match on all fields.',
    canonical: 'com',
  },
  {
    key: 'taxes',
    cmp: 'Regulatory & Filings',
    notation: 'N-114',
    name: 'Premium taxes & levies',
    matchStatus: 'REVIEW',
    differenceNote:
      'US state premium taxes computed downstream of rating; UK IPT (12%) computed at quote inside the binder workbook — computation point differs.',
    proposedResolution:
      'Jurisdictional tax table applied by the canonical rater at quote for all territories.',
    canonical: 'ldn',
  },
];

const LEGACY: LegacyDef[] = [
  {
    key: 'ppro',
    name: 'PolicyPro — Commercial Package (East)',
    description:
      'The .NET policy-admin commercial package product as configured for the East region: ISO-based parts with 20 years of state deviations coded in.',
    sourceSystem: 'PolicyPro (C# / .NET 4.7, SQL Server)',
    segment: 'SMB',
    geography: 'US-East',
    disposition: 'Replace',
    canonical: 'com',
    findings: [
      {
        cmp: 'Party & Roles',
        name: 'Named insured with DBA appended to name field',
        detail:
          'Single named insured plus one DBA line; additional entities are appended into the 120-char name field instead of a multi-entity schedule.',
        scope: 'Common',
        ref: 'dbo.Policy.InsuredName (SQL Server)',
        slug: 'party-roles-named-insured',
        norm: 'parties',
      },
      {
        cmp: 'Party & Roles',
        name: 'Mortgagee & loss payee per location',
        detail:
          'Up to 2 mortgagees per location; the loss-payee flag shares storage with lienholder logic.',
        scope: 'Common',
        ref: 'dbo.LocationInterest',
        slug: 'party-roles-mortgagee',
        norm: 'parties',
      },
      {
        cmp: 'Party & Roles',
        name: 'Certificate holder registry with bulk renewal reissue',
        detail: 'ACORD 25 certificate holders (cap 500 per policy) reissued in bulk at renewal.',
        scope: 'Segment',
        seg: 'SMB',
        ref: 'CertHolder.aspx.cs',
        slug: 'party-roles-certificate-holder',
      },
      {
        cmp: 'Product Hierarchy',
        name: 'CPP parts toggled by flags on the policy master row',
        detail:
          'Property, GL, inland marine and crime parts are boolean columns, not modular coverage parts.',
        scope: 'Common',
        ref: 'dbo.Policy (HasProp/HasGL/HasIM/HasCrime)',
        slug: 'product-hierarchy-commercial-package-cpp-part-structure',
        norm: 'versions',
      },
      {
        cmp: 'Product Hierarchy',
        name: 'Region-embedded product key CPP-E',
        detail:
          "Product code 'CPP-E' bakes the East region into the key; the West clone diverged in 2014 and never re-merged.",
        scope: 'Eliminate',
        ref: 'ProductCatalog.cs : CPP_E',
        why: {
          captured:
            'Region and program are inferred from the trailing letter of the CPP-E product code at quote start.',
          sent: 'Rating, forms attachment and stat feeds all branch on the parsed region letter downstream.',
          processed:
            'Routes rating and forms by parsing the region letter out of the product code.',
          validated: 'Nothing prevents an East policy issuing with West forms after a code typo.',
          lands: 'Canonical 50-state product matrix keyed by jurisdiction (Product Hierarchy).',
        },
      },
      {
        cmp: 'Coverage & Perils',
        name: 'Hired & non-owned auto endorsement CA 20 01 attached by default',
        detail:
          'CA 20 01 auto-attaches to every companion auto part regardless of exposure; underwriters remove it by hand.',
        scope: 'Segment',
        seg: 'SMB',
        ref: 'FormAttach.cs : DefaultSet()',
        slug: 'coverage-perils-hired-and-non-owned-auto-ca-20-01',
        norm: 'coverage',
      },
      {
        cmp: 'Coverage & Perils',
        name: 'Business income with fixed 72-hour waiting period',
        detail:
          'BI/EE always carries a 72-hour wait; the filed 24-hour buyback exists but is not implemented.',
        scope: 'Common',
        ref: 'CoverageDef : BI_WAIT_HOURS = 72',
        slug: 'coverage-perils-business-income-and-extra-expense',
        norm: 'coverage',
      },
      {
        cmp: 'Coverage & Perils',
        name: 'Windstorm exclusion for Tier-1 coastal counties',
        detail:
          'Named-storm exclusion switched by a hard-coded NC/SC/VA county list last updated 2019.',
        scope: 'Geography',
        geo: 'US-East (Tier 1 coastal)',
        ref: 'WindRules.cs : TIER1_COUNTIES[]',
        slug: 'coverage-perils-windstorm-hail-percentage-deductible-perils',
      },
      {
        cmp: 'Limits & Deductibles',
        name: 'Fixed deductible tiers $500 / $1,000 / $2,500',
        detail:
          'The SMB property deductible menu; defaults to $1,000, no percentage options inland.',
        scope: 'Segment',
        seg: 'SMB',
        slug: 'limits-deductibles-fixed-deductible-tiers-smb',
        norm: 'deductibles',
      },
      {
        cmp: 'Limits & Deductibles',
        name: 'GL aggregate locked at 2× occurrence',
        detail:
          'General aggregate is always computed as twice the occurrence limit; no independent election.',
        scope: 'Common',
        ref: 'LimitCalc.cs : Aggregate()',
        slug: 'limits-deductibles-aggregate-limit',
        norm: 'minlimits',
      },
      {
        cmp: 'Limits & Deductibles',
        name: '5% named-storm deductible on coastal TIV',
        detail:
          'Percentage deductible applies when any location sits in a wind-pool zip; trigger definitions vary by state.',
        scope: 'Geography',
        geo: 'US-East coastal',
        slug: 'limits-deductibles-hurricane-deductible-triggers',
      },
      {
        cmp: 'Rating & Pricing',
        name: 'Minimum premium $500 hard-coded in rate routine RT-114',
        detail:
          'The $500 floor applies after all credits and silently overrides the filed NY minimum of $250.',
        scope: 'Geography',
        geo: 'US-NY',
        ref: 'RT-114 (rating routine, ported COBOL)',
        slug: 'rating-pricing-minimum-premium',
        norm: 'minprem',
        why: {
          captured:
            'Final premium after all schedule credits enters RT-114 as the last step of the rate order of calculation.',
          sent: 'The floored premium flows onto the quote proposal with no indication that a floor applied.',
          processed: 'Applies a $500 floor as the final rating step for every commercial policy.',
          validated: 'No jurisdiction check — the constant overrides three states’ filed minimums.',
          lands: 'Canonical minimum-premium table keyed by state & line (Rating & Pricing).',
        },
      },
      {
        cmp: 'Rating & Pricing',
        name: 'ISO loss costs with 1.42 LCM',
        detail:
          'Bureau loss costs multiplied by a single countrywide loss-cost multiplier of 1.42 across all East states.',
        scope: 'Segment',
        seg: 'Commercial',
        slug: 'rating-pricing-iso-loss-costs-lcm',
        norm: 'ratefactors',
      },
      {
        cmp: 'Rating & Pricing',
        name: '1998-edition short-rate table',
        detail:
          'The 90% short-rate cancellation table from the retired rating engine; unreachable since the 2019 pro-rata mandate.',
        scope: 'Eliminate',
        ref: 'dbo.ShortRate1998',
        slug: 'rating-pricing-short-rate-and-pro-rata-tables',
        dead: true,
        why: {
          captured: 'Cancellation effective dates entered on the mid-term cancel screen.',
          sent: 'Nothing — no code path has read dbo.ShortRate1998 since the 2019 pro-rata mandate.',
          processed:
            'The retired engine’s 90% short-rate penalty lookup by months-in-force for mid-term cancellations.',
          validated:
            'Unreachable — cancellation routing has computed pro-rata only since release 2019.2.',
          lands: 'Dead code — retire with sign-off; pro-rata is the only filed cancellation basis.',
        },
      },
      {
        cmp: 'Rating & Pricing',
        name: 'Agency commission 15/12 computed inside premium',
        detail:
          'New 15% / renewal 12% commission is computed inside the premium algorithm rather than netted downstream.',
        scope: 'Common',
        ref: 'RatingEngine.cs : CommissionStep()',
        slug: 'rating-pricing-producer-commission-inside-premium-calculation',
        target: 'com:Distribution',
        why: {
          captured:
            'Producer code and the new/renewal indicator read from the policy at rating step 11.',
          processed: 'Multiplies commission into the premium as rating step 11.',
          sent: 'Commission-inclusive premium flows to billing, so statements reverse-engineer the split.',
          validated:
            'No check against the producer agreement — every producer gets 15/12 regardless of negotiated schedule.',
          lands: 'Distribution commission schedule; rating emits net premium only.',
        },
      },
      {
        cmp: 'Forms & Wordings',
        name: 'CG 00 01 04 13 as the base GL form',
        detail:
          'The 04 13 edition attaches countrywide; 3 states have approved later editions that were never adopted.',
        scope: 'Segment',
        seg: 'Commercial',
        ref: 'dbo.FormAttach (CG0001-0413)',
        slug: 'forms-wordings-iso-standard-forms',
        norm: 'forms',
      },
      {
        cmp: 'Forms & Wordings',
        name: 'State amendatory picker for 12 East states',
        detail:
          'Amendatory endorsements resolved by a switch statement per state; new states require a code release.',
        scope: 'Geography',
        geo: 'US-East (12 states)',
        ref: 'FormAttach.cs : StateAmendatory()',
        slug: 'forms-wordings-state-approved-editions-and-amendatories',
        norm: 'forms',
      },
      {
        cmp: 'Eligibility & UW Rules',
        name: 'SIC-based appetite list frozen at 2016 edition',
        detail:
          'Acceptable SIC codes last reviewed 2016; NAICS mapping handled by a lookup spreadsheet outside the system.',
        scope: 'Segment',
        seg: 'SMB',
        ref: 'dbo.AppetiteSIC',
        slug: 'eligibility-uw-rules-sic-naics-class-restrictions',
        norm: 'uwrules',
      },
      {
        cmp: 'Eligibility & UW Rules',
        name: 'Coastal wind binding moratorium flag',
        detail:
          'A manual database flag suspends coastal binding during named storms; no automatic NHC feed.',
        scope: 'Geography',
        geo: 'US-East coastal',
        slug: 'eligibility-uw-rules-cat-moratorium-rules',
      },
      {
        cmp: 'Exposures & Schedules',
        name: 'SOV import with defaulted COPE attributes',
        detail:
          'XLS statement-of-values import defaults construction to "frame" and protection class to 5 when blank.',
        scope: 'Segment',
        seg: 'Commercial property',
        ref: 'SovImport.cs',
        slug: 'exposures-schedules-cope-data',
      },
      {
        cmp: 'Exposures & Schedules',
        name: 'Officer payroll caps for NY/NJ hard-coded',
        detail:
          'WC officer min/max payroll for NY and NJ live as constants; other states read the bureau table.',
        scope: 'Geography',
        geo: 'US-NY / US-NJ',
        ref: 'PayrollCap.cs',
        slug: 'exposures-schedules-wc-officer-payroll-caps',
      },
      {
        cmp: 'Reinsurance & Layering',
        name: 'Property surplus treaty auto-cession of 4 lines',
        detail:
          'Automatic surplus cession up to 4 lines of the $1M retention on property risks; fac required above.',
        scope: 'Segment',
        seg: 'Mid-market property',
        slug: 'reinsurance-layering-surplus-treaty-lines',
      },
      {
        cmp: 'Regulatory & Filings',
        name: 'SERFF tracking numbers on the form table',
        detail:
          'Each form edition row carries its SERFF tracking number; rate filings are tracked in a shared drive.',
        scope: 'Geography',
        geo: 'US (SERFF states)',
        ref: 'dbo.FormAttach.SerffRef',
        slug: 'regulatory-filings-serff-state-filings',
        norm: 'filings',
      },
      {
        cmp: 'Regulatory & Filings',
        name: 'Stat codes assigned by year-end batch',
        detail:
          'Annual-statement line codes assigned retroactively by a December batch job instead of at issuance.',
        scope: 'Common',
        ref: 'SSIS : StatCodeAssign.dtsx',
        slug: 'regulatory-filings-statistical-reporting-codes',
      },
      {
        cmp: 'Distribution',
        name: 'Producer appointment checked at bind only',
        detail:
          'Appointment status verified at bind, not at quote; lapsed producers can quote for weeks.',
        scope: 'Common',
        ref: 'BindPolicy.aspx.cs : CheckAppointment()',
        slug: 'distribution-appointment-verification-at-submission',
      },
    ],
  },
  {
    key: 'qm',
    name: 'QuoteMaster — Personal Auto',
    description:
      'The Java/Struts personal auto product: three tier clones (preferred/standard/non-standard) sharing one Oracle rate schema.',
    sourceSystem: 'QuoteMaster (Java 8, Struts, Oracle)',
    segment: 'Personal Lines',
    geography: 'US',
    disposition: 'Replace',
    canonical: 'pa',
    findings: [
      {
        cmp: 'Party & Roles',
        name: 'Named and excluded driver lists',
        detail:
          'Rated drivers plus formal named-driver exclusions (state permitting), keyed by license number.',
        scope: 'Segment',
        seg: 'Personal Lines',
        ref: 'DRIVER / DRIVER_EXCL (Oracle)',
        slug: 'party-roles-named-driver',
        norm: 'parties',
      },
      {
        cmp: 'Party & Roles',
        name: 'Lienholder per vehicle',
        detail: 'One lienholder per VIN paid on total loss; no additional-interest role exists.',
        scope: 'Common',
        ref: 'VEHICLE.LIENHOLDER',
        slug: 'party-roles-lienholder',
        norm: 'parties',
      },
      {
        cmp: 'Product Hierarchy',
        name: 'Tier structure as three clone products',
        detail:
          'Preferred/standard/non-standard are separate product rows with duplicated rates and forms.',
        scope: 'Segment',
        seg: 'Personal Lines',
        ref: 'PRODUCT (PA_PREF / PA_STD / PA_NSTD)',
        slug: 'product-hierarchy-personal-auto-tier-structure',
        norm: 'versions',
      },
      {
        cmp: 'Coverage & Perils',
        name: 'UM/UIM stacking elections',
        detail:
          'Stacked vs non-stacked UM/UIM tracked per state with signed rejection forms scanned to the policy file.',
        scope: 'Segment',
        seg: 'Personal Lines',
        slug: 'coverage-perils-um-uim-stacking-options',
        norm: 'coverage',
      },
      {
        cmp: 'Coverage & Perils',
        name: 'PIP module for no-fault states',
        detail:
          'Personal injury protection benefits per statute, including MI electable limits after the 2020 reform.',
        scope: 'Geography',
        geo: 'US no-fault states',
        slug: 'coverage-perils-no-fault-pip-medical-benefits',
        norm: 'pip',
      },
      {
        cmp: 'Limits & Deductibles',
        name: 'Filed state minimum limit table',
        detail:
          'Statutory minima per state (e.g. NY 25/50/10) read from a filed table with effective dating.',
        scope: 'Geography',
        geo: 'US (51 jurisdictions)',
        ref: 'STATE_MIN_LIMIT (Oracle)',
        slug: 'limits-deductibles-state-minimum-auto-liability-limits',
        norm: 'minlimits',
      },
      {
        cmp: 'Limits & Deductibles',
        name: 'Deductible menu $250–$1,000',
        detail: 'Comp/collision deductible options $250 / $500 / $1,000 with $500 default.',
        scope: 'Segment',
        seg: 'Personal Lines',
        slug: 'limits-deductibles-personal-lines-deductible-menu',
        norm: 'deductibles',
      },
      {
        cmp: 'Rating & Pricing',
        name: 'Credit-based insurance score factor',
        detail:
          'CBIS factor applied except CA/MA/HI; the exception list is hard-coded in the factor step.',
        scope: 'Geography',
        geo: 'US (except CA/MA/HI)',
        ref: 'RatingEngine.java : cbisFactor()',
        slug: 'rating-pricing-credit-based-insurance-score',
      },
      {
        cmp: 'Rating & Pricing',
        name: 'ZIP-level territory tables',
        detail: 'Territory relativities at ZIP granularity, refreshed with each state rate filing.',
        scope: 'Geography',
        geo: 'US',
        ref: 'RATE_TERRITORY (Oracle)',
        slug: 'rating-pricing-territory-definitions',
        norm: 'ratefactors',
      },
      {
        cmp: 'Rating & Pricing',
        name: 'Installment fee $6 hard-coded',
        detail:
          'A flat $6 per-installment fee in code; three states have filed different fees that are ignored.',
        scope: 'Eliminate',
        ref: 'BillingCalc.java : INSTALLMENT_FEE',
        slug: 'rating-pricing-installment-payment-plan-factors',
        norm: 'minprem',
        why: {
          captured: 'The payment-plan election (paid-in-full / 4-pay / 10-pay) captured at bind.',
          sent: 'The $6 charge rides on every installment invoice the billing extract generates.',
          processed: 'Adds $6 to every installment regardless of plan or state.',
          validated: 'No jurisdiction table — filed fee deviations in 3 states are not applied.',
          lands: 'Fee schedule in the canonical rating tables (Rating & Pricing).',
        },
      },
      {
        cmp: 'Forms & Wordings',
        name: 'PP 00 01 state edition matrix',
        detail:
          'Personal auto policy editions per state with mandatory endorsement sets, maintained in the form table.',
        scope: 'Geography',
        geo: 'US (51 jurisdictions)',
        ref: 'FORM_ATTACH (Oracle)',
        slug: 'forms-wordings-personal-auto-form-sets',
        norm: 'forms',
      },
      {
        cmp: 'Eligibility & UW Rules',
        name: 'MVR threshold at 6 points',
        detail:
          'Drivers over 6 MVR points route to non-standard; over 12 decline — thresholds shared by all tiers.',
        scope: 'Segment',
        seg: 'Personal Lines',
        ref: 'Eligibility.java : mvrPoints()',
        slug: 'eligibility-uw-rules-mvr-point-thresholds',
        norm: 'uwrules',
      },
      {
        cmp: 'Eligibility & UW Rules',
        name: 'Non-standard tier surcharge stamped during eligibility',
        detail:
          'When a driver exceeds 6 MVR points the eligibility pass writes a 1.25 surcharge factor onto the quote instead of routing the risk to the non-standard product’s filed rates.',
        scope: 'Segment',
        seg: 'Personal Lines',
        ref: 'Eligibility.java : applySurcharge()',
        target: 'pa:Rating & Pricing',
        why: {
          captured: 'MVR points and prior-carrier lapse days read during the eligibility pass.',
          sent: 'The stamped 1.25 factor flows into rating step 7 as if it were a filed relativity.',
          processed:
            'applySurcharge() multiplies the factor onto the quote before tier placement completes — pricing logic executing inside an eligibility rule.',
          validated:
            'The surcharge appears on no filed rate page — a compliance exposure in every filed state.',
          lands:
            'Rating & Pricing — tier as a rating dimension with filed relativities only; eligibility routes, it never prices.',
        },
      },
      {
        cmp: 'Eligibility & UW Rules',
        name: 'Massachusetts take-all-comers override',
        detail:
          'MA business bypasses declination rules per state law; implemented as a special-case branch.',
        scope: 'Geography',
        geo: 'US-MA',
        slug: 'eligibility-uw-rules-take-all-comers-rules',
      },
      {
        cmp: 'Exposures & Schedules',
        name: 'Garaging address distinct from mailing',
        detail: 'Rating uses the garaging address per vehicle; mismatch flags feed a fraud report.',
        scope: 'Segment',
        seg: 'Personal Lines',
        slug: 'exposures-schedules-garaging-address',
      },
      {
        cmp: 'Exposures & Schedules',
        name: 'VIN decode with annual symbol refresh',
        detail:
          'VIN decoding to make/model/symbol with an annual symbol table load from the bureau.',
        scope: 'Common',
        ref: 'VinDecoder.java',
        slug: 'exposures-schedules-vehicle-schedule',
      },
      {
        cmp: 'Regulatory & Filings',
        name: 'UM/UIM mandatory offer & rejection tracking',
        detail:
          'Signed UM offer/rejection artifacts stored per policy to evidence the statutory offer.',
        scope: 'Geography',
        geo: 'US (offer states)',
        slug: 'regulatory-filings-mandatory-offer-tracking',
        norm: 'filings',
      },
      {
        cmp: 'Distribution',
        name: 'Comparative rater integration',
        detail:
          'Real-time rate calls from comparative raters; lead source recorded per quote for attribution.',
        scope: 'Segment',
        seg: 'Personal Lines',
        slug: 'distribution-lead-source-tracking',
      },
    ],
  },
  {
    key: 'ann',
    name: 'Mainframe Annuity Master',
    description:
      'The COBOL/VSAM individual-annuity block: one product per generation (ANN85/ANN92/ANN01), crediting rates maintained by JCL batch.',
    sourceSystem: 'Annuity Master (COBOL / CICS, VSAM)',
    segment: 'Specialty',
    geography: 'US',
    disposition: 'Replace',
    canonical: 'ann',
    findings: [
      {
        cmp: 'Party & Roles',
        name: 'Primary/contingent beneficiary designations',
        detail:
          'Beneficiaries with percentage splits in the contract copybook; per-beneficiary tax status captured.',
        scope: 'Common',
        ref: 'ANNMAST copybook : BENE-SEG',
        slug: 'party-roles-beneficiary',
        norm: 'beneficiary',
      },
      {
        cmp: 'Party & Roles',
        name: 'Attorney-in-fact records for group contracts',
        detail:
          'Group annuity contracts carry an attorney-in-fact role from the reciprocal-era block.',
        scope: 'Common',
        slug: 'party-roles-attorney-in-fact',
      },
      {
        cmp: 'Product Hierarchy',
        name: 'Product generations as separate products (ANN85/ANN92/ANN01)',
        detail:
          'Each pricing generation is a whole cloned product; no version lineage connects them.',
        scope: 'Common',
        ref: 'VSAM : PRODMAST',
        slug: 'product-hierarchy-product-version-and-effective-dating',
        norm: 'versions',
      },
      {
        cmp: 'Rating & Pricing',
        name: 'Crediting rate table updated via JCL batch',
        detail:
          'Declared interest crediting rates loaded monthly by JCL job ANN010; no intra-month correction path.',
        scope: 'Common',
        ref: 'JCL : ANN010',
        slug: 'rating-pricing-base-rates',
      },
      {
        cmp: 'Rating & Pricing',
        name: '7-year CDSC surrender charge schedule',
        detail:
          'Contingent deferred sales charge 7/6/5/4/3/2/1% by contract year, hard-coded per generation.',
        scope: 'Common',
        ref: 'ANNCALC : CDSC-TBL',
        slug: 'rating-pricing-rate-order-of-calculation',
      },
      {
        cmp: 'Rating & Pricing',
        name: 'Market-value adjustment on surrender',
        detail:
          'MVA formula applied on surrenders outside the window; parameters differ per generation without documentation.',
        scope: 'Common',
        slug: 'rating-pricing-rating-factors-and-relativities',
      },
      {
        cmp: 'Forms & Wordings',
        name: 'Contract pages composed in IBM AFP',
        detail:
          'Contract issuance renders AFP page segments; merge variables maintained in assembler macros.',
        scope: 'Common',
        ref: 'AFP : ANNCON01',
        slug: 'forms-wordings-merge-variables',
      },
      {
        cmp: 'Forms & Wordings',
        name: 'Braille contract generator',
        detail:
          'A braille output path unreachable since the 2009 print-vendor migration; superseded by vendor accessibility services.',
        scope: 'Eliminate',
        ref: 'ANNBRL (load module)',
        dead: true,
        why: {
          captured: 'Contract data extracted from the ANNMAST record for braille embossing.',
          sent: 'Output routed to a print-vendor drop that was decommissioned in the 2009 migration.',
          processed: 'ANNBRL translates AFP page segments into braille cell encoding.',
          validated:
            'Unreachable — the JCL step invoking ANNBRL was removed from the ANN020 issuance job in 2009.',
          lands: 'Dead code — vendor accessibility services supersede it; retire with sign-off.',
        },
      },
      {
        cmp: 'Rating & Pricing',
        name: 'Premium tax accrual computed in the crediting batch',
        detail:
          'The TAXACCR step of JCL job ANN010 accrues state premium tax alongside the monthly crediting-rate load; per-state rates live in the batch parameter card.',
        scope: 'Common',
        ref: 'JCL : ANN010 (TAXACCR step)',
        target: 'ann:Regulatory & Filings',
        why: {
          captured: 'Considerations received per contract, summed from the PAYHIST segment.',
          sent: 'Accrual totals written to the GL extract file that finance consumes at month-end.',
          processed:
            'TAXACCR multiplies a per-state rate from the parameter card during the crediting run — tax logic living inside pricing batch.',
          validated:
            'The rate card is updated by hand — the 2023 Maine rate change was missed for two cycles.',
          lands:
            'Regulatory & Filings — jurisdictional premium-tax table applied by the canonical model, outside the rating path.',
        },
      },
      {
        cmp: 'Eligibility & UW Rules',
        name: 'NY Reg 187 suitability results as flat text',
        detail:
          'Best-interest suitability questionnaire outcomes stored as a free-text field, unqueryable for audits.',
        scope: 'Geography',
        geo: 'US-NY',
        ref: 'ANNMAST : SUIT-TEXT',
        slug: 'eligibility-uw-rules-risk-scoring-inputs',
        norm: 'uwrules',
      },
      {
        cmp: 'Reinsurance & Layering',
        name: 'Closed-block coinsurance cession',
        detail:
          'The pre-1992 block is 80% coinsured; cession accounting runs in a quarterly batch.',
        scope: 'Common',
        slug: 'reinsurance-layering-cession-rules',
      },
      {
        cmp: 'Regulatory & Filings',
        name: 'IIPRC vs state-filed product split',
        detail:
          'Post-2010 products filed via the Interstate Compact; older generations state-by-state — the split lives in a spreadsheet.',
        scope: 'Geography',
        geo: 'US (compact + non-compact states)',
        slug: 'regulatory-filings-iiprc-compact-filings',
        norm: 'filings',
      },
      {
        cmp: 'Regulatory & Filings',
        name: 'FATCA/CRS payee status capture',
        detail:
          'W-8/W-9 and CRS self-certification status on annuitant payees, captured at claim time only.',
        scope: 'Geography',
        geo: 'US (cross-border payees)',
        slug: 'regulatory-filings-fatca-crs-reporting',
      },
      {
        cmp: 'Distribution',
        name: 'Commission chargeback on early surrender',
        detail:
          'First-year commission clawed back on surrenders within 12 months; computed in the surrender batch.',
        scope: 'Common',
        ref: 'ANNSURR : CHGBK',
        slug: 'distribution-commission-calculation-and-statements',
      },
    ],
  },
  {
    key: 'ldn',
    name: 'London Market Binder',
    description:
      'The Lloyd’s delegated-authority binder book: MRC slips, line sizes and burning-cost rating maintained in a binder-management app plus Excel.',
    sourceSystem: 'Binder Management (London) + Excel',
    segment: "Lloyd's",
    geography: 'UK',
    disposition: 'Refactor',
    canonical: 'ldn',
    findings: [
      {
        cmp: 'Party & Roles',
        name: 'Coverholder & syndicate panel records',
        detail:
          'Coverholder PINs and syndicate stamp/participation records per binder year of account.',
        scope: 'Segment',
        seg: "Lloyd's",
        slug: 'party-roles-lloyd-s-coverholder',
      },
      {
        cmp: 'Product Hierarchy',
        name: 'Binder sections by class with TSI caps',
        detail:
          'Each binder year splits into class sections carrying their own total-sum-insured caps and exclusions.',
        scope: 'Segment',
        seg: "Lloyd's",
        slug: 'product-hierarchy-lloyd-s-binder-section-structure',
        norm: 'versions',
      },
      {
        cmp: 'Product Hierarchy',
        name: 'IDD target-market statements per product family',
        detail:
          'POG target-market definitions maintained per family for UK/EU distribution compliance.',
        scope: 'Geography',
        geo: 'UK / EU',
        slug: 'product-hierarchy-idd-product-governance-family',
      },
      {
        cmp: 'Coverage & Perils',
        name: 'Institute war & strikes clauses',
        detail:
          'War/SRCC cover added by institute clauses per section; sanctions carve-outs updated by circular.',
        scope: 'Segment',
        seg: "Lloyd's",
        slug: 'coverage-perils-war-and-strikes-clauses',
      },
      {
        cmp: 'Limits & Deductibles',
        name: 'Line size & order percentage per risk',
        detail: 'Signed lines vs written lines with signing-down mechanics per subscription risk.',
        scope: 'Segment',
        seg: "Lloyd's",
        slug: 'limits-deductibles-lloyd-s-line-size-and-order',
      },
      {
        cmp: 'Rating & Pricing',
        name: 'Burning-cost rating workbook',
        detail:
          'Section rates derived from a shared Excel burning-cost workbook uploaded quarterly; formulas unversioned.',
        scope: 'Segment',
        seg: "Lloyd's",
        ref: 'BinderRates.xlsx (shared drive)',
        slug: 'rating-pricing-burning-cost-rating',
        why: {
          captured: 'Historic premium and loss triangles pasted per section.',
          sent: 'Section rates re-keyed by hand from BinderRates.xlsx into the binder system at each renewal.',
          processed: 'Burn rate and loadings computed by spreadsheet formulas.',
          validated: 'None — no version control or peer sign-off on formula changes.',
          lands: 'Canonical rating service with versioned burning-cost tables (Rating & Pricing).',
        },
      },
      {
        cmp: 'Rating & Pricing',
        name: 'UK IPT 12% computed at quote',
        detail:
          'Insurance premium tax applied inside the quote workbook; exempt classes flagged by hand.',
        scope: 'Geography',
        geo: 'UK',
        slug: 'rating-pricing-uk-ipt',
        norm: 'taxes',
      },
      {
        cmp: 'Forms & Wordings',
        name: 'MRC slip templates per class',
        detail:
          'Market Reform Contract templates with section schedules; security pages generated at signing.',
        scope: 'Segment',
        seg: "Lloyd's",
        slug: 'forms-wordings-lloyd-s-mrc',
        norm: 'mrc',
      },
      {
        cmp: 'Forms & Wordings',
        name: 'Consumer Duty fair-value documents',
        detail: 'FCA fair-value assessment and plain-language docs per consumer-facing product.',
        scope: 'Geography',
        geo: 'UK',
        slug: 'forms-wordings-uk-consumer-duty-wordings',
      },
      {
        cmp: 'Eligibility & UW Rules',
        name: 'Delegated binding authority limits',
        detail:
          'Per-coverholder binding limits by class, TIV and territory; breaches surface only at bordereau review.',
        scope: 'Segment',
        seg: "Lloyd's",
        slug: 'eligibility-uw-rules-lloyd-s-delegated-authority-eligibility',
        norm: 'uwrules',
        target: 'ldn:Rating & Pricing',
        why: {
          captured:
            'Per-coverholder binding limits by class, TIV and territory held in the binder-management app.',
          sent: 'Monthly premium bordereaux are the first place a bound risk meets the limit table.',
          processed:
            'Breach detection runs as a bordereau reconciliation query, weeks after the risk is bound.',
          validated: 'Nothing blocks an out-of-authority bind at the point of quote.',
          lands:
            'Rating & Pricing — authority limits evaluated in-line when the coverholder rates the risk, before bind.',
        },
      },
      {
        cmp: 'Reinsurance & Layering',
        name: 'Monthly bordereaux ingestion (CSV)',
        detail:
          'Premium/claims bordereaux ingested monthly as CSV with per-coverholder column mappings.',
        scope: 'Segment',
        seg: "Lloyd's",
        slug: 'reinsurance-layering-bordereaux-definitions',
      },
      {
        cmp: 'Reinsurance & Layering',
        name: 'Pool Re terrorism participation',
        detail: 'UK terrorism written through Pool Re membership with its retrocession mechanics.',
        scope: 'Geography',
        geo: 'UK',
        slug: 'reinsurance-layering-pool-re-participation',
      },
      {
        cmp: 'Regulatory & Filings',
        name: 'Solvency II QRT line mapping',
        detail:
          'Binder sections mapped to Solvency II lines of business for quarterly QRT reporting.',
        scope: 'Geography',
        geo: 'UK / EU',
        slug: 'regulatory-filings-solvency-ii-reporting-lines',
        norm: 'taxes',
      },
      {
        cmp: 'Regulatory & Filings',
        name: 'IFRS 17 cohort & CSM groupings',
        detail:
          'Annual cohorts and onerous-contract groupings assigned per binder year for IFRS 17 measurement.',
        scope: 'Geography',
        geo: 'UK / EU',
        slug: 'regulatory-filings-ifrs-17-cohorts',
      },
      {
        cmp: 'Distribution',
        name: 'Broker commission & brokerage on the slip',
        detail:
          'Brokerage and coverholder commission percentages recorded on the MRC; no central schedule.',
        scope: 'Segment',
        seg: "Lloyd's",
        slug: 'distribution-wholesale-mga-mgu-agreements',
      },
    ],
  },
];

const STATUS_LADDER = ['Identified', 'In Analysis', 'Normalized', 'In Migration', 'Migrated'];

export type ProductModelPlan = {
  workspace: { id: string; name: string; description: string; northstar: string };
  canonicals: (CanonicalDef & { id: string })[];
  components: {
    id: string;
    canonicalKey: string;
    component: ProductComponent;
    name: string;
    principle: string;
    migrationStatus: string;
    sortOrder: number;
  }[];
  entries: (NormDef & { id: string; componentId: string | null })[];
  legacyModels: (Omit<LegacyDef, 'findings'> & { id: string; position: number })[];
  findings: {
    id: string;
    legacyKey: string;
    legacyModelId: string;
    def: FindingDef;
    anatomySlug: string | null;
    targetComponentId: string | null;
    normalizationEntryId: string | null;
    migrationStatus: string;
  }[];
};

// Pure builder (unit-testable without a DB): resolves all cross-references to
// deterministic ids and throws on a dangling norm/target/component reference.
export function buildProductModelPlan(): ProductModelPlan {
  const canonicals = CANONICALS.map((c) => ({ ...c, id: `pmcan_${c.key}` }));

  const components: ProductModelPlan['components'] = [];
  const componentId = new Map<string, string>(); // "<canonicalKey>:<component>" -> id
  for (const c of CANONICALS) {
    c.components.forEach((cmp, i) => {
      const id = `pmc_${c.key}_${COMPONENT_SLUGS[cmp]}`;
      componentId.set(`${c.key}:${cmp}`, id);
      components.push({
        id,
        canonicalKey: c.key,
        component: cmp,
        name: `${cmp} — ${c.line}`,
        principle:
          'Common As Possible, Different As Needed — one canonical definition; genuine segment/geography variants stay as configuration.',
        migrationStatus: STATUS_LADDER[(i + c.key.length) % STATUS_LADDER.length],
        sortOrder: i,
      });
    });
  }

  const entries = NORMS.map((n, i) => {
    const cid = componentId.get(`${n.canonical}:${n.cmp}`);
    if (cid === undefined)
      throw new Error(
        `Normalization entry ${n.key} references missing component ${n.canonical}:${n.cmp}`,
      );
    return { ...n, id: `pmn_${n.key}`, componentId: cid, sortOrder: i };
  });
  const entryId = new Map(entries.map((e) => [e.key, e.id]));

  const legacyModels = LEGACY.map((l, i) => ({
    key: l.key,
    name: l.name,
    description: l.description,
    sourceSystem: l.sourceSystem,
    segment: l.segment,
    geography: l.geography,
    disposition: l.disposition,
    canonical: l.canonical,
    id: `pml_${l.key}`,
    position: i,
  }));

  const findings: ProductModelPlan['findings'] = [];
  for (const model of LEGACY) {
    model.findings.forEach((def, i) => {
      const targetKey = def.target ?? `${model.canonical}:${def.cmp}`;
      const targetComponentId = componentId.get(targetKey) ?? null;
      if (def.target && targetComponentId === null)
        throw new Error(`Finding "${def.name}" references missing target component ${def.target}`);
      let normalizationEntryId: string | null = null;
      if (def.norm) {
        const nid = entryId.get(def.norm);
        if (nid === undefined)
          throw new Error(`Finding "${def.name}" references missing norm ${def.norm}`);
        normalizationEntryId = nid;
      }
      findings.push({
        id: `pmf_${model.key}_${i}`,
        legacyKey: model.key,
        legacyModelId: `pml_${model.key}`,
        def,
        anatomySlug: def.slug ?? null,
        targetComponentId,
        normalizationEntryId,
        migrationStatus:
          def.status ?? (def.dead ? 'Identified' : STATUS_LADDER[(i + model.key.length) % 4]),
      });
    });
  }

  return {
    workspace: {
      id: WS_ID,
      name: WS_NAME,
      description:
        'Rationalize the four legacy product definitions behind ABC Insurance’s commercial, personal, annuity and London-market books into canonical per-line product models.',
      northstar:
        'One canonical product model per major line: common anatomy shared, segment and geography variants held as data, dead definitions retired with sign-off.',
    },
    canonicals,
    components,
    entries,
    legacyModels,
    findings,
  };
}

export async function seedProductModel(
  prisma: PrismaClient,
  ctx: { tenantId: string; companyId: string; refs?: SpineRefs },
) {
  const { tenantId, companyId } = ctx;
  const plan = buildProductModelPlan();

  // Anatomy slugs -> ids (seedProductModelAnatomy must have run first).
  const anatomy = await prisma.productModelAnatomyCategory.findMany({
    where: { companyId },
    select: { id: true, slug: true },
  });
  const anatomyBySlug = new Map(anatomy.map((a) => [a.slug, a.id]));

  await prisma.productModelWorkspace.deleteMany({ where: { companyId } });

  await prisma.productModelWorkspace.create({
    data: { ...plan.workspace, tenantId, companyId, illustrative: true },
  });

  const canonicalRows: Prisma.CanonicalProductModelCreateManyInput[] = plan.canonicals.map(
    (c, i) => ({
      id: c.id,
      tenantId,
      companyId,
      workspaceId: WS_ID,
      name: c.name,
      description: c.description,
      lineOfBusiness: c.line,
      ownerRoleId: ctx.refs ? ctx.refs.roleResolver(c.ownerRole) : null,
      position: i,
      illustrative: true,
    }),
  );
  await prisma.canonicalProductModel.createMany({ data: canonicalRows });

  await prisma.productModelComponent.createMany({
    data: plan.components.map((c) => ({
      id: c.id,
      tenantId,
      companyId,
      workspaceId: WS_ID,
      component: c.component,
      name: c.name,
      principle: c.principle,
      canonicalModelId: `pmcan_${c.canonicalKey}`,
      migrationStatus: c.migrationStatus,
      sortOrder: c.sortOrder,
      illustrative: true,
    })),
  });

  await prisma.productModelNormalizationEntry.createMany({
    data: plan.entries.map((e, i) => ({
      id: e.id,
      tenantId,
      companyId,
      workspaceId: WS_ID,
      layer: e.cmp,
      notation: e.notation,
      name: e.name,
      matchStatus: e.matchStatus,
      matchBasis: e.matchBasis ?? null,
      differenceNote: e.differenceNote ?? null,
      proposedResolution: e.proposedResolution ?? null,
      componentId: e.componentId,
      sortOrder: i,
      illustrative: true,
    })),
  });

  await prisma.legacyProductModel.createMany({
    data: plan.legacyModels.map((l) => ({
      id: l.id,
      tenantId,
      companyId,
      workspaceId: WS_ID,
      name: l.name,
      description: l.description,
      sourceSystem: l.sourceSystem,
      segment: l.segment,
      geography: l.geography,
      disposition: l.disposition,
      position: l.position,
      illustrative: true,
    })),
  });

  let anatomyMisses = 0;
  await prisma.productModelFinding.createMany({
    data: plan.findings.map((f) => {
      const anatomyCategoryId = f.anatomySlug ? (anatomyBySlug.get(f.anatomySlug) ?? null) : null;
      if (f.anatomySlug && anatomyCategoryId === null) anatomyMisses++;
      return {
        id: f.id,
        tenantId,
        companyId,
        workspaceId: WS_ID,
        legacyModelId: f.legacyModelId,
        component: f.def.cmp,
        name: f.def.name,
        detail: f.def.detail,
        scope: f.def.scope,
        segmentValue: f.def.seg ?? null,
        geographyValue: f.def.geo ?? null,
        sourceRef: f.def.ref ?? null,
        anatomyCategoryId,
        targetComponentId: f.targetComponentId,
        normalizationEntryId: f.normalizationEntryId,
        migrationStatus: f.migrationStatus,
        deadCode: f.def.dead ?? false,
        whyThisMoves: f.def.why ?? undefined,
        illustrative: true,
      };
    }),
  });

  console.log(
    `   + product workspace "${WS_NAME}": ${plan.legacyModels.length} legacy models, ` +
      `${plan.findings.length} findings, ${plan.entries.length} normalization entries, ` +
      `${plan.components.length} components, ${plan.canonicals.length} canonical models` +
      (anatomyMisses ? ` (⚠ ${anatomyMisses} anatomy slug misses)` : ''),
  );
}
