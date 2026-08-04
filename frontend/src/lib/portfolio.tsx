import type { ReactNode } from 'react';
import { Card } from '../components/ui';

// Shared UI primitives + query helpers carried over from the Transformation
// Bridge portfolio lib — only the pieces the UW Workbench pages use.

// Append the active company to an API path (the backend scopes every UW read
// to tenant + active company).
export function withCompany(path: string, companyId: string | null): string {
  if (!companyId) return path;
  return path + (path.includes('?') ? '&' : '?') + `companyId=${companyId}`;
}

// ─── Layout primitives ──────────────────────────────────────────────────────
export function Tile({
  label,
  value,
  hint,
  tone = 'neutral',
  compact = false,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'negative';
  compact?: boolean;
  /** When set, the tile is a drill-down affordance — clickable with hover ring. */
  onClick?: () => void;
}) {
  const color =
    tone === 'positive'
      ? 'text-[#047857]'
      : tone === 'negative'
        ? 'text-[#be123c]'
        : 'text-[#171717]';
  const drill = onClick
    ? {
        onClick,
        role: 'button' as const,
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};
  const drillClass = onClick
    ? ' cursor-pointer transition-shadow duration-150 hover:ring-1 hover:ring-[#d4d4d4]'
    : '';
  if (compact) {
    // Denser stat for headline strips — smaller box.
    return (
      <Card
        variant="elevated"
        className={`px-3 py-2 text-center flex flex-col justify-center${drillClass}`}
        {...drill}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#a3a3a3]">
          {label}
        </div>
        <div className={`text-lg font-semibold tnum leading-tight ${color}`}>{value}</div>
        {hint && <div className="text-[10px] text-[#a3a3a3] leading-tight">{hint}</div>}
      </Card>
    );
  }
  return (
    <Card
      variant="elevated"
      className={`p-4 text-center flex flex-col justify-center${drillClass}`}
      {...drill}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">
        {label}
      </div>
      <div className={`text-2xl font-semibold mt-1 tnum ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-[#a3a3a3] mt-0.5">{hint}</div>}
    </Card>
  );
}
