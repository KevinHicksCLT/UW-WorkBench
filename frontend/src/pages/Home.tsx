import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';
import KpiTile from '../components/KpiTile';

// Company overview + entry points into the drill-down (org divisions + value streams).
export default function Home() {
  const { data: companies, error, loading } = useApi<any[]>('/companies');
  const company = companies?.[0];
  const { data: tree } = useApi<any>(company ? `/companies/${company.id}/tree` : null);

  if (loading) return <div className="text-slate-500">Loading operating model…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!company) return <div className="text-slate-500">No company yet. Run the workbook seed to populate the spine.</div>;

  const divisions = tree?.divisions ?? [];

  return (
    <div>
      <PageHeader title={company.name} subtitle="Operating-model overview" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <KpiTile label="Divisions" value={company.counts.divisions} tone="accent" />
        <KpiTile label="Departments" value={company.counts.departments} tone="accent" />
        <KpiTile label="Roles" value={company.counts.roles} tone="accent" />
        <Link to="/value-streams" className="block">
          <KpiTile label="Value Streams" value={company.counts.valueStreams} tone="accent" />
        </Link>
        <KpiTile label="Checklist Items" value={company.counts.checklistItems} />
        <KpiTile label="Role Tasks" value={company.counts.roleTasks} />
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">Divisions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {divisions.map((d: any) => {
          const roleCount = d.departments.reduce((a: number, dept: any) => a + dept.roles.length, 0);
          return (
            <Link key={d.id} to={`/divisions/${d.id}`} className="card hover:border-brand-300 hover:shadow transition-all">
              <div className="font-semibold text-slate-900">{d.name}</div>
              <div className="text-xs text-slate-500 mt-1">{d.departments.length} departments · {roleCount} roles</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
