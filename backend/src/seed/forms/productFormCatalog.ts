// ── Product → form-family catalog (SCRUM-229 forms single-source-of-truth) ──
// Maps every product-spine L3 product (by code) to the synthetic form family
// the library carries for it: number prefix, content chassis, and any specimen
// or manuscript paper that takes over a generated role. All content is
// fictional/specimen-grade — no real carrier text (serff-research-notes.md).

/** Form-number prefix per product code — unique across the catalog and
 *  disjoint from the manuscript prefixes (AL/CAN/CAR/CPP/CYB/DO/EL/OCIP/PE),
 *  the GL demo (GL/CG) and the specimen carriers (ASSIC-/NM-/PHX-/KA-). */
export const PREFIX_BY_PRODUCT: Record<string, string> = {
  'PL-ATV': 'ATV',
  'SPC-AVN': 'AVS',
  'LLD-AVN': 'AVB',
  'PL-BOAT': 'BW',
  'COM-BR': 'BRC',
  'SMB-UMB': 'BU',
  'SMB-BOP': 'BP',
  'RE-CAS': 'CTW',
  'PL-CLASSIC': 'CCA',
  'COM-AGRI': 'AGB',
  'COM-AUTO': 'CAF',
  'SMB-CRIME': 'CRM',
  'COM-CYBER': 'CYC',
  'COM-MARINE': 'OIM',
  'COM-PL': 'PLC',
  'COM-PROP': 'CPR',
  'COM-UMB': 'CUX',
  'PL-HO-CONDO': 'HO6',
  'SPC-SURETY': 'SBC',
  'MNC-CAS': 'MCP',
  'MNC-PROP': 'MPP',
  'LLD-CYBER': 'CLS',
  'PL-QUAKE': 'EQD',
  'COM-ENV': 'EVL',
  'SMB-FARM': 'FRA',
  'SPC-FID': 'FIB',
  'MNC-ENR': 'GEP',
  'MNC-MAR': 'MOC',
  'COM-MPL': 'HPL',
  'PL-HO-HM': 'HM',
  'PL-HO-HOM': 'HOM',
  'PL-HO-ISO': 'HO 00',
  'SMB-IND': 'ICB',
  'PL-HO-DP3': 'DPL',
  'COM-MGMT': 'MLS',
  'LLD-MAR': 'MOM',
  'PL-HO-MH': 'MHD',
  'PL-MOTO': 'MCY',
  'COM-WC': 'WCN',
  'PL-AUTO-NS': 'NSA',
  'SPC-MARINE': 'OMH',
  'PL-EMB': 'EMB',
  'PL-AUTO-STD': 'NM-PA',
  'PL-CYBER': 'PCY',
  'PL-UMB': 'PUL',
  'PL-PET': 'PET',
  'SPC-POLRISK': 'PRK',
  'COM-GL': 'ASSIC-CG',
  'PL-PC-HNW': 'HNW',
  'PL-FLOOD': 'PFL',
  'SPC-RECALL': 'RCC',
  'LLD-PL': 'PLO',
  'LLD-PROP': 'PDA',
  'SPC-PROP-ES': 'PES',
  'RE-PROP': 'PTF',
  'SPC-DO-PUB': 'DOP',
  'PL-RV': 'RVC',
  'PL-HO-RENT': 'HO4',
  'SPC-RWI': 'RWI',
  'PL-AUTO-TNC': 'TNC',
  'PL-HO-SEAS': 'PHX-HO',
  'SMB-CYBER': 'SCY',
  'SMB-GL': 'SGL',
  'SMB-IM': 'SIM',
  'SMB-SURETY': 'SSB',
  'SMB-WC': 'SWC',
  'SMB-AUTO': 'SCA',
  'SMB-PROP': 'SCP',
  'COM-SPC': 'SCS',
  'RE-SPEC': 'STW',
  'SPC-TAX': 'TLP',
  'PL-AUTO-UBI': 'UBI',
  'SPC-CREDIT': 'TCR',
  'SPC-ENERGY': 'UDE',
  'PL-VA': 'VAF',
  'SPC-WAR': 'WSP',
  'SPC-AH': 'WAH',
};

/** Content chassis per product code (chassis live in chassisPersonal /
 *  chassisCommercial / chassisSpecialty). */
