/**
 * Appetite Studio (CAP-03) — appetite as a governed, versioned, effective-dated
 * artifact. Publish creates ref@version+1; in-place mutation is structurally
 * impossible (INV-3). Overlapping statements with a different stance emit a
 * DivergencePair; publish triggers re-evaluation of open submissions.
 */
import type { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { divergenceWeight, evaluateAppetite } from '../../lib/uw/engine.js';
import { activeCompanyId, emitGovernanceEvent, isCuo, nextRef } from './helpers.js';

const LOBS = ['CP', 'EB', 'GL', 'BOP', 'OM', 'XS', 'WC'] as const;

const statementSchema = z
  .object({
    ref: z
      .string()
      .regex(/^AS-\d{3}$/)
      .optional(), // omit to mint a new statement family
    stance: z.enum(['TARGET', 'ACCEPTABLE', 'REFER', 'DECLINE']),
    lob: z.enum(LOBS),
    segment: z.string().max(120).optional(),
    naicsCodes: z
      .string()
      .regex(/^\d{4,6}(,\s*\d{4,6})*$/)
      .optional(),
    geographies: z.string().max(200).optional(),
    tivMax: z.number().positive().optional(),
    capacityLimit: z.number().positive().optional(),
    effectiveFrom: z.string().datetime(),
    effectiveTo: z.string().datetime().optional(),
    rationale: z.string().min(20),
    ownerOrgUnitId: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.effectiveTo && new Date(v.effectiveTo) <= new Date(v.effectiveFrom)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effectiveTo'],
        message: 'effectiveTo must be after effectiveFrom',
      });
    }
    if (v.stance === 'DECLINE' && v.capacityLimit != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['capacityLimit'],
        message: 'capacity limit is meaningless on a DECLINE stance',
      });
    }
  });

