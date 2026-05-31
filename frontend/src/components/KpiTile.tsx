import type { ReactNode } from 'react';
import clsx from 'clsx';

type Tone = 'neutral' | 'positive' | 'warning' | 'negative' | 'accent';

type Props = {
  label: ReactNode;
  value: ReactNode;
  sublabel?: ReactNode;
  tone?: Tone;
};

export default function KpiTile({ label, value, sublabel, tone = 'neutral' }: Props) {
  const tones: Record<Tone, string> = {
    neutral: 'border-slate-200',
    positive: 'border-emerald-300 bg-emerald-50',
    warning: 'border-amber-300 bg-amber-50',
    negative: 'border-red-300 bg-red-50',
    accent: 'border-brand-300 bg-brand-50',
  };
  return (
    <div className={clsx('rounded-xl border p-4 bg-white', tones[tone])}>
      <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {sublabel && <div className="mt-0.5 text-xs text-slate-500">{sublabel}</div>}
    </div>
  );
}
