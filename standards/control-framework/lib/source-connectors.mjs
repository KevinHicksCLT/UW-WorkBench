// source-connectors.mjs — registry of source-system connectors an agent uses to gather
// the data and evidence each control needs. A control's required_data_sources[].connector_ref
// points into this map. This is the bridge from "control definition" to "how do I actually
// pull the evidence from THIS client's ecosystem" — API, MCP server, SQL, Git, SharePoint,
// Confluence, Cowork, EDI, regulator portals (SERFF/NIPR/etc.).
//
// access_method values mirror control.schema.json. The human-readable catalog with the
// 50-state regulator integrations is in ../source-connectors.md.

export const CONNECTORS = {
  // ── Identity / access ────────────────────────────────────────────────
  'iam.entra': { label: 'Microsoft Entra ID', access_method: 'API', mcp: 'graph-mcp', evidence: ['access exports', 'sign-in logs', 'PIM activations', 'access reviews'] },
  'iam.okta': { label: 'Okta', access_method: 'API', mcp: 'okta-mcp', evidence: ['user/app assignments', 'system log', 'access certification campaigns'] },
  'iam.ad': { label: 'Active Directory', access_method: 'SQL', mcp: null, evidence: ['group membership', 'privileged group deltas'] },

  // ── ITSM / change ────────────────────────────────────────────────────
  'itsm.servicenow': { label: 'ServiceNow', access_method: 'API', mcp: 'servicenow-mcp', evidence: ['change records', 'approvals', 'CAB minutes', 'incident tickets'] },
  'itsm.jira': { label: 'Jira', access_method: 'MCP', mcp: 'atlassian', evidence: ['change/issue tickets', 'approval transitions', 'release tickets'] },

  // ── Source control / CI-CD ───────────────────────────────────────────
  'scm.github': { label: 'GitHub', access_method: 'Git', mcp: 'github', evidence: ['PR approvals', 'branch protection', 'merge history', 'CODEOWNERS', 'CI run logs'] },
  'cicd.pipeline': { label: 'CI/CD pipeline', access_method: 'API', mcp: null, evidence: ['build/deploy logs', 'gate results', 'artifact provenance'] },

  // ── Finance / ERP ────────────────────────────────────────────────────
  'gl.erp': { label: 'General Ledger / ERP', access_method: 'SQL', mcp: null, evidence: ['journal entries', 'reconciliations', 'posting logs', 'interface control totals'] },
  'erp.api': { label: 'ERP API', access_method: 'API', mcp: null, evidence: ['automated postings', 'configuration of automated controls'] },

  // ── Insurance core systems ───────────────────────────────────────────
  'policy.admin': { label: 'Policy Admin System', access_method: 'API', mcp: null, evidence: ['policy transactions', 'rating outputs', 'message samples'] },
  'claims.system': { label: 'Claims System', access_method: 'SQL', mcp: null, evidence: ['claim transactions', 'reserve changes', 'payment records'] },
  'esb.integration': { label: 'Integration / ESB', access_method: 'API', mcp: null, evidence: ['message logs', 'transformation maps', 'dead-letter queues'] },
  'schema.registry': { label: 'Schema Registry', access_method: 'API', mcp: null, evidence: ['registered XSD/JSON schemas', 'schema versions', 'compatibility checks'] },
  'apigw.gateway': { label: 'API Gateway', access_method: 'API', mcp: null, evidence: ['API specs', 'conformance test results', 'traffic samples'] },

  // ── Documents / knowledge ────────────────────────────────────────────
  'docs.sharepoint': { label: 'SharePoint', access_method: 'SharePoint', mcp: 'sharepoint-mcp', evidence: ['policy documents', 'signed certifications', 'workpapers', 'data dictionaries'] },
  'docs.confluence': { label: 'Confluence', access_method: 'Confluence', mcp: 'atlassian', evidence: ['standards pages', 'mapping specs', 'runbooks', 'design docs'] },
  'docs.cowork': { label: 'Cowork workspace', access_method: 'Cowork', mcp: null, evidence: ['authored artifacts', 'human-in-the-loop sign-offs', 'review threads'] },

  // ── Observability ────────────────────────────────────────────────────
  'siem.logging': { label: 'SIEM / central logging', access_method: 'API', mcp: 'datadog', evidence: ['audit trails', 'privileged-access alerts', 'monitoring signals'] },

  // ── Regulator portals (from the 50-state DOCX) ───────────────────────
  'reg.serff': { label: 'NAIC SERFF', access_method: 'API', mcp: null, evidence: ['rate/form filing status', 'filing receipts', 'disposition records'] },
  'reg.nipr': { label: 'NAIC NIPR', access_method: 'API', mcp: null, evidence: ['producer licensing/appointment status'] },
  'reg.sbs': { label: 'NAIC State Based Systems', access_method: 'API', mcp: null, evidence: ['licensing', 'regulatory actions', 'consumer services'] },
  'reg.mcas': { label: 'NAIC MCAS (iSite+)', access_method: 'SFTP', mcp: null, evidence: ['market conduct annual statement submissions'] },
  'reg.edi.iaiabc': { label: 'IAIABC EDI (FROI/SROI)', access_method: 'EDI', mcp: null, evidence: ['workers-comp claim event acknowledgements'] },
};

export function getConnector(ref) {
  return CONNECTORS[ref] || null;
}
