// Per-lens change taxonomies — the specialized change-type vocabularies the
// documents prescribe (Change Impact Analysis v2, Workstream A). One generic
// verb list can't express that "Change SLA" hits staffing while "Convert To
// Knowledge Object" hits governance, so every subject kind gets its own list.
//
// Every entry funnels into ONE machinery: a `changeClass` (how disruptive the
// verb is) plus an `emphasis` (the domains this verb hits hardest — its
// blast-radius hint). `weigh()` grades a base severity by class and then bumps
// it a rung inside the emphasized domains, so picking a change type visibly
// reshapes the report's domain severities (acceptance criterion #1).
//
// Back-compat: the original nine rationalization tokens stay valid and keep an
// EMPTY emphasis, so `weigh` collapses to the old `grade` for them and the
// Applications/Products boards produce byte-identical reports.

import type { ImpactDomain } from './types.js';

/** How disruptive the verb is. `additive` (introduce a step/agent/authority)
 *  sits between restructure and adopt — new work, but nothing torn out. */
export type ChangeClass = 'destructive' | 'restructure' | 'additive' | 'adopt';

/** Which lens a change type belongs to — drives the frontend picker and maps
 *  1:1 onto a subject kind. Applications/Products keep the legacy vocabulary. */
export type ChangeLens =
  'value-stream' | 'role' | 'deliverable' | 'plan' | 'application' | 'product';

export interface ChangeTypeMeta {
  token: string;
  label: string;
  lens: ChangeLens;
  changeClass: ChangeClass;
  /** Domains this verb hits hardest — impacts landing here grade one rung up. */
  emphasis: ImpactDomain[];
}

// Terse builder to keep the table readable.
const t = (
  token: string,
  label: string,
  lens: ChangeLens,
  changeClass: ChangeClass,
  emphasis: ImpactDomain[] = [],
): ChangeTypeMeta => ({ token, label, lens, changeClass, emphasis });

/** The original rationalization vocabulary — Applications and Products. Empty
 *  emphasis is deliberate: these reports must not change shape (back-compat). */
const LEGACY: ChangeTypeMeta[] = [
  t('RETIRE', 'Retire', 'application', 'destructive'),
  t('DROP', 'Drop', 'application', 'destructive'),
  t('DEPRECATE', 'Deprecate', 'application', 'destructive'),
  t('REPLACE', 'Replace', 'application', 'destructive'),
  t('MERGE', 'Merge', 'application', 'restructure'),
  t('CONSOLIDATE', 'Consolidate', 'application', 'restructure'),
  t('MOVE', 'Move', 'application', 'restructure'),
  t('ADOPT', 'Adopt', 'application', 'adopt'),
  t('HOLD', 'Hold', 'application', 'adopt'),
];

/** Value-stream lens (15) — the process-spine change verbs. */
const VALUE_STREAM: ChangeTypeMeta[] = [
  t('REMOVE_PROCESS_STEP', 'Remove process step', 'value-stream', 'destructive', ['operational']),
  t('ADD_PROCESS_STEP', 'Add process step', 'value-stream', 'additive', ['operational']),
  t('ELIMINATE_HANDOFF', 'Eliminate handoff', 'value-stream', 'restructure', ['operational']),
  t('AUTOMATE_ACTIVITY', 'Automate activity', 'value-stream', 'restructure', [
    'technology',
    'operational',
  ]),
  t('CHANGE_SLA', 'Change SLA', 'value-stream', 'restructure', ['operational']),
  t('CONSOLIDATE_VALUE_STREAMS', 'Consolidate value streams', 'value-stream', 'restructure', [
    'operational',
    'data',
  ]),
  t('INTRODUCE_NEW_APPROVAL', 'Introduce new approval', 'value-stream', 'additive', [
    'compliance',
    'operational',
  ]),
  t('REMOVE_APPROVAL', 'Remove approval', 'value-stream', 'destructive', ['compliance']),
  t('CENTRALIZE_WORK', 'Centralize work', 'value-stream', 'restructure', ['operational']),
  t('SHIFT_WORK_TO_CUSTOMER', 'Shift work to customer', 'value-stream', 'restructure', [
    'operational',
    'product',
  ]),
  t('ADD_AI_AGENT', 'Add AI agent', 'value-stream', 'additive', ['technology', 'operational']),
  t('CHANGE_WORKFLOW_SEQUENCE', 'Change workflow sequence', 'value-stream', 'restructure', [
    'operational',
  ]),
  t('OUTSOURCE_ACTIVITY', 'Outsource activity', 'value-stream', 'restructure', [
    'operational',
    'compliance',
  ]),
  t('INTRODUCE_EVENT_TRIGGER', 'Introduce event trigger', 'value-stream', 'additive', [
    'technology',
  ]),
  t(
    'STANDARDIZE_REGIONAL_VARIATION',
    'Standardize regional variation',
    'value-stream',
    'restructure',
    ['compliance', 'product'],
  ),
];

