// Navigation model — the visible nav derives from the shared MENU_TREE filtered
// by the user's effective read permissions (single source of truth with the
// backend's requirePermission gates). Also owns the hover-prefetch map so the
// nav stays data-driven.
//
// Two shapes are exposed:
//   • navItems — the FLAT list of readable leaf pages. Used by the start-page
//     picker (a page a user can land on) — it must stay flat.
//   • navGroups — the same pages arranged into the presentation groups the top
//     nav renders (Home / Workspace / Admin carry sub-tabs; the rest are
//     singletons). This is a pure presentation layer: it never invents or
//     renames a permission key, so the backend gates are untouched. Grouping a
//     tab is a nav concern, not an authz one.
import type { EffectivePermissions, MenuKey, MenuNode } from '@cascade/shared';
import { MENU_TREE, flattenMenuTree } from '@cascade/shared';
import { canRead, menuKeyForPath } from './permissions';
import { withCompany } from './portfolio';
import { loadViewState, saveViewState } from './viewState';

export type NavItem = { key: MenuKey; label: string; path: string };

export function navItems(perms: EffectivePermissions | null): NavItem[] {
  return MENU_TREE.filter(
    (n): n is typeof n & { path: string } => typeof n.path === 'string' && canRead(perms, n.key),
  ).map((n) => ({ key: n.key, label: n.label, path: n.path }));
}

// ── Presentation grouping ────────────────────────────────────────────────────
// Top-row order + which leaf pages sit under each group. A child may override
// the menu node's label for its sub-tab (e.g. the `home` dashboard reads as
// "Programs" under Home). Keys reference existing MENU_TREE nodes verbatim.
type GroupSpec = { id: string; label: string; children: { key: MenuKey; label?: string }[] };

const GROUP_SPECS: readonly GroupSpec[] = [
  {
    id: 'home',
    label: 'Home',
    children: [{ key: 'home', label: 'Programs' }, { key: 'automatable' }, { key: 'metrics' }],
  },
  { id: 'organization', label: 'Organization', children: [{ key: 'organization' }] },
  { id: 'value-streams', label: 'Value Streams', children: [{ key: 'value-streams' }] },
  { id: 'product-models', label: 'Products', children: [{ key: 'product-models' }] },
  { id: 'roles', label: 'Roles', children: [{ key: 'roles' }] },
  { id: 'deliverables', label: 'Deliverables', children: [{ key: 'deliverables' }] },
  { id: 'tasks', label: 'Tasks', children: [{ key: 'tasks' }] },
  { id: 'regulations', label: 'Regulations', children: [{ key: 'regulations' }] },
  { id: 'standards', label: 'Standards', children: [{ key: 'standards' }] },
  { id: 'applications', label: 'Applications', children: [{ key: 'applications' }] },
  { id: 'third-parties', label: 'Third-Parties', children: [{ key: 'third-parties' }] },
  {
    id: 'workspace',
    label: 'Workspace',
    children: [{ key: 'workspace', label: 'Maps' }, { key: 'work-library' }],
  },
  {
    id: 'admin',
    label: 'Admin',
    children: [
      { key: 'data-admin', label: 'Data Admin' },
      { key: 'user-admin', label: 'User Admin' },
      { key: 'approvals' },
    ],
  },
] as const;

// Drill-down routes with no MENU_TREE node of their own — map them to the group
// that owns them so the parent tab stays lit, the breadcrumb roots correctly,
// and the tab return point records them (EVERY drill route must be owned by a
// tab; a route "sitting in space" breaks all three).
const GROUP_PATH_PREFIXES: { prefix: string; groupId: string }[] = [
  { prefix: '/programs/', groupId: 'home' },
  { prefix: '/initiatives/', groupId: 'home' },
  { prefix: '/raid', groupId: 'home' },
  { prefix: '/streams/', groupId: 'value-streams' },
  { prefix: '/n/', groupId: 'value-streams' },
  { prefix: '/divisions/', groupId: 'organization' },
  { prefix: '/departments/', groupId: 'organization' },
  { prefix: '/audit', groupId: 'admin' },
];

const NODE_BY_KEY = new Map<MenuKey, MenuNode>(flattenMenuTree(MENU_TREE).map((n) => [n.key, n]));

export type NavGroup = { id: string; label: string; path: string; children: NavItem[] };

/** Permission-filtered nav groups. A group with no readable child is dropped;
 *  its `path` is its first readable child (where the parent tab lands). */
export function navGroups(perms: EffectivePermissions | null): NavGroup[] {
  const out: NavGroup[] = [];
  for (const spec of GROUP_SPECS) {
    const children: NavItem[] = [];
    for (const c of spec.children) {
      const node = NODE_BY_KEY.get(c.key);
      if (!node?.path || !canRead(perms, c.key)) continue;
      children.push({ key: c.key, label: c.label ?? node.label, path: node.path });
    }
    if (children.length === 0) continue;
    out.push({ id: spec.id, label: spec.label, path: children[0].path, children });
  }
  return out;
}

