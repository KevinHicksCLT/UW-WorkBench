// API response types for the Forms Rationalization module (/forms/*).

export type FormVersionSummary = {
  id: string;
  versionNo: number;
  status: string; // ingesting | ready | quarantined
  segConfidence: number;
};

export type PolicyFormRow = {
  id: string;
  formNumber: string;
  title: string;
  lob: string | null;
  states: string[] | null;
  editionDate: string | null;
  filingStatus: string; // Draft | Filed | Approved | Withdrawn
  provenance: string; // client | iso-flagged
  ownerRole: { id: string; displayValue: string } | null;
  versions: FormVersionSummary[];
  latestVersion: FormVersionSummary | null;
  clauseCount: number;
  fieldCount: number;
  _count: { dispositions: number; applications: number; processLinks: number };
};

export type FormDetail = PolicyFormRow & {
  dispositions: { id: string; type: string; status: string; rationale: string | null }[];
  applications: { id: string; role_: string; application: { id: string; name: string } }[];
  processLinks: {
    id: string;
    role_: string;
    processNode: { id: string; displayValue: string; isTask: boolean };
  }[];
  latestClauses: {
    id: string;
    ordinal: number;
    level: number;
    heading: string | null;
    text: string;
    segConfidence: number;
  }[];
  /** Canonical text of the latest version — the form document view. */
  latestSourceText: string | null;
  latestSourceUri: string | null;
};

export type WorkingSetRow = {
  id: string;
  name: string;
  description: string | null;
  mode: 'reading' | 'portfolio';
  modeOverride: string | null;
  clusterThreshold: number;
  clusterStatus: string; // none | running | done | failed
  clusteredAt: string | null;
  createdAt: string;
  _count: { members: number; clusters: number; findings: number };
};

export type MatrixColumn = {
  id: string;
  versionNo: number;
  form: { id: string; formNumber: string; title: string };
};

export type MatrixCell = {
  state: 'identical' | 'near' | 'divergent' | 'unique' | 'absent';
  similarity: number;
  outlier: boolean;
  clauseId: string | null;
};

export type MatrixRow = {
  clusterId: string;
  label: string;
  divergenceScore: number;
  representativeText: string | null;
  memberCount: number;
  findingCount: number;
  hasPreferredWording: boolean;
  dispositions: { id: string; type: string; status: string }[];
  cells: Record<string, MatrixCell>;
};

export type MatrixResponse = {
  workingSet: {
    id: string;
    name: string;
    clusterThreshold: number;
    clusterStatus: string;
    clusteredAt: string | null;
    modeOverride: string | null;
    mode: 'reading' | 'portfolio';
  };
  columns: MatrixColumn[];
  rows: MatrixRow[];
};

export type Finding = {
  id: string;
  workingSetId: string | null;
  clusterId: string | null;
  subjectKind: string;
  claim: string;
  citations: { formVersionId: string; clauseId: string; quote: string }[];
  confidence: number;
  status: string; // new | needs-human | accepted | rejected | superseded
  agentSkill: string;
  traceRef: string | null;
  createdAt: string;
};

export type CompareRow = {
  a: { id: string; ordinal: number; heading: string | null; text: string } | null;
  b: { id: string; ordinal: number; heading: string | null; text: string } | null;
  status: 'identical' | 'near' | 'divergent' | 'unique';
  similarity: number;
};

export type Disposition = {
  id: string;
  subjectKind: string;
  type: string; // keep | merge | retire | redraft
  status: string; // proposed | approved | rejected | executed
  rationale: string | null;
  form: { id: string; formNumber: string; title: string } | null;
  targetForm: { id: string; formNumber: string; title: string } | null;
  cluster: { id: string; label: string; workingSetId: string } | null;
  ownerRole: { id: string; displayValue: string } | null;
  events: { id: string; event: string; actorKind: string; at: string; note: string | null }[];
  createdAt: string;
};

export type FieldDefinitionRow = {
  id: string;
  key: string;
  dataSetType: string;
  dataType: string;
  acordRef: string | null;
  scope: string;
  stability: string; // stable | do-not-map
  compositionParts: string[] | null;
  compositionFormat: string | null;
  version: number;
  _count: { mappings: number };
};

export type FieldMappingRow = {
  id: string;
  confidence: number;
  nameSim: number;
  labelSim: number;
  optionOverlap: number;
  status: string; // suggested | needs-human | confirmed | rejected
  formField: {
    id: string;
    sourceName: string;
    label: string | null;
    widgetType: string;
    formVersion: {
      id: string;
      versionNo: number;
      form: { id: string; formNumber: string; title: string };
    };
  };
  fieldDefinition: { id: string; key: string; dataSetType: string; stability: string };
};

export type DivergenceGroup = {
  fieldDefinition: { id: string; key: string; dataSetType: string };
  divergenceKinds: string[];
  members: {
    formFieldId: string;
    sourceName: string;
    label: string | null;
    widgetType: string;
    required: boolean;
    form: { id: string; formNumber: string };
  }[];
};

export type FormsInsights = {
  library: { forms: number; versions: number; clauses: number; quarantinedVersions: number };
  rationalization: {
    workingSets: number;
    clusters: number;
    findingsByStatus: Record<string, number>;
    dispositionsByStatus: Record<string, number>;
    dispositionsByType: Record<string, number>;
    preferredWordings: number;
    dispositionCoverage: number;
  };
  fieldPlane: {
    definitions: number;
    extractedFields: number;
    mappingsByStatus: Record<string, number>;
  };
};
