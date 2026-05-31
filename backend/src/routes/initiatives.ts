import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { recomputeInitiative } from '../services/rollup.js';
import { applyWorkflowAction } from '../services/workflow.js';
import { runRulesForEntity } from '../services/rulesEngine.js';

const router = Router();
router.use(requireAuth);

async function tenantInitiative(id: string, tenantId: string) {
  return prisma.initiative.findFirst({
    where: { id, workstream: { program: { tenantId } } },
  });
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter: any = {};
    if (req.query.programId) filter.workstream = { programId: req.query.programId };
    if (req.query.workstreamId) filter.workstreamId = req.query.workstreamId;
    if (req.query.stage) filter.stage = req.query.stage;
    if (req.query.status) filter.status = req.query.status;

    const initiatives = await prisma.initiative.findMany({
      where: { workstream: { program: { tenantId: req.tenantId } }, ...filter },
      include: {
        workstream: { include: { program: { select: { id: true, name: true } } } },
        owner: { select: { id: true, name: true, email: true } },
        sponsor: { select: { id: true, name: true, email: true } },
        _count: { select: { raidItems: true, milestones: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(initiatives);
  } catch (e) { next(e); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const init = await prisma.initiative.findFirst({
      where: { id: req.params.id, workstream: { program: { tenantId: req.tenantId } } },
      include: {
        workstream: { include: { program: true } },
        owner: { select: { id: true, name: true, email: true } },
        sponsor: { select: { id: true, name: true, email: true } },
        benefits: { include: { values: true } },
        costs: { include: { values: true } },
        milestones: { orderBy: { dueDate: 'asc' } },
        raidItems: { orderBy: { severity: 'desc' } },
        objectiveLinks: { include: { objective: true } },
        initiativeKpis: { include: { kpi: true } },
      },
    });
    if (!init) return res.status(404).json({ error: 'Not found' });
    res.json(init);
  } catch (e) { next(e); }
});

const createSchema = z.object({
  workstreamId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string(),
  dueDate: z.string(),
  ownerId: z.string().optional(),
  sponsorId: z.string().optional(),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSchema.parse(req.body);
    const ws = await prisma.workstream.findFirst({
      where: { id: data.workstreamId, program: { tenantId: req.tenantId } },
    });
    if (!ws) return res.status(404).json({ error: 'Workstream not found' });
    const init = await prisma.initiative.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        dueDate: new Date(data.dueDate),
      },
    });
    await logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'Initiative', entityId: init.id, action: 'CREATE',
    });
    await runRulesForEntity({
      tenantId: req.tenantId, entityType: 'Initiative', trigger: 'ON_CREATE',
      entity: init, actor: req.user,
    });
    res.status(201).json(init);
  } catch (e) { next(e); }
});

const updateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).optional(),
  statusNote: z.string().optional(),
  ownerId: z.string().nullable().optional(),
  sponsorId: z.string().nullable().optional(),
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await tenantInitiative(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = updateSchema.parse(req.body);
    const patch: any = { ...data };
    if (data.startDate) patch.startDate = new Date(data.startDate);
    if (data.dueDate) patch.dueDate = new Date(data.dueDate);

    const updated = await prisma.initiative.update({
      where: { id: req.params.id }, data: patch,
    });
    await logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'Initiative', entityId: req.params.id, action: 'UPDATE', diff: data,
    });
    if (data.status && data.status !== existing.status) {
      await runRulesForEntity({
        tenantId: req.tenantId, entityType: 'Initiative', trigger: 'ON_FIELD_CHANGE',
        fieldName: 'status', fieldValue: data.status,
        entity: updated, actor: req.user,
      });
    }
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await tenantInitiative(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.initiative.delete({ where: { id: req.params.id } });
    await logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'Initiative', entityId: req.params.id, action: 'DELETE',
    });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Workflow actions
const workflowSchema = z.object({
  action: z.enum(['SUBMIT', 'APPROVE', 'MOVE_BACK']),
});

router.post('/:id/workflow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await tenantInitiative(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { action } = workflowSchema.parse(req.body);
    const updated = await applyWorkflowAction({
      initiativeId: req.params.id, action, actor: req.user,
    });
    res.json(updated);
  } catch (e) { next(e); }
});

// Force a recompute of cumulative figures
router.post('/:id/recompute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await tenantInitiative(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = await recomputeInitiative(req.params.id);
    res.json(updated);
  } catch (e) { next(e); }
});

// Milestones (nested)
const milestoneSchema = z.object({
  name: z.string().min(1),
  dueDate: z.string(),
  isGate: z.boolean().optional(),
});

router.post('/:id/milestones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await tenantInitiative(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = milestoneSchema.parse(req.body);
    const m = await prisma.milestone.create({
      data: { ...data, dueDate: new Date(data.dueDate), initiativeId: req.params.id },
    });
    res.status(201).json(m);
  } catch (e) { next(e); }
});

router.patch('/milestones/:milestoneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const m = await prisma.milestone.findUnique({
      where: { id: req.params.milestoneId },
      include: { initiative: { include: { workstream: { include: { program: true } } } } },
    });
    if (!m || m.initiative.workstream.program.tenantId !== req.tenantId)
      return res.status(404).json({ error: 'Not found' });

    const data = z.object({
      name: z.string().optional(),
      dueDate: z.string().optional(),
      status: z.enum(['PENDING', 'DONE', 'MISSED']).optional(),
      isGate: z.boolean().optional(),
    }).parse(req.body);
    const patch: any = { ...data };
    if (data.dueDate) patch.dueDate = new Date(data.dueDate);
    if (data.status === 'DONE') patch.completedAt = new Date();

    const updated = await prisma.milestone.update({
      where: { id: req.params.milestoneId }, data: patch,
    });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/milestones/:milestoneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const m = await prisma.milestone.findUnique({
      where: { id: req.params.milestoneId },
      include: { initiative: { include: { workstream: { include: { program: true } } } } },
    });
    if (!m || m.initiative.workstream.program.tenantId !== req.tenantId)
      return res.status(404).json({ error: 'Not found' });
    await prisma.milestone.delete({ where: { id: req.params.milestoneId } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Objective alignment links
router.post('/:id/objectives', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await tenantInitiative(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { objectiveId, impact } = z.object({
      objectiveId: z.string(),
      impact: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
    }).parse(req.body);
    const obj = await prisma.strategicObjective.findFirst({
      where: { id: objectiveId, tenantId: req.tenantId },
    });
    if (!obj) return res.status(404).json({ error: 'Objective not found' });
    const link = await prisma.initiativeObjective.upsert({
      where: { initiativeId_objectiveId: { initiativeId: req.params.id, objectiveId } },
      update: { impact },
      create: { initiativeId: req.params.id, objectiveId, impact },
    });
    await recomputeInitiative(req.params.id);
    res.status(201).json(link);
  } catch (e) { next(e); }
});

router.delete('/:id/objectives/:objectiveId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await tenantInitiative(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.initiativeObjective.delete({
      where: {
        initiativeId_objectiveId: {
          initiativeId: req.params.id, objectiveId: req.params.objectiveId,
        },
      },
    });
    await recomputeInitiative(req.params.id);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
