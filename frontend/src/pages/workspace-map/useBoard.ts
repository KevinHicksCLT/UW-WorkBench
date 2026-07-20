import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import type { BoardDetail, BoardSummary } from './types';

// Lens = the structure the board list is scoped by (WR-01). Applications is the
// default; value-streams / roles pass their ids as query params so the same
// endpoint re-scopes. Only the ids the user has picked are sent.
export type Lens = 'applications' | 'value-streams' | 'roles';

export interface BoardListParams {
  lens: Lens;
  applicationIds?: string[];
  valueStreamIds?: string[];
  roleIds?: string[];
}

function listPath(p: BoardListParams): string {
  const q = new URLSearchParams();
  if (p.applicationIds?.length) q.set('applicationIds', p.applicationIds.join(','));
  if (p.valueStreamIds?.length) q.set('valueStreamIds', p.valueStreamIds.join(','));
  if (p.roleIds?.length) q.set('roleIds', p.roleIds.join(','));
  const s = q.toString();
  return `/rationalization${s ? `?${s}` : ''}`;
}

/** Board list for the current lens/filter. */
export function useBoardList(p: BoardListParams) {
  return useApi<BoardSummary[]>(listPath(p));
}

/** Full board detail; pass null while no board is selected. */
export function useBoardDetail(id: string | null) {
  return useApi<BoardDetail>(id ? `/rationalization/${id}` : null);
}

/** Details for every board a cross-board comparison touches, keyed by board id.
 *  The compare picker can pull applications from different boards, so the map
 *  merges 1..n details client-side. */
export function useBoardDetails(ids: string[]) {
  const [data, setData] = useState<Record<string, BoardDetail> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  // Stable key: same id set (any order) → no refetch.
  const key = [...ids].sort().join(',');

  useEffect(() => {
    if (!key) {
      setLoading(false);
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    Promise.all(key.split(',').map((id) => api.get<BoardDetail>(`/rationalization/${id}`)))
      .then((boards) => {
        if (active) setData(Object.fromEntries(boards.map((b) => [b.id, b])));
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load boards');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, reloadKey]);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);
  return { data, error, loading, refetch };
}
