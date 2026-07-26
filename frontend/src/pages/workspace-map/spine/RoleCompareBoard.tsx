import { useEffect, useMemo } from 'react';
import { EmptyState, ErrorMessage, LoadingState } from '../../../components/ui';
import { useViewState } from '../../../lib/viewState';
import LensBar, { type WorkspaceLens } from '../LensBar';
import { AMBER, INDIGO } from '../types';
import { Picker, ConsolidationRail, type PoolOption } from './SpineBoard';
import { LaneChip, MapCard, TaskCard, clamp2 } from './mapCards';
import { compareSpineColumns, type SpineComparison, type SpineItem } from './spineCompare';
import { useRoleDetails, useRoleList, useStreamList, type RoleDetail } from './useSpineData';

// Roles lens — a TASK-level comparison in the map's card language, displayed
// vertically: one column per picked role, the actual tasks compared head to
// head. Shared tasks align on the same row across every role column (matched
// on the fly by name); each role's unique work stacks below; a green
// CONSOLIDATED column carries the normalized set (shared merged N→1).
// Filters: Division narrows the role picker; Value stream narrows the TASKS
// being compared.

const COL_W = 240;

interface RoleColumn {
  id: string;
  title: string;
  subtitle: string | null;
  tasks: { id: string; name: string; involvement: string; valueStream: string | null }[];
}

function toColumn(d: RoleDetail): RoleColumn {
  // One row per task — Owner wins over Participant when a role holds both.
  const perTask = new Map<string, (typeof d.tasks)[number]>();
  for (const t of d.tasks) {
    const cur = perTask.get(t.id);
    if (!cur || t.involvement === 'Owner') perTask.set(t.id, t);
  }
  return {
    id: d.id,
    title: d.name,
    subtitle: [d.division, d.department].filter(Boolean).join(' › ') || null,
    tasks: [...perTask.values()].map((t) => ({
      id: t.id,
      name: t.name,
      involvement: t.involvement,
      valueStream: t.valueStream,
    })),
  };
}

const selectStyle = {
  border: '1px solid #e5e5e5',
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: 12,
  background: '#fff',
  maxWidth: 220,
} as const;

