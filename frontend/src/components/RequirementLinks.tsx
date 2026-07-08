import { useState } from 'react';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import { useApi } from '../lib/useApi';
import { withCompany } from '../lib/portfolio';
import { ErrorMessage, LoadingState } from './ui';

// Value-stream chips for a regulatory requirement + the inline editor that
// replaces the full link set (PUT /regulations/requirements/:id/value-streams).
// The editor offers the process tree at three grains — value stream (L2),
// area (L3), and sub-process (L4) — because the write materializes the
// requirement onto every task under whichever node is picked; chips always
// display the L2 rollup. Editing is offered only when `canEdit` (the API
// enforces it regardless).

export type VsLink = {
  valueStreamId: string;
  relationship: string; // GOVERNS | REQUIRES_INTEGRATION | INFORMS
  notes?: string | null;
  valueStream: { id: string; name: string };
};
export type VsOption = { id: string; name: string };
type TreeOption = { id: string; name: string; children: TreeOption[] };

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
        <span
          key={l.valueStreamId}
          className={REL_PILL[l.relationship] ?? 'pill-slate'}
          title={`${REL_LABEL[l.relationship] ?? l.relationship}${l.notes ? ` — ${l.notes}` : ''}`}
        >
          {l.valueStream.name}
        </span>
      ))}
    </span>
  );
}

export function LinksEditor({
  requirementId,
  links,
  onSaved,
  onCancel,
}: {
  requirementId: string;
  links: VsLink[];
  /** Kept for call-site compatibility; the editor loads the full tree itself. */
  valueStreams?: VsOption[];
  onSaved: (links: VsLink[]) => void;
  onCancel: () => void;
}) {
  const { companyId } = useCompany();
  const tree = useApi<TreeOption[]>(
    companyId ? withCompany('/regulations/process-options', companyId) : null,
  );
  const [draft, setDraft] = useState<{ valueStreamId: string; relationship: string }[]>(
    links.map((l) => ({ valueStreamId: l.valueStreamId, relationship: l.relationship })),
  );
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggled = (id: string) => draft.find((d) => d.valueStreamId === id);
  const toggle = (id: string) => {
    setDraft((prev) =>
      prev.find((d) => d.valueStreamId === id)
        ? prev.filter((d) => d.valueStreamId !== id)
        : [...prev, { valueStreamId: id, relationship: 'GOVERNS' }],
    );
  };
  const setRel = (id: string, relationship: string) =>
    setDraft((prev) => prev.map((d) => (d.valueStreamId === id ? { ...d, relationship } : d)));
  const toggleOpen = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () => {
    setSaving(true);
    setError('');
    api
      .put(withCompany(`/regulations/requirements/${requirementId}/value-streams`, companyId), {
        links: draft,
      })
      .then((rows: VsLink[]) => onSaved(rows))
      .catch((e) => setError(e.message))
      .finally(() => setSaving(false));
  };

  /** One row at any grain — checkbox, optional expander, relationship select. */
  const row = (opt: TreeOption, depth: number) => {
    const sel = toggled(opt.id);
    const expandable = opt.children.length > 0;
    const expanded = open.has(opt.id);
    return (
      <div key={opt.id}>
        <div className="flex items-center gap-2 text-sm" style={{ paddingLeft: depth * 18 }}>
          {expandable ? (
            <button
              type="button"
              onClick={() => toggleOpen(opt.id)}
              aria-expanded={expanded}
              className="w-4 text-[#a3a3a3] hover:text-[#171717] flex-shrink-0"
              title={expanded ? 'Collapse' : 'Refine to a lower level'}
            >
              {expanded ? '▾' : '▸'}
            </button>
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}
          <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
            <input type="checkbox" checked={!!sel} onChange={() => toggle(opt.id)} />
            <span className="truncate text-[#262626]">{opt.name}</span>
          </label>
          {sel && (
            <select
              className="text-[11px] rounded border border-[#eaeaea] bg-white px-1 py-0.5 text-[#525252]"
              value={sel.relationship}
              onChange={(e) => setRel(opt.id, e.target.value)}
            >
              <option value="GOVERNS">Governs</option>
              <option value="REQUIRES_INTEGRATION">Requires integration</option>
              <option value="INFORMS">Informs</option>
            </select>
          )}
        </div>
        {expanded && opt.children.map((c) => row(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-[#eaeaea] bg-[#fafafa] p-3 mt-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1">
        Where this applies
      </div>
      <p className="text-[11px] text-[#a3a3a3] mb-2">
        Pick a value stream, or expand it (▸) to apply the requirement only to an area or
        sub-process inside it — it lands on every task under whatever you pick.
      </p>
      {tree.loading && <LoadingState />}
      {!tree.loading && (
        <div className="max-h-64 overflow-y-auto pr-1 space-y-0.5">
          {(tree.data ?? []).map((vs) => row(vs, 0))}
        </div>
      )}
      {error && <ErrorMessage baseClassName="text-xs text-[#be123c] mt-2">{error}</ErrorMessage>}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-[#171717] text-white text-xs font-medium px-3 py-1.5 hover:bg-[#333] disabled:opacity-50 transition-colors duration-150"
        >
          {saving ? 'Saving…' : 'Save links'}
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-[#666666] hover:text-[#171717] transition-colors duration-150"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
