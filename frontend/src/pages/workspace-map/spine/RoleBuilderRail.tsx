import { useState } from 'react';
import {
  hasDragPayload,
  newUid,
  readDragPayload,
  type BuilderItem,
  type DragPayload,
} from './processBuilder';

// The Roles lens' NEW STATE rail + final sequence strip. The rail is two
// drop boxes — the New role (kept manual work) on top, the Agent box
// (work an agent runs autonomously) below — plus a Delete target. Both boxes
// feed ONE ordered list; the strip at the bottom of the page is that list in
// execution order, agent steps clearly called out, fully editable: drag to
// reorder, click a name to rename, flip a step between MANUAL and AGENT,
// × to remove.

const UID_MIME = 'application/x-role-builder-uid';

export function payloadToRoleItem(p: DragPayload, agent: boolean): BuilderItem {
  return {
    uid: newUid(p.nodeIds[0] ?? p.name),
    name: p.name,
    level: p.level,
    source: p.source,
    nodeIds: p.nodeIds,
    agent: agent || undefined,
  };
}

function DropBox({
  title,
  hint,
  accent,
  items,
  onDropPayload,
  onDropUid,
  emptyText,
  children,
}: {
  title: string;
  hint: string;
  accent: { border: string; bg: string; fg: string };
  items: BuilderItem[];
  onDropPayload: (p: DragPayload) => void;
  onDropUid: (uid: string) => void;
  emptyText: string;
  children: (item: BuilderItem) => React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (hasDragPayload(e) || e.dataTransfer.types.includes(UID_MIME)) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const uid = e.dataTransfer.getData(UID_MIME);
        if (uid) return onDropUid(uid);
        const p = readDragPayload(e);
        if (p) onDropPayload(p);
      }}
      style={{
        border: `2px dashed ${accent.border}`,
        borderRadius: 10,
        background: over ? '#fff' : accent.bg,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minHeight: 90,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: accent.fg }}>{title}</span>
        <span style={{ fontSize: 8.5, color: '#94a3b8' }}>{items.length}</span>
      </div>
      <div style={{ fontSize: 8.5, color: '#64748b' }}>{hint}</div>
      {items.map((it) => children(it))}
      {items.length === 0 && (
        <div style={{ fontSize: 9.5, color: '#94a3b8', padding: '6px 2px' }}>{emptyText}</div>
      )}
    </div>
  );
}