export const CHASSIS_BY_PRODUCT: Record<string, string> = {
  'PL-ATV': 'SPECIALTY_VEHICLE',
  'SPC-AVN': 'AVIATION',
  'LLD-AVN': 'LONDON_MARKET',
  'PL-BOAT': 'SPECIALTY_VEHICLE',
  'COM-BR': 'COMMERCIAL_PROPERTY',
  'SMB-UMB': 'COMMERCIAL_UMBRELLA',
  'SMB-BOP': 'PACKAGE_BOP',
  'RE-CAS': 'REINSURANCE_TREATY',
  'PL-CLASSIC': 'SPECIALTY_VEHICLE',
  'COM-AGRI': 'COMMERCIAL_PROPERTY',
  'COM-AUTO': 'COMMERCIAL_AUTO',
  'SMB-CRIME': 'CRIME_FIDELITY',
  'COM-CYBER': 'COMMERCIAL_CYBER',
  'COM-MARINE': 'MARINE_CARGO',
  'COM-PL': 'PROFESSIONAL_LIABILITY',
  'COM-PROP': 'COMMERCIAL_PROPERTY',
  'COM-UMB': 'COMMERCIAL_UMBRELLA',
  'PL-HO-CONDO': 'DWELLING_SPECIALTY',
  'SPC-SURETY': 'SURETY_BOND',
  'MNC-CAS': 'COMMERCIAL_CASUALTY',
  'MNC-PROP': 'COMMERCIAL_PROPERTY',
  'LLD-CYBER': 'LONDON_MARKET',
  'PL-QUAKE': 'DWELLING_SPECIALTY',
  'COM-ENV': 'ENERGY_ENVIRONMENTAL',
  'SMB-FARM': 'COMMERCIAL_PROPERTY',
  'SPC-FID': 'CRIME_FIDELITY',
  'MNC-ENR': 'ENERGY_ENVIRONMENTAL',
  'MNC-MAR': 'MARINE_CARGO',
  'COM-MPL': 'PROFESSIONAL_LIABILITY',
  'PL-HO-HM': 'HOMEOWNERS',
  'PL-HO-HOM': 'HOMEOWNERS',
  'PL-HO-ISO': 'HOMEOWNERS',
  'SMB-IND': 'PACKAGE_BOP',
  'PL-HO-DP3': 'DWELLING_SPECIALTY',
  'COM-MGMT': 'MANAGEMENT_LIABILITY',
  'LLD-MAR': 'LONDON_MARKET',
  'PL-HO-MH': 'DWELLING_SPECIALTY',
  'PL-MOTO': 'SPECIALTY_VEHICLE',
  'COM-WC': 'WORKERS_COMP',
  'PL-AUTO-NS': 'PERSONAL_AUTO',
  'SPC-MARINE': 'MARINE_CARGO',
  'PL-EMB': 'PET_AFFINITY',
  'PL-AUTO-STD': 'PERSONAL_AUTO',
  'PL-CYBER': 'PERSONAL_CYBER',
  'PL-UMB': 'PERSONAL_UMBRELLA',
  'PL-PET': 'PET_AFFINITY',
  'SPC-POLRISK': 'POLITICAL_SPECIALTY',
  'COM-GL': 'COMMERCIAL_CASUALTY',
  'PL-PC-HNW': 'HOMEOWNERS',
  'PL-FLOOD': 'DWELLING_SPECIALTY',
  'SPC-RECALL': 'POLITICAL_SPECIALTY',
  'LLD-PL': 'LONDON_MARKET',
  'LLD-PROP': 'LONDON_MARKET',
  'SPC-PROP-ES': 'COMMERCIAL_PROPERTY',
  'RE-PROP': 'REINSURANCE_TREATY',
  'SPC-DO-PUB': 'MANAGEMENT_LIABILITY',
  'PL-RV': 'SPECIALTY_VEHICLE',
  'PL-HO-RENT': 'DWELLING_SPECIALTY',
  'SPC-RWI': 'PROFESSIONAL_LIABILITY',
  'PL-AUTO-TNC': 'PERSONAL_AUTO',
  'PL-HO-SEAS': 'HOMEOWNERS',
  'SMB-CYBER': 'COMMERCIAL_CYBER',
  'SMB-GL': 'COMMERCIAL_CASUALTY',
  'SMB-IM': 'MARINE_CARGO',
  'SMB-SURETY': 'SURETY_BOND',
  'SMB-WC': 'WORKERS_COMP',
  'SMB-AUTO': 'COMMERCIAL_AUTO',
  'SMB-PROP': 'COMMERCIAL_PROPERTY',
  'COM-SPC': 'COMMERCIAL_CASUALTY',
  'RE-SPEC': 'REINSURANCE_TREATY',
  'SPC-TAX': 'PROFESSIONAL_LIABILITY',
  'PL-AUTO-UBI': 'PERSONAL_AUTO',
  'SPC-CREDIT': 'POLITICAL_SPECIALTY',
  'SPC-ENERGY': 'ENERGY_ENVIRONMENTAL',
  'PL-VA': 'DWELLING_SPECIALTY',
  'SPC-WAR': 'PET_AFFINITY',
  'SPC-AH': 'ACCIDENT_HEALTH',
};

