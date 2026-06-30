import { prisma } from '../db/prisma.js';

// App-layer tenant scoping. Every spine table carries `tenantId`, so scoping is
// a direct filter (no relation traversal). Helpers return null on a missing or
// cross-tenant id, which callers turn into a 404 (never 403 — don't reveal
// existence across tenants). `tenantId` always comes from the JWT, never the body.

export const tenantCompany = (id: string, tenantId: string) =>
  prisma.company.findFirst({ where: { id, tenantId } });
