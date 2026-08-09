/**
 * Jurisdiction rule sets + constrained optimization (CAP-06, LLR-06.1,
 * ADR-006/INV-05). Constraints are DATA owned by the compliance workstream:
 * a jurisdiction with no rule-set row blocks work (the module never infers
 * state law), restricted rows block until a P6 human acknowledges, and agent
 * actors can never supply the acknowledgment (RATE-T-006).
 */
import type { NextFunction, Request, Response, Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { computeQuote, disruptionBuckets, optimizationGate } from '../../lib/rate-price/engine.js';
import type { RatingSpec } from '../../lib/rate-price/types.js';
import { activeCompanyId, emitGovernanceEvent, specOf } from './helpers.js';

// Uniform base-rate scaling used by the deterministic scenario sweep.
function scaleBaseRates(spec: RatingSpec, scale: number): RatingSpec {
  return {
    ...spec,
    factors: spec.factors.map((f) => (f.kind === 'base_rate' ? { ...f, rate: f.rate * scale } : f)),
  };
}

export function registerJurisdictionRoutes(router: Router): void {
  router.get('/rule-sets', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const ruleSets = await prisma.rpJurisdictionRuleSet.findMany({
        where: { tenantId: req.tenantId, companyId },
        orderBy: [{ code: 'asc' }, { version: 'desc' }],
        include: { jurisdiction: { select: { id: true, name: true, filingPortal: true } } },
      });
      res.json(ruleSets);
    } catch (e) {
      next(e);
    }
  });

  router.get('/optimization-jobs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const jobs = await prisma.rpOptimizationJob.findMany({
        where: { tenantId: req.tenantId, companyId },
        orderBy: { createdAt: 'desc' },
        include: {
          version: { select: { semver: true, model: { select: { ref: true, name: true } } } },
          ruleSet: { select: { code: true, version: true, optimizationRestricted: true } },
        },
      });
      res.json(jobs);
    } catch (e) {
      next(e);
    }
  });

  const createJobSchema = z.object({
    versionId: z.string().min(1),
    objective: z.string().min(1),
    ruleSetId: z.string().min(1),
    targetJurisdictions: z.array(z.string().min(2).max(2)).min(1),
    perRiskCapPct: z.number().positive().max(100).optional(),
  });
  router.post('/optimization-jobs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = createJobSchema.parse(req.body);
      const version = await prisma.rpModelVersion.findFirst({
        where: { id: data.versionId, tenantId: req.tenantId, companyId },
        include: { model: { select: { ref: true } } },
      });
      if (!version) return res.status(404).json({ error: 'Not found' });
      if (version.status !== 'published') {
        return res.status(409).json({
          error: 'Optimization runs against published versions only',
          invariant: 'INV-02',
        });
      }
      const ruleSet = await prisma.rpJurisdictionRuleSet.findFirst({
        where: { id: data.ruleSetId, tenantId: req.tenantId, companyId },
      });
      if (!ruleSet) return res.status(404).json({ error: 'Not found' });
      const allRuleSets = await prisma.rpJurisdictionRuleSet.findMany({
        where: { tenantId: req.tenantId, companyId },
        select: { code: true, optimizationRestricted: true },
      });
      const gate = optimizationGate(allRuleSets, data.targetJurisdictions);
      const job = await prisma.rpOptimizationJob.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          versionId: version.id,
          objective: data.objective,
          constraints: {
            targetJurisdictions: data.targetJurisdictions.map((c) => c.toUpperCase()),
            perRiskCapPct: data.perRiskCapPct ?? 12,
            restrictedCodes: gate.restrictedCodes,
          } as Prisma.InputJsonValue,
          ruleSetId: ruleSet.id,
          status: gate.blocked ? 'BLOCKED' : 'READY',
        },
      });
      res.status(201).json({ ...job, gate });
    } catch (e) {
      next(e);
    }
  });

  // P6 compliance acknowledgment — a HUMAN principal only. The agent plane has
  // no path through this gate (RATE-T-006).
  router.post(
    '/optimization-jobs/:id/acknowledge',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const actorKind = typeof req.body?.actorKind === 'string' ? req.body.actorKind : 'HUMAN';
        if (actorKind !== 'HUMAN') {
          return res.status(403).json({
            error: 'Compliance acknowledgment must come from a human principal (P6)',
            invariant: 'LLR-06.1',
          });
        }
        const job = await prisma.rpOptimizationJob.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId, companyId },
        });
        if (!job) return res.status(404).json({ error: 'Not found' });
        if (job.status !== 'BLOCKED') {
          return res.status(409).json({ error: `Job is ${job.status} — nothing to acknowledge` });
        }
        const updated = await prisma.rpOptimizationJob.update({
          where: { id: job.id },
          data: { status: 'READY', complianceAckBy: req.user.email, complianceAckAt: new Date() },
        });
        await emitGovernanceEvent({
          tenantId: req.tenantId,
          companyId,
          eventType: 'RpOptimizationAcknowledged',
          actorKind: 'HUMAN',
          actorId: req.user.email,
          payload: { jobId: job.id, objective: job.objective },
          correlationId: job.id,
        });
        res.json(updated);
      } catch (e) {
        next(e);
      }
    },
  );

  // Deterministic scenario sweep: uniform base-rate scaling steps evaluated
  // over the supplied portfolio rows, per-risk change capped by the job's
  // constraint. Output is the disruption preview (premium-change buckets).
  const runSchema = z.object({
    rateChangePct: z.number().min(-50).max(50),
    scenarioSteps: z.number().int().min(1).max(9).optional(),
    portfolio: z.array(z.record(z.unknown())).min(1),
  });
  router.post(
    '/optimization-jobs/:id/run',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const data = runSchema.parse(req.body);
        const job = await prisma.rpOptimizationJob.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId, companyId },
          include: { version: { include: { model: { select: { ref: true } } } } },
        });
        if (!job) return res.status(404).json({ error: 'Not found' });
        if (job.status === 'BLOCKED') {
          const constraints = (job.constraints ?? {}) as { restrictedCodes?: string[] };
          return res.status(409).json({
            error:
              'BLOCKED: restricted jurisdictions require Compliance (P6) acknowledgment before run',
            restrictedCodes: constraints.restrictedCodes ?? [],
            invariant: 'LLR-06.1',
          });
        }
        const constraints = (job.constraints ?? {}) as { perRiskCapPct?: number };
        const cap = constraints.perRiskCapPct ?? 12;
        const spec = specOf(job.version.spec);
        const steps = data.scenarioSteps ?? 3;
        const scenarios: { scale: number; buckets: ReturnType<typeof disruptionBuckets> }[] = [];
        for (let s = 1; s <= steps; s++) {
          const pct = (data.rateChangePct * s) / steps;
          const scaled = scaleBaseRates(spec, 1 + pct / 100);
          const deltas = data.portfolio.map((risk) => {
            const before = computeQuote(spec, risk).premium;
            const after = computeQuote(scaled, risk).premium;
            if (before === 0) return 0;
            const raw = ((after - before) / before) * 100;
            return Math.max(-cap, Math.min(cap, Math.round(raw * 100) / 100));
          });
          scenarios.push({ scale: 1 + pct / 100, buckets: disruptionBuckets(deltas) });
        }
        const completed = await prisma.rpOptimizationJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            scenarioCount: steps,
            resultSummary: {
              rateChangePct: data.rateChangePct,
              perRiskCapPct: cap,
              portfolioSize: data.portfolio.length,
              scenarios,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        await emitGovernanceEvent({
          tenantId: req.tenantId,
          companyId,
          eventType: 'RpOptimizationRun',
          actorKind: 'HUMAN',
          actorId: req.user.email,
          payload: {
            jobId: job.id,
            modelRef: job.version.model.ref,
            rateChangePct: data.rateChangePct,
            scenarios: steps,
          },
          correlationId: job.id,
        });
        res.json(completed);
      } catch (e) {
        next(e);
      }
    },
  );
}
