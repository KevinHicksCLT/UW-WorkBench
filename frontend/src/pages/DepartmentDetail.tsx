import { useParams, Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';

export default function DepartmentDetail() {
  const { id } = useParams();
  const { data: d, error, loading } = useApi<any>(`/departments/${id}`);

  if (loading) return <div className="text-slate-500">Loading department…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!d) return null;

  return (
    <div>
      <PageHeader
        title={d.name}
        subtitle={`${d.roles.length} roles`}
        breadcrumbs={[
          { label: 'Overview', to: '/' },
          { label: d.division.name, to: `/divisions/${d.division.id}` },
          { label: d.name },
        ]}
      />
      <div className="card">
        {d.roles.length === 0 ? (
          <div className="text-sm text-slate-500 italic">No roles.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {d.roles.map((r: any) => (
              <Link key={r.id} to={`/roles/${r.id}`} className="pill-slate hover:bg-brand-100">{r.name}</Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
