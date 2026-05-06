import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';

const ENTITY_TYPES = ['ALL', 'Initiative', 'Program', 'Workstream', 'RaidItem', 'BenefitLine', 'CostLine', 'StrategicObjective', 'BusinessRule'];

export default function Audit() {
  const [entries, setEntries] = useState([]);
  const [entityType, setEntityType] = useState('ALL');

  useEffect(() => { load(); }, [entityType]);

  function load() {
    const params = new URLSearchParams();
    if (entityType !== 'ALL') params.set('entityType', entityType);
    params.set('limit', '200');
    api.get(`/audit?${params}`).then(setEntries);
  }

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        subtitle="Every create, update, delete, and workflow action"
      />

      <div className="card mb-4">
        <label className="label">Filter by entity</label>
        <div className="flex flex-wrap gap-1">
          {ENTITY_TYPES.map((t) => (
            <button key={t}
              className={t === entityType ? 'btn-primary text-xs px-3 py-1' : 'btn-secondary text-xs px-3 py-1'}
              onClick={() => setEntityType(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="card">
        {entries.length === 0 ? (
          <div className="text-sm text-slate-500 italic">No audit entries</div>
        ) : (
          <div className="table-scroll">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left py-2 font-semibold w-44">When</th>
                <th className="text-left py-2 font-semibold w-32">Entity</th>
                <th className="text-left py-2 font-semibold w-48">Action</th>
                <th className="text-left py-2 font-semibold w-48">Actor</th>
                <th className="text-left py-2 font-semibold">Diff</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 align-top">
                  <td className="py-2.5 text-slate-600 text-xs">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2.5">
                    <span className="pill-slate text-xs">{e.entityType}</span>
                  </td>
                  <td className="py-2.5 text-slate-700 font-medium">{e.action}</td>
                  <td className="py-2.5 text-slate-600 text-xs">{e.actorEmail}</td>
                  <td className="py-2.5 text-xs text-slate-500">
                    {e.diff && (
                      <pre className="bg-slate-50 rounded p-1.5 font-mono overflow-x-auto max-w-md">
                        {e.diff}
                      </pre>
                    )}
                  </td>
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
