/**
 * Shared helpers for the Value-Streams Inspector API — the automatability
 * score map, active-company resolution, tenant-scoped node ownership, and the
 * audit-log convenience wrapper.
 */
import type { Request } from 'express';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';

// ProcessNode.automatability → 1-5 agent-automatability score. Scale (Automatable
// page): 1 Autonomous Agent … 5 Human-only; "automatable" = score ≤ 2. Tokens map
// onto that scale (lower = more AI-automatable). Legacy aliases kept for safety.
export const SCORE_OF: Record<string, number> = {
  autonomous: 1, workflow: 2, augmented: 3, assist: 4, manual: 5,
  automated: 1, assisted: 4, // legacy aliases
};

export async function activeCompany(req: Request) {
  const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  return prisma.company.findFirst({
    where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });
}

// A process node the active company owns, or null. Used to scope every read/write.
export async function ownedNode(req: Request, companyId: string, nodeId: string) {
  return prisma.processNode.findFirst({
    where: { id: nodeId, companyId },
    select: {
      id: true, displayValue: true, isTask: true, automatability: true, parentId: true, code: true, attributes: true,
      processLevelType: { select: { levelNumber: true, displayValue: true } },
    },
  });
}

export const audit = (req: Request, entityType: string, entityId: string, action: string, diff?: unknown) =>
  logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType, entityId, action, diff });

// ── Unified inspector payload ────────────────────────────────────────────────
// Always returns the six-group rollup counts (computed live across the subtree),
// the breadcrumb, the domain (for the accent), and the drill children. At an
// isTask leaf it also returns the node's OWN roles/apps/deliverables/checklist/
// testing for the editable detail view; at a container it returns the top
