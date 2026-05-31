import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { fmt } from '../lib/format';
import PageHeader from '../components/PageHeader';

const TYPES = ['ALL', 'RISK', 'ASSUMPTION', 'ISSUE', 'DECISION'];
const STATUSES = ['ALL', 'OPEN', 'MITIGATED', 'CLOSED'];

export default function RaidLog() {
  const [items, setItems] = useState<any[]>([]);
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('OPEN');

  useEffect(() => { load(); }, [type, status]);

  function load() {
    const params = new URLSearchParams();
    if (type !== 'ALL') params.set('type', type);
    if (status !== 'ALL') params.set('status', status);
    api.get(`/raid${params.toString() ? '?' + params : ''}`).then(setItems);
  }

  // Build 5x5 heatmap grid (probability x impact) — count of items in each cell
  const heatmap = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
  for (const i of items) {
    if (i.type === 'RISK') {
      heatmap[i.probability - 1][i.impact - 1]++;
    }
  }

  return (
    <div>
      <PageHeader
        title="RAID Log"
        subtitle="Risks, Assumptions, Issues, Decisions across the portfolio"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-3">Risk Heatmap (Probability × Impact)</h3>
          <div className="flex">
            <div className="text-xs text-slate-500 flex flex-col justify-around pr-2 text-right" style={{ height: 200 }}>
              <span>5</span><span>4</span><span>3</span><span>2</span><span>1</span>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-5 gap-0.5" style={{ height: 200 }}>
                {/* Rendered top-down: probability 5 first */}
                {[5, 4, 3, 2, 1].map((p) =>
                  [1, 2, 3, 4, 5].map((i) => {
                    const sev = p * i;
                    const count = heatmap[p - 1][i - 1];
                    const bg = sev >= 16 ? 'bg-red-500' : sev >= 9 ? 'bg-amber-400' : 'bg-emerald-400';
                    return (
                      <div key={`${p}-${i}`}
                           className={`${bg} flex items-center justify-center text-white font-bold text-xs rounded`}
                           title={`Prob ${p} × Impact ${i} = ${sev}`}>
                        {count > 0 ? count : ''}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
              </div>
              <div className="text-center text-xs text-slate-500 mt-1">Impact →</div>
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-2">↑ Probability</div>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-slate-900 mb-3">Filters</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <div className="flex flex-wrap gap-1">
                {TYPES.map((t) => (
                  <button key={t}
                    className={t === type ? 'btn-primary text-xs px-3 py-1' : 'btn-secondary text-xs px-3 py-1'}
                    onClick={() => setType(t)}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <div className="flex flex-wrap gap-1">
                {STATUSES.map((s) => (
                  <button key={s}
                    className={s === status ? 'btn-primary text-xs px-3 py-1' : 'btn-secondary text-xs px-3 py-1'}
                    onClick={() => setStatus(s)}>{s}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
            {['RISK', 'ASSUMPTION', 'ISSUE', 'DECISION'].map((t) => (
              <div key={t}>
                <div className="text-xs text-slate-500">{t}</div>
                <div className="text-xl font-bold text-slate-900">
                  {items.filter((i) => i.type === t).length}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-slate-900 mb-3">Items ({items.length})</h3>
        {items.length === 0 ? (
          <div className="text-sm text-slate-500 italic">No items match the filters</div>
        ) : (
          <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left py-2 font-semibold w-20">Type</th>
                <th className="text-left py-2 font-semibold">Title</th>
                <th className="text-left py-2 font-semibold">Initiative</th>
                <th className="text-center py-2 font-semibold w-20">Severity</th>
                <th className="text-left py-2 font-semibold w-24">Status</th>
                <th className="text-left py-2 font-semibold w-24">Owner</th>
                <th className="text-left py-2 font-semibold w-24">Due</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2.5"><span className="pill-slate text-xs">{r.type}</span></td>
                  <td className="py-2.5">
                    <div className="font-medium text-slate-800">{r.title}</div>
                    {r.mitigation && <div className="text-xs text-slate-500 mt-0.5">{r.mitigation}</div>}
                  </td>
                  <td className="py-2.5">
                    <Link to={`/initiatives/${r.initiative.id}`} className="text-brand-600 hover:underline">
                      {r.initiative.name}
                    </Link>
                  </td>
                  <td className="py-2.5 text-center">
                    <span className={`inline-flex items-center justify-center w-9 h-7 rounded text-white font-semibold text-xs ${
                      r.severity >= 16 ? 'bg-red-500' : r.severity >= 9 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}>{r.severity}</span>
                  </td>
                  <td className="py-2.5 text-slate-600 text-xs">{r.status}</td>
                  <td className="py-2.5 text-slate-600 text-xs">{r.owner?.name || '—'}</td>
                  <td className="py-2.5 text-slate-600 text-xs">{fmt.date(r.dueDate)}</td>
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
