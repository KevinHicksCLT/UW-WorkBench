// Forms Rationalization — hand-authored mock dataset (FR-8.1 ingestion is
// deferred; this dataset satisfies the same floor: 3 core forms, variations
// across CA/NY/TX/FL (+ NV/AZ for the Western States unify demo), product-
// specific variants on 2 products, 2 pre-built AI clusters, 1 retire
// candidate). Authored to the §3 naming convention: a state token in the form
// id (-CA-, -NY-…) marks a state variation; no token = countrywide.

import type { FormRecord, RegionDef } from './types';

/** The mock product catalog. PA-100 attaches 18 products (FR-1.1 example). */
export const PRODUCTS: { id: string; name: string; lob: string }[] = [
  { id: 'pa-advantage', name: 'Auto Advantage', lob: 'Personal Auto' },
  { id: 'pa-preferred', name: 'Auto Preferred', lob: 'Personal Auto' },
  { id: 'pa-essential', name: 'Auto Essential', lob: 'Personal Auto' },
  { id: 'pa-classic', name: 'Auto Classic', lob: 'Personal Auto' },
  { id: 'pa-select', name: 'Auto Select', lob: 'Personal Auto' },
  { id: 'pa-elite', name: 'Auto Elite', lob: 'Personal Auto' },
  { id: 'pa-value', name: 'Auto Value', lob: 'Personal Auto' },
  { id: 'pa-young-driver', name: 'First Road (Young Driver)', lob: 'Personal Auto' },
  { id: 'pa-telematics', name: 'DriveSmart Telematics', lob: 'Personal Auto' },
  { id: 'pa-rideshare', name: 'Rideshare Flex', lob: 'Personal Auto' },
  { id: 'pa-antique', name: 'Antique & Collector', lob: 'Personal Auto' },
  { id: 'pa-motorcycle', name: 'Motorcycle Companion', lob: 'Personal Auto' },
  { id: 'pa-sr22', name: 'SR-22 Filing Program', lob: 'Personal Auto' },
  { id: 'pa-military', name: 'Military & Overseas', lob: 'Personal Auto' },
  { id: 'pa-senior', name: 'Senior Advantage', lob: 'Personal Auto' },
  { id: 'pa-bundle', name: 'Auto + Home Bundle', lob: 'Personal Auto' },
  { id: 'pa-nonowner', name: 'Named Non-Owner', lob: 'Personal Auto' },
  { id: 'pa-commuter', name: 'Metro Commuter', lob: 'Personal Auto' },
  { id: 'ho-liberty', name: 'Liberty Homeowner HO-3', lob: 'Homeowners' },
  { id: 'ho-stateauto', name: 'State Auto Homeowner HO-3', lob: 'Homeowners' },
  { id: 'ho-safeauto', name: 'Safe Auto Homeowner HO-3', lob: 'Homeowners' },
];

export const PRODUCT_NAME: Record<string, string> = Object.fromEntries(
  PRODUCTS.map((p) => [p.id, p.name]),
);

const PA_ALL = PRODUCTS.filter((p) => p.lob === 'Personal Auto').map((p) => p.id);
const PA_BIG3 = ['pa-advantage', 'pa-preferred', 'pa-essential'];
const HO_ALL = PRODUCTS.filter((p) => p.lob === 'Homeowners').map((p) => p.id);

/** Default multistate regions (FR-2.2) — the UNIFY target containers. */
export const DEFAULT_REGIONS: RegionDef[] = [
  { name: 'Western States', states: ['CA', 'NV', 'AZ'] },
  { name: 'Northeast', states: ['NY', 'NJ', 'CT'] },
  { name: 'Gulf States', states: ['TX', 'FL', 'LA'] },
];

const n = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);

