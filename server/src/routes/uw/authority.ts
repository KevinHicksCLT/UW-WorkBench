/**
 * Authority Matrix + decisions + referrals (CAP-08, CAP-13). Authority is data:
 * grants bind to the TB Roles catalog, never user ids (ADR-03). Every decision
 * is validated by the pure-function validator; a breach auto-opens a
 * ReferralCase (INV-1). Re-issue creates a grant version; prior retained (INV-3).
 */
import type { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { validateAuthority } from '../../lib/uw/engine.js';
import { activeCompanyId, actorRole, emitGovernanceEvent } from './helpers.js';

const LOB_RE = /^(CP|EB|GL|BOP|OM|XS|WC)(,\s*(CP|EB|GL|BOP|OM|XS|WC))*$/;

const grantSchema = z
  .object({
    ref: z
      .string()
      .regex(/^AG-\d{2,3}$/)
      .optional(),
    roleId: z.string().min(1),
    premiumMax: z.number().positive(),
    tivMax: z.number().positive(),
    lineSize: z.number().positive().optional(),
    lobs: z.string().regex(LOB_RE),
    territories: z.string().min(1).max(200),
    delegable: z.boolean().default(false),
    bordereauxAttached: z.boolean().default(false),
    effectiveFrom: z.string().datetime().optional(),
    effectiveTo: z.string().datetime().optional(),
  })
  .superRefine((v, ctx) => {
    // Semantic (CAP-13): delegable grants are blocked until a bordereaux schedule is attached.
    if (v.delegable && !v.bordereauxAttached) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bordereauxAttached'],
        message: 'delegable grants require an attached bordereaux schedule',
      });
    }
  });

