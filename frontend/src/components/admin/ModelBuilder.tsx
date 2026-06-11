import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';

// Interactive operating-model builder (rework P7). One surface to build the
// structure (typed node tree), draw connections (typed links), and rename the
// taxonomy — speaking the domain, never raw tables. Backend: /builder/*.

type NodeType = { key: string; label: string; pluralLabel: string; level: number; parentKeys: string[]; sortOrder: number };
type TreeNode = { id: string; typeKey: string; parentId: string | null; name: string; description: string | null; sortOrder: number; provenance: string; hidden: boolean; inboundLinks: number };
type LinkRow = { id: string; relationType: string; attributes: any; peer: { id: string; name: string; typeKey: string } };

// Optional scope narrows the builder to one branch of the model so each Data
// Admin tab only shows ITS nodes (gap fix: roles/external parties no longer
// appear under Value Streams). 'map' = the operating-model map hierarchy,
// starting at the company root and drilling Enterprise → Segment → Division →
// Value Stream → Sub-Process → Step (org-only nodes — departments/roles — and
// external parties are edited on their own tabs). 'external' = the
// external-party catalog, 'all' (default) = the whole model.
const SCOPES: Record<string, { types: string[]; rootType: string } | undefined> = {
  map: { types: ['enterprise', 'segment', 'division', 'value_stream', 'sub_process', 'step', 'io_item'], rootType: 'enterprise' },
  external: { types: ['external_party'], rootType: 'external_party' },
  // Org spine — re-parenting carries the whole subtree (children reference the
  // moved node), and the Level mover re-levels within the org taxonomy. The
  // Organization screens render from these same nodes (/explorer/org-table).
  org: { types: ['enterprise', 'segment', 'division', 'department', 'role'], rootType: 'enterprise' },
};

