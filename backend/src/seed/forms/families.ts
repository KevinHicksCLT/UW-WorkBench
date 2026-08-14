// ── SERFF-informed synthetic variant families (SCRUM-229) ──
// One family per manuscript line. Each family's canonical clause text is
// derived at seed time from the ANCHOR manuscript's own segmented clauses
// (see buildFamilyForms in ./generate.ts), so a variant clause marked `same`
// is byte-for-byte the anchor's provision and hashes identically — the
// short-circuit the clustering pipeline relies on. Divergence is introduced
// per the controlled recipe (module spec §3):
//   • reword  — 1–2 clauses reworded but semantically equivalent (cluster
//               fodder; lands as a near/divergent cluster member, and the
//               heaviest reword is tuned to fall in the flagged-outlier band).
//   • limit   — 1 clause with a changed limit / notice period / sublimit
//               (materially divergent — findings fodder; stays high-similarity
//               so it clusters, but the changed number is the divergence).
//   • drop    — a clause omitted in one variant (missing-clause fodder).
//   • add     — an added exclusion clause on one variant (outlier / unique).
// Metadata (filing status, edition sequence, state cohorts) is spread across
// Draft / Filed / Approved / Withdrawn exactly as a real filed library reads;
// see documents/forms/serff-research-notes.md for the grounding.
//
// Every synthetic form is plausible but clearly fictional — no real carrier
// names, invented form numbers in the anchor's own numbering space.

export type FilingStatus = 'Draft' | 'Filed' | 'Approved' | 'Withdrawn';

/** An edit applied to one anchor-derived section, keyed by clause index. */
export type SectionOp =
  | { kind: 'same' }
  | { kind: 'reword'; text: string } // semantically equivalent restatement
  | { kind: 'limit'; text: string } // changed limit / notice / number
  | { kind: 'drop' }; // omit this clause entirely

export type AddedClause = { text: string }; // appended after the anchor sections

export type VariantRole = 'core' | 'regional' | 'outlier' | 'product' | 'superseded';

export type VariantSpec = {
  formNumber: string;
  /** Title override; defaults to the anchor title (keeps the title cluster hash-equal). */
  title?: string;
  states: string[] | null;
  editionDate: string;
  filingStatus: FilingStatus;
  provenance?: string;
  role: VariantRole;
  /** Per-clause-index ops (0 = title). Unlisted indices default to `same`. */
  ops?: Record<number, SectionOp>;
  /** Extra clauses appended after the anchor sections (e.g. an added exclusion). */
  add?: AddedClause[];
  /** Human note surfaced in the generator log / provenance. */
  note?: string;
};

export type Family = {
  key: string;
  anchorFormNumber: string;
  lob: string;
  kind: 'form' | 'endorsement';
  /** L2 value-stream displayValues this line serves (servesValueStream links). */
  valueStreams: string[];
  /** Applications that consume/render this line (FormApplication links). */
  applications: { name: string; role_: 'implementedBy' | 'feedsApplication' }[];
  variants: VariantSpec[];
};

// Section-index cheat-sheet (from anchor segmentation, 0 = title):
//   AL 1022 : 1 COVERED AIRCRAFT · 2 COVERAGE PROVIDED · 3 OPERATIONAL REQUIREMENTS
//   CAN 1017: 1 COVERED OPERATIONS · 2 SPECIAL CONDITIONS · 3 PRODUCT RECALL · 4 EXCLUSION
//   CAR 1220: 1 COVERED PROPERTY · 2 COVERED CAUSES OF LOSS · 3 SPECIAL COVERAGES
//   CPP 1016: 1 COVERED PROPERTY · 2 CATASTROPHE SUBLIMITS · 3 BUSINESS INTERRUPTION · 4 CONTINGENT BI
//   CYB 1009: 1 A.Coverage Grant · 2 B.Limit of Insurance · 3 C.Exclusions
//   DO  1011: 1 A.Coverage · 2 B.Additional Limit · 3 C.Non-Rescindable
//   EL  1018: 1 A.Insured Operations · 2 B.Covered Damages · 3 C.Additional Coverage
//   OCIP1017: 1 A.Covered Parties · 2 B.Covered Project · 3 C.Project-Specific · 4 D.Maximum Policy Period
//   PE  1221: 1 A.Covered Entities · 2 B.Coverage Extensions · 3 C.Change in Control

