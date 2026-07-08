import { useMemo, useState, type ReactNode } from 'react';
import { ListSearch } from '../../components/Sheet';
import { Card, EmptyState } from '../../components/ui';
import type { WorkGroup } from './workToc';

// WorkGroupDrill — the drill target of the Work TOC (mirrors the Standards
// area page): one group value expanded to its items. Deliverables render as a
// flat card; tasks cluster under their deliverable (or process L4 when the
// grouping itself is the deliverable). Clicking an item opens the same detail
// sidebar the List uses.

type DrillDeliverable = {
  id: string;
  title: string;
  valueStreamName: string | null;
  taskCount: number;
  roles: string[];
};
type DrillTask = {
  id: string;
  title: string;
  owner: string | null;
  level4: string | null;
  deliverableTitle: string | null;
};

const Chevron = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="flex-shrink-0 text-[#d4d4d4]"
    aria-hidden="true"
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export default function WorkGroupDrill({
  tab,
  group,
  value,
  deliverables,
  tasks,
  onOpenDeliverable,
  onOpenTask,
  leading,
}: {
  tab: 'deliverables' | 'tasks';
  group: WorkGroup;
  /** The group value being drilled into (e.g. a value-stream name). */
  value: string;
  deliverables: DrillDeliverable[];
  tasks: DrillTask[];
  onOpenDeliverable: (id: string) => void;
  onOpenTask: (id: string) => void;
  leading?: ReactNode; // view pills
}) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();

  const dRows = useMemo(
    () =>
      needle
        ? deliverables.filter(
            (d) =>
              d.title.toLowerCase().includes(needle) ||
              (d.valueStreamName ?? '').toLowerCase().includes(needle),
          )
        : deliverables,
    [deliverables, needle],
  );

  // Tasks cluster under their deliverable; when the grouping IS the
  // deliverable, cluster under the process L4 instead so the second tier
  // still adds information.
  const tGroups = useMemo(() => {
    const rows = needle
      ? tasks.filter(
          (t) =>
            t.title.toLowerCase().includes(needle) ||
            (t.owner ?? '').toLowerCase().includes(needle),
        )
      : tasks;
    const keyOf = (t: DrillTask) =>
      group.key === 'deliverable'
        ? (t.level4 ?? 'Other processes')
        : (t.deliverableTitle ?? 'No deliverable');
    const m = new Map<string, DrillTask[]>();
    for (const t of rows) {
      const k = keyOf(t);
      (m.get(k) ?? m.set(k, []).get(k)!).push(t);
    }
    return [...m.entries()]
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, needle, group.key]);

  const total = tab === 'deliverables' ? deliverables.length : tasks.length;

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap pb-2">
        {leading}
        <span className="hidden md:inline text-[11px] text-[#737373] whitespace-nowrap">
          <span className="uppercase tracking-[0.08em] font-semibold">{group.label}</span>
          {' · '}
          <span className="text-[#171717] font-medium">{value}</span>
          <span className="tnum">
            {' '}
            · {total} {tab}
          </span>
        </span>
        <div className="flex-1" />
        <ListSearch value={q} onChange={setQ} placeholder={`Search ${tab}…`} />
      </div>

      {tab === 'deliverables' ? (
        <Card className="overflow-hidden p-0">
          <div className="hidden sm:flex items-center px-4 py-2 border-b border-[#eaeaea] text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
            <span className="flex-1">Deliverable</span>
            <span className="w-24 text-center tnum">Tasks</span>
            <span className="w-[30%] pl-4">Value stream</span>
          </div>
          {dRows.length === 0 ? (
            <EmptyState
              message="Nothing matches."
              baseClassName="px-4 py-8 text-sm text-slate-500 italic"
            />
          ) : (
            dRows.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onOpenDeliverable(d.id)}
                className="w-full text-left flex items-center px-4 py-2 border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors duration-150"
              >
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-sm text-[#171717] truncate font-medium">{d.title}</span>
                  <Chevron />
                </div>
                <div className="w-24 text-center text-sm tnum text-[#171717]">{d.taskCount}</div>
                <div className="w-[30%] pl-4 text-sm text-[#525252] truncate">
                  {d.valueStreamName ?? <span className="text-[#a3a3a3] italic">—</span>}
                </div>
              </button>
            ))
          )}
        </Card>
      ) : tGroups.length === 0 ? (
        <EmptyState message="Nothing matches." />
      ) : (
        <div className="space-y-4">
          {tGroups.map((g) => (
            <Card key={g.name} className="overflow-hidden p-0">
              <div className="px-4 py-2 border-b border-[#eaeaea] flex items-baseline gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-[#525252]">
                  {g.name}
                </span>
                <span className="text-[11px] text-[#a3a3a3] tnum">{g.items.length}</span>
              </div>
              {g.items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenTask(t.id)}
                  className="w-full text-left flex items-center gap-3 px-4 py-2 border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors duration-150"
                >
                  <span className="flex-1 min-w-0 text-sm text-[#171717] truncate">{t.title}</span>
                  <Chevron />
                  <span className="hidden md:inline text-[11px] text-[#737373] truncate max-w-[220px]">
                    {t.owner ?? '—'}
                  </span>
                </button>
              ))}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
