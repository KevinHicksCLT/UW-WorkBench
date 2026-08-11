// GET /impact/taxonomy — the reference catalog every lens's change-type picker
// reads. Returns the specialized change vocabularies per subject kind (Change
// Impact v2, Workstream A) so the frontend can offer the right list without
// hard-coding 55 tokens. Static reference data — no tenant scoping, no writes.
import type { Router, Request, Response } from 'express';
import { CHANGE_TYPES_BY_LENS } from './taxonomy.js';

export function registerCatalogRoutes(router: Router): void {
  router.get('/taxonomy', (_req: Request, res: Response) => {
    // Trim internal metadata to what a picker needs: token, label, class.
    const byLens = Object.fromEntries(
      Object.entries(CHANGE_TYPES_BY_LENS).map(([lens, metas]) => [
        lens,
        metas.map((m) => ({ token: m.token, label: m.label, changeClass: m.changeClass })),
      ]),
    );
    res.json({ byLens });
  });
}