export const FAMILIES: Family[] = [
  {
    key: 'AL',
    anchorFormNumber: 'AL 1022',
    lob: 'Aviation',
    kind: 'form',
    valueStreams: ['Underwriting', 'Product & Delivery'],
    applications: [
      { name: 'Policy Administration Platform', role_: 'implementedBy' },
      { name: 'Underwriting Platform', role_: 'feedsApplication' },
    ],
    variants: [
      {
        formNumber: 'AL 1119',
        states: null,
        editionDate: '02 15 2027',
        filingStatus: 'Approved',
        role: 'core',
        note: 'Countrywide successor edition; COVERAGE PROVIDED clause reworded (equivalent — cluster fodder).',
        ops: {
          2: {
            kind: 'reword',
            text: 'COVERAGE PROVIDED\nThis form provides Bodily Injury, Property Damage, Privacy Liability, and Personal Injury coverage.',
          },
        },
      },
      {
        formNumber: 'AL 1120',
        states: ['CA'],
        editionDate: '03 01 2027',
        filingStatus: 'Filed',
        role: 'regional',
        note: 'California edition; approved-territory / altitude condition tightened (materially divergent).',
        ops: {
          3: {
            kind: 'limit',
            text: 'OPERATIONAL REQUIREMENTS\nCoverage applies only when:\nFAA requirements are met\nPilots hold required certifications\nFlights occur within approved territories and below 400 feet above ground level',
          },
        },
      },
      {
        formNumber: 'AL 1121',
        states: ['TX', 'GA'],
        editionDate: '04 10 2027',
        filingStatus: 'Draft',
        role: 'outlier',
        note: 'Program edition; OPERATIONAL REQUIREMENTS restated (outlier ~0.61) and COVERAGE PROVIDED dropped (missing clause).',
        ops: {
          2: { kind: 'drop' },
          3: {
            kind: 'reword',
            text: 'OPERATIONAL REQUIREMENTS\nCoverage applies only where FAA requirements are satisfied, pilots hold required certifications, and flights remain inside approved territories.',
          },
        },
      },
      {
        formNumber: 'AL 1019',
        states: null,
        editionDate: '08 10 2024',
        filingStatus: 'Withdrawn',
        role: 'superseded',
        note: 'Prior generation, superseded by AL 1022 — retire candidate kept in the library.',
        add: [
          {
            text: 'ADDITIONAL EXCLUSION\nThis coverage does not apply to any operation of an unmanned aircraft weighing more than 55 pounds.',
          },
        ],
      },
    ],
  },
  {
    key: 'CAN',
    anchorFormNumber: 'CAN 1017',
    lob: 'Cannabis',
    kind: 'form',
    valueStreams: ['Underwriting', 'Product & Delivery'],
    applications: [
      { name: 'Policy Administration Platform', role_: 'implementedBy' },
      { name: 'Underwriting Platform', role_: 'feedsApplication' },
    ],
    variants: [
      {
        formNumber: 'CAN 1114',
        states: ['CO', 'OR'],
        editionDate: '01 05 2027',
        filingStatus: 'Approved',
        role: 'core',
        note: 'Mature-market cohort; SPECIAL CONDITIONS reworded (equivalent).',
        ops: {
          2: {
            kind: 'reword',
            text: 'SPECIAL CONDITIONS\nThe insured must maintain security controls consisting of:\nContinuous 24-hour video surveillance\nAccess control systems\nSeed-to-sale inventory tracking',
          },
        },
      },
      {
        formNumber: 'CAN 1115',
        states: ['CA'],
        editionDate: '02 20 2027',
        filingStatus: 'Filed',
        role: 'regional',
        note: 'California edition; Product Recall Expense sublimit raised to $500,000 (materially divergent).',
        ops: {
          3: {
            kind: 'limit',
            text: 'PRODUCT RECALL EXPENSE\nThe Company shall reimburse recall expenses up to $500,000.',
          },
        },
      },
      {
        formNumber: 'CAN 1116',
        states: ['NY', 'NJ'],
        editionDate: '03 15 2027',
        filingStatus: 'Draft',
        role: 'outlier',
        note: 'Emerging-market cohort; COVERED OPERATIONS restated (outlier) and EXCLUSION dropped (missing clause).',
        ops: {
          1: {
            kind: 'reword',
            text: 'COVERED OPERATIONS\nThis form responds to liability arising out of the insured cannabis enterprise, including plant cultivation, product manufacturing, wholesale distribution, and licensed retail dispensary sales.',
          },
          4: { kind: 'drop' },
        },
      },
      {
        formNumber: 'CAN 1117',
        states: ['MI'],
        editionDate: '04 01 2027',
        filingStatus: 'Draft',
        role: 'product',
        note: 'Microbusiness product variant; adds an intoxicating-hemp exclusion.',
        add: [
          {
            text: 'ADDITIONAL EXCLUSION\nCoverage does not apply to any claim arising out of intoxicating hemp products not authorized under the insured cannabis license.',
          },
        ],
      },
    ],
  },
  {
    key: 'CAR',
    anchorFormNumber: 'CAR 1220',
    lob: 'Marine/Cargo',
    kind: 'form',
    valueStreams: ['Underwriting', 'Product & Delivery'],
    applications: [
      { name: 'Policy Administration Platform', role_: 'implementedBy' },
      { name: 'Guidewire PolicyCenter', role_: 'feedsApplication' },
    ],
    variants: [
      {
        formNumber: 'CAR 1315',
        states: null,
        editionDate: '01 2027',
        filingStatus: 'Approved',
        role: 'core',
        note: 'Countrywide successor; COVERED CAUSES OF LOSS reworded (equivalent).',
        ops: {
          2: {
            kind: 'reword',
            text: 'COVERED CAUSES OF LOSS\nThis form insures against all risks of direct physical loss of or damage to the Covered Property except as excluded.',
          },
        },
      },
      {
        formNumber: 'CAR 1316',
        states: ['FL', 'TX', 'LA'],
        editionDate: '02 2027',
        filingStatus: 'Filed',
        role: 'regional',
        note: 'Gulf ports edition; adds a named-storm transit deductible (materially divergent special coverages).',
        ops: {
          3: {
            kind: 'limit',
            text: 'SPECIAL COVERAGES\nRefrigeration Breakdown\nPort Congestion\nGeneral Average\nSue and Labor Charges\nNamed Storm Transit Deductible of $100,000 each occurrence',
          },
        },
      },
      {
        formNumber: 'CAR 1317',
        states: ['CA', 'WA'],
        editionDate: '03 2027',
        filingStatus: 'Draft',
        role: 'outlier',
        note: 'Pacific edition; COVERED PROPERTY restated (outlier) and SPECIAL COVERAGES dropped (missing clause).',
        ops: {
          1: {
            kind: 'reword',
            text: 'COVERED PROPERTY\nThe Company insures the insured’s stock, finished goods, and raw materials during the ordinary course of transit conveyed by vessel, aircraft, railcar, or motor truck.',
          },
          3: { kind: 'drop' },
        },
      },
    ],
  },
  {
    key: 'CPP',
    anchorFormNumber: 'CPP 1016',
    lob: 'Commercial Property',
    kind: 'form',
    valueStreams: ['Underwriting', 'Product & Delivery'],
    applications: [
      { name: 'Policy Administration Platform', role_: 'implementedBy' },
      { name: 'Earnix Rating & Pricing', role_: 'feedsApplication' },
    ],
    variants: [
      {
        formNumber: 'CPP 1113',
        states: null,
        editionDate: '01 15 2027',
        filingStatus: 'Approved',
        role: 'core',
        note: 'Countrywide successor; BUSINESS INTERRUPTION reworded (equivalent).',
        ops: {
          3: {
            kind: 'reword',
            text: 'BUSINESS INTERRUPTION\nThe Company will pay for the actual loss of Business Income sustained during the Period of Restoration, which shall not exceed 24 months.',
          },
        },
      },
      {
        formNumber: 'CPP 1114',
        states: ['FL'],
        editionDate: '02 01 2027',
        filingStatus: 'Filed',
        role: 'regional',
        note: 'Florida edition; Windstorm catastrophe sublimit reduced to $25,000,000 (materially divergent).',
        ops: {
          2: {
            kind: 'limit',
            text: 'CATASTROPHE SUBLIMITS\nFlood sublimit $25,000,000.\nEarthquake sublimit $50,000,000.\nWindstorm sublimit $25,000,000.',
          },
        },
      },
      {
        formNumber: 'CPP 1115',
        states: ['CA'],
        editionDate: '03 01 2027',
        filingStatus: 'Draft',
        role: 'outlier',
        note: 'California quake edition; COVERED PROPERTY restated (outlier) and CONTINGENT BI dropped (missing clause).',
        ops: {
          1: {
            kind: 'reword',
            text: 'COVERED PROPERTY\nProperty covered under this program comprises the insured’s buildings, business personal property, machinery and equipment, renewable energy assets, and temporary structures situated at the locations scheduled on Schedule A.',
          },
          4: { kind: 'drop' },
        },
      },
      {
        formNumber: 'CPP 1012',
        states: null,
        editionDate: '06 01 2024',
        filingStatus: 'Withdrawn',
        role: 'superseded',
        note: 'Prior edition superseded by CPP 1016 — retire candidate.',
      },
    ],
  },
  {
    key: 'CYB',
    anchorFormNumber: 'CYB 1009',
    lob: 'Cyber',
    kind: 'endorsement',
    valueStreams: ['Underwriting', 'Cybersecurity & IAM'],
    applications: [
      { name: 'Policy Administration Platform', role_: 'implementedBy' },
      { name: 'Underwriting Platform', role_: 'feedsApplication' },
    ],
    variants: [
      {
        formNumber: 'CYB 1105',
        states: null,
        editionDate: '01 10 2027',
        filingStatus: 'Approved',
        role: 'core',
        note: 'Countrywide successor; Coverage Grant reworded (equivalent).',
        ops: {
          1: {
            kind: 'reword',
            text: 'A. Coverage Grant\nThe Company shall reimburse the Insured for reasonable and necessary Incident Response Expenses that the Insured incurs as a direct consequence of a Cyber Event first discovered during the Policy Period.\nIncident Response Expenses include:\nDigital forensic services\nLegal consultation expenses\nPublic relations services\nNotification expenses\nCredit monitoring services',
          },
        },
      },
      {
        formNumber: 'CYB 1106',
        states: ['CA'],
        editionDate: '02 14 2027',
        filingStatus: 'Filed',
        role: 'regional',
        note: 'California edition; CCPA-flavored notification adds a 45-day statutory notice, and the aggregate limit rises to $1,000,000 (materially divergent).',
        ops: {
          2: {
            kind: 'limit',
            text: 'B. Limit of Insurance\nThe maximum amount payable under this endorsement shall not exceed $1,000,000 each Cyber Event and in the aggregate.',
          },
          3: {
            kind: 'reword',
            text: 'C. Exclusions\nCoverage shall not apply to:\nFailure to maintain the minimum security controls disclosed in the application.\nAny Cyber Event first occurring before the Retroactive Date.\nIntentional acts committed by executive management.\nNotification made more than 45 days after the statutory deadline under the California Consumer Privacy Act.',
          },
        },
      },
      {
        formNumber: 'CYB 1107',
        states: ['NY'],
        editionDate: '03 20 2027',
        filingStatus: 'Draft',
        role: 'outlier',
        note: 'New York DFS edition; Coverage Grant heavily restated (outlier) and Exclusions dropped (missing clause).',
        ops: {
          1: {
            kind: 'reword',
            text: 'A. Coverage Grant\nFollowing a Cyber Event first discovered within the Policy Period, the Company will indemnify the Insured’s reasonable first-party costs of response, including forensic investigation, breach counsel, crisis communications, regulatory notification, and affected-individual credit monitoring.',
          },
          3: { kind: 'drop' },
        },
      },
      {
        formNumber: 'CYB 1008',
        states: null,
        editionDate: '05 01 2024',
        filingStatus: 'Withdrawn',
        role: 'superseded',
        note: 'Prior edition superseded by CYB 1009 — retire candidate; older $250,000 sublimit.',
        ops: {
          2: {
            kind: 'limit',
            text: 'B. Limit of Insurance\nThe maximum amount payable under this endorsement shall not exceed $250,000 each Cyber Event and in the aggregate.',
          },
        },
      },
    ],
  },
  {
    key: 'DO',
    anchorFormNumber: 'DO 1011',
    lob: 'Management Liability',
    kind: 'endorsement',
    valueStreams: ['Underwriting', 'Legal & Corporate Governance'],
    applications: [
      { name: 'Policy Administration Platform', role_: 'implementedBy' },
      { name: 'Underwriting Platform', role_: 'feedsApplication' },
    ],
    variants: [
      {
        formNumber: 'DO 1108',
        states: null,
        editionDate: '01 12 2027',
        filingStatus: 'Approved',
        role: 'core',
        note: 'Countrywide successor; Coverage clause reworded (equivalent).',
        ops: {
          1: {
            kind: 'reword',
            text: 'A. Coverage\nThe Company shall pay Loss that any Independent Director becomes legally liable to pay on account of a Claim first made for a Wrongful Act.\nCoverage applies only after exhaustion of:\nCorporate indemnification\nUnderlying D&O insurance\nExcess D&O insurance',
          },
        },
      },
      {
        formNumber: 'DO 1109',
        states: ['NY'],
        editionDate: '02 22 2027',
        filingStatus: 'Filed',
        role: 'regional',
        note: 'New York edition; additional Independent Director limit raised to $10,000,000 (materially divergent).',
        ops: {
          2: {
            kind: 'limit',
            text: 'B. Additional Limit\nAn additional $10,000,000 limit shall apply solely to Independent Directors.',
          },
        },
      },
      {
        formNumber: 'DO 1110',
        states: ['DE'],
        editionDate: '03 18 2027',
        filingStatus: 'Draft',
        role: 'outlier',
        note: 'Delaware edition; Non-Rescindable provision restated (outlier) and Additional Limit dropped (missing clause).',
        ops: {
          2: { kind: 'drop' },
          3: {
            kind: 'reword',
            text: 'C. Non-Rescindable Provision\nThe Company shall not rescind the cover granted to any Independent Director, save where that Independent Director is proven to have committed fraud in seeking such cover.',
          },
        },
      },
    ],
  },
  {
    key: 'EL',
    anchorFormNumber: 'EL 1018',
    lob: 'Energy',
    kind: 'endorsement',
    valueStreams: ['Underwriting', 'Product & Delivery'],
    applications: [
      { name: 'Policy Administration Platform', role_: 'implementedBy' },
      { name: 'Underwriting Platform', role_: 'feedsApplication' },
    ],
    variants: [
      {
        formNumber: 'EL 1112',
        states: null,
        editionDate: '01 20 2027',
        filingStatus: 'Approved',
        role: 'core',
        note: 'Countrywide successor; Covered Damages reworded (equivalent).',
        ops: {
          2: {
            kind: 'reword',
            text: 'B. Covered Damages\nThe Company shall pay those sums that the Insured becomes legally obligated to pay as damages arising out of:\nEquipment Failure\nPower Generation Interruption\nThird-Party Property Damage',
          },
        },
      },
      {
        formNumber: 'EL 1113',
        states: ['TX'],
        editionDate: '02 26 2027',
        filingStatus: 'Filed',
        role: 'regional',
        note: 'Texas edition; inverter-failure business income sublimit raised to $5,000,000 (materially divergent).',
        ops: {
          3: {
            kind: 'limit',
            text: 'C. Additional Coverage\nBusiness income loss resulting from inverter failure is covered up to $5,000,000.',
          },
        },
      },
      {
        formNumber: 'EL 1114',
        states: ['CA'],
        editionDate: '03 30 2027',
        filingStatus: 'Draft',
        role: 'outlier',
        note: 'California edition; Covered Damages restated (outlier ~0.59) and Additional Coverage dropped (missing clause).',
        ops: {
          2: {
            kind: 'reword',
            text: 'B. Covered Damages\nThe Company will indemnify the Insured for damages it is legally required to pay arising from equipment failure, power generation interruption, or third-party property damage.',
          },
          3: { kind: 'drop' },
        },
      },
    ],
  },
  {
    key: 'OCIP',
    anchorFormNumber: 'OCIP 1017',
    lob: 'Construction',
    kind: 'endorsement',
    valueStreams: ['Underwriting', 'Product & Delivery'],
    applications: [
      { name: 'Policy Administration Platform', role_: 'implementedBy' },
      { name: 'Guidewire PolicyCenter', role_: 'feedsApplication' },
    ],
    variants: [
      {
        formNumber: 'OCIP 1112',
        states: null,
        editionDate: '01 25 2027',
        filingStatus: 'Approved',
        role: 'core',
        note: 'Countrywide successor; Project-Specific Coverage reworded (equivalent).',
        ops: {
          3: {
            kind: 'reword',
            text: 'C. Project-Specific Coverage\nThe following coverages are afforded for the enrolled project:\nCompleted Operations\nExtended Reporting Period\nContractors Pollution Liability\nProfessional Liability',
          },
        },
      },
      {
        formNumber: 'OCIP 1113',
        states: ['CA'],
        editionDate: '02 28 2027',
        filingStatus: 'Filed',
        role: 'regional',
        note: 'California edition; maximum policy period extended to 84 months (materially divergent).',
        ops: {
          4: {
            kind: 'limit',
            text: 'D. Maximum Policy Period\n84 months from project commencement.',
          },
        },
      },
      {
        formNumber: 'OCIP 1114',
        states: ['NY'],
        editionDate: '03 22 2027',
        filingStatus: 'Draft',
        role: 'outlier',
        note: 'New York edition; Covered Project restated (outlier) and Maximum Policy Period dropped (missing clause).',
        ops: {
          2: {
            kind: 'reword',
            text: 'B. Covered Project\nThis endorsement applies to the wrap-up enrolled works, namely construction of the XYZ Mixed-Use Development, an insured project with a stated value of $1.2 Billion.',
          },
          4: { kind: 'drop' },
        },
      },
    ],
  },
  {
    key: 'PE',
    anchorFormNumber: 'PE 1221',
    lob: 'Management Liability',
    kind: 'endorsement',
    valueStreams: ['Underwriting', 'Legal & Corporate Governance'],
    applications: [
      { name: 'Policy Administration Platform', role_: 'implementedBy' },
      { name: 'Underwriting Platform', role_: 'feedsApplication' },
    ],
    variants: [
      {
        formNumber: 'PE 1315',
        states: null,
        editionDate: '01 30 2027',
        filingStatus: 'Approved',
        role: 'core',
        note: 'Countrywide successor; Coverage Extensions reworded (equivalent).',
        ops: {
          2: {
            kind: 'reword',
            text: 'B. Coverage Extensions\nThis endorsement extends cover to the following matters:\nSecurities Claims\nDerivative Demand Investigations\nRegulatory Inquiries\nTransactional Events',
          },
        },
      },
      {
        formNumber: 'PE 1316',
        states: ['NY', 'CA'],
        editionDate: '02 27 2027',
        filingStatus: 'Filed',
        role: 'regional',
        note: 'Coastal cohort; change-in-control run-off extended to 180 days (materially divergent).',
        ops: {
          3: {
            kind: 'limit',
            text: 'C. Change in Control\nCoverage automatically extends for 180 days following a Change in Control transaction.',
          },
        },
      },
      {
        formNumber: 'PE 1317',
        states: ['DE'],
        editionDate: '03 26 2027',
        filingStatus: 'Draft',
        role: 'outlier',
        note: 'Delaware edition; Covered Entities restated (outlier) and Change in Control dropped (missing clause).',
        ops: {
          1: {
            kind: 'reword',
            text: 'A. Covered Entities\nCover under this endorsement attaches to each portfolio company set out in Schedule A to this policy.',
          },
          3: { kind: 'drop' },
        },
      },
    ],
  },
];
