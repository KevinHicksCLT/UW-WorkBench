// Impact walker for Role subjects (the Roles lens: consolidate / deprecate a
// role, or move / drop a single step). With taskIds the walk narrows to those
// tasks' NodeRole links; without, the whole role footprint is graded —
// ownership left orphaned, deliverables, governance responsibilities, direct
// reports, checklist duties.
import { prisma } from '../../db/prisma.js';
import { streamAncestry } from '../../lib/resolvers/index.js';
import {
  buildReport,
  classOf,
  grade,
  pushCapped,
  type ChangeType,
  type Impact,
  type ImpactReport,
} from './types.js';

const ITEM_CAP = 10;

export async function assessRole(
  companyId: string,
  roleId: string,
  taskIds: string[] | undefined,
  changeType: ChangeType,
  label?: string,
): Promise<ImpactReport | null> {
  const cls = classOf(changeType);
  const role = await prisma.role.findFirst({
    where: { id: roleId, companyId },
    select: {
      id: true,
      displayValue: true,
      orgUnit: { select: { displayValue: true } },
      _count: { select: { reports: true, checklistItems: true, ownedStandards: true } },
    },
  });
  if (!role) return null;
  const stepScope = !!taskIds?.length;

  const links = await prisma.nodeRole.findMany({
    where: { roleId, ...(stepScope ? { processNodeId: { in: taskIds } } : {}) },
    select: {
      processNodeId: true,
      role_: true,
      processNode: { select: { displayValue: true } },
    },
  });
  const ownedLinks = links.filter((l) => l.role_ === 'Owner');
  const ownedIds = ownedLinks.map((l) => l.processNodeId);

  // Which owned tasks have another Owner to fall back on?
  const others = ownedIds.length
    ? await prisma.nodeRole.findMany({
        where: { processNodeId: { in: ownedIds }, role_: 'Owner', roleId: { not: roleId } },
        select: { processNodeId: true },
      })
    : [];
  const coOwned = new Set(others.map((o) => o.processNodeId));
  const sole = ownedLinks.filter((l) => !coOwned.has(l.processNodeId));

  const impacts: Impact[] = [];
  pushCapped(
    impacts,
    sole,
    ITEM_CAP,
    (l) => ({
      severity: grade('BREAKING', cls),
      category: 'tasks',
      entityType: 'ProcessNode',
      entityId: l.processNodeId,
      entityName: l.processNode.displayValue,
      description: 'This role is the ONLY owner — the task is left ownerless without reassignment.',
    }),
    (rest) => ({
      severity: grade('BREAKING', cls),
      category: 'tasks',
      entityType: 'ProcessNode',
      entityId: null,
      entityName: `${rest.length} more solely-owned tasks`,
      description: 'Also owned only by this role.',
      count: rest.length,
    }),
  );
  const coOwnedCount = ownedIds.length - sole.length;
  if (coOwnedCount > 0) {
    impacts.push({
      severity: grade('HIGH', cls),
      category: 'tasks',
      entityType: 'ProcessNode',
      entityId: null,
      entityName: `${coOwnedCount} co-owned task${coOwnedCount === 1 ? '' : 's'}`,
      description: 'Owned together with another role — the remaining owner absorbs them.',
      count: coOwnedCount,
    });
  }
  const participant = links.length - ownedLinks.length;
  if (participant > 0) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      category: 'tasks',
      entityType: 'ProcessNode',
      entityId: null,
      entityName: `${participant} participant task${participant === 1 ? '' : 's'}`,
      description: 'The role participates in these — capacity moves with the change.',
      count: participant,
    });
  }

  // Role-global responsibilities only make sense for whole-role changes.
  if (!stepScope) {
    const [delivs, stds, regs] = await Promise.all([
      prisma.roleDeliverable.findMany({
        where: { roleId },
        select: { deliverableId: true, role_: true, deliverable: { select: { title: true } } },
      }),
      prisma.roleStandard.count({ where: { roleId } }),
      prisma.roleRegulation.count({ where: { roleId } }),
    ]);
    const ownedDelivs = delivs.filter((d) => d.role_ === 'Owner');
    const otherDelivOwners = ownedDelivs.length
      ? await prisma.roleDeliverable.findMany({
          where: {
            deliverableId: { in: ownedDelivs.map((d) => d.deliverableId) },
            role_: 'Owner',
            roleId: { not: roleId },
          },
          select: { deliverableId: true },
        })
      : [];
    const delivCoOwned = new Set(otherDelivOwners.map((d) => d.deliverableId));
    const soleDelivs = ownedDelivs.filter((d) => !delivCoOwned.has(d.deliverableId));
    pushCapped(
      impacts,
      soleDelivs,
      ITEM_CAP,
      (d) => ({
        severity: grade('BREAKING', cls),
        category: 'deliverables',
        entityType: 'Deliverable',
        entityId: d.deliverableId,
        entityName: d.deliverable.title,
        description: 'This role is its only owner — the deliverable is left unowned.',
      }),
      (rest) => ({
        severity: grade('BREAKING', cls),
        category: 'deliverables',
        entityType: 'Deliverable',
        entityId: null,
        entityName: `${rest.length} more solely-owned deliverables`,
        description: 'Also owned only by this role.',
        count: rest.length,
      }),
    );
    const contribDelivs = delivs.length - ownedDelivs.length;
    if (contribDelivs > 0) {
      impacts.push({
        severity: grade('MEDIUM', cls),
        category: 'deliverables',
        entityType: 'Deliverable',
        entityId: null,
        entityName: `${contribDelivs} contributed deliverable${contribDelivs === 1 ? '' : 's'}`,
        description: 'The role contributes to these deliverables.',
        count: contribDelivs,
      });
    }
    if (stds + regs > 0) {
      impacts.push({
        severity: grade('HIGH', cls),
        category: 'compliance',
        entityType: 'Role',
        entityId: role.id,
        entityName: `${stds} standard${stds === 1 ? '' : 's'} · ${regs} regulation${regs === 1 ? '' : 's'}`,
        description: 'Governance responsibilities assigned to this role need a new home.',
        count: stds + regs,
      });
    }
    if (role._count.ownedStandards) {
      impacts.push({
        severity: grade('HIGH', cls),
        category: 'standards',
        entityType: 'Standard',
        entityId: null,
        entityName: `${role._count.ownedStandards} owned standard${role._count.ownedStandards === 1 ? '' : 's'}`,
        description: 'Standards this role owns fall back to unowned.',
        count: role._count.ownedStandards,
      });
    }
    if (role._count.reports) {
      impacts.push({
        severity: grade('HIGH', cls),
        category: 'org',
        entityType: 'Role',
        entityId: null,
        entityName: `${role._count.reports} direct report${role._count.reports === 1 ? '' : 's'}`,
        description: 'Roles reporting to this one lose their manager line.',
        count: role._count.reports,
      });
    }
    if (role._count.checklistItems) {
      impacts.push({
        severity: grade('MEDIUM', cls),
        category: 'checklists',
        entityType: 'ChecklistItem',
        entityId: null,
        entityName: `${role._count.checklistItems} checklist item${role._count.checklistItems === 1 ? '' : 's'}`,
        description: 'Checklist duties assigned to this role become unassigned.',
        count: role._count.checklistItems,
      });
    }
  }

  // Where the affected work sits — value-stream context for the header.
  const scopeNodeIds = [...new Set(links.map((l) => l.processNodeId))];
  const ancestry = scopeNodeIds.length ? await streamAncestry(scopeNodeIds) : new Map();
  const streams = [
    ...new Set([...ancestry.values()].map((a) => a.valueStreamName).filter(Boolean)),
  ];
  if (streams.length) {
    impacts.push({
      severity: 'LOW',
      category: 'scope',
      entityType: 'Role',
      entityId: role.id,
      entityName: role.displayValue,
      description: `Active in ${streams.length} value stream${streams.length === 1 ? '' : 's'}: ${streams
        .slice(0, 6)
        .join(', ')}${streams.length > 6 ? '…' : ''}.`,
      count: streams.length,
    });
  }

  return buildReport(
    {
      kind: 'role',
      id: role.id,
      name: label ?? role.displayValue,
      context:
        [
          role.orgUnit?.displayValue,
          stepScope
            ? `${taskIds?.length} selected step${taskIds && taskIds.length === 1 ? '' : 's'}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ') || null,
    },
    changeType,
    impacts,
  );
}
