/**
 * Legacy rationalizer (CAP-19 — the TB-native differentiator). Inventory →
 * deterministic extraction (unextractable logic flagged, never approximated,
 * LLR-18.1) → human confirmation → divergence matrix vs a target version
 * (LLR-18.2) → migration waves gated by INV-04: no cutover unless every member
 * rater has a human-confirmed spec and divergence within tolerance.
 */
import type { NextFunction, Request, Response, Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import {
  computeDivergence,
  extractCanonicalSpec,
  waveCutoverEligible,
} from '../../lib/rate-price/engine.js';
import type { LegacyDefinition, RatingSpec } from '../../lib/rate-price/types.js';
import { activeCompanyId, emitGovernanceEvent, nextRpRef, specOf } from './helpers.js';

export function registerRationalizerRoutes(router: Router): void {
  // Estate lens: raters with their latest spec + divergence rollup, and waves.
  router.get('/estate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const raters = await prisma.rpLegacyRater.findMany({
        where: { tenantId: req.tenantId, companyId },
        orderBy: { ref: 'asc' },
        include: {
          specs: {
            orderBy: { specVersion: 'desc' },
            include: {
              divergenceMatrices: {
                orderBy: { createdAt: 'desc' },
                include: {
                  targetVersion: {
                    select: {
                      id: true,
                      semver: true,
                      model: { select: { ref: true, name: true } },
                    },
                  },
                },
              },
            },
          },
          waveMembers: { select: { waveId: true, status: true } },
        },
      });
      const waves = await prisma.rpMigrationWave.findMany({
        where: { tenantId: req.tenantId, companyId },
        orderBy: { sequence: 'asc' },
        include: {
          targetModel: { select: { id: true, ref: true, name: true } },
          members: { include: { legacyRater: { select: { id: true, ref: true, name: true } } } },
        },
      });
      res.json({ raters, waves });
    } catch (e) {
      next(e);
    }
  });

  const createRaterSchema = z.object({
    name: z.string().min(1),
    lob: z.string().min(1),
    artifactType: z.enum(['spreadsheet', 'engine', 'vendor']),
    discoveredVia: z.string().optional(),
    complexityScore: z.number().min(0).max(100).optional(),
    definition: z.record(z.unknown()).optional(),
  });
  router.post('/legacy-raters', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = createRaterSchema.parse(req.body);
      const ref = await nextRpRef(companyId, 'legacyRater', 'LR');
      const rater = await prisma.rpLegacyRater.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          ref,
          name: data.name,
          lob: data.lob,
          artifactType: data.artifactType,
          discoveredVia: data.discoveredVia,
          complexityScore: data.complexityScore,
          definition: data.definition as Prisma.InputJsonValue | undefined,
        },
      });
      res.status(201).json(rater);
    } catch (e) {
      next(e);
    }
  });

  // Deterministic extraction — a new spec version per invocation. Opaque
  // factors/macros land verbatim in `unextracted`; nothing is synthesized.
  router.post(
    '/legacy-raters/:id/extract',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const rater = await prisma.rpLegacyRater.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId, companyId },
        });
        if (!rater) return res.status(404).json({ error: 'Not found' });
        if (!rater.definition) {
          return res.status(409).json({
            error: `${rater.ref} has no inventoried definition to extract — capture the artifact structure first`,
          });
        }
        const result = extractCanonicalSpec(rater.definition as LegacyDefinition);
        const last = await prisma.rpCanonicalSpec.findFirst({
          where: { legacyRaterId: rater.id },
          orderBy: { specVersion: 'desc' },
          select: { specVersion: true },
        });
        const spec = await prisma.rpCanonicalSpec.create({
          data: {
            tenantId: req.tenantId,
            companyId,
            legacyRaterId: rater.id,
            specVersion: (last?.specVersion ?? 0) + 1,
            spec: result.spec as unknown as Prisma.InputJsonValue,
            extractionConfidence: result.extractionConfidence,
          },
        });
        await prisma.rpLegacyRater.update({
          where: { id: rater.id },
          data: { status: 'EXTRACTED' },
        });
        await emitGovernanceEvent({
          tenantId: req.tenantId,
          companyId,
          eventType: 'RpSpecExtracted',
          actorKind: 'HUMAN',
          actorId: req.user.email,
          payload: {
            raterRef: rater.ref,
            specVersion: spec.specVersion,
            extractionConfidence: result.extractionConfidence,
            unextractedCount: result.unextractedCount,
          },
          correlationId: rater.id,
        });
        res.status(201).json(spec);
      } catch (e) {
        next(e);
      }
    },
  );

  // Human confirmation — the INV-04 gate input. Confirmation is a human seat;
  // the agent plane proposes, people confirm.
  router.post('/specs/:id/confirm', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const spec = await prisma.rpCanonicalSpec.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId, companyId },
        include: { legacyRater: { select: { ref: true } } },
      });
      if (!spec) return res.status(404).json({ error: 'Not found' });
      if (spec.humanConfirmed) {
        return res.status(409).json({ error: 'Spec already confirmed' });
      }
      const confirmed = await prisma.rpCanonicalSpec.update({
        where: { id: spec.id },
        data: { humanConfirmed: true, confirmedBy: req.user.email, confirmedAt: new Date() },
      });
      await emitGovernanceEvent({
        tenantId: req.tenantId,
        companyId,
        eventType: 'RpSpecConfirmed',
        actorKind: 'HUMAN',
        actorId: req.user.email,
        payload: { raterRef: spec.legacyRater.ref, specVersion: spec.specVersion },
        correlationId: spec.legacyRaterId,
      });
      res.json(confirmed);
    } catch (e) {
      next(e);
    }
  });

  // Divergence matrix: extracted spec replayed against a target published
  // version — factor-grain classification (LLR-18.2).
  const divergenceSchema = z.object({
    targetVersionId: z.string().min(1),
    portfolioRef: z.string().min(1),
  });
  router.post('/specs/:id/divergence', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = divergenceSchema.parse(req.body);
      const spec = await prisma.rpCanonicalSpec.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId, companyId },
        include: { legacyRater: { select: { id: true, ref: true } } },
      });
      if (!spec) return res.status(404).json({ error: 'Not found' });
      const target = await prisma.rpModelVersion.findFirst({
        where: { id: data.targetVersionId, tenantId: req.tenantId, companyId },
        include: { model: { select: { ref: true } } },
      });
      if (!target) return res.status(404).json({ error: 'Not found' });
      if (target.status !== 'published') {
        return res.status(409).json({
          error: 'Divergence compares against published versions only',
          invariant: 'INV-02',
        });
      }
      const legacySpec = specOf(spec.spec);
      const targetSpec: RatingSpec = specOf(target.spec);
      const summary = computeDivergence(legacySpec.factors, targetSpec.factors);
      const matrix = await prisma.rpDivergenceMatrix.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          specId: spec.id,
          targetVersionId: target.id,
          portfolioRef: data.portfolioRef,
          maxDivergencePct: summary.maxDivergencePct,
          cells: summary.cells as unknown as Prisma.InputJsonValue,
          recommendation: summary.recommendation,
        },
      });
      await emitGovernanceEvent({
        tenantId: req.tenantId,
        companyId,
        eventType: 'RpDivergenceComputed',
        actorKind: 'HUMAN',
        actorId: req.user.email,
        payload: {
          raterRef: spec.legacyRater.ref,
          targetModelRef: target.model.ref,
          maxDivergencePct: summary.maxDivergencePct,
          recommendation: summary.recommendation,
          counts: summary.counts,
        },
        correlationId: spec.legacyRater.id,
      });
      res.status(201).json({ ...matrix, counts: summary.counts });
    } catch (e) {
      next(e);
    }
  });

  const createWaveSchema = z.object({
    name: z.string().min(1),
    sequence: z.number().int().min(1),
    targetModelId: z.string().min(1),
    memberRaterIds: z.array(z.string().min(1)).min(1), // enumerated scope (SM-05)
    tolerancePct: z.number().positive().max(100).optional(),
    cutoverDate: z.string().datetime().optional(),
    rollbackPlan: z.string().optional(),
  });
  router.post('/migration-waves', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = createWaveSchema.parse(req.body);
      const target = await prisma.rpRatingModel.findFirst({
        where: { id: data.targetModelId, tenantId: req.tenantId, companyId },
        select: { id: true },
      });
      if (!target) return res.status(404).json({ error: 'Not found' });
      const raters = await prisma.rpLegacyRater.findMany({
        where: { id: { in: data.memberRaterIds }, tenantId: req.tenantId, companyId },
        select: { id: true },
      });
      const missing = data.memberRaterIds.filter((id) => !raters.some((r) => r.id === id));
      if (missing.length) {
        return res
          .status(409)
          .json({ error: 'Unresolved legacy-rater refs', missingRaterIds: missing });
      }
      const ref = await nextRpRef(companyId, 'wave', 'MW');
      const wave = await prisma.rpMigrationWave.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          ref,
          name: data.name,
          sequence: data.sequence,
          targetModelId: target.id,
          tolerancePct: data.tolerancePct ?? 5,
          cutoverDate: data.cutoverDate ? new Date(data.cutoverDate) : null,
          rollbackPlan: data.rollbackPlan,
          members: {
            create: data.memberRaterIds.map((legacyRaterId) => ({ companyId, legacyRaterId })),
          },
        },
        include: { members: true },
      });
      res.status(201).json(wave);
    } catch (e) {
      next(e);
    }
  });

  // Cutover — the INV-04 gate. Refusal lists every blocking member.
  router.post(
    '/migration-waves/:id/cutover',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const wave = await prisma.rpMigrationWave.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId, companyId },
          include: {
            members: {
              include: {
                legacyRater: {
                  select: {
                    id: true,
                    ref: true,
                    specs: {
                      orderBy: { specVersion: 'desc' },
                      take: 1,
                      include: {
                        divergenceMatrices: {
                          orderBy: { createdAt: 'desc' },
                          take: 1,
                          select: { maxDivergencePct: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });
        if (!wave) return res.status(404).json({ error: 'Not found' });
        if (wave.status === 'CUTOVER') {
          return res.status(409).json({ error: 'Wave already cut over' });
        }
        const facts = wave.members.map((m) => {
          const spec = m.legacyRater.specs[0];
          const matrix = spec?.divergenceMatrices[0];
          return {
            raterRef: m.legacyRater.ref,
            humanConfirmed: spec?.humanConfirmed ?? false,
            maxDivergencePct: matrix ? matrix.maxDivergencePct : null,
          };
        });
        const eligibility = waveCutoverEligible(facts, wave.tolerancePct);
        if (!eligibility.eligible) {
          return res.status(409).json({
            error:
              'Cutover blocked — every member needs a human-confirmed spec and divergence within tolerance',
            blockers: eligibility.blockers,
            invariant: 'INV-04',
          });
        }
        const raterIds = wave.members.map((m) => m.legacyRater.id);
        await prisma.rpWaveMember.updateMany({
          where: { waveId: wave.id },
          data: { status: 'CUTOVER' },
        });
        await prisma.rpLegacyRater.updateMany({
          where: { id: { in: raterIds } },
          data: { status: 'RETIRED' },
        });
        const updated = await prisma.rpMigrationWave.update({
          where: { id: wave.id },
          data: { status: 'CUTOVER', cutoverDate: wave.cutoverDate ?? new Date() },
        });
        await emitGovernanceEvent({
          tenantId: req.tenantId,
          companyId,
          eventType: 'RpWaveCutover',
          actorKind: 'HUMAN',
          actorId: req.user.email,
          payload: { waveRef: wave.ref, raterCount: raterIds.length },
          correlationId: wave.id,
        });
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'RpMigrationWave',
          entityId: wave.id,
          action: 'RP_WAVE_CUTOVER',
          diff: { raterCount: raterIds.length },
        });
        res.json(updated);
      } catch (e) {
        next(e);
      }
    },
  );
}
