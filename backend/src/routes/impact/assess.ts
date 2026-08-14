// POST /impact/assess — the cross-lens change-impact assessment. One endpoint,
// four subject kinds (process nodes, role, application, product element); the
// response is a single prioritized ImpactReport the workspace shows BEFORE a
// normalize/rationalize decision is applied. POST because subjects carry id
// arrays; the report is a pure read — nothing is written.
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { activeCompany } from '../explorer/helpers.js';
import { ALL_CHANGE_TYPES, type ImpactReport } from './types.js';
import { assessProcessNodes } from './processNodes.js';
import { assessRole } from './role.js';
import { assessApplication } from './application.js';
import { assessProduct } from './product.js';
import { assessDeliverable } from './deliverable.js';
import { assessPlan } from './plan.js';

const id = z.string().trim().min(1);
/** Shared with /impact/analyze — the AI deep-dive takes the same subject. */
export const subjectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('process-nodes'), nodeIds: z.array(id).min(1).max(200) }),
  z.object({ kind: z.literal('role'), roleId: id, taskIds: z.array(id).max(500).optional() }),
  z.object({
    kind: z.literal('application'),
    applicationIds: z.array(id).max(50).optional(),
    rationalizationAppIds: z.array(id).max(50).optional(),
  }),
  z.object({
    kind: z.literal('product-element'),
    lobId: id,
    component: z.string().trim().min(1).max(300),
    elementName: z.string().trim().max(300).optional(),
    componentNodeIds: z.array(id).max(100).optional(),
  }),
  z.object({ kind: z.literal('deliverable'), deliverableIds: z.array(id).min(1).max(50) }),
  z.object({
    kind: z.literal('plan'),
    programId: id.optional(),
    workstreamId: id.optional(),
    initiativeId: id.optional(),
  }),
]);
const bodySchema = z.object({
  // Accepts every token across all lens taxonomies; the walkers map each onto
  // the shared changeClass machinery (Change Impact v2, Workstream A).
  changeType: z.enum(ALL_CHANGE_TYPES),
  label: z.string().trim().max(300).optional(),
  subject: subjectSchema,
});

export function registerAssessRoutes(router: Router): void {
  router.post('/assess', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = bodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      }
      const company = await activeCompany(req, { id: true });
      if (!company) return res.status(404).json({ error: 'No company' });

      const { changeType, label, subject } = parsed.data;
      let report: ImpactReport | null = null;
      if (subject.kind === 'process-nodes') {
        report = await assessProcessNodes(company.id, subject.nodeIds, changeType, label);
      } else if (subject.kind === 'role') {
        report = await assessRole(company.id, subject.roleId, subject.taskIds, changeType, label);
      } else if (subject.kind === 'application') {
        report = await assessApplication(company.id, subject, changeType, label);
      } else if (subject.kind === 'deliverable') {
        report = await assessDeliverable(company.id, subject.deliverableIds, changeType, label);
      } else if (subject.kind === 'plan') {
        report = await assessPlan(company.id, subject, changeType, label);
      } else {
        report = await assessProduct(company.id, subject, changeType, label);
      }
      if (!report) return res.status(404).json({ error: 'Subject not found' });
      res.json(report);
    } catch (e) {
      next(e);
    }
  });
}
