/**
 * Work Library plans — per-subject (task / standard / regulation) template
 * assignments, saved answers, task evidence rows, and task-local standard /
 * regulation ties. Answers live per (subject, templateKey) independent of the
 * assignment junctions so switching patterns preserves saved values.
 */
import type { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { ancestorNames } from '../../lib/resolvers/index.js';
import { type SubjectType, parseType, findSubject, valueInclude, answerShape } from './helpers.js';

/** Registers the plan read/write routes on the shared router (order preserved). */
export function registerPlanRoutes(router: Router): void {
  async function loadAssignments(type: SubjectType, id: string) {
    if (type === 'task')
      return prisma.nodeWorkTemplate.findMany({
        where: { processNodeId: id },
        select: { templateId: true },
      });
    if (type === 'standard')
      return prisma.standardWorkTemplate.findMany({
        where: { standardId: id },
        select: { templateId: true },
      });
    if (type === 'compliance')
      return prisma.complianceItemWorkTemplate.findMany({
        where: { complianceItemId: id },
        select: { templateId: true },
      });
    return prisma.regulationWorkTemplate.findMany({
      where: { regId: id },
      select: { templateId: true },
    });
  }

  async function loadAnswers(type: SubjectType, id: string) {
    if (type === 'task')
      return prisma.nodeTemplateAnswer.findMany({
        where: { processNodeId: id },
        include: valueInclude,
        orderBy: { sortOrder: 'asc' },
      });
    if (type === 'standard')
      return prisma.standardTemplateAnswer.findMany({
        where: { standardId: id },
        include: valueInclude,
        orderBy: { sortOrder: 'asc' },
      });
    if (type === 'compliance')
      return prisma.complianceItemTemplateAnswer.findMany({
        where: { complianceItemId: id },
        include: valueInclude,
        orderBy: { sortOrder: 'asc' },
      });
    return prisma.regulationTemplateAnswer.findMany({
      where: { regId: id },
      include: valueInclude,
      orderBy: { sortOrder: 'asc' },
    });
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
      const empty = Promise.resolve([]);
      const [
        assignments,
        answers,
        templates,
        ancMap,
        nodeStandards,
        nodeRegs,
        stdEvidence,
        regEvidence,
      ] = await Promise.all([
        loadAssignments(type, subject.id),
        loadAnswers(type, subject.id),
        prisma.workTemplate.findMany({
          where: { companyId: subject.companyId },
          orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
          include: { keys: { orderBy: { sortOrder: 'asc' } } },
        }),
        isTask ? ancestorNames([subject.id]) : Promise.resolve(new Map()),
        isTask
          ? prisma.nodeStandard.findMany({
              where: { processNodeId: subject.id, excluded: false },
              select: { standard: { select: { id: true, name: true, department: true } } },
              orderBy: { standard: { name: 'asc' } },
            })
          : empty,
        isTask
          ? prisma.nodeRegulation.findMany({
              where: { processNodeId: subject.id, excluded: false },
              select: { regulation: { select: { id: true, title: true, regime: true } } },
              orderBy: { regulation: { title: 'asc' } },
            })
          : empty,
        isTask
          ? prisma.nodeStandardEvidence.findMany({
              where: { processNodeId: subject.id },
              include: valueInclude,
              orderBy: { sortOrder: 'asc' },
            })
          : empty,
        isTask
          ? prisma.nodeRegulationEvidence.findMany({
              where: { processNodeId: subject.id },
              include: valueInclude,
              orderBy: { sortOrder: 'asc' },
            })
          : empty,
      ]);
      const assignedIds = new Set(assignments.map((a) => a.templateId));
      const byKeyId = new Map(
        answers.filter((a) => a.templateKeyId).map((a) => [a.templateKeyId as string, a]),
      );
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
            answer: byKeyId.has(k.id) ? answerShape(byKeyId.get(k.id)!) : null,
          })),
        }));

      let name: string;
      let path = '';
      if (type === 'task') {
        name = (subject as { displayValue: string }).displayValue;
        const a = ancMap.get(subject.id);
        path = [a?.valueStreamName, a?.l3, a?.l4].filter(Boolean).join(' › ');
      } else if (type === 'standard') {
        const std = subject as { name: string; department: string | null };
        name = std.name;
        path = std.department ?? '';
      } else if (type === 'compliance') {
        const item = subject as {
          itemCode: string;
          name: string;
          regulation: { regCode: string; name: string };
        };
        name = `${item.itemCode} — ${item.name}`;
        path = `${item.regulation.regCode} › ${item.regulation.name}`;
      } else {
        const reg = subject as { title: string; regime: string | null };
        name = reg.title;
        path = reg.regime ?? '';
      }

      // Tasks additionally carry the standards/regs they inherit (derived from the
      // closure ancestors' NodeStandard/NodeRegulation — never stored on the task)
      // plus their task-local evidence step lists.
      type EvidenceRow = {
        id: string;
        kind: string;
        step: string | null;
        value: string | null;
        sortOrder: number;
        standardId?: string;
        regId?: string;
        application: { id: string; name: string } | null;
        role: { id: string; displayValue: string } | null;
        deliverable: { id: string; title: string } | null;
      };
      type EvidenceOut = {
        id: string;
        kind: string;
        step: string | null;
        value: string | null;
        sortOrder: number;
        application: { id: string; name: string } | null;
        role: { id: string; name: string } | null;
        deliverable: { id: string; name: string } | null;
      };
      type GovItem = {
        id: string;
        name: string;
        source: string | null;
        direct: boolean;
        checklist: EvidenceOut[];
        testing: EvidenceOut[];
      };
      let standards: GovItem[] = [];
      let regulations: GovItem[] = [];
      if (type === 'task') {
        // Task-grain single source of truth: the task's OWN NodeStandard /
        // NodeRegulation rows (higher levels roll up FROM tasks — govRollup.ts),
        // preloaded in the parallel stage above.
        const evShape = (rows: EvidenceRow[]): EvidenceOut[] =>
          rows.map((r) => ({
            id: r.id,
            kind: r.kind,
            step: r.step,
            value: r.value,
            sortOrder: r.sortOrder,
            application: r.application,
            role: r.role ? { id: r.role.id, name: r.role.displayValue } : null,
            deliverable: r.deliverable ? { id: r.deliverable.id, name: r.deliverable.title } : null,
          }));
        standards = nodeStandards.map(({ standard: s }) => ({
          id: s.id,
          name: s.name,
          source: s.department,
          direct: true,
          checklist: evShape(
            stdEvidence.filter((e) => e.standardId === s.id && e.kind === 'CHECKLIST'),
          ),
          testing: evShape(stdEvidence.filter((e) => e.standardId === s.id && e.kind === 'TEST')),
        }));
        regulations = nodeRegs.map(({ regulation: r }) => ({
          id: r.id,
          name: r.title,
          source: r.regime,
          direct: true,
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
    } catch (e) {
      next(e);
    }
  });

  // ── Plan writes ──────────────────────────────────────────────────────────

  router.put('/plan/:type/:id/templates', async (req, res, next) => {
    try {
      const type = parseType(req.params.type, res);
      if (!type) return;
      const subject = await findSubject(type, req.params.id, req.tenantId);
      if (!subject) return res.status(404).json({ error: 'Work item not found' });
      const { templateIds } = z
        .object({ templateIds: z.array(z.string()).max(50) })
        .parse(req.body);
      const valid = await prisma.workTemplate.findMany({
        where: { id: { in: templateIds }, companyId: subject.companyId },
        select: { id: true },
      });
      const keep = valid.map((t) => t.id);
      // Replace the selection; answers persist independently by design.
      if (type === 'task') {
        await prisma.nodeWorkTemplate.deleteMany({
          where: { processNodeId: subject.id, templateId: { notIn: keep } },
        });
        await prisma.nodeWorkTemplate.createMany({
          data: keep.map((templateId) => ({
            companyId: subject.companyId,
            processNodeId: subject.id,
            templateId,
          })),
          skipDuplicates: true,
        });
      } else if (type === 'standard') {
        await prisma.standardWorkTemplate.deleteMany({
          where: { standardId: subject.id, templateId: { notIn: keep } },
        });
        await prisma.standardWorkTemplate.createMany({
          data: keep.map((templateId) => ({
            companyId: subject.companyId,
            standardId: subject.id,
            templateId,
          })),
          skipDuplicates: true,
        });
      } else if (type === 'compliance') {
        await prisma.complianceItemWorkTemplate.deleteMany({
          where: { complianceItemId: subject.id, templateId: { notIn: keep } },
        });
        await prisma.complianceItemWorkTemplate.createMany({
          data: keep.map((templateId) => ({
            companyId: subject.companyId,
            complianceItemId: subject.id,
            templateId,
          })),
          skipDuplicates: true,
        });
      } else {
        await prisma.regulationWorkTemplate.deleteMany({
          where: { regId: subject.id, templateId: { notIn: keep } },
        });
        await prisma.regulationWorkTemplate.createMany({
          data: keep.map((templateId) => ({
            companyId: subject.companyId,
            regId: subject.id,
            templateId,
          })),
          skipDuplicates: true,
        });
      }
      res.json({ assignedTemplateIds: keep });
    } catch (e) {
      next(e);
    }
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

      /** Structural view over the three per-subject answer delegates (dynamic table pick). */
      type AnswerDelegate = {
        findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
        update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
        create(args: { data: Record<string, unknown> }): Promise<unknown>;
        delete(args: { where: { id: string } }): Promise<unknown>;
      };
      const table = (type === 'task'
        ? prisma.nodeTemplateAnswer
        : type === 'standard'
          ? prisma.standardTemplateAnswer
          : type === 'compliance'
            ? prisma.complianceItemTemplateAnswer
            : prisma.regulationTemplateAnswer) as unknown as AnswerDelegate;
      const subjectField =
        type === 'task'
          ? 'processNodeId'
          : type === 'standard'
            ? 'standardId'
            : type === 'compliance'
              ? 'complianceItemId'
              : 'regId';

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
          const existing = await table.findFirst({
            where: { id: row.id, [subjectField]: subject.id },
          });
          if (!existing) continue;
          await table.update({ where: { id: row.id }, data });
        } else if (row.templateKeyId) {
          const key = await prisma.workTemplateKey.findFirst({
            where: { id: row.templateKeyId, template: { companyId: subject.companyId } },
            select: { id: true },
          });
          if (!key) continue;
          const existing = await table.findFirst({
            where: { [subjectField]: subject.id, templateKeyId: key.id },
          });
          if (existing) await table.update({ where: { id: existing.id }, data });
          else
            await table.create({
              data: {
                companyId: subject.companyId,
                [subjectField]: subject.id,
                templateKeyId: key.id,
                ...data,
              },
            });
        } else if (row.customKey) {
          await table.create({
            data: {
              companyId: subject.companyId,
              [subjectField]: subject.id,
              ...data,
              customKey: row.customKey,
            },
          });
        }
      }
      res.json({ answers: (await loadAnswers(type, subject.id)).map(answerShape) });
    } catch (e) {
      next(e);
    }
  });

  router.delete('/plan/:type/:id/answers/:answerId', async (req, res, next) => {
    try {
      const type = parseType(req.params.type, res);
      if (!type) return;
      const subject = await findSubject(type, req.params.id, req.tenantId);
      if (!subject) return res.status(404).json({ error: 'Work item not found' });
      type AnswerDelegate = {
        findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
        delete(args: { where: { id: string } }): Promise<unknown>;
      };
      const table = (type === 'task'
        ? prisma.nodeTemplateAnswer
        : type === 'standard'
          ? prisma.standardTemplateAnswer
          : type === 'compliance'
            ? prisma.complianceItemTemplateAnswer
            : prisma.regulationTemplateAnswer) as unknown as AnswerDelegate;
      const subjectField =
        type === 'task'
          ? 'processNodeId'
          : type === 'standard'
            ? 'standardId'
            : type === 'compliance'
              ? 'complianceItemId'
              : 'regId';
      const existing = await table.findFirst({
        where: { id: req.params.answerId, [subjectField]: subject.id },
      });
      if (!existing) return res.status(404).json({ error: 'Answer not found' });
      await table.delete({ where: { id: existing.id } });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
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
            const existing = await prisma.nodeStandardEvidence.findFirst({
              where: { id: row.id, processNodeId: subject.id },
            });
            if (existing)
              await prisma.nodeStandardEvidence.update({ where: { id: existing.id }, data });
          } else if (row.step) {
            const std = await prisma.standard.findFirst({
              where: { id: row.standardId, companyId: subject.companyId },
              select: { id: true },
            });
            if (std) {
              await prisma.nodeStandardEvidence.create({
                data: {
                  companyId: subject.companyId,
                  processNodeId: subject.id,
                  standardId: std.id,
                  ...data,
                  step: row.step,
                },
              });
            }
          }
        } else if (row.regId) {
          if (row.id) {
            const existing = await prisma.nodeRegulationEvidence.findFirst({
              where: { id: row.id, processNodeId: subject.id },
            });
            if (existing)
              await prisma.nodeRegulationEvidence.update({ where: { id: existing.id }, data });
          } else if (row.step) {
            const reg = await prisma.regulatoryRequirement.findFirst({
              where: { id: row.regId, companyId: subject.companyId },
              select: { id: true },
            });
            if (reg) {
              await prisma.nodeRegulationEvidence.create({
                data: {
                  companyId: subject.companyId,
                  processNodeId: subject.id,
                  regId: reg.id,
                  ...data,
                  step: row.step,
                },
              });
            }
          }
        }
      }
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  router.delete('/plan/task/:id/evidence/:scope/:evidenceId', async (req, res, next) => {
    try {
      const subject = await findSubject('task', req.params.id, req.tenantId);
      if (!subject) return res.status(404).json({ error: 'Work item not found' });
      if (req.params.scope === 'standard') {
        const existing = await prisma.nodeStandardEvidence.findFirst({
          where: { id: req.params.evidenceId, processNodeId: subject.id },
        });
        if (!existing) return res.status(404).json({ error: 'Step not found' });
        await prisma.nodeStandardEvidence.delete({ where: { id: existing.id } });
      } else if (req.params.scope === 'regulation') {
        const existing = await prisma.nodeRegulationEvidence.findFirst({
          where: { id: req.params.evidenceId, processNodeId: subject.id },
        });
        if (!existing) return res.status(404).json({ error: 'Step not found' });
        await prisma.nodeRegulationEvidence.delete({ where: { id: existing.id } });
      } else {
        return res.status(404).json({ error: 'Unknown scope' });
      }
      res.status(204).end();
    } catch (e) {
      next(e);
    }
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
      const std = await prisma.standard.findFirst({
        where: { id: standardId, companyId: subject.companyId },
        select: { id: true },
      });
      if (!std) return res.status(404).json({ error: 'Standard not found' });
      await prisma.nodeStandard.upsert({
        where: { processNodeId_standardId: { processNodeId: subject.id, standardId: std.id } },
        update: { excluded: false }, // re-adding un-excludes
        create: { companyId: subject.companyId, processNodeId: subject.id, standardId: std.id },
      });
      res.status(201).json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  router.delete('/plan/task/:id/standards/:standardId', async (req, res, next) => {
    try {
      const subject = await findSubject('task', req.params.id, req.tenantId);
      if (!subject) return res.status(404).json({ error: 'Work item not found' });
      const del = await prisma.nodeStandard.deleteMany({
        where: { processNodeId: subject.id, standardId: req.params.standardId },
      });
      if (!del.count) return res.status(404).json({ error: 'Standard is not applied here' });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  router.post('/plan/task/:id/regulations', async (req, res, next) => {
    try {
      const subject = await findSubject('task', req.params.id, req.tenantId);
      if (!subject) return res.status(404).json({ error: 'Work item not found' });
      const { regId } = z.object({ regId: z.string() }).parse(req.body);
      const reg = await prisma.regulatoryRequirement.findFirst({
        where: { id: regId, companyId: subject.companyId },
        select: { id: true },
      });
      if (!reg) return res.status(404).json({ error: 'Regulation not found' });
      await prisma.nodeRegulation.upsert({
        where: { processNodeId_regId: { processNodeId: subject.id, regId: reg.id } },
        update: { excluded: false },
        create: { companyId: subject.companyId, processNodeId: subject.id, regId: reg.id },
      });
      res.status(201).json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  router.delete('/plan/task/:id/regulations/:regId', async (req, res, next) => {
    try {
      const subject = await findSubject('task', req.params.id, req.tenantId);
      if (!subject) return res.status(404).json({ error: 'Work item not found' });
      const del = await prisma.nodeRegulation.deleteMany({
        where: { processNodeId: subject.id, regId: req.params.regId },
      });
      if (!del.count) return res.status(404).json({ error: 'Regulation is not applied here' });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ── Value combobox options (entity-backed values) ────────────────────────
}