export const MOCK_FORMS: FormRecord[] = [
  // ── Core (countrywide) forms ──────────────────────────────────────────────
  {
    formId: 'PA-100',
    title: 'Personal Auto Policy',
    description: 'Countrywide core personal auto policy form — the enterprise base contract.',
    lineOfBusiness: 'Personal Auto',
    productIds: PA_ALL,
    layer: 'CORE',
    parentFormId: null,
    state: null,
    region: null,
    coverageRefs: ['Liability', 'Collision', 'Comprehensive', 'Medical Payments'],
    existenceReason: 'STATUTORY',
    regulatoryCitations: ['ISO PP 00 01 (base)', 'NAIC Model #775'],
    relatedRules: ['Rating rule R-100', 'Underwriting rule U-12'],
    relatedForms: ['PA-UM-100', 'PA-200-UBI'],
    filingDependencies: ['Countrywide filing CW-2019-114'],
    cluster: null,
    sections: [
      {
        heading: 'Insuring Agreement',
        text: 'We will pay damages for bodily injury or property damage for which any insured becomes legally responsible because of an auto accident.',
        diff: null,
      },
      {
        heading: 'Definitions',
        text: '"Insured" means you or any family member for the ownership, maintenance or use of any auto or trailer.',
        diff: null,
      },
    ],
    agent: null,
  },
  {
    formId: 'PA-UM-100',
    title: 'Uninsured / Underinsured Motorist Endorsement',
    description: 'Countrywide UM/UIM coverage endorsement attached to the core auto policy.',
    lineOfBusiness: 'Personal Auto',
    productIds: PA_ALL,
    layer: 'CORE',
    parentFormId: null,
    state: null,
    region: null,
    coverageRefs: ['UM/UIM'],
    existenceReason: 'STATUTORY',
    regulatoryCitations: ['ISO PP 04 11', 'NAIC UM model act'],
    relatedRules: ['Rating rule R-140'],
    relatedForms: ['PA-100', 'CA-UM-001'],
    filingDependencies: ['Countrywide filing CW-2020-071'],
    cluster: null,
    sections: [
      {
        heading: 'UM/UIM Insuring Agreement',
        text: 'We will pay compensatory damages which an insured is legally entitled to recover from the owner or operator of an uninsured motor vehicle.',
        diff: null,
      },
    ],
    agent: null,
  },
  {
    formId: 'HO-300',
    title: 'Homeowners Policy (HO-3)',
    description: 'Countrywide core special-form homeowners policy.',
    lineOfBusiness: 'Homeowners',
    productIds: HO_ALL,
    layer: 'CORE',
    parentFormId: null,
    state: null,
    region: null,
    coverageRefs: ['Dwelling', 'Personal Property', 'Liability', 'Loss of Use'],
    existenceReason: 'STATUTORY',
    regulatoryCitations: ['ISO HO 00 03'],
    relatedRules: ['Rating rule R-300'],
    relatedForms: ['HO-301-FL', 'HO-302-TX'],
    filingDependencies: ['Countrywide filing CW-2018-203'],
    cluster: null,
    sections: [
      {
        heading: 'Coverage A — Dwelling',
        text: 'We cover the dwelling on the residence premises, including structures attached to the dwelling.',
        diff: null,
      },
    ],
    agent: null,
  },

  // ── California cluster (FR-4.1: 92% — PA-101-CA · AUTO-CA-001 · AU-CA-010) ─
  {
    formId: 'PA-101-CA',
    title: 'California Amendment of Policy Provisions',
    description: 'CA amendatory endorsement carrying statutory UM wording and cancellation rules.',
    lineOfBusiness: 'Personal Auto',
    productIds: ['pa-advantage', 'pa-essential'],
    layer: 'STATE_VARIATION',
    parentFormId: 'PA-100',
    state: 'CA',
    region: 'Western States',
    coverageRefs: ['Liability', 'UM/UIM'],
    existenceReason: 'STATUTORY',
    regulatoryCitations: ['CA Ins. Code §11580.2', 'CA Ins. Code §663'],
    relatedRules: ['CA cancellation rule C-05'],
    relatedForms: ['AUTO-CA-001', 'AU-CA-010', 'CA-UM-001'],
    filingDependencies: ['CA DOI filing CA-2021-330'],
    cluster: { clusterId: 'CL-CA-1', similarityPct: 92 },
    sections: [
      {
        heading: 'Insuring Agreement',
        text: 'We will pay damages for bodily injury or property damage for which any insured becomes legally responsible because of an auto accident.',
        diff: null,
      },
      {
        heading: 'California Cancellation',
        text: 'Cancellation is limited to the grounds enumerated in California Insurance Code Section 661 and notice periods in Section 663.',
        diff: 'statutory',
      },
    ],
    agent: {
      disposition: 'KEEP_STATE_VARIATION',
      reason:
        'California statutory wording requirement — cancellation grounds are prescribed verbatim.',
      evidence: ['CA Ins. Code §11580.2', 'CA Ins. Code §663'],
    },
  },
  {
    formId: 'AUTO-CA-001',
    title: 'CA Auto Policy Amendment (legacy AUTO series)',
    description: 'Duplicate CA amendatory endorsement inherited from the legacy AUTO product line.',
    lineOfBusiness: 'Personal Auto',
    productIds: ['pa-preferred'],
    layer: 'STATE_VARIATION',
    parentFormId: 'PA-100',
    state: 'CA',
    region: 'Western States',
    coverageRefs: ['Liability', 'UM/UIM'],
    existenceReason: 'UNKNOWN',
    regulatoryCitations: ['CA Ins. Code §11580.2'],
    relatedRules: ['CA cancellation rule C-05'],
    relatedForms: ['PA-101-CA', 'AU-CA-010'],
    filingDependencies: ['CA DOI filing CA-2016-102'],
    cluster: { clusterId: 'CL-CA-1', similarityPct: 92 },
    sections: [
      {
        heading: 'Insuring Agreement',
        text: 'We will pay damages for bodily injury or property damage for which any insured becomes legally responsible because of an auto accident.',
        diff: null,
      },
      {
        heading: 'California Cancellation',
        text: 'Cancellation shall be limited to the grounds of California Insurance Code Section 661, with notice as required by Section 663.',
        diff: 'formatting',
      },
    ],
    agent: {
      disposition: 'STANDARDIZE',
      reason:
        'Requirement already covered by PA-101-CA / core form — differences are formatting only.',
      evidence: ['92% cluster similarity to PA-101-CA', 'No unique statutory language'],
    },
  },
  {
    formId: 'AU-CA-010',
    title: 'CA Amendment (retired AU series)',
    description:
      'Third CA amendatory variant from the retired AU rating plan. No policies in force.',
    lineOfBusiness: 'Personal Auto',
    productIds: ['pa-classic'],
    layer: 'STATE_VARIATION',
    parentFormId: 'PA-100',
    state: 'CA',
    region: 'Western States',
    coverageRefs: ['Liability'],
    existenceReason: 'LEGACY_ARTIFACT',
    regulatoryCitations: [],
    relatedRules: [],
    relatedForms: ['PA-101-CA', 'AUTO-CA-001'],
    filingDependencies: [],
    cluster: { clusterId: 'CL-CA-1', similarityPct: 92 },
    sections: [
      {
        heading: 'Insuring Agreement',
        text: 'We will pay damages for bodily injury or property damage for which any insured becomes legally responsible because of an auto accident.',
        diff: null,
      },
      {
        heading: 'AU Series Rating Note',
        text: 'Premium shall be computed under the AU rating plan, edition 07-2009.',
        diff: 'product',
      },
    ],
    agent: {
      disposition: 'RETIRE',
      reason: 'No active filing dependency and no policies in force on the AU series.',
      evidence: ['Zero filing dependencies', 'AU rating plan retired 2019'],
    },
  },
  {
    formId: 'CA-UM-001',
    title: 'California UM/UIM Coverage Endorsement',
    description: 'CA-specific uninsured motorist endorsement with §11580.2 election wording.',
    lineOfBusiness: 'Personal Auto',
    productIds: PA_ALL.slice(0, 12),
    layer: 'STATE_VARIATION',
    parentFormId: 'PA-100',
    state: 'CA',
    region: 'Western States',
    coverageRefs: ['UM/UIM'],
    existenceReason: 'STATUTORY',
    regulatoryCitations: [
      'CA Ins. Code §11580.2',
      'CA Ins. Code §11580.26',
      'CA Ins. Code §11580.1',
      ...n('CA DOI Bulletin', 12),
    ],
    relatedRules: n('CA UM rule', 23),
    relatedForms: ['PA-UM-100', 'PA-101-CA', 'AUTO-CA-001', 'AU-CA-010', 'PA-100'],
    filingDependencies: ['CA DOI filing CA-2022-018'],
    cluster: null,
    sections: [
      {
        heading: 'UM/UIM Insuring Agreement',
        text: 'We will pay compensatory damages which an insured is legally entitled to recover from the owner or operator of an uninsured motor vehicle.',
        diff: null,
      },
      {
        heading: 'California Election',
        text: 'Coverage may be deleted or offered at lower limits only with a written waiver conforming to Insurance Code Section 11580.2(a)(2).',
        diff: 'statutory',
      },
    ],
    agent: {
      disposition: 'KEEP_STATE_VARIATION',
      reason: 'California statutory election wording must appear verbatim.',
      evidence: ['CA Ins. Code §11580.2'],
    },
  },

  // ── New York cluster (FR-4.1: 96% — PA-102-NY · AUTO-NY-002) ─────────────
  {
    formId: 'PA-102-NY',
    title: 'New York Amendment of Policy Provisions',
    description: 'NY amendatory endorsement — Reg 35-D supplementary UM and no-fault conformity.',
    lineOfBusiness: 'Personal Auto',
    productIds: ['pa-advantage', 'pa-preferred'],
    layer: 'STATE_VARIATION',
    parentFormId: 'PA-100',
    state: 'NY',
    region: 'Northeast',
    coverageRefs: ['Liability', 'PIP', 'UM/UIM'],
    existenceReason: 'DOI_REQUIREMENT',
    regulatoryCitations: ['NY Reg 35-D', 'NY Ins. Law §3420'],
    relatedRules: ['NY no-fault rule NF-01'],
    relatedForms: ['AUTO-NY-002'],
    filingDependencies: ['NY DFS filing NY-2020-455'],
    cluster: { clusterId: 'CL-NY-1', similarityPct: 96 },
    sections: [
      {
        heading: 'Insuring Agreement',
        text: 'We will pay damages for bodily injury or property damage for which any insured becomes legally responsible because of an auto accident.',
        diff: null,
      },
      {
        heading: 'NY Supplementary UM',
        text: 'Supplementary uninsured/underinsured motorists coverage is provided as required by Regulation 35-D.',
        diff: 'statutory',
      },
    ],
    agent: {
      disposition: 'KEEP_STATE_VARIATION',
      reason: 'NY DFS prescribes Reg 35-D wording for supplementary UM.',
      evidence: ['NY Reg 35-D'],
    },
  },
  {
    formId: 'AUTO-NY-002',
    title: 'NY Auto Amendment (legacy AUTO series)',
    description: 'Duplicate NY amendatory endorsement from the legacy AUTO product line.',
    lineOfBusiness: 'Personal Auto',
    productIds: ['pa-essential'],
    layer: 'STATE_VARIATION',
    parentFormId: 'PA-100',
    state: 'NY',
    region: 'Northeast',
    coverageRefs: ['Liability', 'PIP'],
    existenceReason: 'LEGACY_ARTIFACT',
    regulatoryCitations: ['NY Reg 35-D'],
    relatedRules: ['NY no-fault rule NF-01'],
    relatedForms: ['PA-102-NY'],
    filingDependencies: ['NY DFS filing NY-2015-092'],
    cluster: { clusterId: 'CL-NY-1', similarityPct: 96 },
    sections: [
      {
        heading: 'Insuring Agreement',
        text: 'We will pay damages for bodily injury or property damage for which any insured becomes legally responsible because of an auto accident.',
        diff: null,
      },
      {
        heading: 'NY Supplementary UM',
        text: 'Supplementary uninsured/underinsured motorists coverage is afforded in accordance with Regulation 35-D.',
        diff: 'formatting',
      },
    ],
    agent: {
      disposition: 'STANDARDIZE',
      reason: 'Requirement already covered in PA-102-NY — 96% identical.',
      evidence: ['96% cluster similarity to PA-102-NY'],
    },
  },

  // ── Other state variations ────────────────────────────────────────────────
  {
    formId: 'PA-103-TX',
    title: 'Texas Amendment of Policy Provisions',
    description: 'TX amendatory endorsement — named-driver disclosure and PIP offer.',
    lineOfBusiness: 'Personal Auto',
    productIds: ['pa-advantage'],
    layer: 'STATE_VARIATION',
    parentFormId: 'PA-100',
    state: 'TX',
    region: 'Gulf States',
    coverageRefs: ['Liability', 'PIP'],
    existenceReason: 'STATE_DISCLOSURE',
    regulatoryCitations: ['TX Ins. Code §1952.152'],
    relatedRules: ['TX PIP rule P-02'],
    relatedForms: ['PA-100'],
    filingDependencies: ['TX TDI filing TX-2021-207'],
    cluster: null,
    sections: [
      {
        heading: 'PIP Offer',
        text: 'Personal injury protection is provided unless rejected in writing as permitted by Texas Insurance Code Chapter 1952.',
        diff: 'statutory',
      },
    ],
    agent: {
      disposition: 'STANDARDIZE',
      reason: 'PIP offer language can be absorbed into the core form as a Texas conditional block.',
      evidence: ['No verbatim-wording mandate in TX Ins. Code §1952.152'],
    },
  },
  {
    formId: 'PA-104-FL',
    title: 'Florida Amendment of Policy Provisions',
    description: 'FL amendatory endorsement — No-Fault (PIP) statutory benefits schedule.',
    lineOfBusiness: 'Personal Auto',
    productIds: ['pa-advantage', 'pa-essential'],
    layer: 'STATE_VARIATION',
    parentFormId: 'PA-100',
    state: 'FL',
    region: 'Gulf States',
    coverageRefs: ['PIP'],
    existenceReason: 'STATUTORY',
    regulatoryCitations: ['FL Stat. §627.736'],
    relatedRules: ['FL PIP fee schedule rule'],
    relatedForms: ['PA-100'],
    filingDependencies: ['FL OIR filing FL-2022-140'],
    cluster: null,
    sections: [
      {
        heading: 'Florida No-Fault',
        text: 'We will pay personal injury protection benefits in accordance with the Florida Motor Vehicle No-Fault Law.',
        diff: 'statutory',
      },
    ],
    agent: {
      disposition: 'KEEP_STATE_VARIATION',
      reason: 'FL No-Fault benefits schedule is statutory and state-unique.',
      evidence: ['FL Stat. §627.736'],
    },
  },
  {
    formId: 'PA-105-NV',
    title: 'Nevada Amendment of Policy Provisions',
    description: 'NV amendatory endorsement — near-identical to the CA/AZ amendments.',
    lineOfBusiness: 'Personal Auto',
    productIds: ['pa-advantage'],
    layer: 'STATE_VARIATION',
    parentFormId: 'PA-100',
    state: 'NV',
    region: 'Western States',
    coverageRefs: ['Liability', 'UM/UIM'],
    existenceReason: 'DOI_REQUIREMENT',
    regulatoryCitations: ['NV Rev. Stat. §690B.020'],
    relatedRules: [],
    relatedForms: ['PA-106-AZ', 'PA-101-CA'],
    filingDependencies: ['NV DOI filing NV-2019-066'],
    cluster: { clusterId: 'CL-WEST', similarityPct: 89 },
    sections: [
      {
        heading: 'UM Offer',
        text: 'Uninsured motorist coverage is offered at limits equal to bodily injury limits unless rejected in writing.',
        diff: null,
      },
    ],
    agent: {
      disposition: 'STANDARDIZE',
      reason: 'Candidate for a Western States multistate amendment with per-state rule sections.',
      evidence: ['89% similarity to AZ amendment', 'No verbatim-wording mandate'],
    },
  },
  {
    formId: 'PA-106-AZ',
    title: 'Arizona Amendment of Policy Provisions',
    description: 'AZ amendatory endorsement — near-identical to the CA/NV amendments.',
    lineOfBusiness: 'Personal Auto',
    productIds: ['pa-advantage'],
    layer: 'STATE_VARIATION',
    parentFormId: 'PA-100',
    state: 'AZ',
    region: 'Western States',
    coverageRefs: ['Liability', 'UM/UIM'],
    existenceReason: 'DOI_REQUIREMENT',
    regulatoryCitations: ['AZ Rev. Stat. §20-259.01'],
    relatedRules: [],
    relatedForms: ['PA-105-NV', 'PA-101-CA'],
    filingDependencies: ['AZ DOI filing AZ-2019-071'],
    cluster: { clusterId: 'CL-WEST', similarityPct: 89 },
    sections: [
      {
        heading: 'UM Offer',
        text: 'Uninsured motorist coverage is offered at limits equal to bodily injury limits unless rejected in writing by the named insured.',
        diff: 'formatting',
      },
    ],
    agent: {
      disposition: 'STANDARDIZE',
      reason: 'Candidate for a Western States multistate amendment with per-state rule sections.',
      evidence: ['89% similarity to NV amendment'],
    },
  },
  {
    formId: 'HO-301-FL',
    title: 'Florida Hurricane Deductible Endorsement',
    description: 'FL statutory hurricane deductible options and notice wording.',
    lineOfBusiness: 'Homeowners',
    productIds: HO_ALL,
    layer: 'STATE_VARIATION',
    parentFormId: 'HO-300',
    state: 'FL',
    region: 'Gulf States',
    coverageRefs: ['Dwelling'],
    existenceReason: 'STATUTORY',
    regulatoryCitations: ['FL Stat. §627.701'],
    relatedRules: ['FL hurricane deductible rule'],
    relatedForms: ['HO-300'],
    filingDependencies: ['FL OIR filing FL-2020-311'],
    cluster: null,
    sections: [
      {
        heading: 'Hurricane Deductible',
        text: 'A separate hurricane deductible of 2%, 5% or 10% of Coverage A applies to loss caused by a hurricane, with the statutory notice displayed in bold type.',
        diff: 'statutory',
      },
    ],
    agent: {
      disposition: 'KEEP_STATE_VARIATION',
      reason: 'FL requires the hurricane deductible notice verbatim and in bold type.',
      evidence: ['FL Stat. §627.701(4)(a)'],
    },
  },
  {
    formId: 'HO-302-TX',
    title: 'Texas Windstorm Exclusion Endorsement',
    description: 'TX coastal windstorm exclusion coordinating with TWIA coverage.',
    lineOfBusiness: 'Homeowners',
    productIds: ['ho-liberty', 'ho-stateauto'],
    layer: 'STATE_VARIATION',
    parentFormId: 'HO-300',
    state: 'TX',
    region: 'Gulf States',
    coverageRefs: ['Dwelling'],
    existenceReason: 'DOI_REQUIREMENT',
    regulatoryCitations: ['TX Ins. Code §2210'],
    relatedRules: ['TWIA coordination rule'],
    relatedForms: ['HO-300'],
    filingDependencies: ['TX TDI filing TX-2018-090'],
    cluster: null,
    sections: [
      {
        heading: 'Windstorm Exclusion',
        text: 'We do not insure loss caused by windstorm or hail in areas designated as catastrophe areas, where such coverage is available from TWIA.',
        diff: 'statutory',
      },
    ],
    agent: {
      disposition: 'KEEP_STATE_VARIATION',
      reason: 'Coastal windstorm carve-out coordinates with the state windstorm pool.',
      evidence: ['TX Ins. Code Chapter 2210'],
    },
  },

  // ── Product-specific variations ───────────────────────────────────────────
  {
    formId: 'PA-200-UBI',
    title: 'Telematics Program Endorsement',
    description: 'Usage-based-insurance endorsement exclusive to the DriveSmart product.',
    lineOfBusiness: 'Personal Auto',
    productIds: ['pa-telematics'],
    layer: 'PRODUCT_VARIATION',
    parentFormId: 'PA-100',
    state: null,
    region: null,
    coverageRefs: ['Rating'],
    existenceReason: 'PRODUCT_DIFFERENTIATION',
    regulatoryCitations: [],
    relatedRules: ['UBI rating rule R-210'],
    relatedForms: ['PA-100'],
    filingDependencies: ['Countrywide filing CW-2023-051'],
    cluster: null,
    sections: [
      {
        heading: 'Program Participation',
        text: 'Premium is adjusted at renewal based on recorded driving behavior while enrolled in the DriveSmart program.',
        diff: 'product',
      },
    ],
    agent: null,
  },
  {
    formId: 'PA-201-GA',
    title: 'Georgia Young Driver Program Endorsement',
    description: 'Product-specific young-driver curfew endorsement, filed only in Georgia.',
    lineOfBusiness: 'Personal Auto',
    productIds: ['pa-young-driver'],
    layer: 'PRODUCT_VARIATION',
    parentFormId: 'PA-100',
    state: 'GA',
    region: null,
    coverageRefs: ['Liability'],
    existenceReason: 'PRODUCT_DIFFERENTIATION',
    regulatoryCitations: ['GA DOI approval GA-2022-14'],
    relatedRules: ['Young driver rule Y-01'],
    relatedForms: ['PA-100'],
    filingDependencies: ['GA DOI filing GA-2022-140'],
    cluster: null,
    sections: [
      {
        heading: 'Curfew Condition',
        text: 'Coverage for drivers under 18 applies only between 5 a.m. and midnight unless accompanied by a listed adult driver.',
        diff: 'product',
      },
    ],
    agent: null,
  },
  {
    formId: 'HO-310-LIB',
    title: 'Liberty Homeowner Enhancement Endorsement',
    description: 'Liberty-branded coverage enhancement package (extended replacement cost).',
    lineOfBusiness: 'Homeowners',
    productIds: ['ho-liberty'],
    layer: 'PRODUCT_VARIATION',
    parentFormId: 'HO-300',
    state: null,
    region: null,
    coverageRefs: ['Dwelling', 'Personal Property'],
    existenceReason: 'PRODUCT_DIFFERENTIATION',
    regulatoryCitations: [],
    relatedRules: ['Enhancement rating rule R-310'],
    relatedForms: ['HO-300', 'HO-311-STA'],
    filingDependencies: ['Countrywide filing CW-2021-188'],
    cluster: { clusterId: 'CL-HO-ENH', similarityPct: 87 },
    sections: [
      {
        heading: 'Extended Replacement Cost',
        text: 'Coverage A is extended to 125% of the limit shown when the dwelling is insured to value.',
        diff: 'product',
      },
    ],
    agent: {
      disposition: 'STANDARDIZE',
      reason:
        'Both carrier enhancement packages grant 125% extended replacement cost — one core endorsement with branding removed covers both.',
      evidence: ['87% cluster similarity to HO-311-STA'],
    },
  },
  {
    formId: 'HO-311-STA',
    title: 'State Auto Homeowner Plus Endorsement',
    description: 'State Auto-branded coverage enhancement package (extended replacement cost).',
    lineOfBusiness: 'Homeowners',
    productIds: ['ho-stateauto'],
    layer: 'PRODUCT_VARIATION',
    parentFormId: 'HO-300',
    state: null,
    region: null,
    coverageRefs: ['Dwelling', 'Personal Property'],
    existenceReason: 'PRODUCT_DIFFERENTIATION',
    regulatoryCitations: [],
    relatedRules: ['Enhancement rating rule R-311'],
    relatedForms: ['HO-300', 'HO-310-LIB'],
    filingDependencies: ['Countrywide filing CW-2021-190'],
    cluster: { clusterId: 'CL-HO-ENH', similarityPct: 87 },
    sections: [
      {
        heading: 'Extended Replacement Cost',
        text: 'Coverage A is extended up to 125% of the stated limit provided the dwelling is insured to full value.',
        diff: 'formatting',
      },
    ],
    agent: null,
  },
];

