import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import EntityForm from '../EntityForm';
import type { AdminEntity, ListResponse } from '../../lib/adminTypes';
import { humanize, cellText, pickColumns } from '../../lib/adminFormat';

// Reusable record table for one admin entity: search + table + create/edit/delete
// through the shared EntityForm drawer. Used directly for generic catalog tabs,
// and as the building block of the master-detail editors. Optional `filter`
// narrows rows client-side (for child collections), `fixed` presets+hides fields
// on new records (e.g. a parent FK), and `onSelect` turns rows into a picker.

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

export default function EntityList({
  entity, companyId, title, newLabel, fixed, filter, selectable, selectedId, onSelect, onChanged, emptyHint, dense, bodyMaxHeight,
}: Props) {
  const [list, setList] = useState<ListResponse | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Record<string, any> | null | 'new'>(null);

  const columns = useMemo(() => pickColumns(entity), [entity]);

  const load = (q: string) => {
    setLoading(true); setError('');
    api.get(withCompany(`/admin/${entity.slug}?limit=200${q ? `&search=${encodeURIComponent(q)}` : ''}`, companyId))
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { setSearch(''); load(''); /* eslint-disable-next-line */ }, [entity.slug, companyId]);
  useEffect(() => { const t = setTimeout(() => load(search), 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [search]);

  const rows = useMemo(() => {
    const all = list?.rows ?? [];
    return filter ? all.filter(filter) : all;
  }, [list, filter]);

  const onSaved = () => { setEditing(null); load(search); onChanged?.(); };
  const remove = async (row: Record<string, any>) => {
    const name = row[entity.labelField] ?? row.id;
    if (!confirm(`Delete this ${entity.label}?\n\n${name}\n\nThis cannot be undone.`)) return;
    try { await api.delete(withCompany(`/admin/${entity.slug}/${row.id}`, companyId)); load(search); onChanged?.(); }
    catch (e) { alert((e as Error).message); }
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
                  <th key={c.name} className={`px-3 ${dense ? 'py-1.5' : 'py-2'} font-medium text-[#666666] whitespace-nowrap`}>{humanize(c.name)}</th>
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
                      <button onClick={(e) => { e.stopPropagation(); remove(row); }} className="ml-3 text-[#be123c] hover:text-[#9f1239] text-xs font-medium">Delete</button>
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
