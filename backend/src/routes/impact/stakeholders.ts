// Stakeholder identification (Change Impact v2, Workstream C) — the reviewers
// the documents name per lens, derived entirely from the graph, never
// free-text. Process owners come from NodeRole Owner links; operations leaders
// from the org units that home them; Risk & Compliance and Technology are added
// only when the report actually touches those domains. Business Architecture is
// added for structural (destructive/restructure) operating-model changes.
import { classOf, type ChangeLens } from './taxonomy.js';
import type { ChangeType, Impact, Stakeholder } from './types.js';

export interface StakeholderInputs {
  changeType: ChangeType;
  lens: ChangeLens;
  /** The thing being assessed — names the Business Architecture reviewer's remit
   *  so the chip reads in context rather than as a bare function label. */
  subjectName?: string;
  /** Roles that own affected work — become Process Owner reviewers. */
  ownerRoles?: { id: string; name: string }[];
  /** Org units homing the affected work — become Operations Leader reviewers. */
  orgUnits?: { id: string | null; name: string }[];
}

/** The operating-model area Business Architecture stewards, per lens — keeps the
 *  chip's secondary line meaningful instead of echoing the function name. */
const ARCHITECT_SCOPE: Partial<Record<ChangeLens, string>> = {
  'value-stream': 'Value-stream design',
  role: 'Org & role design',
  plan: 'Portfolio & roadmap',
};

/** The distinct entities of a set of impacts, as a short human list — e.g. the
 *  applications a Technology reviewer owns or the controls Risk signs off. Caps
 *  the list so a wide blast radius reads as "A, B, C +4 more". */
function namedEntities(impacts: Impact[], max = 3): string {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const i of impacts) {
    const n = i.entityName?.trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    names.push(n);
  }
  if (names.length === 0) return '';
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} +${names.length - max} more`;
}

/** Build the deduped stakeholder list for a report. Each reviewer names the
 *  concrete thing it reviews (the owning role, the org unit, the systems or
 *  controls the change touches) so the chip reads in context — never a bare
 *  repeated function label. */
export function deriveStakeholders(impacts: Impact[], inp: StakeholderInputs): Stakeholder[] {
  const out: Stakeholder[] = [];
  const seen = new Set<string>();
  const add = (s: Stakeholder) => {
    const key = `${s.kind}:${s.entityId ?? s.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };

  for (const r of inp.ownerRoles ?? []) {
    add({
      kind: 'Process Owner',
      name: r.name,
      why: `${r.name} owns work in the affected scope — must sign off on how it is re-homed.`,
      entityType: 'Role',
      entityId: r.id,
    });
  }
  for (const o of inp.orgUnits ?? []) {
    if (!o.name) continue;
    add({
      kind: 'Operations Leader',
      name: o.name,
      why: `Leads ${o.name}, which runs the affected work — owns the capacity impact.`,
      entityType: 'OrgUnit',
      entityId: o.id,
    });
  }

  const cls = classOf(inp.changeType);
  const structural = cls === 'destructive' || cls === 'restructure';
  const architectScope = ARCHITECT_SCOPE[inp.lens];
  if (structural && architectScope) {
    add({
      kind: 'Business Architect',
      name: architectScope,
      why: inp.subjectName
        ? `Stewards the operating-model design that "${inp.subjectName}" reshapes.`
        : 'Stewards the operating-model design this structural change reshapes.',
      entityType: 'Function',
      entityId: null,
    });
  }

  // Risk & Compliance reviews the specific controls the change touches — name
  // them so it's clear why the function is on the packet.
  const controlImpacts = impacts.filter((i) => i.domain === 'compliance');
  if (controlImpacts.length) {
    const controls = namedEntities(controlImpacts);
    add({
      kind: 'Risk & Compliance',
      name: controls || 'Controls & approvals',
      why: controls
        ? `Reviews the controls this change touches — ${controls}.`
        : 'Reviews the standards, regulations and approval controls this change touches.',
      entityType: 'Control',
      entityId: null,
    });
  }

  // Technology reviews the specific systems the change touches.
  const techImpacts = impacts.filter(
    (i) => i.domain === 'technology' || i.category === 'applications',
  );
  if (techImpacts.length) {
    const systems = namedEntities(techImpacts);
    add({
      kind: 'Technology',
      name: systems || 'Applications & integrations',
      why: systems
        ? `Owns the systems this change touches — ${systems}.`
        : 'Owns the applications, integrations and systems of record this change touches.',
      entityType: 'Application',
      entityId: null,
    });
  }
  return out;
}
