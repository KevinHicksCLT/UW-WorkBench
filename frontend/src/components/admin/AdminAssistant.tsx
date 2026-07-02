import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { Button, ErrorMessage } from '../ui';

// ─── Data Admin AI overlay ───────────────────────────────────────────────────
// A docked assistant that configures the operating model ON THE USER'S BEHALF.
// The user describes what they want; POST /admin/ai grounds itself in the real
// company data and returns a STRUCTURED PLAN of create/update/delete operations.
// We render the plan for review and, on "Apply", execute each op through the same
// audited /admin/:entity endpoints the manual editors use — so AI edits and hand
// edits are indistinguishable downstream. Conversational: the user can refine.

type Op = {
  op: 'create' | 'update' | 'delete';
  entity: string;
  entityLabel: string;
  id: string | null;
  data: Record<string, unknown>;
  reason: string;
  issues: string[];
};
type Plan = { summary: string; operations: Op[] };
type Turn = { role: 'user' | 'assistant'; content: string; plan?: Plan; applied?: boolean };

const SUGGESTIONS = [
  'Add three operational risks for the claims value stream',
  'Create a standards area "Data Privacy" with two guidelines',
  'Add a new division "Customer Experience" with two departments',
];

function withCompany(path: string, companyId: string | null) {
  if (!companyId) return path;
  return path + (path.includes('?') ? '&' : '?') + `companyId=${companyId}`;
}

const opColor: Record<Op['op'], string> = {
  create: 'bg-[#dcfce7] text-[#166534]',
  update: 'bg-[#dbeafe] text-[#1e40af]',
  delete: 'bg-[#fee2e2] text-[#991b1b]',
};

export default function AdminAssistant({
  open, onClose, companyId, companyName, onApplied,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string | null;
  companyName?: string;
  onApplied: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, loading, open]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading || !companyId) return;
    setError('');
    const next: Turn[] = [...turns, { role: 'user', content: q }];
    setTurns(next);
    setInput('');
    setLoading(true);
    try {
      const history = next.filter((t) => t.role === 'user' || t.content).map((t) => ({ role: t.role, content: t.content }));
      const plan: Plan = await api.post(withCompany('/admin/ai', companyId), { companyId, messages: history });
      setTurns([...next, { role: 'assistant', content: plan.summary || 'Here is a proposed plan.', plan: plan.operations?.length ? plan : undefined }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setTurns(next);
    } finally {
      setLoading(false);
    }
  };

  const applyPlan = async (turnIdx: number) => {
    const turn = turns[turnIdx];
    if (!turn.plan || applying) return;
    setApplying(true); setError('');
    const ops = turn.plan.operations.filter((o) => o.issues.length === 0);
    let ok = 0;
    const failures: string[] = [];
    for (const o of ops) {
      try {
        if (o.op === 'create') await api.post(withCompany(`/admin/${o.entity}`, companyId), o.data);
        else if (o.op === 'update' && o.id) await api.patch(withCompany(`/admin/${o.entity}/${o.id}`, companyId), o.data);
        else if (o.op === 'delete' && o.id) await api.delete(withCompany(`/admin/${o.entity}/${o.id}`, companyId));
        ok++;
      } catch (e) {
        failures.push(`${o.op} ${o.entityLabel}: ${(e as Error).message}`);
      }
    }
    setApplying(false);
    setTurns((prev) => prev.map((t, i) => (i === turnIdx ? { ...t, applied: true } : t)));
    setTurns((prev) => [...prev, {
      role: 'assistant',
      content: failures.length
        ? `Applied ${ok} change${ok === 1 ? '' : 's'}. ${failures.length} failed:\n- ${failures.join('\n- ')}`
        : `Done — applied ${ok} change${ok === 1 ? '' : 's'}. The editors have refreshed.`,
    }]);
    onApplied();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-xl h-full bg-white border-l border-[#eaeaea] shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-[#eaeaea] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#0070AD] text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.6L19.5 9l-4.6 3.3 1.8 5.7L12 14.7 7.3 18l1.8-5.7L4.5 9l5.6-.4z" /></svg>
            </span>
            <div>
              <div className="text-sm font-semibold text-[#171717]">AI configuration assistant</div>
              <div className="text-[11px] text-[#a3a3a3]">Edits {companyName ?? 'this company'} on your behalf — you approve every change</div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-[#171717]" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {turns.length === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-[#666666]">
                Describe what you want to set up and I'll draft the records. I read the company's real data first,
                propose a plan, and only change anything after you approve it.
              </p>
              <div className="space-y-1.5">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="block w-full text-left text-xs rounded-lg border border-[#eaeaea] bg-[#fafafa] px-3 py-2 text-[#404040] hover:border-[#d4d4d4] hover:bg-white transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) =>
            t.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[88%] rounded-2xl rounded-br-sm bg-[#171717] px-3.5 py-2 text-sm text-white whitespace-pre-wrap">{t.content}</div>
              </div>
            ) : (
              <div key={i} className="space-y-2">
                <div className="text-sm text-[#171717] whitespace-pre-wrap">{t.content}</div>
                {t.plan && <PlanCard plan={t.plan} applied={t.applied} applying={applying} onApply={() => applyPlan(i)} />}
              </div>
            ),
          )}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#a3a3a3] animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#a3a3a3] animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#a3a3a3] animate-bounce" />
              </span>
              Reading the data and drafting a plan…
            </div>
          )}
          {error && <ErrorMessage baseClassName="text-xs text-[#be123c]">{error}</ErrorMessage>}
        </div>

        {/* Composer */}
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-[#eaeaea] p-3 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="e.g. Add a value stream 'Reinsurance' with three process areas…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-[#eaeaea] bg-white px-3.5 py-2 text-sm text-[#171717] placeholder:text-[#a3a3a3] focus:outline-none focus:ring-1 focus:ring-[#0070AD] focus:border-[#0070AD] max-h-32"
          />
          <button type="submit" disabled={loading || !input.trim()} className="rounded-xl bg-[#0070AD] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#005a8c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Send</button>
        </form>
      </div>
    </div>
  );
}

