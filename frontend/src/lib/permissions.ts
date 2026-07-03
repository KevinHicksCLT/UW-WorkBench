// Pure permission helpers over the shared MENU_TREE — no React, no fetching.
// The AuthProvider supplies EffectivePermissions from /auth/me; these decide
// what the nav shows, which routes mount, and where a user lands.
import {
  MENU_TREE,
  flattenMenuTree,
  isMenuKey,
  type Crud,
  type EffectivePermissions,
  type MenuAction,
  type MenuKey,
  type MenuNode,
} from '@cascade/shared';

export function can(perms: EffectivePermissions | null, key: MenuKey, action: MenuAction): boolean {
  if (!perms) return false;
  const crud: Crud | undefined = perms[key];
  return crud?.[action] === true;
}

export function canRead(perms: EffectivePermissions | null, key: MenuKey): boolean {
  return can(perms, key, 'read');
}

// Route-path → menu-key resolution. Longest-prefix match so detail/drill routes
// ('/regulations/CA', '/programs/:id') resolve to their owning tab. Paths not
// under any registry entry (e.g. '/settings') return null — auth-only surface.
const PATH_ENTRIES: { path: string; key: MenuKey }[] = flattenMenuTree(MENU_TREE)
  .filter((n): n is MenuNode & { path: string } => typeof n.path === 'string')
  .map((n) => ({ path: n.path, key: n.key }))
  .sort((a, b) => b.path.length - a.path.length);

export function menuKeyForPath(pathname: string): MenuKey | null {
  for (const { path, key } of PATH_ENTRIES) {
    if (path === '/') {
      if (pathname === '/') return key;
      continue;
    }
    if (pathname === path || pathname.startsWith(`${path}/`)) return key;
  }
  return null;
}

/** First readable top-level entry, honoring the saved start page. Null = no access at all. */
export function defaultRoute(
  perms: EffectivePermissions | null,
  startPage?: string | null,
): string | null {
  if (startPage && isMenuKey(startPage) && canRead(perms, startPage)) {
    const node = MENU_TREE.find((n) => n.key === startPage);
    if (node?.path) return node.path;
  }
  for (const node of MENU_TREE) {
    if (node.path && canRead(perms, node.key)) return node.path;
  }
  return null;
}
