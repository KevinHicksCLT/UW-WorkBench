// Forms Rationalization module — shared model (spec:
// documents/product-model-workspace/forms-rationalization-spec.md §3).
// Everything renders from this model so the deferred FR-8.1 ingestion path can
// later replace the mock dataset without any UI change.

/** The three-layer decomposition every form falls into. */
export type FormLayer = 'CORE' | 'STATE_VARIATION' | 'PRODUCT_VARIATION';

/** FR-5.1 — why does this form exist? Exactly the design doc's categories. */
export type ExistenceReason =
  | 'STATUTORY'
  | 'DOI_REQUIREMENT'
  | 'STATE_DISCLOSURE'
  | 'PRODUCT_DIFFERENTIATION'
  | 'LEGACY_ARTIFACT'
  | 'UNKNOWN';

/** E5 — the recorded rationalization decision per form. */
export type FormDecisionStatus =
  'UNDECIDED' | 'KEEP_STATE_VARIATION' | 'STANDARDIZE' | 'UNIFY' | 'RETIRE';

/** FR-4.2 — diff sections classify so Question 1 categories fall out. */
export type DiffKind = 'statutory' | 'formatting' | 'product';

/** One titled block of form language (mock text bodies for the demo). */
export interface FormSection {
  heading: string;
  text: string;
  /** null = common language; otherwise why this section deviates. */
  diff: DiffKind | null;
}

/** FR-7.2 — stored agent recommendation with the evidence that produced it. */
export interface AgentRecommendation {
  disposition: 'KEEP_STATE_VARIATION' | 'STANDARDIZE' | 'RETIRE';
  reason: string;
  evidence: string[];
}

/** The shared Form record — spec §3, verbatim field names. */
export interface FormRecord {
  formId: string;
  title: string;
  description: string;
  lineOfBusiness: string;
  productIds: string[];
  layer: FormLayer;
  parentFormId: string | null;
  /** null = countrywide (no state token in the naming convention). */
  state: string | null;
  /** Optional target-state grouping (e.g. "Western States"). */
  region: string | null;
  coverageRefs: string[];
  existenceReason: ExistenceReason;
  regulatoryCitations: string[];
  relatedRules: string[];
  relatedForms: string[];
  filingDependencies: string[];
  cluster: { clusterId: string; similarityPct: number } | null;
  /** Mock body content backing the FR-4.2 diff surface. */
  sections: FormSection[];
  agent: AgentRecommendation | null;
}

/** Audit-carrying decision record (FR-5.x) — persisted per formId. */
export interface FormDecision {
  status: FormDecisionStatus;
  reason: string;
  decidedBy: string;
  decidedAt: string; // ISO
  /** STANDARDIZE — the core form absorbing the requirement. */
  targetCoreFormId?: string;
  /** STANDARDIZE — the conditional language block note. */
  conditionalBlock?: string;
  /** UNIFY — the created multistate/region target form. */
  unifiedFormId?: string;
}

/** Audit-carrying existence classification (FR-5.1). */
export interface FormClassification {
  reason: ExistenceReason;
  decidedBy: string;
  decidedAt: string; // ISO
  priorValue: ExistenceReason;
}

/** FR-5.3 — a created multistate/region target form. */
export interface UnifiedForm {
  formId: string;
  title: string;
  region: string;
  states: string[];
  memberFormIds: string[];
  createdBy: string;
  createdAt: string; // ISO
}

/** A named multistate region (FR-2.2); default set ships with the mock data. */
export interface RegionDef {
  name: string;
  states: string[];
}

// ── Status color language (spec §2) ─────────────────────────────────────────
// 🟢 Standard · 🟡 State Variation · 🔴 Product-Specific Variation — one meta
// table so heat map, grids and cards all speak the same palette. Text colors
// are the app's high-contrast tokens (7/28 legibility requirement).

export type StateStatus = 'standard' | 'state' | 'product';

export const STATE_STATUS_META: Record<
  StateStatus,
  { label: string; icon: string; fg: string; bg: string; border: string }
> = {
  standard: { label: 'Standard', icon: '✓', fg: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
  state: { label: 'State variation', icon: '△', fg: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  product: {
    label: 'Product-specific variation',
    icon: '◆',
    fg: '#991b1b',
    bg: '#fee2e2',
    border: '#fecaca',
  },
};

export const LAYER_META: Record<FormLayer, { label: string; status: StateStatus }> = {
  CORE: { label: 'Core', status: 'standard' },
  STATE_VARIATION: { label: 'State variation', status: 'state' },
  PRODUCT_VARIATION: { label: 'Product variation', status: 'product' },
};

export const REASON_META: Record<ExistenceReason, { label: string; short: string }> = {
  STATUTORY: { label: 'Statutory Requirement', short: 'Statutory' },
  DOI_REQUIREMENT: { label: 'DOI Requirement', short: 'DOI' },
  STATE_DISCLOSURE: { label: 'State Disclosure Requirement', short: 'Disclosure' },
  PRODUCT_DIFFERENTIATION: { label: 'Product Differentiation', short: 'Product diff.' },
  LEGACY_ARTIFACT: { label: 'Legacy Artifact', short: 'Legacy' },
  UNKNOWN: { label: 'Unknown', short: 'Unknown' },
};

export const DECISION_META: Record<
  FormDecisionStatus,
  { label: string; fg: string; bg: string; border: string }
> = {
  UNDECIDED: { label: 'Undecided', fg: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  KEEP_STATE_VARIATION: { label: 'Keep', fg: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
  STANDARDIZE: { label: 'Standardize', fg: '#3730a3', bg: '#eef2ff', border: '#d6dcff' },
  UNIFY: { label: 'Unify', fg: '#0e7490', bg: '#ecfeff', border: '#a5f3fc' },
  RETIRE: { label: 'Retire', fg: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
};

/** All 50 states + DC as postal codes, for the FR-2.1 tile grid. */
export const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

export const STATE_NAME: Record<string, string> = Object.fromEntries(
  US_STATES.map((s) => [s.code, s.name]),
);