/** Products whose base paper comes from the specimen corpus or a wording
 *  lineage instead of a generated chassis base. `base`/`declarations`/
 *  `endorsements` name existing formNumbers to LINK (created from
 *  specimen-corpus.json or the lineage list below); a missing key falls back
 *  to chassis generation for that role. */
export type PaperOverride = {
  base?: string[];
  declarations?: string[];
  endorsements?: string[];
  /** Skip generated chassis endorsements too (lineages ship their own). */
  suppressGenerated?: boolean;
};

export const PAPER_BY_PRODUCT: Record<string, PaperOverride> = {
  // Specimen papers (documents/forms/form_examples — fictional carriers).
  'PL-AUTO-STD': {
    base: ['NM-PA-0001'],
    declarations: ['NM-PA-DEC'],
    endorsements: ['NM-PA-2114'],
    suppressGenerated: true,
  },
  'PL-HO-SEAS': {
    base: ['PHX-HO-0003'],
    declarations: ['PHX-HO-DEC'],
    endorsements: ['PHX-HO-1544'],
    suppressGenerated: true,
  },
  'COM-GL': {
    base: ['ASSIC-CG-0001'],
    endorsements: [
      'ASSIC-CG-2037',
      'GL 20 10 A',
      'GL 20 10 E',
      'GL 20 10 W',
      'GL 24 04',
      'GL 02 20',
      'CG 20 10',
    ],
    suppressGenerated: true,
  },
  'COM-WC': { base: ['ASSIC-WC-0001'], suppressGenerated: true },
  // Homeowners wording lineages (mirror the uploaded HM / HOM / ISO papers —
  // synthetic text, lineage-true numbering).
  'PL-HO-HM': {
    base: ['HM 8003'],
    declarations: ['HM 8003D'],
    endorsements: ['HM 8004'],
    suppressGenerated: true,
  },
  'PL-HO-HOM': {
    base: ['HOM 7030', 'HOM 7050'],
    declarations: ['HOM 7030D'],
    suppressGenerated: true,
  },
  'PL-HO-ISO': { base: ['HO 00 03', 'HO 00 05'], suppressGenerated: true },
};

/** Manuscript families (backend/data/forms/manuscripts.json) → the product
 *  whose register they surface on. Family members with a states cohort link as
 *  stateAmendatory (state layer), the rest as endorsements. CAN (cannabis) has
 *  no spine product and stays library + process/app linked only. */
export const MANUSCRIPT_FAMILY_PRODUCT: Record<string, string> = {
  AL: 'SPC-AVN',
  CAR: 'MNC-MAR',
  CPP: 'COM-PROP',
  CYB: 'COM-CYBER',
  DO: 'SPC-DO-PUB',
  EL: 'SPC-ENERGY',
  OCIP: 'COM-BR',
  PE: 'COM-MGMT',
};

/** Amendatory flavor per chassis — picks the state-provision register. */
export const PROVISION_FLAVOR: Record<
  string,
  'property' | 'auto' | 'wc' | 'liability' | 'generic'
