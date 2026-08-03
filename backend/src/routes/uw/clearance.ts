/**
 * Clearance & watchlist screening (CAP-02) plus triage scoring (CAP-04) and
 * enrichment orchestration (CAP-05). Watchlist release is dual-control: two
 * governance events from DISTINCT roles (INV-4) — a same-role second signature
 * is rejected with the invariant named.
 */
import type { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { computeTriageScore, sha256 } from '../../lib/uw/engine.js';
import { activeCompanyId, actorRole, emitGovernanceEvent } from './helpers.js';

/** Registers clearance / triage / enrichment routes on the shared /uw router. */
export function registerClearanceRoutes(router: Router): void {
  // Run (or re-run) clearance checks, including sanctions/watchlist screening.
  const clearanceSchema = z.object({
    checks: z.array(z.enum(['DUPLICATE', 'BLOCKED', 'WATCHLIST'])).min(1),
    // Simulated screening evidence from a Bridger/Dow-Jones-class service.
    watchlistEvidence: z
      .object({ matchScore: z.number().min(0).max(1), list: z.string() })
      .optional(),
  });
  router.post(
    '/submissions/:id/clearance',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = clearanceSchema.parse(req.body);
        const submission = await prisma.uwSubmission.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId },
          include: { account: { select: { blocked: true, name: true } } },
        });
        if (!submission) return res.status(404).json({ error: 'Not found' });
        const results = [];
        for (const checkType of data.checks) {
          let verdict = 'CLEAR';
          let matchEvidence: object | undefined;
          if (checkType === 'BLOCKED' && submission.account.blocked) verdict = 'HIT';
          if (
            checkType === 'WATCHLIST' &&
            data.watchlistEvidence &&
            data.watchlistEvidence.matchScore >= 0.85
          ) {
            verdict = 'HIT';
            matchEvidence = data.watchlistEvidence;
          }
          if (checkType === 'DUPLICATE') {
            const dup = await prisma.uwSubmission.findFirst({
              where: {
                companyId: submission.companyId,
                accountId: submission.accountId,
                lob: submission.lob,
                id: { not: submission.id },
                status: { notIn: ['BOUND', 'DECLINED', 'WITHDRAWN'] },
              },
              select: { ref: true },
            });
            if (dup) {
              verdict = 'HIT';
              matchEvidence = { duplicateOf: dup.ref };
            }
          }
          const check = await prisma.uwClearanceCheck.create({
            data: {
              tenantId: req.tenantId,
              companyId: submission.companyId,
              submissionId: submission.id,
              checkType,
              verdict,
              matchEvidence,
            },
          });
          results.push(check);
        }
        const held = results.some((c) => c.verdict === 'HIT');
        if (!held && submission.status === 'IN_CLEARANCE') {
          await prisma.uwSubmission.update({
            where: { id: submission.id },
            data: { status: 'IN_TRIAGE' },
          });
        }
        await emitGovernanceEvent({
          tenantId: req.tenantId,
          companyId: submission.companyId,
          eventType: 'ClearanceCompleted',
          actorKind: 'SYSTEM',
          actorId: 'clearance-service',
          payload: { checks: results.map((r) => ({ type: r.checkType, verdict: r.verdict })) },
          correlationId: submission.id,
          submissionId: submission.id,
        });
        res.status(201).json({ checks: results, held });
      } catch (e) {
        next(e);
      }
    },
  );

  // Dual-control watchlist release (INV-4). Each call adds ONE signature; the
  // check releases only when two signatures from distinct roles exist.
  const releaseSchema = z.object({ note: z.string().min(5) });
  router.post(
    '/clearance/:checkId/release',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        releaseSchema.parse(req.body);
        const check = await prisma.uwClearanceCheck.findFirst({
          where: { id: req.params.checkId, tenantId: req.tenantId },
        });
        if (!check) return res.status(404).json({ error: 'Not found' });
        if (check.checkType !== 'WATCHLIST')
          return res
            .status(409)
            .json({ error: 'Only WATCHLIST checks use dual-control release', invariant: 'INV-4' });
        if (check.verdict !== 'HIT')
          return res.status(409).json({ error: 'Check is not in HIT state', invariant: 'INV-4' });
        const role = actorRole(req);
        const email = req.user.email;
        if (!check.firstReleaseBy) {
          const updated = await prisma.uwClearanceCheck.update({
            where: { id: check.id },
            data: { firstReleaseBy: email, firstReleaseRole: role, firstReleaseAt: new Date() },
          });
          await emitGovernanceEvent({
            tenantId: req.tenantId,
            companyId: check.companyId,
            eventType: 'ClearanceCompleted',
            actorKind: 'HUMAN',
            actorId: email,
            actorRole: role,
            payload: { release: 'first-signature', checkId: check.id },
            correlationId: check.submissionId,
            submissionId: check.submissionId,
          });
          return res.json({ ...updated, releaseState: 'AWAITING_SECOND_SIGNATURE' });
        }
        // Semantic gate: the second signature must come from a DISTINCT role.
        if (check.firstReleaseRole === role) {
          return res
            .status(403)
            .json({
              error: 'Second release signature must come from a distinct role (dual control)',
              invariant: 'INV-4',
            });
        }
        if (check.firstReleaseBy === email) {
          return res
            .status(403)
            .json({
              error: 'Second release signature must come from a different principal (dual control)',
              invariant: 'INV-4',
            });
        }
        const released = await prisma.uwClearanceCheck.update({
          where: { id: check.id },
          data: {
            verdict: 'RELEASED',
            secondReleaseBy: email,
            secondReleaseRole: role,
            secondReleaseAt: new Date(),
          },
        });
        await emitGovernanceEvent({
          tenantId: req.tenantId,
          companyId: check.companyId,
          eventType: 'ClearanceCompleted',
          actorKind: 'HUMAN',
          actorId: email,
          actorRole: role,
          payload: { release: 'second-signature', checkId: check.id },
          correlationId: check.submissionId,
          submissionId: check.submissionId,
        });
        logAudit({
          tenantId: req.tenantId,
          actorEmail: email,
          entityType: 'UwClearanceCheck',
          entityId: check.id,
          action: 'UW_WATCHLIST_RELEASED',
          diff: { dualControl: true },
        });
        res.json({ ...released, releaseState: 'RELEASED' });
      } catch (e) {
        next(e);
      }
    },
  );

  // Triage re-score (CAP-04, LLR-05): appends a versioned TriageScore, never
  // overwrites. Event-driven callers (enrichment change) and manual both land here.
  router.post('/triage/rescore', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const body = z.object({ submissionIds: z.array(z.string()).min(1) }).parse(req.body);
      const submissions = await prisma.uwSubmission.findMany({
        where: { id: { in: body.submissionIds }, tenantId: req.tenantId, companyId },
        include: { riskObjects: { include: { enrichmentRecords: { select: { id: true } } } } },
      });
      if (!submissions.length) return res.status(404).json({ error: 'Not found' });
      const scores = [];
      for (const s of submissions) {
        const gaps = ((s.extractedFields as { confidence: number }[] | null) ?? []).filter(
          (f) => f.confidence < 0.7,
        ).length;
        const enrichmentCount = s.riskObjects.reduce((n, r) => n + r.enrichmentRecords.length, 0);
        const result = computeTriageScore({
          appetiteVerdict: (s.appetiteVerdict as 'IN' | 'EDGE' | 'OUT' | null) ?? 'NO_STATEMENT',
          brokerKnown: Boolean(s.brokerName),
          tivTotal: s.tivTotal,
          extractionGaps: gaps,
          enrichmentCount,
        });
        const score = await prisma.uwTriageScore.create({
          data: {
            tenantId: req.tenantId,
            companyId,
            submissionId: s.id,
            ...result,
            rationale: result.rationale,
          },
        });
        if (s.status === 'IN_TRIAGE')
          await prisma.uwSubmission.update({ where: { id: s.id }, data: { status: 'IN_REVIEW' } });
        await emitGovernanceEvent({
          tenantId: req.tenantId,
          companyId,
          eventType: 'TriageScored',
          actorKind: 'SYSTEM',
          actorId: 'triage-engine',
          payload: { composite: result.composite, weightsVersion: result.weightsVersion },
          correlationId: s.id,
          submissionId: s.id,
        });
        scores.push(score);
      }
      res.status(201).json(scores);
    } catch (e) {
      next(e);
    }
  });

  // Enrichment orchestration (CAP-05, NFR-06): jurisdiction-filtered fan-out
  // across active registered sources; cache respects source TTL (LLR-06).
  router.post(
    '/risk-objects/:id/enrich',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const riskObject = await prisma.uwRiskObject.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId },
          include: {
            submission: { select: { id: true, companyId: true } },
            enrichmentRecords: true,
          },
        });
        if (!riskObject) return res.status(404).json({ error: 'Not found' });
        const companyId = riskObject.submission.companyId;
        const jurisdiction = (riskObject.situs ?? '').split(',').pop()?.trim().toUpperCase() ?? '';
        const sources = await prisma.uwEnrichmentSource.findMany({
          where: { companyId, active: true },
        });
        const now = Date.now();
        const records = [];
        const skipped: { source: string; reason: string }[] = [];
        for (const source of sources) {
          // NFR-06: jurisdiction filter — a source restricted to jurisdictions may
          // only be called where permitted; never inferred, always from the table.
          const allowed = (source.jurisdictions ?? '')
            .split(',')
            .map((t) => t.trim().toUpperCase())
            .filter(Boolean);
          if (allowed.length && jurisdiction && !allowed.includes(jurisdiction)) {
            skipped.push({
              source: source.name,
              reason: `jurisdiction ${jurisdiction} not permitted`,
            });
            continue;
          }
          const cached = riskObject.enrichmentRecords.find(
            (r) => r.sourceId === source.id && r.expiresAt && r.expiresAt.getTime() > now,
          );
          if (cached) {
            skipped.push({ source: source.name, reason: 'cache valid (TTL)' });
            continue;
          }
          const payload = { source: source.kind, fetchedFor: riskObject.name, simulated: true };
          const record = await prisma.uwEnrichmentRecord.create({
            data: {
              tenantId: req.tenantId,
              companyId,
              riskObjectId: riskObject.id,
              sourceId: source.id,
              payload,
              payloadHash: sha256(payload),
              cost:
                source.costClass === 'HIGH'
                  ? 25
                  : source.costClass === 'MEDIUM'
                    ? 5
                    : source.costClass === 'LOW'
                      ? 1
                      : 0,
              expiresAt: new Date(now + source.ttlHours * 3_600_000),
            },
          });
          await emitGovernanceEvent({
            tenantId: req.tenantId,
            companyId,
            eventType: 'EnrichmentRecorded',
            actorKind: 'AGENT',
            actorId: 'enrichment-orchestrator',
            payload: { source: source.name, riskObject: riskObject.name },
            correlationId: riskObject.submission.id,
            submissionId: riskObject.submission.id,
          });
          records.push(record);
        }
        res.status(201).json({ fetched: records, skipped });
      } catch (e) {
        next(e);
      }
    },
  );

  // Enrichment source registry (read + admin upsert).
  router.get('/enrichment-sources', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      res.json(
        await prisma.uwEnrichmentSource.findMany({
          where: { tenantId: req.tenantId, companyId },
          orderBy: { name: 'asc' },
        }),
      );
    } catch (e) {
      next(e);
    }
  });
}
