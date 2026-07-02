/**
 * Audit tab of the Portfolio Initiative page — the audit trail with
 * human-readable per-entry diffs (value changes, stage moves, generic
 * field diffs). Extracted verbatim from PortfolioInitiative.tsx.
 */
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { fmt, STAGE_LABELS } from '../../lib/format';
import { Card, EmptyState } from '../../components/ui';

// ── AUDIT ────────────────────────────────────────────────────────────────
// Email → display name: "kevin.hicks@…" → "Kevin Hicks".
function actorName(email: string): string {
  const local = email.split('@')[0];
  const parts = local.split(/[._-]+/).filter(Boolean).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  return parts.length ? parts.join(' ') : email;
}
// "COST_VALUES_UPDATED" → "Cost values updated".
function actionLabel(a: string): string {
  const s = a.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
// "2026-07" → "Jul 2026".
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

type ValueChange = { period: string; from: number; to: number };
type AuditEntry = { id: string; action: string; actorEmail: string; createdAt: string; diff: string | null };

// Human-readable detail for one audit entry, parsed from its JSON diff.
function AuditDetail({ entry }: { entry: AuditEntry }) {
  if (!entry.diff) return null;
  let d: Record<string, unknown>;
  try { d = JSON.parse(entry.diff); } catch { return <pre className="mt-1 text-xs text-[#666666] bg-[#fafafa] border border-[#eaeaea] rounded p-2 overflow-auto">{entry.diff}</pre>; }

  // Time-phased value edits — show each changed month as from → to.
  if (Array.isArray(d.changes)) {
    const changes = d.changes as ValueChange[];
    return (
      <div className="mt-1 text-xs text-[#525252]">
        <div className="mb-1">
          Changed <span className="font-medium text-[#171717]">{String(d.field ?? 'values')}</span>
          {d.line ? <> on <span className="font-medium text-[#171717]">{String(d.line)}</span></> : null}
        </div>
        <ul className="space-y-0.5">
          {changes.map((c) => (
            <li key={c.period} className="tnum">
              {monthLabel(c.period)}: <span className="text-[#be123c]">{fmt.currency(c.from, { compact: true })}</span>
              {' → '}<span className="text-[#047857]">{fmt.currency(c.to, { compact: true })}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Workflow stage move — diff carries top-level stage codes.
  if (typeof d.from === 'string' && typeof d.to === 'string') {
    return (
      <div className="mt-1 text-xs text-[#525252]">
        Stage: <span className="text-[#be123c]">{STAGE_LABELS[d.from] ?? d.from}</span>
        {' → '}<span className="text-[#047857]">{STAGE_LABELS[d.to] ?? d.to}</span>
      </div>
    );
  }
  if (typeof d.stage === 'string' && typeof d.requestedNext === 'string') {
    return (
      <div className="mt-1 text-xs text-[#525252]">
        Requested advance: {STAGE_LABELS[d.stage] ?? d.stage} → {STAGE_LABELS[d.requestedNext] ?? d.requestedNext}
      </div>
    );
  }

  // Generic diff — render each field as "key: value" (or "from → to").
  const rows = Object.entries(d).filter(([, v]) => v !== undefined && v !== null);
  if (rows.length === 0) return null;
  return (
    <div className="mt-1 text-xs text-[#525252] space-y-0.5">
      {rows.map(([k, v]) => {
        const fromTo = v && typeof v === 'object' && 'from' in (v as object) && 'to' in (v as object);
        return (
          <div key={k}>
            <span className="text-[#a3a3a3]">{k}:</span>{' '}
            {fromTo
              ? <span className="tnum">{String((v as { from: unknown }).from)} → {String((v as { to: unknown }).to)}</span>
              : <span className="text-[#171717]">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function AuditTab({ initId }: { initId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  useEffect(() => { api.get<AuditEntry[]>(`/audit?entityType=PortfolioInitiative&entityId=${initId}`).then(setEntries).catch(() => {}); }, [initId]);
  return (
    <Card variant="elevated" className="p-5">
      <h3 className="text-sm font-semibold text-[#171717] mb-3">Audit trail</h3>
      {entries.length === 0 ? (
        <EmptyState baseClassName="text-sm text-[#a3a3a3]" message="No history yet." />
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3 py-2 border-b border-[#f5f5f5] last:border-0">
              <div className="text-xs text-[#a3a3a3] w-36 flex-shrink-0">{new Date(e.createdAt).toLocaleString()}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <span className="font-medium text-[#171717]">{actorName(e.actorEmail)}</span>
                  <span className="text-[#525252]"> · {actionLabel(e.action)}</span>
                </div>
                <AuditDetail entry={e} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
