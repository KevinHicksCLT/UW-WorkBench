import { useEffect, useState } from 'react';
import { api } from './api';

// Small fetch hook with loading/error state for read-only pages.
// Pass null to skip (e.g. while a dependency id isn't known yet).
export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!path) { setLoading(false); setData(null); return; }
    let active = true;
    setLoading(true);
    setError('');
    api.get(path)
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path]);

  return { data, error, loading };
}
