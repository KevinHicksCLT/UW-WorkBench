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
  const [navOpen, setNavOpen] = useState(false);
  const [domains, setDomains] = useState<IndexItem[]>([]);
  const [divisions, setDivisions] = useState<IndexItem[]>([]);
  const isExplorer = location.pathname === '/' || location.pathname.startsWith('/n/');

  useEffect(() => { setNavOpen(false); }, [location.pathname]);
  useEffect(() => { document.body.style.overflow = navOpen ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [navOpen]);
  useEffect(() => {
    if (!user) return;
    api.get('/explorer/overview').then((o) => { setDomains(o.domains ?? []); setDivisions(o.divisions ?? []); }).catch(() => {});
  }, [user]);

  const here = (key: string) => location.pathname.includes(key);
  const go = (url: string) => { navigate(url); setNavOpen(false); };

  const IndexRow = ({ item, url, active, count, unit }: { item: IndexItem; url: string; active: boolean; count?: number; unit: string }) => (
    <button
      onClick={() => go(url)}
      className={'w-full flex items-center gap-2 pl-5 pr-3 py-2 text-sm text-left border-l-2 transition-colors group ' +
        (active ? 'bg-brand-800 text-white border-accent-400' : 'text-brand-200 hover:bg-brand-900 hover:text-white border-transparent')}
    >
      <span className="truncate flex-1">{item.name}</span>
      {count != null && <span className={'text-[10px] tnum ' + (active ? 'text-brand-200' : 'text-brand-400')}>{count} {unit}</span>}
      <span className={'text-base leading-none ' + (active ? 'text-accent-300' : 'text-brand-500 group-hover:text-accent-300')}>›</span>
    </button>
  );

  return (
    <div className="lg:flex lg:h-screen bg-slate-50">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-brand-950 text-white safe-pt safe-px">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-brand-900 active:bg-brand-800">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
            <div className="min-w-0"><div className="font-bold text-base leading-tight tracking-tight truncate">Strata</div><div className="text-[10px] text-brand-300 leading-tight truncate">Operating Model Intelligence</div></div>
          </div>
        </div>
      </header>

      {navOpen && <div className="lg:hidden fixed inset-0 bg-slate-900/60 z-40" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      {/* Sidebar — navigable index: both ways into the model */}
      <aside
        className={'bg-brand-950 text-brand-100 flex flex-col z-50 fixed inset-y-0 left-0 w-72 max-w-[85vw] transform transition-transform duration-200 ease-out ' +
          (navOpen ? 'translate-x-0' : '-translate-x-full') + ' lg:static lg:translate-x-0 lg:w-64 lg:max-w-none lg:transition-none'}
        aria-hidden={!navOpen && typeof window !== 'undefined' && window.innerWidth < 1024}
      >
        <div className="px-5 py-4 border-b border-brand-900 safe-pt flex items-center justify-between gap-3">
          <Link to="/" className="min-w-0 group"><div className="font-bold text-white text-lg tracking-tight group-hover:text-brand-200">Strata</div><div className="text-xs text-brand-300">Operating Model Intelligence</div></Link>
          <button type="button" aria-label="Close navigation" onClick={() => setNavOpen(false)} className="lg:hidden p-2 -mr-2 rounded-lg text-brand-200 hover:bg-brand-900 hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <SearchBox />

        <nav className="flex-1 py-3 overflow-y-auto">
          <button onClick={() => go('/')} className={'w-full flex items-center gap-3 px-5 py-2.5 text-sm border-l-2 transition-colors ' + (location.pathname === '/' ? 'bg-brand-800 text-white border-accent-400' : 'text-brand-100 hover:bg-brand-900 hover:text-white border-transparent')}>
            <span className="text-accent-300">◈</span> Company overview
          </button>

          <div className="px-5 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-brand-400">How it operates</div>
          {domains.length === 0 ? <div className="px-5 py-1 text-[11px] text-brand-500">Loading…</div> :
            domains.map((d) => <IndexRow key={d.id} item={d} url={`/n/domain:${d.id}`} active={here(`domain:${d.id}`)} count={d.valueStreams} unit="streams" />)}

          <div className="px-5 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-brand-400">Who runs it</div>
          {divisions.length === 0 ? <div className="px-5 py-1 text-[11px] text-brand-500">Loading…</div> :
            divisions.map((d) => <IndexRow key={d.id} item={d} url={`/n/division:${d.id}`} active={here(`division:${d.id}`)} count={d.roles} unit="roles" />)}

          <div className="px-5 pt-4 text-[10px] text-brand-500/80 leading-relaxed">Pick a domain to follow the work end-to-end, or a division to see its people. Anything with a › digs deeper.</div>
        </nav>

        <div className="px-5 py-4 border-t border-brand-900 text-xs safe-pb">
          <div className="font-medium text-white truncate">{user?.name}</div>
          <div className="text-brand-300 truncate">{user?.email}</div>
          <button onClick={logout} className="mt-2 text-brand-300 hover:text-white">Sign out</button>
        </div>
      </aside>

      {isExplorer ? (
        <main className="flex-1 min-h-0 lg:overflow-hidden safe-px">{children}</main>
      ) : (
        <main className="flex-1 lg:overflow-auto safe-px">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
        </main>
      )}
    </div>
  );
}
