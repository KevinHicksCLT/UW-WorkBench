// Reference vocabularies for the board: the WR-06 anatomy catalog (per layer ×
// view, what belongs and what must not be there) and the WorkspaceVocabulary
// rows that replace the frontend's hardcoded LAYERS/CAPDAN/STATUS/MODE/VIEW
// constants (DB as source of truth, plan §3 2-B). Registered BEFORE the /:id
// catch-all in index.ts so the literal paths aren't swallowed.
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { activeCompanyId } from './helpers.js';

const VOCAB_DOMAINS = ['APPLICATION', 'PRODUCT_MODEL'];

export function registerVocabularyRoutes(router: Router) {
  // GET /rationalization/vocabulary?domain=APPLICATION|PRODUCT_MODEL — the
  // board vocabulary (row axis, classification chips, statuses, modes, views,
  // legend meta). Omit ?domain for both domains at once.
  router.get('/vocabulary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const domain = typeof req.query.domain === 'string' ? req.query.domain : undefined;
      if (domain !== undefined && !VOCAB_DOMAINS.includes(domain)) {
        return res
          .status(400)
          .json({ error: `domain must be one of ${VOCAB_DOMAINS.join(' | ')}` });
      }
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const rows = await prisma.workspaceVocabulary.findMany({
        where: { companyId, ...(domain ? { domain } : {}) },
        orderBy: [{ domain: 'asc' }, { kind: 'asc' }, { sortOrder: 'asc' }],
        select: {
          domain: true,
          kind: true,
          token: true,
          label: true,
          color: true,
          sortOrder: true,
          meta: true,
        },
      });
      res.json({ vocabulary: rows });
    } catch (e) {
      next(e);
    }
  });

  // GET /rationalization/anatomy-catalog — the WR-06 reference taxonomy: per
  // layer × view (COMPONENT | BEHAVIOR | MISPLACED), what belongs and what must
  // not be there.
  router.get('/anatomy-catalog', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const rows = await prisma.anatomyCategory.findMany({
        where: { companyId },
        orderBy: [{ layer: 'asc' }, { view: 'asc' }, { sortOrder: 'asc' }],
        select: {
          layer: true,
          view: true,
          name: true,
          description: true,
          recommendedLayer: true,
        },
      });
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });
}
