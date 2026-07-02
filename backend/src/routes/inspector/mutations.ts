/**
 * Inspector writes — role links (NodeRole), application usages (NodeAppUsage),
 * checklist items, deliverable links, and the testing-template PUT. Every
 * write lands on the canonical junction/entity; audited via services/audit.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { streamAncestry } from '../../lib/resolvers/index.js';
import { activeCompany, ownedNode, audit } from './helpers.js';

/** Registers the inspector mutation routes on the shared router (order preserved). */
export function registerMutationRoutes(router: Router): void {
async function rolePropagation(roleId: string) {
  const links = await prisma.nodeRole.findMany({ where: { roleId }, select: { processNodeId: true } });
  const anc = await streamAncestry(links.map((l) => l.processNodeId));
  const streams = new Set<string>();
  for (const a of anc.values()) if (a.valueStreamId) streams.add(a.valueStreamId);
  return { places: ['Org chart'], streams: streams.size };
}

// ── Roles (associate existing / add new · Owner|Participant + RACI · detach) ──
const roleBody = z.object({
  roleId: z.string().optional(),
  newRoleName: z.string().min(1).optional(),
  relation: z.enum(['Owner', 'Participant']).default('Participant'),
  raci: z.string().optional(),
}).refine((b) => b.roleId || b.newRoleName, { message: 'roleId or newRoleName required' });

router.post('/:nodeId/roles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const node = await ownedNode(req, company.id, req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Not found' });
    const body = roleBody.parse(req.body);

    let roleId = body.roleId;
    let created = false;
    if (!roleId) {
      const role = await prisma.role.create({
        data: { companyId: company.id, dbValue: body.newRoleName!, displayValue: body.newRoleName! },
        select: { id: true },
      });
      roleId = role.id; created = true;
      await audit(req, 'Role', roleId, 'create', { displayValue: body.newRoleName });
    } else {
      const owned = await prisma.role.findFirst({ where: { id: roleId, companyId: company.id }, select: { id: true } });
      if (!owned) return res.status(404).json({ error: 'Role not found' });
    }

    // One canonical NodeRole (processNodeId, roleId, role_); RACI on ownerLevel.
    const link = await prisma.nodeRole.upsert({
      where: { processNodeId_roleId_role_: { processNodeId: node.id, roleId: roleId!, role_: body.relation } },
      update: { ownerLevel: body.raci ?? null },
      create: { companyId: company.id, processNodeId: node.id, roleId: roleId!, role_: body.relation, ownerLevel: body.raci ?? null },
      select: { id: true, role_: true, ownerLevel: true, role: { select: { id: true, displayValue: true } } },
    });
    await audit(req, 'NodeRole', link.id, 'associate', { processNodeId: node.id, roleId, relation: body.relation });
    const propagation = await rolePropagation(roleId!);
    res.status(201).json({
      role: { nodeRoleId: link.id, roleId: link.role.id, name: link.role.displayValue, relation: link.role_, raci: link.ownerLevel },
      created, propagation,
    });
  } catch (e) { next(e); }
});

router.patch('/roles/:nodeRoleId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const existing = await prisma.nodeRole.findFirst({ where: { id: req.params.nodeRoleId, companyId: company.id }, select: { id: true, processNodeId: true, roleId: true, role_: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const body = z.object({ relation: z.enum(['Owner', 'Participant']).optional(), raci: z.string().nullable().optional() }).parse(req.body);

    const link = await prisma.nodeRole.update({
      where: { id: existing.id },
      data: { ...(body.relation ? { role_: body.relation } : {}), ...(body.raci !== undefined ? { ownerLevel: body.raci } : {}) },
      select: { id: true, role_: true, ownerLevel: true, role: { select: { id: true, displayValue: true } } },
    });
    await audit(req, 'NodeRole', link.id, 'update', body);
    res.json({ role: { nodeRoleId: link.id, roleId: link.role.id, name: link.role.displayValue, relation: link.role_, raci: link.ownerLevel } });
  } catch (e) { next(e); }
});

