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
