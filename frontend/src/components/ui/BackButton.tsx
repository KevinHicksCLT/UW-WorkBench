import { useNavigate } from 'react-router-dom';

/**
 * History back button for drill-down pages. Emits
 * `class="btn-back [className]"` — base class first, extra `className`
 * appended verbatim (same contract as every ui component). Navigates one
 * history entry back so the previous screen returns in its prior state.
 */
export function BackButton({ className }: { className?: string }) {
  const navigate = useNavigate();
  const base =
    'rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150';
  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className={className ? `${base} ${className}` : base}
    >
      ← Back
    </button>
  );
}
