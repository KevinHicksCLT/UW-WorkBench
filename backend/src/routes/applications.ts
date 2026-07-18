// Applications catalog — the systems where work is executed and memorialized.
// Feeds the Applications tab; sidebar app items deep-link here.
// erd_v5: each app's value streams + roles come from the NodeAppUsage junction
// (app → ProcessNode) joined to the closure (L2 ancestor = value stream) and
// NodeRole (roles working those nodes) — no name matching, no full-table loads.
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { cacheResponses } from '../lib/responseCache.js';
import { ancestorNames, rolesForNodes } from '../lib/resolvers/index.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('applications'));
router.use(cacheResponses(15_000));

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({
      where: { tenantId: req.tenantId },
      select: { id: true },
    });
    if (!company) return res.status(404).json({ error: 'No company' });
    const companyId = company.id;

    const [apps, usages] = await Promise.all([
      prisma.application.findMany({
        where: { companyId },
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          code: true,
          name: true,
          kind: true,
          category: true,
          vendor: true,
          criticality: true,
          systemOfRecord: true,
          illustrative: true,
          totalTco: true,
          description: true,
          scanStatus: true,
          orgUnit: { select: { displayValue: true } },
          _count: { select: { nodeAppUsages: true } },
        },
      }),
      // every node an app is used on → resolve that node's value stream + roles.
      prisma.nodeAppUsage.findMany({
        where: { companyId },
        select: { applicationId: true, processNodeId: true },
      }),
    ]);

    // Resolve every used node's value-stream name + roles in two batched passes.
    const nodeIds = [...new Set(usages.map((u) => u.processNodeId))];
    const [vsNames, nodeRoles] = await Promise.all([
      ancestorNames(nodeIds),
      rolesForNodes(nodeIds),
    ]);

    // applicationId → { value-stream names, roleId → name, division → usage count }
    const enrich = new Map<
      string,
      { vs: Set<string>; roles: Map<string, string>; div: Map<string, number> }
    >();
    for (const u of usages) {
      let b = enrich.get(u.applicationId);
      if (!b) {
        b = { vs: new Set(), roles: new Map(), div: new Map() };
        enrich.set(u.applicationId, b);
      }
      const loc = vsNames.get(u.processNodeId);
      if (loc?.valueStreamName) b.vs.add(loc.valueStreamName);
      if (loc?.division) b.div.set(loc.division, (b.div.get(loc.division) ?? 0) + 1);
      for (const r of nodeRoles.get(u.processNodeId) ?? []) b.roles.set(r.id, r.name);
    }
    // the division an app most-used-in — fallback when it has no primary org unit.
    const topDiv = (m?: Map<string, number>) =>
      m && m.size ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;

    res.json({
      applications: apps.map((a) => {
        const b = enrich.get(a.id);
        const roleList = [...(b?.roles ?? new Map()).entries()]
          .map(([id, name]) => ({ id, name }))
          .sort((x, y) => x.name.localeCompare(y.name));
        return {
          id: a.id,
          code: a.code,
          name: a.name,
          kind: a.kind,
          category: a.category,
          vendor: a.vendor,
          criticality: a.criticality,
          description: a.description,
          scanStatus: a.scanStatus,
          systemOfRecord: a.systemOfRecord,
          illustrative: a.illustrative,
          totalTco: a.totalTco,
          primaryDivisionName: a.orgUnit?.displayValue ?? topDiv(b?.div),
          stepUsages: a._count.nodeAppUsages,
          sorDeliverables: 0,
          valueStreams: [...(b?.vs ?? new Set<string>())].sort((x, y) => x.localeCompare(y)),
          roles: roleList,
        };
      }),
    });
  } catch (e) {
    next(e);
  }
});

