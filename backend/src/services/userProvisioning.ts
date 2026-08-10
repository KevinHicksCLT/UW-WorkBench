// The SINGLE user write path — manual admin CRUD (routes/users/manage),
// spreadsheet import (routes/users/import), the REST provisioning surface
// (routes/provisioning/users), and inbound IAM webhooks (routes/provisioning/
// webhook) all funnel through upsertUser/deactivateUser here.
//
// Audit action scheme: manual writes log CREATE / UPDATE / DEACTIVATE;
// non-interactive sources prefix the same verbs — IMPORT_CREATE, IMPORT_UPDATE,
// PROVISION_CREATE, PROVISION_UPDATE, PROVISION_DEACTIVATE. The diff NEVER
// contains the password or its hash.
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import type { Prisma, User } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { logAudit, computeDiff } from './audit.js';
import { invalidateUserPermissions } from './permissionService.js';

/** Field-level validation error (surfaced by routes as 400 { errors }). */
export type RefError = { field: string; message: string };

/** Everything a caller may set on a user. All optional except on create (email+name). */
export type ProvisionUserData = {
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  status?: string;
  externalId?: string | null;
  orgUnitId?: string | null;
  geography?: string | null;
  operatingRoleId?: string | null;
  isManager?: boolean;
  reportsToId?: string | null;
  isApprover?: boolean;
  valueStreamIds?: string[];
  password?: string;
};

export type UpsertUserInput = {
  tenantId: string;
  /** Who performed the write — an admin email or "apiKey:<name>". */
  actorLabel: string;
  data: ProvisionUserData;
  /** Match the target by IAM externalId (provisioning/webhook surface). */
  byExternalId?: string;
  /** Match the target by row id (admin PATCH /users/:id). */
  byId?: string;
  /** Audit-action prefix for non-interactive sources. */
  source?: 'IMPORT' | 'PROVISION';
};

export type UpsertUserResult = { user: User; created: boolean };

/** Response shape for user writes — the password hash never leaves the API. */
export function sanitizeUser(user: User): Omit<User, 'password'> {
  const clone: Partial<User> = { ...user };
  delete clone.password;
  return clone as Omit<User, 'password'>;
}

/** Error the routes surface as HTTP 409 without leaking the other tenant. */
export class EmailConflictError extends Error {
  status = 409;
  constructor() {
    super('Email already in use');
  }
}

function isP2002(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002';
}

// Identity/attribute fields eligible for the audit diff — password is
// deliberately absent and must never be added.
const AUDITED_FIELDS = [
  'email',
  'name',
  'firstName',
  'lastName',
  'role',
  'status',
  'externalId',
  'orgUnitId',
  'geography',
  'operatingRoleId',
  'isManager',
  'reportsToId',
  'isApprover',
] as const;

/**
 * Cross-spine referential checks: every FK the payload carries must resolve
 * inside the caller's tenant (OrgUnit/Role live on company-scoped spines;
 * value streams must be L2 ProcessNodes; reportsTo must be a same-tenant
 * user). Returns typed errors rather than throwing so import can collect
 * per-row failures.
 */
export async function validateUserRefs(
  tenantId: string,
  input: ProvisionUserData,
): Promise<RefError[]> {
  const errors: RefError[] = [];

  if (input.orgUnitId) {
    const unit = await prisma.orgUnit.findFirst({
      where: { id: input.orgUnitId, company: { tenantId } },
      select: { id: true },
    });
    if (!unit) errors.push({ field: 'orgUnitId', message: 'Org unit not found' });
  }

  if (input.operatingRoleId) {
    const role = await prisma.role.findFirst({
      where: { id: input.operatingRoleId, company: { tenantId } },
      select: { id: true },
    });
    if (!role) errors.push({ field: 'operatingRoleId', message: 'Operating role not found' });
  }

  if (input.valueStreamIds && input.valueStreamIds.length > 0) {
    const found = await prisma.processNode.findMany({
      where: {
        id: { in: input.valueStreamIds },
        company: { tenantId },
        processLevelType: { levelNumber: 2 },
      },
      select: { id: true },
    });
    const ok = new Set(found.map((n) => n.id));
    for (const id of input.valueStreamIds) {
      if (!ok.has(id))
        errors.push({ field: 'valueStreamIds', message: `Value stream not found: ${id}` });
    }
  }

  if (input.reportsToId) {
    const mgr = await prisma.user.findFirst({
      where: { id: input.reportsToId, tenantId },
      select: { id: true },
    });
    if (!mgr) errors.push({ field: 'reportsToId', message: 'Manager (reportsTo) not found' });
  }

  return errors;
}

