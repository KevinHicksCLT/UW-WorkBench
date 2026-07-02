import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import type { AdminEntity } from '../../lib/adminTypes';
import { Card, ErrorMessage, Select } from '../../components/ui';

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

type FieldChange = { from: unknown; to: unknown };
const isFieldChange = (v: unknown): v is FieldChange =>
  Boolean(v) && typeof v === 'object' && v !== null && 'from' in v && 'to' in v;

function DiffView({ raw }: { raw: string | null }) {
  if (!raw) return <span className="text-[#a3a3a3]">—</span>;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return <code className="text-xs">{raw}</code>; }

  const entries = Object.entries(parsed as Record<string, unknown>);
  return (
    <div className="space-y-0.5">
      {entries.map(([field, val]) => {
        // UPDATE diffs are { from, to }; CREATE/DELETE are plain field → value.
        return (
          <div key={field} className="text-xs flex gap-1.5">
            <span className="text-[#666666] font-medium">{field}:</span>
            {isFieldChange(val) ? (
              <span>
                <span className="text-[#be123c] line-through">{String(val.from ?? '∅')}</span>
                <span className="text-[#a3a3a3] mx-1">→</span>
                <span className="text-[#047857]">{String(val.to ?? '∅')}</span>
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

export default function AuditTrail({ embedded }: { embedded?: boolean } = {}) {
  const [entities, setEntities] = useState<AdminEntity[]>([]);
  const [filter, setFilter] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ entities: AdminEntity[] }>('/admin/_meta').then((m) => setEntities(m.entities)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get<Entry[]>(`/audit?limit=200${filter ? `&entityType=${encodeURIComponent(filter)}` : ''}`)
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  const filterSelect = (
    <Select className="max-w-[200px]" value={filter} onChange={(e) => setFilter(e.target.value)}>
      <option value="">All entity types</option>
      {entities.map((e) => (
        <option key={e.slug} value={e.model}>{e.label}</option>
      ))}
    </Select>
  );

  return (
    <div>
      {embedded ? (
        <div className="flex justify-end mb-3">{filterSelect}</div>
      ) : (
        <PageHeader
          title="Audit Trail"
          subtitle="Every create, update, and delete across the platform."
          actions={filterSelect}
        />
      )}

      {error && <ErrorMessage className="mb-3">{error}</ErrorMessage>}

      <Card variant="elevated" className="overflow-hidden">
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
      </Card>

      <p className="text-xs text-[#a3a3a3] mt-3">
        Showing the most recent {entries.length} entries.
        {!embedded && (
          <>
            {' '}
            <Link to="/admin" className="underline hover:text-[#171717]">Back to Data Admin</Link>
          </>
        )}
      </p>
    </div>
  );
}
