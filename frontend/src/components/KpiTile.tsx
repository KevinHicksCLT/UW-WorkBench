import type { ReactNode } from 'react';
import clsx from 'clsx';

// Tone controls the left-border accent and background wash.
// 'gain' / 'loss' / 'overlap' encode the value-delta story (e.g. headcount
// freed, cost leaked, dual-accountability risk). Use them only when the tile
// is reporting a directional delta, not a neutral count.
type Tone = 'neutral' | 'positive' | 'warning' | 'negative' | 'accent' | 'gain' | 'loss' | 'overlap';

type Props = {
  label: ReactNode;
  value: ReactNode;
  sublabel?: ReactNode;
  tone?: Tone;
};

const BORDER: Record<Tone, string> = {
  neutral:  'border-slate-200',
  positive: 'border-emerald-300',
  warning:  'border-amber-300',
  negative: 'border-red-300',
  accent:   'border-brand-300',
  gain:     'border-gain-400',
  loss:     'border-loss-400',
  overlap:  'border-overlap-400',
};

const BG: Record<Tone, string> = {
  neutral:  'bg-white',
  positive: 'bg-emerald-50',
  warning:  'bg-amber-50',
  negative: 'bg-red-50',
  accent:   'bg-brand-50',
  gain:     'bg-gain-50',
  loss:     'bg-loss-50',
  overlap:  'bg-overlap-50',
};

const VALUE_COLOR: Record<Tone, string> = {
  neutral:  'text-slate-900',
  positive: 'text-emerald-800',
  warning:  'text-amber-800',
  negative: 'text-red-800',
  accent:   'text-brand-800',
  gain:     'text-gain-800',
  loss:     'text-loss-800',
  overlap:  'text-overlap-800',
};

export default function KpiTile({ label, value, sublabel, tone = 'neutral' }: Props) {
  return (
    <div className={clsx('rounded-xl border-l-4 border-y border-r p-4', BORDER[tone], BG[tone])}>
      <div className="text-eyebrow uppercase text-slate-500">{label}</div>
      <div className={clsx('mt-1.5 text-2xl font-bold tnum leading-none', VALUE_COLOR[tone])}>{value}</div>
      {sublabel && <div className="mt-1 text-xs text-slate-500">{sublabel}</div>}
    </div>
  );
}