export default function RoleCompareBoard({
  lens,
  onLens,
}: {
  lens: WorkspaceLens;
  onLens: (l: WorkspaceLens) => void;
}) {
  const { data: roles, loading: listLoading, error: listError } = useRoleList();
  // Compared roles + dropdown filters persist per session (lib/viewState) so
  // the tab restores exactly on return.
  const [ids, setIds] = useViewState<string[]>('workspace.role.ids', []);
  const [division, setDivision] = useViewState<string>('workspace.role.division', '');
  const [stream, setStream] = useViewState<string>('workspace.role.stream', '');

  useEffect(() => {
    if (!roles || roles.length < 2 || ids.length > 0) return;
    const busiest = [...roles].sort(
      (a, b) => b.ownedTasks + b.participantTasks - (a.ownedTasks + a.participantTasks),
    );
    const first = busiest[0];
    const sibling = busiest.find((r) => r.id !== first.id && r.department === first.department);
    setIds([first.id, (sibling ?? busiest[1]).id]);
  }, [roles, ids.length, setIds]);

  const { data: details, loading, error } = useRoleDetails(ids);

  const divisions = useMemo(
    () => [...new Set((roles ?? []).map((r) => r.division).filter((d): d is string => !!d))].sort(),
    [roles],
  );
  // Both filters narrow the ROLE DROPDOWN: Division by org home, Value stream
  // by where the role actually works. Already-picked roles stay listed so the
  // current comparison never breaks.
  const pool: PoolOption[] = useMemo(
    () =>
      (roles ?? [])
        .filter(
          (r) =>
            ids.includes(r.id) ||
            ((!division || r.division === division) && (!stream || r.streams.includes(stream))),
        )
        .map((r) => ({
          id: r.id,
          label: r.name,
          group: [r.division, r.department].filter(Boolean).join(' › ') || 'Unassigned',
          hint: `${r.ownedTasks + r.participantTasks} tasks`,
        })),
    [roles, division, stream, ids],
  );

  const allColumns: RoleColumn[] = useMemo(() => {
    if (!details) return [];
    return ids
      .map((id) => details[id])
      .filter(Boolean)
      .map(toColumn);
  }, [details, ids]);

  // Value-stream filter options come from the full spine — it narrows both
  // the role dropdown (above) and the TASKS being compared (below).
  const { data: streamList } = useStreamList();
  const streams = useMemo(() => (streamList ?? []).map((s) => s.name).sort(), [streamList]);
  const columns: RoleColumn[] = useMemo(
    () =>
      allColumns.map((c) => ({
        ...c,
        tasks: stream ? c.tasks.filter((t) => (t.valueStream ?? 'Unmapped') === stream) : c.tasks,
      })),
    [allColumns, stream],
  );

  const items: SpineItem[] = useMemo(
    () =>
      columns.flatMap((c) =>
        c.tasks.map((t) => ({
          id: `${c.id}:${t.id}`,
          name: t.name,
          column: c.id,
          group: t.valueStream ?? 'Unmapped',
          tag: t.involvement,
        })),
      ),
    [columns],
  );
  const cmp: SpineComparison = useMemo(() => compareSpineColumns(items), [items]);
  const titleOf = (id: string) => columns.find((c) => c.id === id)?.title ?? id;

  // Shared groups aligned row-wise; each role's leftover (unique + internal
  // dup) stacks below its column.
  const uniqueOf = (c: RoleColumn) =>
    c.tasks.filter((t) => cmp.markOf.get(`${c.id}:${t.id}`) !== 'shared');

  if (listLoading) return <LoadingState message="Loading roles…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const gridCols = `repeat(${columns.length + 1}, ${COL_W}px)`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 156px)',
        minHeight: 480,
      }}
    >
      <LensBar lens={lens} onLens={onLens} boards={[]} boardId={null} onBoard={() => undefined} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select
          value={division}
          onChange={(e) => setDivision(e.target.value)}
          aria-label="Division filter"
          style={{ ...selectStyle, marginBottom: 10 }}
        >
          <option value="">All divisions</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={stream}
          onChange={(e) => setStream(e.target.value)}
          aria-label="Value stream filter"
          style={{ ...selectStyle, marginBottom: 10 }}
        >
          <option value="">All value streams</option>
          {streams.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Picker noun="role" pool={pool} selectedIds={ids} onChangeSelection={setIds} />
        <span style={{ fontSize: 10.5, color: '#64748b', marginBottom: 10 }}>
          tasks compared head to head · shared tasks align across columns ·{' '}
          <b style={{ color: INDIGO }}>●</b> shared · <b style={{ color: AMBER }}>●</b> dup within ·{' '}
          <b style={{ color: '#93b7e0' }}>●</b> unique
        </span>
      </div>

      <div
        style={{
          border: '1px solid #eaeaea',
          borderRadius: 12,
          background: '#fff',
          backgroundImage: 'radial-gradient(circle,#ececec 1px,transparent 1px)',
          backgroundSize: '24px 24px',
          overflow: 'auto',
          flex: 1,
          minHeight: 0,
          boxSizing: 'border-box',
        }}
      >
        {loading ? (
          <div style={{ padding: 30, fontSize: 12.5, color: '#a3a3a3' }}>Loading roles…</div>
        ) : columns.length === 0 ? (
          <div style={{ padding: 30 }}>
            <EmptyState message="Pick at least two roles to compare." />
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 24,
              padding: 24,
              width: 'max-content',
            }}
          >
            <div>
              {/* Column headers */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: gridCols,
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                {columns.map((c) => {
                  const stats = cmp.stats.find((s) => s.column === c.id);
                  return (
                    <div key={c.id}>
                      <LaneChip
                        title={c.title}
                        meta={`${c.subtitle ? `${c.subtitle} · ` : ''}${c.tasks.length} tasks${stream ? ` in ${stream}` : ''}`}
                      />
                      {stats && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10 }}>
                          <b style={{ color: INDIGO }}>{stats.shared} shared</b>
                          <b style={{ color: AMBER }}>{stats.withinDup} dup</b>
                          <b style={{ color: '#64748b' }}>{stats.unique} unique</b>
                        </div>
                      )}
                    </div>
                  );
                })}
                <LaneChip
                  title="Consolidated role"
                  meta={`normalized · ${cmp.normalized} steps`}
                  tone="#047857"
                />
              </div>

              {/* Shared tasks — one row per match, aligned across the columns. */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '.06em',
                  color: INDIGO,
                  textTransform: 'uppercase',
                  margin: '2px 0 6px',
                }}
              >
                Shared tasks ({cmp.shared.length}) — same work in several roles
              </div>
              {cmp.shared.length === 0 && (
                <div style={{ fontSize: 11, color: '#a3a3a3', marginBottom: 10 }}>
                  No overlapping tasks between these roles{stream ? ` in ${stream}` : ''}.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {cmp.shared.map((g) => (
                  <div
                    key={g.key}
                    style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 10 }}
                  >
                    {columns.map((c) => {
                      const mine = g.byColumn.get(c.id);
                      const t = mine?.[0];
                      return t ? (
                        <MapCard key={c.id} height={46}>
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              width: '100%',
                              textAlign: 'left',
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 999,
                                background: INDIGO,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 9.5,
                                color: '#171717',
                                lineHeight: 1.25,
                                flex: 1,
                                ...clamp2,
                              }}
                            >
                              {t.name}
                            </span>
                            <span style={{ fontSize: 8, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              {t.tag}
                            </span>
                          </span>
                        </MapCard>
                      ) : (
                        <MapCard key={c.id} dimmed height={46}>
                          <span style={{ fontSize: 8.5, color: '#c3cedb' }}>not in this role</span>
                        </MapCard>
                      );
                    })}
                    <MapCard height={46} tone="#bbe7cf">
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          width: '100%',
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9.5,
                            color: '#14532d',
                            lineHeight: 1.25,
                            flex: 1,
                            ...clamp2,
                          }}
                        >
                          {g.name}
                        </span>
                        <span
                          style={{
                            fontSize: 8.5,
                            fontWeight: 800,
                            color: INDIGO,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {g.total}→1
                        </span>
                      </span>
                    </MapCard>
                  </div>
                ))}
              </div>

              {/* Unique work — per role, stacked below its column. */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '.06em',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  margin: '2px 0 6px',
                }}
              >
                Role-specific tasks — carried over 1→1
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 10 }}>
                {columns.map((c) => {
                  const rest = uniqueOf(c);
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        maxHeight: 420,
                        overflowY: 'auto',
                      }}
                    >
                      {rest.map((t, i) => (
                        <TaskCard
                          key={t.id}
                          n={i + 1}
                          name={t.name}
                          mark={cmp.markOf.get(`${c.id}:${t.id}`)}
                          tag={t.involvement}
                        />
                      ))}
                      {rest.length === 0 && (
                        <div style={{ fontSize: 10, color: '#a3a3a3', padding: 6 }}>
                          Everything this role does here is shared.
                        </div>
                      )}
                    </div>
                  );
                })}
                <div
                  style={{
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(236,253,245,.7)',
                    outline: '2px solid #a7f3d0',
                    fontSize: 10.5,
                    color: '#14532d',
                    alignSelf: 'flex-start',
                  }}
                >
                  <b>{cmp.normalized}</b> normalized steps: {cmp.shared.length} merged from the
                  shared rows above + every role-specific task carried over 1→1.
                </div>
              </div>
            </div>
            <ConsolidationRail cmp={cmp} titleOf={titleOf} />
          </div>
        )}
      </div>
    </div>
  );
}
