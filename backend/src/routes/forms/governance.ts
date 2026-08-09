/**
 * Governance (FORMS-WFLOW / FORMS-DRAFT): finding triage, the disposition
 * lifecycle with its append-only event log, and preferred wordings.
 * Trust invariants enforced here: findings decide one at a time (needs-human
 * is never bulk-cleared), disposition state advances only through events,
 * and ISO-flagged content can never become a preferred wording (ADR-005).
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { ownCluster, ownForm } from './helpers.js';

const findingDecideSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
});

const dispositionCreateSchema = z
  .object({
    subjectKind: z.enum(['form', 'cluster']),
    formId: z.string().optional(),
    clusterId: z.string().optional(),
    type: z.enum(['keep', 'merge', 'retire', 'redraft']),
    targetFormId: z.string().optional(),
    ownerRoleId: z.string().optional(),
    rationale: z.string().optional(),
  })
  .refine((d) => (d.subjectKind === 'form' ? !!d.formId : !!d.clusterId), {
    message: 'Subject id must match subjectKind',
  })
  .refine((d) => d.type !== 'merge' || !!d.targetFormId, {
    message: 'merge requires targetFormId',
  });

const eventSchema = z.object({
  event: z.enum(['approved', 'rejected', 'executed']),
  note: z.string().optional(),
});

// Legal state machine over the append-only log (FORMS-LLR-007).
const TRANSITIONS: Record<string, string[]> = {
  proposed: ['approved', 'rejected'],
  approved: ['executed'],
  rejected: [],
  executed: [],
};

const preferredWordingSchema = z
  .object({
    sourceClauseId: z.string().optional(),
    clauseText: z.string().optional(),
  })
  .refine((d) => !!d.sourceClauseId || !!d.clauseText, {
    message: 'sourceClauseId or clauseText is required',
  });

export function registerGovernanceRoutes(router: Router): void {
  router.get('/findings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workingSetId =
        typeof req.query.workingSetId === 'string' ? req.query.workingSetId : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const findings = await prisma.formFinding.findMany({
        where: { tenantId: req.tenantId, workingSetId, status },
        select: {
          id: true,
          workingSetId: true,
          clusterId: true,
          subjectKind: true,
          claim: true,
          citations: true,
          confidence: true,
          status: true,
          agentSkill: true,
          traceRef: true,
          createdAt: true,
        },
        orderBy: [{ status: 'asc' }, { confidence: 'asc' }],
        take: 500,
      });
      res.json(findings);
    } catch (e) {
      next(e);
    }
  });

  // Single-finding decision — deliberately no bulk variant: needs-human items
  // must be reviewed one by one (FORMS-LLR-012, non-negotiable invariant).
  router.post('/findings/:id/decide', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const finding = await prisma.formFinding.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
      });
      if (!finding) return res.status(404).json({ error: 'Not found' });
      if (finding.status === 'accepted' || finding.status === 'rejected') {
        return res.status(409).json({ error: 'Finding already decided' });
      }
      const { decision } = findingDecideSchema.parse(req.body);
      const updated = await prisma.formFinding.update({
        where: { id: finding.id },
        data: { status: decision, decidedById: req.user.id, decidedAt: new Date() },
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  router.get('/dispositions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dispositions = await prisma.formDisposition.findMany({
        where: { tenantId: req.tenantId },
        include: {
          form: { select: { id: true, formNumber: true, title: true } },
          targetForm: { select: { id: true, formNumber: true, title: true } },
          cluster: { select: { id: true, label: true, workingSetId: true } },
          ownerRole: { select: { id: true, displayValue: true } },
          events: { orderBy: { at: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(dispositions);
    } catch (e) {
      next(e);
    }
  });

  router.post('/dispositions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = dispositionCreateSchema.parse(req.body);
      let companyId: string;
      if (data.subjectKind === 'form') {
        const form = await ownForm(data.formId as string, req.tenantId);
        if (!form) return res.status(404).json({ error: 'Not found' });
        companyId = form.companyId;
      } else {
        const cluster = await ownCluster(data.clusterId as string, req.tenantId);
        if (!cluster) return res.status(404).json({ error: 'Not found' });
        companyId = cluster.companyId;
      }
      if (data.targetFormId) {
        const target = await ownForm(data.targetFormId, req.tenantId);
        if (!target) return res.status(404).json({ error: 'Merge target not found' });
      }
      if (data.ownerRoleId) {
        const role = await prisma.role.findFirst({
          where: { id: data.ownerRoleId, company: { tenantId: req.tenantId } },
          select: { id: true },
        });
        if (!role) return res.status(404).json({ error: 'Owner role not found' });
      }
      const disposition = await prisma.formDisposition.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          subjectKind: data.subjectKind,
          formId: data.subjectKind === 'form' ? data.formId : undefined,
          clusterId: data.subjectKind === 'cluster' ? data.clusterId : undefined,
          type: data.type,
          targetFormId: data.targetFormId,
          ownerRoleId: data.ownerRoleId,
          rationale: data.rationale,
          status: 'proposed',
          events: {
            create: {
              companyId,
              event: 'proposed',
              actorKind: 'user',
              actorId: req.user.id,
              note: data.rationale,
            },
          },
        },
        include: { events: true },
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'FormDisposition',
        entityId: disposition.id,
        action: 'DISPOSITION_PROPOSED',
        diff: { type: data.type, subjectKind: data.subjectKind },
      });
      res.status(201).json(disposition);
    } catch (e) {
      next(e);
    }
  });

  // Advance a disposition by appending an event. The event log is the source
  // of truth; `status` is the derived cache this handler owns (LLR-007).
  router.post(
    '/dispositions/:id/events',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const disposition = await prisma.formDisposition.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId },
        });
        if (!disposition) return res.status(404).json({ error: 'Not found' });
        const data = eventSchema.parse(req.body);
        if (!TRANSITIONS[disposition.status]?.includes(data.event)) {
          return res
            .status(409)
            .json({ error: `Cannot ${data.event} a ${disposition.status} disposition` });
        }
        const [, updated] = await prisma.$transaction([
          prisma.formDispositionEvent.create({
            data: {
              companyId: disposition.companyId,
              dispositionId: disposition.id,
              event: data.event,
              actorKind: 'user',
              actorId: req.user.id,
              note: data.note,
            },
          }),
          prisma.formDisposition.update({
            where: { id: disposition.id },
            data: { status: data.event },
            include: { events: { orderBy: { at: 'asc' } } },
          }),
        ]);
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'FormDisposition',
          entityId: disposition.id,
          action: `DISPOSITION_${data.event.toUpperCase()}`,
          diff: { from: disposition.status, to: data.event },
        });
        res.json(updated);
      } catch (e) {
        next(e);
      }
    },
  );

  // Set the surviving standard clause for a resolved cluster (FORMS-HLR-011).
  // ISO firewall: an iso-flagged source can never ground a standard (ADR-005).
  router.post(
    '/clusters/:id/preferred-wording',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const cluster = await ownCluster(req.params.id, req.tenantId);
        if (!cluster) return res.status(404).json({ error: 'Not found' });
        const data = preferredWordingSchema.parse(req.body);
        let clauseText = data.clauseText ?? '';
        if (data.sourceClauseId) {
          const source = await prisma.formClause.findFirst({
            where: { id: data.sourceClauseId, tenantId: req.tenantId },
            select: {
              text: true,
              formVersion: { select: { form: { select: { provenance: true } } } },
            },
          });
          if (!source) return res.status(404).json({ error: 'Source clause not found' });
          if (source.formVersion.form.provenance === 'iso-flagged') {
            return res.status(422).json({
              error:
                'Source clause is ISO-flagged: licensed content cannot ground a preferred wording (ADR-005)',
            });
          }
          clauseText = source.text;
        }
        const wording = await prisma.preferredWording.upsert({
          where: { clusterId: cluster.id },
          create: {
            tenantId: req.tenantId,
            companyId: cluster.companyId,
            clusterId: cluster.id,
            sourceClauseId: data.sourceClauseId,
            clauseText,
            approvedById: req.user.id,
          },
          update: {
            sourceClauseId: data.sourceClauseId ?? null,
            clauseText,
            approvedById: req.user.id,
            status: 'active',
          },
        });
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'PreferredWording',
          entityId: wording.id,
          action: 'PREFERRED_WORDING_SET',
          diff: { clusterId: cluster.id },
        });
        res.status(201).json(wording);
      } catch (e) {
        next(e);
      }
    },
  );

  router.get('/preferred-wordings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wordings = await prisma.preferredWording.findMany({
        where: { tenantId: req.tenantId },
        include: {
          cluster: { select: { id: true, label: true, workingSetId: true } },
          sourceClause: {
            select: {
              id: true,
              formVersion: {
                select: { form: { select: { id: true, formNumber: true, title: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(wordings);
    } catch (e) {
      next(e);
    }
  });
}
