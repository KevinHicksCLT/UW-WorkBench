import { useSearchParams, Link } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import PageHeader from '../../components/PageHeader';
import { Card, EmptyState, LoadingState } from '../../components/ui';

type SearchResult = { type: string; id: string; href: string; name: string; sublabel?: string | null };

export default function SearchResults() {
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const { data: results, loading } = useApi<SearchResult[]>(q.length >= 2 ? `/search?q=${encodeURIComponent(q)}` : null);

  return (
    <div>
      <PageHeader title="Search" subtitle={q ? `Results for “${q}”` : 'Type at least 2 characters'} />
      {loading && q ? (
        <LoadingState baseClassName="text-slate-500" message="Searching…" />
      ) : (
        <Card>
          {(results ?? []).length === 0 ? (
            <EmptyState baseClassName="text-sm text-slate-500 py-1" message="No matches." />
          ) : (
            <div className="divide-y divide-slate-100">
              {(results ?? []).map((r) => (
                <Link key={`${r.type}-${r.id}`} to={r.href} className="block py-2 px-2 -mx-2 rounded hover:bg-slate-50">
                  <div className="text-sm text-slate-800">{r.name}</div>
                  <div className="text-xs text-slate-400">{r.type}{r.sublabel ? ` · ${r.sublabel}` : ''}</div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
