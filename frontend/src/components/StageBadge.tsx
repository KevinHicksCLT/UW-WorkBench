import { STAGE_ORDER, STAGE_LABELS } from '../lib/format';
import clsx from 'clsx';

export default function StageBadge({ stage, compact = false }: { stage: string; compact?: boolean }) {
  const idx = STAGE_ORDER.indexOf(stage);
  if (compact) {
    return (
      <span className="pill-blue">
        {idx + 1}. {STAGE_LABELS[stage]}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {STAGE_ORDER.map((s, i) => (
        <div
          key={s}
          className={clsx(
            'h-1.5 rounded-full transition-colors',
            i <= idx ? 'bg-brand-600' : 'bg-slate-200',
            'flex-1 min-w-[20px]'
          )}
          title={STAGE_LABELS[s]}
        />
      ))}
    </div>
  );
}
