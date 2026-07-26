import { Link, useLocation } from 'react-router-dom';
import { useBreadcrumbHeader, type Crumb } from '../lib/breadcrumbs';
import { useSmartBack } from '../lib/navBack';

// ── Global breadcrumb bar ────────────────────────────────────────────────────
// THE breadcrumb of the app — a slim row in the Layout header, below the tab
// bar. Shows the visited-path trail (lib/breadcrumbs), which persists across
// tab jumps so every crumb leads back to exactly where the user was. Hidden
// on Home (empty trail). No other surface renders a competing trail.

// Long trails collapse the middle: Home › … › last four crumbs.
const MAX_CRUMBS = 6;
function visibleCrumbs(trail: Crumb[]): (Crumb | null)[] {
  if (trail.length <= MAX_CRUMBS) return trail;
  return [trail[0], null, ...trail.slice(trail.length - (MAX_CRUMBS - 2))]; // null = ellipsis
}

export default function BreadcrumbBar() {
  const { trail } = useBreadcrumbHeader();
  const back = useSmartBack();
  const { pathname } = useLocation();
  // The bar (and its back button) shows on every page except Home — even when
  // the trail is empty (deep-linked or error pages), the way back stays visible.
  const show = trail.length > 0 || pathname !== '/';

  return (
    <div
      className={
        (show ? 'flex' : 'hidden') +
        ' items-center min-h-[26px] px-4 sm:px-6 py-0.5 border-b border-[#eaeaea] bg-white overflow-x-auto'
      }
    >
      {/* Always-visible back affordance — one predictable place to go back
          from any drill level (smart back: history, else in-app fallback).
          Dark pill so it reads as the primary way back, not chrome. */}
      <button
        type="button"
        onClick={back}
        aria-label="Go back"
        title="Back to the previous screen"
        className="mr-2 shrink-0 inline-flex h-[20px] items-center gap-1 rounded-full bg-[#171717] px-2.5 text-[11px] font-semibold leading-none text-white hover:bg-[#404040] transition-colors duration-150"
      >
        <span aria-hidden="true">←</span> Back
      </button>
      {trail.length > 0 && (
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
                  <span className="focus-crumb-active" aria-current="page">
                    {c.label}
                  </span>
                ) : (
                  <Link to={c.to} className="focus-crumb-ancestor">
                    {c.label}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
      )}
    </div>
  );
}
