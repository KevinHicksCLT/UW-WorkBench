import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { ListResponse } from '../lib/adminTypes';

// Level-laid-out editor for the unified "Levels" entity (GET /admin/valueStreams).
// One tab per level; each row renames inline and connects to a parent one level up
// via a dropdown. New levels can be added directly or imported from an Org node.
// Backed entirely by the existing /admin/valueStreams endpoints — see
// backend/src/lib/valueStreamAdmin.ts for the level numbering + parent rules.

type LevelNode = {
  id: string; // prefixed id (d:/v:/s:)
  name: string;
  level: string; // "Level N"
  optionLabel: string;
  parentId: string | null;
  _lvl: number; // numeric level, for grouping
};

const MAX_LEVEL = 5;
const ORG_TYPES = [
  { type: 'division', label: 'Division' },
  { type: 'department', label: 'Department' },
  { type: 'role', label: 'Role' },
] as const;

function withCompany(path: string, companyId: string | null) {
  if (!companyId) return path;
  return path + (path.includes('?') ? '&' : '?') + `companyId=${companyId}`;
}

export default function ValueStreamLevels({ companyId, entity = 'valueStreams' }: { companyId: string | null; entity?: string }) {
  const base = `/admin/${entity}`;
  const [rows, setRows] = useState<LevelNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);

  // Add-form + import-form state.
  const [newName, setNewName] = useState('');
  const [newParent, setNewParent] = useState('');
  const [importing, setImporting] = useState(false);
  const [orgType, setOrgType] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgOptions, setOrgOptions] = useState<{ id: string; name: string }[]>([]);

  const load = () => {
    if (!companyId) return;
    setLoading(true);
    setError('');
    api.get(withCompany(`${base}?limit=2000`, companyId))
      .then((r: ListResponse) => setRows(r.rows as LevelNode[]))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const maxLevel = useMemo(() => rows.reduce((m, r) => Math.max(m, r._lvl), -1), [rows]);
  // Show a tab for every populated level (0-based), plus the next empty one to grow into.
  const tabMax = Math.min(maxLevel + 1, MAX_LEVEL);
  const tabs = Array.from({ length: tabMax + 1 }, (_, i) => i);
  useEffect(() => { if (active > tabMax) setActive(tabMax); }, [tabMax, active]);

  const atLevel = (lvl: number) =>
    rows.filter((r) => r._lvl === lvl).sort((a, b) => a.name.localeCompare(b.name));
  const nodes = atLevel(active);
  const parents = atLevel(active - 1); // candidate parents for the active level
  const needsParent = active > 0; // Level 0 (top) has no parent

  // ── mutations (reload after each) ─────────────────────────────────────────
  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); load(); } catch (e) { setError((e as Error).message); }
  };
  const rename = (node: LevelNode, name: string) => {
    const v = name.trim();
    if (!v || v === node.name) return;
    run(() => api.patch(withCompany(`${base}/${node.id}`, companyId), { name: v }));
  };
  const reparent = (node: LevelNode, parentId: string) =>
    run(() => api.patch(withCompany(`${base}/${node.id}`, companyId), { parentId: parentId || null }));
  const remove = (node: LevelNode) => {
    if (!confirm(`Delete "${node.name}" and everything beneath it?\n\nThis cannot be undone.`)) return;
    run(() => api.delete(withCompany(`${base}/${node.id}`, companyId)));
  };
  const add = () => {
    const v = newName.trim();
    if (!v || (needsParent && !newParent)) return;
    run(() => api.post(withCompany(base, companyId), { name: v, parentId: needsParent ? newParent : undefined }))
      .then(() => { setNewName(''); });
  };
  const loadOrg = (type: string) => {
    setOrgType(type);
    setOrgId('');
    setOrgOptions([]);
    if (!type) return;
    api.get(withCompany(`/admin/${type}?limit=500`, companyId))
      .then((r: ListResponse) => setOrgOptions(r.rows.map((o) => ({ id: o.id, name: o.name }))))
      .catch((e) => setError(e.message));
  };
  const doImport = () => {
    if (!orgType || !orgId || (needsParent && !newParent)) return;
    run(() => api.post(withCompany(base, companyId), {
      importOrg: { type: orgType, id: orgId },
      parentId: needsParent ? newParent : undefined,
    })).then(() => { setOrgId(''); });
  };

  if (!companyId) return <div className="text-sm text-[#a3a3a3]">Select a company to edit its levels.</div>;

  const parentSelect = (value: string, onChange: (v: string) => void, allowNone: boolean) => (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {(allowNone || !value) && <option value="">{allowNone ? '— none —' : 'Select parent…'}</option>}
      {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );

  return (
    <div>
      {/* Level tabs */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-[#eaeaea]">
        {tabs.map((l) => {
          const count = rows.filter((r) => r._lvl === l).length;
          return (
            <button
              key={l}
              onClick={() => setActive(l)}
              className={
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 ' +
                (active === l ? 'text-[#171717] border-[#171717]' : 'text-[#a3a3a3] border-transparent hover:text-[#525252]')
              }
            >
              Level {l}{count ? <span className="ml-1 text-[#a3a3a3]">({count})</span> : null}
            </button>
          );
        })}
      </div>

      {error && <div className="text-sm text-[#be123c] mb-3">{error}</div>}

      {needsParent && parents.length === 0 ? (
        <div className="text-sm text-[#a3a3a3] italic mb-4">Add a Level {active - 1} first — every Level {active} connects to a Level {active - 1} parent.</div>
      ) : null}

      {/* Rows at the active level */}
      <div className="card-elevated overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#eaeaea] text-left">
              <th className="px-3 py-2 font-medium text-[#666666]">Name</th>
              <th className="px-3 py-2 font-medium text-[#666666] w-72">{needsParent ? `Connected to (Level ${active - 1})` : 'Parent'}</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-3 py-8 text-center text-[#a3a3a3]">Loading…</td></tr>
            ) : nodes.length === 0 ? (
              <tr><td colSpan={3} className="px-3 py-8 text-center text-[#a3a3a3] italic">No Level {active} items yet.</td></tr>
            ) : (
              nodes.map((node) => (
                <tr key={node.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]">
                  <td className="px-3 py-2">
                    <input
                      key={`${node.id}:${node.name}`}
                      className="input"
                      defaultValue={node.name}
                      onBlur={(e) => rename(node, e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {needsParent
                      ? parentSelect(node.parentId ?? '', (v) => reparent(node, v), false)
                      : <span className="text-[#a3a3a3]">— top level —</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => remove(node)} className="text-[#be123c] hover:text-[#9f1239] text-xs font-medium">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add a new Level N */}
      {(!needsParent || parents.length > 0) && (
        <div className="card p-3 mb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="label">New Level {active} name</label>
              <input className="input" value={newName} placeholder={`Name…`} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            </div>
            {needsParent && (
              <div className="w-64">
                <label className="label">Connect to (Level {active - 1})</label>
                {parentSelect(newParent, setNewParent, false)}
              </div>
            )}
            <button className="btn-primary" disabled={!newName.trim() || (needsParent && !newParent)} onClick={add}>+ Add Level {active}</button>
          </div>
        </div>
      )}

      {/* Import from Org */}
      {(!needsParent || parents.length > 0) && (
        <div>
          <button className="btn-secondary" onClick={() => setImporting((v) => !v)}>
            {importing ? 'Cancel import' : 'Import from Data Catalog…'}
          </button>
          {importing && (
            <div className="card p-3 mt-2">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-40">
                  <label className="label">Org type</label>
                  <select className="input" value={orgType} onChange={(e) => loadOrg(e.target.value)}>
                    <option value="">Select…</option>
                    {ORG_TYPES.map((o) => <option key={o.type} value={o.type}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="label">Org item</label>
                  <select className="input" value={orgId} disabled={!orgType} onChange={(e) => setOrgId(e.target.value)}>
                    <option value="">{orgType ? 'Select…' : '—'}</option>
                    {orgOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                {needsParent && (
                  <div className="w-64">
                    <label className="label">Connect to (Level {active - 1})</label>
                    {parentSelect(newParent, setNewParent, false)}
                  </div>
                )}
                <button className="btn-primary" disabled={!orgId || (needsParent && !newParent)} onClick={doImport}>Import as Level {active}</button>
              </div>
              <div className="text-xs text-[#a3a3a3] mt-2">Copies the org item's name into a new Level {active} (you can rename it after).</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
