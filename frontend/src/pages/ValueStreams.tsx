import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';

export default function ValueStreams() {
  const { data: streams, error, loading } = useApi<any[]>('/value-streams');

  if (loading) return <div className="text-slate-500">Loading value streams…</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  const byDomain = new Map<string, any[]>();
  (streams ?? []).forEach((s) => {
    const d = s.domain || 'Other';
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d)!.push(s);
  });
  const domains = [...byDomain.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <PageHeader title="Value Streams" subtitle={`${streams?.length ?? 0} streams across ${domains.length} domains`} />
      <div className="space-y-6">
        {domains.map(([domain, list]) => (
          <div key={domain}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">{domain}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((s) => (
                <Link key={s.id} to={`/value-streams/${s.id}`} className="card hover:border-brand-300 hover:shadow transition-all">
                  <div className="font-medium text-slate-900">{s.name}</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
