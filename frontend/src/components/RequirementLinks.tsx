import { useState } from 'react';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import { withCompany } from '../lib/portfolio';

// Value-stream chips for a regulatory requirement + the inline editor that
// replaces the full link set (PUT /regulations/requirements/:id/value-streams).
// Used by the Requirements lens and the state detail page. Editing is offered
// only when `canEdit` (ADMIN/MANAGER — the API enforces it regardless).

export type VsLink = {
  valueStreamId: string;
  relationship: string; // GOVERNS | REQUIRES_INTEGRATION | INFORMS
  notes?: string | null;
  valueStream: { id: string; name: string };
};
export type VsOption = { id: string; name: string };

const REL_LABEL: Record<string, string> = {
  GOVERNS: 'Governs',
  REQUIRES_INTEGRATION: 'Requires integration',
  INFORMS: 'Informs',
};
const REL_PILL: Record<string, string> = {
  GOVERNS: 'pill-blue',
  REQUIRES_INTEGRATION: 'pill-amber',
  INFORMS: 'pill-slate',
};

export function LinkChips({ links }: { links: VsLink[] }) {
  if (!links.length) return <span className="pill pill-red">Unmapped</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {links.map((l) => (
        <span key={l.valueStreamId} className={REL_PILL[l.relationship] ?? 'pill-slate'} title={`${REL_LABEL[l.relationship] ?? l.relationship}${l.notes ? ` — ${l.notes}` : ''}`}>
          {l.valueStream.name}
        </span>
      ))}
    </span>
  );
}

export function LinksEditor({
  requirementId, links, valueStreams, onSaved, onCancel,
}: {
  requirementId: string;
  links: VsLink[];
  valueStreams: VsOption[];
  onSaved: (links: VsLink[]) => void;
  onCancel: () => void;
}) {
  const { companyId } = useCompany();
  const [draft, setDraft] = useState<{ valueStreamId: string; relationship: string }[]>(
    links.map((l) => ({ valueStreamId: l.valueStreamId, relationship: l.relationship })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggled = (id: string) => draft.find((d) => d.valueStreamId === id);
  const toggle = (id: string) => {
    setDraft((prev) => (prev.find((d) => d.valueStreamId === id)
      ? prev.filter((d) => d.valueStreamId !== id)
      : [...prev, { valueStreamId: id, relationship: 'GOVERNS' }]));
  };
  const setRel = (id: string, relationship: string) =>
    setDraft((prev) => prev.map((d) => (d.valueStreamId === id ? { ...d, relationship } : d)));

  const save = () => {
    setSaving(true);
    setError('');
    api.put(withCompany(`/regulations/requirements/${requirementId}/value-streams`, companyId), { links: draft })
      .then((rows: VsLink[]) => onSaved(rows))
      .catch((e) => setError(e.message))
      .finally(() => setSaving(false));
  };

  return (
    <div className="rounded-lg border border-[#eaeaea] bg-[#fafafa] p-3 mt-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-2">
        Where this applies — value streams
      </div>
      <div className="grid sm:grid-cols-2 gap-1 max-h-56 overflow-y-auto pr-1">
        {valueStreams.map((vs) => {
          const sel = toggled(vs.id);
          return (
            <div key={vs.id} className="flex items-center gap-2 text-sm">
              <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                <input type="checkbox" checked={!!sel} onChange={() => toggle(vs.id)} />
                <span className="truncate text-[#262626]">{vs.name}</span>
              </label>
              {sel && (
                <select
                  className="text-[11px] rounded border border-[#eaeaea] bg-white px-1 py-0.5 text-[#525252]"
                  value={sel.relationship}
                  onChange={(e) => setRel(vs.id, e.target.value)}
                >
                  <option value="GOVERNS">Governs</option>
                  <option value="REQUIRES_INTEGRATION">Requires integration</option>
                  <option value="INFORMS">Informs</option>
                </select>
              )}
            </div>
          );
        })}
      </div>
      {error && <div className="text-xs text-[#be123c] mt-2">{error}</div>}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-[#171717] text-white text-xs font-medium px-3 py-1.5 hover:bg-[#333] disabled:opacity-50 transition-colors duration-150"
        >
          {saving ? 'Saving…' : 'Save links'}
        </button>
        <button onClick={onCancel} className="text-xs text-[#666666] hover:text-[#171717] transition-colors duration-150">
          Cancel
        </button>
      </div>
    </div>
  );
}
