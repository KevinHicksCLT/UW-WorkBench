import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

// Data Health panel (audit A2): runs the read-only validation checks for the
// active company and renders pass/warn/fail with sample offending rows. Nothing
// here mutates data — it points the admin at what to fix in the normal editors.

type Sample = { entity?: string; id: string; label: string; hint?: string };
type Check = {
  id: string; label: string; area: string;
  status: 'pass' | 'warn' | 'fail'; summary: string; count: number; samples: Sample[];
};

const STATUS: Record<Check['status'], { dot: string; badge: string; ring: string }> = {
  pass: { dot: 'bg-emerald-500', badge: 'text-emerald-700 bg-emerald-50', ring: 'border-l-emerald-400' },
  warn: { dot: 'bg-amber-500', badge: 'text-amber-700 bg-amber-50', ring: 'border-l-amber-400' },
  fail: { dot: 'bg-rose-500', badge: 'text-rose-700 bg-rose-50', ring: 'border-l-rose-400' },
};

// entity slug → admin tab key, so a sample can deep-link to where it's edited.
const ENTITY_TAB: Record<string, string> = {
  role: 'organization', portfolioInitiative: 'initiatives',
};

export default function ValidationPanel({
  companyId, onNavigate,
}: {
  companyId: string | null;
  onNavigate?: (tab: string, section?: string) => void;
}) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    if (!companyId) return;
    setLoading(true);
    setError('');
    api.get(`/admin/validations?companyId=${companyId}`)
      .then((d: { checks: Check[] }) => setChecks(d.checks))
      .catch((e: any) => setError(String(e?.message || e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [companyId]);

  if (!companyId) return <p className="text-sm text-[#a3a3a3]">Select a company to run data-health checks.</p>;

  const tally = { fail: 0, warn: 0, pass: 0 };
  for (const c of checks ?? []) tally[c.status]++;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#666666] max-w-2xl">
          Read-only integrity checks for the data behind every screen. Failing checks list sample rows to fix in the editors —
          nothing here changes data.
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="flex-shrink-0 text-sm px-3 py-1.5 rounded-md border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] disabled:opacity-50"
        >
          {loading ? 'Running…' : 'Re-run'}
        </button>
      </div>

      {checks && (
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-rose-50 text-rose-700">{tally.fail} failing</span>
          <span className="px-2 py-1 rounded bg-amber-50 text-amber-700">{tally.warn} warnings</span>
          <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700">{tally.pass} passing</span>
        </div>
      )}

      {error && <div className="text-sm text-[#be123c]">{error}</div>}
      {!checks && loading && <div className="text-sm text-[#a3a3a3]">Running checks…</div>}

      <div className="space-y-3">
        {(checks ?? []).map((c) => {
          const s = STATUS[c.status];
          return (
            <div key={c.id} className={`card-elevated p-4 border-l-4 ${s.ring}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                <span className="font-medium text-[#171717]">{c.label}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${s.badge}`}>{c.status}</span>
                <span className="text-[10px] text-[#a3a3a3]">{c.area}</span>
              </div>
              <p className="text-sm text-[#525252]">{c.summary}</p>
              {c.samples.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.samples.map((sm) => {
                    const tab = sm.entity ? ENTITY_TAB[sm.entity] : undefined;
                    const clickable = tab && onNavigate;
                    return (
                      <button
                        key={sm.id}
                        onClick={clickable ? () => onNavigate!(tab!) : undefined}
                        title={sm.hint}
                        className={
                          'text-xs px-2 py-1 rounded border border-[#eeeeee] bg-[#fafafa] text-[#525252] ' +
                          (clickable ? 'hover:bg-[#f0f0f0] hover:text-[#171717] cursor-pointer' : 'cursor-default')
                        }
                      >
                        {sm.label}{sm.hint ? ` · ${sm.hint}` : ''}
                      </button>
                    );
                  })}
                  {c.count > c.samples.length && (
                    <span className="text-xs px-2 py-1 text-[#a3a3a3]">+{c.count - c.samples.length} more</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
