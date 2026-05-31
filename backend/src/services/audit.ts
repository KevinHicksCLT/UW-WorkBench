import { prisma } from '../db/prisma.js';

type AuditInput = {
  tenantId: string;
  actorEmail: string;
  entityType: string;
  entityId: string;
  action: string;
  diff?: unknown;
};

export async function logAudit({ tenantId, actorEmail, entityType, entityId, action, diff }: AuditInput) {
  try {
    await prisma.auditEntry.create({
      data: {
        tenantId,
        actorEmail,
        entityType,
        entityId,
        action,
        diff: diff ? JSON.stringify(diff) : null,
      },
    });
  } catch (e) {
    console.error('Audit log failed:', (e as Error).message);
  }
}
