// Shared client-side shapes for the User Admin surface — mirrors the sanitized
// payloads of backend/src/routes/users/* (password never present).
import {
  GEOGRAPHIES,
  GEOGRAPHY_LABELS,
  USER_TYPE_LABELS,
  isUserType,
  type Geography,
  type UserType,
} from '@cascade/shared';

/** One row of GET /users (and the single object of GET /users/:id). */
export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: UserType;
  status: 'ACTIVE' | 'DEACTIVATED';
  externalId: string | null;
  orgUnitId: string | null;
  geography: string | null;
  operatingRoleId: string | null;
  isManager: boolean;
  reportsToId: string | null;
  isApprover: boolean;
  createdAt: string;
  updatedAt: string;
  orgUnit: { id: string; displayValue: string } | null;
  operatingRole: { id: string; displayValue: string } | null;
  valueStreams: { processNode: { id: string; displayValue: string } }[];
};

/** GET /users/pickers — org units are already cut to the caller's admin scope. */
export type Pickers = {
  orgUnits: { id: string; displayValue: string; parentId: string | null; level: number }[];
  roles: { id: string; displayValue: string }[];
  valueStreams: { id: string; displayValue: string }[];
};

/** Dry-run and commit responses of POST /users/import share this shape. */
export type ImportResult = {
  total: number;
  valid: number;
  invalid: number;
  rows: {
    row: number;
    action: 'create' | 'update' | 'skip';
    email: string | null;
    errors: string[];
  }[];
};

/** One row of GET /users/api-keys. */
export type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  hasWebhookSecret: boolean;
};

/** POST /users/api-keys — the ONLY response that ever carries the raw secrets. */
export type CreatedApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  key: string;
  webhookSecret?: string;
};

export function userTypeLabel(role: string): string {
  return isUserType(role) ? USER_TYPE_LABELS[role] : role;
}

export function geographyLabel(geography: string | null): string {
  if (!geography) return '';
  return (GEOGRAPHIES as readonly string[]).includes(geography)
    ? GEOGRAPHY_LABELS[geography as Geography]
    : geography;
}