/**
 * Compose the canonical display name from its structured components. Used when
 * the caller (the User Admin form) supplies firstName/lastName instead of a
 * pre-joined `name`.
 */
function composeName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  return `${firstName ?? ''} ${lastName ?? ''}`.replace(/\s+/g, ' ').trim();
}

/** Scalar update payload from only the fields present on the input. */
function scalarData(data: ProvisionUserData): Prisma.UserUncheckedUpdateInput {
  const out: Prisma.UserUncheckedUpdateInput = {};
  if (data.email !== undefined) out.email = data.email;
  if (data.name !== undefined) out.name = data.name;
  if (data.firstName !== undefined) out.firstName = data.firstName;
  if (data.lastName !== undefined) out.lastName = data.lastName;
  if (data.role !== undefined) out.role = data.role;
  if (data.status !== undefined) out.status = data.status;
  if (data.externalId !== undefined) out.externalId = data.externalId;
  if (data.orgUnitId !== undefined) out.orgUnitId = data.orgUnitId;
  if (data.geography !== undefined) out.geography = data.geography;
  if (data.operatingRoleId !== undefined) out.operatingRoleId = data.operatingRoleId;
  if (data.isManager !== undefined) out.isManager = data.isManager;
  if (data.reportsToId !== undefined) out.reportsToId = data.reportsToId;
  if (data.isApprover !== undefined) out.isApprover = data.isApprover;
  return out;
}

async function hashPassword(provided: string | undefined): Promise<string> {
  // Provisioned/imported users authenticate via IAM — give them an unguessable
  // random credential so local login is effectively disabled.
  return bcrypt.hash(provided ?? randomBytes(32).toString('hex'), 10);
}

/**
 * Create-or-update a user. Target resolution: byId (admin PATCH) beats
 * byExternalId (IAM surfaces) beats email. Only fields present on `data` are
 * written, so IAM-sourced updates overwrite exactly the attributes the payload
 * carries and never touch UserPermissionOverride / UserPreference rows.
 * UserValueStream links are replaced transactionally when valueStreamIds is
 * provided. A cross-tenant email collision surfaces as EmailConflictError
 * (HTTP 409) without revealing the other tenant.
 */
