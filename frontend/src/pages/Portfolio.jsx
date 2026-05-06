import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  AreaChart, Area, CartesianGrid, Legend,
} from 'recharts';
import { api } from '../lib/api.js';
import { fmt, STAGE_LABELS } from '../lib/format.js';
import PageHeader from '../components/PageHeader.jsx';
import KpiTile from '../components/KpiTile.jsx';

const STATUS_COLORS = { ON_TRACK: '#10b981', AT_RISK: '#f59e0b', OFF_TRACK: '#ef4444' };

export default function Portfolio() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard/portfolio').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div className="text-slate-500">Loading portfolio…</div>;

  const monthlyChartData = data.monthlyBenefits.map((m) => ({
    period: m.period,
    Actual: Math.round(m.ACTUAL / 1000),
    Target: Math.round(m.TARGET / 1000),
    Forecast: Math.round(m.FORECAST / 1000),
  }));

  const stageBars = Object.entries(data.byStage).map(([stage, count]) => ({
    stage: STAGE_LABELS[stage] || stage,
    count,
  }));

  const statusBars = Object.entries(data.byStatus).map(([status, count]) => ({
    status, count, fill: STATUS_COLORS[status] || '#94a3b8',
  }));

  return (
    <div>
      <PageHeader
        title="Portfolio Overview"
        subtitle="Executive snapshot across all transformation programs"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiTile label="Programs" value={data.counts.programs} tone="accent" />
        <KpiTile label="Initiatives" value={data.counts.initiatives} tone="accent" />
        <KpiTile
          label="Cumulative Benefit"
          value={fmt.currency(data.totals.benefit, { compact: true })}
          tone="positive"
        />
        <KpiTile
          label="Net Benefit"
          value={fmt.currency(data.totals.net, { compact: true })}
          sublabel={`Cost: ${fmt.currency(data.totals.cost, { compact: true })}`}
          tone={data.totals.net > 0 ? 'positive' : 'warning'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-slate-900 mb-3">Monthly Benefits — Actual vs Target vs Forecast</h3>
          <div className="text-xs text-slate-500 mb-3">$ thousands</div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Target" stroke="#94a3b8" fill="#cbd5e1" fillOpacity={0.4} />
              <Area type="monotone" dataKey="Forecast" stroke="#3d6db1" fill="#92b1da" fillOpacity={0.4} />
              <Area type="monotone" dataKey="Actual" stroke="#059669" fill="#6ee7b7" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-3">Initiatives by Status</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={statusBars} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="count" />
            </BarChart>
          </ResponsiveContainer>
          <h3 className="font-semibold text-slate-900 mt-4 mb-3">Initiatives by Stage</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={stageBars}>
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3d6db1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-slate-900 mb-3">Top Open Risks</h3>
        {data.topRisks.length === 0 ? (
          <div className="text-sm text-slate-500">No open risks 🎉</div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="text-left py-2 font-semibold">Title</th>
                  <th className="text-left py-2 font-semibold">Initiative</th>
                  <th className="text-center py-2 font-semibold">Severity</th>
                  <th className="text-left py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.topRisks.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2.5 font-medium text-slate-800">{r.title}</td>
                    <td className="py-2.5">
                      <Link className="text-brand-600 hover:underline" to={`/initiatives/${r.initiative.id}`}>
                        {r.initiative.name}
                      </Link>
                    </td>
                    <td className="py-2.5 text-center">
                      <SeverityCell value={r.severity} />
                    </td>
                    <td className="py-2.5 text-slate-600">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SeverityCell({ value }) {
  const colour = value >= 16 ? 'bg-red-500' : value >= 9 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <span className={`inline-flex items-center justify-center w-9 h-7 rounded text-white font-semibold text-xs ${colour}`}>
      {value}
    </span>
  );
}