// GET /applications/:id — one application's full profile: catalog fields, the
// codebase-scan block, who uses it (roles), and where it's used (value streams,
// divisions, L4 sub-processes) — all derived from NodeAppUsage via the shared
// resolvers, plus its Workspace rationalization boards.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const app = await prisma.application.findFirst({
      where: { id: req.params.id, company: { tenantId: req.tenantId } },
      include: {
        orgUnit: { select: { displayValue: true } },
        rationalizationWorkspaces: { select: { id: true, name: true, status: true } },
        rationalizationApps: {
          select: { workspace: { select: { id: true, name: true, status: true } } },
        },
      },
    });
    if (!app) return res.status(404).json({ error: 'Not found' });

    const usages = await prisma.nodeAppUsage.findMany({
      where: { applicationId: app.id },
      select: { processNodeId: true, usageType: true },
    });
    const nodeIds = [...new Set(usages.map((u) => u.processNodeId))];
    const [names, nodeRoles] = await Promise.all([ancestorNames(nodeIds), rolesForNodes(nodeIds)]);

    const bump = (m: Map<string, number>, k: string | null | undefined) => {
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    };
    const vs = new Map<string, number>();
    const divisions = new Map<string, number>();
    const where = new Map<string, { valueStream: string; l3: string; l4: string; count: number }>();
    const roles = new Map<string, { id: string; name: string; count: number }>();
    for (const id of nodeIds) {
      const loc = names.get(id);
      bump(vs, loc?.valueStreamName);
      bump(divisions, loc?.division);
      if (loc?.valueStreamName && loc.l4) {
        const key = `${loc.valueStreamName}|${loc.l4}`;
        const row = where.get(key) ?? {
          valueStream: loc.valueStreamName,
          l3: loc.l3 ?? '',
          l4: loc.l4,
          count: 0,
        };
        row.count += 1;
        where.set(key, row);
      }
      for (const r of nodeRoles.get(id) ?? []) {
        const row = roles.get(r.id) ?? { id: r.id, name: r.name, count: 0 };
        row.count += 1;
        roles.set(r.id, row);
      }
    }
    const desc = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

    // Boards from both catalog links (workspace primary app + board columns).
    const boards = new Map<string, { id: string; name: string; status: string }>();
    for (const w of app.rationalizationWorkspaces) boards.set(w.id, w);
    for (const { workspace: w } of app.rationalizationApps) boards.set(w.id, w);

    res.json({
      id: app.id,
      code: app.code,
      name: app.name,
      kind: app.kind,
      category: app.category,
      vendor: app.vendor,
      criticality: app.criticality,
      systemOfRecord: app.systemOfRecord,
      illustrative: app.illustrative,
      isInternal: app.isInternal,
      ownershipModel: app.ownershipModel,
      totalTco: app.totalTco,
      description: app.description,
      division: app.orgUnit?.displayValue ?? desc(divisions)[0]?.name ?? null,
      scan: {
        status: app.scanStatus,
        repoUrl: app.repoUrl,
        appUrl: app.appUrl,
        scannedAt: app.scannedAt,
      },
      stats: {
        taskUsages: usages.length,
        nodes: nodeIds.length,
        performed: usages.filter((u) => u.usageType === 'performed').length,
        memorialized: usages.filter((u) => u.usageType === 'memorialized').length,
      },
      valueStreams: desc(vs),
      divisions: desc(divisions),
      whereUsed: [...where.values()].sort((a, b) => b.count - a.count).slice(0, 60),
      roles: [...roles.values()].sort((a, b) => b.count - a.count),
      boards: [...boards.values()],
    });
  } catch (e) {
    next(e);
  }
});

// POST /applications/:id/scan — attach the codebase (repo URL + live app URL)
// and mark the application SCANNED. Today this records the source and flips the
// gate the Workspace map filters on; the knowledge-base agent that walks the
// repo and populates the board hangs off this same block later.
const scanBody = z.object({
  repoUrl: z
    .string()
    .url()
    .refine(
      (u) => {
        const host = new URL(u).hostname.toLowerCase();
        return host === 'github.com' || host.includes('gitlab');
      },
      { message: 'repoUrl must be a GitHub or GitLab repository URL' },
    ),
  appUrl: z.string().url().optional().nullable(),
});
router.post('/:id/scan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = scanBody.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
    const app = await prisma.application.findFirst({
      where: { id: req.params.id, company: { tenantId: req.tenantId } },
      select: { id: true },
    });
    if (!app) return res.status(404).json({ error: 'Not found' });

    const updated = await prisma.application.update({
      where: { id: app.id },
      data: {
        repoUrl: parsed.data.repoUrl,
        appUrl: parsed.data.appUrl ?? null,
        scanStatus: 'SCANNED',
        scannedAt: new Date(),
      },
      select: { scanStatus: true, repoUrl: true, appUrl: true, scannedAt: true },
    });
    res.json({
      scan: {
        status: updated.scanStatus,
        repoUrl: updated.repoUrl,
        appUrl: updated.appUrl,
        scannedAt: updated.scannedAt,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
