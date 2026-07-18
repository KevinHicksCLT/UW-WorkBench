// Applications catalog — the systems where work is executed and memorialized.
// Feeds the Applications tab; sidebar app items deep-link here.
// erd_v5: each app's value streams + roles come from the NodeAppUsage junction
// (app → ProcessNode) joined to the closure (L2 ancestor = value stream) and
// NodeRole (roles working those nodes) — no name matching, no full-table loads.
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
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
          select: {
            id: true,
            workspace: { select: { id: true, name: true, status: true } },
          },
        },
      },
    });
    if (!app) return res.status(404).json({ error: 'Not found' });

    // Scan contents — what the knowledge base holds for this app, derived live
    // from the rationalization tables its board columns feed (never stored).
    let contents = null;
    const boardAppIds = app.rationalizationApps.map((a) => a.id);
    if (app.scanStatus === 'SCANNED' && boardAppIds.length > 0) {
      const [caps, screens, micro] = await Promise.all([
        prisma.rationalizationCapability.findMany({
          where: { appId: { in: boardAppIds } },
          select: { layer: true, capdan: true, deadCode: true },
        }),
        prisma.screenAsset.count({ where: { appId: { in: boardAppIds } } }),
        prisma.rationalizationMicroservice.findMany({
          where: { workspace: { apps: { some: { id: { in: boardAppIds } } } } },
          select: { name: true, status: true },
          orderBy: { position: 'asc' },
        }),
      ]);
      const byLayer = new Map<string, number>();
      for (const c of caps) byLayer.set(c.layer, (byLayer.get(c.layer) ?? 0) + 1);
      contents = {
        findings: caps.length,
        findingsByLayer: [...byLayer.entries()].map(([layer, count]) => ({ layer, count })),
        common: caps.filter((c) => c.capdan === 'Common' && !c.deadCode).length,
        moves: caps.filter((c) => c.capdan !== 'Common' || c.deadCode).length,
        deadCode: caps.filter((c) => c.deadCode).length,
        screens,
        microservices: micro,
      };
    }

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
        summary: app.scanSummary ?? null,
        contents,
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

/** Repo metadata gathered at scan time from the GitHub/GitLab API — proof the
 *  scan really touched the codebase (languages, size, activity). Fetch failures
 *  degrade to an error note; the scan itself still completes. */
async function fetchRepoSummary(repoUrl: string): Promise<Prisma.InputJsonObject> {
  const fetchedAt = new Date().toISOString();
  const timeout = AbortSignal.timeout(8000);
  // Raw API payloads are untyped — narrow each field to a JSON-safe primitive.
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  const num = (v: unknown) => (typeof v === 'number' ? v : null);
  const strList = (v: unknown) =>
    Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : [];
  try {
    const u = new URL(repoUrl);
    let path = u.pathname;
    while (path.startsWith('/')) path = path.slice(1);
    while (path.endsWith('/')) path = path.slice(0, -1);
    if (path.endsWith('.git')) path = path.slice(0, -4);
    if (u.hostname.toLowerCase() === 'github.com') {
      const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'transform-platform' };
      const repoRes = await fetch(`https://api.github.com/repos/${path}`, {
        headers,
        signal: timeout,
      });
      if (!repoRes.ok)
        return { fetchedAt, source: 'github', error: `GitHub API ${repoRes.status}` };
      const r = (await repoRes.json()) as Record<string, unknown>;
      const langRes = await fetch(`https://api.github.com/repos/${path}/languages`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      const languages = langRes.ok ? ((await langRes.json()) as Record<string, number>) : {};
      return {
        fetchedAt,
        source: 'github',
        fullName: str(r.full_name),
        description: str(r.description),
        defaultBranch: str(r.default_branch),
        sizeKb: num(r.size),
        stars: num(r.stargazers_count),
        forks: num(r.forks_count),
        openIssues: num(r.open_issues_count),
        lastPushedAt: str(r.pushed_at),
        topics: strList(r.topics),
        license: str((r.license as { spdx_id?: string } | null)?.spdx_id),
        languages,
      };
    }
    // GitLab (gitlab.com or self-hosted with "gitlab" in the hostname).
    const base = `${u.origin}/api/v4/projects/${encodeURIComponent(path)}`;
    const projRes = await fetch(base, { signal: timeout });
    if (!projRes.ok) return { fetchedAt, source: 'gitlab', error: `GitLab API ${projRes.status}` };
    const p = (await projRes.json()) as Record<string, unknown>;
    const langRes = await fetch(`${base}/languages`, { signal: AbortSignal.timeout(8000) });
    const languages = langRes.ok ? ((await langRes.json()) as Record<string, number>) : {};
    return {
      fetchedAt,
      source: 'gitlab',
      fullName: str(p.path_with_namespace),
      description: str(p.description),
      defaultBranch: str(p.default_branch),
      stars: num(p.star_count),
      forks: num(p.forks_count),
      lastPushedAt: str(p.last_activity_at),
      topics: strList(p.topics),
      languages,
    };
  } catch (err) {
    return { fetchedAt, error: err instanceof Error ? err.message : 'repo fetch failed' };
  }
}

// POST /applications/:id/scan — attach the codebase (repo URL + live app URL),
// gather repo metadata from the GitHub/GitLab API into scanSummary, and mark
// the application SCANNED (the gate the Workspace map filters on). The deeper
// knowledge-base agent that walks the repo hangs off this same block later.
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

    const summary = await fetchRepoSummary(parsed.data.repoUrl);
    const updated = await prisma.application.update({
      where: { id: app.id },
      data: {
        repoUrl: parsed.data.repoUrl,
        appUrl: parsed.data.appUrl ?? null,
        scanStatus: 'SCANNED',
        scannedAt: new Date(),
        scanSummary: summary,
      },
      select: { scanStatus: true, repoUrl: true, appUrl: true, scannedAt: true, scanSummary: true },
    });
    res.json({
      scan: {
        status: updated.scanStatus,
        repoUrl: updated.repoUrl,
        appUrl: updated.appUrl,
        scannedAt: updated.scannedAt,
        summary: updated.scanSummary ?? null,
        contents: null,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
