/**
 * Strategic objectives CRUD + initiative↔objective links (value-score recompute).
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit, computeDiff } from '../../services/audit.js';
import { activeCompanyId, ownInitiative } from './helpers.js';

/** Registers this feature's routes on the shared /portfolio router (order preserved). */
export function registerObjectiveRoutes(router: Router): void {
async function recomputeValueScore(initiativeId: string) {
  const links = await prisma.initiativeObjective.findMany({
    where: { initiativeId },
    include: { objective: { select: { weight: true } } },
  });
  const valueScore = Math.round(links.reduce((a, l) => a + l.impact * l.objective.weight, 0) * 10) / 10;
  return prisma.portfolioInitiative.update({ where: { id: initiativeId }, data: { valueScore } });
}

router.get('/objectives', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const objectives = await prisma.strategicObjective.findMany({
      where: { tenantId: req.tenantId, companyId },
      include: { _count: { select: { links: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(objectives);
  } catch (e) { next(e); }
});

const objectiveCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  weight: z.number().min(0).max(10).optional(),
});

router.post('/objectives', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const data = objectiveCreateSchema.parse(req.body);
    const obj = await prisma.strategicObjective.create({
      data: { tenantId: req.tenantId, companyId, name: data.name, description: data.description, weight: data.weight ?? 1 },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'StrategicObjective', entityId: obj.id, action: 'OBJECTIVE_CREATED', diff: { objective: data.name, weight: data.weight ?? 1 } });
    res.status(201).json(obj);
  } catch (e) { next(e); }
});

router.patch('/objectives/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.strategicObjective.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = objectiveCreateSchema.partial().parse(req.body);
    const updated = await prisma.strategicObjective.update({ where: { id: req.params.id }, data });
    // A weight change shifts every linked initiative's value score.
    if (data.weight !== undefined && data.weight !== existing.weight) {
      const links = await prisma.initiativeObjective.findMany({ where: { objectiveId: req.params.id }, select: { initiativeId: true } });
      for (const l of links) await recomputeValueScore(l.initiativeId);
    }
    logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'StrategicObjective', entityId: req.params.id, action: 'OBJECTIVE_UPDATED',
      diff: { objective: existing.name, ...computeDiff(existing, data, Object.keys(data)) },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/objectives/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.strategicObjective.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true, name: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const links = await prisma.initiativeObjective.findMany({ where: { objectiveId: req.params.id }, select: { initiativeId: true } });
    await prisma.strategicObjective.delete({ where: { id: req.params.id } }); // cascades the links
    for (const l of links) await recomputeValueScore(l.initiativeId);
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'StrategicObjective', entityId: req.params.id, action: 'OBJECTIVE_DELETED', diff: { objective: existing.name } });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/initiatives/:id/objectives', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const init = await ownInitiative(req.params.id, req.tenantId);
    if (!init) return res.status(404).json({ error: 'Not found' });
    const data = z.object({ objectiveId: z.string(), impact: z.number().int().min(1).max(5) }).parse(req.body);
    const objective = await prisma.strategicObjective.findFirst({ where: { id: data.objectiveId, tenantId: req.tenantId }, select: { id: true, name: true } });
    if (!objective) return res.status(404).json({ error: 'Objective not found' });
    const link = await prisma.initiativeObjective.create({ data: { initiativeId: req.params.id, objectiveId: data.objectiveId, impact: data.impact } });
    await recomputeValueScore(req.params.id);
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: req.params.id, action: 'OBJECTIVE_LINKED', diff: { objective: objective.name, impact: data.impact } });
    res.status(201).json(link);
  } catch (e) { next(e); }
});

// Walk an alignment link up to its initiative's tenant for the ownership guard.
async function ownObjectiveLink(id: string, tenantId: string) {
  const l = await prisma.initiativeObjective.findUnique({ where: { id }, include: { initiative: { select: { tenantId: true } }, objective: { select: { name: true } } } });
  return l && l.initiative.tenantId === tenantId ? l : null;
}

router.patch('/initiatives/objectives/:linkId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const link = await ownObjectiveLink(req.params.linkId, req.tenantId);
    if (!link) return res.status(404).json({ error: 'Not found' });
    const data = z.object({ impact: z.number().int().min(1).max(5) }).parse(req.body);
    const updated = await prisma.initiativeObjective.update({ where: { id: req.params.linkId }, data });
    await recomputeValueScore(link.initiativeId);
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: link.initiativeId, action: 'OBJECTIVE_IMPACT_UPDATED', diff: { objective: link.objective.name, impact: { from: link.impact, to: data.impact } } });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/initiatives/objectives/:linkId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const link = await ownObjectiveLink(req.params.linkId, req.tenantId);
    if (!link) return res.status(404).json({ error: 'Not found' });
    await prisma.initiativeObjective.delete({ where: { id: req.params.linkId } });
    await recomputeValueScore(link.initiativeId);
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: link.initiativeId, action: 'OBJECTIVE_UNLINKED', diff: { objective: link.objective.name } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─── Resources (I6) ─────────────────────────────────────────────────────────
}
