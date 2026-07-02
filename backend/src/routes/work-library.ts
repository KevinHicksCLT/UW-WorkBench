import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ancestorNames } from '../lib/resolvers/index.js';

// Work Library API — reusable checklist/testing templates (WorkTemplate/
// WorkTemplateKey) applied to atomic work items (task ProcessNodes, leaf
// Standards, RegulatoryRequirements) as plans. Answers live per (subject,
// templateKey) independent of the assignment junctions so switching patterns
// preserves saved values. Entity-typed values are FKs (never copied names).
// Standards/regs attach to TASK nodes only (atomic single source of truth);
// higher levels roll up from tasks (lib/govRollup.ts). Each tied standard/reg
// carries task-local checklist/testing step lists (NodeStandardEvidence /
// NodeRegulationEvidence).

const router = Router();
router.use(requireAuth);

type SubjectType = 'task' | 'standard' | 'regulation';
const SUBJECT_TYPES: SubjectType[] = ['task', 'standard', 'regulation'];

function parseType(raw: string, res: Response): SubjectType | null {
  if ((SUBJECT_TYPES as string[]).includes(raw)) return raw as SubjectType;
  res.status(404).json({ error: 'Unknown subject type' });
  return null;
}

async function activeCompanyId(req: Request, res: Response): Promise<string | null> {
  const company = await prisma.company.findFirst({
    where: { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!company) { res.status(404).json({ error: 'No company found' }); return null; }
  return company.id;
}

// Verify the subject row exists inside the tenant; 404 otherwise.
async function findSubject(type: SubjectType, id: string, tenantId: string) {
  if (type === 'task') {
    return prisma.processNode.findFirst({
      where: { id, isTask: true, company: { tenantId } },
      select: { id: true, companyId: true, displayValue: true, description: true },
    });
  }
  if (type === 'standard') {
    return prisma.standard.findFirst({
      where: { id, company: { tenantId } },
      select: { id: true, companyId: true, name: true, department: true },
    });
  }
  return prisma.regulatoryRequirement.findFirst({
    where: { id, company: { tenantId } },
    select: { id: true, companyId: true, title: true, regime: true },
  });
}

const valueInclude = {
  application: { select: { id: true, name: true } },
  role: { select: { id: true, displayValue: true } },
  deliverable: { select: { id: true, title: true } },
} as const;

const answerShape = (a: any) => ({
  id: a.id,
  templateKeyId: a.templateKeyId,
  customKey: a.customKey,
  kind: a.kind,
  value: a.value,
  suppressed: a.suppressed,
  sortOrder: a.sortOrder,
  application: a.application,
  role: a.role ? { id: a.role.id, name: a.role.displayValue } : null,
  deliverable: a.deliverable ? { id: a.deliverable.id, name: a.deliverable.title } : null,
});

// ── Templates ────────────────────────────────────────────────────────────

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
        keys: t.keys.map((k) => ({ id: k.id, key: k.key, guidance: k.guidance, valueKind: k.valueKind, sortOrder: k.sortOrder })),
        usage: { tasks: t._count.nodeLinks, standards: t._count.standardLinks, regulations: t._count.regulationLinks },
      })),
    });
  } catch (e) { next(e); }
});

const templateBody = z.object({
  kind: z.enum(['CHECKLIST', 'TEST']).optional(),
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
});

