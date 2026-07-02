/**
 * Canvas chrome for the operating-model map: the edit toolbar (Edit / Save /
 * Revert + hint chip), the drag ghost that follows the cursor, the inline
 * rename editor, and the ephemeral move-feedback banner. Extracted verbatim
 * from MapCanvas; purely presentational.
 */
import type { Dispatch, SetStateAction } from 'react';

import { sentenceCase } from '../nodes/MapNode';
import { DOMAIN_HEX } from '../model';
import type { DragState, RenameState } from './constants';

// Drag ghost — a card-sized chip following the cursor 1:1 (pointer-events
// off so it's transparent to hit-testing). Only while really dragging.
export function DragGhost({ drag }: { drag: DragState }) {
  return (
    <div
      style={{
        position: 'fixed', left: drag.px - drag.grabDX, top: drag.py - drag.grabDY,
        width: drag.cardW, height: drag.cardH, zIndex: 50, pointerEvents: 'none',
        borderRadius: 10, background: '#ffffff',
        border: '1px solid #eaeaea', borderLeft: `3px solid ${DOMAIN_HEX[drag.cat] ?? '#64748b'}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)', opacity: 0.95,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '8px 10px', textAlign: 'center', fontSize: 11.5, fontWeight: 600, color: '#171717',
      }}
    >
      {sentenceCase(drag.name)}
    </div>
  );
}

// Inline rename editor — double-click a box in edit mode to open it.
export function RenameEditor({ rename, setRename, commitRename }: {
  rename: RenameState;
  setRename: Dispatch<SetStateAction<RenameState | null>>;
  commitRename: () => void;
}) {
  return (
    <input
      autoFocus
      value={rename.value}
      onChange={(e) => setRename((r) => (r ? { ...r, value: e.target.value } : r))}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') commitRename();
        else if (e.key === 'Escape') setRename(null);
      }}
      onBlur={commitRename}
      onFocus={(e) => e.currentTarget.select()}
      style={{
        position: 'fixed', left: rename.x, top: rename.y, width: rename.w, height: rename.h,
        zIndex: 60, boxSizing: 'border-box', padding: '6px 8px', borderRadius: 10,
        border: `2px solid ${DOMAIN_HEX[rename.cat] ?? '#0d9488'}`, background: '#ffffff',
        fontSize: 11.5, fontWeight: 600, color: '#171717', textAlign: 'center', outline: 'none',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      }}
    />
  );
}

// Edit toolbar — top-right of the canvas (the view toggle owns top-left).
// Edit mode makes every process level (L1 domain → L5 sub-process)
// draggable; drag onto another box to re-home it (children + associations
// follow, re-leveling as needed), hold over a box to drill deeper, or drop
// within a row to reorder. Nothing hits the DB until Save.
export function MapEditToolbar({ editMode, dirty, pendingCount, saving, onSave, onRevert, onToggleEdit }: {
  editMode: boolean;
  dirty: boolean;
  pendingCount: number;
  saving: boolean;
  onSave: () => void;
  onRevert: () => void;
  onToggleEdit: () => void;
}) {
  return (
    <div className="absolute top-3 right-4 z-20 flex items-center gap-2">
      {editMode && (
        <span className="hidden md:inline-flex items-center rounded-full bg-white/90 backdrop-blur border border-[#eaeaea] px-2.5 py-1 text-[11px] text-[#525252] shadow-sm">
          {dirty
            ? `${pendingCount} unsaved change${pendingCount === 1 ? '' : 's'} — Save or Revert`
            : 'Drag to move • hold to drill • drop in a row to reorder • double-click to rename'}
        </span>
      )}
      {editMode && dirty && (
        <>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-colors duration-150 bg-[#0d9488] text-white hover:bg-[#0f766e] disabled:opacity-60"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onRevert}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-colors duration-150 border border-[#eaeaea] bg-white/90 backdrop-blur text-[#525252] hover:text-[#171717] disabled:opacity-60"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 7" />
            </svg>
            Revert
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onToggleEdit}
        aria-pressed={editMode}
        className={
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-colors duration-150 ' +
          (editMode
            ? (dirty ? 'border border-[#eaeaea] bg-white/90 backdrop-blur text-[#a3a3a3]' : 'bg-[#0d9488] text-white hover:bg-[#0f766e]')
            : 'border border-[#eaeaea] bg-white/90 backdrop-blur text-[#525252] hover:text-[#171717]')
        }
      >
        {editMode ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Done
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Edit
          </>
        )}
      </button>
    </div>
  );
}

// Move feedback — small ephemeral banner, bottom-center (never a window.alert).
export function MoveFlashBanner({ moveFlash }: { moveFlash: { kind: 'ok' | 'err'; text: string } }) {
  return (
    <div
      className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 rounded-lg px-3.5 py-2 text-xs font-medium shadow-md backdrop-blur"
      style={
        moveFlash.kind === 'ok'
          ? { background: 'rgba(13,148,136,0.95)', color: '#fff' }
          : { background: 'rgba(190,18,60,0.95)', color: '#fff' }
      }
      role="status"
    >
      {moveFlash.text}
    </div>
  );
}
