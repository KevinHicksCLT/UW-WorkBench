/**
 * Quote assembly and bind execution (CAP-09). Cross-module refs (priced-by →
 * RATE-PRICING modelRef, documented-by → FORMS-RATION formSetRef) must resolve
 * before bind (INV-7); bind requires a human-dispositioned QUOTE decision
 * (INV-2) and is idempotent on correlationId (LLR-12).
 */
import type { NextFunction, Request, Response, Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { activeCompanyId, emitGovernanceEvent } from './helpers.js';

const MODEL_REF_RE = /^M-[A-Z]{2}-\d{2}$/;
const FORM_SET_RE = /^FS-[A-Z-]+-\d{2}$/;

/** Registers quote/bind routes on the shared /uw router. */
export function registerQuoteRoutes(router: Router): void {
  const quoteSchema = z.object({
    submissionId: z.string().min(1),
    decisionId: z.string().min(1),
    premium: z.number().positive(),
    terms: z.record(z.unknown()).optional(),
    modelRef: z
      .string()
      .regex(MODEL_REF_RE, 'modelRef must match ^M-[A-Z]{2}-\\d{2}$ (RATE-PRICING)')
      .optional(),
    formSetRef: z
      .string()
      .regex(FORM_SET_RE, 'formSetRef must match ^FS-[A-Z-]+-\\d{2}$ (FORMS-RATION)')
      .optional(),
  });
  router.post('/quotes', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = quoteSchema.parse(req.body);
      const submission = await prisma.uwSubmission.findFirst({
        where: { id: data.submissionId, tenantId: req.tenantId, companyId },
        select: { id: true, ref: true },
      });
      if (!submission) return res.status(404).json({ error: 'Not found' });
      const decision = await prisma.uwDecision.findFirst({
        where: { id: data.decisionId, submissionId: submission.id, tenantId: req.tenantId },
      });
      if (!decision) return res.status(404).json({ error: 'Not found' });
      if (decision.outcome !== 'QUOTE') {
        return res
          .status(409)
          .json({
            error: `Quote requires a QUOTE-outcome decision (found ${decision.outcome})`,
            invariant: 'INV-2',
          });
      }
      const quote = await prisma.uwQuoteProposal.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          submissionId: submission.id,
          decisionId: decision.id,
          premium: data.premium,
          terms: data.terms as Prisma.InputJsonValue | undefined,
          modelRef: data.modelRef,
          formSetRef: data.formSetRef,
          pricedResolved: Boolean(data.modelRef), // cross-module edge resolution (INV-7)
          documentedResolved: Boolean(data.formSetRef),
          status: 'PROPOSED',
        },
      });
      await prisma.uwSubmission.update({
        where: { id: submission.id },
        data: { status: 'QUOTED' },
      });
      await emitGovernanceEvent({
        tenantId: req.tenantId,
        companyId,
        eventType: 'QuoteProposed',
        actorKind: 'HUMAN',
        actorId: req.user.email,
        payload: { premium: data.premium, modelRef: data.modelRef, formSetRef: data.formSetRef },
        correlationId: submission.id,
        submissionId: submission.id,
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'UwQuoteProposal',
        entityId: quote.id,
        action: 'UW_QUOTE_PROPOSED',
        diff: { premium: data.premium },
      });
      res.status(201).json(quote);
    } catch (e) {
      next(e);
    }
  });

  // Execute bind (INV-2, INV-7, LLR-12).
  const bindSchema = z.object({
    quoteId: z.string().min(1),
    correlationId: z.string().min(8),
    applicationId: z.string().min(1), // must be a registered PAS Application node
  });
  router.post('/bind', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = bindSchema.parse(req.body);

      // Idempotency: replay with the same correlationId returns the existing
      // pasPolicyRef — no double-bind (LLR-12).
      const existing = await prisma.uwBindEvent.findFirst({
        where: { companyId, correlationId: data.correlationId },
      });
      if (existing) return res.status(200).json({ ...existing, replayed: true });

      const quote = await prisma.uwQuoteProposal.findFirst({
        where: { id: data.quoteId, tenantId: req.tenantId, companyId },
        include: { decision: true, submission: { select: { id: true, ref: true } } },
      });
      if (!quote) return res.status(404).json({ error: 'Not found' });

      // INV-2: no bind without a human-dispositioned QUOTE decision (stpPath
      // decisions carry dispositionedBy = "stp:<ruleRef>" and are the exception).
      if (!quote.decision || quote.decision.outcome !== 'QUOTE') {
        return res
          .status(409)
          .json({
            error: 'No BindEvent without a human-dispositioned UWDecision',
            invariant: 'INV-2',
          });
      }
      if (quote.decision.authorityResult !== 'PASS') {
        return res
          .status(409)
          .json({
            error: 'Bind blocked: decision did not pass authority validation',
            invariant: 'INV-1',
          });
      }
      // INV-7: cross-module edges must resolve before bind.
      if (!quote.pricedResolved || !quote.documentedResolved) {
        const missing = [
          !quote.pricedResolved && 'priced-by (RATE-PRICING modelRef)',
          !quote.documentedResolved && 'documented-by (FORMS-RATION formSetRef)',
        ].filter(Boolean);
        return res
          .status(409)
          .json({
            error: `Unresolved cross-module refs block bind: ${missing.join(', ')}`,
            invariant: 'INV-7',
          });
      }
      // Target must be a registered PAS application in this company.
      const application = await prisma.application.findFirst({
        where: { id: data.applicationId, companyId },
        select: { id: true, name: true },
      });
      if (!application)
        return res
          .status(422)
          .json({
            error: 'validation_failed',
            violations: [
              {
                field: 'applicationId',
                message: 'target must be a registered PAS Application node',
              },
            ],
          });

      const pasPolicyRef = `POL-${data.correlationId.slice(0, 8).toUpperCase()}`;
      const bind = await prisma.uwBindEvent.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          quoteId: quote.id,
          correlationId: data.correlationId,
          applicationId: application.id,
          pasPolicyRef,
          executedBy: req.user.email,
        },
      });
      await prisma.uwQuoteProposal.update({ where: { id: quote.id }, data: { status: 'BOUND' } });
      await prisma.uwSubmission.update({
        where: { id: quote.submission.id },
        data: { status: 'BOUND' },
      });
      await prisma.uwPasBinding.upsert({
        where: {
          submissionId_applicationId: {
            submissionId: quote.submission.id,
            applicationId: application.id,
          },
        },
        update: { status: 'ACTIVE' },
        create: {
          tenantId: req.tenantId,
          companyId,
          submissionId: quote.submission.id,
          applicationId: application.id,
          status: 'ACTIVE',
        },
      });
      await emitGovernanceEvent({
        tenantId: req.tenantId,
        companyId,
        eventType: 'BindExecuted',
        actorKind: 'HUMAN',
        actorId: req.user.email,
        payload: { pasPolicyRef, application: application.name },
        correlationId: quote.submission.id,
        submissionId: quote.submission.id,
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'UwBindEvent',
        entityId: bind.id,
        action: 'UW_BIND_EXECUTED',
        diff: { pasPolicyRef, application: application.name },
      });
      res.status(201).json(bind);
    } catch (e) {
      next(e);
    }
  });
}
