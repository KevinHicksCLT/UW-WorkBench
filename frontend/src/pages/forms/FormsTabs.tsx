import { NavLink } from 'react-router-dom';

// In-page sub-navigation for the Forms module (one 'forms' menu key owns all
// routes; tabs are a presentation concern, mirroring the Regulations pages).
const TABS = [
  { to: '/forms', label: 'Library', end: true },
  { to: '/forms/working-sets', label: 'Working Sets', end: false },
  { to: '/forms/field-dictionary', label: 'Field Dictionary', end: true },
] as const;

export function FormsTabs() {
  return (
    <div className="flex items-center gap-1 mb-4 border-b border-[#eaeaea]">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            'px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ' +
            (isActive
              ? 'border-[#0070AD] text-[#0070AD]'
              : 'border-transparent text-[#666666] hover:text-[#171717]')
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
