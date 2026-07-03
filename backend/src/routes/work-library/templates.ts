/**
 * Work Library templates — WorkTemplate/WorkTemplateKey CRUD, key reordering,
 * and the subjects listing for the library sidebar. Write authz comes from the
 * router-level requirePermission('work-library') (method-derived CRUD) in
 * work-library/index.ts.
 */
import type { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { ancestorNames } from '../../lib/resolvers/index.js';
import { activeCompanyId, parseType } from './helpers.js';

/** Registers template/key CRUD + subjects routes on the shared router (order preserved). */
export function registerTemplateRoutes(router: Router): void {
  router.get('/templates', async (req, res, next) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const templates = await prisma.workTemplate.findMany({
        where: { companyId },
        orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
        include: {
          keys: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { nodeLinks: true, standardLinks: true, regulationLinks: true } },
        },
      });
      res.json({
        templates: templates.map((t) => ({
          id: t.id,
          kind: t.kind,
          name: t.name,
          description: t.description,
          isDefault: t.isDefault,
          sortOrder: t.sortOrder,
          keys: t.keys.map((k) => ({
            id: k.id,
            key: k.key,
            guidance: k.guidance,
            valueKind: k.valueKind,
            sortOrder: k.sortOrder,
          })),
          usage: {
            tasks: t._count.nodeLinks,
            standards: t._count.standardLinks,
            regulations: t._count.regulationLinks,
          },
        })),
      });
    } catch (e) {
      next(e);
    }
  });

  const templateBody = z.object({
    kind: z.enum(['CHECKLIST', 'TEST']).optional(),
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().nullable().optional(),
  });

  router.post('/templates', async (req, res, next) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const body = templateBody.parse(req.body);
      if (!body.kind || !body.name)
        return res.status(400).json({ error: 'kind and name are required' });
      const max = await prisma.workTemplate.aggregate({
        where: { companyId, kind: body.kind },
        _max: { sortOrder: true },
      });
      const template = await prisma.workTemplate.create({
        data: {
          companyId,
          kind: body.kind,
          name: body.name,
          description: body.description ?? null,
          sortOrder: (max._max.sortOrder ?? 0) + 1,
        },
      });
      res.status(201).json({ template });
    } catch (e) {
      next(e);
    }
  });

  router.patch('/templates/:id', async (req, res, next) => {
    try {
      const body = templateBody.parse(req.body);
      const existing = await prisma.workTemplate.findFirst({
        where: { id: req.params.id, company: { tenantId: req.tenantId } },
      });
      if (!existing) return res.status(404).json({ error: 'Template not found' });
      const template = await prisma.workTemplate.update({
        where: { id: existing.id },
        data: {
          name: body.name ?? undefined,
          description: body.description === undefined ? undefined : body.description,
        },
      });
      res.json({ template });
    } catch (e) {
      next(e);
    }
  });

  router.delete('/templates/:id', async (req, res, next) => {
    try {
      const existing = await prisma.workTemplate.findFirst({
        where: { id: req.params.id, company: { tenantId: req.tenantId } },
      });
      if (!existing) return res.status(404).json({ error: 'Template not found' });
      await prisma.workTemplate.delete({ where: { id: existing.id } });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  const keyBody = z.object({
    key: z.string().trim().min(1).optional(),
    guidance: z.string().trim().nullable().optional(),
    valueKind: z.enum(['TEXT', 'APPLICATION', 'ROLE', 'DELIVERABLE']).optional(),
  });

  router.post('/templates/:id/keys', async (req, res, next) => {
    try {
      const body = keyBody.parse(req.body);
      if (!body.key) return res.status(400).json({ error: 'key is required' });
      const template = await prisma.workTemplate.findFirst({
        where: { id: req.params.id, company: { tenantId: req.tenantId } },
        include: { _count: { select: { keys: true } } },
      });
      if (!template) return res.status(404).json({ error: 'Template not found' });
      const key = await prisma.workTemplateKey.create({
        data: {
          templateId: template.id,
          key: body.key,
          guidance: body.guidance ?? null,
          valueKind: body.valueKind ?? 'TEXT',
          sortOrder: template._count.keys,
        },
      });
      res.status(201).json({ key });
    } catch (e) {
      next(e);
    }
  });

  // Persist a drag-reorder of a template's keys (order = array index).
  router.put('/templates/:id/keys/order', async (req, res, next) => {
    try {
      const { keyIds } = z.object({ keyIds: z.array(z.string()).max(200) }).parse(req.body);
      const template = await prisma.workTemplate.findFirst({
        where: { id: req.params.id, company: { tenantId: req.tenantId } },
        select: { id: true, keys: { select: { id: true } } },
      });
      if (!template) return res.status(404).json({ error: 'Template not found' });
      const valid = new Set(template.keys.map((k) => k.id));
      let i = 0;
      for (const id of keyIds) {
        if (valid.has(id))
          await prisma.workTemplateKey.update({ where: { id }, data: { sortOrder: i++ } });
      }
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  router.patch('/keys/:id', async (req, res, next) => {
    try {
      const body = keyBody.parse(req.body);
      const existing = await prisma.workTemplateKey.findFirst({
        where: { id: req.params.id, template: { company: { tenantId: req.tenantId } } },
      });
      if (!existing) return res.status(404).json({ error: 'Key not found' });
      const key = await prisma.workTemplateKey.update({
        where: { id: existing.id },
        data: {
          key: body.key ?? undefined,
          guidance: body.guidance === undefined ? undefined : body.guidance,
          valueKind: body.valueKind ?? undefined,
        },
      });
      res.json({ key });
    } catch (e) {
      next(e);
    }
  });

  router.delete('/keys/:id', async (req, res, next) => {
    try {
      const existing = await prisma.workTemplateKey.findFirst({
        where: { id: req.params.id, template: { company: { tenantId: req.tenantId } } },
      });
      if (!existing) return res.status(404).json({ error: 'Key not found' });
      await prisma.workTemplateKey.delete({ where: { id: existing.id } });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ── Subject search (left picker) ─────────────────────────────────────────

  router.get('/subjects', async (req, res, next) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const type = parseType(String(req.query.type ?? 'task'), res);
      if (!type) return;
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const take = Math.min(Number(req.query.take) || 50, 200);

      if (type === 'task') {
        // ?missing=test → only tasks with no TEST template assigned yet.
        const noTest = { NOT: { nodeWorkTemplates: { some: { template: { kind: 'TEST' } } } } };
        const missing = req.query.missing === 'test';
        const baseWhere = { companyId, isTask: true as const };
        const [nodes, total, missingTest] = await Promise.all([
          prisma.processNode.findMany({
            where: {
              ...baseWhere,
              ...(missing ? noTest : {}),
              ...(q ? { displayValue: { contains: q, mode: 'insensitive' } } : {}),
            },
            orderBy: { displayValue: 'asc' },
            take,
            select: { id: true, displayValue: true },
          }),
          prisma.processNode.count({ where: baseWhere }),
          prisma.processNode.count({ where: { ...baseWhere, ...noTest } }),
        ]);
        const names = await ancestorNames(nodes.map((n) => n.id));
        return res.json({
          subjects: nodes.map((n) => {
            const a = names.get(n.id);
            return {
              id: n.id,
              name: n.displayValue,
              path: [a?.valueStreamName, a?.l3, a?.l4].filter(Boolean).join(' › '),
            };
          }),
          meta: { total, missingTest },
        });
      }
      if (type === 'standard') {
        const standards = await prisma.standard.findMany({
          where: {
            companyId,
            isArea: false,
            children: { none: {} },
            ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
          },
          orderBy: { name: 'asc' },
          take,
          select: { id: true, name: true, department: true, category: true },
        });
        return res.json({
          subjects: standards.map((s) => ({
            id: s.id,
            name: s.name,
            path: [s.department, s.category].filter(Boolean).join(' › '),
          })),
        });
      }
      const regs = await prisma.regulatoryRequirement.findMany({
        where: {
          companyId,
          status: 'ACTIVE',
          ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: { title: 'asc' },
        take,
        select: { id: true, title: true, regime: true, jurisdiction: { select: { name: true } } },
      });
      res.json({
        subjects: regs.map((r) => ({
          id: r.id,
          name: r.title,
          path: [r.regime, r.jurisdiction?.name].filter(Boolean).join(' › '),
        })),
      });
    } catch (e) {
      next(e);
    }
  });

  // ── Plan read ────────────────────────────────────────────────────────────
}
