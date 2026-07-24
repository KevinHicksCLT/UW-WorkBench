import { useSmartBack } from '../../lib/navBack';

/**
 * History back button for drill-down pages. Emits
 * `class="btn-back [className]"` — base class first, extra `className`
 * appended verbatim (same contract as every ui component). Uses the shared
 * smart-back behavior (lib/navBack): steps one history entry back so the
 * previous screen returns in its prior state, or — when the app was entered
 * directly on this page and there is nothing to go back to — navigates to
 * `fallback` instead so the button always leads somewhere sensible.
 */
export function BackButton({
  className,
  fallback = '/',
  label = 'Back',
}: {
  className?: string;
  /** Where to go when there is no in-app history (deep link / refresh). */
  fallback?: string;
  /** Visible text after the arrow, e.g. "Back to Regulations". */
  label?: string;
}) {
  const back = useSmartBack(fallback);
  const base =
    'rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150';
  return (
    <button type="button" onClick={back} className={className ? `${base} ${className}` : base}>
      ← {label}
    </button>
  );
}
