import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorMessage, LoadingState } from '../../../components/ui';
import LensBar, { type WorkspaceLens } from '../LensBar';
import { AMBER, INDIGO } from '../types';
import { Picker, ConsolidationRail, type PoolOption } from './SpineBoard';
import { LaneChip, MapCard, TaskCard, VConnector, clamp2 } from './mapCards';
import {
  compareSpineColumns,
  spineKey,
  type SpineComparison,
  type SpineItem,
} from './spineCompare';
import { useRoleDetails, useRoleList, type RoleDetail } from './useSpineData';

// Roles lens in the MAP's card language, displayed VERTICALLY: each picked
// role is one COLUMN. Down the column, one card per value stream the role
// works in — the same stream aligns to the same row across every role, a
// dimmed card marks streams a role doesn't touch. Clicking a stream card
// drops that role's numbered task cards beneath it (verdict dots + Owner /
// Participant tags). A green CONSOLIDATED column renders last: the union of
// the compared roles' work with shared steps merged N→1.

const COL_W = 230;
const ROW_H = 58;

interface RoleColumn {
  id: string;
  title: string;
  subtitle: string | null;
  /** stream name → tasks (deduped per task, Owner wins over Participant). */
  byStream: Map<string, { id: string; name: string; involvement: string }[]>;
}

function toColumn(d: RoleDetail): RoleColumn {
  const perTask = new Map<string, (typeof d.tasks)[number]>();
  for (const t of d.tasks) {
    const cur = perTask.get(t.id);
    if (!cur || t.involvement === 'Owner') perTask.set(t.id, t);
  }
  const byStream = new Map<string, { id: string; name: string; involvement: string }[]>();
  for (const t of perTask.values()) {
    const key = t.valueStream ?? 'Unmapped';
    const g = byStream.get(key) ?? [];
    g.push({ id: t.id, name: t.name, involvement: t.involvement });
    byStream.set(key, g);
  }
  return {
    id: d.id,
    title: d.name,
    subtitle: [d.division, d.department].filter(Boolean).join(' › ') || null,
    byStream,
  };
}