router.post('/templates', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const body = templateBody.parse(req.body);
    if (!body.kind || !body.name) return res.status(400).json({ error: 'kind and name are required' });
    const max = await prisma.workTemplate.aggregate({ where: { companyId, kind: body.kind }, _max: { sortOrder: true } });
    const template = await prisma.workTemplate.create({
      data: { companyId, kind: body.kind, name: body.name, description: body.description ?? null, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
    res.status(201).json({ template });
  } catch (e) { next(e); }
});

router.patch('/templates/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const body = templateBody.parse(req.body);
    const existing = await prisma.workTemplate.findFirst({ where: { id: req.params.id, company: { tenantId: req.tenantId } } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    const template = await prisma.workTemplate.update({
      where: { id: existing.id },
      data: { name: body.name ?? undefined, description: body.description === undefined ? undefined : body.description },
    });
    res.json({ template });
  } catch (e) { next(e); }
});

router.delete('/templates/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const existing = await prisma.workTemplate.findFirst({ where: { id: req.params.id, company: { tenantId: req.tenantId } } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    await prisma.workTemplate.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

const keyBody = z.object({
  key: z.string().trim().min(1).optional(),
  guidance: z.string().trim().nullable().optional(),
  valueKind: z.enum(['TEXT', 'APPLICATION', 'ROLE', 'DELIVERABLE']).optional(),
});

router.post('/templates/:id/keys', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const body = keyBody.parse(req.body);
    if (!body.key) return res.status(400).json({ error: 'key is required' });
    const template = await prisma.workTemplate.findFirst({
      where: { id: req.params.id, company: { tenantId: req.tenantId } },
      include: { _count: { select: { keys: true } } },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    const key = await prisma.workTemplateKey.create({
      data: { templateId: template.id, key: body.key, guidance: body.guidance ?? null, valueKind: body.valueKind ?? 'TEXT', sortOrder: template._count.keys },
    });
    res.status(201).json({ key });
  } catch (e) { next(e); }
});

router.patch('/keys/:id', requireRole('ADMIN'), async (req, res, next) => {
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
  } catch (e) { next(e); }
});

router.delete('/keys/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const existing = await prisma.workTemplateKey.findFirst({
      where: { id: req.params.id, template: { company: { tenantId: req.tenantId } } },
    });
    if (!existing) return res.status(404).json({ error: 'Key not found' });
    await prisma.workTemplateKey.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (e) { next(e); }
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
          where: { ...baseWhere, ...(missing ? noTest : {}), ...(q ? { displayValue: { contains: q, mode: 'insensitive' } } : {}) },
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
          return { id: n.id, name: n.displayValue, path: [a?.valueStreamName, a?.l3, a?.l4].filter(Boolean).join(' › ') };
        }),
        meta: { total, missingTest },
      });
    }
    if (type === 'standard') {
      const standards = await prisma.standard.findMany({
        where: { companyId, isArea: false, children: { none: {} }, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
        orderBy: { name: 'asc' },
        take,
        select: { id: true, name: true, department: true, category: true },
      });
      return res.json({ subjects: standards.map((s) => ({ id: s.id, name: s.name, path: [s.department, s.category].filter(Boolean).join(' › ') })) });
    }
    const regs = await prisma.regulatoryRequirement.findMany({
      where: { companyId, status: 'ACTIVE', ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}) },
      orderBy: { title: 'asc' },
      take,
      select: { id: true, title: true, regime: true, jurisdiction: { select: { name: true } } },
    });
    res.json({ subjects: regs.map((r) => ({ id: r.id, name: r.title, path: [r.regime, r.jurisdiction?.name].filter(Boolean).join(' › ') })) });
  } catch (e) { next(e); }
});

// ── Plan read ────────────────────────────────────────────────────────────

async function loadAssignments(type: SubjectType, id: string) {
  if (type === 'task') return prisma.nodeWorkTemplate.findMany({ where: { processNodeId: id }, select: { templateId: true } });
  if (type === 'standard') return prisma.standardWorkTemplate.findMany({ where: { standardId: id }, select: { templateId: true } });
  return prisma.regulationWorkTemplate.findMany({ where: { regId: id }, select: { templateId: true } });
}

async function loadAnswers(type: SubjectType, id: string) {
  if (type === 'task') return prisma.nodeTemplateAnswer.findMany({ where: { processNodeId: id }, include: valueInclude, orderBy: { sortOrder: 'asc' } });
  if (type === 'standard') return prisma.standardTemplateAnswer.findMany({ where: { standardId: id }, include: valueInclude, orderBy: { sortOrder: 'asc' } });
  return prisma.regulationTemplateAnswer.findMany({ where: { regId: id }, include: valueInclude, orderBy: { sortOrder: 'asc' } });
}