router.delete('/roles/:nodeRoleId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const existing = await prisma.nodeRole.findFirst({ where: { id: req.params.nodeRoleId, companyId: company.id }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.nodeRole.delete({ where: { id: existing.id } });
    await audit(req, 'NodeRole', existing.id, 'detach');
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Applications (associate existing / add new · usage · detach) ─────────────
const appBody = z.object({
  applicationId: z.string().optional(),
  newAppName: z.string().min(1).optional(),
  usageType: z.enum(['performed', 'memorialized']).default('performed'),
}).refine((b) => b.applicationId || b.newAppName, { message: 'applicationId or newAppName required' });

router.post('/:nodeId/applications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const node = await ownedNode(req, company.id, req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Not found' });
    const body = appBody.parse(req.body);

    let appId = body.applicationId;
    let created = false;
    if (!appId) {
      const app = await prisma.application.create({
        data: { companyId: company.id, name: body.newAppName!, kind: 'Tool', illustrative: true },
        select: { id: true },
      });
      appId = app.id; created = true;
      await audit(req, 'Application', appId, 'create', { name: body.newAppName });
    } else {
      const owned = await prisma.application.findFirst({ where: { id: appId, companyId: company.id }, select: { id: true } });
      if (!owned) return res.status(404).json({ error: 'Application not found' });
    }

    const link = await prisma.nodeAppUsage.upsert({
      where: { processNodeId_applicationId_usageType: { processNodeId: node.id, applicationId: appId!, usageType: body.usageType } },
      update: {},
      create: { companyId: company.id, processNodeId: node.id, applicationId: appId!, usageType: body.usageType },
      select: { id: true, usageType: true, application: { select: { id: true, name: true } } },
    });
    await audit(req, 'NodeAppUsage', link.id, 'associate', { processNodeId: node.id, applicationId: appId, usageType: body.usageType });
    res.status(201).json({
      application: { usageId: link.id, appId: link.application.id, name: link.application.name, usageType: link.usageType },
      created, propagation: { places: ['Applications catalog'], streams: 0 },
    });
  } catch (e) { next(e); }
});

router.patch('/applications/:usageId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const existing = await prisma.nodeAppUsage.findFirst({ where: { id: req.params.usageId, companyId: company.id }, select: { id: true, processNodeId: true, applicationId: true, usageType: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const body = z.object({ usageType: z.enum(['performed', 'memorialized']) }).parse(req.body);
    if (body.usageType === existing.usageType) {
      const link = await prisma.nodeAppUsage.findUnique({ where: { id: existing.id }, select: { id: true, usageType: true, application: { select: { id: true, name: true } } } });
      return res.json({ application: { usageId: link!.id, appId: link!.application.id, name: link!.application.name, usageType: link!.usageType } });
    }
    // The unique key includes usageType, so re-key by delete+create (idempotent).
    await prisma.nodeAppUsage.delete({ where: { id: existing.id } });
    const link = await prisma.nodeAppUsage.upsert({
      where: { processNodeId_applicationId_usageType: { processNodeId: existing.processNodeId, applicationId: existing.applicationId, usageType: body.usageType } },
      update: {},
      create: { companyId: company.id, processNodeId: existing.processNodeId, applicationId: existing.applicationId, usageType: body.usageType },
      select: { id: true, usageType: true, application: { select: { id: true, name: true } } },
    });
    await audit(req, 'NodeAppUsage', link.id, 'update', { usageType: body.usageType });
    res.json({ application: { usageId: link.id, appId: link.application.id, name: link.application.name, usageType: link.usageType } });
  } catch (e) { next(e); }
});

router.delete('/applications/:usageId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const existing = await prisma.nodeAppUsage.findFirst({ where: { id: req.params.usageId, companyId: company.id }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.nodeAppUsage.delete({ where: { id: existing.id } });
    await audit(req, 'NodeAppUsage', existing.id, 'detach');
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Checklist items (add / edit text / remove) ───────────────────────────────
// A ChecklistItem must live in a Checklist container; we keep one per company
// ("Process checklist") so a step's item is a real, shared ChecklistItem the
// rest of the app reads. NodeChecklist binds it to the step.
async function defaultChecklistId(companyId: string) {
  const found = await prisma.checklist.findFirst({ where: { companyId, name: 'Process checklist' }, select: { id: true } });
  if (found) return found.id;
  const created = await prisma.checklist.create({ data: { companyId, name: 'Process checklist' }, select: { id: true } });
  return created.id;
}

router.post('/:nodeId/checklist', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const node = await ownedNode(req, company.id, req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Not found' });
    const body = z.object({ text: z.string().min(1) }).parse(req.body);

    const checklistId = await defaultChecklistId(company.id);
    const item = await prisma.checklistItem.create({ data: { checklistId, text: body.text }, select: { id: true, text: true } });
    const link = await prisma.nodeChecklist.create({
      data: { companyId: company.id, processNodeId: node.id, checklistItemId: item.id },
      select: { id: true },
    });
    await audit(req, 'ChecklistItem', item.id, 'create', { processNodeId: node.id, text: body.text });
    res.status(201).json({ item: { nodeChecklistId: link.id, checklistItemId: item.id, text: item.text } });
  } catch (e) { next(e); }
});

router.patch('/checklist/:checklistItemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    // scope: the item must be linked to a node this company owns.
    const link = await prisma.nodeChecklist.findFirst({ where: { checklistItemId: req.params.checklistItemId, companyId: company.id }, select: { id: true } });
    if (!link) return res.status(404).json({ error: 'Not found' });
    const body = z.object({ text: z.string().min(1) }).parse(req.body);
    const item = await prisma.checklistItem.update({ where: { id: req.params.checklistItemId }, data: { text: body.text }, select: { id: true, text: true } });
    await audit(req, 'ChecklistItem', item.id, 'update', body);
    res.json({ item: { checklistItemId: item.id, text: item.text } });
  } catch (e) { next(e); }
});

