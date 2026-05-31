import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import SearchBox from './SearchBox';

const NAV = [
  { to: '/', label: 'Overview', icon: '◧' },
  { to: '/value-streams', label: 'Value Streams', icon: '⇄' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [navOpen]);

  return (
    <div className="lg:flex lg:h-screen bg-slate-50">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-brand-950 text-white safe-pt safe-px">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
              className="p-2 -ml-2 rounded-lg hover:bg-brand-900 active:bg-brand-800"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="font-bold text-base leading-tight tracking-tight truncate">Cascade</div>
              <div className="text-[10px] text-brand-300 leading-tight truncate">Transformation Platform</div>
            </div>
          </div>
        </div>
      </header>

      {/* Backdrop (mobile) */}
      {navOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-900/60 z-40"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={
          'bg-brand-950 text-brand-100 flex flex-col z-50 ' +
          'fixed inset-y-0 left-0 w-72 max-w-[85vw] transform transition-transform duration-200 ease-out ' +
          (navOpen ? 'translate-x-0' : '-translate-x-full') + ' ' +
          'lg:static lg:translate-x-0 lg:w-60 lg:max-w-none lg:transition-none'
        }
        aria-hidden={!navOpen && typeof window !== 'undefined' && window.innerWidth < 1024}
      >
        <div className="px-5 py-4 border-b border-brand-900 safe-pt flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-bold text-white text-lg tracking-tight">Cascade</div>
            <div className="text-xs text-brand-300">Transformation Platform</div>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="lg:hidden p-2 -mr-2 rounded-lg text-brand-200 hover:bg-brand-900 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <SearchBox />
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 lg:py-2.5 text-sm transition-colors ` +
                (isActive
                  ? 'bg-brand-800 text-white border-l-2 border-brand-300'
                  : 'text-brand-200 hover:bg-brand-900 hover:text-white border-l-2 border-transparent')
              }
            >
              <span className="text-brand-300 text-base w-5">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-brand-900 text-xs safe-pb">
          <div className="font-medium text-white truncate">{user?.name}</div>
          <div className="text-brand-300 truncate">{user?.email}</div>
          <button
            onClick={logout}
            className="mt-2 text-brand-300 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 lg:overflow-auto safe-px">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </main>
    </div>
  );
}
