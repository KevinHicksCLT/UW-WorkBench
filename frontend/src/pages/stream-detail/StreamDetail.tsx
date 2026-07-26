import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { useViewState } from '../../lib/viewState';
import Inspector from '../../components/Inspector';
import PageHeader from '../../components/PageHeader';
import { ListSearch } from '../../components/Sheet';
import { BackButton, Card, EmptyState, ErrorMessage, LoadingState } from '../../components/ui';

// Value-stream detail — drill target from the Value Streams TOC (mirrors the
// Standards area page). One stream expanded down the spine: L3 process areas
// as cards, L4 sub-processes as expandable rows revealing their L5 tasks.
// Clicking a TASK opens the same Inspector sidebar the List and Map use (the
// canonical node drill-down) as a right-hand slide-over — tasks only; the
// container levels drill in place. Map / List deep links stay one click away.

type Task = { id: string; name: string; sortOrder: number };
type Sub = { id: string; name: string; sortOrder: number; tasks: Task[] };
type Area = { id: string; name: string; sortOrder: number; subs: Sub[] };
type Data = {
  stream: { id: string; name: string; domain: string | null };
  totals: { areas: number; subProcesses: number; tasks: number };
  areas: Area[];
};

export default function StreamDetail() {
  const { id } = useParams();
  const { data, error, loading } = useApi<Data>(id ? `/explorer/streams/${id}` : null);
  // Search, expanded rows and the open Inspector persist per stream
  // (lib/viewState) so drilling out (e.g. to a role page) and coming back
  // lands on the same expanded view with the sidebar still open.
  const [q, setQ] = useViewState<string>(`stream.${id}.q`, '');
  const [openArr, setOpenArr] = useViewState<string[]>(`stream.${id}.open`, []);
  const open = useMemo(() => new Set(openArr), [openArr]);
  // Task clicked → the canonical Inspector sidebar over this page (tasks only).
  const [inspectorNode, setInspectorNode] = useViewState<string | null>(
    `stream.${id}.inspector`,
    null,
  );
  const toggle = (k: string) =>
    setOpenArr((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  // Search prunes the tree: an L4 stays when it or one of its tasks matches;
  // an L3 stays when any of its L4s survive.
  const areas = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data.areas;
    return data.areas
      .map((a) => ({
        ...a,
        subs: a.subs.filter(
          (s) =>
            s.name.toLowerCase().includes(needle) ||
            s.tasks.some((t) => t.name.toLowerCase().includes(needle)),
        ),
      }))
      .filter((a) => a.name.toLowerCase().includes(needle) || a.subs.length > 0);
  }, [data, q]);

  if (loading)
    return <LoadingState baseClassName="text-slate-500" message="Loading value stream…" />;
  if (error) return <ErrorMessage baseClassName="text-red-600">{error}</ErrorMessage>;
  if (!data) return null;

  const t = data.totals;
  return (
    <div>
      <BackButton className="mb-3" />
      <PageHeader
        eyebrow={data.stream.domain ?? 'Value stream'}
        title={data.stream.name}
        subtitle={`${t.areas} process areas · ${t.subProcesses} sub-processes · ${t.tasks} tasks`}
        actions={
          <div className="flex items-center gap-1.5">
            <Link
              to={`/overview?focus=${encodeURIComponent(data.stream.id)}&view=map`}
              className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
            >
              Open in map
            </Link>
            <Link
              to={`/overview?focus=${encodeURIComponent(data.stream.id)}`}
              className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
            >
              Open in list
            </Link>
          </div>
        }
      />

      <div className="flex items-center justify-end pb-2">
        <ListSearch value={q} onChange={setQ} placeholder="Search process, task…" />
      </div>

      {areas.length === 0 ? (
        <EmptyState message="Nothing matches." />
      ) : (
        <div className="space-y-4">
          {areas.map((a) => (
            <Card key={a.id} className="overflow-hidden p-0">
              <div className="px-4 py-2 border-b border-[#eaeaea] flex items-baseline gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-[#525252]">
                  {a.name}
                </span>
                <span className="text-[11px] text-[#a3a3a3] tnum">
                  {a.subs.length} sub-process{a.subs.length === 1 ? '' : 'es'}
                </span>
              </div>
              {a.subs.map((s) => {
                const expanded = open.has(s.id);
                return (
                  <div key={s.id} className="border-b border-[#f5f5f5] last:border-0">
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      aria-expanded={expanded}
                      className="w-full text-left flex items-center gap-2.5 px-4 py-2 hover:bg-[#fafafa] transition-colors duration-150"
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
                      <span className="flex-1 min-w-0 text-sm text-[#171717] font-medium truncate">
                        {s.name}
                      </span>
                      <span className="text-[11px] text-[#a3a3a3] tnum flex-shrink-0">
                        {s.tasks.length} task{s.tasks.length === 1 ? '' : 's'}
                      </span>
                    </button>
                    {expanded && (
                      <div className="pb-2 pl-11 pr-4">
                        {s.tasks.length === 0 ? (
                          <EmptyState
                            baseClassName="text-[12px] text-[#a3a3a3] italic py-1"
                            message="No tasks under this sub-process."
                          />
                        ) : (
                          <ol className="space-y-0.5">
                            {s.tasks.map((task, i) => (
                              <li key={task.id}>
                                <button
                                  type="button"
                                  onClick={() => setInspectorNode(task.id)}
                                  className={`w-full text-left flex items-start gap-2 rounded px-1 py-0.5 hover:bg-[#f0f4ff] transition-colors duration-150 ${
                                    inspectorNode === task.id ? 'bg-[#eef2ff]' : ''
                                  }`}
                                >
                                  <span className="flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-[#f5f5f5] text-[#525252] text-[10px] font-semibold mt-px tnum">
                                    {i + 1}
                                  </span>
                                  <span className="text-[13px] text-[#374151] leading-snug">
                                    {task.name}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          ))}
        </div>
      )}

      {/* Canonical Inspector — same sidebar as the List and Map views. */}
      {inspectorNode && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setInspectorNode(null)} />
          <div className="relative h-full flex">
            <Inspector
              nodeId={inspectorNode}
              onClose={() => setInspectorNode(null)}
              onRetarget={setInspectorNode}
            />
          </div>
        </div>
      )}
    </div>
  );
}
