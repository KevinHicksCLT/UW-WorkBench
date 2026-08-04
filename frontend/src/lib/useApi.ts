import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

// Small fetch hook with loading/error state for read-only pages.
// Pass null to skip (e.g. while a dependency id isn't known yet).
// `refetch()` re-runs the request (e.g. after a mutation elsewhere).
export function useApi<T = unknown>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!path) { setLoading(false); setData(null); return; }
    let active = true;
    setLoading(true);
    setError('');
    api.get<T>(path)
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, reloadKey]);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  return { data, error, loading, refetch };
}
