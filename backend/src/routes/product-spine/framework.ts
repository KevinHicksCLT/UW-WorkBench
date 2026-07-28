// GET /product-spine/framework — the normalized product-model reference
// framework (example-carrier extraction: segments, catalog, the 8-dimension
// meta-model with its atomic data elements, archetypes, matrix, coverage
// library, rating levers, lifecycle events, underwriting entities, atomic task
// map and sources). Static reference content shipped with the app
// (backend/data/product-model-framework.json) — read once at module load,
// served as-is to the Product Model tab's Framework view and the Workspace
// Products grid (dimension definitions in the cell modal).
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Router, Request, Response, NextFunction } from 'express';

const here = dirname(fileURLToPath(import.meta.url));
const FRAMEWORK_PATH = resolve(here, '../../../data/product-model-framework.json');

let cached: unknown | null = null;

export function registerProductFrameworkRoutes(router: Router) {
  router.get('/framework', (_req: Request, res: Response, next: NextFunction) => {
    try {
      cached ??= JSON.parse(readFileSync(FRAMEWORK_PATH, 'utf-8'));
      res.json(cached);
    } catch (e) {
      next(e);
    }
  });
}
