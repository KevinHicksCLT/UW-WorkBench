// Shared user-type (RBAC) constants + ABAC attribute contracts.
// User.role carries the user type; the operating-model Role entity is separate.

export const USER_TYPES = [
  'SITE_ADMIN',
  'CORE_BUSINESS_ADMIN',
  'TECHNOLOGY_ADMIN',
  'CORPORATE_FUNCTIONS_ADMIN',
  'SUPER_USER',
  'MEMBER',
] as const;

export type UserType = (typeof USER_TYPES)[number];

export function isUserType(v: string): v is UserType {
  return (USER_TYPES as readonly string[]).includes(v);
}

// Domain admins administer users homed in the OrgUnit subtree under the L1
// whose dbValue matches this map (dbValue is the canonical system name and is
// NOT admin-editable — renaming an L1's dbValue would orphan the admin's scope,
// so treat these anchors as contract).
export const DOMAIN_ADMIN_SCOPE: Readonly<Partial<Record<UserType, string>>> = {
  CORE_BUSINESS_ADMIN: 'Core Business',
  TECHNOLOGY_ADMIN: 'Technology',
  CORPORATE_FUNCTIONS_ADMIN: 'Corporate Functions',
};

export function isDomainAdmin(t: string): boolean {
  return (
    t === 'CORE_BUSINESS_ADMIN' || t === 'TECHNOLOGY_ADMIN' || t === 'CORPORATE_FUNCTIONS_ADMIN'
  );
}

/** User types that may hold the User Admin surface at all. */
export function isUserAdminType(t: string): boolean {
  return t === 'SITE_ADMIN' || isDomainAdmin(t);
}

// User types a domain admin may assign (privilege-escalation guard — only
// SITE_ADMIN can mint admins).
export const DOMAIN_ADMIN_ASSIGNABLE: readonly UserType[] = ['MEMBER', 'SUPER_USER'];

export const GEOGRAPHIES = ['NORTH_AMERICA', 'UK_EUROPE', 'APAC', 'LATAM'] as const;
export type Geography = (typeof GEOGRAPHIES)[number];

export const GEOGRAPHY_LABELS: Readonly<Record<Geography, string>> = {
  NORTH_AMERICA: 'North America',
  UK_EUROPE: 'UK/Europe',
  APAC: 'APAC',
  LATAM: 'LATAM',
};

export const USER_TYPE_LABELS: Readonly<Record<UserType, string>> = {
  SITE_ADMIN: 'Site Admin',
  CORE_BUSINESS_ADMIN: 'Core Business Admin',
  TECHNOLOGY_ADMIN: 'Technology Admin',
  CORPORATE_FUNCTIONS_ADMIN: 'Corporate Functions Admin',
  SUPER_USER: 'Super User',
  MEMBER: 'Member',
};