/** Registers appetite-studio routes on the shared /uw router. */
export function registerAppetiteRoutes(router: Router): void {
  router.get('/appetite/statements', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const statements = await prisma.uwAppetiteStatement.findMany({
        where: { tenantId: req.tenantId, companyId },
        include: { ownerOrgUnit: { select: { displayValue: true } } },
        orderBy: [{ ref: 'asc' }, { version: 'desc' }],
      });
      res.json(statements);
    } catch (e) {
      next(e);
    }
  });

  // Publish (INV-3): always creates a new version row. Backdated effectiveFrom
  // requires CUO co-approval (semantic gate, UW-WORK-11 §2.3).
  router.post('/appetite/statements', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = statementSchema.parse(req.body);
      if (new Date(data.effectiveFrom).getTime() < Date.now() - 86_400_000 && !(await isCuo(req))) {
        return res
          .status(403)
          .json({ error: 'Backdated effectiveFrom requires CUO co-approval', invariant: 'HLR-04' });
      }
      if (data.ownerOrgUnitId) {
        const org = await prisma.orgUnit.findFirst({
          where: { id: data.ownerOrgUnitId, companyId },
          select: { id: true },
        });
        if (!org)
          return res
            .status(422)
            .json({
              error: 'validation_failed',
              violations: [
                { field: 'ownerOrgUnitId', message: 'org unit not found in this company' },
              ],
            });
      }

      let ref = data.ref;
      let version = 1;
      if (ref) {
        const prior = await prisma.uwAppetiteStatement.findFirst({
          where: { companyId, ref },
          orderBy: { version: 'desc' },
        });
        if (prior) {
          version = prior.version + 1;
          await prisma.uwAppetiteStatement.updateMany({
            where: { companyId, ref, status: 'ACTIVE' },
            data: { status: 'SUPERSEDED' },
          });
        }
      } else {
        const count = await prisma.uwAppetiteStatement.groupBy({
          by: ['ref'],
          where: { companyId },
        });
        ref = `AS-${String(count.length + 101).padStart(3, '0')}`;
      }

      const created = await prisma.uwAppetiteStatement.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          ref,
          version,
          stance: data.stance,
          lob: data.lob,
          segment: data.segment,
          naicsCodes: data.naicsCodes,
          geographies: data.geographies,
          tivMax: data.tivMax,
          capacityLimit: data.capacityLimit,
          effectiveFrom: new Date(data.effectiveFrom),
          effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
          rationale: data.rationale,
          ownerOrgUnitId: data.ownerOrgUnitId,
          publishedBy: req.user.email,
        },
      });

      // Overlap with an active statement of a different stance → DivergencePair.
      const overlaps = await prisma.uwAppetiteStatement.findMany({
        where: {
          companyId,
          status: 'ACTIVE',
          lob: data.lob,
          ref: { not: ref },
          stance: { not: data.stance },
        },
      });
      const pairs = [];
      for (const other of overlaps) {
        const weight = divergenceWeight(
          {
            stance: created.stance,
            naics: created.naicsCodes,
            geo: created.geographies,
            tiv: created.tivMax,
          },
          {
            stance: other.stance,
            naics: other.naicsCodes,
            geo: other.geographies,
            tiv: other.tivMax,
          },
        );
        if (weight < 0.6) {
          const pairRef = await nextRef(companyId, 'divergence', 'DP');
          pairs.push(
            await prisma.uwDivergencePair.create({
              data: {
                tenantId: req.tenantId,
                companyId,
                ref: pairRef,
                kind: 'APPETITE',
                leftRef: `${created.ref} v${created.version}`,
                rightRef: `${other.ref} v${other.version}`,
                weight,
                proposal: weight < 0.2 ? 'MERGE' : 'MERGE_WITH_EXCEPTION',
              },
            }),
          );
          await emitGovernanceEvent({
            tenantId: req.tenantId,
            companyId,
            eventType: 'DivergenceDetected',
            actorKind: 'SYSTEM',
            actorId: 'divergence-engine',
            payload: { pair: pairRef, weight },
          });
        }
      }

      // Publish triggers event-driven re-evaluation of open submissions (LLR-04).
      const open = await prisma.uwSubmission.findMany({
        where: { companyId, status: { notIn: ['BOUND', 'DECLINED', 'WITHDRAWN'] } },
        select: {
          id: true,
          lob: true,
          tivTotal: true,
          account: { select: { identifiers: true, domicile: true } },
        },
      });
      const active = await prisma.uwAppetiteStatement.findMany({
        where: { companyId, status: 'ACTIVE' },
      });
      let reevaluated = 0;
      for (const s of open) {
        const naics = (s.account.identifiers as { naics?: string } | null)?.naics ?? null;
        const verdict = evaluateAppetite(
          active.map((a) => ({
            ref: a.ref,
            version: a.version,
            stance: a.stance as 'TARGET' | 'ACCEPTABLE' | 'REFER' | 'DECLINE',
            lob: a.lob,
            naicsCodes: a.naicsCodes,
            geographies: a.geographies,
            tivMax: a.tivMax,
            effectiveFrom: a.effectiveFrom,
            effectiveTo: a.effectiveTo,
          })),
          {
            lob: s.lob,
            naics,
            geography: s.account.domicile,
            tivTotal: s.tivTotal,
            asOf: new Date(),
          },
        );
        await prisma.uwSubmission.update({
          where: { id: s.id },
          data: {
            appetiteVerdict: verdict.verdict === 'NO_STATEMENT' ? null : verdict.verdict,
            appetiteCitations: verdict.citedStatements,
          },
        });
        reevaluated++;
      }

      await emitGovernanceEvent({
        tenantId: req.tenantId,
        companyId,
        eventType: 'AppetiteEvaluated',
        actorKind: 'HUMAN',
        actorId: req.user.email,
        payload: { published: `${ref} v${version}`, reevaluated },
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'UwAppetiteStatement',
        entityId: created.id,
        action: 'UW_APPETITE_PUBLISHED',
        diff: { ref, version },
      });
      res
        .status(201)
        .json({ statement: created, divergencePairs: pairs, reevaluatedSubmissions: reevaluated });
    } catch (e) {
      next(e);
    }
  });

  // Pure, versioned evaluation endpoint (HLR-05): {verdict, citedStatements[]}.
  router.get('/appetite/evaluate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const q = z
        .object({ submissionId: z.string().min(1) })
        .parse({ submissionId: req.query.submissionId });
      const s = await prisma.uwSubmission.findFirst({
        where: { id: q.submissionId, tenantId: req.tenantId, companyId },
        select: {
          lob: true,
          tivTotal: true,
          account: { select: { identifiers: true, domicile: true } },
        },
      });
      if (!s) return res.status(404).json({ error: 'Not found' });
      const active = await prisma.uwAppetiteStatement.findMany({
        where: { companyId, status: 'ACTIVE' },
      });
      const naics = (s.account.identifiers as { naics?: string } | null)?.naics ?? null;
      const verdict = evaluateAppetite(
        active.map((a) => ({
          ref: a.ref,
          version: a.version,
          stance: a.stance as 'TARGET' | 'ACCEPTABLE' | 'REFER' | 'DECLINE',
          lob: a.lob,
          naicsCodes: a.naicsCodes,
          geographies: a.geographies,
          tivMax: a.tivMax,
          effectiveFrom: a.effectiveFrom,
          effectiveTo: a.effectiveTo,
        })),
        {
          lob: s.lob,
          naics,
          geography: s.account.domicile,
          tivTotal: s.tivTotal,
          asOf: new Date(),
        },
      );
      res.json(verdict);
    } catch (e) {
      next(e);
    }
  });
}
