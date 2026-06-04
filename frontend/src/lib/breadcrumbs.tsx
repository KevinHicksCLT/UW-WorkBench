import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

// ── Visited-path breadcrumb trail ───────────────────────────────────────────
// The breadcrumb is the path the user actually walked, not a fixed hierarchy.
// It persists across tab boundaries (e.g. open a role from a value stream and
// the value-stream crumb stays). Every trail is rooted at Home, and each tab's
// base level shows "Home / <Tab>" so a breadcrumb is present on every tab — the
// same always-on behaviour as the Value Streams map (which roots at the company
// and renders its own drill breadcrumb). Pages contribute their own crumb via
// PageHeader (useRegisterCrumb).

export type Crumb = { to: string; label: string };

// The permanent root of every trail.
const HOME: Crumb = { to: '/', label: 'Home' };

// Top-level tabs besides Home (their exact paths are the "base level" of each
// tab). The Value Streams tab (/overview) renders its own breadcrumb in the map
// canvas, so it never reaches PageHeader — it lives here only so owningTab() can
// root nested value-stream pages.
const TABS: Crumb[] = [
  { to: '/overview', label: 'Value Streams' },
  { to: '/roles', label: 'Roles' },
  { to: '/standards', label: 'Standards' },
  { to: '/active-ai', label: 'Telemetry' },
  { to: '/portfolio', label: 'Initiatives' },
  { to: '/work', label: 'Deliverables & Tasks' },
  { to: '/admin', label: 'Data Admin' },
];

const baseTab = (pathname: string): Crumb | undefined =>
  pathname === '/' ? HOME : TABS.find((t) => t.to === pathname);

// The tab a nested page belongs under — seeded as the crumb after Home when a
// trail starts fresh (e.g. on a deep link) so the breadcrumb is always rooted.
function owningTab(pathname: string): Crumb {
  if (pathname.startsWith('/roles') || pathname.startsWith('/divisions') || pathname.startsWith('/departments')) return TABS[1];
  if (pathname.startsWith('/value-streams') || pathname.startsWith('/overview') || pathname.startsWith('/n/')) return TABS[0];
  if (pathname.startsWith('/active-ai')) return TABS[3];
  if (pathname.startsWith('/standards')) return TABS[2];
  if (pathname.startsWith('/portfolio')) return TABS[4];
  if (pathname.startsWith('/work')) return TABS[5];
  if (pathname.startsWith('/admin') || pathname.startsWith('/audit')) return TABS[6];
  return HOME;
}

const sameTrail = (a: Crumb[], b: Crumb[]) =>
  a.length === b.length && a.every((c, i) => c.to === b[i].to && c.label === b[i].label);

type Ctx = { trail: Crumb[]; register: (to: string, label: string) => void };
const BreadcrumbContext = createContext<Ctx | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [trail, setTrail] = useState<Crumb[]>([]);

  // Structural update on navigation: at a tab's base level, root the trail at
  // "Home / <Tab>" (Home alone carries no breadcrumb); when stepping back to an
  // ancestor already in the trail, truncate to it. Forward navigation into a new
  // page is finished by register() (it carries the label).
  useEffect(() => {
    setTrail((prev) => {
      if (pathname === '/') return prev.length ? [] : prev; // Home is the root — no crumb
      const tab = TABS.find((t) => t.to === pathname);
      if (tab) {
        const rooted = [HOME, tab];
        return sameTrail(prev, rooted) ? prev : rooted;
      }
      const idx = prev.findIndex((c) => c.to === pathname);
      if (idx >= 0 && idx < prev.length - 1) return prev.slice(0, idx + 1);
      return prev;
    });
  }, [pathname]);

  const register = useCallback((to: string, label: string) => {
    if (baseTab(to)) return; // base levels carry their fixed tab crumb, not the page title
    setTrail((prev) => {
      const idx = prev.findIndex((c) => c.to === to);
      if (idx >= 0) {
        if (idx === prev.length - 1 && prev[idx].label === label) return prev;
        const next = prev.slice(0, idx + 1);
        next[idx] = { to, label };
        return next;
      }
      // Deep link with no prior trail → seed the rooted base (Home + owning
      // tab, collapsing to just Home when the page belongs directly under it).
      let seed: Crumb[] = [];
      if (prev.length === 0) {
        const tab = owningTab(to);
        seed = tab.to === HOME.to ? [HOME] : [HOME, tab];
      }
      return [...prev, ...seed, { to, label }];
    });
  }, []);

  return <BreadcrumbContext.Provider value={{ trail, register }}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbTrail(): Crumb[] {
  return useContext(BreadcrumbContext)?.trail ?? [];
}

// Registers the current page's crumb (its title). No-op on a tab's base level.
export function useRegisterCrumb(label: string) {
  const ctx = useContext(BreadcrumbContext);
  const { pathname } = useLocation();
  const register = ctx?.register;
  useEffect(() => {
    register?.(pathname, label);
  }, [register, pathname, label]);
}
