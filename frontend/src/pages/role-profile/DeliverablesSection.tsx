import { useState } from 'react';
import { Card, EmptyState, StatusPill } from '../../components/ui';
import type { ProfileDeliverable } from './types';

// Deliverables the role is responsible for — Owner/Contributor pill + value
// stream on the collapsed row; expanding reveals the ROLE'S tasks under that
// deliverable (the "drill down on a deliverable to see the tasks" view).
export default function DeliverablesSection({
  deliverables,
}: {
  deliverables: ProfileDeliverable[];
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
      <div className="px-4 py-2.5 border-b border-[#eaeaea] flex items-baseline gap-2">
        <h2 className="text-base font-semibold text-[#171717]">Deliverables</h2>
        <span className="text-[11px] text-[#a3a3a3] tnum">{deliverables.length}</span>
      </div>
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
                  <span className="hidden sm:inline text-[11px] text-[#a3a3a3] truncate max-w-[180px]">
                    {d.valueStreamName}
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
                    <ul className="space-y-1.5">
                      {d.tasks.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <StatusPill
                            tone={t.relation === 'Lead' ? 'blue' : 'slate'}
                            className="mt-0.5 flex-shrink-0"
                          >
                            {t.relation}
                          </StatusPill>
                          <span className="min-w-0">
                            <span className="text-[#171717]">{t.name}</span>
                            {(t.l3 || t.l4) && (
                              <span className="block text-[11px] text-[#a3a3a3] truncate">
                                {[t.l3, t.l4].filter(Boolean).join(' → ')}
                              </span>
                            )}
                          </span>
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
