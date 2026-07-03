// Shared guard logic for the /users feature module — the privilege-escalation
// and org-scope rules that manual CRUD (manage.ts) and spreadsheet import
// (import.ts) must apply identically.
import type { Request } from 'express';
import { DOMAIN_ADMIN_ASSIGNABLE, isUserAdminType, type UserType } from '@cascade/shared';

/** Prisma include shape the Users sheet consumes (labels, never raw FKs only). */
export const USER_LIST_INCLUDE = {
  orgUnit: { select: { id: true, displayValue: true } },
  operatingRole: { select: { id: true, displayValue: true } },
  valueStreams: { select: { processNode: { select: { id: true, displayValue: true } } } },
} as const;

export type EscalationCheckInput = {
  /** Role being assigned (absent on PATCHes that don't touch the role). */
  role?: string;
  /** Org unit being assigned; null clears it. */
  orgUnitId?: string | null;
  /** Whether the payload carries orgUnitId at all. */
  orgUnitProvided: boolean;
};

/**
 * Escalation/scope guard for user writes. SITE_ADMIN (scope 'all') is
 * unrestricted. A domain admin may only assign DOMAIN_ADMIN_ASSIGNABLE roles
 * and may only home users at org units inside their administrable subtree —
 * which also means they cannot create/move a user to "no org unit" (that
 * would place the user outside every domain admin's reach).
 * Returns an error message, or null when allowed.
 */
export function escalationError(req: Request, input: EscalationCheckInput): string | null {
  const scope = req.userAdminScope;
  if (scope === 'all' || scope === undefined) return null;

  if (input.role !== undefined && !DOMAIN_ADMIN_ASSIGNABLE.includes(input.role as UserType)) {
    return `Domain admins may only assign: ${DOMAIN_ADMIN_ASSIGNABLE.join(', ')}`;
  }
  if (input.orgUnitProvided) {
    if (!input.orgUnitId || !scope.orgUnitIds.includes(input.orgUnitId)) {
      return 'orgUnitId must be inside your administrable organization scope';
    }
  }
  return null;
}

/** True when a domain admin may not edit this target (target is an admin type). */
export function targetIsProtectedFrom(req: Request, targetRole: string): boolean {
  return req.userAdminScope !== 'all' && isUserAdminType(targetRole);
}
