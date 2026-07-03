// Shared zod schemas + types for entitlements, user management, and the
// per-user preference store. Both the API (request validation) and the
// frontend (typed forms) consume these.
import { z } from 'zod';
import { GEOGRAPHIES, USER_TYPES } from './userTypes.js';
import { isMenuKey, type Crud, type EffectivePermissions, type MenuKey } from './menuRegistry.js';

// ─── User management ───────────────────────────────────────────────────

export const userTypeSchema = z.enum(USER_TYPES);
export const geographySchema = z.enum(GEOGRAPHIES);

export const menuKeySchema = z.string().refine(isMenuKey, { message: 'Unknown menu key' });

export const userUpsertSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: userTypeSchema,
  orgUnitId: z.string().nullable().optional(),
  geography: geographySchema.nullable().optional(),
  operatingRoleId: z.string().nullable().optional(),
  isManager: z.boolean().optional(),
  reportsToId: z.string().nullable().optional(),
  isApprover: z.boolean().optional(),
  valueStreamIds: z.array(z.string()).optional(),
  password: z.string().min(8).optional(),
});
export type UserUpsertRequest = z.infer<typeof userUpsertSchema>;

// ─── Permissions ───────────────────────────────────────────────────────

export const permissionGrantSchema = z.object({
  menuKey: menuKeySchema,
  canCreate: z.boolean(),
  canRead: z.boolean(),
  canUpdate: z.boolean(),
  canDelete: z.boolean(),
});
export type PermissionGrantInput = z.infer<typeof permissionGrantSchema>;

// Tri-state override: null/absent action = inherit from the user-type set.
export const permissionOverrideSchema = z.object({
  menuKey: menuKeySchema,
  canCreate: z.boolean().nullable().optional(),
  canRead: z.boolean().nullable().optional(),
  canUpdate: z.boolean().nullable().optional(),
  canDelete: z.boolean().nullable().optional(),
});
export type PermissionOverrideInput = z.infer<typeof permissionOverrideSchema>;

// ─── ABAC attributes on /auth/me ───────────────────────────────────────

export type UserAttributes = {
  orgUnitId: string | null;
  /** Ancestor display names root→leaf for the user's home org unit. */
  orgPath: string[];
  geography: string | null;
  operatingRoleId: string | null;
  isManager: boolean;
  reportsToId: string | null;
  isApprover: boolean;
  valueStreamIds: string[];
};

export type MeResponse = {
  user: { id: string; email: string; name: string; role: string; tenantId: string; status: string };
  attributes: UserAttributes;
  permissions: EffectivePermissions;
  /** The user's start page, already validated readable (falls back to 'home'). */
  startPage: MenuKey;
};

// ─── Preferences ───────────────────────────────────────────────────────
// Row-per-key store. Reserved keys get strict schemas; dynamic families are
// validated by prefix + size cap in the route.

export const notificationPreferenceSchema = z.object({
  method: z.enum(['EMAIL', 'SMS', 'TEAMS']),
  email: z.string().email().optional(),
  phone: z.string().max(32).optional(),
  teams: z
    .object({
      // channel = post to an existing channel · create = auto-create a dedicated
      // channel (channelName) · dm = direct message from "Transformation Bridge"
      mode: z.enum(['channel', 'create', 'dm']),
      channelId: z.string().max(256).optional(),
      channelName: z.string().max(128).optional(),
    })
    .optional(),
});
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

export const dashboardPreferenceSchema = z.object({
  // Ordered visible widget ids; hidden widgets are simply absent.
  layout: z.array(z.string().max(64)).max(64),
});
export type DashboardPreference = z.infer<typeof dashboardPreferenceSchema>;

export const sheetColumnsPreferenceSchema = z.object({
  order: z.array(z.string().max(64)).max(64).optional(),
  hidden: z.array(z.string().max(64)).max(64).optional(),
  widths: z.record(z.string().max(64), z.number().int().min(24).max(2000)).optional(),
});
export type SheetColumnsPreference = z.infer<typeof sheetColumnsPreferenceSchema>;

export const RESERVED_PREFERENCE_SCHEMAS: Readonly<Record<string, z.ZodTypeAny>> = {
  startPage: menuKeySchema,
  notification: notificationPreferenceSchema,
  dashboard: dashboardPreferenceSchema,
};

// Dynamic preference-key families (former localStorage bridge.* state).
export const DYNAMIC_PREFERENCE_KEY_PATTERNS: readonly RegExp[] = [
  /^sheet\.columns\.[\w.-]{1,64}$/,
  /^work\.toc\.group\.[\w.-]{1,64}$/,
];

export function isValidPreferenceKey(key: string): boolean {
  return (
    Object.prototype.hasOwnProperty.call(RESERVED_PREFERENCE_SCHEMAS, key) ||
    DYNAMIC_PREFERENCE_KEY_PATTERNS.some((re) => re.test(key))
  );
}

export type PreferenceMap = Record<string, unknown>;
export type Preferences = {
  startPage?: MenuKey;
  notification?: NotificationPreference;
  dashboard?: DashboardPreference;
} & PreferenceMap;

export type { Crud, EffectivePermissions, MenuKey };
