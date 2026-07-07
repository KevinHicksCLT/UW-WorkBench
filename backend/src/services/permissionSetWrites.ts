// Permission-set grant replacement — the single write path used by BOTH the
// direct PUT /permission-sets/:userType route and the approval-framework
// replay (DA-01 four-eyes).
import type { PermissionGrantInput } from '@cascade/shared';
import { prisma } from '../db/prisma.js';
import { logAudit } from './audit.js';
import { invalidateTenantPermissions } from './permissionService.js';

export async function replacePermissionSetGrants(
  tenantId: string,
  userType: string,
  grants: PermissionGrantInput[],
  actorEmail: string,
) {
  const set = await prisma.permissionSet.upsert({
    where: { tenantId_userType: { tenantId, userType } },
    update: {},
    create: { tenantId, userType },
  });

  await prisma.$transaction(async (tx) => {
    await tx.permissionGrant.deleteMany({ where: { permissionSetId: set.id } });
    if (grants.length > 0) {
      await tx.permissionGrant.createMany({
        data: grants.map((g) => ({
          permissionSetId: set.id,
          menuKey: g.menuKey,
          canCreate: g.canCreate,
          canRead: g.canRead,
          canUpdate: g.canUpdate,
          canDelete: g.canDelete,
        })),
      });
    }
  });
  invalidateTenantPermissions(tenantId);

  await logAudit({
    tenantId,
    actorEmail,
    entityType: 'PermissionSet',
    entityId: set.id,
    action: 'UPDATE',
    diff: { userType, menuKeys: grants.map((g) => g.menuKey) },
  });

  return prisma.permissionSet.findUnique({ where: { id: set.id }, include: { grants: true } });
}
