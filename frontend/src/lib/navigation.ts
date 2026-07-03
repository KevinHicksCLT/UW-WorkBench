// Navigation model — the visible nav derives from the shared MENU_TREE filtered
// by the user's effective read permissions (single source of truth with the
// backend's requirePermission gates). Also owns the hover-prefetch map so the
// nav stays data-driven.
import type { EffectivePermissions, MenuKey } from '@cascade/shared';
import { MENU_TREE } from '@cascade/shared';
import { canRead } from './permissions';
import { withCompany } from './portfolio';

export type NavItem = { key: MenuKey; label: string; path: string };

export function navItems(perms: EffectivePermissions | null): NavItem[] {
  return MENU_TREE.filter(
    (n): n is typeof n & { path: string } => typeof n.path === 'string' && canRead(perms, n.key),
  ).map((n) => ({ key: n.key, label: n.label, path: n.path }));
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
