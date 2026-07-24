import { useState } from 'react';
import type { TaskValidation } from '../../components/TaskValidationControl';
import { Card, StatusPill } from '../../components/ui';
import TaskRow from './TaskRow';
import type { ProfileTask } from './types';

// One deliverable card — collapsed it reads "DELIVERABLE · title · N tasks ·
// N reviewed"; expanded it lists the role's tasks under it in step order,
// each with apps, validation, and a drill-down checklist.
export default function DeliverableCard({
  title,
  tasks,
  defaultOpen = false,
  onValidation,
}: {
  title: string;
  /** The role's tasks under this deliverable, already sorted by step order. */
  tasks: ProfileTask[];
  defaultOpen?: boolean;
  onValidation: (nodeRoleId: string, v: TaskValidation) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reviewed = tasks.filter((t) => t.validation.status !== 'UNREVIEWED').length;

  return (
    <Card
      variant="elevated"
      className={`overflow-hidden ${open ? 'border-l-4 border-l-[#cbd5e1]' : ''}`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-[#fafafa] transition-colors duration-150"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={
            'flex-shrink-0 text-[#737373] transition-transform duration-150 ' +
            (open ? 'rotate-90' : '')
          }
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#525252] bg-[#f0f1f3] rounded px-1.5 py-0.5 flex-shrink-0">
          Deliverable
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold text-[#171717] truncate">
          {title}
        </span>
        {open ? (
          <StatusPill tone={reviewed === tasks.length && tasks.length > 0 ? 'green' : 'slate'}>
            {reviewed} of {tasks.length} reviewed
          </StatusPill>
        ) : (
          <span className="text-[11px] text-[#737373] tnum flex-shrink-0">
            {tasks.length} task{tasks.length === 1 ? '' : 's'} · {reviewed} reviewed
          </span>
        )}
      </button>
      {open && (
        <div className="border-t border-[#eaeaea]">
          {tasks.map((t, i) => (
            <TaskRow key={t.nodeRoleId} task={t} ordinal={i + 1} onValidation={onValidation} />
          ))}
        </div>
      )}
    </Card>
  );
}
