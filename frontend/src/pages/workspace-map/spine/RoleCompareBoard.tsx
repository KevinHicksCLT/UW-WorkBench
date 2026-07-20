import { useEffect, useMemo, useState } from 'react';
import { ErrorMessage, LoadingState } from '../../../components/ui';
import type { WorkspaceLens } from '../LensBar';
import SpineBoard, { type PoolOption, type SpineColumn } from './SpineBoard';
import { useRoleDetails, useRoleList } from './useSpineData';

// Roles lens — compare N REAL roles (picked from their org-unit groupings)
// horizontally. Columns are each role's live task set grouped by the value
// stream the work happens in; the engine surfaces duplicated work inside one
// role and overlapping work across roles / org units.

export default function RoleCompareBoard({
  lens,
  onLens,
}: {
  lens: WorkspaceLens;
  onLens: (l: WorkspaceLens) => void;
}) {
  const { data: roles, loading: listLoading, error: listError } = useRoleList();
  const [ids, setIds] = useState<string[]>([]);

  // Default: the two busiest roles of the same department when possible —
  // the most likely consolidation question — else the two busiest overall.
  useEffect(() => {
    if (!roles || roles.length < 2 || ids.length > 0) return;
    const busiest = [...roles].sort(
      (a, b) => b.ownedTasks + b.participantTasks - (a.ownedTasks + a.participantTasks),
    );
    const first = busiest[0];
    const sibling = busiest.find((r) => r.id !== first.id && r.department === first.department);
    setIds([first.id, (sibling ?? busiest[1]).id]);
  }, [roles, ids.length]);

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

  const columns: SpineColumn[] = useMemo(() => {
    if (!details) return [];
    return ids
      .map((id) => details[id])
      .filter(Boolean)
      .map((d) => {
        // One row per task — Owner wins over Participant when a role holds
        // both links (double involvement isn't a duplication finding).
        const perTask = new Map<string, (typeof d.tasks)[number]>();
        for (const t of d.tasks) {
          const cur = perTask.get(t.id);
          if (!cur || t.involvement === 'Owner') perTask.set(t.id, t);
        }
        const byStream = new Map<string, typeof d.tasks>();
        for (const t of perTask.values()) {
          const key = t.valueStream ?? 'Unmapped';
          const g = byStream.get(key) ?? [];
          g.push(t);
          byStream.set(key, g);
        }
        return {
          id: d.id,
          title: d.name,
          subtitle: [d.division, d.department].filter(Boolean).join(' › ') || null,
          groups: [...byStream.entries()]
            .sort((a, b) => b[1].length - a[1].length)
            .map(([stream, tasks]) => ({
              id: `${d.id}:${stream}`,
              name: stream,
              items: tasks.map((t) => ({
                id: `${d.id}:${t.id}`,
                name: t.name,
                column: d.id,
                group: stream,
                tag: t.involvement,
              })),
            })),
        };
      });
  }, [details, ids]);

  if (listLoading) return <LoadingState message="Loading roles…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  return (
    <SpineBoard
      lens={lens}
      onLens={onLens}
      noun="role"
      pool={pool}
      selectedIds={ids}
      onChangeSelection={setIds}
      columns={columns}
      loading={loading}
    />
  );
}
