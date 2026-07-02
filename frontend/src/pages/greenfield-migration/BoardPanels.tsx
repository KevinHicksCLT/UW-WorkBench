/**
 * Staged-changes commit panel and change log for the Application
 * Rationalization board. Extracted verbatim from GreenfieldMigration.tsx.
 */
import { Button, EmptyState, ErrorMessage } from '../../components/ui';
import { CHANGE_DOT, type StagedChange } from './boardOverlay';

// A change-log entry (audit row scoped to the workspace).
export type LogEntry = { id: string; action: string; actorEmail: string; createdAt: string; diff: string | null };

// ── Staged-changes commit panel ──────────────────────────────────────────────
// The pre-submit "commit": the running list of board edits the user has staged,
// shown as a commit-tree-style list with type dots, before they submit.
export function CommitPanel({ changes, saving, onSubmit, onDiscard, error }: { changes: StagedChange[]; saving: boolean; onSubmit: () => void; onDiscard: () => void; error: string }) {
  return (
    <div className="mt-3 rounded-lg border border-[#c7d2fe] bg-[#f5f7ff] p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[12px] font-semibold text-[#171717]">
          Staged changes
          <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-[18px] rounded-full bg-white text-[11px] font-semibold text-[#4f46e5] px-1.5 tnum border border-[#c7d2fe]">{changes.length}</span>
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" onClick={onDiscard} disabled={saving} className="text-[12px]">Discard</Button>
          <Button onClick={onSubmit} disabled={saving || changes.length === 0} className="text-[12px]">{saving ? 'Submitting…' : 'Submit changes'}</Button>
        </div>
      </div>
      {error && <ErrorMessage baseClassName="text-[12px] text-[#be123c] mb-2">{error}</ErrorMessage>}
      {changes.length === 0 ? (
        <EmptyState baseClassName="text-[12px] text-[#a3a3a3]" message="Nothing staged yet — drag a box or re-wire an arrow and it will appear here." />
      ) : (
        <ul className="space-y-1.5 pl-1 border-l border-[#c7d2fe]">
          {changes.map((c, i) => (
            <li key={i} className="flex items-center gap-2 -ml-[5px] text-[12px] text-[#171717]">
              <span className="inline-block w-2 h-2 rounded-full ring-2 ring-[#f5f7ff] flex-shrink-0" style={{ background: CHANGE_DOT[c.type] }} />
              <span className="truncate">{c.label}</span>
              <span className="text-[9px] uppercase tracking-[0.08em] text-[#a3a3a3] flex-shrink-0">{c.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Change log ───────────────────────────────────────────────────────────────
// Collapsed: a running total of edits. Expanded: the field-level detail.
type CapdanDiff = { subject?: string; summary?: string; layer?: string; changes?: Record<string, { from: unknown; to: unknown }> | StagedChange[] };

export function ChangeLog({ entries, open, onToggle }: { entries: LogEntry[]; open: boolean; onToggle: () => void }) {
  return (
    <div className="mt-4 rounded-lg border border-[#eaeaea] overflow-hidden">
      <button onClick={onToggle} aria-expanded={open} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#fafafa] transition-colors duration-150">
        <span className="text-[12px] font-semibold text-[#171717]">
          Change log
          <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-[18px] rounded-full bg-[#f5f5f5] text-[11px] font-semibold text-[#525252] px-1.5 tnum">{entries.length}</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={'text-[#a3a3a3] transition-transform duration-150 ' + (open ? 'rotate-180' : '')} aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-[#eaeaea] px-4 py-3 max-h-72 overflow-y-auto">
          {entries.length === 0 ? (
            <EmptyState baseClassName="text-[12px] text-[#a3a3a3]" message="No changes recorded yet." />
          ) : (
            <ul className="space-y-3">
              {entries.map((e) => <ChangeLogRow key={e.id} entry={e} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ChangeLogRow({ entry }: { entry: LogEntry }) {
  let parsed: CapdanDiff | null;
  try { parsed = entry.diff ? JSON.parse(entry.diff) : null; } catch { parsed = null; }
  const boardChanges = Array.isArray(parsed?.changes) ? (parsed!.changes as StagedChange[]) : null;
  const fieldChanges = parsed?.changes && !Array.isArray(parsed.changes) ? Object.entries(parsed.changes) : [];
  const title = parsed?.subject ?? parsed?.summary ?? (entry.action === 'COMMIT_BOARD' ? 'Board changes' : entry.action);
  return (
    <li className="flex gap-3 text-[12px]">
      <div className="text-[11px] text-[#a3a3a3] w-32 flex-shrink-0 tnum">{new Date(entry.createdAt).toLocaleString()}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[#171717]">
          <span className="font-medium">{title}</span>
          {parsed?.layer && <span className="text-[#a3a3a3]"> · {parsed.layer}</span>}
          <span className="text-[#a3a3a3]"> — {entry.actorEmail}</span>
        </div>
        {boardChanges && boardChanges.length > 0 && (
          <ul className="mt-1 space-y-0.5 pl-1 border-l border-[#eaeaea]">
            {boardChanges.map((c, i) => (
              <li key={i} className="flex items-center gap-1.5 -ml-[4px] text-[11px] text-[#666666]">
                <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CHANGE_DOT[c.type] ?? '#a3a3a3' }} />
                <span className="truncate">{c.label}</span>
              </li>
            ))}
          </ul>
        )}
        {fieldChanges.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {fieldChanges.map(([f, v]) => (
              <div key={f} className="text-[11px] text-[#666666]">
                <span className="font-medium text-[#525252]">{f}</span>: <span className="text-[#a3a3a3] line-through">{String(v.from ?? '—')}</span> → <span className="text-[#171717]">{String(v.to ?? '—')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
