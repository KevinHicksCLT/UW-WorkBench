/**
 * Structured editor for a specific step's procedure value in the Work Library
 * — the newline-joined "By the <role>: / atomic actions / Done when …" text
 * broken into small stacked cells: the performing role first (a combobox over
 * the Roles catalog), the atomic actions between (bulleted, addable and
 * removable), the definition of done last. Persists back as the same
 * newline-joined text value, so every renderer (ProcedureValue) keeps working
 * unchanged.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { LinkButton } from '../../components/ui';
import type { Answer } from './shared';

const miniCell =
  'w-full text-[12px] px-2 py-1 rounded-md border border-[#e3e7eb] bg-white hover:border-[#c6cdd5] focus:border-[#7aa7d9] focus:outline-none';

type Parts = { role: string; steps: string[]; done: string };

/** Split a stored procedure value into role byline / atomic steps / done line. */
export function parseProcedure(value: string | null | undefined): Parts {
  const lines = (value ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { role: '', steps: [], done: '' };
  const role = /^by\b/i.test(lines[0]) || /:$/.test(lines[0]) ? lines.shift()! : '';
  const done =
    lines.length && /^(done|pass) when\b/i.test(lines[lines.length - 1]) ? lines.pop()! : '';
  return { role, steps: lines.map((l) => l.replace(/^\d+[.)]\s*/, '')), done };
}

/** Re-join the parts into the stored newline format, dropping empty lines. */
export function joinProcedure(p: Parts): string {
  return [p.role, ...p.steps, p.done]
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

export function ProcedureCells({
  current,
  onSave,
}: {
  current: Answer | null;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [parts, setParts] = useState<Parts>(() => parseProcedure(current?.value));
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Each blur saves + refetches; don't let that refetch clobber the cell the
    // user has already moved on to — resync only while the editor is unfocused.
    if (boxRef.current?.contains(document.activeElement)) return;
    setParts(parseProcedure(current?.value));
  }, [current?.value]);

  const persist = (next: Parts) => {
    const joined = joinProcedure(next);
    if (joined !== joinProcedure(parseProcedure(current?.value))) onSave({ value: joined || null });
  };
  const setStep = (i: number, text: string) =>
    setParts((p) => ({ ...p, steps: p.steps.map((s, si) => (si === i ? text : s)) }));
  const removeStep = (i: number) => {
    const next = { ...parts, steps: parts.steps.filter((_, si) => si !== i) };
    setParts(next);
    persist(next);
  };

  return (
    <div ref={boxRef} className="flex flex-col gap-1 py-0.5">
      <RoleCombo
        role={parts.role}
        onChange={(role) => setParts({ ...parts, role })}
        onCommit={(role) => persist({ ...parts, role })}
      />
      {parts.steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="text-[#8a94a0] text-[12px] pl-1 flex-shrink-0">•</span>
          <input
            className={miniCell}
            placeholder="Atomic step"
            value={s}
            onChange={(e) => setStep(i, e.target.value)}
            onBlur={() => persist(parts)}
          />
          <button
            className="text-[#dc2626] hover:text-[#b91c1c] text-[11px] px-0.5 flex-shrink-0"
            title="Remove this atomic step"
            onClick={() => removeStep(i)}
          >
            ✕
          </button>
        </div>
      ))}
      <LinkButton
        className="self-start text-[11px] pl-4"
        onClick={() => setParts({ ...parts, steps: [...parts.steps, ''] })}
      >
        + Add atomic step
      </LinkButton>
      <input
        className={miniCell + ' font-semibold'}
        placeholder="Done when …"
        title="Definition of done — always last"
        value={parts.done}
        onChange={(e) => setParts({ ...parts, done: e.target.value })}
        onBlur={() => persist(parts)}
      />
    </div>
  );
}

// Role byline cell — a combobox over the Roles catalog (same options endpoint
// as entity-backed values); picking a role writes the "By the <role>:" line.
function RoleCombo({
  role,
  onChange,
  onCommit,
}: {
  role: string;
  onChange: (role: string) => void;
  onCommit: (role: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  // Search by the bare role name, not the "By the …:" dressing around it.
  const query = role.replace(/^by( the)?\s*/i, '').replace(/:\s*$/, '');

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api
        .get<{ options: { id: string; name: string }[] }>(
          `/work-library/options?kind=ROLE&q=${encodeURIComponent(query)}`,
        )
        .then((d) => setOptions(d.options))
        .catch(() => setOptions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <input
        className={miniCell + ' font-semibold'}
        placeholder="By the <role>:"
        title="Who performs this step — always first"
        value={role}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onBlur={() => onCommit(role)}
      />
      {open && options.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-0.5 max-h-52 overflow-auto rounded-md border border-[#e2e6ea] bg-white shadow-sm text-[12px]">
          {options.map((o) => (
            <button
              key={o.id}
              className="block w-full text-left px-2.5 py-1.5 hover:bg-[#f0f6ff]"
              onMouseDown={(e) => {
                e.preventDefault();
                const line = `By the ${o.name}:`;
                onChange(line);
                onCommit(line);
                setOpen(false);
              }}
            >
              {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
