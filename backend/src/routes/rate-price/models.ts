/**
 * Model estate registry + immutable versioning (CAP-01/02/08). Models bind to
 * the six-dimension core (owner Role, supporting ValueStream node); versions
 * are content-addressed and frozen on publish (INV-01) — edits create a new
 * version. Publish is a declared review point on the governance spine.
 */
import type { NextFunction, Request, Response, Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { sha256 } from '../../lib/rate-price/engine.js';
import { activeCompanyId, emitGovernanceEvent, MODEL_REF_RE, ratingSpecSchema } from './helpers.js';

const LOBS = ['CP', 'EB', 'GL', 'BOP', 'OM', 'XS', 'WC'] as const;

export function registerModelRoutes(router: Router): void {
  // Estate registry — one query per junction, aggregation in memory (no
  // per-row fan-out).
  router.get('/models', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const models = await prisma.rpRatingModel.findMany({
        where: { tenantId: req.tenantId, companyId },
        orderBy: { ref: 'asc' },
        include: {
          ownerRole: { select: { id: true, displayValue: true } },
          valueStreamNode: { select: { id: true, displayValue: true } },
        },
      });
      const ids = models.map((m) => m.id);
      const versions = await prisma.rpModelVersion.findMany({
        where: { modelId: { in: ids } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, modelId: true, semver: true, status: true, provenance: true },
      });
      const runCounts = await prisma.rpModelRun.groupBy({
        by: ['versionId'],
        where: { companyId, versionId: { in: versions.map((v) => v.id) } },
        _count: { _all: true },
      });
      const runsByVersion = new Map(runCounts.map((r) => [r.versionId, r._count._all]));
      const byModel = new Map<string, typeof versions>();
      for (const v of versions) {
        const list = byModel.get(v.modelId) ?? [];
        list.push(v);
        byModel.set(v.modelId, list);
      }
      res.json(
        models.map((m) => {
          const vs = byModel.get(m.id) ?? [];
          return {
            ...m,
            versions: vs,
            publishedVersions: vs.filter((v) => v.status === 'published').length,
            runCount: vs.reduce((acc, v) => acc + (runsByVersion.get(v.id) ?? 0), 0),
          };
        }),
      );
    } catch (e) {
      next(e);
    }
  });

  router.get('/models/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const model = await prisma.rpRatingModel.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId, companyId },
        include: {
          ownerRole: { select: { id: true, displayValue: true } },
          valueStreamNode: { select: { id: true, displayValue: true } },
          versions: { orderBy: { createdAt: 'desc' } },
          programLinks: { include: { program: true } },
        },
      });
      if (!model) return res.status(404).json({ error: 'Not found' });
      res.json(model);
    } catch (e) {
      next(e);
    }
  });

  const createModelSchema = z.object({
    ref: z.string().regex(MODEL_REF_RE, 'ref must match ^M-[A-Z]{2}-\\d{2}$'),
    name: z.string().min(1),
    lob: z.enum(LOBS),
    jurisdictions: z.string().min(1),
    engineOfRecord: z
      .enum(['earnix', 'hx', 'pas-native', 'spreadsheet', 'legacy', 'tb-reference'])
      .optional(),
    ownerRoleId: z.string().optional(),
    valueStreamNodeId: z.string().optional(),
  });
  router.post('/models', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = createModelSchema.parse(req.body);
      // Ontology refs hard-error when unresolved (LLR-01.2 convention).
      if (data.ownerRoleId) {
        const role = await prisma.role.findFirst({
          where: { id: data.ownerRoleId, companyId },
          select: { id: true },
        });
        if (!role) return res.status(404).json({ error: 'Not found' });
      }
      if (data.valueStreamNodeId) {
        const node = await prisma.processNode.findFirst({
          where: { id: data.valueStreamNodeId, companyId },
          select: { id: true },
        });
        if (!node) return res.status(404).json({ error: 'Not found' });
      }
      const model = await prisma.rpRatingModel.create({
        data: { tenantId: req.tenantId, companyId, ...data },
      });
      await emitGovernanceEvent({
        tenantId: req.tenantId,
        companyId,
        eventType: 'RpModelRegistered',
        actorKind: 'HUMAN',
        actorId: req.user.email,
        payload: { ref: model.ref, lob: model.lob },
        correlationId: model.id,
      });
      res.status(201).json(model);
    } catch (e) {
      next(e);
    }
  });

  // Draft a new version. Spec is validated against the canonical grammar; the
  // bundle hash is computed here so publish freezes exactly what was reviewed.
  const createVersionSchema = z.object({
    semver: z.string().regex(/^\d+\.\d+\.\d+$/, 'semver must be MAJOR.MINOR.PATCH'),
    provenance: z.enum(['human', 'aglm-proposal', 'migration-extract']).optional(),
    spec: ratingSpecSchema,
  });
  router.post('/models/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const model = await prisma.rpRatingModel.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId, companyId },
        select: { id: true, ref: true },
      });
      if (!model) return res.status(404).json({ error: 'Not found' });
      const data = createVersionSchema.parse(req.body);
      const version = await prisma.rpModelVersion.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          modelId: model.id,
          semver: data.semver,
          bundleHash: sha256(data.spec),
          provenance: data.provenance ?? 'human',
          spec: data.spec as Prisma.InputJsonValue,
        },
      });
      res.status(201).json(version);
    } catch (e) {
      next(e);
    }
  });

  // Publish — declared review point. Freezes the bundle (INV-01): a published
  // version rejects re-publish, and there is no update path for its spec.
  router.post('/versions/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const version = await prisma.rpModelVersion.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId, companyId },
        include: { model: { select: { id: true, ref: true, lifecycle: true } } },
      });
      if (!version) return res.status(404).json({ error: 'Not found' });
      if (version.status === 'published') {
        return res.status(409).json({
          error: 'Version already published — published versions are immutable',
          invariant: 'INV-01',
        });
      }
      // AGLM proposals cannot skip review: publish requires an explicit
      // reviewer note acknowledging the provenance (ADR-004 / RATE-T-004).
      if (version.provenance === 'aglm-proposal') {
        const note = typeof req.body?.reviewNote === 'string' ? req.body.reviewNote.trim() : '';
        if (!note) {
          return res.status(409).json({
            error:
              'aglm-proposal versions require an actuarial reviewNote before publish (proposals never bypass review)',
            invariant: 'ADR-004',
          });
        }
      }
      const published = await prisma.rpModelVersion.update({
        where: { id: version.id },
        data: { status: 'published', publishedBy: req.user.email, publishedAt: new Date() },
      });
      await prisma.rpRatingModel.update({
        where: { id: version.model.id },
        data: {
          currentVersionId: published.id,
          lifecycle: version.model.lifecycle === 'draft' ? 'approved' : version.model.lifecycle,
        },
      });
      await emitGovernanceEvent({
        tenantId: req.tenantId,
        companyId,
        eventType: 'RpModelVersionPublished',
        actorKind: 'HUMAN',
        actorId: req.user.email,
        payload: {
          modelRef: version.model.ref,
          semver: published.semver,
          bundleHash: published.bundleHash,
          provenance: published.provenance,
        },
        correlationId: version.model.id,
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'RpModelVersion',
        entityId: published.id,
        action: 'RP_VERSION_PUBLISHED',
        diff: { semver: published.semver, bundleHash: published.bundleHash },
      });
      res.json(published);
    } catch (e) {
      next(e);
    }
  });
}
