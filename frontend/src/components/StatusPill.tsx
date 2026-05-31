import { STATUS_PILL_CLASS, STATUS_LABEL } from '../lib/format';

export default function StatusPill({ status }: { status: string }) {
  const cls = STATUS_PILL_CLASS[status] || 'pill-slate';
  const label = STATUS_LABEL[status] || status;
  return <span className={cls}>{label}</span>;
}