export default function RoleCompareBoard({
  lens,
  onLens,
}: {
  lens: WorkspaceLens;
  onLens: (l: WorkspaceLens) => void;
}) {
  const { data: roles, loading: listLoading, error: listError } = useRoleList();
  const [ids, setIds] = useState<string[]>([]);
  /** Per column: which stream row is expanded. */
  const [openRow, setOpenRow] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!roles || roles.length < 2 || ids.length > 0) return;
    const busiest = [...roles].sort(
      (a, b) => b.ownedTasks + b.participantTasks - (a.ownedTasks + a.participantTasks),
    );
    const first = busiest[0];
    const sibling = busiest.find((r) => r.id !== first.id && r.department === first.department);
    setIds([first.id, (sibling ?? busiest[1]).id]);
  }, [roles, ids.length]);
  useEffect(() => setOpenRow({}), [ids.join(',')]);

  const { data: details, loading, error } = useRoleDetails(ids);

  const pool: PoolOption[] = useMemo(
    () =>
      (roles ?? []).map((r) => ({
        id: r.id,
        label: r.name,
        group: [r.division, r.department].filter(Boolean).join(' › ') || 'Unassigned',
        hint: `${r.ownedTasks + r.participantTasks} tasks`,
      })),
    [roles],
  );

  const columns: RoleColumn[] = useMemo(() => {
    if (!details) return [];
    return ids
      .map((id) => details[id])
      .filter(Boolean)
      .map(toColumn);
  }, [details, ids]);

  // Stream rows = union across the compared roles, busiest first.
  const streamRows = useMemo(() => {
    const totals = new Map<string, number>();
    for (const c of columns)
      for (const [stream, tasks] of c.byStream)
        totals.set(stream, (totals.get(stream) ?? 0) + tasks.length);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [columns]);

  const items: SpineItem[] = useMemo(
    () =>
      columns.flatMap((c) =>
        [...c.byStream.entries()].flatMap(([stream, tasks]) =>
          tasks.map((t) => ({
            id: `${c.id}:${t.id}`,
            name: t.name,
            column: c.id,
            group: stream,
            tag: t.involvement,
          })),
        ),
      ),
    [columns],
  );
  const cmp: SpineComparison = useMemo(() => compareSpineColumns(items), [items]);
  const titleOf = (id: string) => columns.find((c) => c.id === id)?.title ?? id;

  /** Consolidated steps for one stream row across every role. */
  const consolidated = (stream: string) => {
    const byKey = new Map<string, { name: string; sources: Set<string>; involvement: string }>();
    for (const c of columns) {
      for (const t of c.byStream.get(stream) ?? []) {
        const k = spineKey(t.name);
        const cur = byKey.get(k);
        if (cur) {
          cur.sources.add(c.id);
          if (t.name.length < cur.name.length) cur.name = t.name;
          if (t.involvement === 'Owner') cur.involvement = 'Owner';
        } else byKey.set(k, { name: t.name, sources: new Set([c.id]), involvement: t.involvement });
      }
    }
    return [...byKey.entries()].map(([key, v]) => ({
      key,
      name: v.name,
      sources: v.sources.size,
    }));
  };

  if (listLoading) return <LoadingState message="Loading roles…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const renderRoleColumn = (col: RoleColumn) => {
    const open = openRow[col.id] ?? null;
    const total = [...col.byStream.values()].reduce((n, t) => n + t.length, 0);
    return (
      <div key={col.id} style={{ width: COL_W, flexShrink: 0 }}>
        <div style={{ marginBottom: 10, minHeight: 56 }}>
          <LaneChip
            title={col.title}
            meta={`${col.subtitle ? `${col.subtitle} · ` : ''}${total} tasks`}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {streamRows.map((stream, ri) => {
            const tasks = col.byStream.get(stream) ?? [];
            const shared = tasks.filter(
              (t) => cmp.markOf.get(`${col.id}:${t.id}`) === 'shared',
            ).length;
            const dup = tasks.filter((t) => cmp.markOf.get(`${col.id}:${t.id}`) === 'dup').length;
            const isOpen = open === stream;
            return (
              <div key={stream}>
                {ri > 0 && <VConnector />}
                {tasks.length === 0 ? (
                  <MapCard dimmed height={ROW_H}>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        color: '#b6c2d1',
                        lineHeight: 1.25,
                        ...clamp2,
                      }}
                    >
                      {stream}
                    </span>
                    <span style={{ fontSize: 8.5, color: '#c3cedb' }}>no work here</span>
                  </MapCard>
                ) : (
                  <MapCard
                    height={ROW_H}
                    selected={isOpen}
                    onClick={() => setOpenRow((c) => ({ ...c, [col.id]: isOpen ? null : stream }))}
                  >
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: '#171717',
                        lineHeight: 1.25,
                        ...clamp2,
                      }}
                    >
                      {stream}
                    </span>
                    <span style={{ fontSize: 8.5, color: '#94a3b8' }}>
                      {tasks.length} tasks
                      {shared > 0 && <b style={{ color: INDIGO }}> · {shared}⇆</b>}
                      {dup > 0 && <b style={{ color: AMBER }}> · {dup}!</b>}
                    </span>
                  </MapCard>
                )}
                {isOpen && tasks.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', marginTop: 0 }}>
                    <VConnector />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {tasks.map((t, i) => (
                        <TaskCard
                          key={t.id}
                          n={i + 1}
                          name={t.name}
                          mark={cmp.markOf.get(`${col.id}:${t.id}`)}
                          tag={t.involvement}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderConsolidatedColumn = () => {
    const laneId = '__consolidated__';
    const open = openRow[laneId] ?? null;
    return (
      <div
        style={{
          width: COL_W,
          flexShrink: 0,
          padding: 10,
          boxSizing: 'border-box',
          background: 'rgba(236,253,245,.7)',
          borderRadius: 12,
          outline: '2px solid #a7f3d0',
        }}
      >
        <div style={{ marginBottom: 10, minHeight: 56 }}>
          <LaneChip
            title="Consolidated role"
            meta={`normalized · ${cmp.normalized} steps`}
            tone="#047857"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {streamRows.map((stream, ri) => {
            const steps = consolidated(stream);
            const merged = steps.filter((s) => s.sources > 1).length;
            const isOpen = open === stream;
            return (
              <div key={stream}>
                {ri > 0 && <VConnector />}
                <MapCard
                  height={ROW_H}
                  tone="#bbe7cf"
                  selected={isOpen}
                  onClick={() => setOpenRow((c) => ({ ...c, [laneId]: isOpen ? null : stream }))}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: '#14532d',
                      lineHeight: 1.25,
                      ...clamp2,
                    }}
                  >
                    {stream}
                  </span>
                  <span style={{ fontSize: 8.5, color: '#4d7c60' }}>
                    {steps.length} normalized
                    {merged > 0 && <b style={{ color: INDIGO }}> · {merged} merged</b>}
                  </span>
                </MapCard>
                {isOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <VConnector />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {steps.map((s, i) => (
                        <TaskCard
                          key={s.key}
                          n={i + 1}
                          name={s.name}
                          mark={s.sources > 1 ? 'shared' : 'unique'}
                          tag={s.sources > 1 ? `${s.sources}→1` : null}
                          tone="#bbe7cf"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
        <Picker noun="role" pool={pool} selectedIds={ids} onChangeSelection={setIds} />
        <span style={{ fontSize: 10.5, color: '#64748b', marginBottom: 10 }}>
          one column per role · rows = value streams · click a card for its tasks ·{' '}
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
              gap: 20,
              padding: 24,
              width: 'max-content',
            }}
          >
            {columns.map(renderRoleColumn)}
            {renderConsolidatedColumn()}
            <ConsolidationRail cmp={cmp} titleOf={titleOf} />
          </div>
        )}
      </div>
    </div>
  );
}
