/**
 * Governance & audit (CAP-10) + cross-estate rationalization (CAP-14).
 * The audit IS the event log: exports stream from the append-only
 * UwGovernanceEvent spine (NFR-04). Proposal dispositions are human-only
 * (ADR-02); divergence actions are CUO-gated with impact-preview ack (INV-6).
 */
import type { NextFunction, Request, Response, Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { activeCompanyId, emitGovernanceEvent, isCuo } from './helpers.js';

/** Registers governance / audit / rationalization routes on the shared /uw router. */
export function registerGovernanceRoutes(router: Router): void {
  // Audit export (NFR-04): keyset-paginated stream from the event spine.
  router.get('/events', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const q = z
        .object({
          from: z.string().datetime().optional(),
          to: z.string().datetime().optional(),
          correlationId: z.string().optional(),
          eventType: z.string().optional(),
          cursor: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(1000).default(200),
        })
        .parse(req.query);
      const events = await prisma.uwGovernanceEvent.findMany({
        where: {
          tenantId: req.tenantId,
          companyId,
          ...(q.from || q.to
            ? {
                at: {
                  ...(q.from ? { gte: new Date(q.from) } : {}),
                  ...(q.to ? { lte: new Date(q.to) } : {}),
                },
              }
            : {}),
          ...(q.correlationId ? { correlationId: q.correlationId } : {}),
          ...(q.eventType ? { eventType: q.eventType } : {}),
        },
        orderBy: { at: 'desc' },
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
        take: q.limit,
      });
      res.json({
        events,
        nextCursor: events.length === q.limit ? events[events.length - 1].id : null,
      });
    } catch (e) {
      next(e);
    }
  });

  // Agent actions inbox (proposal cards awaiting disposition, SM-05).
  router.get('/agent-actions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const disposition =
        typeof req.query.disposition === 'string' ? req.query.disposition : undefined;
      const actions = await prisma.uwAgentAction.findMany({
        where: { tenantId: req.tenantId, companyId, ...(disposition ? { disposition } : {}) },
        include: { submission: { select: { ref: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      res.json(actions);
    } catch (e) {
      next(e);
    }
  });

  // Human disposition of a ProposalEnvelope (ADR-02): accept / modify / reject.
  // Only a human principal may dispose; the envelope never auto-applies.
  const dispositionSchema = z.object({
    action: z.enum(['accept', 'modify', 'reject']),
    patch: z.record(z.unknown()).optional(), // modify carries a patch object
    note: z.string().optional(),
  });
  router.post(
    '/agent-actions/:id/disposition',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = dispositionSchema.parse(req.body);
        if (data.action === 'modify' && !data.patch) {
          return res
            .status(422)
            .json({
              error: 'validation_failed',
              violations: [{ field: 'patch', message: 'modify requires a patch object' }],
            });
        }
        const action = await prisma.uwAgentAction.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId },
        });
        if (!action) return res.status(404).json({ error: 'Not found' });
        if (action.disposition !== 'PENDING')
          return res
            .status(409)
            .json({ error: 'Proposal is already dispositioned', invariant: 'ADR-02' });
        const map = { accept: 'ACCEPTED', modify: 'MODIFIED', reject: 'REJECTED' } as const;
        const updated = await prisma.uwAgentAction.update({
          where: { id: action.id },
          data: {
            disposition: map[data.action],
            dispositionedBy: req.user.email,
            dispositionedAt: new Date(),
            ...(data.patch
              ? {
                  proposal: {
                    ...(action.proposal as Record<string, unknown>),
                    patched: data.patch,
                  } as Prisma.InputJsonValue,
                }
              : {}),
          },
        });
        await emitGovernanceEvent({
          tenantId: req.tenantId,
          companyId: action.companyId,
          eventType: 'DecisionRecorded',
          actorKind: 'HUMAN',
          actorId: req.user.email,
          payload: { dispositionOf: action.id, action: data.action, note: data.note },
          correlationId: action.submissionId ?? action.id,
          submissionId: action.submissionId,
        });
        res.json(updated);
      } catch (e) {
        next(e);
      }
    },
  );

  // Divergence inventory (CAP-14) by kind.
  router.get(
    '/rationalization/divergence',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const kind = typeof req.query.kind === 'string' ? req.query.kind.toUpperCase() : undefined;
        if (kind && !['APPETITE', 'RULE', 'AUTHORITY'].includes(kind)) {
          return res
            .status(422)
            .json({
              error: 'validation_failed',
              violations: [{ field: 'kind', message: 'kind must be appetite|rule|authority' }],
            });
        }
        const pairs = await prisma.uwDivergencePair.findMany({
          where: { tenantId: req.tenantId, companyId, ...(kind ? { kind } : {}) },
          orderBy: { weight: 'asc' },
        });
        res.json(pairs);
      } catch (e) {
        next(e);
      }
    },
  );

  // Impact preview for a pair: affected open submissions, roles, PAS bindings.
  router.get(
    '/rationalization/divergence/:id/impact',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const pair = await prisma.uwDivergencePair.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId },
        });
        if (!pair) return res.status(404).json({ error: 'Not found' });
        const submissionsAffected = await prisma.uwSubmission.count({
          where: {
            companyId: pair.companyId,
            status: { notIn: ['BOUND', 'DECLINED', 'WITHDRAWN'] },
          },
        });
        const rolesAffected =
          pair.kind === 'AUTHORITY'
            ? await prisma.uwAuthorityGrant
                .groupBy({ by: ['roleId'], where: { companyId: pair.companyId, status: 'ACTIVE' } })
                .then((g) => g.length)
            : 0;
        const pasBindingsAffected = await prisma.uwPasBinding.count({
          where: { companyId: pair.companyId, status: 'ACTIVE' },
        });
        const impact = {
          submissionsAffected,
          rolesAffected,
          pasBindingsAffected,
          computedAt: new Date().toISOString(),
        };
        await prisma.uwDivergencePair.update({
          where: { id: pair.id },
          data: { impactPreview: impact },
        });
        res.json(impact);
      } catch (e) {
        next(e);
      }
    },
  );

  // Action a pair (INV-6): merge / retire / keep-both. Gated on acknowledged
  // impact preview AND the CUO role; losing artifact tombstoned, never deleted.
  const actionSchema = z.object({
    action: z.enum(['merge', 'retire', 'keep-both']),
    impactPreviewAck: z.literal(true, {
      errorMap: () => ({
        message: 'impactPreviewAck must be true — acknowledge the impact preview first',
      }),
    }),
    note: z.string().min(10),
  });
  router.post(
    '/rationalization/divergence/:id/action',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = actionSchema.parse(req.body);
        const pair = await prisma.uwDivergencePair.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId },
        });
        if (!pair) return res.status(404).json({ error: 'Not found' });
        if (pair.status !== 'OPEN')
          return res.status(409).json({ error: 'Pair already actioned', invariant: 'INV-6' });
        if (!pair.impactPreview)
          return res
            .status(409)
            .json({
              error: 'Impact preview must be generated before actioning',
              invariant: 'INV-6',
            });
        if (!(await isCuo(req)))
          return res
            .status(403)
            .json({ error: 'Merge/retire/keep-both requires the CUO role', invariant: 'INV-6' });

        const statusMap = { merge: 'MERGED', retire: 'RETIRED', 'keep-both': 'KEEP_BOTH' } as const;
        // Tombstone the losing artifact (right side) on merge/retire — RETIRED, never deleted.
        if (data.action !== 'keep-both' && pair.kind === 'APPETITE') {
          const rightRef = pair.rightRef.split(' ')[0];
          await prisma.uwAppetiteStatement.updateMany({
            where: { companyId: pair.companyId, ref: rightRef, status: 'ACTIVE' },
            data: { status: 'RETIRED' },
          });
        }
        if (data.action !== 'keep-both' && pair.kind === 'AUTHORITY') {
          const rightRef = pair.rightRef.split(' ')[0];
          await prisma.uwAuthorityGrant.updateMany({
            where: { companyId: pair.companyId, ref: rightRef, status: 'ACTIVE' },
            data: { status: 'RETIRED' },
          });
        }
        if (data.action !== 'keep-both' && pair.kind === 'RULE') {
          const rightRef = pair.rightRef.split(' ')[0];
          await prisma.uwGuidelineRule.updateMany({
            where: { companyId: pair.companyId, ref: rightRef, status: 'ACTIVE' },
            data: { status: 'RETIRED' },
          });
        }
        const updated = await prisma.uwDivergencePair.update({
          where: { id: pair.id },
          data: {
            status: statusMap[data.action],
            proposal: pair.proposal,
            actionedBy: req.user.email,
            actionNote: data.note,
            actionedAt: new Date(),
          },
        });
        await emitGovernanceEvent({
          tenantId: req.tenantId,
          companyId: pair.companyId,
          eventType: 'RationalizationActioned',
          actorKind: 'HUMAN',
          actorId: req.user.email,
          payload: { pair: pair.ref, action: data.action, impact: pair.impactPreview },
        });
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'UwDivergencePair',
          entityId: pair.id,
          action: 'UW_RATIONALIZATION_ACTIONED',
          diff: { action: data.action },
        });
        res.json(updated);
      } catch (e) {
        next(e);
      }
    },
  );
}
