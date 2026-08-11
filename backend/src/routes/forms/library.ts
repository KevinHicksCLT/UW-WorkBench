/**
 * Forms library (FORMS-LIB): governed system of record for proprietary policy
 * forms — list/detail, create, text ingest into immutable versions with
 * clause segmentation + field extraction payloads, and six-dimension links.
 * Registered LAST on the router: it owns the GET /:id catch-all.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { meanSegConfidence, segmentClauses } from '../../lib/forms/segmentation.js';
import { clauseTextHash } from '../../lib/forms/similarity.js';
import { normalizeSourceName } from '../../lib/forms/fieldMapping.js';
import { QUARANTINE_THRESHOLD } from '../../lib/forms/trust.js';
import { activeCompanyId, ownForm } from './helpers.js';

const formCreateSchema = z.object({
  formNumber: z.string().min(1),
  title: z.string().min(1),
  lob: z.string().optional(),
  states: z.array(z.string()).optional(),
  editionDate: z.string().optional(),
  filingStatus: z.enum(['Draft', 'Filed', 'Approved', 'Withdrawn']).optional(),
  provenance: z.enum(['client', 'iso-flagged']).optional(),
  ownerRoleId: z.string().optional(),
});

const ingestFieldSchema = z.object({
  sourceName: z.string().min(1),
  label: z.string().optional(),
  page: z.number().int().min(1).optional(),
  widgetType: z.enum(['text', 'checkbox', 'radio', 'choice', 'signature', 'date']).optional(),
  options: z.array(z.object({ label: z.string(), exportValue: z.string() })).optional(),
  selectMode: z.enum(['single', 'multi']).optional(),
  required: z.boolean().optional(),
  formatRule: z.string().optional(),
  instance: z.number().int().min(1).optional(),
});

const ingestSchema = z.object({
  sourceText: z.string().min(1),
  sourceUri: z.string().optional(),
  fields: z.array(ingestFieldSchema).optional(),
});

const linksSchema = z.object({
  applications: z
    .array(
      z.object({
        applicationId: z.string(),
        role_: z.enum(['implementedBy', 'feedsApplication']),
      }),
    )
    .optional(),
  processNodes: z
    .array(
      z.object({
        processNodeId: z.string(),
        role_: z.enum(['servesValueStream', 'impactsTask']),
      }),
    )
    .optional(),
});

export function registerLibraryRoutes(router: Router): void {
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const forms = await prisma.policyForm.findMany({
        where: { tenantId: req.tenantId, companyId },
        select: {
          id: true,
          formNumber: true,
          title: true,
          lob: true,
          states: true,
          editionDate: true,
          filingStatus: true,
          provenance: true,
          ownerRole: { select: { id: true, displayValue: true } },
          versions: {
            select: { id: true, versionNo: true, status: true, segConfidence: true },
            orderBy: { versionNo: 'desc' },
          },
          _count: { select: { dispositions: true, applications: true, processLinks: true } },
        },
        orderBy: { formNumber: 'asc' },
      });
      // Batch clause/field counts over latest versions (no per-row fan-out).
      const latestVersionIds = forms
        .map((f) => f.versions[0]?.id)
        .filter((id): id is string => Boolean(id));
      const [clauseCounts, fieldCounts] = await Promise.all([
        prisma.formClause.groupBy({
          by: ['formVersionId'],
          where: { formVersionId: { in: latestVersionIds } },
          _count: { id: true },
        }),
        prisma.formField.groupBy({
          by: ['formVersionId'],
          where: { formVersionId: { in: latestVersionIds } },
          _count: { id: true },
        }),
      ]);
      const clausesByVersion = new Map(clauseCounts.map((c) => [c.formVersionId, c._count.id]));
      const fieldsByVersion = new Map(fieldCounts.map((c) => [c.formVersionId, c._count.id]));
      res.json(
        forms.map((f) => ({
          ...f,
          latestVersion: f.versions[0] ?? null,
          clauseCount: f.versions[0] ? (clausesByVersion.get(f.versions[0].id) ?? 0) : 0,
          fieldCount: f.versions[0] ? (fieldsByVersion.get(f.versions[0].id) ?? 0) : 0,
        })),
      );
    } catch (e) {
      next(e);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = formCreateSchema.parse(req.body);
      if (data.ownerRoleId) {
        const role = await prisma.role.findFirst({
          where: { id: data.ownerRoleId, company: { tenantId: req.tenantId } },
          select: { id: true },
        });
        if (!role) return res.status(404).json({ error: 'Owner role not found' });
      }
      const form = await prisma.policyForm.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          formNumber: data.formNumber,
          title: data.title,
          lob: data.lob,
          states: data.states ?? undefined,
          editionDate: data.editionDate,
          filingStatus: data.filingStatus ?? 'Draft',
          provenance: data.provenance ?? 'client',
          ownerRoleId: data.ownerRoleId,
        },
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'PolicyForm',
        entityId: form.id,
        action: 'FORM_CREATED',
        diff: { formNumber: data.formNumber },
      });
      res.status(201).json(form);
    } catch (e) {
      next(e);
    }
  });

  // Ingest a new immutable version: segment clauses (rule pass), hash them,
  // register extracted fields. Mean segConfidence < 0.7 quarantines (LLD §2.1).
  router.post('/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const form = await ownForm(req.params.id, req.tenantId);
      if (!form) return res.status(404).json({ error: 'Not found' });
      const data = ingestSchema.parse(req.body);
      const segmented = segmentClauses(data.sourceText);
      const segConfidence = meanSegConfidence(segmented);
      const last = await prisma.policyFormVersion.findFirst({
        where: { formId: form.id },
        orderBy: { versionNo: 'desc' },
        select: { versionNo: true },
      });
      const version = await prisma.policyFormVersion.create({
        data: {
          tenantId: req.tenantId,
          companyId: form.companyId,
          formId: form.id,
          versionNo: (last?.versionNo ?? 0) + 1,
          status: segConfidence < QUARANTINE_THRESHOLD ? 'quarantined' : 'ready',
          sourceUri: data.sourceUri,
          sourceText: data.sourceText,
          segConfidence,
          createdById: req.user.id,
          clauses: {
            create: segmented.map((c) => ({
              tenantId: req.tenantId,
              companyId: form.companyId,
              ordinal: c.ordinal,
              level: c.level,
              heading: c.heading,
              text: c.text,
              charStart: c.charStart,
              charEnd: c.charEnd,
              textHash: clauseTextHash(c.text),
              segConfidence: c.segConfidence,
            })),
          },
          fields: {
            create: (data.fields ?? []).map((f) => ({
              tenantId: req.tenantId,
              companyId: form.companyId,
              sourceName: normalizeSourceName(f.sourceName),
              label: f.label,
              page: f.page ?? 1,
              widgetType: f.widgetType ?? 'text',
              options: f.options ?? undefined,
              selectMode: f.selectMode,
              required: f.required ?? false,
              formatRule: f.formatRule,
              instance: f.instance ?? 1,
            })),
          },
        },
        include: { _count: { select: { clauses: true, fields: true } } },
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'PolicyFormVersion',
        entityId: version.id,
        action: 'FORM_VERSION_INGESTED',
        diff: { formNumber: form.formNumber, versionNo: version.versionNo, status: version.status },
      });
      res.status(201).json(version);
    } catch (e) {
      next(e);
    }
  });

  // Replace-set six-dimension links (FORMS-HLR-016): form → applications,
  // form → process nodes (value streams / tasks). Targets are tenant-checked.
  router.put('/:id/links', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const form = await ownForm(req.params.id, req.tenantId);
      if (!form) return res.status(404).json({ error: 'Not found' });
      const data = linksSchema.parse(req.body);
      const appIds = (data.applications ?? []).map((a) => a.applicationId);
      const nodeIds = (data.processNodes ?? []).map((n) => n.processNodeId);
      const [apps, nodes] = await Promise.all([
        prisma.application.findMany({
          where: { id: { in: appIds }, company: { tenantId: req.tenantId } },
          select: { id: true },
        }),
        prisma.processNode.findMany({
          where: { id: { in: nodeIds }, company: { tenantId: req.tenantId } },
          select: { id: true },
        }),
      ]);
      if (apps.length !== appIds.length || nodes.length !== nodeIds.length) {
        return res.status(404).json({ error: 'Link target not found' });
      }
      await prisma.$transaction([
        ...(data.applications
          ? [
              prisma.formApplication.deleteMany({ where: { formId: form.id } }),
              prisma.formApplication.createMany({
                data: data.applications.map((a) => ({
                  companyId: form.companyId,
                  formId: form.id,
                  applicationId: a.applicationId,
                  role_: a.role_,
                })),
              }),
            ]
          : []),
        ...(data.processNodes
          ? [
              prisma.formProcessNode.deleteMany({ where: { formId: form.id } }),
              prisma.formProcessNode.createMany({
                data: data.processNodes.map((n) => ({
                  companyId: form.companyId,
                  formId: form.id,
                  processNodeId: n.processNodeId,
                  role_: n.role_,
                })),
              }),
            ]
          : []),
      ]);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  // Detail catch-all — keep registered last.
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const form = await prisma.policyForm.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        include: {
          ownerRole: { select: { id: true, displayValue: true } },
          versions: {
            orderBy: { versionNo: 'desc' },
            select: {
              id: true,
              versionNo: true,
              status: true,
              segConfidence: true,
              createdAt: true,
              _count: { select: { clauses: true, fields: true } },
            },
          },
          dispositions: {
            select: { id: true, type: true, status: true, rationale: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
          applications: {
            select: { id: true, role_: true, application: { select: { id: true, name: true } } },
          },
          processLinks: {
            select: {
              id: true,
              role_: true,
              processNode: { select: { id: true, displayValue: true, isTask: true } },
            },
          },
        },
      });
      if (!form) return res.status(404).json({ error: 'Not found' });
      const latest = form.versions[0] ?? null;
      const [clauses, latestVersion] = await Promise.all([
        latest
          ? prisma.formClause.findMany({
              where: { formVersionId: latest.id },
              orderBy: { ordinal: 'asc' },
              select: {
                id: true,
                ordinal: true,
                level: true,
                heading: true,
                text: true,
                segConfidence: true,
              },
            })
          : Promise.resolve([]),
        // The document view renders the canonical text of the latest version.
        latest
          ? prisma.policyFormVersion.findUnique({
              where: { id: latest.id },
              select: { sourceText: true, sourceUri: true },
            })
          : Promise.resolve(null),
      ]);
      res.json({
        ...form,
        latestClauses: clauses,
        latestSourceText: latestVersion?.sourceText ?? null,
        latestSourceUri: latestVersion?.sourceUri ?? null,
      });
    } catch (e) {
      next(e);
    }
  });
}
