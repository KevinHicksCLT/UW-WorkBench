/**
 * Content-pack surface (the crowdsourced commodity): list bundled packs,
 * import any pack JSON into the active company (versioned, never-mutate
 * discipline — INV-3), and export the company's ACTIVE estate as a shareable
 * pack to contribute back to the commons.
 */
import type { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { applyPack, exportPack, packSchema } from '../../lib/packs.js';
import { loadBundledPacks } from '../../lib/packStore.js';
import { activeCompanyId, emitGovernanceEvent } from './helpers.js';

/** Registers content-pack routes on the shared /uw router. */
export function registerPackRoutes(router: Router): void {
router.get('/packs', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const packs = await loadBundledPacks();
    res.json(packs.map((p) => ({ name: p.name, slug: p.slug, version: p.version, description: p.description, author: p.author, license: p.license, lobs: p.lobs, counts: { appetiteStatements: p.appetiteStatements.length, guidelineRules: p.guidelineRules.length, authorityGrantTemplates: p.authorityGrantTemplates.length, enrichmentSources: p.enrichmentSources.length } })));
  } catch (e) { next(e); }
});

// Import: body is either { slug } (a bundled pack) or { pack } (raw pack JSON).
router.post('/packs/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const body = z.union([
      z.object({ slug: z.string().regex(/^[a-z0-9-]+$/) }),
      z.object({ pack: z.record(z.unknown()) }),
    ]).parse(req.body);

    let pack;
    if ('slug' in body) {
      const bundled = await loadBundledPacks();
      pack = bundled.find((p) => p.slug === body.slug);
      if (!pack) return res.status(404).json({ error: `No bundled pack with slug ${body.slug}` });
    } else {
      pack = packSchema.parse(body.pack); // full syntax gate on community JSON
    }

    const result = await applyPack(prisma, { tenantId: req.tenantId, companyId, actor: req.user.email }, pack);
    await emitGovernanceEvent({
      tenantId: req.tenantId,
      companyId,
      eventType: 'RationalizationActioned',
      actorKind: 'HUMAN',
      actorId: req.user.email,
      payload: { packImported: `${pack.slug}@${pack.version}`, result },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Pack', entityId: pack.slug, action: 'UW_PACK_IMPORTED', diff: { ...result } });
    res.status(201).json({ pack: { slug: pack.slug, version: pack.version }, result });
  } catch (e) { next(e); }
});

const exportSchema = z.object({
  name: z.string().min(3).max(80),
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
  description: z.string().min(10).max(500),
  author: z.string().min(1).max(120),
});
router.post('/packs/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const meta = exportSchema.parse(req.body);
    const pack = await exportPack(prisma, companyId, meta);
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Pack', entityId: meta.slug, action: 'UW_PACK_EXPORTED' });
    res.json(pack);
  } catch (e) { next(e); }
});
}
