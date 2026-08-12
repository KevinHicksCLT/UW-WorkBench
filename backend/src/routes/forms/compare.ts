// FORMS-COMPARE — ad-hoc two-form verbiage comparison for the Workspace's
// Form Comparison lens. Unlike the working-set compare (workingSets.ts), this
// needs no set membership and no prior cluster run: it aligns the LATEST
// version of each form on the fly (lib/forms/alignClauses) and returns merged
// diff rows plus the summary counts. The word-level highlighting inside a
// divergent pair is computed client-side from the paired texts.
import type { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { alignClauses, summarizeAlignment } from '../../lib/forms/alignClauses.js';

const CLAUSE_SELECT = {
  id: true,
  ordinal: true,
  heading: true,
  text: true,
  textHash: true,
} as const;

export function registerCompareRoutes(router: Router): void {
  // GET /forms/compare?a=<formId>&b=<formId> — clause-aligned diff of the two
  // forms' latest ingested versions.
  router.get('/compare', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const a = typeof req.query.a === 'string' ? req.query.a : '';
      const b = typeof req.query.b === 'string' ? req.query.b : '';
      if (!a || !b || a === b) {
        return res
          .status(400)
          .json({ error: 'Query params a and b must be two distinct form ids' });
      }
      const forms = await prisma.policyForm.findMany({
        where: { id: { in: [a, b] }, tenantId: req.tenantId },
        select: {
          id: true,
          formNumber: true,
          title: true,
          lob: true,
          states: true,
          editionDate: true,
          filingStatus: true,
          versions: {
            orderBy: { versionNo: 'desc' },
            take: 1,
            select: {
              id: true,
              versionNo: true,
              status: true,
              clauses: { orderBy: { ordinal: 'asc' }, select: CLAUSE_SELECT },
            },
          },
        },
      });
      const formA = forms.find((f) => f.id === a);
      const formB = forms.find((f) => f.id === b);
      if (!formA || !formB) return res.status(404).json({ error: 'Not found' });
      const missing = [formA, formB].find((f) => !f.versions[0]);
      if (missing) {
        return res
          .status(400)
          .json({ error: `Form ${missing.formNumber} has no ingested version to compare` });
      }
      const side = (f: typeof formA) => ({
        formId: f.id,
        formNumber: f.formNumber,
        title: f.title,
        lob: f.lob,
        states: f.states,
        editionDate: f.editionDate,
        filingStatus: f.filingStatus,
        versionId: f.versions[0].id,
        versionNo: f.versions[0].versionNo,
        versionStatus: f.versions[0].status,
        clauseCount: f.versions[0].clauses.length,
      });
      const rows = alignClauses(formA.versions[0].clauses, formB.versions[0].clauses);
      res.json({ a: side(formA), b: side(formB), rows, summary: summarizeAlignment(rows) });
    } catch (e) {
      next(e);
    }
  });
}