router.get('/plan/:type/:id', async (req, res, next) => {
  try {
    const type = parseType(req.params.type, res);
    if (!type) return;
    const subject = await findSubject(type, req.params.id, req.tenantId);
    if (!subject) return res.status(404).json({ error: 'Work item not found' });

    // One parallel stage — every read here depends only on the subject id, so
    // batching them keeps the plan load at a single DB round-trip of latency.
    const isTask = type === 'task';
    const empty = Promise.resolve([] as any[]);
    const [assignments, answers, templates, ancMap, nodeStandards, nodeRegs, stdEvidence, regEvidence] = await Promise.all([
      loadAssignments(type, subject.id),
      loadAnswers(type, subject.id),
      prisma.workTemplate.findMany({
        where: { companyId: subject.companyId },
        orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
        include: { keys: { orderBy: { sortOrder: 'asc' } } },
      }),
      isTask ? ancestorNames([subject.id]) : Promise.resolve(new Map()),
      isTask ? prisma.nodeStandard.findMany({
        where: { processNodeId: subject.id, excluded: false },
        select: { standard: { select: { id: true, name: true, department: true } } },
        orderBy: { standard: { name: 'asc' } },
      }) : empty,
      isTask ? prisma.nodeRegulation.findMany({
        where: { processNodeId: subject.id, excluded: false },
        select: { regulation: { select: { id: true, title: true, regime: true } } },
        orderBy: { regulation: { title: 'asc' } },
      }) : empty,
      isTask ? prisma.nodeStandardEvidence.findMany({ where: { processNodeId: subject.id }, include: valueInclude, orderBy: { sortOrder: 'asc' } }) : empty,
      isTask ? prisma.nodeRegulationEvidence.findMany({ where: { processNodeId: subject.id }, include: valueInclude, orderBy: { sortOrder: 'asc' } }) : empty,
    ]);
    const assignedIds = new Set(assignments.map((a) => a.templateId));
    const byKeyId = new Map(answers.filter((a) => a.templateKeyId).map((a) => [a.templateKeyId as string, a]));
    const customRows = answers.filter((a) => !a.templateKeyId);

    const sections = templates
      .filter((t) => assignedIds.has(t.id))
      .map((t) => ({
        id: t.id,
        kind: t.kind,
        name: t.name,
        description: t.description,
        keys: t.keys.map((k) => ({
          id: k.id,
          key: k.key,
          guidance: k.guidance,
          valueKind: k.valueKind,
          sortOrder: k.sortOrder,
          answer: byKeyId.has(k.id) ? answerShape(byKeyId.get(k.id)) : null,
        })),
      }));

    let name: string;
    let path = '';
    if (type === 'task') {
      name = (subject as any).displayValue;
      const a = ancMap.get(subject.id);
      path = [a?.valueStreamName, a?.l3, a?.l4].filter(Boolean).join(' › ');
    } else if (type === 'standard') {
      name = (subject as any).name;
      path = (subject as any).department ?? '';
    } else {
      name = (subject as any).title;
      path = (subject as any).regime ?? '';
    }

    // Tasks additionally carry the standards/regs they inherit (derived from the
    // closure ancestors' NodeStandard/NodeRegulation — never stored on the task)
    // plus their task-local evidence step lists.
    let standards: any[] = [];
    let regulations: any[] = [];
    if (type === 'task') {
      // Task-grain single source of truth: the task's OWN NodeStandard /
      // NodeRegulation rows (higher levels roll up FROM tasks — govRollup.ts),
      // preloaded in the parallel stage above.
      const evShape = (rows: any[]) => rows.map((r) => ({
        id: r.id, kind: r.kind, step: r.step, value: r.value, sortOrder: r.sortOrder,
        application: r.application,
        role: r.role ? { id: r.role.id, name: r.role.displayValue } : null,
        deliverable: r.deliverable ? { id: r.deliverable.id, name: r.deliverable.title } : null,
      }));
      standards = nodeStandards.map(({ standard: s }) => ({
        id: s.id, name: s.name, source: s.department, direct: true,
        checklist: evShape(stdEvidence.filter((e) => e.standardId === s.id && e.kind === 'CHECKLIST')),
        testing: evShape(stdEvidence.filter((e) => e.standardId === s.id && e.kind === 'TEST')),
      }));
      regulations = nodeRegs.map(({ regulation: r }) => ({
        id: r.id, name: r.title, source: r.regime, direct: true,
        checklist: evShape(regEvidence.filter((e) => e.regId === r.id && e.kind === 'CHECKLIST')),
        testing: evShape(regEvidence.filter((e) => e.regId === r.id && e.kind === 'TEST')),
      }));
    }

    res.json({
      subject: { type, id: subject.id, name, path },
      assignedTemplateIds: [...assignedIds],
      sections,
      customRows: customRows.map(answerShape),
      standards,
      regulations,
    });
  } catch (e) { next(e); }
});

