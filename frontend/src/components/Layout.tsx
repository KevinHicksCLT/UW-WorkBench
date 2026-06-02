import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import SearchBox from './SearchBox';

type IndexItem = { id: string; name: string; valueStreams?: number; roles?: number };

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [domains, setDomains] = useState<IndexItem[]>([]);
  const [divisions, setDivisions] = useState<IndexItem[]>([]);
  const isExplorer = location.pathname === '/' || location.pathname.startsWith('/n/');

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);
  useEffect(() => {
    if (!user) return;
    api.get('/explorer/overview')
      .then((o) => { setDomains(o.domains ?? []); setDivisions(o.divisions ?? []); })
      .catch(() => {});
  }, [user]);

  const here = (key: string) => location.pathname.includes(key);
  const go = (url: string) => { navigate(url); setMobileMenuOpen(false); };

  // ── Nav link helper ────────────────────────────────────────────────────────
  const NavLink = ({ to, children: label }: { to: string; children: ReactNode }) => {
    const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
    return (
      <Link
        to={to}
        className={
          'inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ' +
          (active
            ? 'bg-[#f5f5f5] text-[#171717]'
            : 'text-[#525252] hover:text-[#171717] hover:bg-[#fafafa]')
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

      {/* ── Top navigation bar ──────────────────────────────────────────────── */}
      {/* Vercel-style: white background, hairline bottom border, wordmark left,
          sparse nav links, sign-out right. Stays mounted at all screen sizes. */}
      <header className="flex-shrink-0 z-30 bg-white border-b border-[#eaeaea] safe-pt safe-px">
        <div className="flex items-center gap-4 px-4 sm:px-6 h-12">

          {/* Wordmark */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0 group" aria-label="Capgemini Transformation Bridge — home">
            <img src="/capgemini-logo.svg" alt="" className="h-[24px] w-auto" />
            <span className="font-semibold text-[#171717] text-[15px] tracking-tight whitespace-nowrap group-hover:text-[#525252] transition-colors duration-150">
              Capgemini Transformation Bridge
            </span>
          </Link>

          {/* Separator */}
          <span className="text-[#eaeaea] select-none hidden sm:inline">/</span>

          {/* Desktop nav links */}
          <nav className="hidden sm:flex items-center gap-1" aria-label="Main navigation">
            <NavLink to="/">Explorer</NavLink>
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search — desktop */}
          <div className="hidden md:block w-64">
            <SearchBox />
          </div>

          {/* User + sign-out — desktop */}
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm text-[#525252] truncate max-w-[160px]">{user?.name}</span>
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

            {/* Nav links */}
            <div className="py-1">
              <button
                onClick={() => go('/')}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ' + (location.pathname === '/' ? 'bg-[#fafafa] text-[#171717] font-medium' : 'text-[#525252]')}
              >
                Explorer
              </button>
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
        // Detail pages: scrollable, centred max-width container.
        <main className="flex-1 overflow-auto bg-[#fafafa] safe-px">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </main>
      )}
    </div>
  );
}
