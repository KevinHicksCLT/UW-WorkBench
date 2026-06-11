import { Link } from 'react-router-dom';
import { useBreadcrumbHeader, type Crumb } from '../lib/breadcrumbs';

// ── Global breadcrumb bar ────────────────────────────────────────────────────
// The single breadcrumb of the app — a slim row in the Layout header, below
// the tab bar. Shows the visited-path trail (lib/breadcrumbs), which persists
// across tab jumps so every crumb leads back to exactly where the user was.
// Map views claim the bar and portal their own drill breadcrumb into the slot
// div instead (the slot stays mounted — hidden — so portals always have a
// target). Hidden entirely on Home (empty trail, nothing claimed).

// Long trails collapse the middle: Home › … › last four crumbs.
const MAX_CRUMBS = 6;
function visibleCrumbs(trail: Crumb[]): (Crumb | null)[] {
  if (trail.length <= MAX_CRUMBS) return trail;
  return [trail[0], null, ...trail.slice(trail.length - (MAX_CRUMBS - 2))]; // null = ellipsis
}

export default function BreadcrumbBar() {
  const { trail, headerClaimed, setHeaderSlot } = useBreadcrumbHeader();
  const show = headerClaimed || trail.length > 0;

  return (
    <div className={(show ? 'flex' : 'hidden') + ' items-center min-h-[30px] px-4 sm:px-6 py-1 border-b border-[#eaeaea] bg-white overflow-x-auto'}>
      {/* Portal target for map drill breadcrumbs — always mounted. */}
      <div ref={setHeaderSlot} className={headerClaimed ? 'flex items-center flex-wrap min-w-0' : 'hidden'} />

      {!headerClaimed && trail.length > 0 && (
        <nav className="flex items-center whitespace-nowrap" aria-label="Breadcrumb">
          {visibleCrumbs(trail).map((c, i) => {
            if (c === null) {
              return (
                <span key="ellipsis" className="inline-flex items-center">
                  <span style={{ color: '#d4d4d4', margin: '0 4px' }}>›</span>
                  <span className="text-[11px] text-[#a3a3a3] px-0.5">…</span>
                </span>
              );
            }
            const isLast = c === trail[trail.length - 1];
            return (
              <span key={c.to + i} className="inline-flex items-center">
                {i > 0 && <span style={{ color: '#d4d4d4', margin: '0 4px' }}>›</span>}
                {isLast ? (
                  <span className="focus-crumb-active" aria-current="page">{c.label}</span>
                ) : (
                  <Link to={c.to} className="focus-crumb-ancestor">{c.label}</Link>
                )}
              </span>
            );
          })}
        </nav>
      )}
    </div>
  );
}
