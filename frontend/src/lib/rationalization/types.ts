/**
 * DTO types for the rationalization workspace boards (application and
 * product-model domains) — the frozen §6.2 contract shapes. Vocabulary
 * derivations live in vocabulary.ts; pure derivations in derive.ts.
 */

// ── Domains & vocabulary rows ───────────────────────────────────────────────

export type Domain = 'APPLICATION' | 'PRODUCT_MODEL';

/** GET /rationalization/vocabulary?domain= row (§6.2). */
export type VocabularyRow = {
  domain: Domain;
  kind: string; // LAYER | CLASSIFICATION | STATUS | MODE | VIEW | DISPOSITION | MATCH_STATUS
  token: string;
  label: string;
  color: string | null;
  sortOrder: number;
  meta: Record<string, unknown> | null;
};

/** Row-axis token (IT layer or product component) — dynamic, from LAYER rows. */
// eslint-disable-next-line sonarjs/redundant-type-aliases -- the domain name documents intent at every call site
export type Layer = string;
/** Classification token (CAPDAN class or product scope) — from CLASSIFICATION rows. */
// eslint-disable-next-line sonarjs/redundant-type-aliases -- the domain name documents intent at every call site
export type Classification = string;

export type MatchStatus = 'AUTO' | 'REVIEW' | 'HELD';

// ── Anatomy lens (WR-06) ────────────────────────────────────────────────────

export type FindingView = 'COMPONENT' | 'BEHAVIOR';
export type AnatomyView = FindingView | 'MISPLACED';

/** GET /rationalization/anatomy-catalog (or the product twin) reference row. */
export type AnatomyCategory = {
  layer: string;
  view: AnatomyView;
  name: string;
  description: string;
  recommendedLayer: string | null;
  /** Product rows only: COMMON | SEGMENT | GEOGRAPHY. */
  scope?: string | null;
};

/** A screen or modal of a legacy app (WR-06: clickable screen chips). */
export type ScreenAsset = {
  id: string;
  appId: string | null;
  name: string;
  kind: 'SCREEN' | 'MODAL';
  url: string | null;
  processNodeId: string | null;
};

// ── Board DTOs ──────────────────────────────────────────────────────────────

export type ByClassification = Record<string, number>;

export type StageListItem = {
  id: string;
  name: string;
  application: string | null;
  stageOrder: number;
  businessProcess: string | null;
  status: string;
  illustrative: boolean;
  findings: number;
  byCapdan: ByClassification;
  progress: number;
};

export type LayerRollup = {
  layer: Layer;
  findings: number;
  progress: number;
  byCapdan: ByClassification;
  relocateOut: number;
};

/** What a misplaced item captures/sends/processes/validates + where it lands. */
export type WhyThisMoves = {
  captured?: string;
  sent?: string;
  processed?: string;
  validated?: string;
  lands?: string;
};

export type Finding = {
  id: string;
  appId: string;
  layer: Layer;
  category: string | null;
  view: FindingView | null; // null/missing → treated as COMPONENT
  screenRef: string | null;
  plainSummary: string | null;
  recommendedLayer: string | null;
  capdan: Classification;
  targetLayer: Layer | null;
  sharedServiceId: string | null;
  name: string;
  codeRef: string | null;
  migrationApproach: string | null;
  rationale: string | null;
  effort: string | null;
  complexity: string | null;
  migrationStatus: string;
  // v3 additions (§6.2) — defaulted by withV3Defaults for pre-v3 payloads.
  deadCode: boolean;
  normalizationEntryId: string | null;
  whyThisMoves: WhyThisMoves | null;
  // Product domain only.
  scope?: Classification;
  segmentValue?: string | null;
  geographyValue?: string | null;
};

/** Normalize a finding's anatomy view (older rows may omit it). */
export const findingView = (f: Finding): FindingView => f.view ?? 'COMPONENT';

export type AppCol = {
  id: string;
  name: string;
  kind: string; // LEGACY | SHARED_SERVICE
  techStack: string | null;
  disposition: string | null;
  position: number;
};
export type Component = {
  id: string;
  layer: Layer;
  name: string;
  principle: string | null;
  pattern: string | null;
  targetTech: string | null;
  destination: string | null;
  microserviceId: string | null;
  migrationStatus: string;
};
export type Microservice = {
  id: string;
  name: string;
  kind: string;
  status: string;
  techStack: string | null;
  ownerRole: string | null;
};

/**
 * One side of a Normalize comparison (v3 wireframe): a legacy source's version
 * of the normalized item — itemized field lines ("Claim number — text (12)")
 * or a "SOURCE DOES" narrative.
 */
export type SourceCard = {
  source: string;
  title: string;
  lines?: string[];
  does?: string;
  moreNote?: string;
};

/** One normalized item in a Normalize box (#N-101 …) — §6.2. */
export type NormalizationEntry = {
  id: string;
  layer: Layer;
  notation: string;
  name: string;
  matchStatus: MatchStatus;
  matchBasis: string | null;
  differenceNote: string | null;
  proposedResolution: string | null;
  /** Side-by-side comparison cards, index-aligned to the legacy sources. */
  sourceCards?: SourceCard[] | null;
  componentId: string | null;
  findingIds: string[];
};

/** Per-legacy-column roll-up (§6.2). */
export type ColumnStats = {
  sourceId: string;
  rawSteps: number;
  correct: number;
  move: number;
  deadCode: number;
};

/** Normalize-column roll-up (§6.2). */
export type NormalizeStats = { raw: number; normalized: number; awaitingReview: number };

/** User-curated board overlay persisted on the workspace. */
export type BoardLayout = {
  positions?: Record<string, { x: number; y: number }>;
  addedEdges?: {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }[];
  removedEdges?: string[];
};

export type StageDetail = {
  id: string;
  name: string;
  application: string | null;
  stageOrder: number;
  businessProcess: string | null;
  description: string | null;
  northstar: string | null;
  status: string;
  illustrative: boolean;
  layout: BoardLayout | null;
  progress: number;
  counts: { findings: number } & ByClassification;
  byLayer: LayerRollup[];
  apps: AppCol[];
  components: Component[];
  microservices: Microservice[];
  screens: ScreenAsset[];
  findings: Finding[];
  // v3 additions (§6.2) — optional until Agent 2's endpoints land; derived
  // client-side by withV3Defaults when absent.
  domain?: Domain;
  columnStats?: ColumnStats[];
  normalizeStats?: NormalizeStats;
  normalizationEntries?: NormalizationEntry[];
};

/** GET /product-models row (§6.2). */
export type ProductModel = {
  id: string;
  name: string;
  description: string | null;
  sourceSystem: string | null;
  segment: string | null;
  geography: string | null;
  disposition: string | null;
  workspaces: { id: string; name: string }[];
  findingCount: number;
  illustrative: boolean;
};

/** A category tag aggregates findings of one (app, layer, category) cell. */
export type CategoryTag = {
  appId: string;
  layer: Layer;
  category: string;
  capdan: Classification;
  /** From the classification vocabulary — drives ✓/✗ and chip color. */
  stays: boolean;
  targetLayer: Layer | null;
  count: number;
  findings: Finding[];
};
