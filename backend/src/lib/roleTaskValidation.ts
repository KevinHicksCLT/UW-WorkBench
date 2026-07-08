// Role-task validation — pure derivation behind PATCH /roles/task-links/:id/validation.
// A role-holder attests a NodeRole link: CONFIRMED ("yes, I do this"),
// NOT_PERFORMED ("we don't do this task at all"), REASSIGNED ("someone else
// does it" — another role, an application, or a third party), or back to
// UNREVIEWED. The state lives ONLY on the NodeRole row (single source of
// truth); this module computes the update payload so the rules are
// unit-testable without Prisma.

export const VALIDATION_STATUSES = [
  'UNREVIEWED',
  'CONFIRMED',
  'REASSIGNED',
  'NOT_PERFORMED',
] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const REASSIGN_KINDS = ['role', 'application', 'externalParty'] as const;
export type ReassignKind = (typeof REASSIGN_KINDS)[number];

export type ValidationInput = {
  status: ValidationStatus;
  note?: string | null;
  reassignTo?: { kind: ReassignKind; id: string } | null;
};

export type ValidationUpdateData = {
  validationStatus: ValidationStatus;
  validationNote: string | null;
  validatedByEmail: string | null;
  validatedAt: Date | null;
  reassignedToRoleId: string | null;
  reassignedToApplicationId: string | null;
  reassignedToExternalPartyId: string | null;
};

/**
 * Compute the NodeRole update for a validation decision. Enforces the sparse
 * target invariant: REASSIGNED carries exactly one target FK; every other
 * status carries none. Returns `{ error }` instead of throwing so the route
 * can 400 without a try/catch dance.
 */
export function validationUpdateData(
  input: ValidationInput,
  actorEmail: string,
  now: Date,
): { data: ValidationUpdateData } | { error: string } {
  if (input.status === 'REASSIGNED' && !input.reassignTo) {
    return {
      error: 'REASSIGNED requires a reassignTo target (role, application, or externalParty)',
    };
  }
  if (input.status !== 'REASSIGNED' && input.reassignTo) {
    return { error: `reassignTo is only valid with status REASSIGNED (got ${input.status})` };
  }
  const reviewed = input.status !== 'UNREVIEWED';
  const target = input.status === 'REASSIGNED' ? input.reassignTo! : null;
  return {
    data: {
      validationStatus: input.status,
      validationNote: reviewed ? input.note?.trim() || null : null,
      validatedByEmail: reviewed ? actorEmail : null,
      validatedAt: reviewed ? now : null,
      reassignedToRoleId: target?.kind === 'role' ? target.id : null,
      reassignedToApplicationId: target?.kind === 'application' ? target.id : null,
      reassignedToExternalPartyId: target?.kind === 'externalParty' ? target.id : null,
    },
  };
}

/** Shape every read surface renders for a link's validation state. */
export type ValidationView = {
  status: ValidationStatus;
  note: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  reassignedTo: { kind: ReassignKind; id: string; name: string } | null;
};

type ValidationRowLike = {
  validationStatus: string;
  validationNote: string | null;
  validatedByEmail: string | null;
  validatedAt: Date | null;
  reassignedToRole: { id: string; displayValue: string } | null;
  reassignedToApplication: { id: string; name: string } | null;
  reassignedToExternalParty: { id: string; name: string } | null;
};

/** Fold a NodeRole row's validation columns into the API view shape. */
export function validationView(row: ValidationRowLike): ValidationView {
  const reassignedTo = row.reassignedToRole
    ? {
        kind: 'role' as const,
        id: row.reassignedToRole.id,
        name: row.reassignedToRole.displayValue,
      }
    : row.reassignedToApplication
      ? {
          kind: 'application' as const,
          id: row.reassignedToApplication.id,
          name: row.reassignedToApplication.name,
        }
      : row.reassignedToExternalParty
        ? {
            kind: 'externalParty' as const,
            id: row.reassignedToExternalParty.id,
            name: row.reassignedToExternalParty.name,
          }
        : null;
  return {
    status: (VALIDATION_STATUSES as readonly string[]).includes(row.validationStatus)
      ? (row.validationStatus as ValidationStatus)
      : 'UNREVIEWED',
    note: row.validationNote,
    validatedBy: row.validatedByEmail,
    validatedAt: row.validatedAt ? row.validatedAt.toISOString() : null,
    reassignedTo,
  };
}

/** The Prisma select fragment every reader uses to hydrate a ValidationView. */
export const VALIDATION_SELECT = {
  validationStatus: true,
  validationNote: true,
  validatedByEmail: true,
  validatedAt: true,
  reassignedToRole: { select: { id: true, displayValue: true } },
  reassignedToApplication: { select: { id: true, name: true } },
  reassignedToExternalParty: { select: { id: true, name: true } },
} as const;
