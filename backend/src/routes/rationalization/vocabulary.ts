// Reference vocabularies for the board: the WR-06 anatomy catalog (per layer ×
// view, what belongs and what must not be there). Registered BEFORE the /:id
// catch-all in index.ts so the literal paths aren't swallowed.
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { activeCompanyId } from './helpers.js';

export function registerVocabularyRoutes(router: Router) {
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
