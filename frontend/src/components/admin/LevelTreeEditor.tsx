import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { ListResponse } from '../../lib/adminTypes';

// ─── Drill-down tree editor for the configurable Level / OrgLevel hierarchies ──
// The old editor showed every level in one flat tab — Level 5 alone is 256 rows
// with no parent context, which is exactly what made it unusable. This editor
// instead navigates the tree the way the data is actually shaped: you start at the
// root and drill into ONE node at a time, so you only ever see a node's direct
// children (a handful), with a breadcrumb showing where you are. Rich detail
// (description, leads, inputs, outputs …) edits in a slide-over. Backed entirely
// by the existing /admin/{valueStreams|organization} endpoints.

type Node = {
  id: string;
  name: string;
  level: string; // "Level N"
  optionLabel: string;
  parentId: string | null;
  _lvl: number;
  description: string | null;
  leads: string | null;
  supporting: string | null;
  inputs: string | null;
  outputs: string | null;
  externalParticipants: string | null;
  notes: string | null;
};

const ORG_TYPES = [
  { type: 'division', label: 'Division' },
  { type: 'department', label: 'Department' },
  { type: 'role', label: 'Role' },
] as const;

// Field definitions for the detail drawer.
const DETAIL_FIELDS: { name: keyof Node; label: string; multiline?: boolean; hint?: string }[] = [
  { name: 'description', label: 'Description', multiline: true },
  { name: 'leads', label: 'Leads / accountable', hint: 'Roles that lead this step' },
  { name: 'supporting', label: 'Supporting roles' },
  { name: 'inputs', label: 'Inputs', multiline: true },
  { name: 'outputs', label: 'Outputs / deliverables', multiline: true },
  { name: 'externalParticipants', label: 'External participants' },
  { name: 'notes', label: 'Notes', multiline: true },
];

function withCompany(path: string, companyId: string | null) {
  if (!companyId) return path;
  return path + (path.includes('?') ? '&' : '?') + `companyId=${companyId}`;
}

