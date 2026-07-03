/**
 * Regulations writes — requirement create/edit plus the transactional
 * value-stream link replacement (task-grain NodeRegulation materialization)
 * and owner/contributor role set replacement (RoleRegulation).
 * Write authz comes from the router-level requirePermission('regulations')
 * (method-derived create/update/delete) in regulations/index.ts.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit, computeDiff } from '../../services/audit.js';
import { activeCompanyId } from './helpers.js';

/** Registers the requirement mutation routes on the shared regulations router. */
export function registerWriteRoutes(router: Router): void {
  const requirementSchema = z.object({
    jurisdictionId: z.string().min(1),
    category: z.string().min(1),
    title: z.string().min(1),
    requirement: z.string().min(1),
    lineOfBusiness: z.string().optional(),
    citation: z.string().nullable().optional(),
    citationUrl: z.string().nullable().optional(),
    obligationType: z.string().optional(),
    frequency: z.string().nullable().optional(),
    status: z.string().optional(),
    effectiveDate: z.string().nullable().optional(),
    confidence: z.string().optional(),
    regime: z.string().nullable().optional(),
    sourceNote: z.string().nullable().optional(),
  });

  router.post('/requirements', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const body = requirementSchema.parse(req.body);
      const jur = await prisma.jurisdiction.findFirst({
        where: { id: body.jurisdictionId, companyId },
        select: { id: true },
      });
      if (!jur) return res.status(404).json({ error: 'Jurisdiction not found' });
      const row = await prisma.regulatoryRequirement.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          jurisdictionId: jur.id,
          category: body.category,
          title: body.title,
          requirement: body.requirement,
          lineOfBusiness: body.lineOfBusiness ?? 'ALL',
          citation: body.citation ?? null,
          citationUrl: body.citationUrl ?? null,
          obligationType: body.obligationType ?? 'ONGOING',
          frequency: body.frequency ?? null,
          status: body.status ?? 'ACTIVE',
          effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : null,
          confidence: body.confidence ?? 'BASELINE',
          sourceNote: body.sourceNote ?? 'manually created',
        },
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'regulatoryRequirement',
        entityId: row.id,
        action: 'CREATE',
        diff: { title: row.title, jurisdictionId: row.jurisdictionId },
      });
      res.status(201).json(row);
    } catch (e) {
      next(e);
    }
  });

  const EDITABLE = [
    'category',
    'title',
    'requirement',
    'lineOfBusiness',
    'citation',
    'citationUrl',
    'obligationType',
    'frequency',
    'status',
    'effectiveDate',
    'confidence',
    'regime',
    'sourceNote',
  ] as const;

  router.patch('/requirements/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const before = await prisma.regulatoryRequirement.findFirst({
        where: { id: req.params.id, companyId },
      });
      if (!before) return res.status(404).json({ error: 'Not found' });
      const body = requirementSchema.partial().parse(req.body);
      const data: Record<string, unknown> = {};
      for (const f of EDITABLE) {
        if (!(f in body)) continue;
        data[f] =
          f === 'effectiveDate' && body.effectiveDate
            ? new Date(body.effectiveDate)
            : (body as Record<string, unknown>)[f];
      }
      const row = await prisma.regulatoryRequirement.update({ where: { id: before.id }, data });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'regulatoryRequirement',
        entityId: row.id,
        action: 'UPDATE',
        diff: computeDiff(
          before as unknown as Record<string, unknown>,
          row as unknown as Record<string, unknown>,
          [...EDITABLE],
        ),
      });
      res.json(row);
    } catch (e) {
      next(e);
    }
  });

  // Replace a requirement's full value-stream link set.
  const linksSchema = z.object({
    links: z.array(
      z.object({
        valueStreamId: z.string().min(1),
        relationship: z.enum(['GOVERNS', 'REQUIRES_INTEGRATION', 'INFORMS']).default('GOVERNS'),
        notes: z.string().nullable().optional(),
      }),
    ),
  });

  router.put(
    '/requirements/:id/value-streams',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const requirement = await prisma.regulatoryRequirement.findFirst({
          where: { id: req.params.id, companyId },
          select: { id: true, companyId: true },
        });
        if (!requirement) return res.status(404).json({ error: 'Not found' });
        const { links } = linksSchema.parse(req.body);
        // Validate every target value-stream NODE belongs to the company before writing.
        const ids = [...new Set(links.map((l) => l.valueStreamId))];
        const owned = await prisma.processNode.findMany({
          where: { id: { in: ids }, companyId },
          select: { id: true, displayValue: true },
        });
        if (owned.length !== ids.length)
          return res.status(404).json({ error: 'Value stream not found' });
        // Rows live on TASK nodes (single source of truth at the atomic grain):
        // linking a value stream materializes the regulation onto every task under
        // it; unlinking removes the task rows. Higher-level views roll back up.
        await prisma.$transaction(async (tx) => {
          await tx.nodeRegulation.deleteMany({ where: { regId: requirement.id } });
          for (const l of links) {
            await tx.$executeRawUnsafe(
              `INSERT INTO public."NodeRegulation" (id, "companyId", "processNodeId", "regId", relationship, notes, "excluded")
           SELECT gen_random_uuid()::text, $1, c."descendantId", $2, $3, $4, false
           FROM public."ProcessNodeClosure" c
           JOIN public."ProcessNode" t ON t.id = c."descendantId" AND t."isTask"
           WHERE c."ancestorId" = $5
           ON CONFLICT ("processNodeId", "regId") DO NOTHING`,
              requirement.companyId,
              requirement.id,
              l.relationship,
              l.notes ?? null,
              l.valueStreamId,
            );
          }
        });
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'regulatoryRequirement',
          entityId: requirement.id,
          action: 'SET_VALUE_STREAMS',
          diff: {
            links: links.map((l) => ({
              valueStreamId: l.valueStreamId,
              relationship: l.relationship,
            })),
          },
        });
        // Return the rollup shape the frontend consumes (synthetic per-VS link ids).
        const nameById = new Map(owned.map((n) => [n.id, n.displayValue]));
        res.json(
          links.map((l) => ({
            id: `${requirement.id}:${l.valueStreamId}`,
            valueStreamId: l.valueStreamId,
            relationship: l.relationship,
            notes: l.notes ?? null,
            valueStream: { id: l.valueStreamId, name: nameById.get(l.valueStreamId) ?? '—' },
          })),
        );
      } catch (e) {
        next(e);
      }
    },
  );

  // Replace a requirement's owner + contributor role set (RoleRegulation).
  const rolesSchema = z.object({
    ownerRoleId: z.string().min(1).nullable().optional(),
    contributorRoleIds: z.array(z.string().min(1)).default([]),
  });

  router.put('/requirements/:id/roles', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const requirement = await prisma.regulatoryRequirement.findFirst({
        where: { id: req.params.id, companyId },
        select: { id: true },
      });
      if (!requirement) return res.status(404).json({ error: 'Not found' });
      const { ownerRoleId, contributorRoleIds } = rolesSchema.parse(req.body);
      // Owner is never also a contributor.
      const contribIds = [...new Set(contributorRoleIds)].filter((id) => id !== ownerRoleId);
      const roleIds = [...new Set([...(ownerRoleId ? [ownerRoleId] : []), ...contribIds])];
      if (roleIds.length) {
        const owned = await prisma.role.count({ where: { id: { in: roleIds }, companyId } });
        if (owned !== roleIds.length) return res.status(404).json({ error: 'Role not found' });
      }
      const result = await prisma.$transaction(async (tx) => {
        await tx.roleRegulation.deleteMany({ where: { regId: requirement.id } });
        if (ownerRoleId)
          await tx.roleRegulation.create({
            data: { companyId, regId: requirement.id, roleId: ownerRoleId, role_: 'Owner' },
          });
        for (const roleId of contribIds)
          await tx.roleRegulation.create({
            data: { companyId, regId: requirement.id, roleId, role_: 'Contributor' },
          });
        return tx.roleRegulation.findMany({
          where: { regId: requirement.id },
          include: { role: { select: { id: true, displayValue: true } } },
        });
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'regulatoryRequirement',
        entityId: requirement.id,
        action: 'SET_ROLES',
        diff: { ownerRoleId, contributorRoleIds: contribIds },
      });
      res.json({
        owner:
          result
            .filter((r) => r.role_ === 'Owner')
            .map((r) => ({ id: r.role.id, name: r.role.displayValue }))[0] ?? null,
        contributors: result
          .filter((r) => r.role_ === 'Contributor')
          .map((r) => ({ id: r.role.id, name: r.role.displayValue })),
      });
    } catch (e) {
      next(e);
    }
  });
}
