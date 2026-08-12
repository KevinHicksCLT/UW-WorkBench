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
