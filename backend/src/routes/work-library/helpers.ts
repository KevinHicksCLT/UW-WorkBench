/**
 * Shared helpers for the Work Library API — subject-type parsing, active
 * company resolution, tenant-scoped subject lookup (task / standard /
 * regulation), and the saved-answer include/shape helpers.
 */
import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma.js';

export type SubjectType = 'task' | 'standard' | 'regulation';
export const SUBJECT_TYPES: SubjectType[] = ['task', 'standard', 'regulation'];

export function parseType(raw: string, res: Response): SubjectType | null {
  if ((SUBJECT_TYPES as string[]).includes(raw)) return raw as SubjectType;
  res.status(404).json({ error: 'Unknown subject type' });
  return null;
}

export async function activeCompanyId(req: Request, res: Response): Promise<string | null> {
  const company = await prisma.company.findFirst({
    where: { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!company) { res.status(404).json({ error: 'No company found' }); return null; }
  return company.id;
}

// Verify the subject row exists inside the tenant; 404 otherwise.
export async function findSubject(type: SubjectType, id: string, tenantId: string) {
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

export const valueInclude = {
  application: { select: { id: true, name: true } },
  role: { select: { id: true, displayValue: true } },
  deliverable: { select: { id: true, title: true } },
} as const;

/** The saved-answer row shape every answer table shares (with valueInclude joins). */
export type AnswerRecord = {
  id: string;
  templateKeyId: string | null;
  customKey: string | null;
  kind: string | null;
  value: string | null;
  suppressed: boolean;
  sortOrder: number | null;
  application: { id: string; name: string } | null;
  role: { id: string; displayValue: string } | null;
  deliverable: { id: string; title: string } | null;
};

export const answerShape = (a: AnswerRecord) => ({
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