> = {
  HOMEOWNERS: 'property',
  DWELLING_SPECIALTY: 'property',
  COMMERCIAL_PROPERTY: 'property',
  PACKAGE_BOP: 'property',
  PERSONAL_AUTO: 'auto',
  SPECIALTY_VEHICLE: 'auto',
  COMMERCIAL_AUTO: 'auto',
  WORKERS_COMP: 'wc',
  COMMERCIAL_CASUALTY: 'liability',
  COMMERCIAL_CYBER: 'liability',
  PERSONAL_CYBER: 'liability',
  MANAGEMENT_LIABILITY: 'liability',
  PROFESSIONAL_LIABILITY: 'liability',
  COMMERCIAL_UMBRELLA: 'liability',
  PERSONAL_UMBRELLA: 'liability',
  MARINE_CARGO: 'generic',
  CRIME_FIDELITY: 'generic',
  SURETY_BOND: 'generic',
  ENERGY_ENVIRONMENTAL: 'liability',
  POLITICAL_SPECIALTY: 'generic',
  ACCIDENT_HEALTH: 'generic',
  AVIATION: 'generic',
  REINSURANCE_TREATY: 'generic',
  LONDON_MARKET: 'generic',
  PET_AFFINITY: 'generic',
};

/** State-specific amendatory provisions, keyed by postal code. Each entry is
 *  authored for the states that drive distinctive requirements; every other
 *  state falls back to buildGenericProvisions(). Values are lettered-section
 *  bodies WITHOUT the A./B. prefix (the generator letters them). */
export const STATE_PROVISIONS: Record<
  string,
  Partial<Record<'property' | 'auto' | 'wc' | 'liability' | 'generic', string[]>>