// ── Plan writes ──────────────────────────────────────────────────────────

router.put('/plan/:type/:id/templates', async (req, res, next) => {
  try {
    const type = parseType(req.params.type, res);
    if (!type) return;
    const subject = await findSubject(type, req.params.id, req.tenantId);
    if (!subject) return res.status(404).json({ error: 'Work item not found' });
    const { templateIds } = z.object({ templateIds: z.array(z.string()).max(50) }).parse(req.body);
    const valid = await prisma.workTemplate.findMany({
      where: { id: { in: templateIds }, companyId: subject.companyId },
      select: { id: true },
    });
    const keep = valid.map((t) => t.id);
    // Replace the selection; answers persist independently by design.
    if (type === 'task') {
      await prisma.nodeWorkTemplate.deleteMany({ where: { processNodeId: subject.id, templateId: { notIn: keep } } });
      await prisma.nodeWorkTemplate.createMany({
        data: keep.map((templateId) => ({ companyId: subject.companyId, processNodeId: subject.id, templateId })),
        skipDuplicates: true,
      });
    } else if (type === 'standard') {
      await prisma.standardWorkTemplate.deleteMany({ where: { standardId: subject.id, templateId: { notIn: keep } } });
      await prisma.standardWorkTemplate.createMany({
        data: keep.map((templateId) => ({ companyId: subject.companyId, standardId: subject.id, templateId })),
        skipDuplicates: true,
      });
    } else {
      await prisma.regulationWorkTemplate.deleteMany({ where: { regId: subject.id, templateId: { notIn: keep } } });
      await prisma.regulationWorkTemplate.createMany({
        data: keep.map((templateId) => ({ companyId: subject.companyId, regId: subject.id, templateId })),
        skipDuplicates: true,
      });
    }
    res.json({ assignedTemplateIds: keep });
  } catch (e) { next(e); }
});

