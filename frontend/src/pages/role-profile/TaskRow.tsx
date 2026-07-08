import { useState } from 'react';
import { Link } from 'react-router-dom';
import TaskValidationControl, { type TaskValidation } from '../../components/TaskValidationControl';
import type { ProfileTask } from './types';

// One numbered task row inside a deliverable card — step circle, expandable
// name (chevron → the task's ordered checklist steps + L3 → L4 process path),
// the applications it is performed in (amber tags linking to the Applications
// tab), and the validation control.
export default function TaskRow({
  task,
  ordinal,
  onValidation,
}: {
  task: ProfileTask;
  /** 1-based position of the task within its deliverable (display order). */
  ordinal: number;
  onValidation: (nodeRoleId: string, v: TaskValidation) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-[#f0f0f0] last:border-b-0">
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        {/* Step circle */}
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold flex-shrink-0 mt-0.5 bg-[#065f46] text-white"
          aria-hidden="true"
        >
          {ordinal}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="flex items-center gap-2 min-w-0 flex-1 text-left group"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={
                  'flex-shrink-0 text-[#a3a3a3] transition-transform duration-150 ' +
                  (expanded ? 'rotate-90' : '')
                }
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6d28d9] bg-[#f5f3ff] rounded px-1 py-0.5 flex-shrink-0">
                Task
              </span>
              <span className="min-w-0 text-sm text-[#171717] truncate group-hover:underline">
                {task.name}
              </span>
              {task.checklist.length > 0 && (
                <span className="text-[10px] text-[#a3a3a3] tnum flex-shrink-0">
                  {task.checklist.length} steps
                </span>
              )}
            </button>
            {task.apps.slice(0, 2).map((a) => (
              <Link
                key={a.id}
                to={`/applications?focus=${encodeURIComponent(a.id)}`}
                className="hidden md:inline-flex items-center rounded-md border border-[#fcd34d] bg-[#fffbeb] px-1.5 py-0.5 text-[11px] text-[#92400e] max-w-[150px] truncate hover:border-[#f59e0b] transition-colors duration-150"
                title={a.name}
              >
                {a.name}
              </Link>
            ))}
            {task.apps.length > 2 && (
              <span className="hidden md:inline text-[10px] text-[#a3a3a3] flex-shrink-0">
                +{task.apps.length - 2}
              </span>
            )}
          </div>

          <div className="mt-1.5">
            <TaskValidationControl
              nodeRoleId={task.nodeRoleId}
              validation={task.validation}
              onChange={(v) => onValidation(task.nodeRoleId, v)}
            />
          </div>

          {expanded && (
            <div className="mt-2 mb-1 rounded-md border border-[#d1fae5] bg-[#f0fdf9] overflow-hidden">
              <div className="px-3 py-1.5 border-b border-[#d1fae5] flex items-center gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#047857]">
                  Checklist · in order
                </span>
                <span className="text-[10px] text-[#059669] tnum">
                  {task.checklist.length} step{task.checklist.length === 1 ? '' : 's'}
                </span>
                <span className="flex-1" />
                <span className="text-[10px] text-[#6b7280] truncate max-w-[280px]">
                  {[task.l3, task.l4].filter(Boolean).join(' → ')}
                </span>
              </div>
              {task.checklist.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-[#6b7280]">
                  No checklist steps are wired to this task yet.
                </div>
              ) : (
                task.checklist.map((s, i) => (
                  <div
                    key={s.id}
                    className="flex items-start gap-2 px-3 py-1.5 border-b border-[#e6f7f0] last:border-b-0"
                  >
                    <span className="flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-[#a7f3d0] text-[#065f46] text-[10px] font-semibold mt-px">
                      {i + 1}
                    </span>
                    <span className="text-[12px] text-[#374151] leading-snug">{s.text}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