/** Role lens (15) — the workforce/organization change verbs. */
const ROLE: ChangeTypeMeta[] = [
  t('ELIMINATE_ROLE', 'Eliminate role', 'role', 'destructive', ['operational']),
  t('MERGE_ROLES', 'Merge roles', 'role', 'restructure', ['operational']),
  t('SPLIT_ROLE', 'Split role', 'role', 'restructure', ['operational']),
  t('AI_AUGMENTATION', 'AI augmentation', 'role', 'additive', ['operational', 'technology']),
  t('AI_AUTOMATION', 'AI automation', 'role', 'restructure', ['operational', 'technology']),
  t('NEW_APPROVAL_AUTHORITY', 'New approval authority', 'role', 'additive', [
    'compliance',
    'operational',
  ]),
  t('ORGANIZATIONAL_REALIGNMENT', 'Organizational realignment', 'role', 'restructure', [
    'operational',
  ]),
  t('SHIFT_TO_SHARED_SERVICES', 'Shift to shared services', 'role', 'restructure', ['operational']),
  t('NEW_COMPETENCY_REQUIREMENT', 'New competency requirement', 'role', 'additive', [
    'operational',
  ]),
  t('SPAN_OF_CONTROL_CHANGE', 'Span of control change', 'role', 'restructure', ['operational']),
  t('AGENT_SUPERVISION_MODEL', 'Agent supervision model', 'role', 'additive', [
    'operational',
    'technology',
  ]),
  t('HUMAN_IN_THE_LOOP', 'Human-in-the-loop introduction', 'role', 'additive', [
    'operational',
    'compliance',
  ]),
  t('ROLE_CENTRALIZATION', 'Role centralization', 'role', 'restructure', ['operational']),
  t('OUTSOURCING', 'Outsourcing', 'role', 'restructure', ['operational', 'compliance']),
  t('CROSS_FUNCTIONAL_TEAM_CREATION', 'Cross-functional team creation', 'role', 'additive', [
    'operational',
  ]),
];

/** Deliverable lens (15) — the document/knowledge-object change verbs. */
const DELIVERABLE: ChangeTypeMeta[] = [
  t('ELIMINATE_DOCUMENT', 'Eliminate document', 'deliverable', 'destructive', [
    'operational',
    'compliance',
  ]),
  t('MERGE_DELIVERABLES', 'Merge deliverables', 'deliverable', 'restructure', ['operational']),
  t('CONVERT_TO_STRUCTURED_DATA', 'Convert to structured data', 'deliverable', 'restructure', [
    'data',
    'technology',
  ]),
  t('CONVERT_TO_KNOWLEDGE_OBJECT', 'Convert to knowledge object', 'deliverable', 'restructure', [
    'data',
    'compliance',
  ]),
  t('AI_GENERATED', 'AI generated', 'deliverable', 'additive', ['technology', 'compliance']),
  t('AI_REVIEWED', 'AI reviewed', 'deliverable', 'additive', ['compliance']),
  t('AUTOMATED_APPROVAL_PACKAGE', 'Automated approval package', 'deliverable', 'restructure', [
    'compliance',
    'operational',
  ]),
  t('DIGITAL_AUDIT_EVIDENCE', 'Digital audit evidence', 'deliverable', 'restructure', [
    'compliance',
    'data',
  ]),
  t('DYNAMIC_REPORT', 'Dynamic report', 'deliverable', 'restructure', ['data', 'technology']),
  t('EVENT_DRIVEN', 'Event-driven', 'deliverable', 'additive', ['technology']),
  t('VERSIONLESS', 'Versionless', 'deliverable', 'restructure', ['data', 'compliance']),
  t('SHARED_KNOWLEDGE_ASSET', 'Shared knowledge asset', 'deliverable', 'additive', ['data']),
  t('REGULATORY_PACKAGING_CHANGE', 'Regulatory packaging change', 'deliverable', 'restructure', [
    'compliance',
  ]),
  t('SYSTEM_GENERATED_ARTIFACT', 'System-generated artifact', 'deliverable', 'restructure', [
    'technology',
    'data',
  ]),
  t('DELIVERABLE_RETIREMENT', 'Retirement', 'deliverable', 'destructive', [
    'operational',
    'compliance',
  ]),
];

/** Plan lens (10) — the enterprise-plan (SPM) change verbs. */
const PLAN: ChangeTypeMeta[] = [
  t('RESCHEDULE', 'Reschedule', 'plan', 'restructure', ['operational']),
  t('RESCOPE', 'Rescope', 'plan', 'restructure', ['operational', 'product']),
  t('DEFUND', 'Defund', 'plan', 'destructive', ['operational']),
  t('REFUND', 'Refund', 'plan', 'additive', ['operational']),
  t('PAUSE', 'Pause', 'plan', 'restructure', ['operational']),
  t('CANCEL', 'Cancel', 'plan', 'destructive', ['operational', 'compliance']),
  t('ACCELERATE', 'Accelerate', 'plan', 'restructure', ['operational']),
  t('RE_SEQUENCE', 'Re-sequence', 'plan', 'restructure', ['operational']),
  t('MERGE_INITIATIVES', 'Merge initiatives', 'plan', 'restructure', ['operational']),
  t('SPLIT_INITIATIVE', 'Split initiative', 'plan', 'restructure', ['operational']),
];

const ALL: ChangeTypeMeta[] = [...LEGACY, ...VALUE_STREAM, ...ROLE, ...DELIVERABLE, ...PLAN];

/** The single registry: token → metadata. */
export const CHANGE_TYPE_META: Record<string, ChangeTypeMeta> = Object.fromEntries(
  ALL.map((m) => [m.token, m]),
);

/** Every valid change-type token across all lenses (API enum + validation). */
export const ALL_CHANGE_TYPES = ALL.map((m) => m.token) as [string, ...string[]];

/** Change types offered per subject kind — the frontend picker reads this. */
export const CHANGE_TYPES_BY_LENS: Record<ChangeLens, ChangeTypeMeta[]> = {
  'value-stream': VALUE_STREAM,
  role: ROLE,
  deliverable: DELIVERABLE,
  plan: PLAN,
  application: LEGACY,
  product: LEGACY,
};

export function classOf(token: string): ChangeClass {
  return CHANGE_TYPE_META[token]?.changeClass ?? 'restructure';
}

export function emphasisOf(token: string): ImpactDomain[] {
  return CHANGE_TYPE_META[token]?.emphasis ?? [];
}

export function labelOf(token: string): string {
  return CHANGE_TYPE_META[token]?.label ?? token;
}
