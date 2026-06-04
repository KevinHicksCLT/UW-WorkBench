import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import PageHeader from '../components/PageHeader';
import EntityForm from '../components/EntityForm';
import DataDictionary from './DataDictionary';
import type { AdminEntity, ListResponse } from '../lib/adminTypes';

// Append the active companyId to an admin path (the backend isolates every
// company-scoped entity by it). The Company table ignores the param server-side.
function withCompany(path: string, companyId: string | null) {
  if (!companyId) return path;
  return path + (path.includes('?') ? '&' : '?') + `companyId=${companyId}`;
}

// Generic admin console. One screen drives create/read/update/delete over every
// tenant-scoped table. Entity list + per-entity fields come from /admin/_meta.

// Turn a camelCase field name into a human-readable header: valueStreamId → "Value Stream".
function humanize(name: string): string {
  return name
    .replace(/Id$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function cellText(field: { kind: string }, v: any): string {
  if (v === null || v === undefined || v === '') return '—';
  if (field.kind === 'boolean') return v ? '✓' : '–';
  if (field.kind === 'datetime') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
  }
  const s = String(v);
  return s.length > 48 ? s.slice(0, 47) + '…' : s;
}

export default function Admin() {
  const { companyId, company } = useCompany();
  const [view, setView] = useState<'records' | 'dictionary'>('records');
  const [entities, setEntities] = useState<AdminEntity[]>([]);
  const [slug, setSlug] = useState<string>('');
  const [list, setList] = useState<ListResponse | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Record<string, any> | null | 'new'>(null);

  const entity = useMemo(() => entities.find((e) => e.slug === slug) ?? null, [entities, slug]);

  // Columns shown in the table: label field first, then a few short scalars.
  const columns = useMemo(() => {
    if (!entity) return [];
    const label = entity.fields.find((f) => f.name === entity.labelField);
    const rest = entity.fields
      .filter((f) => f.name !== entity.labelField && !f.relation && !f.multiline)
      .slice(0, 4);
    return [label, ...rest].filter(Boolean) as AdminEntity['fields'];
  }, [entity]);

  useEffect(() => {
    api.get('/admin/_meta')
      .then((m) => {
        setEntities(m.entities);
        if (m.entities.length) setSlug((s) => s || m.entities[0].slug);
      })
      .catch((e) => setError(e.message));
  }, []);

  const load = (s: string, q: string) => {
    if (!s) return;
    setLoading(true);
    setError('');
    api.get(withCompany(`/admin/${s}?limit=100${q ? `&search=${encodeURIComponent(q)}` : ''}`, companyId))
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // Reload when entity or active company changes; debounce search.
  useEffect(() => { setSearch(''); load(slug, ''); /* eslint-disable-next-line */ }, [slug, companyId]);
  useEffect(() => {
    const t = setTimeout(() => load(slug, search), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [search]);

  const onSaved = () => { setEditing(null); load(slug, search); };

  const remove = async (row: Record<string, any>) => {
    const name = entity ? row[entity.labelField] ?? row.id : row.id;
    if (!confirm(`Delete this ${entity?.label}?\n\n${name}\n\nThis cannot be undone.`)) return;
    try {
      await api.delete(withCompany(`/admin/${slug}/${row.id}`, companyId));
      load(slug, search);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Data Admin"
        subtitle={
          view === 'records'
            ? `Create, edit, and delete records for ${company?.name ?? 'the active company'}. All changes are audited.`
            : 'Plain-language definitions of the terms used across the platform — what each one means in our operating model.'
        }
        eyebrow={company ? 'Editing company' : undefined}
        actions={<Link to="/audit" className="btn-secondary">View audit trail</Link>}
      />

      {/* View switch: the CRUD console vs. the read-only data dictionary. */}
      <div className="inline-flex rounded-lg border border-[#eaeaea] p-0.5 mb-5">
        {([['records', 'Records'], ['dictionary', 'Data Dictionary']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={'px-3 py-1 text-sm font-medium rounded-md transition-colors duration-150 '
              + (view === v ? 'bg-[#171717] text-white' : 'text-[#525252] hover:text-[#171717]')}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'dictionary' ? (
        <DataDictionary embedded />
      ) : (
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Entity sidebar — grouped by operating-model area. Entities arrive
            pre-ordered by group, so a section header is rendered whenever the
            group changes. */}
        <aside className="lg:w-56 flex-shrink-0">
          <div className="card-elevated p-2 max-h-[70vh] overflow-y-auto">
            <nav className="space-y-0.5">
              {entities.map((e, i) => {
                const newGroup = e.group && e.group !== entities[i - 1]?.group;
                return (
                  <div key={e.slug}>
                    {newGroup && (
                      <div className={'px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] ' + (i === 0 ? 'pt-1' : 'pt-3')}>
                        {e.group}
                      </div>
                    )}
                    <button
                      onClick={() => setSlug(e.slug)}
                      className={
                        'w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors duration-150 ' +
                        (e.slug === slug
                          ? 'bg-[#f5f5f5] text-[#171717] font-medium'
                          : 'text-[#525252] hover:bg-[#fafafa] hover:text-[#171717]')
                      }
                    >
                      {e.label}
                    </button>
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Records */}
        <section className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <input
              className="input max-w-xs"
              placeholder={entity ? `Search ${entity.label}…` : 'Search…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="text-xs text-[#a3a3a3] tnum">{list ? `${list.total} total` : ''}</span>
            <div className="flex-1" />
            <button className="btn-primary" disabled={!entity} onClick={() => setEditing('new')}>
              + New {entity?.label}
            </button>
          </div>

          {error && <div className="text-sm text-[#be123c] mb-3">{error}</div>}

          <div className="card-elevated overflow-hidden">
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#eaeaea] text-left">
                    {columns.map((c) => (
                      <th key={c.name} className="px-3 py-2 font-medium text-[#666666] whitespace-nowrap">{humanize(c.name)}</th>
                    ))}
                    <th className="px-3 py-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={columns.length + 1} className="px-3 py-8 text-center text-[#a3a3a3]">Loading…</td></tr>
                  ) : !list || list.rows.length === 0 ? (
                    <tr><td colSpan={columns.length + 1} className="px-3 py-8 text-center text-[#a3a3a3] italic">No records.</td></tr>
                  ) : (
                    list.rows.map((row) => (
                      <tr key={row.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]">
                        {columns.map((c) => (
                          <td key={c.name} className="px-3 py-2 text-[#171717] align-top">{cellText(c, row[c.name])}</td>
                        ))}
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button onClick={() => setEditing(row)} className="text-[#525252] hover:text-[#171717] text-xs font-medium">Edit</button>
                          <button onClick={() => remove(row)} className="ml-3 text-[#be123c] hover:text-[#9f1239] text-xs font-medium">Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {list && list.total > list.rows.length && (
            <p className="text-xs text-[#a3a3a3] mt-2">Showing first {list.rows.length} of {list.total}. Refine with search.</p>
          )}
        </section>
      </div>
      )}

      {entity && editing !== null && (
        <EntityForm
          entity={entity}
          companyId={companyId}
          record={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
