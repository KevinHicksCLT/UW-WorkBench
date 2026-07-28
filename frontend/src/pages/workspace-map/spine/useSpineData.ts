import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../lib/useApi';

// Data hooks for the Value-streams / Roles comparison lenses — thin wrappers
// over /rationalization/spine/* (the REAL operating-model graph).

export interface StreamSummary {
  id: string;
  name: string;
  domain: string | null;
  taskCount: number;
}

export interface StreamTask {
  id: string;
  name: string;
  /** Owner role's name (NodeRole role_ = Owner), when one is wired. */
  owner: string | null;
  /** Applications used at the step (NodeAppUsage), capped at 3. */
  apps: string[];
}

export interface StreamDetail {
  id: string;
  name: string;
  domain: string | null;
  areas: {
    id: string;
    name: string;
    subs: { id: string; name: string; tasks: StreamTask[] }[];
  }[];
}

export interface RoleSummary {
  id: string;
  name: string;
  family: string | null;
  department: string | null;
  division: string | null;
  ownedTasks: number;
  participantTasks: number;
  /** Value streams this role works in (filters the role dropdown). */
  streams: string[];
}

export interface RoleDetail {
  id: string;
  name: string;
  department: string | null;
  division: string | null;
  tasks: {
    id: string;
    name: string;
    involvement: string;
    valueStream: string | null;
    l3: string | null;
    l4: string | null;
    /** Applications used at the task (NodeAppUsage), capped at 3. */
    apps: string[];
  }[];
}

export function useStreamList() {
  return useApi<StreamSummary[]>('/rationalization/spine/streams');
}

export function useRoleList() {
  return useApi<RoleSummary[]>('/rationalization/spine/roles');
}

/** Details for every picked column, keyed by id — merged client-side like the
 *  application board's useBoardDetails. */
function useDetails<T>(path: string, ids: string[]) {
  const [data, setData] = useState<Record<string, T> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
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
    Promise.all(key.split(',').map((id) => api.get<T & { id: string }>(`${path}/${id}`)))
      .then((rows) => {
        if (active) setData(Object.fromEntries(rows.map((r) => [r.id, r])));
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, path, reloadKey]);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);
  return { data, error, loading, refetch };
}

export function useStreamDetails(ids: string[]) {
  return useDetails<StreamDetail>('/rationalization/spine/streams', ids);
}

export function useRoleDetails(ids: string[]) {
  return useDetails<RoleDetail>('/rationalization/spine/roles', ids);
}
