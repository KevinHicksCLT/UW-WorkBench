// 29→21(+1) value-stream mapping (operating-model rework, decided 2026-06-09).
// Maps each LEGACY ValueStream name onto its CANONICAL value-stream node name so
// every connection (roles, I/O, apps, metrics) re-links to the canonical set.
// One legacy stream is promoted to a NEW canonical stream (too much real data to
// force into a wrong bucket). Worksheet/rationale: audit/value-stream-mapping.md.

export const VS_MAPPING: Record<string, string> = {
  // ── B. renames ──
  'Actuarial Pricing, Reserving & Capital Modeling': 'Actuarial & Reserving',
  'Submission-to-Bind / Underwriting': 'Submission-to-Bind',
  'Distribution & Channel Management': 'Distribution Management',
  'Data, Analytics & AI Management': 'Data & Analytics',
  'Investment & Asset Management': 'Investment Management',
  'Legal, Governance & Privacy Management': 'Legal & Compliance',
  'Product & Proposition Management': 'Product Design & Management',
  'Reinsurance & Retrocession Management': 'Reinsurance Management',
  'Talent & Workforce Management': 'Human Capital Management',
  'Third-Party & Vendor Management': 'Vendor & Third-Party Management',
  'Customer Service, Complaints & Experience': 'Customer Service & Experience',
  'Technology Strategy, Architecture & Delivery': 'Technology Delivery & Change',
  'Finance, Treasury & Capital Management': 'Capital & Treasury Management',
  'Risk, Compliance & Regulatory Management': 'Risk & Compliance Management',
  // ── C. extras folded into their closest canonical stream ──
  'Claims Recoveries & Subrogation': 'Claims Intake-to-Settlement',
  'Service Operations, Incident & Production Support': 'Technology Delivery & Change',
  'MLOps / ML Lifecycle Management': 'Data & Analytics',
  'AIOps & Intelligent Operations': 'Technology Delivery & Change',
  'FinOps / Cloud Financial Management': 'Financial Planning & Reporting',
  'Audit & Assurance': 'Enterprise Risk Management',
  'Change Management & Adoption': 'Human Capital Management',
  'Marketing, Growth & Customer Insights': 'Distribution Management',
  // ── C. promoted to NEW canonical stream (see NEW_STREAMS) ──
  'Enterprise Strategy & Portfolio Management': 'Enterprise Strategy & Portfolio Management',
};

// New canonical value-stream nodes to create (name + parent division node name).
export const NEW_STREAMS: { name: string; division: string }[] = [
  { name: 'Enterprise Strategy & Portfolio Management', division: 'Product, Delivery & PMO' },
];

// Resolve a legacy value-stream name to its canonical node name.
export const canonicalVs = (legacyName: string): string => VS_MAPPING[legacyName] ?? legacyName;

// Inverse view: canonical stream name → the legacy ValueStream names folded into
// it (plus itself). Used to aggregate legacy-keyed data (Metric.valueStreamId,
// RoleValueStream, ProcessStep, IoItem) under a canonical value-stream node.
const LEGACY_FOR: Record<string, string[]> = {};
for (const [legacy, canon] of Object.entries(VS_MAPPING)) (LEGACY_FOR[canon] ??= []).push(legacy);
export const legacyNamesFor = (canonical: string): string[] => [...new Set([...(LEGACY_FOR[canonical] ?? []), canonical])];
