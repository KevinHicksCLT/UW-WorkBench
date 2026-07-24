import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useCompany } from '../lib/company';
import { api } from '../lib/api';
import { navGroups, activeGroup, prefetchPathFor, type NavGroup } from '../lib/navigation';
import { useBreadcrumbHeader } from '../lib/breadcrumbs';
import { useScrollRestore } from '../lib/viewState';
import SearchBox from './SearchBox';
import AssistantWidget from './AssistantWidget';
import FeedbackWidget from './FeedbackWidget';
import BreadcrumbBar from './BreadcrumbBar';
import RoleDrawerHost from './RoleDrawerHost';

type IndexItem = { id: string; name: string; valueStreams?: number; roles?: number };

export default function Layout({ children }: { children: ReactNode }) {
  const { user, permissions, logout } = useAuth();
  const { companies, companyId, setCompanyId } = useCompany();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [domains, setDomains] = useState<IndexItem[]>([]);
  const [divisions, setDivisions] = useState<IndexItem[]>([]);
  // Permission-filtered nav groups — the single source both the desktop tab bar
  // and the mobile menu render from (mirrors the backend's requirePermission
  // gates). Grouped tabs (Home / Workspace / Admin) carry a second-row sub-tab
  // bar; the rest are singletons.
  const groups = navGroups(permissions);
  const current = activeGroup(groups, location.pathname);
  // Sub-tab row shows only when the active group has more than one child.
  const subTabs = current && current.children.length > 1 ? current.children : null;
  const isExplorer =
    location.pathname.startsWith('/overview') ||
    location.pathname.startsWith('/n/') ||
    location.pathname === '/roles' ||
    location.pathname === '/organization' ||
    location.pathname === '/product-models';

  // Scroll restoration for the detail-page scroller (<main overflow-auto>):
  // keyed by pathname+search so returning to a page — browser Back, a
  // breadcrumb, or a nav link — lands at the exact offset the user left, while
  // a first visit starts at the top. The `role` drawer param is an overlay on
  // the same page, and `focus` deep links do their own row-centering scroll —
  // neither may fork or fight the restore.
  const mainRef = useRef<HTMLElement | null>(null);
  const scrollParams = new URLSearchParams(location.search);
  scrollParams.delete('role');
  const hasFocus = scrollParams.has('focus');
  const scrollSearch = scrollParams.toString();
  useScrollRestore(
    mainRef,
    isExplorer ? null : `main:${location.pathname}${scrollSearch ? `?${scrollSearch}` : ''}`,
    !hasFocus,
  );

  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);
  // Close the user dropdown on any outside click.
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [userMenuOpen]);
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);
  useEffect(() => {
    if (!user) return;
    api
      .get<{ domains?: IndexItem[]; divisions?: IndexItem[] }>('/explorer/overview')
      .then((o) => {
        setDomains(o.domains ?? []);
        setDivisions(o.divisions ?? []);
      })
      .catch(() => {});
  }, [user]);

  const { resetToTab } = useBreadcrumbHeader();

  const here = (key: string) => location.pathname.includes(key);
  // Nav-menu navigation is an explicit fresh start — re-root the breadcrumb
  // trail at the chosen tab (no-op for non-tab URLs like the drill-down rows).
  const go = (url: string) => {
    resetToTab(url);
    navigate(url);
    setMobileMenuOpen(false);
  };

  // ── Nav link helper ────────────────────────────────────────────────────────
  // Underline-style tab: sits on the nav row's hairline, dark indicator when active.
  // Hovering/focusing a tab warms its list endpoint's GET cache (api dedups, so a
  // warm + the page's own fetch share one round-trip) — the page paints instantly
  // on click instead of waiting on the network. `active` is decided by the caller
  // (a group tab lights for its whole section; a sub-tab lights for its own page).
  const NavLink = ({
    to,
    active,
    children: label,
  }: {
    to: string;
    active: boolean;
    children: ReactNode;
  }) => {
    const warm = () => {
      const p = prefetchPathFor(to, companyId);
      if (p) api.prefetch(p);
    };
    return (
      <Link
        to={to}
        onMouseEnter={warm}
        onFocus={warm}
        onClick={() => resetToTab(to)}
        aria-current={active ? 'page' : undefined}
        className={
          'relative inline-flex items-center h-9 -mb-px px-0.5 text-sm whitespace-nowrap border-b-2 transition-colors duration-150 ' +
          (active
            ? 'text-[#171717] font-semibold border-[#171717]'
            : 'text-[#666666] font-medium border-transparent hover:text-[#171717] hover:border-[#d4d4d4]')
        }
      >
        {label}
      </Link>
    );
  };

  // ── Mobile dropdown row ────────────────────────────────────────────────────
  const MobileRow = ({
    item,
    url,
    active,
    count,
    unit,
  }: {
    item: IndexItem;
    url: string;
    active: boolean;
    count?: number;
    unit: string;
  }) => (
    <button
      onClick={() => go(url)}
      className={
        'w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors duration-150 ' +
        (active
          ? 'bg-[#fafafa] text-[#171717] font-medium'
          : 'text-[#525252] hover:bg-[#fafafa] hover:text-[#171717]')
      }
    >
      <span className="truncate flex-1">{item.name}</span>
      {count != null && (
        <span className="text-[10px] tnum text-[#a3a3a3]">
          {count} {unit}
        </span>
      )}
    </button>
  );

  // ── Mobile grouped section ─────────────────────────────────────────────────
  // A grouped tab (Home / Workspace / Admin): a section heading over its pages.
  const MobileGroup = ({ group }: { group: NavGroup }) => (
    <div className="py-1">
      <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
        {group.label}
      </div>
      {group.children.map((c) => {
        const active = location.pathname === c.path || location.pathname.startsWith(`${c.path}/`);
        return (
          <button
            key={c.key}
            onClick={() => go(c.path)}
            className={
              'w-full flex items-center gap-3 pl-6 pr-4 py-2 text-sm transition-colors duration-150 ' +
              (active ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')
            }
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ── Top navigation ──────────────────────────────────────────────────── */}
      {/* Two-tier, Vercel/Linear-style: brand + utilities on top, a dedicated
          full-width tab bar below so all tabs get room. Mounted at all sizes. */}
      <header className="flex-shrink-0 z-30 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75 safe-pt safe-px">
        {/* Row 1 — brand + utilities */}
        <div className="flex items-center gap-4 px-4 sm:px-6 h-10 border-b border-[#eaeaea] sm:border-b-0">
          {/* Wordmark — Capgemini logotype flowing into the product name as one lockup */}
          <Link
            to="/"
            onClick={() => resetToTab('/')}
            className="flex items-baseline gap-2 flex-shrink-0 group"
            aria-label="Capgemini Transformation Bridge — home"
          >
            {/* h-[20px] matches the logotype cap-height to the text; translate-y aligns its baseline */}
            <img
              src="/capgemini-wordmark.svg"
              alt="Capgemini"
              className="h-[20px] w-auto translate-y-[5.5px]"
            />
            <span className="font-semibold text-[#0070AD] text-[15px] tracking-tight whitespace-nowrap -translate-y-[1.5px] group-hover:text-[#12abdb] transition-colors duration-150">
              Transformation Bridge
            </span>
          </Link>

          {/* Center group — active-company switcher + search, centered between the
              wordmark and the user menu (FB-01). flex-1 keeps it centered and lets it
              collapse responsively; both controls move into the mobile menu below
              sm/md, leaving this as empty centering space. */}
          <div className="flex-1 flex justify-center min-w-0">
            <div className="flex items-center gap-3 w-full max-w-xl">
              {/* Active company — every view + edit is scoped to this company. */}
              {companies.length > 0 && (
                <div className="hidden sm:block relative flex-shrink-0">
                  {/* Leading building glyph */}
                  <svg
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a3a3a3]"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h.01M9 13h.01M9 17h.01" />
                  </svg>
                  <select
                    aria-label="Active company"
                    className="appearance-none rounded-lg border border-[#eaeaea] bg-white pl-8 pr-8 py-1.5 text-sm font-medium text-[#171717] max-w-[220px] truncate cursor-pointer hover:border-[#d4d4d4] focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150"
                    value={companyId ?? ''}
                    onChange={(e) => setCompanyId(e.target.value)}
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {/* Custom chevron */}
                  <svg
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a3a3a3]"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              )}

              {/* Search — desktop */}
              <div className="hidden md:block flex-1 min-w-0">
                <SearchBox />
              </div>
            </div>
          </div>

          {/* Feedback capture — header button + modal, on every authenticated screen */}
          <div className="hidden sm:block">
            <FeedbackWidget />
          </div>

          {/* User menu — desktop (Settings + sign-out dropdown) */}
          <div className="hidden sm:block relative pl-1" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[#fafafa] transition-colors duration-150"
            >
              <span
                className="flex items-center justify-center h-7 w-7 rounded-full bg-[#f5f5f5] text-[11px] font-semibold text-[#525252] flex-shrink-0"
                aria-hidden="true"
              >
                {(user?.name ?? '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="text-sm text-[#525252] truncate max-w-[140px]">{user?.name}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[#a3a3a3]"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {userMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-[#eaeaea] bg-white shadow-md py-1 z-40"
              >
                <div className="px-3 py-2 border-b border-[#eaeaea]">
                  <div className="text-sm font-medium text-[#171717] truncate">{user?.name}</div>
                  <div className="text-[11px] text-[#a3a3a3] truncate">{user?.email}</div>
                </div>
                <button
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    go('/settings');
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-[#525252] hover:bg-[#fafafa] hover:text-[#171717] transition-colors duration-150"
                >
                  Settings
                </button>
                <button
                  role="menuitem"
                  onClick={logout}
                  className="w-full text-left px-3 py-2 text-sm text-[#525252] hover:bg-[#fafafa] hover:text-[#171717] transition-colors duration-150"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="sm:hidden p-2 -mr-1 rounded-md text-[#525252] hover:text-[#171717] hover:bg-[#fafafa] transition-colors duration-150"
          >
            {mobileMenuOpen ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            )}
          </button>
        </div>

        {/* Row 2 — full-width group tab bar (desktop). Each group lands on its
            first readable child; the whole tab lights while any of its pages is
            active. */}
        <nav
          className="hidden sm:flex items-center gap-7 px-4 sm:px-6 border-b border-[#eaeaea] overflow-x-auto"
          aria-label="Main navigation"
        >
          {groups.map((g) => (
            <NavLink key={g.id} to={g.path} active={current?.id === g.id}>
              {g.label}
            </NavLink>
          ))}
        </nav>

        {/* Row 2b — sub-tab bar for the active group (only when it has >1 page).
            Lighter surface so it reads as a subordinate strip under the section. */}
        {subTabs && (
          <nav
            className="hidden sm:flex items-center gap-6 px-4 sm:px-6 border-b border-[#eaeaea] bg-[#fafafa] overflow-x-auto"
            aria-label={`${current?.label} sections`}
          >
            {subTabs.map((c) => (
              <NavLink
                key={c.key}
                to={c.path}
                active={location.pathname === c.path || location.pathname.startsWith(`${c.path}/`)}
              >
                {c.label}
              </NavLink>
            ))}
          </nav>
        )}

        {/* Row 3 — the app's single breadcrumb: the cross-tab visited trail,
            or a map view's portaled drill breadcrumb. Hidden on Home. */}
        <BreadcrumbBar />
      </header>

      {/* ── Mobile dropdown menu ─────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="sm:hidden fixed inset-0 z-20 bg-black/20"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="sm:hidden fixed top-12 left-0 right-0 z-30 bg-white border-b border-[#eaeaea] max-h-[70vh] overflow-y-auto shadow-md">
            {/* Search */}
            <div className="px-4 py-3 border-b border-[#eaeaea]">
              <SearchBox />
            </div>

            {/* Active company */}
            {companies.length > 0 && (
              <div className="px-4 py-3 border-b border-[#eaeaea]">
                <label className="block text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">
                  Company
                </label>
                <select
                  className="w-full rounded-md border border-[#eaeaea] bg-white px-2 py-1.5 text-sm text-[#171717]"
                  value={companyId ?? ''}
                  onChange={(e) => setCompanyId(e.target.value)}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Nav links — same permission-filtered groups as the desktop tab bar.
                Singletons render as one row; grouped tabs list their pages under a
                section heading. */}
            <div className="py-1">
              {groups.map((g) =>
                g.children.length === 1 ? (
                  <button
                    key={g.id}
                    onClick={() => go(g.children[0].path)}
                    className={
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' +
                      (current?.id === g.id
                        ? 'bg-[#fafafa] text-[#171717] font-medium'
                        : 'text-[#525252]')
                    }
                  >
                    {g.label}
                  </button>
                ) : (
                  <MobileGroup key={g.id} group={g} />
                ),
              )}
            </div>

            {/* Operating Model */}
            {domains.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
                  Operating Model
                </div>
                {domains.map((d) => (
                  <MobileRow
                    key={d.id}
                    item={d}
                    url={`/n/domain:${d.id}`}
                    active={here(`domain:${d.id}`)}
                    count={d.valueStreams}
                    unit="streams"
                  />
                ))}
              </>
            )}

            {/* Organization */}
            {divisions.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
                  Organization
                </div>
                {divisions.map((d) => (
                  <MobileRow
                    key={d.id}
                    item={d}
                    url={`/n/division:${d.id}`}
                    active={here(`division:${d.id}`)}
                    count={d.roles}
                    unit="roles"
                  />
                ))}
              </>
            )}

            {/* Settings + sign out */}
            <div className="px-4 py-3 border-t border-[#eaeaea] mt-1">
              <div className="text-sm font-medium text-[#171717]">{user?.name}</div>
              <div className="text-[11px] text-[#a3a3a3] mt-0.5">{user?.email}</div>
              <div className="mt-2 flex items-center gap-4">
                <button
                  onClick={() => go('/settings')}
                  className="text-sm text-[#525252] hover:text-[#171717] transition-colors duration-150"
                >
                  Settings
                </button>
                <button
                  onClick={logout}
                  className="text-sm text-[#525252] hover:text-[#171717] transition-colors duration-150"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Main content area ────────────────────────────────────────────────── */}
      {isExplorer ? (
        // Explorer: full-bleed, overflow managed internally by the canvas.
        // Background is #fafafa (Vercel sunken surface) to let white cards pop.
        <main className="flex-1 min-h-0 overflow-hidden bg-[#fafafa] safe-px">{children}</main>
      ) : (
        // Detail pages: scrollable, full-width container (no max-width cap —
        // wide screens get content, not gutters).
        <main ref={mainRef} className="flex-1 overflow-auto bg-[#fafafa] safe-px">
          <div className="px-4 sm:px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </main>
      )}

      {/* Floating AI assistant — available on every authenticated page. */}
      <AssistantWidget />

      {/* Global role drawer — any surface opens a role in place via ?role=. */}
      <RoleDrawerHost />
    </div>
  );
}
