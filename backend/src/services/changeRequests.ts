// Change-request update — the single write path used by BOTH the direct
// PATCH /portfolio/change-requests/:cid route and the approval-framework
// replay (DA-12). Tenancy is verified here so replayed payloads get the same
// guarantees as live requests.
import { prisma } from '../db/prisma.js';
import { logAudit, computeDiff } from './audit.js';

export type ChangeRequestPatch = {
  title?: string;
  description?: string;
  raisedBy?: string;
  costImpact?: number;
  scheduleImpactDays?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
};

export async function applyChangeRequestUpdate(
  tenantId: string,
  cid: string,
  data: ChangeRequestPatch,
  actorEmail: string,
) {
  const existing = await prisma.changeRequest.findUnique({
    where: { id: cid },
    include: { initiative: { select: { tenantId: true } } },
  });
  if (!existing || existing.initiative.tenantId !== tenantId) {
    throw Object.assign(new Error('Not found'), { status: 404 });
  }
  const updated = await prisma.changeRequest.update({ where: { id: cid }, data });
  logAudit({
    tenantId,
    actorEmail,
    entityType: 'PortfolioInitiative',
    entityId: existing.initiativeId,
    action: 'CHANGE_REQUEST_UPDATED',
    diff: { changeRequest: existing.title, ...computeDiff(existing, data, Object.keys(data)) },
  });
  return updated;
}
