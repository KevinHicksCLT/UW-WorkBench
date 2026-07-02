/**
 * Building blocks of the interactive operating-model builder — shared types,
 * the inline add-node row, the Move… dialog, the level mover, and the
 * connection widgets. Extracted verbatim from ModelBuilder.tsx.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import { Card, EmptyState, Input, Label, Select } from '../../ui';

export type NodeType = { key: string; label: string; pluralLabel: string; level: number; parentKeys: string[]; sortOrder: number };
export type TreeNode = { id: string; typeKey: string; parentId: string | null; name: string; description: string | null; sortOrder: number; provenance: string; hidden: boolean; inboundLinks: number };
export type LinkRow = { id: string; relationType: string; attributes: unknown; peer: { id: string; name: string; typeKey: string } };

// Inline "name the new node" row — replaces the old browser prompt(). Enter or
// Add creates; Escape or Cancel dismisses.
export function InlineAddRow({ typeLabel, onCreate, onCancel }: {
  typeLabel: string; onCreate: (name: string) => void; onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const submit = () => { const v = name.trim(); if (v) onCreate(v); };
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#fafafa]">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#a3a3a3] flex-shrink-0">New {typeLabel}</span>
      <Input
        ref={inputRef}
        className="py-1 text-sm flex-1"
        placeholder={`${typeLabel} name…`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { submit(); } if (e.key === 'Escape') { onCancel(); } }}
      />
      <button onClick={submit} disabled={!name.trim()} className="text-xs px-2.5 py-1 rounded-md bg-[#171717] text-white disabled:opacity-40 flex-shrink-0">Add</button>
      <button onClick={onCancel} className="text-xs px-2.5 py-1 rounded-md border border-[#e5e5e5] text-[#525252] hover:bg-white flex-shrink-0">Cancel</button>
    </div>
  );
}

// "Move…" dialog: search the valid destinations for this node (parents allowed
// by the taxonomy, never itself or anything inside its own subtree) and click
// one — the node moves there together with its whole subtree.
export function MoveNodeDialog({ node, nodes, typeByKey, typeLabel, descendants, onClose, onMove }: {
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
      <Card variant="elevated" className="bg-white max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-[#171717] mb-1">Move “{node.name}”</h3>
        <p className="text-sm text-[#525252] mb-3">
          Click where it should live. It moves together with everything under it
          {descendants > 0 && <> ({descendants} item{descendants === 1 ? '' : 's'})</>}.
        </p>
        <Input
          ref={inputRef}
          className="mb-2"
          placeholder="Search destinations…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="border border-[#eeeeee] rounded divide-y divide-[#f5f5f5] max-h-72 overflow-y-auto">
          {candidates.length === 0 && (
            <EmptyState baseClassName="px-3 py-4 text-sm text-[#a3a3a3] italic" message={<>No valid destinations{q ? ' match the search' : ''}.</>} />
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
      </Card>
    </div>
  );
}

// "Move level": change a node's type (e.g. demote a division to a department)
// together with a parent valid for the new level. Persists through
// PATCH /builder/nodes — the DB hierarchy is restructured, not just the view
// (defect backlog 02, D12.5).
export function LevelMover({ node, nodes, types, typeLabel, onApply }: {
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
      <Label>Move to level</Label>
      <div className="flex items-center gap-2">
        <Select
          className="py-1 text-xs"
          value={newType}
          onChange={(e) => { setNewType(e.target.value); setNewParent(''); }}
        >
          <option value="">Keep: {typeLabel(node.typeKey)}</option>
          {types.filter((t) => t.key !== node.typeKey).map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </Select>
        {needsParent && (
          <Select className="py-1 text-xs" value={newParent} onChange={(e) => setNewParent(e.target.value)}>
            <option value="">Pick new parent…</option>
            {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.name} ({typeLabel(p.typeKey)})</option>)}
          </Select>
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

export function ConnRow({ text, hint, onDelete }: { text: string; hint: string; onDelete: () => Promise<void> }) {
  return (
    <div className="flex items-center gap-2 text-xs bg-[#fafafa] border border-[#eeeeee] rounded px-2 py-1">
      <span className="flex-1 min-w-0 truncate text-[#525252]" title={text}>{text}</span>
      <span className="text-[10px] text-[#a3a3a3] flex-shrink-0">{hint}</span>
      <button onClick={() => void onDelete()} className="text-[#be123c] hover:underline flex-shrink-0">×</button>
    </div>
  );
}

// "Draw a connection": pick a relation type + search the target node by name.
export function DrawConnection({ companyId, fromId, nodes, relationTypes, typeLabel, onCreated, onError }: {
  companyId: string; fromId: string; nodes: TreeNode[]; relationTypes: string[];
  typeLabel: (k: string) => string; onCreated: () => void; onError: (e: string) => void;
}) {
  const [rel, setRel] = useState(relationTypes[0] ?? 'DEPENDS_ON');
  const [q, setQ] = useState('');
  const matches = q.trim().length < 2 ? [] : nodes.filter((n) => n.id !== fromId && n.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div className="mt-2 border-t border-[#f5f5f5] pt-2">
      <div className="flex items-center gap-2">
        <Select className="py-1 text-xs flex-shrink-0 w-40" value={rel} onChange={(e) => setRel(e.target.value)}>
          {relationTypes.map((r) => <option key={r} value={r}>{r.toLowerCase().replaceAll('_', ' ')}</option>)}
        </Select>
        <Input className="py-1 text-xs" placeholder="Search a node to connect…" value={q} onChange={(e) => setQ(e.target.value)} />
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
