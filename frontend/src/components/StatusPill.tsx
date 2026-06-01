import { STATUS_PILL_CLASS, STATUS_LABEL } from '../lib/format';

// status: an uppercase key from STATUS_PILL_CLASS (e.g. 'ON_TRACK', 'GAIN').
// The component resolves both the CSS class and the display label from format.ts,
// so the string stays in one canonical place.
export default function StatusPill({ status }: { status: string }) {
  const cls = STATUS_PILL_CLASS[status] ?? 'pill-slate';
  const label = STATUS_LABEL[status] ?? status;
  return <span className={cls}>{label}</span>;
}
