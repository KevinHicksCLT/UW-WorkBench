// Live taxonomy API — the in-app twin of scripts/export-taxonomy.ts. Serves
// the SKOS concept schemes over the operating-model graph (plan §3, 2-E):
//   GET /taxonomy          → scheme list + concept counts
//   GET /taxonomy/:scheme  → one scheme, compact viewer tree (?format=flat
//                            for the exporter's flat node list)
// Cross-domain read like /search: requireAuth only, cached, tenant-scoped.
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { cacheResponses } from '../lib/responseCache.js';
import {
  SCHEMES,
  SCHEME_TITLES,
  buildScheme,
  isScheme,
  schemeCounts,
  toViewerTree,
} from '../lib/ontology/taxonomy.js';

const router = Router();
router.use(requireAuth);
router.use(cacheResponses(60_000));

async function activeCompanyId(req: Request, res: Response): Promise<string | null> {
  const company = await prisma.company.findFirst({
    where: { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!company) {
    res.status(404).json({ error: 'No company found' });
    return null;
  }
  return company.id;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const counts = await schemeCounts(companyId);
    res.json({
      schemes: SCHEMES.map((s) => ({ scheme: s, title: SCHEME_TITLES[s], count: counts[s] })),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:scheme', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scheme = req.params.scheme;
    if (!isScheme(scheme)) return res.status(404).json({ error: 'Not found' });
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const nodes = await buildScheme(scheme, companyId);
    if (req.query.format === 'flat') {
      return res.json({ scheme, title: SCHEME_TITLES[scheme], count: nodes.length, nodes });
    }
    res.json({
      scheme,
      title: SCHEME_TITLES[scheme],
      count: nodes.length,
      tree: toViewerTree(nodes),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
