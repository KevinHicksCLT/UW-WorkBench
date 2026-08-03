/**
 * Submission intake, pipeline queue, and the risk-workspace projection.
 * Syntax gates are inline zod (422 via the shared error handler); semantic
 * gates return 403/409 with the violated invariant named (UW-WORK-11 §2).
 */
import type { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { evaluateAppetite } from '../../lib/uw/engine.js';
import { activeCompanyId, emitGovernanceEvent, nextRef, recordAgentAction } from './helpers.js';

const LOBS = ['CP', 'EB', 'GL', 'BOP', 'OM', 'XS', 'WC'] as const;
const CONFIDENCE_FLOOR = 0.7; // LLR-01: below this a field is quarantined, never silently used

const extractedFieldSchema = z.object({
  field: z.string().min(1),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  provenance: z.object({
    docId: z.string().min(1),
    page: z.number().int().min(1).optional(),
    bbox: z.array(z.number()).length(4).optional(),
    extractorVersion: z.string().min(1),
  }),
});

const intakeSchema = z.object({
  accountName: z.string().min(2),
  channel: z.enum(['EMAIL', 'PORTAL', 'API', 'FILE']).default('PORTAL'),
  lob: z.enum(LOBS),
  brokerName: z.string().optional(),
  effectiveDate: z.string().datetime().optional(),
  slaHours: z.number().int().positive().max(720).default(24),
  tivTotal: z.number().positive().optional(),
  description: z.string().max(2000).optional(),
  naics: z
    .string()
    .regex(/^\d{4,6}$/)
    .optional(),
  domicile: z.string().max(40).optional(),
  extractedFields: z.array(extractedFieldSchema).default([]),
  riskObjects: z
    .array(
      z.object({
        kind: z.enum(['LOCATION', 'VEHICLE', 'VESSEL', 'ENTITY', 'EQUIPMENT']).default('LOCATION'),
        name: z.string().min(1),
        situs: z.string().optional(),
        tiv: z.number().min(0).optional(),
        exposureData: z.record(z.unknown()).optional(),
      }),
    )
    .default([]),
  coverageRequests: z
    .array(
      z.object({
        lob: z.enum(LOBS),
        limitAmount: z.number().min(0).optional(),
        deductible: z.number().min(0).optional(),
        terms: z.record(z.unknown()).optional(),
      }),
    )
    .default([]),
});

async function appetiteFor(
  companyId: string,
  facts: {
    lob: string;
    naics?: string | null;
    geography?: string | null;
    tivTotal?: number | null;
  },
) {
  const statements = await prisma.uwAppetiteStatement.findMany({
    where: { companyId, status: 'ACTIVE' },
    select: {
      ref: true,
      version: true,
      stance: true,
      lob: true,
      naicsCodes: true,
      geographies: true,
      tivMax: true,
      effectiveFrom: true,
      effectiveTo: true,
    },
  });
  return evaluateAppetite(
    statements.map((s) => ({
      ...s,
      stance: s.stance as 'TARGET' | 'ACCEPTABLE' | 'REFER' | 'DECLINE',
    })),
    { ...facts, asOf: new Date() },
  );
}

/** Registers submission intake/queue/workspace routes on the shared /uw router. */
export function registerSubmissionRoutes(router: Router): void {
  // Intake (HLR-01/02). Normalizes any channel into one path; runs appetite at
  // intake; quarantines low-confidence extracted fields to the exception lane.
  router.post('/submissions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = intakeSchema.parse(req.body);

      const account = await prisma.uwAccount.upsert({
        where: { companyId_name: { companyId, name: data.accountName } },
        update: { domicile: data.domicile ?? undefined },
        create: {
          tenantId: req.tenantId,
          companyId,
          name: data.accountName,
          domicile: data.domicile,
          identifiers: data.naics ? { naics: data.naics } : undefined,
        },
      });

      // Duplicate clearance signal at intake (CAP-02): same account + LOB open.
      const duplicate = await prisma.uwSubmission.findFirst({
        where: {
          companyId,
          accountId: account.id,
          lob: data.lob,
          status: { notIn: ['BOUND', 'DECLINED', 'WITHDRAWN'] },
        },
        select: { ref: true },
      });

      const appetite = await appetiteFor(companyId, {
        lob: data.lob,
        naics: data.naics ?? null,
        geography: data.domicile ?? null,
        tivTotal: data.tivTotal ?? null,
      });

      const ref = await nextRef(companyId, 'submission', 'SUB');
      const submission = await prisma.uwSubmission.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          ref,
          accountId: account.id,
          channel: data.channel,
          lob: data.lob,
          brokerName: data.brokerName,
          status: 'IN_CLEARANCE',
          effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : undefined,
          slaDueAt: new Date(Date.now() + data.slaHours * 3_600_000),
          tivTotal: data.tivTotal,
          description: data.description,
          appetiteVerdict: appetite.verdict === 'NO_STATEMENT' ? null : appetite.verdict,
          appetiteCitations: appetite.citedStatements,
          extractedFields: data.extractedFields,
          riskObjects: {
            create: data.riskObjects.map((r) => ({
              tenantId: req.tenantId,
              companyId,
              kind: r.kind,
              name: r.name,
              situs: r.situs,
              tiv: r.tiv,
              exposureData: r.exposureData as object | undefined,
            })),
          },
          coverageRequests: {
            create: data.coverageRequests.map((c) => ({
              tenantId: req.tenantId,
              companyId,
              lob: c.lob,
              limitAmount: c.limitAmount,
              deductible: c.deductible,
              terms: c.terms as object | undefined,
            })),
          },
          clearanceChecks: {
            create: [
              {
                tenantId: req.tenantId,
                companyId,
                checkType: 'DUPLICATE',
                verdict: duplicate ? 'HIT' : 'CLEAR',
                matchEvidence: duplicate ? { duplicateOf: duplicate.ref } : undefined,
              },
              {
                tenantId: req.tenantId,
                companyId,
                checkType: 'BLOCKED',
                verdict: account.blocked ? 'HIT' : 'CLEAR',
              },
            ],
          },
        },
        include: { riskObjects: true, clearanceChecks: true },
      });

      const correlationId = submission.id;
      await emitGovernanceEvent({
        tenantId: req.tenantId,
        companyId,
        eventType: 'SubmissionCreated',
        actorKind: 'HUMAN',
        actorId: req.user.email,
        payload: { ref, channel: data.channel, lob: data.lob },
        correlationId,
        submissionId: submission.id,
      });
      const gaps = data.extractedFields.filter((f) => f.confidence < CONFIDENCE_FLOOR);
      if (data.extractedFields.length) {
        await emitGovernanceEvent({
          tenantId: req.tenantId,
          companyId,
          eventType: 'ExtractionCompleted',
          actorKind: 'AGENT',
          actorId: 'extractor-01',
          payload: { fields: data.extractedFields.length, quarantined: gaps.length },
          correlationId,
          submissionId: submission.id,
        });
      }
      await emitGovernanceEvent({
        tenantId: req.tenantId,
        companyId,
        eventType: 'AppetiteEvaluated',
        actorKind: 'SYSTEM',
        actorId: 'appetite-engine',
        payload: appetite,
        correlationId,
        submissionId: submission.id,
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'UwSubmission',
        entityId: submission.id,
        action: 'UW_SUBMISSION_CREATED',
        diff: { ref, lob: data.lob },
      });
      res.status(201).json({ ...submission, extractionExceptions: gaps.length, appetite });
    } catch (e) {
      next(e);
    }
  });

  // Pipeline queue (SM-02). Sort pinned to a weightsVersion via latest scores so
  // pagination stays stable during re-scores (NFR-01 keyset convention).
  router.get('/submissions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const sortKey = typeof req.query.sort === 'string' ? req.query.sort : 'triage';
      if (!['triage', 'sla', 'appetite', 'received'].includes(sortKey)) {
        return res
          .status(422)
          .json({
            error: 'validation_failed',
            violations: [
              { field: 'sort', message: 'sort must be one of triage|sla|appetite|received' },
            ],
          });
      }
      const submissions = await prisma.uwSubmission.findMany({
        where: { tenantId: req.tenantId, companyId, ...(status ? { status } : {}) },
        include: {
          account: { select: { name: true } },
          clearanceChecks: { select: { checkType: true, verdict: true } },
          triageScores: { orderBy: { scoredAt: 'desc' }, take: 1 },
          referralCases: { where: { status: 'OPEN' }, select: { id: true } },
        },
        orderBy: sortKey === 'sla' ? { slaDueAt: 'asc' } : { receivedAt: 'desc' },
        take: 500,
      });
      const rows = submissions.map((s) => ({
        ...s,
        accountName: s.account.name,
        triage: s.triageScores[0] ?? null,
        clearance: s.clearanceChecks.some((c) => c.verdict === 'HIT') ? 'HELD' : 'CLEAR',
        openReferrals: s.referralCases.length,
      }));
      if (sortKey === 'triage')
        rows.sort((a, b) => (b.triage?.composite ?? -1) - (a.triage?.composite ?? -1));
      if (sortKey === 'appetite') {
        const rank: Record<string, number> = { IN: 0, EDGE: 1, OUT: 2 };
        rows.sort(
          (a, b) => (rank[a.appetiteVerdict ?? ''] ?? 3) - (rank[b.appetiteVerdict ?? ''] ?? 3),
        );
      }
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });

  // Risk workspace projection (CAP-06, LLR-07) — one submission, everything
  // resolved: evidence, clearance, scores, referrals, decisions, quotes, events.
  router.get('/submissions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const submission = await prisma.uwSubmission.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        include: {
          account: true,
          riskObjects: {
            include: {
              enrichmentRecords: { include: { source: { select: { name: true, kind: true } } } },
            },
          },
          coverageRequests: true,
          clearanceChecks: true,
          triageScores: { orderBy: { scoredAt: 'desc' } },
          referralCases: { include: { escalatedToRole: { select: { displayValue: true } } } },
          decisions: {
            orderBy: { decidedAt: 'desc' },
            include: { authorityGrant: { select: { ref: true, version: true } } },
          },
          quoteProposals: { include: { bindEvent: true } },
          pasBindings: { include: { application: { select: { name: true } } } },
          agentActions: { orderBy: { createdAt: 'desc' } },
          assignedRole: { select: { id: true, displayValue: true } },
          valueStreamNode: { select: { id: true, displayValue: true } },
        },
      });
      if (!submission) return res.status(404).json({ error: 'Not found' });
      const gaps = ((submission.extractedFields as { confidence: number }[] | null) ?? []).filter(
        (f) => f.confidence < CONFIDENCE_FLOOR,
      );
      res.json({ ...submission, extractionExceptions: gaps.length });
    } catch (e) {
      next(e);
    }
  });

  // Bulk decline with reason (Pipeline Triage). Semantic: IN-appetite submissions
  // are skipped — they require individual review (UW-WORK-11 §2.1).
  const bulkDeclineSchema = z.object({
    submissionIds: z.array(z.string().min(1)).min(1),
    reason: z.string().min(10),
  });
  router.post(
    '/submissions/bulk-decline',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const data = bulkDeclineSchema.parse(req.body);
        const targets = await prisma.uwSubmission.findMany({
          where: { id: { in: data.submissionIds }, tenantId: req.tenantId, companyId },
          select: { id: true, ref: true, appetiteVerdict: true, status: true },
        });
        const skipped = targets.filter(
          (t) => t.appetiteVerdict === 'IN' || ['BOUND', 'DECLINED'].includes(t.status),
        );
        const declinable = targets.filter((t) => !skipped.includes(t));
        for (const t of declinable) {
          await prisma.uwSubmission.update({ where: { id: t.id }, data: { status: 'DECLINED' } });
          await emitGovernanceEvent({
            tenantId: req.tenantId,
            companyId,
            eventType: 'DecisionRecorded',
            actorKind: 'HUMAN',
            actorId: req.user.email,
            payload: { outcome: 'DECLINE', reason: data.reason, bulk: true },
            correlationId: t.id,
            submissionId: t.id,
          });
        }
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'UwSubmission',
          entityId: 'bulk',
          action: 'UW_BULK_DECLINE',
          diff: { declined: declinable.length, skipped: skipped.length },
        });
        res.json({
          declined: declinable.map((t) => t.ref),
          skippedInAppetite: skipped.map((t) => t.ref),
        });
      } catch (e) {
        next(e);
      }
    },
  );

  // Agent proposal issuance for a submission (ADR-02): writes a ProposalEnvelope
  // via the assurance wrapper; disposition happens at POST /uw/dispositions.
  const proposalSchema = z.object({
    agentId: z.string().min(1),
    modelRef: z.string().min(1),
    kind: z.enum(['EXTRACTION', 'TRIAGE', 'ENRICHMENT', 'PROPOSAL', 'QNA']).default('PROPOSAL'),
    confidence: z.number().min(0).max(1),
    proposal: z.record(z.unknown()),
  });
  router.post(
    '/submissions/:id/proposals',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = proposalSchema.parse(req.body);
        const submission = await prisma.uwSubmission.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId },
          select: { id: true, companyId: true },
        });
        if (!submission) return res.status(404).json({ error: 'Not found' });
        const action = await recordAgentAction({
          tenantId: req.tenantId,
          companyId: submission.companyId,
          agentId: data.agentId,
          kind: data.kind,
          modelRef: data.modelRef,
          prompt: data.proposal,
          confidence: data.confidence,
          proposal: data.proposal,
          submissionId: submission.id,
          correlationId: submission.id,
        });
        res.status(201).json(action);
      } catch (e) {
        next(e);
      }
    },
  );
}