// ── FR-3.1 — per-state requirement × product matrix (explicit mock mapping) ──
// Cell labels: 'Same' | 'Variant A' | 'Variant B' | 'Different'; identical
// variants share a label so matching cells group visually. formIds back the
// cell-click diff.

export interface MatrixCell {
  productId: string;
  label: 'Same' | 'Variant A' | 'Variant B' | 'Different';
  formIds: string[];
}

export interface MatrixRow {
  requirement: string;
  /** Which bucket the requirement contributes to in the summary band. */
  kind: 'common' | 'state' | 'product';
  cells: MatrixCell[];
}

export const MATRIX_BY_STATE: Record<string, MatrixRow[]> = {
  CA: [
    {
      requirement: 'Main Policy Form',
      kind: 'common',
      cells: PA_BIG3.map((p) => ({ productId: p, label: 'Same', formIds: ['PA-100'] })),
    },
    {
      requirement: 'CA Amendment',
      kind: 'state',
      cells: [
        { productId: 'pa-advantage', label: 'Variant A', formIds: ['PA-101-CA'] },
        { productId: 'pa-preferred', label: 'Variant B', formIds: ['AUTO-CA-001'] },
        { productId: 'pa-essential', label: 'Variant A', formIds: ['PA-101-CA'] },
      ],
    },
    {
      requirement: 'UM/UIM Coverage',
      kind: 'common',
      cells: PA_BIG3.map((p) => ({ productId: p, label: 'Same', formIds: ['CA-UM-001'] })),
    },
    {
      requirement: 'Consumer Disclosure',
      kind: 'product',
      cells: [
        { productId: 'pa-advantage', label: 'Different', formIds: ['PA-101-CA', 'AUTO-CA-001'] },
        { productId: 'pa-preferred', label: 'Different', formIds: ['AUTO-CA-001', 'AU-CA-010'] },
        { productId: 'pa-essential', label: 'Same', formIds: ['PA-101-CA'] },
      ],
    },
  ],
  NY: [
    {
      requirement: 'Main Policy Form',
      kind: 'common',
      cells: PA_BIG3.map((p) => ({ productId: p, label: 'Same', formIds: ['PA-100'] })),
    },
    {
      requirement: 'NY Amendment',
      kind: 'state',
      cells: [
        { productId: 'pa-advantage', label: 'Variant A', formIds: ['PA-102-NY'] },
        { productId: 'pa-preferred', label: 'Variant A', formIds: ['PA-102-NY'] },
        { productId: 'pa-essential', label: 'Variant B', formIds: ['AUTO-NY-002'] },
      ],
    },
    {
      requirement: 'Supplementary UM',
      kind: 'state',
      cells: PA_BIG3.map((p) => ({ productId: p, label: 'Same', formIds: ['PA-102-NY'] })),
    },
  ],
  TX: [
    {
      requirement: 'Main Policy Form',
      kind: 'common',
      cells: PA_BIG3.map((p) => ({ productId: p, label: 'Same', formIds: ['PA-100'] })),
    },
    {
      requirement: 'TX Amendment',
      kind: 'state',
      cells: PA_BIG3.map((p) => ({ productId: p, label: 'Same', formIds: ['PA-103-TX'] })),
    },
  ],
  FL: [
    {
      requirement: 'Main Policy Form',
      kind: 'common',
      cells: PA_BIG3.map((p) => ({ productId: p, label: 'Same', formIds: ['PA-100'] })),
    },
    {
      requirement: 'FL No-Fault (PIP)',
      kind: 'state',
      cells: PA_BIG3.map((p) => ({ productId: p, label: 'Same', formIds: ['PA-104-FL'] })),
    },
  ],
};