export async function upsertUser(input: UpsertUserInput): Promise<UpsertUserResult> {
  const { tenantId, actorLabel, data, byExternalId, byId, source } = input;

  const existing = byId
    ? await prisma.user.findFirst({ where: { id: byId, tenantId } })
    : byExternalId
      ? await prisma.user.findFirst({ where: { tenantId, externalId: byExternalId } })
      : data.email
        ? await prisma.user.findFirst({ where: { tenantId, email: data.email } })
        : null;
  if (byId && !existing) throw Object.assign(new Error('User not found'), { status: 404 });

  const prefix = source ? `${source}_` : '';

  try {
    if (existing) {
      // The admin form supplies firstName/lastName; recompose the display name,
      // filling the unedited half from the existing row so a first-name-only
      // edit keeps the surname intact.
      const withName =
        data.firstName !== undefined || data.lastName !== undefined
          ? {
              ...data,
              name: composeName(
                data.firstName !== undefined ? data.firstName : existing.firstName,
                data.lastName !== undefined ? data.lastName : existing.lastName,
              ),
            }
          : data;
      const updateData = scalarData(withName);
      if (data.password) updateData.password = await hashPassword(data.password);
      const user = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({ where: { id: existing.id }, data: updateData });
        if (data.valueStreamIds) {
          await tx.userValueStream.deleteMany({ where: { userId: existing.id } });
          if (data.valueStreamIds.length > 0) {
            await tx.userValueStream.createMany({
              data: data.valueStreamIds.map((processNodeId) => ({
                userId: existing.id,
                processNodeId,
              })),
            });
          }
        }
        return updated;
      });
      invalidateUserPermissions(user.id);
      await logAudit({
        tenantId,
        actorEmail: actorLabel,
        entityType: 'User',
        entityId: user.id,
        action: `${prefix}UPDATE`,
        diff: computeDiff(
          existing as unknown as Record<string, unknown>,
          user as unknown as Record<string, unknown>,
          [...AUDITED_FIELDS],
        ),
      });
      return { user, created: false };
    }

    // Prefer the composed first+last name (admin form); fall back to the
    // pre-joined `name` that IAM/import surfaces supply.
    const name = composeName(data.firstName, data.lastName) || data.name;
    if (!data.email || !name) {
      throw Object.assign(new Error('email and name are required to create a user'), {
        status: 400,
      });
    }
    const password = await hashPassword(data.password);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId,
          email: data.email as string,
          name,
          firstName: data.firstName ?? null,
          lastName: data.lastName ?? null,
          password,
          role: data.role ?? 'MEMBER',
          status: data.status ?? 'ACTIVE',
          externalId: data.externalId ?? byExternalId ?? null,
          orgUnitId: data.orgUnitId ?? null,
          geography: data.geography ?? null,
          operatingRoleId: data.operatingRoleId ?? null,
          isManager: data.isManager ?? false,
          reportsToId: data.reportsToId ?? null,
          isApprover: data.isApprover ?? false,
        },
      });
      if (data.valueStreamIds && data.valueStreamIds.length > 0) {
        await tx.userValueStream.createMany({
          data: data.valueStreamIds.map((processNodeId) => ({ userId: created.id, processNodeId })),
        });
      }
      return created;
    });
    invalidateUserPermissions(user.id);
    const createdValues: Record<string, unknown> = {};
    for (const f of AUDITED_FIELDS)
      createdValues[f] = (user as unknown as Record<string, unknown>)[f];
    await logAudit({
      tenantId,
      actorEmail: actorLabel,
      entityType: 'User',
      entityId: user.id,
      action: `${prefix}CREATE`,
      diff: createdValues,
    });
    return { user, created: true };
  } catch (e) {
    // Email is globally unique across tenants — mask the collision.
    if (isP2002(e)) throw new EmailConflictError();
    throw e;
  }
}

/**
 * Soft-delete (status DEACTIVATED). Returns the user or null when no
 * same-tenant match exists — callers turn null into 404.
 */
export async function deactivateUser(
  tenantId: string,
  target: { id?: string; externalId?: string },
  actorLabel: string,
  source?: 'IMPORT' | 'PROVISION',
): Promise<User | null> {
  const existing = target.id
    ? await prisma.user.findFirst({ where: { id: target.id, tenantId } })
    : target.externalId
      ? await prisma.user.findFirst({ where: { tenantId, externalId: target.externalId } })
      : null;
  if (!existing) return null;

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { status: 'DEACTIVATED' },
  });
  invalidateUserPermissions(user.id);
  await logAudit({
    tenantId,
    actorEmail: actorLabel,
    entityType: 'User',
    entityId: user.id,
    action: `${source ? `${source}_` : ''}DEACTIVATE`,
    diff: { status: { from: existing.status, to: 'DEACTIVATED' } },
  });
  return user;
}