/** Registers authority / decision / referral routes on the shared /uw router. */
export function registerAuthorityRoutes(router: Router): void {
  router.get('/authority/grants', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const grants = await prisma.uwAuthorityGrant.findMany({
        where: { tenantId: req.tenantId, companyId },
        include: { role: { select: { id: true, displayValue: true } } },
        orderBy: [{ ref: 'asc' }, { version: 'desc' }],
      });
      res.json(grants);
    } catch (e) {
      next(e);
    }
  });

  // Issue / re-issue (INV-3): re-issue creates version+1, prior retained.
  router.post('/authority/grants', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = grantSchema.parse(req.body);
      // ADR-03: roleRef must resolve in the TB Roles catalog.
      const role = await prisma.role.findFirst({
        where: { id: data.roleId, companyId },
        select: { id: true, displayValue: true },
      });
      if (!role)
        return res
          .status(422)
          .json({
            error: 'validation_failed',
            violations: [
              {
                field: 'roleId',
                message:
                  'role must resolve in the TB Roles catalog (grants bind to roles, never user ids)',
              },
            ],
          });

      let ref = data.ref;
      let version = 1;
      if (ref) {
        const prior = await prisma.uwAuthorityGrant.findFirst({
          where: { companyId, ref },
          orderBy: { version: 'desc' },
        });
        if (prior) {
          version = prior.version + 1;
          await prisma.uwAuthorityGrant.updateMany({
            where: { companyId, ref, status: 'ACTIVE' },
            data: { status: 'SUPERSEDED' },
          });
        }
      } else {
        const count = await prisma.uwAuthorityGrant.groupBy({ by: ['ref'], where: { companyId } });
        ref = `AG-${String(count.length + 10).padStart(2, '0')}`;
      }
      const created = await prisma.uwAuthorityGrant.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          ref,
          version,
          roleId: role.id,
          premiumMax: data.premiumMax,
          tivMax: data.tivMax,
          lineSize: data.lineSize,
          lobs: data.lobs,
          territories: data.territories,
          delegable: data.delegable,
          bordereauxAttached: data.bordereauxAttached,
          effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
          effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
        },
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'UwAuthorityGrant',
        entityId: created.id,
        action: 'UW_GRANT_ISSUED',
        diff: { ref, version, role: role.displayValue },
      });
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  });

  // Record a decision (INV-1). Pure-function authority validation; breach
  // auto-opens a ReferralCase routed up the Roles-catalog escalation chain.
  const decisionSchema = z
    .object({
      submissionId: z.string().min(1),
      outcome: z.enum(['QUOTE', 'DECLINE', 'REFER']),
      premium: z.number().positive().optional(),
      sublimits: z
        .array(z.object({ peril: z.string().min(1), amount: z.number().min(0) }))
        .optional(),
      rationale: z.string().min(10),
      authorityGrantRef: z
        .string()
        .regex(/^AG-\d{2,3}$/)
        .optional(),
      territory: z.string().max(40).optional(),
    })
    .superRefine((v, ctx) => {
      if (v.outcome === 'QUOTE' && (v.premium == null || v.premium <= 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['premium'],
          message: 'QUOTE outcome requires premium > 0',
        });
      }
    });
  router.post('/decisions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = decisionSchema.parse(req.body);
      const submission = await prisma.uwSubmission.findFirst({
        where: { id: data.submissionId, tenantId: req.tenantId, companyId },
        include: { clearanceChecks: true, referralCases: { where: { status: 'OPEN' } } },
      });
      if (!submission) return res.status(404).json({ error: 'Not found' });

      // Syntax gate carried into semantics: sublimits must each be <= TIV.
      const tiv = submission.tivTotal ?? 0;
      const badSub = (data.sublimits ?? []).find((sl) => tiv > 0 && sl.amount > tiv);
      if (badSub)
        return res
          .status(422)
          .json({
            error: 'validation_failed',
            violations: [
              { field: 'sublimits', message: `sublimit ${badSub.peril} exceeds TIV ${tiv}` },
            ],
          });

      // Semantic gates: unreleased watchlist hold blocks decisions; EDGE appetite
      // requires a resolved referral (HLR-12, UW-WORK-11 §2.2).
      if (
        submission.clearanceChecks.some((c) => c.checkType === 'WATCHLIST' && c.verdict === 'HIT')
      ) {
        return res
          .status(409)
          .json({
            error: 'Watchlist hold must be dual-control released before any decision',
            invariant: 'INV-4',
          });
      }
      if (submission.appetiteVerdict === 'EDGE' && data.outcome === 'QUOTE') {
        const resolved = await prisma.uwReferralCase.findFirst({
          where: { submissionId: submission.id, status: 'APPROVED' },
        });
        if (!resolved)
          return res
            .status(409)
            .json({
              error: 'EDGE-appetite submissions require a resolved referral before quoting',
              invariant: 'INV-1',
            });
      }

      // Authority validation (pure function, LLR-10) against the acting grant.
      let grant = null;
      if (data.authorityGrantRef) {
        grant = await prisma.uwAuthorityGrant.findFirst({
          where: { companyId, ref: data.authorityGrantRef, status: 'ACTIVE' },
          include: { role: { select: { displayValue: true, managerRoleId: true } } },
        });
        if (!grant)
          return res
            .status(422)
            .json({
              error: 'validation_failed',
              violations: [
                { field: 'authorityGrantRef', message: 'no ACTIVE grant with that ref' },
              ],
            });
      } else if (req.user.operatingRoleId) {
        grant = await prisma.uwAuthorityGrant.findFirst({
          where: { companyId, roleId: req.user.operatingRoleId, status: 'ACTIVE' },
          include: { role: { select: { displayValue: true, managerRoleId: true } } },
        });
      }
      if (data.outcome !== 'REFER' && !grant) {
        return res
          .status(409)
          .json({
            error:
              'No authority grant resolves for the acting principal — decision requires a grant or an explicit REFER',
            invariant: 'INV-1',
          });
      }

      let authorityResult = 'PASS';
      let authorityDetail: object | undefined;
      if (grant && data.outcome === 'QUOTE') {
        const result = validateAuthority(
          {
            ref: grant.ref,
            version: grant.version,
            premiumMax: grant.premiumMax,
            tivMax: grant.tivMax,
            lineSize: grant.lineSize,
            lobs: grant.lobs,
            territories: grant.territories,
            effectiveFrom: grant.effectiveFrom,
            effectiveTo: grant.effectiveTo,
          },
          {
            premium: data.premium ?? 0,
            tivTotal: tiv,
            lob: submission.lob,
            territory: data.territory,
            asOf: new Date(),
          },
        );
        authorityDetail = result;
        if (!result.pass) authorityResult = 'BREACH_REFERRED';
      }

      const decision = await prisma.uwDecision.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          submissionId: submission.id,
          outcome: authorityResult === 'BREACH_REFERRED' ? 'REFER' : data.outcome,
          premium: data.premium,
          sublimits: data.sublimits,
          rationale: data.rationale,
          authorityGrantId: grant?.id,
          authorityResult,
          authorityDetail,
          dispositionedBy: req.user.email,
        },
      });

      let referral = null;
      if (authorityResult === 'BREACH_REFERRED' || data.outcome === 'REFER') {
        // Escalation chain derives from the Roles catalog: the grant role's
        // manager if present, else any role holding a bigger active grant.
        let escalateTo = grant?.role.managerRoleId ?? null;
        if (!escalateTo) {
          const bigger = await prisma.uwAuthorityGrant.findFirst({
            where: { companyId, status: 'ACTIVE', premiumMax: { gt: grant?.premiumMax ?? 0 } },
            orderBy: { premiumMax: 'asc' },
            select: { roleId: true },
          });
          escalateTo = bigger?.roleId ?? grant?.roleId ?? null;
        }
        if (!escalateTo)
          return res
            .status(409)
            .json({
              error: 'No escalation target resolvable from the Roles catalog',
              invariant: 'INV-1',
            });
        referral = await prisma.uwReferralCase.create({
          data: {
            tenantId: req.tenantId,
            companyId,
            submissionId: submission.id,
            decisionId: decision.id,
            reason:
              authorityResult === 'BREACH_REFERRED'
                ? `Authority breach: ${JSON.stringify((authorityDetail as { checks?: { limit: string; pass: boolean }[] })?.checks?.filter((c) => !c.pass).map((c) => c.limit))}`
                : data.rationale,
            slaDueAt: new Date(Date.now() + 24 * 3_600_000),
            escalatedToRoleId: escalateTo,
          },
        });
        await prisma.uwSubmission.update({
          where: { id: submission.id },
          data: { status: 'REFERRED' },
        });
        await emitGovernanceEvent({
          tenantId: req.tenantId,
          companyId,
          eventType: 'ReferralOpened',
          actorKind: 'SYSTEM',
          actorId: 'authority-engine',
          payload: { reason: referral.reason },
          correlationId: submission.id,
          submissionId: submission.id,
        });
      } else if (data.outcome === 'DECLINE') {
        await prisma.uwSubmission.update({
          where: { id: submission.id },
          data: { status: 'DECLINED' },
        });
      }

      await emitGovernanceEvent({
        tenantId: req.tenantId,
        companyId,
        eventType: 'DecisionRecorded',
        actorKind: 'HUMAN',
        actorId: req.user.email,
        actorRole: actorRole(req),
        payload: { outcome: decision.outcome, premium: data.premium, authorityResult },
        correlationId: submission.id,
        submissionId: submission.id,
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'UwDecision',
        entityId: decision.id,
        action: 'UW_DECISION_RECORDED',
        diff: { outcome: decision.outcome, authorityResult },
      });
      res.status(201).json({ decision, referral, authorityDetail });
    } catch (e) {
      next(e);
    }
  });

  // Referral resolution (LLR-11). Resolver must sit in the escalation chain;
  // SLA clock stops, breach recorded if expired.
  const resolveSchema = z.object({
    resolution: z.enum(['approve', 'decline', 'return']),
    rationale: z.string().min(20),
  });
  router.post('/referrals/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = resolveSchema.parse(req.body);
      const referral = await prisma.uwReferralCase.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        include: {
          escalatedToRole: { select: { id: true, displayValue: true, managerRoleId: true } },
        },
      });
      if (!referral) return res.status(404).json({ error: 'Not found' });
      if (referral.status !== 'OPEN')
        return res.status(409).json({ error: 'Referral is already resolved', invariant: 'LLR-11' });

      // Semantic: resolver role must appear in the escalation chain (the target
      // role or its management line), unless site admin.
      const chain = new Set<string>([referral.escalatedToRoleId]);
      let cursor = referral.escalatedToRole.managerRoleId;
      for (let hops = 0; cursor && hops < 6; hops++) {
        chain.add(cursor);
        const up = await prisma.role.findFirst({
          where: { id: cursor },
          select: { managerRoleId: true },
        });
        cursor = up?.managerRoleId ?? null;
      }
      const resolverRole = req.user.operatingRoleId;
      if (req.user.role !== 'ADMIN' && (!resolverRole || !chain.has(resolverRole))) {
        return res
          .status(403)
          .json({
            error: 'Resolver must appear in the referral escalation chain (Roles catalog)',
            invariant: 'LLR-11',
          });
      }

      const breached = referral.slaDueAt.getTime() < Date.now();
      const statusMap = { approve: 'APPROVED', decline: 'DECLINED', return: 'RETURNED' } as const;
      const resolved = await prisma.uwReferralCase.update({
        where: { id: referral.id },
        data: {
          status: statusMap[data.resolution],
          resolvedBy: req.user.email,
          resolvedByRole: resolverRole ?? req.user.role,
          resolutionNote: data.rationale,
          slaBreached: breached,
          resolvedAt: new Date(),
        },
      });
      if (data.resolution === 'approve') {
        await prisma.uwSubmission.update({
          where: { id: referral.submissionId },
          data: { status: 'IN_REVIEW' },
        });
      } else if (data.resolution === 'decline') {
        await prisma.uwSubmission.update({
          where: { id: referral.submissionId },
          data: { status: 'DECLINED' },
        });
      }
      await emitGovernanceEvent({
        tenantId: req.tenantId,
        companyId: referral.companyId,
        eventType: 'ReferralResolved',
        actorKind: 'HUMAN',
        actorId: req.user.email,
        actorRole: resolverRole ?? req.user.role,
        payload: { resolution: data.resolution, slaBreached: breached },
        correlationId: referral.submissionId,
        submissionId: referral.submissionId,
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'UwReferralCase',
        entityId: referral.id,
        action: 'UW_REFERRAL_RESOLVED',
        diff: { resolution: data.resolution },
      });
      res.json(resolved);
    } catch (e) {
      next(e);
    }
  });

  router.get('/referrals', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const referrals = await prisma.uwReferralCase.findMany({
        where: { tenantId: req.tenantId, companyId },
        include: {
          submission: { select: { ref: true } },
          escalatedToRole: { select: { displayValue: true } },
        },
        orderBy: { openedAt: 'desc' },
      });
      res.json(referrals);
    } catch (e) {
      next(e);
    }
  });
}