const answerRow = z.object({
  id: z.string().optional(),
  templateKeyId: z.string().nullable().optional(),
  customKey: z.string().trim().min(1).nullable().optional(),
  kind: z.enum(['CHECKLIST', 'TEST']).optional(),
  value: z.string().nullable().optional(),
  applicationId: z.string().nullable().optional(),
  roleId: z.string().nullable().optional(),
  deliverableId: z.string().nullable().optional(),
  suppressed: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

router.put('/plan/:type/:id/answers', async (req, res, next) => {
  try {
    const type = parseType(req.params.type, res);
    if (!type) return;
    const subject = await findSubject(type, req.params.id, req.tenantId);
    if (!subject) return res.status(404).json({ error: 'Work item not found' });
    const { rows } = z.object({ rows: z.array(answerRow).max(200) }).parse(req.body);

    const table =
      type === 'task' ? prisma.nodeTemplateAnswer : type === 'standard' ? prisma.standardTemplateAnswer : prisma.regulationTemplateAnswer;
    const subjectField = type === 'task' ? 'processNodeId' : type === 'standard' ? 'standardId' : 'regId';

    for (const row of rows) {
      const data = {
        value: row.value === undefined ? undefined : row.value,
        applicationId: row.applicationId === undefined ? undefined : row.applicationId,
        roleId: row.roleId === undefined ? undefined : row.roleId,
        deliverableId: row.deliverableId === undefined ? undefined : row.deliverableId,
        suppressed: row.suppressed === undefined ? undefined : row.suppressed,
        sortOrder: row.sortOrder === undefined ? undefined : row.sortOrder,
        customKey: row.customKey === undefined ? undefined : row.customKey,
        kind: row.kind === undefined ? undefined : row.kind,
      };
      if (row.id) {
        const existing = await (table as any).findFirst({ where: { id: row.id, [subjectField]: subject.id } });
        if (!existing) continue;
        await (table as any).update({ where: { id: row.id }, data });
      } else if (row.templateKeyId) {
        const key = await prisma.workTemplateKey.findFirst({
          where: { id: row.templateKeyId, template: { companyId: subject.companyId } },
          select: { id: true },
        });
        if (!key) continue;
        const existing = await (table as any).findFirst({ where: { [subjectField]: subject.id, templateKeyId: key.id } });
        if (existing) await (table as any).update({ where: { id: existing.id }, data });
        else await (table as any).create({ data: { companyId: subject.companyId, [subjectField]: subject.id, templateKeyId: key.id, ...data } });
      } else if (row.customKey) {
        await (table as any).create({ data: { companyId: subject.companyId, [subjectField]: subject.id, ...data, customKey: row.customKey } });
      }
    }
    res.json({ answers: (await loadAnswers(type, subject.id)).map(answerShape) });
  } catch (e) { next(e); }
});

router.delete('/plan/:type/:id/answers/:answerId', async (req, res, next) => {
  try {
    const type = parseType(req.params.type, res);
    if (!type) return;
    const subject = await findSubject(type, req.params.id, req.tenantId);
    if (!subject) return res.status(404).json({ error: 'Work item not found' });
    const table =
      type === 'task' ? prisma.nodeTemplateAnswer : type === 'standard' ? prisma.standardTemplateAnswer : prisma.regulationTemplateAnswer;
    const subjectField = type === 'task' ? 'processNodeId' : type === 'standard' ? 'standardId' : 'regId';
    const existing = await (table as any).findFirst({ where: { id: req.params.answerId, [subjectField]: subject.id } });
    if (!existing) return res.status(404).json({ error: 'Answer not found' });
    await (table as any).delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Standard/regulation evidence steps on a task ─────────────────────────

const evidenceRow = z.object({
  id: z.string().optional(),
  standardId: z.string().optional(),
  regId: z.string().optional(),
  kind: z.enum(['CHECKLIST', 'TEST']),
  step: z.string().trim().min(1).optional(),
  value: z.string().nullable().optional(),
  applicationId: z.string().nullable().optional(),
  roleId: z.string().nullable().optional(),
  deliverableId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

router.put('/plan/task/:id/evidence', async (req, res, next) => {
  try {
    const subject = await findSubject('task', req.params.id, req.tenantId);
    if (!subject) return res.status(404).json({ error: 'Work item not found' });
    const { rows } = z.object({ rows: z.array(evidenceRow).max(200) }).parse(req.body);
    for (const row of rows) {
      const data = {
        kind: row.kind,
        step: row.step === undefined ? undefined : row.step,
        value: row.value === undefined ? undefined : row.value,
        applicationId: row.applicationId === undefined ? undefined : row.applicationId,
        roleId: row.roleId === undefined ? undefined : row.roleId,
        deliverableId: row.deliverableId === undefined ? undefined : row.deliverableId,
        sortOrder: row.sortOrder === undefined ? undefined : row.sortOrder,
      };
      if (row.standardId) {
        if (row.id) {
          const existing = await prisma.nodeStandardEvidence.findFirst({ where: { id: row.id, processNodeId: subject.id } });
          if (existing) await prisma.nodeStandardEvidence.update({ where: { id: existing.id }, data });
        } else if (row.step) {
          const std = await prisma.standard.findFirst({ where: { id: row.standardId, companyId: subject.companyId }, select: { id: true } });
          if (std) {
            await prisma.nodeStandardEvidence.create({
              data: { companyId: subject.companyId, processNodeId: subject.id, standardId: std.id, ...data, step: row.step },
            });
          }
        }
      } else if (row.regId) {
        if (row.id) {
          const existing = await prisma.nodeRegulationEvidence.findFirst({ where: { id: row.id, processNodeId: subject.id } });
          if (existing) await prisma.nodeRegulationEvidence.update({ where: { id: existing.id }, data });
        } else if (row.step) {
          const reg = await prisma.regulatoryRequirement.findFirst({ where: { id: row.regId, companyId: subject.companyId }, select: { id: true } });
          if (reg) {
            await prisma.nodeRegulationEvidence.create({
              data: { companyId: subject.companyId, processNodeId: subject.id, regId: reg.id, ...data, step: row.step },
            });
          }
        }
      }
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/plan/task/:id/evidence/:scope/:evidenceId', async (req, res, next) => {
  try {
    const subject = await findSubject('task', req.params.id, req.tenantId);
    if (!subject) return res.status(404).json({ error: 'Work item not found' });
    if (req.params.scope === 'standard') {
      const existing = await prisma.nodeStandardEvidence.findFirst({ where: { id: req.params.evidenceId, processNodeId: subject.id } });
      if (!existing) return res.status(404).json({ error: 'Step not found' });
      await prisma.nodeStandardEvidence.delete({ where: { id: existing.id } });
    } else if (req.params.scope === 'regulation') {
      const existing = await prisma.nodeRegulationEvidence.findFirst({ where: { id: req.params.evidenceId, processNodeId: subject.id } });
      if (!existing) return res.status(404).json({ error: 'Step not found' });
      await prisma.nodeRegulationEvidence.delete({ where: { id: existing.id } });
    } else {
      return res.status(404).json({ error: 'Unknown scope' });
    }
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Assign / remove standards + regulations at task level ────────────────
// Tasks are the ONLY place standards/regs attach (single source of truth at
// the atomic grain). Adding writes a NodeStandard/NodeRegulation row on the
// task; removing deletes it. Value streams, L2/L3 containers, and the
// Standards/Regulations tabs all ROLL UP from the task rows (lib/govRollup.ts),
// so both operations reflect everywhere automatically.

router.post('/plan/task/:id/standards', async (req, res, next) => {
  try {
    const subject = await findSubject('task', req.params.id, req.tenantId);
    if (!subject) return res.status(404).json({ error: 'Work item not found' });
    const { standardId } = z.object({ standardId: z.string() }).parse(req.body);
    const std = await prisma.standard.findFirst({ where: { id: standardId, companyId: subject.companyId }, select: { id: true } });
    if (!std) return res.status(404).json({ error: 'Standard not found' });
    await prisma.nodeStandard.upsert({
      where: { processNodeId_standardId: { processNodeId: subject.id, standardId: std.id } },
      update: { excluded: false }, // re-adding un-excludes
      create: { companyId: subject.companyId, processNodeId: subject.id, standardId: std.id },
    });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/plan/task/:id/standards/:standardId', async (req, res, next) => {
  try {
    const subject = await findSubject('task', req.params.id, req.tenantId);
    if (!subject) return res.status(404).json({ error: 'Work item not found' });
    const del = await prisma.nodeStandard.deleteMany({ where: { processNodeId: subject.id, standardId: req.params.standardId } });
    if (!del.count) return res.status(404).json({ error: 'Standard is not applied here' });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/plan/task/:id/regulations', async (req, res, next) => {
  try {
    const subject = await findSubject('task', req.params.id, req.tenantId);
    if (!subject) return res.status(404).json({ error: 'Work item not found' });
    const { regId } = z.object({ regId: z.string() }).parse(req.body);
    const reg = await prisma.regulatoryRequirement.findFirst({ where: { id: regId, companyId: subject.companyId }, select: { id: true } });
    if (!reg) return res.status(404).json({ error: 'Regulation not found' });
    await prisma.nodeRegulation.upsert({
      where: { processNodeId_regId: { processNodeId: subject.id, regId: reg.id } },
      update: { excluded: false },
      create: { companyId: subject.companyId, processNodeId: subject.id, regId: reg.id },
    });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/plan/task/:id/regulations/:regId', async (req, res, next) => {
  try {
    const subject = await findSubject('task', req.params.id, req.tenantId);
    if (!subject) return res.status(404).json({ error: 'Work item not found' });
    const del = await prisma.nodeRegulation.deleteMany({ where: { processNodeId: subject.id, regId: req.params.regId } });
    if (!del.count) return res.status(404).json({ error: 'Regulation is not applied here' });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Value combobox options (entity-backed values) ────────────────────────

const OPTION_KINDS = ['APPLICATION', 'ROLE', 'DELIVERABLE'] as const;

router.get('/options', async (req, res, next) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const kind = String(req.query.kind ?? '');
    if (!(OPTION_KINDS as readonly string[]).includes(kind)) return res.status(400).json({ error: 'kind must be APPLICATION | ROLE | DELIVERABLE' });
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const take = 30;
    if (kind === 'APPLICATION') {
      const rows = await prisma.application.findMany({
        where: { companyId, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
        orderBy: { name: 'asc' }, take, select: { id: true, name: true, kind: true },
      });
      return res.json({ options: rows.map((r) => ({ id: r.id, name: r.name, detail: r.kind })) });
    }
    if (kind === 'ROLE') {
      const rows = await prisma.role.findMany({
        where: { companyId, ...(q ? { displayValue: { contains: q, mode: 'insensitive' } } : {}) },
        orderBy: { displayValue: 'asc' }, take, select: { id: true, displayValue: true },
      });
      return res.json({ options: rows.map((r) => ({ id: r.id, name: r.displayValue, detail: null })) });
    }
    const rows = await prisma.deliverable.findMany({
      where: { companyId, ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}) },
      orderBy: { title: 'asc' }, take, select: { id: true, title: true },
    });
    res.json({ options: rows.map((r) => ({ id: r.id, name: r.title, detail: null })) });
  } catch (e) { next(e); }
});

// "Add new" from a value combobox — creates the row in its OWNING table (it
// appears on the Applications/Roles/Deliverables tabs) and returns the FK.
router.post('/options', async (req, res, next) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const { kind, name } = z.object({ kind: z.enum(OPTION_KINDS), name: z.string().trim().min(1) }).parse(req.body);
    if (kind === 'APPLICATION') {
      const existing = await prisma.application.findFirst({ where: { companyId, name: { equals: name, mode: 'insensitive' } } });
      if (existing) return res.json({ option: { id: existing.id, name: existing.name } });
      const row = await prisma.application.create({ data: { companyId, name, kind: 'SystemOfRecord', illustrative: false } });
      return res.status(201).json({ option: { id: row.id, name: row.name } });
    }
    if (kind === 'ROLE') {
      const existing = await prisma.role.findFirst({ where: { companyId, displayValue: { equals: name, mode: 'insensitive' } } });
      if (existing) return res.json({ option: { id: existing.id, name: existing.displayValue } });
      const row = await prisma.role.create({ data: { companyId, dbValue: name, displayValue: name } });
      return res.status(201).json({ option: { id: row.id, name: row.displayValue } });
    }
    const existing = await prisma.deliverable.findFirst({ where: { companyId, title: { equals: name, mode: 'insensitive' } } });
    if (existing) return res.json({ option: { id: existing.id, name: existing.title } });
    const row = await prisma.deliverable.create({ data: { companyId, title: name } });
    res.status(201).json({ option: { id: row.id, name: row.title } });
  } catch (e) { next(e); }
});

export default router;
