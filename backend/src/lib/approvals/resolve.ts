// Approver resolution — RBAC seat rules × ABAC bounded context.
// Two independent tests, both required: the seat rule answers "may this person
// sit approval seats for this kind of decision"; the ABAC filter answers "does
// THIS request fall inside their bounded context" (org-unit subtree ∩
// geography ∩ value streams). The requester is excluded everywhere
// (separation of duties). Pluggable-PDP note: this module is the internal
// implementation of resolveApprovers(); an external entitlements adapter can
// replace it per tenant in a later phase without touching the engine.
import type { ApprovalSeatRule, ApprovalSubjectAttrs } from '@cascade/shared';
import { prisma } from '../../db/prisma.js';

export type SeatResolution = {
  seatKey: string;
  userIds: string[];
  /** Seat filled via the fallback chain, not its primary rule. */
  escalated: boolean;
};

type Candidate = {
  id: string;
  orgUnitId: string | null;
  geography: string | null;
};

const candidateSelect = { id: true, orgUnitId: true, geography: true } as const;

async function seatBaseCandidates(
  tenantId: string,
  requesterId: string,
  rule: ApprovalSeatRule,
  subject: ApprovalSubjectAttrs | null,
): Promise<Candidate[]> {
  const base = { tenantId, status: 'ACTIVE', id: { not: requesterId } };
  switch (rule.kind) {
    case 'MANAGER': {
      const requester = await prisma.user.findUnique({
        where: { id: requesterId },
        select: { reportsToId: true },
      });
      // Explicit self-guard: a reportsTo pointing at the requester (data
      // error) must not become a self-approval seat.
      if (!requester?.reportsToId || requester.reportsToId === requesterId) return [];
      return prisma.user.findMany({
        where: { ...base, id: requester.reportsToId },
        select: candidateSelect,
      });
    }
    case 'ROLES':
      return prisma.user.findMany({
        where: { ...base, isApprover: true, operatingRoleId: { in: rule.roleIds } },
        select: candidateSelect,
      });
    case 'USERS':
      return prisma.user.findMany({
        where: { ...base, id: { in: rule.userIds } },
        select: candidateSelect,
      });
    case 'ENTITY_ROLE': {
      const roleId = subject?.[rule.attr as keyof ApprovalSubjectAttrs];
      if (typeof roleId !== 'string' || !roleId) return [];
      return prisma.user.findMany({
        where: { ...base, isApprover: true, operatingRoleId: roleId },
        select: candidateSelect,
      });
    }
    case 'SITE_ADMINS':
      return prisma.user.findMany({
        where: { ...base, role: 'SITE_ADMIN' },
        select: candidateSelect,
      });
  }
}

/**
 * ABAC bounded-context filter. A candidate passes a dimension when their scope
 * attribute is unset (unbounded) or contains the subject's attribute; a subject
 * attribute that's missing skips that dimension for everyone.
 */
export async function abacFilter(
  candidates: Candidate[],
  subject: ApprovalSubjectAttrs | null,
): Promise<Candidate[]> {
  if (!subject || candidates.length === 0) return candidates;
  let ok = candidates;

  if (subject.geography) {
    ok = ok.filter(
      (c) => !c.geography || c.geography === 'GLOBAL' || c.geography === subject.geography,
    );
  }

  if (subject.orgUnitId && ok.some((c) => c.orgUnitId)) {
    const scoped = ok.filter((c) => c.orgUnitId).map((c) => c.orgUnitId as string);
    const rows = await prisma.orgUnitClosure.findMany({
      where: { descendantId: subject.orgUnitId, ancestorId: { in: scoped } },
      select: { ancestorId: true },
    });
    const ancestors = new Set(rows.map((r) => r.ancestorId));
    ok = ok.filter(
      (c) => !c.orgUnitId || c.orgUnitId === subject.orgUnitId || ancestors.has(c.orgUnitId),
    );
  }

  if (subject.valueStreamNodeId && ok.length > 0) {
    const links = await prisma.userValueStream.findMany({
      where: { userId: { in: ok.map((c) => c.id) } },
      select: { userId: true, processNodeId: true },
    });
    const byUser = new Map<string, Set<string>>();
    for (const l of links) {
      const set = byUser.get(l.userId) ?? new Set<string>();
      set.add(l.processNodeId);
      byUser.set(l.userId, set);
    }
    // No links = unbounded on this dimension.
    ok = ok.filter((c) => {
      const vs = byUser.get(c.id);
      return !vs || vs.size === 0 || vs.has(subject.valueStreamNodeId as string);
    });
  }

  return ok;
}

function seatKeyFor(rule: ApprovalSeatRule): string {
  switch (rule.kind) {
    case 'MANAGER':
      return 'manager';
    case 'SITE_ADMINS':
      return 'site-admins';
    case 'ROLES':
      return `roles:${[...rule.roleIds].sort().join(',')}`;
    case 'USERS':
      return `users:${[...rule.userIds].sort().join(',')}`;
    case 'ENTITY_ROLE':
      return `entity-role:${rule.attr}`;
  }
}

/**
 * Resolve one stage's seats to concrete approver candidates. Empty seats walk
 * the fallback chain (primary rule → MANAGER → SITE_ADMINS) and are flagged
 * `escalated`; a seat that is empty even after fallback is returned with zero
 * userIds so the caller can surface the coverage gap rather than stall silently.
 */
export async function resolveStageSeats(
  tenantId: string,
  requesterId: string,
  seats: ApprovalSeatRule[],
  subject: ApprovalSubjectAttrs | null,
): Promise<SeatResolution[]> {
  const out: SeatResolution[] = [];
  for (const rule of seats) {
    const seatKey = seatKeyFor(rule);
    let escalated = false;
    let candidates = await abacFilter(
      await seatBaseCandidates(tenantId, requesterId, rule, subject),
      subject,
    );
    if (candidates.length === 0 && rule.kind !== 'MANAGER' && rule.kind !== 'SITE_ADMINS') {
      escalated = true;
      candidates = await abacFilter(
        await seatBaseCandidates(tenantId, requesterId, { kind: 'MANAGER' }, subject),
        subject,
      );
    }
    if (candidates.length === 0 && rule.kind !== 'SITE_ADMINS') {
      escalated = true;
      // Deliberately NOT abac-filtered: SITE_ADMINS is the last-resort net.
      candidates = await seatBaseCandidates(
        tenantId,
        requesterId,
        { kind: 'SITE_ADMINS' },
        subject,
      );
    }
    out.push({ seatKey, userIds: candidates.map((c) => c.id), escalated });
  }
  return out;
}
