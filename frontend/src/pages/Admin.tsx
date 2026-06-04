import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import PageHeader from '../components/PageHeader';
import EntityForm from '../components/EntityForm';
import ValueStreamLevels from '../components/ValueStreamLevels';
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
  const [catalogOpen, setCatalogOpen] = useState(false);
  // Set when an unwired tab leaf is selected — shows a "coming soon" panel.
  const [placeholder, setPlaceholder] = useState<string | null>(null);

  const entity = useMemo(() => entities.find((e) => e.slug === slug) ?? null, [entities, slug]);

  // The sidebar mirrors the app's main navigation: each tab is a section header
  // with a single config leaf beneath it. Only Value Streams → Levels is wired up
  // today (the existing level editor); the rest are placeholders. Everything else
  // lives in the collapsible "Data Catalog" below.
  const TAB_TREE: { tab: string; leaf: string; slug?: string }[] = [
    { tab: 'Home', leaf: 'Config' },
    { tab: 'Value Streams', leaf: 'Levels', slug: 'valueStreams' },
    { tab: 'Organization', leaf: 'Levels', slug: 'organization' },
    { tab: 'Standards', leaf: 'Config' },
    { tab: 'Telemetry', leaf: 'Config' },
    { tab: 'Initiatives', leaf: 'Config' },
    { tab: 'Deliverables & Tasks', leaf: 'Config' },
  ];
  // valueStreams is surfaced under Value Streams → Levels above, so keep it out of
  // the catalog to avoid listing it twice.
  const catalogEntities = useMemo(() => entities.filter((e) => e.slug !== 'valueStreams'), [entities]);

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
        if (m.entities.length) setSlug((s) => s || 'valueStreams');
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
        {/* Entity sidebar — the levels we edit are pinned at the top; the rest of
            the operating-model data lives in a collapsed "Data Catalog". */}
        <aside className="lg:w-56 flex-shrink-0">
          <div className="card-elevated p-2 max-h-[70vh] overflow-y-auto">
            <nav className="space-y-0.5">
              {TAB_TREE.map(({ tab, leaf, slug: leafSlug }, i) => {
                const active = leafSlug ? (leafSlug === slug && !placeholder) : placeholder === tab;
                return (
                  <div key={tab}>
                    <div className={'px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] ' + (i === 0 ? 'pt-1' : 'pt-3')}>
                      {tab}
                    </div>
                    <button
                      onClick={() => {
                        if (leafSlug) { setSlug(leafSlug); setPlaceholder(null); }
                        else setPlaceholder(tab);
                      }}
                      className={
                        'w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors duration-150 ' +
                        (active ? 'bg-[#f5f5f5] text-[#171717] font-medium' : 'text-[#525252] hover:bg-[#fafafa] hover:text-[#171717]')
                      }
                    >
                      {leaf}
                    </button>
                  </div>
                );
              })}

              {/* Data Catalog — all importable data; collapsed to start. */}
              <div className="pt-3">
                <button
                  onClick={() => setCatalogOpen((o) => !o)}
                  className="w-full flex items-center gap-1.5 px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] hover:text-[#525252]"
                >
                  <span className="text-[8px] leading-none">{catalogOpen ? '▼' : '▶'}</span>
                  Data Catalog
                </button>
                {catalogOpen && catalogEntities.map((e, i) => (
                  <div key={e.slug}>
                    {(e.group && e.group !== catalogEntities[i - 1]?.group) && (
                      <div className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#c4c4c4]">{e.group}</div>
                    )}
                    <button
                      onClick={() => { setSlug(e.slug); setPlaceholder(null); }}
                      className={
                        'w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors duration-150 ' +
                        (e.slug === slug && !placeholder ? 'bg-[#f5f5f5] text-[#171717] font-medium' : 'text-[#525252] hover:bg-[#fafafa] hover:text-[#171717]')
                      }
                    >
                      {e.label}
                    </button>
                  </div>
                ))}
              </div>
            </nav>
          </div>
        </aside>

        {/* Records */}
        <section className="flex-1 min-w-0">
          {placeholder ? (
            <div className="card-elevated p-10 text-center">
              <div className="text-sm font-medium text-[#525252] mb-1">{placeholder} configuration</div>
              <div className="text-sm text-[#a3a3a3]">This screen is coming soon.</div>
            </div>
          ) : (slug === 'valueStreams' || slug === 'organization') ? (
            <ValueStreamLevels companyId={companyId} entity={slug} />
          ) : (
          <>
          <div className="flex items-center gap-3 mb-3">
            <input
              className="input max-w-xs"
              placeholder={entity ? `Search ${entity.label}…` : 'Search…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
          </>
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