export default function ModelBuilder({ companyId, scope = 'all' }: { companyId: string | null; scope?: 'all' | 'map' | 'external' | 'org' }) {
  const dialogs = useDialogs();
  const [types, setTypes] = useState<NodeType[]>([]);
  const [relationTypes, setRelationTypes] = useState<string[]>([]);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [stack, setStack] = useState<TreeNode[]>([]); // breadcrumb drill
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [links, setLinks] = useState<{ in: LinkRow[]; out: LinkRow[] } | null>(null);
  const [error, setError] = useState('');
  const [showTaxonomy, setShowTaxonomy] = useState(false);
  const [moving, setMoving] = useState<TreeNode | null>(null); // node being moved via the Move dialog
  const [addingType, setAddingType] = useState<string | null>(null); // inline "new node" input

  const typeByKey = useMemo(() => new Map(types.map((t) => [t.key, t])), [types]);
  const label = (key: string) => typeByKey.get(key)?.label ?? key;

  // parentId → children, for fast subtree counts (the whole-model list can be large).
  const childrenOf = useMemo(() => {
    const m = new Map<string, TreeNode[]>();
    for (const n of nodes) {
      if (!n.parentId) continue;
      const list = m.get(n.parentId);
      if (list) list.push(n); else m.set(n.parentId, [n]);
    }
    return m;
  }, [nodes]);
  const countDescendants = (id: string): number =>
    (childrenOf.get(id) ?? []).reduce((acc, c) => acc + 1 + countDescendants(c.id), 0);

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
    .filter((t) => (current ? t.parentKeys.includes(current.typeKey) : scopeDef ? t.key === scopeDef.rootType && t.parentKeys.length === 0 : t.parentKeys.length === 0))
    // The company root is singular — no "+ Enterprise" once it exists.
    .filter((t) => !(t.key === 'enterprise' && scoped.some((n) => n.typeKey === 'enterprise')));

  const patchNode = async (n: TreeNode, data: Record<string, unknown>) => {
    try {
      const updated = await api.patch(`/builder/nodes/${n.id}?companyId=${companyId}`, data);
      // The PATCH response carries raw attributes; the tree rows carry the
      // derived `hidden` flag — keep it in sync.
      const merged = { ...updated, hidden: updated.attributes ? updated.attributes.hidden === true : n.hidden };
      setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, ...merged } : x)));
      if (selected?.id === n.id) setSelected((s) => (s ? { ...s, ...merged } : s));
      setError('');
    } catch (e) { setError(String((e as Error).message)); }
  };
  // Inline create — the "+ <type>" buttons open a name input row in the list
  // (no browser prompt). Enter or "Add" creates under the current drill node.
  const createNode = async (typeKey: string, name: string) => {
    try {
      const created = await api.post(`/builder/nodes?companyId=${companyId}`, { typeKey, parentId: current?.id ?? null, name });
      setNodes((ns) => [...ns, { ...created, inboundLinks: 0 }]);
      setAddingType(null);
      setError('');
    } catch (e) { setError(String((e as Error).message)); }
  };
  const removeNode = async (n: TreeNode) => {
    const kids = countDescendants(n.id);
    const ok = await dialogs.confirm({
      title: `Delete ${label(n.typeKey)} "${n.name}"?`,
      danger: true,
      typedConfirm: kids ? n.name : undefined,
      message: kids
        ? `This deletes "${n.name}" and everything under it — ${kids} descendant node${kids === 1 ? '' : 's'}. This cannot be undone.`
        : 'This cannot be undone.',
    });
    if (!ok) return;
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
              // Count only in-scope children — what drilling in will actually show.
              const kidCount = scoped.filter((x) => x.parentId === n.id).length;
              return (
                <div key={n.id} className={'flex items-center gap-2 px-4 py-2 hover:bg-[#fafafa] ' + (selected?.id === n.id ? 'bg-[#eef6fb]' : '')}>
                  <button
                    onClick={() => { setSelected(n); }}
                    onDoubleClick={() => kidCount >= 0 && setStack((s) => [...s, n])}
                    className="flex-1 min-w-0 text-left"
                    title="Click to inspect · double-click to drill in"
                  >
                    <span className={'text-sm ' + (n.hidden ? 'text-[#a3a3a3] line-through decoration-[#d4d4d4]' : 'text-[#171717]')}>{n.name}</span>
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[#a3a3a3]">{label(n.typeKey)}</span>
                    {n.hidden && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[#b45309] bg-[#fef3c7] rounded px-1.5 py-0.5">hidden</span>}
                  </button>
                  <span className="text-[11px] text-[#a3a3a3] tnum flex-shrink-0">
                    {kidCount > 0 && `${kidCount} children · `}{n.inboundLinks > 0 && `${n.inboundLinks} links`}
                  </span>
                  {kidCount > 0 && (
                    <button onClick={() => setStack((s) => [...s, n])} className="text-xs text-[#0070AD] hover:underline flex-shrink-0">Open →</button>
                  )}
                  <button onClick={() => setMoving(n)} className="text-xs text-[#525252] hover:text-[#171717] hover:underline flex-shrink-0">Move…</button>
                  {(n.typeKey === 'value_stream' || n.typeKey === 'role') && (
                    <button
                      onClick={() => void patchNode(n, { hidden: !n.hidden })}
                      className="text-xs text-[#525252] hover:text-[#171717] hover:underline flex-shrink-0"
                      title={n.hidden ? 'Render this node in the app again' : 'Keep in the database but stop rendering it in the app'}
                    >
                      {n.hidden ? 'Show' : 'Hide'}
                    </button>
                  )}
                  <button onClick={() => void removeNode(n)} className="text-xs text-[#be123c] hover:underline flex-shrink-0">Delete</button>
                </div>
              );
            })}
            {addingType && (
              <InlineAddRow
                typeLabel={label(addingType)}
                onCancel={() => setAddingType(null)}
                onCreate={(name) => void createNode(addingType, name)}
              />
            )}
            {childTypes.length > 0 && (
              <div className="px-4 py-2 flex items-center gap-2 flex-wrap">
                {childTypes.map((t) => (
                  <button key={t.key} onClick={() => setAddingType(t.key)} className="text-xs px-2.5 py-1 rounded-md border border-dashed border-[#cbd5e1] text-[#525252] hover:bg-[#fafafa]">
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
                <LevelMover
                  key={selected.id + ':level'}
                  node={selected}
                  nodes={nodes}
                  types={types.filter((t) => (scopeDef ? scopeDef.types.includes(t.key) : true))}
                  typeLabel={label}
                  onApply={(typeKey, parentId) => void patchNode(selected, { typeKey, parentId })}
                />
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

      {moving && (
        <MoveNodeDialog
          node={moving}
          nodes={scoped}
          typeByKey={typeByKey}
          typeLabel={label}
          descendants={countDescendants(moving.id)}
          onClose={() => setMoving(null)}
          onMove={(parentId) => { const n = moving; setMoving(null); void patchNode(n, { parentId }); }}
        />
      )}
    </div>
  );
}

// Inline "name the new node" row — replaces the old browser prompt(). Enter or
// Add creates; Escape or Cancel dismisses.
function InlineAddRow({ typeLabel, onCreate, onCancel }: {
  typeLabel: string; onCreate: (name: string) => void; onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const submit = () => { const v = name.trim(); if (v) onCreate(v); };
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#fafafa]">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#a3a3a3] flex-shrink-0">New {typeLabel}</span>
      <input
        ref={inputRef}
        className="input py-1 text-sm flex-1"
        placeholder={`${typeLabel} name…`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
      />
      <button onClick={submit} disabled={!name.trim()} className="text-xs px-2.5 py-1 rounded-md bg-[#171717] text-white disabled:opacity-40 flex-shrink-0">Add</button>
      <button onClick={onCancel} className="text-xs px-2.5 py-1 rounded-md border border-[#e5e5e5] text-[#525252] hover:bg-white flex-shrink-0">Cancel</button>
    </div>
  );
}

// "Move…" dialog: search the valid destinations for this node (parents allowed
// by the taxonomy, never itself or anything inside its own subtree) and click
// one — the node moves there together with its whole subtree.
function MoveNodeDialog({ node, nodes, typeByKey, typeLabel, descendants, onClose, onMove }: {
  node: TreeNode;
  nodes: TreeNode[];
  typeByKey: Map<string, NodeType>;
  typeLabel: (k: string) => string;
  descendants: number;
  onClose: () => void;
  onMove: (parentId: string) => void;
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  // Everything inside the moving node's subtree is an invalid destination (cycle).
  const inSubtree = useMemo(() => {
    const ids = new Set<string>([node.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of nodes) {
        if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) { ids.add(n.id); grew = true; }
      }
    }
    return ids;
  }, [node.id, nodes]);

  const parentKeys = typeByKey.get(node.typeKey)?.parentKeys ?? [];
  const path = (n: TreeNode): string => {
    const parts: string[] = [];
    let p = n.parentId ? byId.get(n.parentId) : undefined;
    while (p && parts.length < 3) { parts.unshift(p.name); p = p.parentId ? byId.get(p.parentId) : undefined; }
    return parts.join(' / ');
  };

  const candidates = nodes
    .filter((n) => parentKeys.includes(n.typeKey) && !inSubtree.has(n.id))
    .filter((n) => !q.trim() || n.name.toLowerCase().includes(q.trim().toLowerCase()) || path(n).toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 50);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Move ${node.name}`}
    >
      <div className="card-elevated bg-white max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-[#171717] mb-1">Move “{node.name}”</h3>
        <p className="text-sm text-[#525252] mb-3">
          Click where it should live. It moves together with everything under it
          {descendants > 0 && <> ({descendants} item{descendants === 1 ? '' : 's'})</>}.
        </p>
        <input
          ref={inputRef}
          className="input mb-2"
          placeholder="Search destinations…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="border border-[#eeeeee] rounded divide-y divide-[#f5f5f5] max-h-72 overflow-y-auto">
          {candidates.length === 0 && (
            <div className="px-3 py-4 text-sm text-[#a3a3a3] italic">No valid destinations{q ? ' match the search' : ''}.</div>
          )}
          {candidates.map((c) => {
            const isCurrent = c.id === node.parentId;
            return (
              <button
                key={c.id}
                disabled={isCurrent}
                onClick={() => onMove(c.id)}
                className={'w-full text-left px-3 py-2 text-sm flex items-center gap-2 ' + (isCurrent ? 'bg-[#fafafa] cursor-default' : 'hover:bg-[#eef6fb]')}
              >
                <span className="flex-1 min-w-0">
                  <span className="text-[#171717]">{c.name}</span>
                  {path(c) && <span className="ml-2 text-[11px] text-[#a3a3a3]">{path(c)}</span>}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#a3a3a3] flex-shrink-0">{typeLabel(c.typeKey)}</span>
                {isCurrent && <span className="text-[10px] text-[#a3a3a3] flex-shrink-0">current</span>}
              </button>
            );
          })}
        </div>
        <div className="flex justify-end mt-4">
          <button className="text-sm px-3 py-1.5 rounded-md border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa]" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// "Move level": change a node's type (e.g. demote a division to a department)
// together with a parent valid for the new level. Persists through
// PATCH /builder/nodes — the DB hierarchy is restructured, not just the view
// (defect backlog 02, D12.5).
function LevelMover({ node, nodes, types, typeLabel, onApply }: {
  node: TreeNode; nodes: TreeNode[]; types: NodeType[];
  typeLabel: (k: string) => string; onApply: (typeKey: string, parentId: string | null) => void;
}) {
  const [newType, setNewType] = useState('');
  const [newParent, setNewParent] = useState('');
  const target = types.find((t) => t.key === newType);
  const parentOptions = target
    ? nodes.filter((p) => target.parentKeys.includes(p.typeKey) && p.id !== node.id)
    : [];
  const needsParent = Boolean(target && target.parentKeys.length > 0);
  const ready = Boolean(target) && (!needsParent || Boolean(newParent));
  return (
    <div className="mt-2 border-t border-[#f5f5f5] pt-2">
      <label className="label">Move to level</label>
      <div className="flex items-center gap-2">
        <select
          className="input py-1 text-xs"
          value={newType}
          onChange={(e) => { setNewType(e.target.value); setNewParent(''); }}
        >
          <option value="">Keep: {typeLabel(node.typeKey)}</option>
          {types.filter((t) => t.key !== node.typeKey).map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        {needsParent && (
          <select className="input py-1 text-xs" value={newParent} onChange={(e) => setNewParent(e.target.value)}>
            <option value="">Pick new parent…</option>
            {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.name} ({typeLabel(p.typeKey)})</option>)}
          </select>
        )}
        <button
          disabled={!ready}
          onClick={() => { if (target) onApply(target.key, needsParent ? newParent : null); }}
          className="flex-shrink-0 text-xs px-2.5 py-1 rounded-md border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Move
        </button>
      </div>
      <p className="text-[10px] text-[#a3a3a3] mt-1">
        Restructures the database hierarchy — children must be valid under the new level.
      </p>
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
