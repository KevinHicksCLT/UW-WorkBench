import type { ReactNode } from 'react';
import { Card } from './ui';

/**
 * Small KPI stat tile — label over value with an optional hint line. `tone`
 * colors the value (negative = attention red, positive = healthy green).
 */
export function Tile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const color =
    tone === 'positive'
      ? 'text-[#047857]'
      : tone === 'negative'
        ? 'text-[#be123c]'
        : 'text-[#171717]';
  return (
    <Card className="p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]">
        {label}
      </div>
      <div className={'mt-1 text-xl font-bold tnum ' + color}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-[#a3a3a3]" title={hint}>{hint}</div>}
    </Card>
  );
}
