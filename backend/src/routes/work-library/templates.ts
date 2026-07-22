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
          _count: {
            select: {
              nodeLinks: true,
              standardLinks: true,
              regulationLinks: true,
              complianceLinks: true,
            },
          },
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
            compliance: t._count.complianceLinks,
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

  // Filter option lists for the picker — value streams for tasks, area/category
  // for standards, regime/jurisdiction for regulations.
  router.get('/subject-facets', async (req, res, next) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const type = parseType(String(req.query.type ?? 'task'), res);
      if (!type) return;
      const dedupe = (xs: (string | null)[]) =>
        [...new Set(xs.filter((x): x is string => Boolean(x)))].sort();

      if (type === 'task') {
        // Cascading process filters: value streams always; L3 areas when a
        // stream is picked; L4 sub-processes when an area is picked.
        const vs = typeof req.query.vs === 'string' ? req.query.vs : '';
        const l3 = typeof req.query.l3 === 'string' ? req.query.l3 : '';
        const pick = { id: true, displayValue: true } as const;
        const [streams, areas, subs] = await Promise.all([
          prisma.processNode.findMany({
            where: { companyId, processLevelType: { levelNumber: 2 } },
            orderBy: { displayValue: 'asc' },
            select: pick,
          }),
          vs
            ? prisma.processNode.findMany({
                where: { companyId, parentId: vs },
                orderBy: { displayValue: 'asc' },
                select: pick,
              })
            : Promise.resolve([]),
          l3
            ? prisma.processNode.findMany({
                where: { companyId, parentId: l3 },
                orderBy: { displayValue: 'asc' },
                select: pick,
              })
            : Promise.resolve([]),
        ]);
        const opt = (n: { id: string; displayValue: string }) => ({
          id: n.id,
          name: n.displayValue,
        });
        return res.json({
          facets: {
            valueStreams: streams.map(opt),
            l3Areas: areas.map(opt),
            l4Subs: subs.map(opt),
          },
        });
      }
      if (type === 'standard') {
        const rows = await prisma.standard.findMany({
          where: { companyId, isArea: false, children: { none: {} } },
          select: { department: true, category: true },
        });
        return res.json({
          facets: {
            departments: dedupe(rows.map((r) => r.department)),
            categories: dedupe(rows.map((r) => r.category)),
          },
        });
      }
      if (type === 'compliance') {
        // Regulation + jurisdiction filters for the compliance register:
        // jurisdictions come from the L3 source rows linked to any register
        // regulation (an item covers a jurisdiction through its parent).
        const [regs, jurRows] = await Promise.all([
          prisma.complianceRegulation.findMany({
            where: { companyId },
            orderBy: { regCode: 'asc' },
            select: { id: true, regCode: true, name: true },
          }),
          prisma.regulatoryRequirement.findMany({
            where: { companyId, complianceRegulationId: { not: null } },
            select: { jurisdiction: { select: { id: true, name: true } } },
            distinct: ['jurisdictionId'],
          }),
        ]);
        return res.json({
          facets: {
            regulations: regs.map((r) => ({ id: r.id, name: `${r.regCode} · ${r.name}` })),
            jurisdictions: jurRows
              .map((r) => r.jurisdiction)
              .sort((a, b) => a.name.localeCompare(b.name)),
          },
        });
      }
      const rows = await prisma.regulatoryRequirement.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: { regime: true, jurisdiction: { select: { id: true, name: true } } },
      });
      const jurisdictions = [
        ...new Map(rows.map((r) => [r.jurisdiction.id, r.jurisdiction])).values(),
      ].sort((a, b) => a.name.localeCompare(b.name));
      res.json({
        facets: { regimes: dedupe(rows.map((r) => r.regime)), jurisdictions },
      });
    } catch (e) {
      next(e);
    }
  });

  router.get('/subjects', async (req, res, next) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const type = parseType(String(req.query.type ?? 'task'), res);
      if (!type) return;
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const take = Math.min(Number(req.query.take) || 50, 200);
      const str = (k: string) => (typeof req.query[k] === 'string' ? String(req.query[k]) : '');

      if (type === 'task') {
        // ?missing=test → only tasks with no TEST template assigned yet.
        // ?vs/l3/l4=<nodeId> → only tasks under that ancestor (closure walk);
        // the deepest selected level wins.
        const noTest = { NOT: { nodeWorkTemplates: { some: { template: { kind: 'TEST' } } } } };
        const missing = req.query.missing === 'test';
        const ancestor = str('l4') || str('l3') || str('vs');
        const baseWhere = { companyId, isTask: true as const };
        const filteredWhere = {
          ...baseWhere,
          ...(missing ? noTest : {}),
          ...(ancestor ? { descendantEdges: { some: { ancestorId: ancestor } } } : {}),
          ...(q ? { displayValue: { contains: q, mode: 'insensitive' as const } } : {}),
        };
        const [nodes, matching, total, missingTest] = await Promise.all([
          prisma.processNode.findMany({
            where: filteredWhere,
            orderBy: { displayValue: 'asc' },
            take,
            select: { id: true, displayValue: true },
          }),
          prisma.processNode.count({ where: filteredWhere }),
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
          meta: { total, missingTest, matching },
        });
      }
      if (type === 'standard') {
        const department = str('department');
        const category = str('category');
        const where = {
          companyId,
          isArea: false,
          children: { none: {} },
          ...(department ? { department } : {}),
          ...(category ? { category } : {}),
          ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
        };
        const [standards, matching, total] = await Promise.all([
          prisma.standard.findMany({
            where,
            orderBy: { name: 'asc' },
            take,
            select: { id: true, name: true, department: true, category: true },
          }),
          prisma.standard.count({ where }),
          prisma.standard.count({ where: { companyId, isArea: false, children: { none: {} } } }),
        ]);
        return res.json({
          subjects: standards.map((s) => ({
            id: s.id,
            name: s.name,
            path: [s.department, s.category].filter(Boolean).join(' › '),
          })),
          meta: { total, matching },
        });
      }
      if (type === 'compliance') {
        // Compliance items in execution order (itemCode = REG-###-C## — the
        // C-sequence is the order the steps take place). Jurisdiction filter
        // walks through the parent regulation's L3 source rows.
        const regulationId = str('regulationId');
        const complianceJur = str('jurisdictionId');
        const where = {
          companyId,
          ...(regulationId ? { regulationId } : {}),
          ...(complianceJur
            ? { regulation: { requirements: { some: { jurisdictionId: complianceJur } } } }
            : {}),
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' as const } },
                  { itemCode: { contains: q, mode: 'insensitive' as const } },
                  { regulation: { name: { contains: q, mode: 'insensitive' as const } } },
                ],
              }
            : {}),
        };
        const [items, matching, total] = await Promise.all([
          prisma.complianceItem.findMany({
            where,
            orderBy: { itemCode: 'asc' },
            take,
            select: {
              id: true,
              itemCode: true,
              name: true,
              regulation: { select: { regCode: true, name: true } },
            },
          }),
          prisma.complianceItem.count({ where }),
          prisma.complianceItem.count({ where: { companyId } }),
        ]);
        return res.json({
          subjects: items.map((i) => ({
            id: i.id,
            name: `${i.itemCode.replace(`${i.regulation.regCode}-`, '')} — ${i.name}`,
            path: `${i.regulation.regCode} · ${i.regulation.name}`,
          })),
          meta: { total, matching },
        });
      }
      const regime = str('regime');
      const jurisdictionId = str('jurisdictionId');
      const where = {
        companyId,
        status: 'ACTIVE',
        ...(regime ? { regime } : {}),
        ...(jurisdictionId ? { jurisdictionId } : {}),
        ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
      };
      const [regs, matching, total] = await Promise.all([
        prisma.regulatoryRequirement.findMany({
          where,
          orderBy: { title: 'asc' },
          take,
          select: { id: true, title: true, regime: true, jurisdiction: { select: { name: true } } },
        }),
        prisma.regulatoryRequirement.count({ where }),
        prisma.regulatoryRequirement.count({ where: { companyId, status: 'ACTIVE' } }),
      ]);
      res.json({
        subjects: regs.map((r) => ({
          id: r.id,
          name: r.title,
          path: [r.regime, r.jurisdiction?.name].filter(Boolean).join(' › '),
        })),
        meta: { total, matching },
      });
    } catch (e) {
      next(e);
    }
  });

  // ── Plan read ────────────────────────────────────────────────────────────
}
