/**
 * Reference execution API (CAP-07, LLR-07.1 — ADR-002 scoped). Quotes,
 * what-ifs, parallel-run deltas, and checkpointed batch tests run against
 * PUBLISHED versions only (INV-02) and every run lands in the Run Store with
 * a governance-spine trace id. Production execution stays in the client's
 * engine of record.
 */
import type { NextFunction, Request, Response, Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { computeQuote, disruptionBuckets, parallelRunDelta } from '../../lib/rate-price/engine.js';
import { activeCompanyId, emitGovernanceEvent, specOf } from './helpers.js';

const riskInputSchema = z.record(z.unknown());

async function loadPublishedVersion(req: Request, companyId: string, versionId: string) {
  return prisma.rpModelVersion.findFirst({
    where: { id: versionId, tenantId: req.tenantId, companyId },
    include: { model: { select: { id: true, ref: true, name: true } } },
  });
}

type RunPersistArgs = {
  req: Request;
  companyId: string;
  versionId: string;
  modelRef: string;
  kind: 'quote' | 'what-if' | 'batch' | 'parallel-run';
  riskInput: Record<string, unknown>;
  output: unknown;
  premium: number;
  latencyMs: number;
  batchId?: string;
};

// Every run is traced: one governance event, then the Run Store row pointing
// at it (traced-by). Replay = re-evaluate the immutable spec over riskInput.
async function persistRun(args: RunPersistArgs) {
  const { req, companyId } = args;
  const event = await emitGovernanceEvent({
    tenantId: req.tenantId,
    companyId,
    eventType: 'RpModelRunExecuted',
    actorKind: 'HUMAN',
    actorId: req.user.email,
    payload: { modelRef: args.modelRef, kind: args.kind, premium: args.premium },
    correlationId: args.versionId,
  });
  return prisma.rpModelRun.create({
    data: {
      tenantId: req.tenantId,
      companyId,
      versionId: args.versionId,
      kind: args.kind,
      riskInput: args.riskInput as Prisma.InputJsonValue,
      output: args.output as Prisma.InputJsonValue,
      premium: args.premium,
      latencyMs: args.latencyMs,
      batchId: args.batchId,
      traceEventId: event.id,
    },
  });
}

export function registerExecutionRoutes(router: Router): void {
  const quoteSchema = z.object({
    versionId: z.string().min(1),
    riskInput: riskInputSchema,
    kind: z.enum(['quote', 'what-if']).optional(),
  });
  router.post('/quote', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = quoteSchema.parse(req.body);
      const version = await loadPublishedVersion(req, companyId, data.versionId);
      if (!version) return res.status(404).json({ error: 'Not found' });
      if (version.status !== 'published') {
        return res.status(409).json({
          error: 'Runs execute against published versions only (never drafts)',
          invariant: 'INV-02',
        });
      }
      const started = Date.now();
      const result = computeQuote(specOf(version.spec), data.riskInput);
      const latencyMs = Date.now() - started;
      const run = await persistRun({
        req,
        companyId,
        versionId: version.id,
        modelRef: version.model.ref,
        kind: data.kind ?? 'quote',
        riskInput: data.riskInput,
        output: result,
        premium: result.premium,
        latencyMs,
      });
      res.status(201).json({ ...result, runId: run.id, traceId: run.traceEventId, latencyMs });
    } catch (e) {
      next(e);
    }
  });

  // Parallel-run: reference quote + paired legacy result → delta + materiality
  // (the rationalization evidence ADR-002 exists for).
  const parallelSchema = z.object({
    versionId: z.string().min(1),
    riskInput: riskInputSchema,
    legacyPremium: z.number().nonnegative(),
  });
  router.post('/parallel-run', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = parallelSchema.parse(req.body);
      const version = await loadPublishedVersion(req, companyId, data.versionId);
      if (!version) return res.status(404).json({ error: 'Not found' });
      if (version.status !== 'published') {
        return res.status(409).json({
          error: 'Runs execute against published versions only (never drafts)',
          invariant: 'INV-02',
        });
      }
      const started = Date.now();
      const quote = computeQuote(specOf(version.spec), data.riskInput);
      const delta = parallelRunDelta(quote.premium, data.legacyPremium);
      const latencyMs = Date.now() - started;
      const output = { ...quote, ...delta, legacyPremium: data.legacyPremium };
      const run = await persistRun({
        req,
        companyId,
        versionId: version.id,
        modelRef: version.model.ref,
        kind: 'parallel-run',
        riskInput: data.riskInput,
        output,
        premium: quote.premium,
        latencyMs,
      });
      res.status(201).json({ ...output, runId: run.id, traceId: run.traceEventId });
    } catch (e) {
      next(e);
    }
  });

  // Batch test (CAP-05, LLR-05.1): enumerated version scope × inline dataset ×
  // tolerance. Runs are checkpointed per version — a partial batch is a
  // first-class CHECKPOINTED state the caller can re-POST to resume.
  const batchSchema = z.object({
    name: z.string().min(1),
    purpose: z.enum(['regression', 'parallel_run', 'challenger']).optional(),
    versionIds: z.array(z.string().min(1)).min(1),
    datasetRef: z.string().min(1),
    dataset: z
      .array(z.object({ riskInput: riskInputSchema, expectedPremium: z.number().optional() }))
      .min(1),
    tolerancePct: z.number().positive().max(100).optional(),
  });
  router.post('/batch-test', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = batchSchema.parse(req.body);
      const versions = await prisma.rpModelVersion.findMany({
        where: { id: { in: data.versionIds }, tenantId: req.tenantId, companyId },
        include: { model: { select: { ref: true } } },
      });
      const missing = data.versionIds.filter((id) => !versions.some((v) => v.id === id));
      const drafts = versions.filter((v) => v.status !== 'published');
      if (missing.length || drafts.length) {
        // Bulk scope is enumerated (SM-05): every offender is listed.
        return res.status(409).json({
          error: 'Batch scope invalid',
          missingVersionIds: missing,
          unpublishedVersionIds: drafts.map((v) => v.id),
          invariant: 'INV-02',
        });
      }
      const tolerancePct = data.tolerancePct ?? 5;
      const batch = await prisma.rpTestBatch.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          name: data.name,
          purpose: data.purpose ?? 'regression',
          versionIds: data.versionIds as Prisma.InputJsonValue,
          datasetRef: data.datasetRef,
          tolerancePct,
        },
      });
      const matrix: {
        versionId: string;
        modelRef: string;
        semver: string;
        pass: number;
        fail: number;
      }[] = [];
      const allDeltas: number[] = [];
      for (const version of versions) {
        let pass = 0;
        let fail = 0;
        for (const row of data.dataset) {
          const quote = computeQuote(specOf(version.spec), row.riskInput);
          if (row.expectedPremium != null && row.expectedPremium !== 0) {
            const deltaPct = ((quote.premium - row.expectedPremium) / row.expectedPremium) * 100;
            allDeltas.push(Math.round(deltaPct * 100) / 100);
            if (Math.abs(deltaPct) <= tolerancePct) pass++;
            else fail++;
          } else {
            pass++;
          }
        }
        // One representative run row per version keeps the Run Store queryable
        // without exploding it at dataset grain.
        const sample = data.dataset[0];
        const sampleQuote = computeQuote(specOf(version.spec), sample.riskInput);
        await persistRun({
          req,
          companyId,
          versionId: version.id,
          modelRef: version.model.ref,
          kind: 'batch',
          riskInput: sample.riskInput,
          output: { pass, fail, datasetRef: data.datasetRef },
          premium: sampleQuote.premium,
          latencyMs: 0,
          batchId: batch.id,
        });
        matrix.push({
          versionId: version.id,
          modelRef: version.model.ref,
          semver: version.semver,
          pass,
          fail,
        });
        // Checkpoint after every version — kill-and-resume completes from here.
        await prisma.rpTestBatch.update({
          where: { id: batch.id },
          data: {
            status: 'CHECKPOINTED',
            checkpoint: {
              completedVersionIds: matrix.map((m) => m.versionId),
            } as Prisma.InputJsonValue,
            passFailMatrix: matrix as unknown as Prisma.InputJsonValue,
          },
        });
      }
      const completed = await prisma.rpTestBatch.update({
        where: { id: batch.id },
        data: {
          status: 'COMPLETED',
          disruptionDeciles: disruptionBuckets(allDeltas) as unknown as Prisma.InputJsonValue,
        },
      });
      res.status(201).json(completed);
    } catch (e) {
      next(e);
    }
  });

  router.get('/batch-test/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const batch = await prisma.rpTestBatch.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId, companyId },
        include: { runs: { select: { id: true, versionId: true, premium: true, output: true } } },
      });
      if (!batch) return res.status(404).json({ error: 'Not found' });
      res.json(batch);
    } catch (e) {
      next(e);
    }
  });

  // Run Store — portfolio-intelligence lens over captured runs.
  router.get('/runs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const versionId = typeof req.query.versionId === 'string' ? req.query.versionId : undefined;
      const runs = await prisma.rpModelRun.findMany({
        where: { tenantId: req.tenantId, companyId, ...(versionId ? { versionId } : {}) },
        orderBy: { executedAt: 'desc' },
        take: 200,
        include: {
          version: {
            select: { semver: true, model: { select: { ref: true, name: true } } },
          },
        },
      });
      res.json(runs);
    } catch (e) {
      next(e);
    }
  });
}