router.delete('/checklist/:nodeChecklistId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const link = await prisma.nodeChecklist.findFirst({ where: { id: req.params.nodeChecklistId, companyId: company.id }, select: { id: true, checklistItemId: true } });
    if (!link) return res.status(404).json({ error: 'Not found' });
    await prisma.nodeChecklist.delete({ where: { id: link.id } });
    // The item is step-specific (created here), so remove it too unless shared.
    const otherLinks = await prisma.nodeChecklist.count({ where: { checklistItemId: link.checklistItemId } });
    if (otherLinks === 0) await prisma.checklistItem.delete({ where: { id: link.checklistItemId } }).catch(() => {});
    await audit(req, 'NodeChecklist', link.id, 'remove');
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Deliverables (associate existing / add new · detach) ─────────────────────
const delivBody = z.object({
  deliverableId: z.string().optional(),
  newTitle: z.string().min(1).optional(),
}).refine((b) => b.deliverableId || b.newTitle, { message: 'deliverableId or newTitle required' });

router.post('/:nodeId/deliverables', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const node = await ownedNode(req, company.id, req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Not found' });
    const body = delivBody.parse(req.body);

    let deliverableId = body.deliverableId;
    let created = false;
    if (!deliverableId) {
      const d = await prisma.deliverable.create({ data: { companyId: company.id, title: body.newTitle! }, select: { id: true } });
      deliverableId = d.id; created = true;
      await audit(req, 'Deliverable', deliverableId, 'create', { title: body.newTitle });
    } else {
      const owned = await prisma.deliverable.findFirst({ where: { id: deliverableId, companyId: company.id }, select: { id: true } });
      if (!owned) return res.status(404).json({ error: 'Deliverable not found' });
    }

    const link = await prisma.nodeDeliverable.upsert({
      where: { processNodeId_deliverableId: { processNodeId: node.id, deliverableId: deliverableId! } },
      update: {},
      create: { companyId: company.id, processNodeId: node.id, deliverableId: deliverableId! },
      select: { id: true, deliverable: { select: { id: true, title: true } } },
    });
    await audit(req, 'NodeDeliverable', link.id, 'associate', { processNodeId: node.id, deliverableId });
    res.status(201).json({ deliverable: { linkId: link.id, deliverableId: link.deliverable.id, title: link.deliverable.title }, created });
  } catch (e) { next(e); }
});

router.delete('/deliverables/:linkId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const link = await prisma.nodeDeliverable.findFirst({ where: { id: req.params.linkId, companyId: company.id }, select: { id: true } });
    if (!link) return res.status(404).json({ error: 'Not found' });
    await prisma.nodeDeliverable.delete({ where: { id: link.id } });
    await audit(req, 'NodeDeliverable', link.id, 'detach');
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Testing template (edit System / Location / Check / Expected) ─────────────
// PRIMARY tie is a Deliverable; we tie the row to the step (taskNodeId) and to
// the step's first deliverable, creating a deliverable for the step if it has
// none (so the canonical TestingTemplate always has its required deliverable).
router.put('/:nodeId/testing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const node = await ownedNode(req, company.id, req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Not found' });
    const body = z.object({
      system: z.string().optional().nullable(),
      location: z.string().optional().nullable(),
      checkType: z.enum(['presence', 'absence']).optional().nullable(),
      expected: z.string().optional().nullable(),
    }).parse(req.body);

    const existing = await prisma.testingTemplate.findFirst({ where: { taskNodeId: node.id }, select: { id: true } });
    if (existing) {
      const row = await prisma.testingTemplate.update({
        where: { id: existing.id },
        data: { system: body.system ?? null, location: body.location ?? null, checkType: body.checkType ?? null, expected: body.expected ?? null },
        select: { id: true, deliverableId: true, system: true, location: true, checkType: true, expected: true },
      });
      await audit(req, 'TestingTemplate', row.id, 'update', body);
      return res.json({ testing: { ...row } });
    }

    // No template yet — resolve (or create) a deliverable for the step.
    let deliverableId: string | null = (await prisma.nodeDeliverable.findFirst({ where: { processNodeId: node.id, companyId: company.id }, select: { deliverableId: true } }))?.deliverableId ?? null;
    if (!deliverableId) {
      const d = await prisma.deliverable.create({ data: { companyId: company.id, title: node.displayValue }, select: { id: true } });
      deliverableId = d.id;
      await prisma.nodeDeliverable.create({ data: { companyId: company.id, processNodeId: node.id, deliverableId } });
      await audit(req, 'Deliverable', deliverableId, 'create', { title: node.displayValue, reason: 'testing-template' });
    }
    const row = await prisma.testingTemplate.create({
      data: { deliverableId, taskNodeId: node.id, system: body.system ?? null, location: body.location ?? null, checkType: body.checkType ?? null, expected: body.expected ?? null },
      select: { id: true, deliverableId: true, system: true, location: true, checkType: true, expected: true },
    });
    await audit(req, 'TestingTemplate', row.id, 'create', body);
    res.status(201).json({ testing: { ...row } });
  } catch (e) { next(e); }
});
}
