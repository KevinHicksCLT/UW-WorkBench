import { useEffect, useMemo, useState } from 'react';
import { ErrorMessage, LoadingState } from '../../../components/ui';
import type { WorkspaceLens } from '../LensBar';
import SpineBoard, { type PoolOption, type SpineColumn } from './SpineBoard';
import { useStreamDetails, useStreamList } from './useSpineData';

// Value-streams lens — compare N REAL value streams horizontally. Columns are
// the streams' live L3→L4→task subtrees; the engine surfaces what repeats
// inside one stream and what can combine across streams / different L#
// processes. The L3/L4 selector re-groups every column's rows.

export default function VsStreamBoard({
  lens,
  onLens,
}: {
  lens: WorkspaceLens;
  onLens: (l: WorkspaceLens) => void;
}) {
  const { data: streams, loading: listLoading, error: listError } = useStreamList();
  const [ids, setIds] = useState<string[]>([]);
  const [level, setLevel] = useState<'L3' | 'L4'>('L3');

  // Default: the first two streams of the spine.
  useEffect(() => {
    if (streams && streams.length > 1 && ids.length === 0) {
      setIds([streams[0].id, streams[1].id]);
    }
  }, [streams, ids.length]);

  const { data: details, loading, error } = useStreamDetails(ids);

  const pool: PoolOption[] = useMemo(
    () =>
      (streams ?? []).map((s) => ({
        id: s.id,
        label: s.name,
        group: s.domain ?? 'Other',
        hint: `${s.taskCount} tasks`,
      })),
    [streams],
  );

  const columns: SpineColumn[] = useMemo(() => {
    if (!details) return [];
    return ids
      .map((id) => details[id])
      .filter(Boolean)
      .map((d) => ({
        id: d.id,
        title: d.name,
        subtitle: d.domain,
        groups:
          level === 'L3'
            ? d.areas.map((a) => ({
                id: a.id,
                name: a.name,
                items: a.subs.flatMap((sub) =>
                  sub.tasks.map((t) => ({ id: t.id, name: t.name, column: d.id, group: a.name })),
                ),
              }))
            : d.areas.flatMap((a) =>
                a.subs.map((sub) => ({
                  id: sub.id,
                  name: `${a.name} › ${sub.name}`,
                  items: sub.tasks.map((t) => ({
                    id: t.id,
                    name: t.name,
                    column: d.id,
                    group: sub.name,
                  })),
                })),
              ),
      }));
  }, [details, ids, level]);

  if (listLoading) return <LoadingState message="Loading value streams…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  return (
    <SpineBoard
      lens={lens}
      onLens={onLens}
      noun="value stream"
      pool={pool}
      selectedIds={ids}
      onChangeSelection={setIds}
      columns={columns}
      loading={loading}
      toolbar={
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: '#525252',
            marginBottom: 10,
          }}
        >
          Group by
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as 'L3' | 'L4')}
            aria-label="Grouping level"
            style={{
              border: '1px solid #e5e5e5',
              borderRadius: 6,
              padding: '5px 8px',
              fontSize: 12,
              background: '#fff',
            }}
          >
            <option value="L3">L3 process area</option>
            <option value="L4">L4 sub-process</option>
          </select>
        </label>
      }
    />
  );
}