function PlanCard({ plan, applied, applying, onApply }: { plan: Plan; applied?: boolean; applying: boolean; onApply: () => void }) {
  const valid = plan.operations.filter((o) => o.issues.length === 0).length;
  const blocked = plan.operations.length - valid;
  return (
    <div className="rounded-xl border border-[#eaeaea] overflow-hidden">
      <div className="px-3 py-2 bg-[#fafafa] border-b border-[#eaeaea] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#737373]">
        Proposed changes ({plan.operations.length})
      </div>
      <div className="divide-y divide-[#f5f5f5] max-h-72 overflow-y-auto">
        {plan.operations.map((o, i) => (
          <div key={i} className="px-3 py-2">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${opColor[o.op]}`}>{o.op}</span>
              <span className="text-xs font-medium text-[#171717]">{o.entityLabel}</span>
            </div>
            <div className="text-xs text-[#525252]">{o.reason}</div>
            {Object.keys(o.data).length > 0 && (
              <div className="mt-1 text-[11px] text-[#737373] font-mono break-words">
                {Object.entries(o.data).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('  ·  ')}
              </div>
            )}
            {o.issues.length > 0 && <div className="mt-1 text-[11px] text-[#be123c]">⚠ {o.issues.join('; ')}</div>}
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-[#eaeaea] flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#a3a3a3]">
          {applied ? 'Applied.' : blocked ? `${valid} ready · ${blocked} need attention` : `${valid} change${valid === 1 ? '' : 's'} ready`}
        </span>
        <Button
          onClick={onApply}
          disabled={applied || applying || valid === 0}
          className="text-xs disabled:opacity-50"
        >
          {applied ? 'Applied ✓' : applying ? 'Applying…' : `Apply ${valid} change${valid === 1 ? '' : 's'}`}
        </Button>
      </div>
    </div>
  );
}
