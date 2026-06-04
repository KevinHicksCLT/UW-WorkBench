import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import type { AdminEntity } from '../lib/adminTypes';

// Read-only audit log viewer. Every create/update/delete made through the admin
// console writes an AuditEntry; this page lists them, filterable by entity type.

type Entry = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorEmail: string;
  diff: string | null;
  createdAt: string;
};

const actionPill: Record<string, string> = {
  CREATE: 'pill-green',
  UPDATE: 'pill-amber',
  DELETE: 'pill-red',
};

function DiffView({ raw }: { raw: string | null }) {
  if (!raw) return <span className="text-[#a3a3a3]">—</span>;
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { return <code className="text-xs">{raw}</code>; }

  const entries = Object.entries(parsed);
  return (
    <div className="space-y-0.5">
      {entries.map(([field, val]) => {
        // UPDATE diffs are { from, to }; CREATE/DELETE are plain field → value.
        const isChange = val && typeof val === 'object' && 'from' in (val as any) && 'to' in (val as any);
        return (
          <div key={field} className="text-xs flex gap-1.5">
            <span className="text-[#666666] font-medium">{field}:</span>
            {isChange ? (
              <span>
                <span className="text-[#be123c] line-through">{String((val as any).from ?? '∅')}</span>
                <span className="text-[#a3a3a3] mx-1">→</span>
                <span className="text-[#047857]">{String((val as any).to ?? '∅')}</span>
              </span>
            ) : (
              <span className="text-[#171717]">{String(val ?? '∅')}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AuditTrail() {
  const [entities, setEntities] = useState<AdminEntity[]>([]);
  const [filter, setFilter] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/_meta').then((m) => setEntities(m.entities)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get(`/audit?limit=200${filter ? `&entityType=${encodeURIComponent(filter)}` : ''}`)
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        subtitle="Every create, update, and delete across the platform."
        actions={
          <select className="input max-w-[200px]" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All entity types</option>
            {entities.map((e) => (
              <option key={e.slug} value={e.model}>{e.label}</option>
            ))}
          </select>
        }
      />

      {error && <div className="text-sm text-[#be123c] mb-3">{error}</div>}

      <div className="card-elevated overflow-hidden">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eaeaea] text-left">
                <th className="px-3 py-2 font-medium text-[#666666] whitespace-nowrap">When</th>
                <th className="px-3 py-2 font-medium text-[#666666]">Action</th>
                <th className="px-3 py-2 font-medium text-[#666666]">Entity</th>
                <th className="px-3 py-2 font-medium text-[#666666]">Actor</th>
                <th className="px-3 py-2 font-medium text-[#666666]">Change</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-[#a3a3a3]">Loading…</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-[#a3a3a3] italic">No audit entries yet.</td></tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="border-b border-[#f5f5f5] align-top">
                    <td className="px-3 py-2 text-[#666666] whitespace-nowrap tnum">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2"><span className={actionPill[e.action] ?? 'pill-slate'}>{e.action}</span></td>
                    <td className="px-3 py-2 text-[#171717] whitespace-nowrap">{e.entityType}</td>
                    <td className="px-3 py-2 text-[#525252] whitespace-nowrap">{e.actorEmail}</td>
                    <td className="px-3 py-2 max-w-md"><DiffView raw={e.diff} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-[#a3a3a3] mt-3">
        Showing the most recent {entries.length} entries.{' '}
        <Link to="/admin" className="underline hover:text-[#171717]">Back to Data Admin</Link>
      </p>
    </div>
  );
}