export default function LevelTreeEditor({
  companyId,
  entity,
  levelNames,
  rootLabel,
}: {
  companyId: string | null;
  entity: 'valueStreams' | 'organization';
  levelNames?: string[]; // optional friendly names per level number (index = level)
  rootLabel: string; // label for the root crumb, e.g. "Value Streams"
}) {
  const base = `/admin/${entity}`;
  const [rows, setRows] = useState<Node[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [path, setPath] = useState<string[]>([]); // ids of focused ancestor chain
  const [detailId, setDetailId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [orgType, setOrgType] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgOptions, setOrgOptions] = useState<{ id: string; name: string }[]>([]);

  const load = () => {
    if (!companyId) return;
    setLoading(true);
    setError('');
    api.get(withCompany(`${base}?limit=5000`, companyId))
      .then((r: ListResponse) => setRows(r.rows as Node[]))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { setPath([]); load(); /* eslint-disable-next-line */ }, [companyId, entity]);

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const childrenOf = useMemo(() => {
    const m = new Map<string | null, Node[]>();
    for (const r of rows) {
      const k = r.parentId;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
    return m;
  }, [rows]);

  const focusedId = path.length ? path[path.length - 1] : null;
  const focused = focusedId ? byId.get(focusedId) ?? null : null;
  const children = childrenOf.get(focusedId) ?? [];
  const childLevel = focused ? focused._lvl + 1 : 0;
  const levelName = (n: number) => levelNames?.[n] ?? `Level ${n}`;
  const detailNode = detailId ? byId.get(detailId) ?? null : null;

  // Breadcrumb chain (root → focused).
  const crumbs = path.map((id) => byId.get(id)).filter(Boolean) as Node[];

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); load(); } catch (e) { setError((e as Error).message); }
  };

  const drillTo = (id: string | null) => {
    if (id === null) { setPath([]); return; }
    // If id is already in path, truncate to it; else if child of focused, push.
    const idx = path.indexOf(id);
    if (idx >= 0) setPath(path.slice(0, idx + 1));
    else setPath([...path, id]);
  };

  const addChild = () => {
    const v = newName.trim();
    if (!v) return;
    run(() => api.post(withCompany(base, companyId), { name: v, parentId: focusedId ?? undefined }))
      .then(() => setNewName(''));
  };
  const rename = (node: Node, name: string) => {
    const v = name.trim();
    if (!v || v === node.name) return;
    run(() => api.patch(withCompany(`${base}/${node.id}`, companyId), { name: v }));
  };
  const remove = (node: Node) => {
    const kids = (childrenOf.get(node.id) ?? []).length;
    const warn = kids ? `\n\nThis also deletes ${kids} item${kids === 1 ? '' : 's'} beneath it.` : '';
    if (!confirm(`Delete "${node.name}"?${warn}\n\nThis cannot be undone.`)) return;
    run(() => api.delete(withCompany(`${base}/${node.id}`, companyId)));
    if (detailId === node.id) setDetailId(null);
  };

  const loadOrg = (type: string) => {
    setOrgType(type); setOrgId(''); setOrgOptions([]);
    if (!type) return;
    api.get(withCompany(`/admin/${type}?limit=500`, companyId))
      .then((r: ListResponse) => setOrgOptions(r.rows.map((o) => ({ id: o.id, name: o.name }))))
      .catch((e) => setError(e.message));
  };
  const doImport = () => {
    if (!orgType || !orgId) return;
    run(() => api.post(withCompany(base, companyId), { importOrg: { type: orgType, id: orgId }, parentId: focusedId ?? undefined }))
      .then(() => { setOrgId(''); setImportOpen(false); });
  };

  if (!companyId) return <div className="text-sm text-[#a3a3a3]">Select a company to edit its {rootLabel.toLowerCase()}.</div>;

  return (
    <div className="relative">
      {/* Breadcrumb */}
      <div className="flex items-center flex-wrap gap-1 text-sm mb-3">
        <button
          onClick={() => drillTo(null)}
          className={'px-2 py-1 rounded-md font-medium ' + (focusedId === null ? 'bg-[#f5f5f5] text-[#171717]' : 'text-[#0070AD] hover:bg-[#fafafa]')}
        >
          {rootLabel}
        </button>
        {crumbs.map((c) => (
          <span key={c.id} className="flex items-center gap-1">
            <span className="text-[#d4d4d4]">/</span>
            <button
              onClick={() => drillTo(c.id)}
              className={'px-2 py-1 rounded-md ' + (c.id === focusedId ? 'bg-[#f5f5f5] text-[#171717] font-medium' : 'text-[#0070AD] hover:bg-[#fafafa]')}
            >
              {c.name}
            </button>
          </span>
        ))}
      </div>

      {/* Focused node summary */}
      {focused && (
        <div className="card p-3 mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{levelName(focused._lvl)}</div>
            <div className="text-base font-semibold text-[#171717] truncate">{focused.name}</div>
            {focused.description && <div className="text-sm text-[#666666] mt-1 line-clamp-2">{focused.description}</div>}
          </div>
          <button className="btn-secondary flex-shrink-0" onClick={() => setDetailId(focused.id)}>Edit details</button>
        </div>
      )}

      {error && <div className="text-sm text-[#be123c] mb-3">{error}</div>}

      {/* Children */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-[#171717]">
          {levelName(childLevel)}
          <span className="ml-1.5 text-[#a3a3a3] font-normal">({children.length})</span>
        </div>
      </div>

      <div className="card-elevated overflow-hidden mb-3">
        <table className="w-full text-sm">
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-8 text-center text-[#a3a3a3]">Loading…</td></tr>
            ) : children.length === 0 ? (
              <tr><td className="px-3 py-8 text-center text-[#a3a3a3] italic">No {levelName(childLevel).toLowerCase()} here yet — add one below.</td></tr>
            ) : (
              children.map((node) => {
                const kids = (childrenOf.get(node.id) ?? []).length;
                return (
                  <tr key={node.id} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] group">
                    <td className="px-3 py-1.5 w-full">
                      <input
                        key={`${node.id}:${node.name}`}
                        className="w-full bg-transparent border border-transparent hover:border-[#eaeaea] focus:border-[#171717] focus:bg-white rounded-md px-2 py-1 text-[#171717] focus:outline-none transition-colors"
                        defaultValue={node.name}
                        onBlur={(e) => rename(node, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-right">
                      <button
                        onClick={() => drillTo(node.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#0070AD] hover:text-[#005a8c] px-2 py-1 rounded-md hover:bg-[#eef6fb]"
                        title={`Open ${node.name}`}
                      >
                        {kids > 0 && <span className="tnum text-[#a3a3a3]">{kids}</span>}
                        Open
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                      </button>
                      <button onClick={() => setDetailId(node.id)} className="text-xs font-medium text-[#525252] hover:text-[#171717] px-2 py-1 rounded-md hover:bg-[#f5f5f5]">Details</button>
                      <button onClick={() => remove(node)} className="text-xs font-medium text-[#be123c] hover:text-[#9f1239] px-2 py-1 rounded-md hover:bg-[#fef2f2] opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add child */}
      <div className="flex items-center gap-2 mb-2">
        <input
          className="input flex-1"
          placeholder={`Add ${levelName(childLevel)}${focused ? ` under "${focused.name}"` : ''}…`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addChild()}
        />
        <button className="btn-primary flex-shrink-0" disabled={!newName.trim()} onClick={addChild}>+ Add</button>
        <button className="btn-secondary flex-shrink-0" onClick={() => setImportOpen((v) => !v)}>
          {importOpen ? 'Cancel' : 'Import from catalog'}
        </button>
      </div>

      {importOpen && (
        <div className="card p-3 mb-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <label className="label">Catalog type</label>
              <select className="input" value={orgType} onChange={(e) => loadOrg(e.target.value)}>
                <option value="">Select…</option>
                {ORG_TYPES.map((o) => <option key={o.type} value={o.type}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="label">Item</label>
              <select className="input" value={orgId} disabled={!orgType} onChange={(e) => setOrgId(e.target.value)}>
                <option value="">{orgType ? 'Select…' : '—'}</option>
                {orgOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <button className="btn-primary" disabled={!orgId} onClick={doImport}>Import here</button>
          </div>
          <div className="text-xs text-[#a3a3a3] mt-2">Copies the catalog item's name in as a new {levelName(childLevel)} under the current node.</div>
        </div>
      )}

      {/* Detail drawer */}
      {detailNode && (
        <LevelDetailDrawer
          node={detailNode}
          base={base}
          companyId={companyId}
          levelName={levelName(detailNode._lvl)}
          parentOptions={rows.filter((r) => r._lvl === detailNode._lvl - 1)}
          onClose={() => setDetailId(null)}
          onSaved={() => { setDetailId(null); load(); }}
        />
      )}
    </div>
  );
}

// Slide-over editor for a single node's rich detail + reparenting.
function LevelDetailDrawer({
  node, base, companyId, levelName, parentOptions, onClose, onSaved,
}: {
  node: Node;
  base: string;
  companyId: string | null;
  levelName: string;
  parentOptions: Node[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = { name: node.name, parentId: node.parentId ?? '' };
    for (const f of DETAIL_FIELDS) v[f.name] = (node[f.name] as string | null) ?? '';
    return v;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setError('');
    try {
      const body: Record<string, unknown> = { name: values.name };
      for (const f of DETAIL_FIELDS) body[f.name] = values[f.name];
      if (node._lvl > 0) body.parentId = values.parentId || null;
      await api.patch(`${base}/${node.id}${companyId ? `?companyId=${companyId}` : ''}`, body);
      onSaved();
    } catch (e) {
      setError((e as Error).message); setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg h-full bg-white border-l border-[#eaeaea] shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 h-14 border-b border-[#eaeaea] flex-shrink-0">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{levelName}</div>
            <h2 className="text-sm font-semibold text-[#171717]">Edit details</h2>
          </div>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-[#171717]" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="label">Name <span className="text-[#be123c]">*</span></label>
            <input className="input" value={values.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          {node._lvl > 0 && (
            <div>
              <label className="label">Connected to ({parentOptions[0] ? parentOptions[0].level : 'parent'})</label>
              <select className="input" value={values.parentId} onChange={(e) => set('parentId', e.target.value)}>
                {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="text-xs text-[#a3a3a3] mt-1">Move this node — and everything beneath it — to a different parent.</div>
            </div>
          )}
          {DETAIL_FIELDS.map((f) => (
            <div key={f.name}>
              <label className="label">{f.label}</label>
              {f.multiline ? (
                <textarea className="input min-h-[72px]" value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} />
              ) : (
                <input className="input" value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} />
              )}
              {f.hint && <div className="text-xs text-[#a3a3a3] mt-1">{f.hint}</div>}
            </div>
          ))}
        </div>

        <div className="flex-shrink-0 border-t border-[#eaeaea] px-5 py-3 space-y-2">
          {error && <div className="text-xs text-[#be123c]">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving || !values.name.trim()} className="btn-primary disabled:opacity-50">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
