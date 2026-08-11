// Change-impact decision packets (Change Impact v2, Workstream D). Saving an
// assessment persists an ImpactAssessment row — subject reference, intent,
// report snapshot and per-stage artifacts as opaque jsonb (no denormalized
// graph data). The decision step is maker-checker: moving a RECOMMENDED packet
// to APPROVED requires a DIFFERENT user than the one who created it.
//
// Every query is tenant-scoped by walking to the company; cross-tenant reads
// return 404, not 403.
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { activeCompany } from '../explorer/helpers.js';
import { subjectSchema } from './assess.js';
import { ALL_CHANGE_TYPES } from './types.js';

const ASSESSMENT_STATUSES = [
  'DRAFT',
  'ASSESSED',
  'RECOMMENDED',
  'APPROVED',
  'REJECTED',
  'FURTHER_ANALYSIS',
] as const;
/** Terminal decisions that require a checker distinct from the maker. */
const CHECKER_REQUIRED = new Set<string>(['APPROVED']);

const json = z.unknown();
const asJson = (v: unknown): Prisma.InputJsonValue => (v ?? {}) as Prisma.InputJsonValue;

const createSchema = z.object({
  subject: subjectSchema,
  subjectName: z.string().trim().min(1).max(300),
  changeType: z.enum(ALL_CHANGE_TYPES),
  intent: z.string().trim().max(4000).optional(),
  status: z.enum(ASSESSMENT_STATUSES).optional(),
  recommendation: z.string().trim().max(60).optional(),
  report: json.optional(),
  artifacts: json.optional(),
});

const patchSchema = z.object({
  intent: z.string().trim().max(4000).optional(),
  status: z.enum(ASSESSMENT_STATUSES).optional(),
  recommendation: z.string().trim().max(60).optional(),
  report: json.optional(),
  artifacts: json.optional(),
  decisionNote: z.string().trim().max(2000).optional(),
});

/** Public shape — never leaks internal ids beyond what the client needs. */
function serialize(a: {
  id: string;
  subjectKind: string;
  subjectRef: unknown;
  subjectName: string;
  changeType: string;
  intent: string | null;
  status: string;
  recommendation: string | null;
  report: unknown;
  artifacts: unknown;
  createdBy: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...a,
    decidedAt: a.decidedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export function registerAssessmentRoutes(router: Router): void {
  // Save a decision packet (maker).
  router.post('/assessments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      }
      const company = await activeCompany(req, { id: true });
      if (!company) return res.status(404).json({ error: 'No company' });
      const d = parsed.data;
      const created = await prisma.impactAssessment.create({
        data: {
          tenantId: req.tenantId,
          companyId: company.id,
          subjectKind: d.subject.kind,
          subjectRef: asJson(d.subject),
          subjectName: d.subjectName,
          changeType: d.changeType,
          intent: d.intent ?? null,
          status: d.status ?? 'ASSESSED',
          recommendation: d.recommendation ?? null,
          report: d.report === undefined ? undefined : asJson(d.report),
          artifacts: d.artifacts === undefined ? undefined : asJson(d.artifacts),
          createdBy: req.user.id,
        },
      });
      res.status(201).json(serialize(created));
    } catch (e) {
      next(e);
    }
  });

  // List packets, newest first. Optional filters: subjectKind, subjectId,
  // status. subjectId matches the primary id inside subjectRef.
  router.get('/assessments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req, { id: true });
      if (!company) return res.status(404).json({ error: 'No company' });
      const subjectKind =
        typeof req.query.subjectKind === 'string' ? req.query.subjectKind : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const rows = await prisma.impactAssessment.findMany({
        where: {
          company: { id: company.id, tenantId: req.tenantId },
          ...(subjectKind ? { subjectKind } : {}),
          ...(status ? { status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      // subjectId filter is applied in memory (it lives inside the jsonb ref).
      const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;
      const filtered = subjectId
        ? rows.filter((r) => subjectRefMatches(r.subjectRef, subjectId))
        : rows;
      res.json(filtered.map(serialize));
    } catch (e) {
      next(e);
    }
  });

  // Detail.
  router.get('/assessments/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await prisma.impactAssessment.findFirst({
        where: { id: req.params.id, company: { tenantId: req.tenantId } },
      });
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(serialize(row));
    } catch (e) {
      next(e);
    }
  });

  // Update / decide. A move into APPROVED requires a checker distinct from the
  // maker (createdBy) — the maker-checker control the docs prescribe.
  router.patch('/assessments/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = patchSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      }
      const existing = await prisma.impactAssessment.findFirst({
        where: { id: req.params.id, company: { tenantId: req.tenantId } },
      });
      if (!existing) return res.status(404).json({ error: 'Not found' });

      const d = parsed.data;
      const isDecision =
        d.status !== undefined &&
        d.status !== existing.status &&
        (d.status === 'APPROVED' || d.status === 'REJECTED');
      if (d.status && CHECKER_REQUIRED.has(d.status) && existing.createdBy === req.user.id) {
        return res
          .status(403)
          .json({ error: 'Maker-checker: approval requires a different user than the author.' });
      }

      const updated = await prisma.impactAssessment.update({
        where: { id: existing.id },
        data: {
          ...(d.intent !== undefined ? { intent: d.intent } : {}),
          ...(d.status !== undefined ? { status: d.status } : {}),
          ...(d.recommendation !== undefined ? { recommendation: d.recommendation } : {}),
          ...(d.report !== undefined ? { report: asJson(d.report) } : {}),
          ...(d.artifacts !== undefined ? { artifacts: asJson(d.artifacts) } : {}),
          ...(d.decisionNote !== undefined ? { decisionNote: d.decisionNote } : {}),
          ...(isDecision ? { decidedBy: req.user.id, decidedAt: new Date() } : {}),
        },
      });
      res.json(serialize(updated));
    } catch (e) {
      next(e);
    }
  });
}

/** Does a stored subjectRef reference the given primary id? Covers every
 *  subject kind's id fields without knowing the union at the type level. */
function subjectRefMatches(ref: unknown, id: string): boolean {
  if (!ref || typeof ref !== 'object') return false;
  const r = ref as Record<string, unknown>;
  if (r.roleId === id || r.lobId === id) return true;
  if (r.programId === id || r.workstreamId === id || r.initiativeId === id) return true;
  for (const key of ['nodeIds', 'applicationIds', 'rationalizationAppIds', 'deliverableIds']) {
    const arr = r[key];
    if (Array.isArray(arr) && arr.includes(id)) return true;
  }
  return false;
}
