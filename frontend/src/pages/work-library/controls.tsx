/**
 * Input controls for the Work Library page — the entity-backed value combobox
 * (SOR → Applications, owner → Roles, …) and the checklist/testing pattern
 * dropdowns. Extracted verbatim from WorkLibrary.tsx.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { cellInput, valueText, type Answer, type EvidenceRow, type Template } from './shared';

// ── Entity-backed value combobox ─────────────────────────────────────────

export function ValueCell({ valueKind, current, onSave }: {
  valueKind: string;
  current: Answer | EvidenceRow | null;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(valueText(current));
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<{ id: string; name: string; detail?: string | null }[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const entity = valueKind === 'APPLICATION' || valueKind === 'ROLE' || valueKind === 'DELIVERABLE';

  useEffect(() => { setText(valueText(current)); }, [current]);

  useEffect(() => {
    if (!entity || !open) return;
    const t = setTimeout(() => {
      api.get<{ options: { id: string; name: string; detail?: string | null }[] }>(`/work-library/options?kind=${valueKind}&q=${encodeURIComponent(text)}`)
        .then((d) => setOptions(d.options))
        .catch(() => setOptions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [entity, open, text, valueKind]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const fkField = valueKind === 'APPLICATION' ? 'applicationId' : valueKind === 'ROLE' ? 'roleId' : 'deliverableId';

  if (!entity) {
    return (
      <input
        className={cellInput}
        placeholder="Enter value"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { if (text !== (current?.value ?? '')) onSave({ value: text || null }); }}
      />
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        className={cellInput}
        placeholder="Select or add…"
        value={text}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
      />
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-0.5 max-h-52 overflow-auto rounded-md border border-[#e2e6ea] bg-white shadow-sm text-[12px]">
          {options.map((o) => (
            <button
              key={o.id}
              className="block w-full text-left px-2.5 py-1.5 hover:bg-[#f0f6ff]"
              onMouseDown={(e) => {
                e.preventDefault();
                onSave({ [fkField]: o.id, value: null });
                setOpen(false);
              }}
            >
              {o.name}
              {o.detail && <span className="text-[#a3a3a3]"> · {o.detail}</span>}
            </button>
          ))}
          {text.trim() && !options.some((o) => o.name.toLowerCase() === text.trim().toLowerCase()) && (
            <button
              className="block w-full text-left px-2.5 py-1.5 text-[#1d4ed8] border-t border-[#eef1f4] hover:bg-[#f0f6ff]"
              onMouseDown={async (e) => {
                e.preventDefault();
                const d = await api.post('/work-library/options', { kind: valueKind, name: text.trim() });
                onSave({ [fkField]: d.option.id, value: null });
                setOpen(false);
              }}
            >
              + Add "{text.trim()}" to {valueKind === 'APPLICATION' ? 'Applications' : valueKind === 'ROLE' ? 'Roles' : 'Deliverables'}
            </button>
          )}
          {(current as Answer | null)?.id && valueText(current) && (
            <button
              className="block w-full text-left px-2.5 py-1.5 text-[#a3a3a3] border-t border-[#eef1f4] hover:bg-[#fafafa]"
              onMouseDown={(e) => { e.preventDefault(); onSave({ [fkField]: null, value: null }); setOpen(false); }}
            >
              Clear value
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pattern dropdowns ────────────────────────────────────────────────────

export function PatternDropdown({ label, templates, selectedIds, multi, onChange }: {
  label: string;
  templates: Template[];
  selectedIds: string[];
  multi: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const selected = templates.filter((t) => selectedIds.includes(t.id));
  const display = selected.length
    ? selected.map((t) => t.name).join(' + ')
    : multi ? 'Core evidence only' : 'None selected';

  return (
    <div ref={ref} className="relative">
      <div className="text-[11px] text-[#6b7785] mb-1">{label}</div>
      <button
        className="w-[280px] max-w-full flex items-center justify-between gap-2 rounded-md border border-[#d4d4d4] bg-white px-2.5 py-1.5 text-[12px] text-left hover:border-[#a3a3a3]"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">{display}</span>
        <span className="text-[#a3a3a3]">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-0.5 w-[300px] rounded-md border border-[#e2e6ea] bg-white shadow-sm text-[12px] py-1">
          {templates.map((t) => {
            const checked = selectedIds.includes(t.id);
            const locked = multi && t.isDefault; // Core evidence is always applied
            return (
              <button
                key={t.id}
                disabled={locked}
                className={'flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-[#f0f6ff] ' + (locked ? 'opacity-60' : '')}
                onClick={() => {
                  if (locked) return;
                  if (multi) onChange(checked ? selectedIds.filter((x) => x !== t.id) : [...selectedIds, t.id]);
                  else { onChange(checked ? [] : [t.id]); setOpen(false); }
                }}
              >
                <span className={'inline-block w-3.5 text-center ' + (checked || locked ? 'text-[#1d4ed8]' : 'text-[#d4d4d4]')}>
                  {checked || locked ? '✓' : '○'}
                </span>
                <span className="flex-1">
                  {t.name}
                  <span className="text-[#a3a3a3]"> · {t.keys.length} keys{locked ? ' · always on' : ''}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
