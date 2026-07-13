/**
 * Task agent-skill packs. A task's plan (checklist + testing, generic + specific,
 * plus tied standards/regulations and their evidence) is compiled once, on click,
 * into a SKILL.md an autonomous agent can follow. The pack is persisted as a
 * SkillFile row (skill = task-<id>, path = SKILL.md) and pointed to by
 * ProcessNode.agentSkill, so it is preserved and editable after generation.
 * Read model + digest live in lib/taskSkillPack.ts; the task plan comes from
 * lib/workPlan.ts (the same rows the Work Library page and Inspector render).
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { ancestorNames } from '../../lib/resolvers/index.js';
import { taskPlans } from '../../lib/workPlan.js';
import {
  taskSkillSlug,
  authorTaskSkill,
  TASK_SKILL_FILE,
  type TaskSkillMeta,
} from '../../lib/taskSkillPack.js';
import { findSubject } from './helpers.js';

const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

// Load the pack's SkillFile rows for a task (empty when never generated).
async function loadPack(companyId: string, nodeId: string) {
  const slug = taskSkillSlug(nodeId);
  const files = await prisma.skillFile.findMany({
    where: { companyId, skill: slug },
    orderBy: { path: 'asc' },
    select: { path: true, content: true, bytes: true, updatedAt: true },
  });
  return { slug, files };
}

// Resolve the task's Owner-role title for the digest (best-effort).
async function ownerTitle(nodeId: string): Promise<string | null> {
  const owner = await prisma.nodeRole.findFirst({
    where: { processNodeId: nodeId, role_: 'Owner' },
    select: { role: { select: { displayValue: true } } },
  });
  return owner?.role?.displayValue ?? null;
}

/** Registers the task agent-skill routes on the shared /work-library router. */
export function registerSkillRoutes(router: Router): void {
  // GET /work-library/plan/task/:id/skill — current pack state (may be empty).
  router.get('/plan/task/:id/skill', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subject = await findSubject('task', req.params.id, req.tenantId);
      if (!subject) return res.status(404).json({ error: 'Task not found' });
      const node = await prisma.processNode.findUnique({
        where: { id: subject.id },
        select: { agentSkill: true, agentSkillGeneratedAt: true },
      });
      const { slug, files } = await loadPack(subject.companyId, subject.id);
      res.json({
        slug,
        exists: files.length > 0,
        generatedAt: node?.agentSkillGeneratedAt ?? null,
        files: files.map((f) => ({ path: f.path, content: f.content, bytes: f.bytes })),
      });
    } catch (e) {
      next(e);
    }
  });

  // POST /work-library/plan/task/:id/skill/generate — compile the plan into a
  // SKILL.md via Claude, persist it, and stamp the pointer. Regenerating
  // overwrites the pack (edits are lost — the UI warns before regenerating).
  router.post(
    '/plan/task/:id/skill/generate',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const subject = await findSubject('task', req.params.id, req.tenantId);
        if (!subject) return res.status(404).json({ error: 'Task not found' });

        const [planMap, ancMap, owner] = await Promise.all([
          taskPlans([subject.id], { includeTied: true }),
          ancestorNames([subject.id]),
          ownerTitle(subject.id),
        ]);
        const plan = planMap.get(subject.id);
        if (!plan) return res.status(404).json({ error: 'Task plan not found' });

        const a = ancMap.get(subject.id);
        const meta: TaskSkillMeta = {
          name: (subject as { displayValue: string }).displayValue,
          path: [a?.valueStreamName, a?.l3, a?.l4].filter(Boolean).join(' › '),
          description: (subject as { description: string | null }).description,
          owner,
        };

        const skillMd = await authorTaskSkill(meta, plan);
        const slug = taskSkillSlug(subject.id);

        // Upsert SKILL.md, stamp the pointer + timestamp on the task.
        await prisma.$transaction([
          prisma.skillFile.upsert({
            where: {
              companyId_skill_path: {
                companyId: subject.companyId,
                skill: slug,
                path: TASK_SKILL_FILE,
              },
            },
            create: {
              companyId: subject.companyId,
              skill: slug,
              path: TASK_SKILL_FILE,
              content: skillMd,
              bytes: bytes(skillMd),
            },
            update: { content: skillMd, bytes: bytes(skillMd) },
          }),
          prisma.processNode.update({
            where: { id: subject.id },
            data: { agentSkill: slug, agentSkillGeneratedAt: new Date() },
          }),
        ]);

        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'SkillFile',
          entityId: `${slug}/${TASK_SKILL_FILE}`,
          action: 'CREATE',
          diff: { generated: true, bytes: skillMd.length },
        });

        const { files } = await loadPack(subject.companyId, subject.id);
        res.json({
          slug,
          exists: true,
          generatedAt: new Date(),
          files: files.map((f) => ({ path: f.path, content: f.content, bytes: f.bytes })),
        });
      } catch (e) {
        next(e);
      }
    },
  );

  // PUT /work-library/plan/task/:id/skill/file — save an edit to a pack file so
  // the generated skill can be refined by hand and preserved.
  router.put(
    '/plan/task/:id/skill/file',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const subject = await findSubject('task', req.params.id, req.tenantId);
        if (!subject) return res.status(404).json({ error: 'Task not found' });
        const path = typeof req.body?.path === 'string' ? req.body.path : '';
        const content = req.body?.content;
        if (!path) return res.status(400).json({ error: 'Invalid file path' });
        if (typeof content !== 'string')
          return res.status(400).json({ error: 'content (string) is required' });

        const slug = taskSkillSlug(subject.id);
        const existing = await prisma.skillFile.findUnique({
          where: { companyId_skill_path: { companyId: subject.companyId, skill: slug, path } },
          select: { id: true },
        });
        if (!existing) return res.status(404).json({ error: 'File not found — generate first' });

        await prisma.skillFile.update({
          where: { id: existing.id },
          data: { content, bytes: bytes(content) },
        });
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'SkillFile',
          entityId: `${slug}/${path}`,
          action: 'UPDATE',
          diff: { bytes: content.length },
        });
        res.json({ path, bytes: content.length });
      } catch (e) {
        next(e);
      }
    },
  );
}
