import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

const NAV = [
  { to: '/', label: 'Portfolio', icon: '◧' },
  { to: '/programs', label: 'Programs', icon: '⌘' },
  { to: '/raid', label: 'RAID', icon: '⚠' },
  { to: '/okrs', label: 'OKRs', icon: '◎' },
  { to: '/rules', label: 'Rules', icon: '⚙' },
  { to: '/audit', label: 'Audit', icon: '☱' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-60 bg-brand-950 text-brand-100 flex flex-col">
        <div className="px-5 py-4 border-b border-brand-900">
          <div className="font-bold text-white text-lg tracking-tight">Cascade</div>
          <div className="text-xs text-brand-300">Transformation Platform</div>
        </div>
        <nav className="flex-1 py-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ` +
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
        <div className="px-5 py-4 border-t border-brand-900 text-xs">
          <div className="font-medium text-white">{user?.name}</div>
          <div className="text-brand-300 truncate">{user?.email}</div>
          <button
            onClick={logout}
            className="mt-2 text-brand-300 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
