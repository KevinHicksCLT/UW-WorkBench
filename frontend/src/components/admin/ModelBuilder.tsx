import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

// Interactive operating-model builder (rework P7). One surface to build the
// structure (typed node tree), draw connections (typed links), and rename the
// taxonomy — speaking the domain, never raw tables. Backend: /builder/*.

type NodeType = { key: string; label: string; pluralLabel: string; level: number; parentKeys: string[]; sortOrder: number };
type TreeNode = { id: string; typeKey: string; parentId: string | null; name: string; description: string | null; sortOrder: number; provenance: string; inboundLinks: number };
type LinkRow = { id: string; relationType: string; attributes: any; peer: { id: string; name: string; typeKey: string } };

// Optional scope narrows the builder to one branch of the model so each Data
// Admin tab only shows ITS nodes (gap fix: roles/external parties no longer
// appear under Value Streams). 'work' = value-stream branch, 'external' = the
// external-party catalog, 'all' (default) = the whole model.
const SCOPES: Record<string, { types: string[]; rootType: string } | undefined> = {
  work: { types: ['value_stream', 'sub_process', 'step', 'io_item'], rootType: 'value_stream' },
  external: { types: ['external_party'], rootType: 'external_party' },
};

export default function ModelBuilder({ companyId, scope = 'all' }: { companyId: string | null; scope?: 'all' | 'work' | 'external' }) {
  const [types, setTypes] = useState<NodeType[]>([]);
  const [relationTypes, setRelationTypes] = useState<string[]>([]);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [stack, setStack] = useState<TreeNode[]>([]); // breadcrumb drill
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [links, setLinks] = useState<{ in: LinkRow[]; out: LinkRow[] } | null>(null);
  const [error, setError] = useState('');
  const [showTaxonomy, setShowTaxonomy] = useState(false);

  const typeByKey = useMemo(() => new Map(types.map((t) => [t.key, t])), [types]);
  const label = (key: string) => typeByKey.get(key)?.label ?? key;

  const load = () => {
    if (!companyId) return;
    Promise.all([api.get('/builder/types'), api.get(`/builder/tree?companyId=${companyId}`)])
      .then(([t, tr]: any[]) => { setTypes(t.types); setRelationTypes(t.relationTypes); setNodes(tr.nodes); })
      .catch((e: any) => setError(String(e?.message || e)));
  };
  useEffect(() => { setStack([]); setSelected(null); load(); /* eslint-disable-next-line */ }, [companyId]);

  useEffect(() => {
    if (!selected || !companyId) { setLinks(null); return; }
    api.get(`/builder/nodes/${selected.id}/links?companyId=${companyId}`).then(setLinks).catch(() => setLinks(null));
  }, [selected?.id, companyId]); // eslint-disable-line

  if (!companyId) return <p className="text-sm text-[#a3a3a3]">Select a company to build its operating model.</p>;

  const current = stack[stack.length - 1] ?? null;
  const scopeDef = SCOPES[scope];
  const scoped = scopeDef ? nodes.filter((n) => scopeDef.types.includes(n.typeKey)) : nodes;
  // Root view: the Enterprise tree first, external parties last (they're a flat
  // catalog, not part of the hierarchy). In a scoped view the root is the
  // scope's own top type (value streams / external parties).
  const typeRank = (k: string) => (k === 'enterprise' ? 0 : k === 'external_party' ? 9 : 1);
  const children = scoped
    .filter((n) => (current ? n.parentId === current.id : scopeDef ? n.typeKey === scopeDef.rootType : n.parentId === null))
    .sort((a, b) => typeRank(a.typeKey) - typeRank(b.typeKey) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  // Which node types may be created under the current node (taxonomy-driven,
  // limited to the scope's types when scoped).
  const childTypes = types
    .filter((t) => (scopeDef ? scopeDef.types.includes(t.key) : true))
    .filter((t) => (current ? t.parentKeys.includes(current.typeKey) : scopeDef ? t.key === scopeDef.rootType && t.parentKeys.length === 0 : t.parentKeys.length === 0));

  const patchNode = async (n: TreeNode, data: Record<string, unknown>) => {
    try {
      const updated = await api.patch(`/builder/nodes/${n.id}?companyId=${companyId}`, data);
      setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, ...updated } : x)));
      if (selected?.id === n.id) setSelected((s) => (s ? { ...s, ...updated } : s));
      setError('');
    } catch (e) { setError(String((e as Error).message)); }
  };
  const addNode = async (typeKey: string) => {
    const name = prompt(`Name for the new ${label(typeKey)}:`)?.trim();
    if (!name) return;
    try {
      const created = await api.post(`/builder/nodes?companyId=${companyId}`, { typeKey, parentId: current?.id ?? null, name });
      setNodes((ns) => [...ns, { ...created, inboundLinks: 0 }]);
      setError('');
    } catch (e) { setError(String((e as Error).message)); }
  };
  const removeNode = async (n: TreeNode) => {
    const kids = nodes.filter((x) => x.parentId === n.id).length;
    const msg = kids
      ? `"${n.name}" has ${kids} child node(s); deleting removes the whole subtree. Type the exact name to confirm:`
      : `Delete ${label(n.typeKey)} "${n.name}"?`;
    if (kids) {
      const typed = prompt(msg);
      if (typed !== n.name) return;
    } else if (!confirm(msg)) return;
    try {
      await api.delete(`/builder/nodes/${n.id}?companyId=${companyId}${kids ? `&confirm=${encodeURIComponent(n.name)}` : ''}`);
      if (selected?.id === n.id) setSelected(null);
      load();
    } catch (e) { setError(String((e as Error).message)); }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-3">
        <p className="text-sm text-[#666666] max-w-2xl">
          Build the operating model: drill the structure, add or rename nodes, and draw the connections between them.
          Every screen renders from this model — edits here are live everywhere. All changes are audited.
        </p>
        <button onClick={() => setShowTaxonomy((v) => !v)} className="flex-shrink-0 text-xs px-3 py-1.5 rounded-md border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa]">
          {showTaxonomy ? 'Hide taxonomy' : 'Taxonomy…'}
        </button>
      </div>
      {error && <div className="text-sm text-[#be123c] mb-3">{error}</div>}

      {showTaxonomy && (
        <div className="card-elevated p-4 mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[#a3a3a3] mb-2">Level names (taxonomy)</h4>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {types.map((t) => (
              <div key={t.key} className="flex items-center gap-2 text-sm">
                <span className="text-[10px] font-mono text-[#a3a3a3] w-24 truncate">{t.key}</span>
                <input
                  className="input py-1 text-sm flex-1"
                  defaultValue={t.label}
                  onBlur={async (e) => {
                    const v = e.target.value.trim();
                    if (!v || v === t.label) return;
                    try {
                      await api.patch(`/builder/types/${t.key}`, { label: v });
                      setTypes((ts) => ts.map((x) => (x.key === t.key ? { ...x, label: v } : x)));
                    } catch (err) { setError(String((err as Error).message)); }
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-5">
        {/* ── Structure canvas ── */}
        <section className="flex-1 min-w-0">
          <nav className="flex items-center gap-1 flex-wrap text-sm mb-2">
            <button onClick={() => { setStack([]); }} className={stack.length ? 'text-[#0070AD] hover:underline' : 'font-medium text-[#171717]'}>Model</button>
            {stack.map((n, i) => (
              <span key={n.id} className="flex items-center gap-1">
                <span className="text-[#d4d4d4]">/</span>
                <button onClick={() => setStack((s) => s.slice(0, i + 1))} className={i === stack.length - 1 ? 'font-medium text-[#171717]' : 'text-[#0070AD] hover:underline'}>{n.name}</button>
              </span>
            ))}
          </nav>
          <div className="card-elevated divide-y divide-[#f5f5f5]">
            {children.length === 0 && <div className="px-4 py-6 text-sm text-[#a3a3a3] italic">No nodes yet at this level.</div>}
            {children.map((n) => {
              const kidCount = nodes.filter((x) => x.parentId === n.id).length;
              return (
                <div key={n.id} className={'flex items-center gap-2 px-4 py-2 hover:bg-[#fafafa] ' + (selected?.id === n.id ? 'bg-[#eef6fb]' : '')}>
                  <button
                    onClick={() => { setSelected(n); }}
                    onDoubleClick={() => kidCount >= 0 && setStack((s) => [...s, n])}
                    className="flex-1 min-w-0 text-left"
                    title="Click to inspect · double-click to drill in"
                  >
                    <span className="text-sm text-[#171717]">{n.name}</span>
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[#a3a3a3]">{label(n.typeKey)}</span>
                  </button>
                  <span className="text-[11px] text-[#a3a3a3] tnum flex-shrink-0">
                    {kidCount > 0 && `${kidCount} children · `}{n.inboundLinks > 0 && `${n.inboundLinks} links`}
                  </span>
                  {kidCount > 0 && (
                    <button onClick={() => setStack((s) => [...s, n])} className="text-xs text-[#0070AD] hover:underline flex-shrink-0">Open →</button>
                  )}
                  <button onClick={() => removeNode(n)} className="text-xs text-[#be123c] hover:underline flex-shrink-0">Delete</button>
                </div>
              );
            })}
            {childTypes.length > 0 && (
              <div className="px-4 py-2 flex items-center gap-2 flex-wrap">
                {childTypes.map((t) => (
                  <button key={t.key} onClick={() => addNode(t.key)} className="text-xs px-2.5 py-1 rounded-md border border-dashed border-[#cbd5e1] text-[#525252] hover:bg-[#fafafa]">
                    + {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Inspector ── */}
        <aside className="lg:w-96 flex-shrink-0">
          {!selected ? (
            <div className="card-elevated p-6 text-sm text-[#a3a3a3]">Select a node to edit it and manage its connections.</div>
          ) : (
            <div className="card-elevated p-4 space-y-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#a3a3a3] mb-1">{label(selected.typeKey)} · {selected.provenance}</div>
                <label className="label">Name</label>
                <input
                  className="input"
                  key={selected.id + ':name'}
                  defaultValue={selected.name}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== selected.name) void patchNode(selected, { name: v }); }}
                />
                <label className="label mt-2">Description</label>
                <textarea
                  className="input min-h-[64px]"
                  key={selected.id + ':desc'}
                  defaultValue={selected.description ?? ''}
                  onBlur={(e) => { const v = e.target.value; if (v !== (selected.description ?? '')) void patchNode(selected, { description: v || null }); }}
                />
                <label className="label mt-2">Parent</label>
                <select
                  className="input"
                  key={selected.id + ':parent'}
                  value={selected.parentId ?? ''}
                  onChange={(e) => void patchNode(selected, { parentId: e.target.value || null })}
                >
                  <option value="">(none)</option>
                  {nodes
                    .filter((p) => typeByKey.get(selected.typeKey)?.parentKeys.includes(p.typeKey) && p.id !== selected.id)
                    .map((p) => <option key={p.id} value={p.id}>{p.name} ({label(p.typeKey)})</option>)}
                </select>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[#a3a3a3] mb-1.5">Connections</h4>
                {!links ? <div className="text-xs text-[#a3a3a3]">Loading…</div> : (
                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    {links.out.map((l) => (
                      <ConnRow key={l.id} text={`${l.relationType.toLowerCase().replaceAll('_', ' ')} → ${l.peer.name}`} hint={label(l.peer.typeKey)} onDelete={async () => { await api.delete(`/builder/links/${l.id}?companyId=${companyId}`); setLinks((s) => s && { ...s, out: s.out.filter((x) => x.id !== l.id) }); }} />
                    ))}
                    {links.in.map((l) => (
                      <ConnRow key={l.id} text={`${l.peer.name} ${l.relationType.toLowerCase().replaceAll('_', ' ')} →`} hint={label(l.peer.typeKey)} onDelete={async () => { await api.delete(`/builder/links/${l.id}?companyId=${companyId}`); setLinks((s) => s && { ...s, in: s.in.filter((x) => x.id !== l.id) }); }} />
                    ))}
                    {links.in.length + links.out.length === 0 && <div className="text-xs text-[#a3a3a3] italic">No connections yet.</div>}
                  </div>
                )}
                <DrawConnection
                  companyId={companyId}
                  fromId={selected.id}
                  nodes={nodes}
                  relationTypes={relationTypes}
                  typeLabel={label}
                  onCreated={() => selected && api.get(`/builder/nodes/${selected.id}/links?companyId=${companyId}`).then(setLinks)}
                  onError={setError}
                />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ConnRow({ text, hint, onDelete }: { text: string; hint: string; onDelete: () => Promise<void> }) {
  return (
    <div className="flex items-center gap-2 text-xs bg-[#fafafa] border border-[#eeeeee] rounded px-2 py-1">
      <span className="flex-1 min-w-0 truncate text-[#525252]" title={text}>{text}</span>
      <span className="text-[10px] text-[#a3a3a3] flex-shrink-0">{hint}</span>
      <button onClick={() => void onDelete()} className="text-[#be123c] hover:underline flex-shrink-0">×</button>
    </div>
  );
}

// "Draw a connection": pick a relation type + search the target node by name.
function DrawConnection({ companyId, fromId, nodes, relationTypes, typeLabel, onCreated, onError }: {
  companyId: string; fromId: string; nodes: TreeNode[]; relationTypes: string[];
  typeLabel: (k: string) => string; onCreated: () => void; onError: (e: string) => void;
}) {
  const [rel, setRel] = useState(relationTypes[0] ?? 'DEPENDS_ON');
  const [q, setQ] = useState('');
  const matches = q.trim().length < 2 ? [] : nodes.filter((n) => n.id !== fromId && n.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div className="mt-2 border-t border-[#f5f5f5] pt-2">
      <div className="flex items-center gap-2">
        <select className="input py-1 text-xs flex-shrink-0 w-40" value={rel} onChange={(e) => setRel(e.target.value)}>
          {relationTypes.map((r) => <option key={r} value={r}>{r.toLowerCase().replaceAll('_', ' ')}</option>)}
        </select>
        <input className="input py-1 text-xs" placeholder="Search a node to connect…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {matches.length > 0 && (
        <div className="mt-1 border border-[#eeeeee] rounded divide-y divide-[#f5f5f5] max-h-40 overflow-y-auto">
          {matches.map((m) => (
            <button
              key={m.id}
              onClick={async () => {
                try {
                  await api.post(`/builder/links?companyId=${companyId}`, { fromId, toId: m.id, relationType: rel });
                  setQ(''); onCreated(); onError('');
                } catch (e) { onError(String((e as Error).message)); }
              }}
              className="w-full text-left px-2 py-1 text-xs hover:bg-[#fafafa]"
            >
              {m.name} <span className="text-[10px] text-[#a3a3a3]">{typeLabel(m.typeKey)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
