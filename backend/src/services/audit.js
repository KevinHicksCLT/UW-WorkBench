import { prisma } from '../db/prisma.js';

export async function logAudit({ tenantId, actorEmail, entityType, entityId, action, diff }) {
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
    console.error('Audit log failed:', e.message);
  }
}
