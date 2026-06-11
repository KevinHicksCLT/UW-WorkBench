import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import EntityForm from '../EntityForm';
import type { AdminEntity, ListResponse } from '../../lib/adminTypes';
import { fieldLabel, cellText, pickColumns } from '../../lib/adminFormat';

// Reusable record table for one admin entity: search + table + create/edit/delete
// through the shared EntityForm drawer. Used directly for generic catalog tabs,
// and as the building block of the master-detail editors. Optional `filter`
// narrows rows client-side (for child collections), `fixed` presets+hides fields
// on new records (e.g. a parent FK) AND narrows the list server-side (each entry
// becomes an exact-match f_<field> filter, so pre-filtered sections see all their
// rows — not just the matches inside the first page), and `onSelect` turns rows
// into a picker.

type Props = {
  entity: AdminEntity;
  companyId: string | null;
  title?: string;
  newLabel?: string;
  fixed?: Record<string, any>;
  filter?: (row: Record<string, any>) => boolean;
  selectable?: boolean;
  selectedId?: string | null;
  onSelect?: (row: Record<string, any>) => void;
  onChanged?: () => void; // fired after any create/update/delete
  emptyHint?: string;
  dense?: boolean;
  bodyMaxHeight?: string; // cap the table body height + scroll it (master-detail lists)
};

function withCompany(path: string, companyId: string | null) {
  if (!companyId) return path;
  return path + (path.includes('?') ? '&' : '?') + `companyId=${companyId}`;
}

// Entities whose delete cascades a large subtree — require typed-name confirmation
// instead of a one-click confirm (audit A4: company delete wipes its whole tree).
const TYPED_CONFIRM_DELETE = new Set(['company']);

export default function EntityList({
  entity, companyId, title, newLabel, fixed, filter, selectable, selectedId, onSelect, onChanged, emptyHint, dense, bodyMaxHeight,
}: Props) {
  const dialogs = useDialogs();
  const [list, setList] = useState<ListResponse | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Record<string, any> | null | 'new'>(null);
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);

  const columns = useMemo(() => pickColumns(entity), [entity]);

  const toggleSort = (col: string) =>
    setSort((s) => (s?.col === col ? (s.dir === 1 ? { col, dir: -1 } : null) : { col, dir: 1 }));

  // `fixed` values double as server-side exact-match filters.
  const fixedQs = fixed
    ? Object.entries(fixed).map(([k, v]) => `&f_${k}=${encodeURIComponent(String(v))}`).join('')
    : '';

  const load = (q: string) => {
    setLoading(true); setError('');
    api.get(withCompany(`/admin/${entity.slug}?limit=200${fixedQs}${q ? `&search=${encodeURIComponent(q)}` : ''}`, companyId))
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { setSearch(''); load(''); /* eslint-disable-next-line */ }, [entity.slug, companyId, fixedQs]);
  useEffect(() => { const t = setTimeout(() => load(search), 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [search]);

  const rows = useMemo(() => {
    const all = list?.rows ?? [];
    const filtered = filter ? all.filter(filter) : all;
    if (!sort) return filtered;
    const { col, dir } = sort;
    return [...filtered].sort((a, b) => {
      const av = a[col], bv = b[col];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [list, filter, sort]);

  const onSaved = () => { setEditing(null); load(search); onChanged?.(); };
  const doDelete = async (row: Record<string, any>) => {
    try { await api.delete(withCompany(`/admin/${entity.slug}/${row.id}`, companyId)); load(search); onChanged?.(); }
    catch (e) { void dialogs.alert({ title: 'Delete failed', message: (e as Error).message }); }
  };
  const remove = async (row: Record<string, any>) => {
    const name = String(row[entity.labelField] ?? row.id);
    const ok = TYPED_CONFIRM_DELETE.has(entity.slug)
      ? await dialogs.confirm({
          title: `Delete ${entity.label} permanently?`,
          danger: true,
          typedConfirm: name,
          confirmLabel: 'Delete permanently',
          message: (
            <>
              This permanently deletes <span className="font-medium text-[#171717]">{name}</span> and{' '}
              <span className="font-medium">all of its data</span> — divisions, departments, roles, people, value
              streams, applications, initiatives, deliverables, tasks, and everything else scoped to it. This cascades
              and <span className="font-medium">cannot be undone</span>.
            </>
          ),
        })
      : await dialogs.confirm({
          title: `Delete this ${entity.label}?`,
          danger: true,
          message: (
            <>
              <span className="font-medium text-[#171717]">{name}</span> will be deleted. This cannot be undone.
            </>
          ),
        });
    if (ok) void doDelete(row);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        {title && <h3 className="text-sm font-semibold text-[#171717]">{title}</h3>}
        <input
          className="input max-w-xs"
          placeholder={`Search ${entity.label}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex-1" />
        <button className="btn-primary" onClick={() => setEditing('new')}>+ {newLabel ?? `New ${entity.label}`}</button>
      </div>

      {error && <div className="text-sm text-[#be123c] mb-3">{error}</div>}

      <div className="card-elevated overflow-hidden">
        <div className="table-scroll" style={bodyMaxHeight ? { maxHeight: bodyMaxHeight, overflowY: 'auto' } : undefined}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eaeaea] text-left">
                {columns.map((c) => (
                  <th key={c.name} className={`px-3 ${dense ? 'py-1.5' : 'py-2'} font-medium text-[#666666] whitespace-nowrap`}>
                    <button
                      onClick={() => toggleSort(c.name)}
                      className="inline-flex items-center gap-1 hover:text-[#171717]"
                      title={`Sort by ${fieldLabel(entity.slug, c.name)}`}
                    >
                      {fieldLabel(entity.slug, c.name)}
                      <span className={'text-[10px] ' + (sort?.col === c.name ? 'text-[#171717]' : 'text-[#d4d4d4]')}>
                        {sort?.col === c.name ? (sort.dir === 1 ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 1} className="px-3 py-8 text-center text-[#a3a3a3]">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={columns.length + 1} className="px-3 py-8 text-center text-[#a3a3a3] italic">{emptyHint ?? 'No records.'}</td></tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={selectable ? () => onSelect?.(row) : undefined}
                    className={
                      'border-b border-[#f5f5f5] last:border-0 ' +
                      (selectable ? 'cursor-pointer ' : '') +
                      (selectedId === row.id ? 'bg-[#eef6fb] hover:bg-[#e3f0f9]' : 'hover:bg-[#fafafa]')
                    }
                  >
                    {columns.map((c) => (
                      <td key={c.name} className={`px-3 ${dense ? 'py-1.5' : 'py-2'} text-[#171717] align-top`}>{cellText(c, row[c.name])}</td>
                    ))}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={(e) => { e.stopPropagation(); setEditing(row); }} className="text-[#525252] hover:text-[#171717] text-xs font-medium">Edit</button>
                      <button onClick={(e) => { e.stopPropagation(); void remove(row); }} className="ml-3 text-[#be123c] hover:text-[#9f1239] text-xs font-medium">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== null && (
        <EntityForm
          entity={entity}
          companyId={companyId}
          record={editing === 'new' ? null : editing}
          fixed={fixed}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

    </div>
  );
}
