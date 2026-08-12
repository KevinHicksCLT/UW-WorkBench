// FORMS-COMPARE — ad-hoc verbiage comparison for the Workspace's Forms lens.
// Unlike the working-set compare (workingSets.ts), this needs no set
// membership and no prior cluster run: it aligns any two ingested versions on
// the fly (lib/forms/alignClauses) and returns merged diff rows plus the
// summary counts. The primary case is the SAME form across two of its
// versions (?a==?b with av/bv picking the editions); two different forms
// compare the same way. Word-level highlighting inside a divergent pair is
// computed client-side from the paired texts.
import type { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { alignClauses, summarizeAlignment } from '../../lib/forms/alignClauses.js';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function registerCompareRoutes(router: Router): void {
  // GET /forms/compare?a=<formId>&b=<formId>[&av=<versionId>][&bv=<versionId>]
  // — clause-aligned diff. av/bv default to each side's latest version.
  router.get('/compare', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const a = str(req.query.a);
      const b = str(req.query.b);
      if (!a || !b) {
        return res.status(400).json({ error: 'Query params a and b (form ids) are required' });
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
            select: { id: true, versionNo: true, status: true },
          },
        },
      });
      const formA = forms.find((f) => f.id === a);
      const formB = forms.find((f) => f.id === b);
      if (!formA || !formB) return res.status(404).json({ error: 'Not found' });
      // Resolve each side's version: explicit pick must belong to that form;
      // default is the latest ingested version.
      const pickVersion = (form: typeof formA, versionId: string) =>
        versionId ? form.versions.find((v) => v.id === versionId) : form.versions[0];
      const verA = pickVersion(formA, str(req.query.av));
      const verB = pickVersion(formB, str(req.query.bv));
      if ((str(req.query.av) && !verA) || (str(req.query.bv) && !verB)) {
        return res.status(404).json({ error: 'Not found' });
      }
      const missing = !verA ? formA : !verB ? formB : null;
      if (missing || !verA || !verB) {
        return res
          .status(400)
          .json({ error: `Form ${missing?.formNumber} has no ingested version to compare` });
      }
      if (verA.id === verB.id) {
        return res.status(400).json({ error: 'Pick two different versions or forms to compare' });
      }
      const clauses = await prisma.formClause.findMany({
        where: { formVersionId: { in: [verA.id, verB.id] } },
        orderBy: { ordinal: 'asc' },
        select: {
          id: true,
          formVersionId: true,
          ordinal: true,
          heading: true,
          text: true,
          textHash: true,
        },
      });
      const side = (f: typeof formA, v: typeof verA & object, count: number) => ({
        formId: f.id,
        formNumber: f.formNumber,
        title: f.title,
        lob: f.lob,
        states: f.states,
        editionDate: f.editionDate,
        filingStatus: f.filingStatus,
        versionId: v.id,
        versionNo: v.versionNo,
        versionStatus: v.status,
        clauseCount: count,
        versions: f.versions,
      });
      const clausesA = clauses.filter((c) => c.formVersionId === verA.id);
      const clausesB = clauses.filter((c) => c.formVersionId === verB.id);
      const rows = alignClauses(clausesA, clausesB);
      res.json({
        a: side(formA, verA, clausesA.length),
        b: side(formB, verB, clausesB.length),
        rows,
        summary: summarizeAlignment(rows),
      });
    } catch (e) {
      next(e);
    }
  });
}
