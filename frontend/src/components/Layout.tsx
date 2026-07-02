import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useCompany } from '../lib/company';
import { api } from '../lib/api';
import { withCompany } from '../lib/portfolio';
import { useBreadcrumbHeader } from '../lib/breadcrumbs';
import SearchBox from './SearchBox';
import AssistantWidget from './AssistantWidget';
import BreadcrumbBar from './BreadcrumbBar';

type IndexItem = { id: string; name: string; valueStreams?: number; roles?: number };

// Tab → the page's primary list endpoint, warmed on hover/focus so the page
// paints instantly on click (api.get dedups, so the warm + the page's own fetch
// share one round-trip). Company-scoped endpoints must match the page's exact
// keyed path (withCompany), or the cache key won't match. Returns null to skip.
const PREFETCH: Record<string, (companyId: string | null) => string | null> = {
  '/overview':     () => '/explorer/tree',
  '/roles':        () => '/roles',
  '/organization': () => '/explorer/org-table',
  '/standards':    () => '/explorer/standards-flat',
  '/applications': () => '/applications',
  '/external':     () => '/external-interactions',
  '/metrics':      (c) => (c ? withCompany('/explorer/telemetry-catalog', c) : null),
  '/deliverables': (c) => (c ? withCompany('/work', c) : null),
  '/tasks':        (c) => (c ? withCompany('/work', c) : null),
  '/regulations':  (c) => (c ? withCompany('/regulations/jurisdictions', c) : null),
};

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { companies, companyId, setCompanyId } = useCompany();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [domains, setDomains] = useState<IndexItem[]>([]);
  const [divisions, setDivisions] = useState<IndexItem[]>([]);
  const isExplorer = location.pathname.startsWith('/overview') || location.pathname.startsWith('/n/')
    || location.pathname === '/roles' || location.pathname === '/organization';

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);
  useEffect(() => {
    if (!user) return;
    api.get<{ domains?: IndexItem[]; divisions?: IndexItem[] }>('/explorer/overview')
      .then((o) => { setDomains(o.domains ?? []); setDivisions(o.divisions ?? []); })
      .catch(() => {});
  }, [user]);

  const { resetToTab } = useBreadcrumbHeader();

  const here = (key: string) => location.pathname.includes(key);
  // Nav-menu navigation is an explicit fresh start — re-root the breadcrumb
  // trail at the chosen tab (no-op for non-tab URLs like the drill-down rows).
  const go = (url: string) => { resetToTab(url); navigate(url); setMobileMenuOpen(false); };

  // The portfolio drill-downs (program / initiative / RAID log) live under Home —
  // their entry points are the Home dashboard widgets, so Home stays the active tab.
  const onHome = location.pathname === '/'
    || ['/programs/', '/initiatives/', '/raid'].some((p) => location.pathname.startsWith(p));

  // ── Nav link helper ────────────────────────────────────────────────────────
  // Underline-style tab: sits on the nav row's hairline, dark indicator when active.
  // Hovering/focusing a tab warms its list endpoint's GET cache (api dedups, so a
  // warm + the page's own fetch share one round-trip) — the page paints instantly
  // on click instead of waiting on the network.
  const NavLink = ({ to, children: label }: { to: string; children: ReactNode }) => {
    const active = to === '/' ? onHome : location.pathname === to || location.pathname.startsWith(to);
    const warm = () => { const p = PREFETCH[to]?.(companyId); if (p) api.prefetch(p); };
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
    item, url, active, count, unit,
  }: { item: IndexItem; url: string; active: boolean; count?: number; unit: string }) => (
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
        <span className="text-[10px] tnum text-[#a3a3a3]">{count} {unit}</span>
      )}
    </button>
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
          <Link to="/" onClick={() => resetToTab('/')} className="flex items-baseline gap-2 flex-shrink-0 group" aria-label="Capgemini Transformation Bridge — home">
            {/* h-[20px] matches the logotype cap-height to the text; translate-y aligns its baseline */}
            <img src="/capgemini-wordmark.svg" alt="Capgemini" className="h-[20px] w-auto translate-y-[5.5px]" />
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
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
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
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {/* Custom chevron */}
                  <svg
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a3a3a3]"
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
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

          {/* User + sign-out — desktop */}
          <div className="hidden sm:flex items-center gap-3 pl-1">
            <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#f5f5f5] text-[11px] font-semibold text-[#525252] flex-shrink-0" aria-hidden="true">
              {(user?.name ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="text-sm text-[#525252] truncate max-w-[140px]">{user?.name}</span>
            <button
              onClick={logout}
              className="text-sm text-[#525252] hover:text-[#171717] transition-colors duration-150"
            >
              Sign out
            </button>
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            )}
          </button>
        </div>

        {/* Row 2 — full-width tab bar (desktop) */}
        <nav
          className="hidden sm:flex items-center gap-7 px-4 sm:px-6 border-b border-[#eaeaea] overflow-x-auto"
          aria-label="Main navigation"
        >
          <NavLink to="/">Home</NavLink>
          <NavLink to="/overview">Value Streams</NavLink>
          <NavLink to="/roles">Roles</NavLink>
          <NavLink to="/organization">Organization</NavLink>
          <NavLink to="/standards">Standards</NavLink>
          <NavLink to="/regulations">Regulations</NavLink>
          <NavLink to="/metrics">Metrics</NavLink>
          <NavLink to="/portfolio">Workspace</NavLink>
          <NavLink to="/deliverables">Deliverables</NavLink>
          <NavLink to="/tasks">Tasks</NavLink>
          <NavLink to="/work-library">Work Library</NavLink>
          <NavLink to="/automatable">Automatable</NavLink>
          <NavLink to="/applications">Applications</NavLink>
          <NavLink to="/external">Third-Parties</NavLink>
          {user?.role === 'ADMIN' && <NavLink to="/admin">Data Admin</NavLink>}
        </nav>

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
                <label className="block text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">Company</label>
                <select
                  className="w-full rounded-md border border-[#eaeaea] bg-white px-2 py-1.5 text-sm text-[#171717]"
                  value={companyId ?? ''}
                  onChange={(e) => setCompanyId(e.target.value)}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Nav links */}
            <div className="py-1">
              <button
                onClick={() => go('/')}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (onHome ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
              >
                Home
              </button>
              <button
                onClick={() => go('/overview')}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (here('/overview') ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
              >
                Value Streams
              </button>
              <button
                onClick={() => go('/roles')}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (here('/roles') ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
              >
                Roles
              </button>
              <button
                onClick={() => go('/organization')}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (here('/organization') ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
              >
                Organization
              </button>
              <button
                onClick={() => go('/standards')}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (here('/standards') ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
              >
                Standards
              </button>
              <button
                onClick={() => go('/regulations')}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (here('/regulations') ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
              >
                Regulations
              </button>
              <button
                onClick={() => go('/metrics')}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (here('/metrics') ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
              >
                Metrics
              </button>
              <button
                onClick={() => go('/portfolio')}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (here('/portfolio') ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
              >
                Workspace
              </button>
              <button
                onClick={() => go('/deliverables')}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (here('/deliverables') ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
              >
                Deliverables
              </button>
              <button
                onClick={() => go('/tasks')}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (here('/tasks') ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
              >
                Tasks
              </button>
              <button
                onClick={() => go('/work-library')}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (here('/work-library') ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
              >
                Work Library
              </button>
              <button
                onClick={() => go('/automatable')}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (here('/automatable') ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
              >
                Automatable
              </button>
              <button
                onClick={() => go('/applications')}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (here('/applications') ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
              >
                Applications
              </button>
              <button
                onClick={() => go('/external')}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (here('/external') ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
              >
                Third-Parties
              </button>
              {user?.role === 'ADMIN' && (
                <button
                  onClick={() => go('/admin')}
                  className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (here('/admin') ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
                >
                  Data Admin
                </button>
              )}
            </div>

            {/* Operating Model */}
            {domains.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
                  Operating Model
                </div>
                {domains.map((d) => (
                  <MobileRow key={d.id} item={d} url={`/n/domain:${d.id}`} active={here(`domain:${d.id}`)} count={d.valueStreams} unit="streams" />
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
                  <MobileRow key={d.id} item={d} url={`/n/division:${d.id}`} active={here(`division:${d.id}`)} count={d.roles} unit="roles" />
                ))}
              </>
            )}

            {/* Sign out */}
            <div className="px-4 py-3 border-t border-[#eaeaea] mt-1">
              <div className="text-sm font-medium text-[#171717]">{user?.name}</div>
              <div className="text-[11px] text-[#a3a3a3] mt-0.5">{user?.email}</div>
              <button onClick={logout} className="mt-2 text-sm text-[#525252] hover:text-[#171717] transition-colors duration-150">
                Sign out
              </button>
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
        <main className="flex-1 overflow-auto bg-[#fafafa] safe-px">
          <div className="px-4 sm:px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </main>
      )}

      {/* Floating AI assistant — available on every authenticated page. */}
      <AssistantWidget />
    </div>
  );
}
