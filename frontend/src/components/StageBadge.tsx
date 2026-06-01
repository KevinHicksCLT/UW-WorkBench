import { STAGE_ORDER, STAGE_LABELS } from '../lib/format';
import clsx from 'clsx';

type Props = {
  stage: string;
  // compact: single pill with step number + label (tables, list rows)
  // full:    progress pip track (detail pages, side panels)
  compact?: boolean;
};

export default function StageBadge({ stage, compact = false }: Props) {
  const idx = STAGE_ORDER.indexOf(stage);
  const label = STAGE_LABELS[stage] ?? stage;

  if (compact) {
    return (
      <span className="pill-blue">
        {idx >= 0 ? `${idx + 1}. ` : ''}{label}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={STAGE_ORDER.length - 1} aria-valuenow={idx} aria-label={`Stage: ${label}`}>
      {STAGE_ORDER.map((s, i) => (
        <div
          key={s}
          className={clsx('stage-pip', i <= idx ? 'stage-pip-filled' : 'stage-pip-empty')}
          title={STAGE_LABELS[s]}
        />
      ))}
    </div>
  );
}