/** The group owning the current route — by leaf key, then by drill-down prefix. */
export function activeGroup(groups: NavGroup[], pathname: string): NavGroup | null {
  for (const { prefix, groupId } of GROUP_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) return groups.find((g) => g.id === groupId) ?? null;
  }
  const key = menuKeyForPath(pathname);
  if (!key) return null;
  return groups.find((g) => g.children.some((c) => c.key === key)) ?? null;
}

// ── Static grouping (permission-agnostic) ────────────────────────────────────
// The full group→pages map with no permission filter — the breadcrumb roots
// every trail at the owning group from this single source (labels/order stay in
// lock-step with the nav). Authz is a nav-render concern, not a breadcrumb one.
export const NAV_GROUPS: readonly NavGroup[] = GROUP_SPECS.map((spec) => {
  const children = spec.children.flatMap((c) => {
    const node = NODE_BY_KEY.get(c.key);
    return node?.path ? [{ key: c.key, label: c.label ?? node.label, path: node.path }] : [];
  });
  return { id: spec.id, label: spec.label, path: children[0]?.path ?? '/', children };
});

const STATIC_CHILDREN = NAV_GROUPS.flatMap((g) =>
  g.children.map((c) => ({ group: g, child: c })),
).sort((a, b) => b.child.path.length - a.child.path.length);

/** The group + sub-tab owning a route, permission-agnostic — for the breadcrumb
 *  root. Drill-down prefixes first, then longest child-path prefix. */
export function groupCrumbFor(pathname: string): { group: NavGroup; child: NavItem } | null {
  for (const { prefix, groupId } of GROUP_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      const group = NAV_GROUPS.find((g) => g.id === groupId);
      if (group) return { group, child: group.children[0] };
    }
  }
  for (const { group, child } of STATIC_CHILDREN) {
    if (child.path === '/') {
      if (pathname === '/') return { group, child };
      continue;
    }
    if (pathname === child.path || pathname.startsWith(`${child.path}/`)) return { group, child };
  }
  return null;
}

/** The sub-tab whose base path the route sits exactly on (not a drill route),
 *  or null. `/` (the Home landing) is excluded — it is the trail root. */
export function baseTabChild(pathname: string): NavItem | null {
  if (pathname === '/') return null;
  for (const { child } of STATIC_CHILDREN) {
    if (child.path !== '/' && pathname === child.path) return child;
  }
  return null;
}

// ── Tab return points ────────────────────────────────────────────────────────
// The central "land back where you left" rule for the top nav (desktop tabs,
// sub-tabs and the mobile menu all route through it): every location is
// recorded under its owning group AND sub-tab, and a nav click returns to the
// recorded location instead of the tab's bare base path. Clicking the tab you
// are already inside is the explicit reset to its base. Combined with
// lib/viewState page persistence this makes EVERY return path — tab link,
// breadcrumb, browser Back — restore the exact view.
const TAB_RETURN_NS = 'nav.tab.';

/** Record `pathname+search` as the return point of its owning group/sub-tab. */
export function rememberTabLocation(pathname: string, search: string): void {
  const gc = groupCrumbFor(pathname);
  if (!gc) return;
  const sp = new URLSearchParams(search);
  sp.delete('role'); // the role drawer is an overlay, never part of the return point
  const qs = sp.toString();
  const here = pathname + (qs ? `?${qs}` : '');
  saveViewState(TAB_RETURN_NS + gc.group.path, here);
  if (gc.child.path !== gc.group.path) saveViewState(TAB_RETURN_NS + gc.child.path, here);
}

/**
 * Where a click on the nav tab at `tabPath` should land, given the current
 * route: the tab's recorded return point when coming from elsewhere, or the
 * bare base path when already inside the tab (an explicit reset). Non-tab
 * paths pass through unchanged, so menu rows for drill routes stay safe.
 */
export function tabReturnTo(tabPath: string, currentPathname: string): string {
  const inScope =
    tabPath === '/'
      ? groupCrumbFor(currentPathname)?.group.path === '/'
      : currentPathname === tabPath ||
        currentPathname.startsWith(`${tabPath}/`) ||
        groupCrumbFor(currentPathname)?.group.path === tabPath;
  if (inScope) return tabPath;
  return loadViewState<string>(TAB_RETURN_NS + tabPath) ?? tabPath;
}

// Tab → the page's primary list endpoint, warmed on hover/focus so the page
// paints instantly on click (api.get dedups, so the warm + the page's own fetch
// share one round-trip). Company-scoped endpoints must match the page's exact
// keyed path (withCompany), or the cache key won't match. Returns null to skip.
const PREFETCH: Record<string, (companyId: string | null) => string | null> = {
  '/overview': () => '/explorer/tree',
  '/roles': () => '/roles',
  '/organization': () => '/explorer/org-table',
  '/standards': () => '/explorer/standards-flat',
  '/applications': () => '/applications',
  '/external': () => '/external-interactions',
  '/metrics': (c) => (c ? withCompany('/explorer/telemetry-catalog', c) : null),
  '/deliverables': (c) => (c ? withCompany('/work', c) : null),
  '/tasks': (c) => (c ? withCompany('/work', c) : null),
  '/regulations': (c) => (c ? withCompany('/regulations/jurisdictions', c) : null),
};

export function prefetchPathFor(navPath: string, companyId: string | null): string | null {
  return PREFETCH[navPath]?.(companyId) ?? null;
}