> = {
  PA: {
    property: [
      'Cancellation And Nonrenewal. We may cancel this policy for nonpayment of premium with thirty days written notice. When the policy has been in effect for sixty days or more, we may cancel only for a reason permitted by the Pennsylvania Act 205 unfair insurance practices provisions, with thirty days written notice stating the specific reason.',
      'Appraisal. Either party may demand appraisal of a disputed loss amount. In Pennsylvania, demand for appraisal does not waive any right to deny coverage, and each party bears its own appraiser costs.',
    ],
    auto: [
      'First Party Benefits. Coverage for medical benefits is provided in accordance with the Pennsylvania Motor Vehicle Financial Responsibility Law. The limited tort and full tort election shown in the Declarations governs the right of the Insured to recover for noneconomic loss.',
      'Cancellation. We may not cancel this policy except for a reason permitted by Pennsylvania Act 78, and only after sixty days of coverage except for nonpayment of premium.',
    ],
    wc: [
      'Pennsylvania Endorsement. The policy provides workers compensation benefits under the Pennsylvania Workers Compensation Act. Nothing in this policy relieves the employer of any duty imposed by that Act.',
    ],
  },
  CA: {
    property: [
      'Wildfire And Notice Provisions. Following a declared state of emergency, we will not cancel or refuse to renew this policy solely because the residence premises is located in an area affected by wildfire, for the period required by California Insurance Code provisions.',
      'Notice Of Cancellation. Notice periods are amended to comply with California law: seventy-five days written notice of nonrenewal is required.',
    ],
    auto: [
      'Good Driver Discount. A qualifying Insured is entitled to the good driver rating plan required by California law, and premium reflects that eligibility.',
      'Cancellation. California law limits mid-term cancellation to nonpayment of premium, fraud, or a material change in the risk.',
    ],
    liability: [
      'Consumer Notification. Any condition of this policy requiring notice of a claim is amended to comply with California notice-prejudice requirements: coverage may not be denied for late notice absent substantial prejudice.',
    ],
  },
  FL: {
    property: [
      'Windstorm Catastrophe Provisions. A separate hurricane deductible, shown in the Declarations as a percentage of the Coverage A limit, applies to loss caused by windstorm during a hurricane declared by the National Hurricane Center. The catastrophe ground cover collapse peril required by Florida law is included.',
      'Notice Of Claim. A claim, supplemental claim or reopened claim is barred unless notice is given to us in accordance with the time limits of the Florida Insurance Code.',
    ],
    auto: [
      'Personal Injury Protection. We provide personal injury protection benefits in accordance with the Florida Motor Vehicle No-Fault Law. Benefits are subject to the limits, deductibles and priorities of that law.',
    ],
  },
  TX: {
    property: [
      'Prompt Payment Of Claims. Claim handling deadlines are amended as required by the Texas Prompt Payment of Claims statute; interest applies to late-paid covered claims at the statutory rate.',
      'Windstorm Provisions. For property located in a catastrophe area designated by the Texas Department of Insurance, windstorm and hail coverage may require certification of building code compliance.',
    ],
    auto: [
      'Personal Injury Protection. Personal injury protection of at least the statutory minimum applies unless rejected in writing by the named insured.',
    ],
  },
  NY: {
    property: [
      'Cancellation And Nonrenewal. After sixty days, this policy may be cancelled only for the reasons permitted by New York Insurance Law Section 3425, with the required written notice.',
      'Anti-Arson Application. Where required by New York law, a completed anti-arson application is a condition of coverage for the peril of fire.',
    ],
    auto: [
      'Mandatory Personal Injury Protection. We provide first-party benefits required by the New York Comprehensive Motor Vehicle Insurance Reparations Act (Regulation 68).',
      'Supplementary Uninsured Motorists. Supplementary uninsured/underinsured motorists coverage applies as elected and as required by New York Insurance Law.',
    ],
    liability: [
      'Defense Within Limits Disclosure. Where defense costs reduce the limit of liability, the disclosure required by New York Regulation 107 applies.',
    ],
  },
  NJ: {
    auto: [
      'Personal Injury Protection. We provide personal injury protection benefits in accordance with the New Jersey Automobile Reparation Reform Act. The medical expense benefit limit elected by the named insured is shown in the Declarations.',
      'Basic And Standard Policy Election. This policy is issued as a Standard Policy under New Jersey law unless the Declarations show the Basic Policy election.',
    ],
    property: [
      'Cancellation. When this policy has been in effect for sixty days or more, cancellation is limited to the grounds permitted by New Jersey administrative rules, with the notice periods those rules require.',
    ],
  },
  MA: {
    property: [
      'Standard Form Provisions. The fire coverage of this policy incorporates the standard form language prescribed by Massachusetts General Laws chapter 175 section 99 to the extent required, and conflicting provisions are amended accordingly.',
    ],
    auto: [
      'Compulsory Coverages. Parts 1 through 4 of the Massachusetts standard automobile policy apply as prescribed by the Commissioner, and this policy conforms to the standard policy form.',
    ],
  },
  MI: {
    auto: [
      'Personal Injury Protection. We provide personal injury protection benefits in accordance with the Michigan no-fault act, including the coverage level elected by the named insured under the statutory PIP choice provisions shown in the Declarations.',
      'Mini-Tort. Limited property damage liability recovery applies as provided by Michigan law.',
    ],
  },
  NC: {
    property: [
      'Beach And Windstorm Plan. For eligible coastal property, windstorm and hail coverage may be provided through the North Carolina Insurance Underwriting Association; where it is, this policy excludes that peril to the extent of that placement.',
    ],
    auto: [
      'Rate Bureau Provisions. This policy conforms to the applicable provisions promulgated by the North Carolina Rate Bureau.',
    ],
  },
  LA: {
    property: [
      'Named Storm Deductible. A separate named storm deductible, shown in the Declarations, applies once per calendar year on the terms required by Louisiana law.',
      'Appraisal And Bad Faith. Claim handling duties are amended to conform to Louisiana statutory penalties for arbitrary and capricious failure to pay.',
    ],
  },
  WA: {
    generic: [
      'Fair Conduct Provisions. Claim handling conforms to the Washington Insurance Fair Conduct Act; first-party claimants have the notice rights that Act provides.',
    ],
  },
  CO: {
    property: [
      'Wildfire Mitigation. Where the named insured documents qualifying wildfire mitigation, any wildfire-related surcharge is reduced as required by Colorado law.',
    ],
  },
};

const AMENDATORY_NOTICE_DAYS = [30, 45, 60];

/** Deterministic generic amendatory provisions for a state without authored
 *  entries — varies notice periods by state code so cohorts do not read
 *  identical. */
export function buildGenericProvisions(stateCode: string, stateName: string): string[] {
  const n = AMENDATORY_NOTICE_DAYS[(stateCode.charCodeAt(0) + stateCode.charCodeAt(1)) % 3];
  return [
    `Cancellation And Nonrenewal. The cancellation condition is amended: when this policy has been in effect for sixty days or more, we may cancel only for a reason permitted by ${stateName} law, with ${n} days written notice to the named insured stating the reason.`,
    `Conformity To State Law. Any provision of this policy in conflict with the insurance laws or regulations of ${stateName} is amended to conform to the minimum requirements of those laws.`,
  ];
}
