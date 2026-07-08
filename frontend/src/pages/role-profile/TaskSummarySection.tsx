import { useMemo, useState } from 'react';
import TaskValidationControl, {
  ValidationPill,
  type TaskValidation,
} from '../../components/TaskValidationControl';
import { Card, Chip, EmptyState, Select } from '../../components/ui';
import SectionHeader, { StreamDot } from './SectionHeader';
import type { ProfileTask } from './types';

// Task list summary — collapsed rows show task · value stream · validation
// state; expanding a row reveals the L3 → L4 process path, the deliverables
// the task is tied to, and the validation control ("do I actually do this?").
// A value-stream filter keeps big roles scannable.
export default function TaskSummarySection({
  tasks,
  streamColor,
  onValidation,
}: {
  tasks: ProfileTask[];
  /** Stable per-value-stream color, shared with the other profile cards. */
  streamColor: Map<string, string>;
  onValidation: (nodeRoleId: string, v: TaskValidation) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [vsFilter, setVsFilter] = useState('');

  const streams = useMemo(
    () => [...new Set(tasks.map((t) => t.valueStreamName))].sort((a, b) => a.localeCompare(b)),
    [tasks],
  );
  const visible = vsFilter ? tasks.filter((t) => t.valueStreamName === vsFilter) : tasks;

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
        iconClass="bg-[#e0f2fe] text-[#0369a1]"
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
            <path d="M9 6h11M9 12h11M9 18h11" />
            <path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
          </svg>
        }
        title="Task Summary"
        count={
          <>
            {visible.length}
            {vsFilter ? ` of ${tasks.length}` : ''}
          </>
        }
        right={
          streams.length > 1 ? (
            <Select
              aria-label="Filter by value stream"
              value={vsFilter}
              onChange={(e) => setVsFilter(e.target.value)}
              className="ml-auto !py-1 text-xs max-w-[240px]"
            >
              <option value="">All value streams</option>
              {streams.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      />
      {visible.length === 0 ? (
        <EmptyState className="px-4 py-6" message="No tasks are assigned to this role yet." />
      ) : (
        visible.map((t) => {
          const expanded = open.has(t.nodeId);
          return (
            <div key={t.nodeId} className="border-b border-[#f5f5f5] last:border-b-0">
              <button
                onClick={() => toggle(t.nodeId)}
                aria-expanded={expanded}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-[#fafafa] transition-colors duration-150"
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
                <span className="flex-1 min-w-0 text-sm text-[#171717] truncate">{t.name}</span>
                <span className="hidden sm:flex items-center gap-1.5 min-w-0 max-w-[180px]">
                  <StreamDot color={streamColor.get(t.valueStreamName) ?? '#a3a3a3'} />
                  <span className="text-[11px] text-[#737373] truncate">{t.valueStreamName}</span>
                </span>
                <ValidationPill validation={t.validation} />
              </button>
              {expanded && (
                <div className="px-4 pb-3 pl-11 space-y-1.5 text-sm">
                  <TaskValidationControl
                    nodeRoleId={t.nodeRoleId}
                    validation={t.validation}
                    onChange={(v) => onValidation(t.nodeRoleId, v)}
                  />
                  <div className="text-[11px] text-[#666666]">
                    <span className="font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mr-1.5">
                      Where
                    </span>
                    {[t.valueStreamName, t.l3, t.l4].filter(Boolean).join(' → ') || '—'}
                  </div>
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mt-0.5">
                      Deliverables
                    </span>
                    {t.deliverables.length === 0 ? (
                      <span className="text-[11px] text-[#a3a3a3]">none linked</span>
                    ) : (
                      t.deliverables.map((d) => (
                        <Chip key={d.id} variant="soft">
                          {d.title}
                        </Chip>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </Card>
  );
}
