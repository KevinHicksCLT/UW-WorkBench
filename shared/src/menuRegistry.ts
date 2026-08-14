// Shared menu registry — the single spine both sides consume for entitlements.
// Backend: requirePermission(menuKey) gates each feature router; the permission
// service resolves PermissionSet grants + per-user overrides over this tree.
// Frontend: Layout nav, RouteGuard, and the start-page picker derive from it.
// Hierarchy semantics: a grant on a parent key covers its whole subtree; an
// explicit child row (even all-false) is a subset carve-out.

export type MenuAction = 'create' | 'read' | 'update' | 'delete';

export type Crud = { create: boolean; read: boolean; update: boolean; delete: boolean };

const MENU_KEYS = [
  'home',
  'organization',
  'value-streams',
  'roles',
  'deliverables',
  'standards',
  'regulations',
  'tasks',
  'applications',
  'product-models',
  'forms',
  'third-parties',
  'workspace',
  'uw-workbench',
  'rate-price',
  'majesco-billing',
  'approvals',
  'work-library',
  'metrics',
  'automatable',
  'data-admin',
  'data-admin.configure',
  'data-admin.trackable-metrics',
  'data-admin.audit-log',
  'data-admin.data-dictionary',
  'user-admin',
  'user-admin.users',
  'user-admin.permission-sets',
  'user-admin.api-keys',
] as const;

export type MenuKey = (typeof MENU_KEYS)[number];

// Effective CRUD per menu key — every key present after resolution.
export type EffectivePermissions = Record<MenuKey, Crud>;

export type MenuNode = {
  key: MenuKey;
  label: string;
  /** Route path for navigable items; children without a path are in-page views. */
  path?: string;
  children?: readonly MenuNode[];
};

export const MENU_TREE: readonly MenuNode[] = [
  { key: 'home', label: 'Home', path: '/' },
  { key: 'organization', label: 'Organization', path: '/organization' },
  { key: 'value-streams', label: 'Value Streams', path: '/overview' },
  { key: 'roles', label: 'Roles', path: '/roles' },
  { key: 'deliverables', label: 'Deliverables', path: '/deliverables' },
  { key: 'standards', label: 'Standards', path: '/standards' },
  { key: 'regulations', label: 'Regulations', path: '/regulations' },
  { key: 'tasks', label: 'Tasks', path: '/tasks' },
  { key: 'applications', label: 'Applications', path: '/applications' },
  { key: 'product-models', label: 'Products', path: '/product-models' },
  { key: 'forms', label: 'Forms', path: '/forms' },
  { key: 'third-parties', label: 'Third-Parties', path: '/external' },
  { key: 'workspace', label: 'Workspace', path: '/portfolio' },
  { key: 'uw-workbench', label: 'UW Workbench', path: '/uw-workbench' },
  { key: 'rate-price', label: 'Rate & Price', path: '/rate-price' },
  { key: 'majesco-billing', label: 'Billing', path: '/billing' },
  { key: 'approvals', label: 'Approvals', path: '/approvals' },
  { key: 'work-library', label: 'Work Library', path: '/work-library' },
  { key: 'metrics', label: 'Metrics', path: '/metrics' },
  { key: 'automatable', label: 'Automatable', path: '/automatable' },
  {
    key: 'data-admin',
    label: 'Data Admin',
    path: '/admin',
    children: [
      { key: 'data-admin.configure', label: 'Configure' },
      { key: 'data-admin.trackable-metrics', label: 'Trackable Metrics' },
      { key: 'data-admin.audit-log', label: 'Audit Log' },
      { key: 'data-admin.data-dictionary', label: 'Data Dictionary' },
    ],
  },
  {
    key: 'user-admin',
    label: 'User Admin',
    path: '/user-admin',
    children: [
      { key: 'user-admin.users', label: 'Users' },
      { key: 'user-admin.permission-sets', label: 'User Types & Permissions' },
      { key: 'user-admin.api-keys', label: 'API Keys & Provisioning' },
    ],
  },
] as const;

const KEY_SET: ReadonlySet<string> = new Set(MENU_KEYS);

export function allMenuKeys(): MenuKey[] {
  return [...MENU_KEYS];
}

export function isMenuKey(v: string): v is MenuKey {
  return KEY_SET.has(v);
}

/** 'a.b' → 'a'; top-level keys have no parent. */
export function parentKey(key: MenuKey): MenuKey | null {
  const dot = key.lastIndexOf('.');
  if (dot === -1) return null;
  const parent = key.slice(0, dot);
  return isMenuKey(parent) ? parent : null;
}

/** Flat list of every node (parents before their children). */
export function flattenMenuTree(nodes: readonly MenuNode[] = MENU_TREE): MenuNode[] {
  const out: MenuNode[] = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children) out.push(...flattenMenuTree(n.children));
  }
  return out;
}