function RailChip({ item, onRemove }: { item: BuilderItem; onRemove: () => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData(UID_MIME, item.uid)}
      style={{
        display: 'flex',
        gap: 5,
        alignItems: 'flex-start',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        padding: '3px 6px',
        cursor: 'grab',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 9.5, lineHeight: 1.3, color: '#171717' }}>
        {item.name}
      </span>
      <span style={{ flexShrink: 0, fontSize: 8, color: '#94a3b8' }}>{item.source}</span>
      <button
        type="button"
        aria-label={`Remove ${item.name}`}
        onClick={onRemove}
        style={{
          font: 'inherit',
          flexShrink: 0,
          fontSize: 10,
          color: '#94a3b8',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

export function RoleRail({
  items,
  onChange,
  onDeleteTask,
  deleted,
  onRestore,
  onCommit,
}: {
  items: BuilderItem[];
  onChange: (items: BuilderItem[]) => void;
  /** A task card dropped on Delete — parent gates it, then records it. */
  onDeleteTask: (p: DragPayload) => void;
  deleted: { name: string; source: string }[];
  onRestore: (index: number) => void;
  onCommit: () => void;
}) {
  const [overDelete, setOverDelete] = useState(false);
  const setAgent = (uid: string, agent: boolean) =>
    onChange(items.map((it) => (it.uid === uid ? { ...it, agent: agent || undefined } : it)));
  const addFrom = (p: DragPayload, agent: boolean) => {
    // The same task dropped twice retargets instead of duplicating.
    const existing = items.find((it) => it.nodeIds[0] === p.nodeIds[0]);
    if (existing) return setAgent(existing.uid, agent);
    onChange([...items, payloadToRoleItem(p, agent)]);
  };

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignSelf: 'stretch',
      }}
    >
      <DropBox
        title="New role"
        hint="Kept manual work — what the consolidated / new role does itself."
        accent={{ border: '#a7f3d0', bg: '#f6faf7', fg: '#14532d' }}
        items={items.filter((it) => !it.agent)}
        onDropPayload={(p) => addFrom(p, false)}
        onDropUid={(uid) => setAgent(uid, false)}
        emptyText="Drag tasks here to keep them in the new role."
      >
        {(it) => (
          <RailChip
            key={it.uid}
            item={it}
            onRemove={() => onChange(items.filter((x) => x.uid !== it.uid))}
          />
        )}
      </DropBox>

      <DropBox
        title="Agent box"
        hint="An agent runs these autonomously — no human in the loop."
        accent={{ border: '#c7d2fe', bg: '#f6f7ff', fg: '#3730a3' }}
        items={items.filter((it) => it.agent)}
        onDropPayload={(p) => addFrom(p, true)}
        onDropUid={(uid) => setAgent(uid, true)}
        emptyText="Drag agent-runnable tasks here."
      >
        {(it) => (
          <RailChip
            key={it.uid}
            item={it}
            onRemove={() => onChange(items.filter((x) => x.uid !== it.uid))}
          />
        )}
      </DropBox>

      <div
        onDragOver={(e) => {
          if (hasDragPayload(e) || e.dataTransfer.types.includes(UID_MIME)) {
            e.preventDefault();
            setOverDelete(true);
          }
        }}
        onDragLeave={() => setOverDelete(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOverDelete(false);
          const uid = e.dataTransfer.getData(UID_MIME);
          if (uid) return onChange(items.filter((x) => x.uid !== uid));
          const p = readDragPayload(e);
          if (p) onDeleteTask(p);
        }}
        style={{
          border: `2px dashed ${overDelete ? '#dc2626' : '#fecaca'}`,
          borderRadius: 10,
          background: overDelete ? '#fff' : '#fff7f7',
          padding: 8,
        }}
      >
        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#991b1b' }}>Delete</span>
        <div style={{ fontSize: 8.5, color: '#64748b', marginTop: 2 }}>
          Drop a task to remove it from the operating model — impact is assessed first.
        </div>
        {deleted.map((d, i) => (
          <div
            key={`${d.name}:${i}`}
            style={{
              display: 'flex',
              gap: 5,
              alignItems: 'center',
              marginTop: 4,
              fontSize: 9.5,
              color: '#991b1b',
            }}
          >
            <span style={{ flex: 1, minWidth: 0, textDecoration: 'line-through' }}>{d.name}</span>
            <button
              type="button"
              onClick={() => onRestore(i)}
              style={{
                font: 'inherit',
                fontSize: 8.5,
                color: '#64748b',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              restore
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onCommit}
        disabled={items.length === 0 && deleted.length === 0}
        style={{
          font: 'inherit',
          fontSize: 11,
          fontWeight: 600,
          color: '#fff',
          background: items.length || deleted.length ? '#047857' : '#a7c5b4',
          border: 'none',
          borderRadius: 6,
          padding: '6px 12px',
          cursor: items.length || deleted.length ? 'pointer' : 'default',
        }}
      >
        Commit new role
      </button>
    </div>
  );
}

/** The final sequence — the new role's work in execution order, editable. */
export function RoleFlowStrip({
  items,
  onChange,
}: {
  items: BuilderItem[];
  onChange: (items: BuilderItem[]) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const commitRename = (uid: string) => {
    const name = draft.trim();
    setEditing(null);
    if (!name) return;
    onChange(items.map((it) => (it.uid === uid ? { ...it, name } : it)));
  };
  const moveBefore = (uid: string, beforeUid: string | null) => {
    const from = items.findIndex((x) => x.uid === uid);
    if (from < 0) return;
    const next = items.filter((x) => x.uid !== uid);
    const at = beforeUid ? next.findIndex((x) => x.uid === beforeUid) : next.length;
    next.splice(at < 0 ? next.length : at, 0, items[from]);
    onChange(next);
  };

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(UID_MIME)) e.preventDefault();
      }}
      onDrop={(e) => {
        const uid = e.dataTransfer.getData(UID_MIME);
        if (uid) {
          e.preventDefault();
          moveBefore(uid, null);
        }
      }}
      style={{
        borderTop: '2px solid #a7f3d0',
        background: '#f6faf7',
        padding: '8px 14px 10px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#14532d' }}>
          New role — final sequence
        </span>
        <span style={{ fontSize: 9.5, color: '#4d7c60' }}>
          {items.length === 0
            ? 'assembles here in real time — manual and agent steps in the order they happen'
            : `${items.length} steps · ${items.filter((i) => i.agent).length} agent · ${items.filter((i) => !i.agent).length} manual — drag to reorder, click a name to rename, click the tag to flip agent/manual`}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', width: 'max-content' }}>
          {items.map((s, i) => (
            <div key={s.uid} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && (
                <span style={{ width: 12, height: 1.5, background: '#bbe7cf', flexShrink: 0 }} />
              )}
              <div
                draggable
                onDragStart={(e) => e.dataTransfer.setData(UID_MIME, s.uid)}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(UID_MIME)) e.preventDefault();
                }}
                onDrop={(e) => {
                  const uid = e.dataTransfer.getData(UID_MIME);
                  if (uid && uid !== s.uid) {
                    e.preventDefault();
                    e.stopPropagation();
                    moveBefore(uid, s.uid);
                  }
                }}
                style={{
                  width: 180,
                  boxSizing: 'border-box',
                  background: s.agent ? '#f6f7ff' : '#fff',
                  border: `1px solid ${s.agent ? '#c7d2fe' : '#bbe7cf'}`,
                  borderTop: `3px solid ${s.agent ? '#4338ca' : '#047857'}`,
                  borderRadius: 8,
                  padding: '5px 8px',
                  cursor: 'grab',
                }}
              >
                <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      flexShrink: 0,
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: s.agent ? '#4338ca' : '#047857',
                      color: '#fff',
                      fontSize: 8,
                      fontWeight: 800,
                      lineHeight: '14px',
                      textAlign: 'center',
                    }}
                  >
                    {i + 1}
                  </span>
                  {editing === s.uid ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commitRename(s.uid)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(s.uid);
                        if (e.key === 'Escape') setEditing(null);
                      }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        font: 'inherit',
                        fontSize: 9.5,
                        border: '1px solid #a7f3d0',
                        borderRadius: 4,
                        padding: '0 3px',
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      title="Click to rename"
                      onClick={() => {
                        setEditing(s.uid);
                        setDraft(s.name);
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
                        fontSize: 9.5,
                        lineHeight: 1.3,
                        color: '#14532d',
                      }}
                    >
                      {s.name}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${s.name}`}
                    onClick={() => onChange(items.filter((x) => x.uid !== s.uid))}
                    style={{
                      font: 'inherit',
                      flexShrink: 0,
                      fontSize: 10,
                      color: '#94a3b8',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 3, paddingLeft: 19 }}>
                  <button
                    type="button"
                    title="Flip between agent-run and manual"
                    onClick={() =>
                      onChange(
                        items.map((x) =>
                          x.uid === s.uid ? { ...x, agent: x.agent ? undefined : true } : x,
                        ),
                      )
                    }
                    style={{
                      font: 'inherit',
                      fontSize: 7.5,
                      fontWeight: 700,
                      color: s.agent ? '#4338ca' : '#64748b',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {s.agent ? 'AGENT' : 'MANUAL'}
                  </button>
                  <span style={{ fontSize: 7.5, color: '#94a3b8' }}>· {s.source}</span>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div style={{ fontSize: 10.5, color: '#4d7c60', padding: '4px 2px' }}>
              No steps yet — drag tasks into the New role or Agent box.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
