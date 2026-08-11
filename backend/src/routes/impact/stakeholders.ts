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
  /** Roles that own affected work — become Process Owner reviewers. */
  ownerRoles?: { id: string; name: string }[];
  /** Org units homing the affected work — become Operations Leader reviewers. */
  orgUnits?: { id: string | null; name: string }[];
}

/** Build the deduped stakeholder list for a report. */
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
      why: 'Owns work in the affected scope — must sign off on how it is re-homed.',
      entityType: 'Role',
      entityId: r.id,
    });
  }
  for (const o of inp.orgUnits ?? []) {
    if (!o.name) continue;
    add({
      kind: 'Operations Leader',
      name: o.name,
      why: 'Leads the org unit that runs the affected work — owns the capacity impact.',
      entityType: 'OrgUnit',
      entityId: o.id,
    });
  }

  const cls = classOf(inp.changeType);
  const structural = cls === 'destructive' || cls === 'restructure';
  if (structural && (inp.lens === 'value-stream' || inp.lens === 'role' || inp.lens === 'plan')) {
    add({
      kind: 'Business Architect',
      name: 'Business Architecture',
      why: 'Stewards the operating-model design this structural change reshapes.',
      entityType: 'Function',
      entityId: null,
    });
  }
  if (impacts.some((i) => i.domain === 'compliance')) {
    add({
      kind: 'Risk & Compliance',
      name: 'Risk & Compliance',
      why: 'The change touches standards, regulations or approval controls.',
      entityType: 'Function',
      entityId: null,
    });
  }
  if (impacts.some((i) => i.domain === 'technology' || i.category === 'applications')) {
    add({
      kind: 'Technology',
      name: 'Technology',
      why: 'The change touches applications, integrations or systems of record.',
      entityType: 'Function',
      entityId: null,
    });
  }
  return out;
}
