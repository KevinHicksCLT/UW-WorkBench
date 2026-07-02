import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

// ── Visited-path breadcrumb trail (global header) ───────────────────────────
// The breadcrumb is the path the user actually walked, not a fixed hierarchy,
// and it renders ONCE — in the global header (components/BreadcrumbBar inside
// Layout), never inside pages. The trail PERSISTS across tab boundaries:
// following a link from one tab into another appends to the trail, so the
// crumbs always lead back to exactly where the user came from — including
// query state (each crumb keeps the latest pathname+search it saw, so e.g. a
// filtered RAID log restores its filter). Two things re-root the trail:
//   - clicking a tab in the top nav (Layout calls resetToTab — an explicit
//     fresh start),
//   - navigating to a URL already in the trail (back-nav → truncate to it).
// Pages contribute their crumb via PageHeader (useRegisterCrumb). Drill-driven
// surfaces (the Value Streams / Organization maps) can CLAIM the header bar
// and portal their richer drill breadcrumb into it (useHeaderBreadcrumbSlot).

export type Crumb = { to: string; label: string };

// The permanent root of every trail.
const HOME: Crumb = { to: '/', label: 'Home' };

// Top-level tabs besides Home (their exact paths are the "base level" of each
// tab). Kept in sync with the Layout nav.
const TABS: Crumb[] = [
  { to: '/overview', label: 'Value Streams' },
  { to: '/roles', label: 'Roles' },
  { to: '/organization', label: 'Organization' },
  { to: '/standards', label: 'Standards' },
  { to: '/regulations', label: 'Regulations' },
  { to: '/metrics', label: 'Metrics' },
  { to: '/portfolio', label: 'Workspace' },
  { to: '/deliverables', label: 'Deliverables' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/applications', label: 'Applications' },
  { to: '/external', label: 'Third-Parties' },
  { to: '/admin', label: 'Data Admin' },
];

// Crumbs are keyed by pathname; `to` carries pathname+search for restoration.
const pathOf = (to: string) => to.split('?')[0];

// The tab a nested page belongs under — seeds the crumb after Home when a
// trail starts fresh (e.g. on a deep link) so the breadcrumb is always rooted.
// Portfolio drill-downs (/programs, /initiatives, /raid) belong to Home.
const TAB_PREFIXES: [string, string][] = [
  ['/organization', '/organization'], ['/divisions', '/organization'], ['/departments', '/organization'],
  ['/roles', '/roles'],
  ['/value-streams', '/overview'], ['/overview', '/overview'], ['/n/', '/overview'],
  ['/standards', '/standards'], ['/regulations', '/regulations'], ['/metrics', '/metrics'],
  ['/portfolio', '/portfolio'], ['/deliverables', '/deliverables'], ['/tasks', '/tasks'],
  ['/work', '/deliverables'], ['/applications', '/applications'],
  ['/external', '/external'], ['/admin', '/admin'], ['/audit', '/admin'],
];
function owningTab(path: string): Crumb {
  const hit = TAB_PREFIXES.find(([p]) => path.startsWith(p));
  return (hit && TABS.find((t) => t.to === hit[1])) || HOME;
}

const sameTrail = (a: Crumb[], b: Crumb[]) =>
  a.length === b.length && a.every((c, i) => c.to === b[i].to && c.label === b[i].label);

type Ctx = {
  trail: Crumb[];
  register: (to: string, label: string) => void;
  resetToTab: (to: string) => void;
  headerSlot: HTMLElement | null;
  setHeaderSlot: (el: HTMLElement | null) => void;
  headerClaimed: boolean;
  claimHeader: (claimed: boolean) => void;
};
const BreadcrumbContext = createContext<Ctx | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  const [trail, setTrail] = useState<Crumb[]>([]);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [headerClaimed, claimHeader] = useState(false);

  // Structural update on navigation. Key behaviours:
  //   - Home is the root — no crumb.
  //   - A URL already in the trail (matched by pathname) → back-nav: truncate
  //     to it and refresh its `to` with the current search (query state).
  //   - A tab base reached by an in-app LINK (top-nav clicks call resetToTab
  //     instead) → APPEND the tab, keeping the cross-tab path walkable back.
  //   - Anything else is a page register()s with its own label.
  useEffect(() => {
    const here = pathname + search;
    setTrail((prev) => {
      if (pathname === '/') return prev.length ? [] : prev;
      const idx = prev.findIndex((c) => pathOf(c.to) === pathname);
      if (idx >= 0) {
        const next = prev.slice(0, idx + 1);
        next[idx] = { ...next[idx], to: here };
        return sameTrail(prev, next) ? prev : next;
      }
      const tab = TABS.find((t) => t.to === pathname);
      if (tab) {
        const base = prev.length ? prev : [HOME];
        return [...base, { label: tab.label, to: here }];
      }
      return prev;
    });
  }, [pathname, search]);

  const register = useCallback((to: string, label: string) => {
    const path = pathOf(to);
    if (path === '/' || TABS.some((t) => t.to === path)) return; // base levels carry their fixed tab crumb
    setTrail((prev) => {
      const idx = prev.findIndex((c) => pathOf(c.to) === path);
      if (idx >= 0) {
        if (idx === prev.length - 1 && prev[idx].label === label && prev[idx].to === to) return prev;
        const next = prev.slice(0, idx + 1);
        next[idx] = { to, label };
        return next;
      }
      // Deep link with no prior trail → seed the rooted base (Home + owning
      // tab, collapsing to just Home when the page belongs directly under it).
      let seed: Crumb[] = [];
      if (prev.length === 0) {
        const tab = owningTab(path);
        seed = tab.to === HOME.to ? [HOME] : [HOME, tab];
      }
      return [...prev, ...seed, { to, label }];
    });
  }, []);

  // Explicit fresh start — Layout calls this from top-nav / wordmark clicks.
  // Non-tab URLs are a no-op so it is safe to call for any navigation source.
  const resetToTab = useCallback((to: string) => {
    if (to === '/') { setTrail([]); return; }
    const tab = TABS.find((t) => t.to === to);
    if (tab) setTrail([HOME, tab]);
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ trail, register, resetToTab, headerSlot, setHeaderSlot, headerClaimed, claimHeader }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

// Registers the current page's crumb (its title). No-op on a tab's base level.
// The crumb carries pathname+search so returning to it restores query state.
export function useRegisterCrumb(label: string) {
  const ctx = useContext(BreadcrumbContext);
  const { pathname, search } = useLocation();
  const register = ctx?.register;
  useEffect(() => {
    register?.(pathname + search, label);
  }, [register, pathname, search, label]);
}

// Layout's view of the breadcrumb header: the trail to render, the slot
// element to mount (pages portal into it), whether a page has claimed it,
// and the reset hook for top-nav clicks.
export function useBreadcrumbHeader() {
  const ctx = useContext(BreadcrumbContext);
  return {
    trail: ctx?.trail ?? [],
    headerClaimed: ctx?.headerClaimed ?? false,
    setHeaderSlot: ctx?.setHeaderSlot ?? (() => {}),
    resetToTab: ctx?.resetToTab ?? (() => {}),
  };
}

// A drill-driven page (map view) claims the global header bar while `active`,
// hiding the visited trail, and gets the element to portal its own breadcrumb
// into. Returns null while inactive.
export function useHeaderBreadcrumbSlot(active: boolean): HTMLElement | null {
  const ctx = useContext(BreadcrumbContext);
  const claim = ctx?.claimHeader;
  useEffect(() => {
    if (!active || !claim) return;
    claim(true);
    return () => claim(false);
  }, [active, claim]);
  return active ? ctx?.headerSlot ?? null : null;
}
