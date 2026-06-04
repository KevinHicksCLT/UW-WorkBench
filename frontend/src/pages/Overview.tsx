import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import { fmt } from '../lib/format';
import PageHeader from '../components/PageHeader';

// Executive overview — the landing page. A single-glance summary of one
// company's entire operating model, sourced from GET /dashboard?companyId=…

type Group = { key: string; count: number };
type Dashboard = {
  company: { id: string; name: string; count: number };
  totals: Record<string, number>;
  divisionsByCategory: Group[];
  workforce: { byType: Group[]; byRegion: Group[] };
  initiativesByStatus: Group[];
  initiativesByHealth: Group[];
  risksBySeverity: Group[];
  applicationsByKind: Group[];
  financials: { annualNetImpact: number; annualBenefit: number; annualAddedCost: number; oneTimeCost: number; appRunCost: number };
  topValueStreams: { id: string; name: string; domain: string | null; roles: number }[];
  topDivisions: { id: string; name: string; higherCategory: string | null; roles: number }[];
};

const CAT_COLOR: Record<string, string> = {
  'Core Business': '#0d9488', 'IT': '#4f46e5', 'Corporate Function': '#7c3aed',
};
// Workforce mix is presented in two buckets: badged headcount as "Employees",
// and contractors + SI partners merged into "Contingent Workers".
function workforceBuckets(byType: Group[]): Group[] {
  const count = (k: string) => byType.find((g) => g.key === k)?.count ?? 0;
  return [
    { key: 'Employees', count: count('badged') },
    { key: 'Contingent Workers', count: count('contractor') + count('si_partner') },
  ];
}

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card-elevated p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{label}</div>
      <div className="text-2xl font-semibold text-[#171717] mt-1 tnum">{value}</div>
      {hint && <div className="text-[11px] text-[#a3a3a3] mt-0.5">{hint}</div>}
    </div>
  );
}

// Horizontal bar list. Bars are scaled to the largest value in the set.
function BarList({ groups, color }: { groups: Group[]; color?: string | ((k: string) => string) }) {
  const max = Math.max(1, ...groups.map((g) => g.count));
  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const c = typeof color === 'function' ? color(g.key) : color ?? '#171717';
        return (
          <div key={g.key} className="flex items-center gap-3">
            <div className="w-32 text-xs text-[#525252] truncate flex-shrink-0">{g.key}</div>
            <div className="flex-1 h-5 bg-[#f5f5f5] rounded overflow-hidden">
              <div className="h-full rounded" style={{ width: `${(g.count / max) * 100}%`, backgroundColor: c, minWidth: g.count ? 2 : 0 }} />
            </div>
            <div className="w-10 text-right text-xs text-[#171717] tnum flex-shrink-0">{g.count}</div>
          </div>
        );
      })}
    </div>
  );
}

function Card({ title, children, to, toLabel }: { title: string; children: React.ReactNode; to?: string; toLabel?: string }) {
  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[#171717]">{title}</h2>
        {to && <Link to={to} className="text-xs text-[#525252] hover:text-[#171717]">{toLabel ?? 'View'} →</Link>}
      </div>
      {children}
    </div>
  );
}

export default function Overview() {
  const { companyId, company, loading: companyLoading } = useCompany();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (companyLoading) return;
    setLoading(true);
    setError('');
    api.get(`/dashboard${companyId ? `?companyId=${companyId}` : ''}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [companyId, companyLoading]);

  if (loading || companyLoading) return <div className="text-sm text-[#a3a3a3]">Loading overview…</div>;
  if (error) return <div className="text-sm text-[#be123c]">{error}</div>;
  if (!data) return null;

  const t = data.totals;
  const workforceTotal = data.workforce.byType.reduce((a, g) => a + g.count, 0);

  return (
    <div>
      <PageHeader
        title={company?.name ?? data.company.name}
        eyebrow={data.company.count > 1 ? `1 of ${data.company.count} companies` : undefined}
      />

      {/* Headline metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Tile label="Divisions" value={t.divisions} hint={`${t.departments} departments`} />
        <Tile label="Roles" value={t.roles} />
        <Tile label="Value Streams" value={t.valueStreams} hint={`${t.domains} domains`} />
        <Tile label="Initiatives" value={t.initiatives} />
        <Tile label="Deliverables" value={t.deliverables} />
        <Tile label="Tasks" value={t.tasks} />
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Divisions by category" to="/overview" toLabel="Explorer">
          <BarList groups={data.divisionsByCategory} color={(k) => CAT_COLOR[k] ?? '#171717'} />
        </Card>

        <Card title="Workforce mix" to="/roles" toLabel="Roles">
          <div className="text-xs text-[#a3a3a3] mb-2 tnum">{fmt.number(workforceTotal)} people</div>
          <BarList groups={workforceBuckets(data.workforce.byType)} color="#4f46e5" />
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mt-4 mb-2">By region</div>
          <BarList groups={data.workforce.byRegion} color="#0d9488" />
        </Card>

        <Card title="Largest divisions" to="/roles" toLabel="Roles">
          <div className="space-y-1.5">
            {data.topDivisions.map((d) => (
              <Link key={d.id} to={`/divisions/${d.id}`} className="flex items-center justify-between py-1 group">
                <span className="text-sm text-[#171717] group-hover:text-[#4f46e5] truncate">{d.name}</span>
                <span className="text-xs text-[#a3a3a3] tnum flex-shrink-0 ml-2">{d.roles} roles</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card title="Model footprint">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {([
              ['Process steps', t.processSteps, '/overview?view=list'],
              ['Change scenarios', t.scenarios, '/portfolio'], ['Applications', t.applications, '/portfolio'],
              ['Departments', t.departments, '/roles?view=departments'], ['Domains', t.domains, '/overview'],
            ] as [string, number, string][]).map(([label, val, to]) => (
              <Link key={label} to={to} className="flex items-center justify-between border-b border-[#f5f5f5] pb-1 group">
                <span className="text-[#525252] group-hover:text-[#4f46e5]">{label}</span>
                <span className="text-[#171717] tnum">{val}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
