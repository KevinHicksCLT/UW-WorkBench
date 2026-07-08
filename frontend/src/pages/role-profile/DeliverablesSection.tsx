import { useState } from 'react';
import TaskValidationControl, { type TaskValidation } from '../../components/TaskValidationControl';
import { Card, EmptyState, StatusPill } from '../../components/ui';
import SectionHeader, { StreamDot } from './SectionHeader';
import type { ProfileDeliverable } from './types';

// Deliverables the role is responsible for — Owner/Contributor pill + value
// stream on the collapsed row; expanding reveals the ROLE'S tasks under that
// deliverable (the "drill down on a deliverable to see the tasks" view), each
// with the same validation control as the task summary (one link, one truth).
export default function DeliverablesSection({
  deliverables,
  streamColor,
  onValidation,
}: {
  deliverables: ProfileDeliverable[];
  /** Stable per-value-stream color, shared with the other profile cards. */
  streamColor: Map<string, string>;
  onValidation: (nodeRoleId: string, v: TaskValidation) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Card variant="elevated" className="overflow-hidden">
      <SectionHeader
        iconClass="bg-[#eef2ff] text-[#4338ca]"
        icon={
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 8l-9-5-9 5 9 5 9-5z" />
            <path d="M3 8v8l9 5 9-5V8" />
          </svg>
        }
        title="Deliverables"
        count={deliverables.length}
      />
      {deliverables.length === 0 ? (
        <EmptyState className="px-4 py-6" message="No deliverables are linked to this role yet." />
      ) : (
        deliverables.map((d) => {
          const expanded = open.has(d.id);
          return (
            <div key={d.id} className="border-b border-[#f5f5f5] last:border-b-0">
              <button
                onClick={() => toggle(d.id)}
                aria-expanded={expanded}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-[#fafafa] transition-colors duration-150"
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
                <span className="flex-1 min-w-0 text-sm text-[#171717] truncate">{d.title}</span>
                {d.valueStreamName && (
                  <span className="hidden sm:flex items-center gap-1.5 min-w-0 max-w-[180px]">
                    <StreamDot color={streamColor.get(d.valueStreamName) ?? '#a3a3a3'} />
                    <span className="text-[11px] text-[#737373] truncate">{d.valueStreamName}</span>
                  </span>
                )}
                <StatusPill
                  tone={
                    d.role_ === 'Owner' ? 'green' : d.role_ === 'Contributor' ? 'blue' : 'slate'
                  }
                  className="flex-shrink-0"
                >
                  {d.role_ ?? 'Via tasks'}
                </StatusPill>
                <span className="text-[11px] text-[#a3a3a3] tnum flex-shrink-0 w-14 text-right">
                  {d.tasks.length} task{d.tasks.length === 1 ? '' : 's'}
                </span>
              </button>
              {expanded && (
                <div className="px-4 pb-3 pl-11">
                  {d.tasks.length === 0 ? (
                    <EmptyState message="Directly linked — none of this role's tasks sit under it." />
                  ) : (
                    <ul className="space-y-2">
                      {d.tasks.map((t) => (
                        <li key={t.nodeRoleId} className="text-sm">
                          <span className="text-[#171717]">{t.name}</span>
                          {(t.l3 || t.l4) && (
                            <span className="block text-[11px] text-[#a3a3a3] truncate">
                              {[t.l3, t.l4].filter(Boolean).join(' → ')}
                            </span>
                          )}
                          <div className="mt-1">
                            <TaskValidationControl
                              nodeRoleId={t.nodeRoleId}
                              validation={t.validation}
                              onChange={(v) => onValidation(t.nodeRoleId, v)}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </Card>
  );
}
