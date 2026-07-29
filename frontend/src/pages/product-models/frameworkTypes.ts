// Types for /product-spine/framework — the normalized product-model reference
// extraction (example carrier): every sheet of the source workbook, in full.

export interface FwSource {
  carrier: string;
  title: string;
  prepared: string;
  workbook: string;
  note: string;
}

export interface FwSegment {
  dimension: string;
  segment: string;
  subSegment: string;
  serves: string;
  channels: string;
  brands: string;
  evidence: string;
  confidence: string;
}

export interface FwCatalogRow {
  unit: string;
  subUnit: string;
  family: string;
  offering: string;
  buyer: string;
  distribution: string;
  archetype: string;
  evidence: string;
  confidence: string;
}

export interface FwDimension {
  n: number;
  name: string;
  definition: string;
  atomicElements: string[];
  naturalKey: string;
  cardinality: string;
  systemOfRecord: string;
  designNote: string;
}

export interface FwArchetype {
  code: string;
  name: string;
  productsInScope: string;
  dimensions: Record<string, string>;
  rationale: string;
}

export interface FwMatrixRow {
  product: string;
  archetype: string;
  unit: string;
  dimensions: Record<string, string>;
  txnVolume: string;
  automationPotential: string;
  challenge: string;
}

export interface FwCoverage {
  parent: string;
  group: string;
  coverage: string;
  baseOrOptional: string;
  structuralNote: string;
  confidence: string;
}

export interface FwLever {
  product: string;
  leverType: string;
  lever: string;
  dimension: string;
  evidence: string;
  confidence: string;
}

export interface FwLifecycleRow {
  phase: string;
  event: string;
  actor: string;
  byArchetype: Record<string, string>;
  whyItMatters: string;
}

export interface FwEntity {
  name: string;
  naic: string;
  domicile: string;
  footprint: string;
}

export interface FwTaskMapRow {
  dimension: string;
  process: string;
  actor: string;
  tasks: string;
  artifact: string;
  applications: string;
  instrumentation: string;
}

export interface FwSourceRow {
  source: string;
  url: string;
  retrieved: string;
  evidenced: string;
}

export interface Framework {
  source: FwSource;
  readMe: { tldr: string[]; counters: { label: string; value: string }[] };
  segments: FwSegment[];
  catalog: FwCatalogRow[];
  dimensions: FwDimension[];
  frameworkNote: string;
  archetypes: FwArchetype[];
  matrix: FwMatrixRow[];
  coverages: FwCoverage[];
  levers: FwLever[];
  lifecycle: FwLifecycleRow[];
  entities: FwEntity[];
  entitiesNote: string;
  taskMap: FwTaskMapRow[];
  sources: FwSourceRow[];
  sourcesNote: string;
}
