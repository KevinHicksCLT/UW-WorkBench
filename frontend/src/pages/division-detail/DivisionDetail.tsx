import { useParams, Link } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import PageHeader from '../../components/PageHeader';
import { Card, EmptyState, ErrorMessage, LoadingState } from '../../components/ui';

type DivisionRole = { id: string; name: string };
type Department = { id: string; name: string; roles: DivisionRole[] };
type Data = { id: string; name: string; departments: Department[] };

export default function DivisionDetail() {
  const { id } = useParams();
  const { data: d, error, loading } = useApi<Data>(`/divisions/${id}`);

  if (loading) return <LoadingState baseClassName="text-slate-500" message="Loading division…" />;
  if (error) return <ErrorMessage baseClassName="text-red-600">{error}</ErrorMessage>;
  if (!d) return null;

  return (
    <div>
      <PageHeader
        title={d.name}
        subtitle={`${d.departments.length} departments`}
      />
      <div className="space-y-4">
        {d.departments.length === 0 ? (
          <EmptyState baseClassName="text-sm text-slate-500 italic" message="No departments." />
        ) : (
          d.departments.map((dept) => (
            <Card key={dept.id}>
              <div className="flex items-center justify-between mb-2">
                <Link to={`/departments/${dept.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                  {dept.name}
                </Link>
                <span className="text-xs text-slate-400">{dept.roles.length} roles</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dept.roles.map((r) => (
                  <Link key={r.id} to={`/roles/${r.id}`} className="pill-slate hover:bg-brand-100">{r.name}</Link>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
