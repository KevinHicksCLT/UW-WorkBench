import { STATUS_PILL_CLASS, STATUS_LABEL } from '../lib/format.js';

export default function StatusPill({ status }) {
  const cls = STATUS_PILL_CLASS[status] || 'pill-slate';
  const label = STATUS_LABEL[status] || status;
  return <span className={cls}>{label}</span>;
}
