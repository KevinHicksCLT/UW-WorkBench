/**
 * Program + workstream CRUD and per-program summary/health rollups.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit, computeDiff } from '../../services/audit.js';
import { summarizeProgram } from '../../services/portfolioRollup.js';
import { activeCompanyId, withHealthRollup, resolveLinks, withLinkNames } from './helpers.js';

/** Registers this feature's routes on the shared /portfolio router (order preserved). */
export function registerProgramRoutes(router: Router): void {
router.get('/programs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const programs = await prisma.program.findMany({
      where: { tenantId: req.tenantId, companyId },
      include: {
        workstreams: { include: { initiatives: { select: { id: true, status: true, stage: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(programs.map((p) => withHealthRollup(p)));
  } catch (e) { next(e); }
});

router.get('/programs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const program = await prisma.program.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { workstreams: { include: { initiatives: true } } },
    });
    if (!program) return res.status(404).json({ error: 'Not found' });
    const allInits = program.workstreams.flatMap((w) => w.initiatives);
    const maps = await resolveLinks(allInits);
    const rolled = withHealthRollup(program);
    res.json({
      ...rolled,
      workstreams: rolled.workstreams.map((w) => ({
        ...w,
        initiatives: w.initiatives.map((i) => withLinkNames(i, maps)),
      })),
    });
  } catch (e) { next(e); }
});

router.get('/programs/:id/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const program = await prisma.program.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } });
    if (!program) return res.status(404).json({ error: 'Not found' });
    const summary = await summarizeProgram(req.params.id);
    res.json(summary);
  } catch (e) { next(e); }
});

const programCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
});

router.post('/programs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const data = programCreateSchema.parse(req.body);
    const program = await prisma.program.create({
      data: {
        tenantId: req.tenantId,
        companyId,
        name: data.name,
        description: data.description,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Program', entityId: program.id, action: 'PROGRAM_CREATED', diff: { program: data.name } });
    res.status(201).json(program);
  } catch (e) { next(e); }
});

const programUpdateSchema = programCreateSchema.partial().extend({
  status: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).optional(),
  statusNote: z.string().optional(),
});

router.patch('/programs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.program.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = programUpdateSchema.parse(req.body);
    const patch: Record<string, unknown> = { ...data };
    if (data.startDate) patch.startDate = new Date(data.startDate);
    if (data.endDate) patch.endDate = new Date(data.endDate);
    const updated = await prisma.program.update({ where: { id: req.params.id }, data: patch });
    logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'Program', entityId: req.params.id, action: 'PROGRAM_UPDATED',
      diff: { program: existing.name, ...computeDiff(existing, data, Object.keys(data)) },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/programs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.program.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { name: true } });
    const r = await prisma.program.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (r.count === 0) return res.status(404).json({ error: 'Not found' });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Program', entityId: req.params.id, action: 'PROGRAM_DELETED', diff: { program: existing?.name } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─── Workstreams ───────────────────────────────────────────────────────────
const workstreamCreateSchema = z.object({
  programId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
});

router.post('/workstreams', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = workstreamCreateSchema.parse(req.body);
    const program = await prisma.program.findFirst({ where: { id: data.programId, tenantId: req.tenantId }, select: { id: true, companyId: true } });
    if (!program) return res.status(404).json({ error: 'Program not found' });
    const ws = await prisma.workstream.create({
      data: { tenantId: req.tenantId, companyId: program.companyId, programId: data.programId, name: data.name, description: data.description },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Workstream', entityId: ws.id, action: 'WORKSTREAM_CREATED', diff: { workstream: data.name } });
    res.status(201).json(ws);
  } catch (e) { next(e); }
});

router.patch('/workstreams/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.workstream.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).optional(),
      statusNote: z.string().optional(),
    }).parse(req.body);
    const updated = await prisma.workstream.update({ where: { id: req.params.id }, data });
    logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'Workstream', entityId: req.params.id, action: 'WORKSTREAM_UPDATED',
      diff: { workstream: existing.name, ...computeDiff(existing, data, Object.keys(data)) },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/workstreams/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.workstream.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { name: true } });
    const r = await prisma.workstream.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (r.count === 0) return res.status(404).json({ error: 'Not found' });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Workstream', entityId: req.params.id, action: 'WORKSTREAM_DELETED', diff: { workstream: existing?.name } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─── Initiatives ───────────────────────────────────────────────────────────
}
