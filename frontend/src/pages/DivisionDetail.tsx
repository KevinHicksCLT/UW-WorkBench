import { useParams, Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';

export default function DivisionDetail() {
  const { id } = useParams();
  const { data: d, error, loading } = useApi<any>(`/divisions/${id}`);

  if (loading) return <div className="text-slate-500">Loading division…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!d) return null;

  return (
    <div>
      <PageHeader
        title={d.name}
        subtitle={`${d.departments.length} departments`}
      />
      <div className="space-y-4">
        {d.departments.length === 0 ? (
          <div className="text-sm text-slate-500 italic">No departments.</div>
        ) : (
          d.departments.map((dept: any) => (
            <div key={dept.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <Link to={`/departments/${dept.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                  {dept.name}
                </Link>
                <span className="text-xs text-slate-400">{dept.roles.length} roles</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dept.roles.map((r: any) => (
                  <Link key={r.id} to={`/roles/${r.id}`} className="pill-slate hover:bg-brand-100">{r.name}</Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
