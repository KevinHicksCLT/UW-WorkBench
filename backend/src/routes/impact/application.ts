// Impact walker for Application subjects (the Applications lens). Board apps
// (RationalizationApp) resolve to estate Applications through their catalog
// FK; the walk then covers live process usage (NodeAppUsage), regulatory
// evidence links, the roles working in the touched tasks, and board-level
// dependents (shared-service capabilities, mapped screens).
import { prisma } from '../../db/prisma.js';
import { rolesForNodes, streamAncestry } from '../../lib/resolvers/index.js';
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

export interface ApplicationSubject {
  applicationIds?: string[];
  rationalizationAppIds?: string[];
}

export async function assessApplication(
  companyId: string,
  subject: ApplicationSubject,
  changeType: ChangeType,
  label?: string,
): Promise<ImpactReport | null> {
  const cls = classOf(changeType);
  const rAppIds = subject.rationalizationAppIds ?? [];
  const rApps = rAppIds.length
    ? await prisma.rationalizationApp.findMany({
        where: { id: { in: rAppIds }, companyId },
        select: { id: true, name: true, kind: true, applicationId: true },
      })
    : [];
  const appIds = [
    ...new Set([
      ...(subject.applicationIds ?? []),
      ...rApps.map((r) => r.applicationId).filter((id): id is string => !!id),
    ]),
  ];
  const apps = appIds.length
    ? await prisma.application.findMany({
        where: { id: { in: appIds }, companyId },
        select: { id: true, name: true, kind: true },
      })
    : [];
  if (!apps.length && !rApps.length) return null;
  const estateIds = apps.map((a) => a.id);

  const usage = estateIds.length
    ? await prisma.nodeAppUsage.findMany({
        where: { applicationId: { in: estateIds }, processNode: { companyId } },
        select: {
          processNodeId: true,
          usageType: true,
          processNode: { select: { displayValue: true } },
        },
      })
    : [];
  const performed = usage.filter((u) => u.usageType === 'performed');
  const performedIds = [...new Set(performed.map((u) => u.processNodeId))];

  // Tasks where NO other system performs the work lose their only automation.
  const otherPerformers = performedIds.length
    ? await prisma.nodeAppUsage.findMany({
        where: {
          processNodeId: { in: performedIds },
          usageType: 'performed',
          applicationId: { notIn: estateIds },
        },
        select: { processNodeId: true },
      })
    : [];
  const covered = new Set(otherPerformers.map((o) => o.processNodeId));
  const soleTasks = performed.filter((u) => !covered.has(u.processNodeId));

  const impacts: Impact[] = [];
  pushCapped(
    impacts,
    [...new Map(soleTasks.map((u) => [u.processNodeId, u.processNode.displayValue])).entries()],
    ITEM_CAP,
    ([id, name]) => ({
      severity: grade('BREAKING', cls),
      category: 'tasks',
      entityType: 'ProcessNode',
      entityId: id,
      entityName: name,
      description: 'No other system performs this task — work stops without a replacement.',
    }),
    (rest) => ({
      severity: grade('BREAKING', cls),
      category: 'tasks',
      entityType: 'ProcessNode',
      entityId: null,
      entityName: `${rest.length} more solely-performed tasks`,
      description: 'Also performed only by this application.',
      count: rest.length,
    }),
  );
  const coTasks = performedIds.length - new Set(soleTasks.map((u) => u.processNodeId)).size;
  if (coTasks > 0) {
    impacts.push({
      severity: grade('HIGH', cls),
      category: 'tasks',
      entityType: 'ProcessNode',
      entityId: null,
      entityName: `${coTasks} co-performed task${coTasks === 1 ? '' : 's'}`,
      description: 'Another system also performs these — workload shifts onto it.',
      count: coTasks,
    });
  }
  const memorialized = usage.length - performed.length;
  if (memorialized > 0) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      category: 'tasks',
      entityType: 'ProcessNode',
      entityId: null,
      entityName: `${memorialized} record-keeping link${memorialized === 1 ? '' : 's'}`,
      description: 'Tasks memorialize their outputs here — records need a new system of record.',
      count: memorialized,
    });
  }

  // Regulatory evidence tied to the application.
  const regLinks = estateIds.length
    ? await prisma.regulationApplication.findMany({
        where: { applicationId: { in: estateIds }, companyId },
        select: { regId: true, regulation: { select: { title: true } } },
      })
    : [];
  pushCapped(
    impacts,
    [...new Map(regLinks.map((r) => [r.regId, r.regulation.title])).entries()],
    ITEM_CAP,
    ([id, title]) => ({
      severity: grade('BREAKING', cls),
      category: 'compliance',
      entityType: 'Regulation',
      entityId: id,
      entityName: title,
      description: 'Regulatory evidence or required integration runs through this application.',
    }),
    (rest) => ({
      severity: grade('BREAKING', cls),
      category: 'compliance',
      entityType: 'Regulation',
      entityId: null,
      entityName: `${rest.length} more linked regulations`,
      description: 'Also evidenced through this application.',
      count: rest.length,
    }),
  );

  // People whose day-to-day runs through the app.
  const usageNodeIds = [...new Set(usage.map((u) => u.processNodeId))];
  if (usageNodeIds.length) {
    const roleMap = await rolesForNodes(usageNodeIds);
    const roles = new Set<string>();
    for (const entries of roleMap.values()) for (const e of entries) roles.add(e.id);
    if (roles.size) {
      impacts.push({
        severity: grade('MEDIUM', cls),
        category: 'roles',
        entityType: 'Role',
        entityId: null,
        entityName: `${roles.size} role${roles.size === 1 ? '' : 's'}`,
        description: 'Work in tasks that use this application — retraining / new tooling needed.',
        count: roles.size,
      });
    }
    const ancestry = await streamAncestry(usageNodeIds);
    const streams = [
      ...new Set([...ancestry.values()].map((a) => a.valueStreamName).filter(Boolean)),
    ];
    if (streams.length) {
      impacts.push({
        severity: 'LOW',
        category: 'scope',
        entityType: 'Application',
        entityId: estateIds[0] ?? null,
        entityName: `${streams.length} value stream${streams.length === 1 ? '' : 's'} touched`,
        description: streams.slice(0, 6).join(', ') + (streams.length > 6 ? '…' : ''),
        count: streams.length,
      });
    }
  }

  // Board-level dependents.
  if (rAppIds.length) {
    const [sharedDeps, screens, mappedScreens] = await Promise.all([
      prisma.rationalizationCapability.count({
        where: { sharedServiceId: { in: rAppIds }, companyId },
      }),
      prisma.screenAsset.count({ where: { appId: { in: rAppIds }, companyId } }),
      prisma.screenAsset.count({
        where: { appId: { in: rAppIds }, companyId, processNodeId: { not: null } },
      }),
    ]);
    if (sharedDeps) {
      impacts.push({
        severity: grade('HIGH', cls),
        category: 'applications',
        entityType: 'RationalizationCapability',
        entityId: null,
        entityName: `${sharedDeps} dependent capabilit${sharedDeps === 1 ? 'y' : 'ies'}`,
        description: 'Other applications on the board consume this as a shared service.',
        count: sharedDeps,
      });
    }
    if (screens) {
      impacts.push({
        severity: grade('LOW', cls),
        category: 'applications',
        entityType: 'ScreenAsset',
        entityId: null,
        entityName: `${screens} screen${screens === 1 ? '' : 's'}${mappedScreens ? ` (${mappedScreens} mapped to the process spine)` : ''}`,
        description: 'User-facing surfaces documented for this application.',
        count: screens,
      });
    }
  }
  if (!apps.length && rApps.length) {
    impacts.push({
      severity: 'LOW',
      category: 'scope',
      entityType: 'RationalizationApp',
      entityId: rApps[0].id,
      entityName: rApps.map((r) => r.name).join(', '),
      description:
        'Board apps not linked to the application catalog — estate-wide usage could not be walked.',
    });
  }

  const name =
    label ??
    (apps.length ? apps.map((a) => a.name).join(', ') : rApps.map((r) => r.name).join(', '));
  return buildReport(
    {
      kind: 'application',
      id: estateIds[0] ?? rApps[0]?.id ?? null,
      name,
      context: apps.length
        ? `${apps.length} estate application${apps.length === 1 ? '' : 's'} · ${usage.length} process usage link${usage.length === 1 ? '' : 's'}`
        : null,
    },
    changeType,
    impacts,
  );
}
