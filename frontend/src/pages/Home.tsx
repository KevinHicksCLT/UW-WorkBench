import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import KpiTile from '../components/KpiTile';

// Phase 1 read surface: lists the seeded company/companies with spine counts.
// The full drill-down UI is Phase 2.
export default function Home() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/companies')
      .then(setCompanies)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <div className="text-red-600">{error}</div>;
  if (loading) return <div className="text-slate-500">Loading operating model…</div>;

  return (
    <div>
      <PageHeader title="Operating Model" subtitle="Companies governed in this workspace" />
      {companies.length === 0 ? (
        <div className="text-slate-500">No companies yet. Run the workbook seed to populate the spine.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {companies.map((c) => (
            <div key={c.id} className="card">
              <div className="font-semibold text-slate-900 text-lg mb-3">{c.name}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <KpiTile label="Divisions" value={c.counts.divisions} tone="accent" />
                <KpiTile label="Departments" value={c.counts.departments} tone="accent" />
                <KpiTile label="Roles" value={c.counts.roles} tone="accent" />
                <KpiTile label="Value Streams" value={c.counts.valueStreams} tone="accent" />
                <KpiTile label="Checklist Items" value={c.counts.checklistItems} tone="neutral" />
                <KpiTile label="Role Tasks" value={c.counts.roleTasks} tone="neutral" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
