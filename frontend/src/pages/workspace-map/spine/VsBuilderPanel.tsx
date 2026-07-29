import { useState } from 'react';
import {
  hasDragPayload,
  insertItem,
  LEVEL_SHORT,
  moveItem,
  newUid,
  readDragPayload,
  type BuilderItem,
} from './processBuilder';

// The new-process builder — the compare view's right-hand panel. Drag any
// card in (from the stream columns or via a card's ＋), drag to reorder,
// rename inline, delete. This IS the process editor: the consolidated /
// new value stream is exactly what sits here, and the flow strip below the
// board re-renders from the same list in real time.

const IDX_MIME = 'application/x-builder-index';

export function payloadToItem(p: {
  name: string;
  level: BuilderItem['level'];
  source: string;
  nodeIds: string[];
  agentScore?: number | null;
}): BuilderItem {
  return {
    uid: newUid(p.nodeIds[0] ?? p.name),
    name: p.name,
    level: p.level,
    source: p.source,
    nodeIds: p.nodeIds,
    agent: p.agentScore != null && p.agentScore <= 2 ? true : undefined,
  };
}

export default function VsBuilderPanel({
  title,
  hint,
  items,
  onChange,
  onPromote,
  promoteLabel,
}: {
  title: string;
  hint: string;
  items: BuilderItem[];
  onChange: (items: BuilderItem[]) => void;
  onPromote: () => void;
  promoteLabel: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const dropAt = (e: React.DragEvent, index: number | null) => {
    e.preventDefault();
    e.stopPropagation();
    setOverIdx(null);
    const fromIdx = e.dataTransfer.getData(IDX_MIME);
    if (fromIdx !== '') {
      const from = Number(fromIdx);
      if (!Number.isNaN(from)) onChange(moveItem(items, from, index ?? items.length));
      return;
    }
    const p = readDragPayload(e);
    if (p) onChange(insertItem(items, payloadToItem(p), index));
  };

  const commitRename = (uid: string) => {
    const name = draft.trim();
    setEditing(null);
    if (!name) return;
    onChange(items.map((it) => (it.uid === uid ? { ...it, name } : it)));
  };

  return (
    <div
      onDragOver={(e) => {
        if (hasDragPayload(e) || e.dataTransfer.types.includes(IDX_MIME)) e.preventDefault();
      }}
      onDrop={(e) => dropAt(e, null)}
      style={{
        width: 300,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#f6faf7',
        border: '2px dashed #a7f3d0',
        borderRadius: 12,
        padding: 10,
        boxSizing: 'border-box',
        minHeight: 220,
        alignSelf: 'stretch',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#14532d' }}>{title}</span>
        <div style={{ flex: 1 }} />
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            style={{
              font: 'inherit',
              fontSize: 9.5,
              color: '#64748b',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            clear
          </button>
        )}
      </div>
      <div style={{ fontSize: 9.5, color: '#4d7c60', marginBottom: 8 }}>{hint}</div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {items.map((it, i) => (
          <div
            key={it.uid}
            draggable
            onDragStart={(e) => e.dataTransfer.setData(IDX_MIME, String(i))}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIdx(i);
            }}
            onDragLeave={() => setOverIdx((cur) => (cur === i ? null : cur))}
            onDrop={(e) => dropAt(e, i)}
            style={{
              background: '#fff',
              border: '1px solid #bbe7cf',
              borderTop: overIdx === i ? '2px solid #047857' : '1px solid #bbe7cf',
              borderRadius: 7,
              padding: '5px 8px',
              cursor: 'grab',
            }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span
                style={{
                  flexShrink: 0,
                  width: 15,
                  height: 15,
                  borderRadius: 999,
                  background: '#047857',
                  color: '#fff',
                  fontSize: 8.5,
                  fontWeight: 800,
                  lineHeight: '15px',
                  textAlign: 'center',
                }}
              >
                {i + 1}
              </span>
              {editing === it.uid ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(it.uid)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(it.uid);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    font: 'inherit',
                    fontSize: 10.5,
                    border: '1px solid #a7f3d0',
                    borderRadius: 4,
                    padding: '1px 4px',
                  }}
                />
              ) : (
                <button
                  type="button"
                  title="Click to rename"
                  onClick={() => {
                    setEditing(it.uid);
                    setDraft(it.name);
                  }}
                  style={{
                    font: 'inherit',
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'text',
                    fontSize: 10.5,
                    lineHeight: 1.35,
                    color: '#14532d',
                  }}
                >
                  {it.name}
                </button>
              )}
              <button
                type="button"
                aria-label={`Remove ${it.name}`}
                onClick={() => onChange(items.filter((x) => x.uid !== it.uid))}
                style={{
                  font: 'inherit',
                  flexShrink: 0,
                  fontSize: 11,
                  color: '#94a3b8',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0 2px',
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                marginTop: 3,
                paddingLeft: 21,
              }}
            >
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: '#4338ca',
                  background: '#eef2ff',
                  borderRadius: 4,
                  padding: '0 4px',
                }}
                title={`Process level ${it.level}`}
              >
                {LEVEL_SHORT[it.level]}
              </span>
              {it.agent && (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: '#047857',
                    background: '#ecfdf5',
                    borderRadius: 4,
                    padding: '0 4px',
                  }}
                >
                  AGENT
                </span>
              )}
              <span style={{ fontSize: 8.5, color: '#94a3b8' }}>from {it.source}</span>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10.5,
              color: '#4d7c60',
              textAlign: 'center',
              padding: 10,
            }}
          >
            Drag cards here — or use a card&apos;s ＋ — to compose the new process. Reorder by drag,
            click a name to rename, × to delete.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onPromote}
        disabled={items.length === 0}
        style={{
          font: 'inherit',
          marginTop: 8,
          fontSize: 11,
          fontWeight: 600,
          color: '#fff',
          background: items.length ? '#047857' : '#a7c5b4',
          border: 'none',
          borderRadius: 6,
          padding: '6px 12px',
          cursor: items.length ? 'pointer' : 'default',
        }}
      >
        {promoteLabel}
      </button>
    </div>
  );
}
