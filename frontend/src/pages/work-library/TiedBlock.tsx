/**
 * Standards / Regulations tied to a task — the tied-item block with its
 * add-picker, per-item checklist/testing step tables and inline editors.
 * Extracted verbatim from WorkLibrary.tsx.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { EmptyState, LinkButton } from '../../components/ui';
import { cellInput, useSortable, moveItem, DragHandle, type EvidenceRow, type Subject, type TiedItem } from './shared';
import { ValueCell } from './controls';

// ── Standards / Regulations tied to a task ───────────────────────────────

// Picker for tying an existing standard/regulation to this task. The pick
// writes a real NodeStandard/NodeRegulation junction row — single source of
// truth — so it reflects on the Standards/Regulations tabs and everywhere else.
function AddTiedPicker({ scope, taskId, tiedIds, refetch }: {
  scope: 'standard' | 'regulation';
  taskId: string;
  tiedIds: Set<string>;
  refetch: () => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Subject[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api.get(`/work-library/subjects?type=${scope}&q=${encodeURIComponent(q)}`)
        .then((d) => setOptions(d.subjects.filter((s: Subject) => !tiedIds.has(s.id))))
        .catch(() => setOptions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [open, q, scope, tiedIds]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <input
        className="w-[260px] rounded-md border border-[#e2e6ea] px-2 py-1 text-[11.5px] focus:border-[#7aa7d9] focus:outline-none"
        placeholder={`+ Tie a ${scope} to this task…`}
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
      />
      {open && options.length > 0 && (
        <div className="absolute z-30 right-0 mt-0.5 w-[340px] max-h-56 overflow-auto rounded-md border border-[#e2e6ea] bg-white shadow-sm text-[12px]">
          {options.map((o) => (
            <button
              key={o.id}
              className="block w-full text-left px-2.5 py-1.5 hover:bg-[#f0f6ff]"
              onMouseDown={async (e) => {
                e.preventDefault();
                await api.post(`/work-library/plan/task/${taskId}/${scope === 'standard' ? 'standards' : 'regulations'}`, scope === 'standard' ? { standardId: o.id } : { regId: o.id });
                setQ(''); setOpen(false); refetch();
              }}
            >
              {o.name}
              {o.path && <span className="block text-[10px] text-[#a3a3a3]">{o.path}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TiedBlock({ title, empty, items, scope, taskId, refetch }: {
  title: string;
  empty: string;
  items: TiedItem[];
  scope: 'standard' | 'regulation';
  taskId: string;
  refetch: () => void;
}) {
  const dialogs = useDialogs();
  const base = `/work-library/plan/task/${taskId}/evidence`;
  const idField = scope === 'standard' ? 'standardId' : 'regId';
  const save = (rows: Record<string, unknown>[]) => api.put(base, { rows }).then(refetch);
  const removeTied = async (item: TiedItem) => {
    const ok = await dialogs.confirm({
      title: `Remove "${item.name}" from this task?`,
      message: 'Tasks are the single source of truth — value-stream and higher-level views roll up from tasks, so this stays visible wherever other tasks still apply it.',
      danger: true,
    });
    if (!ok) return;
    await api.delete(`/work-library/plan/task/${taskId}/${scope === 'standard' ? 'standards' : 'regulations'}/${item.id}`);
    refetch();
  };

  return (
    <div className="rounded-xl border border-[#dfe3e8] overflow-hidden mb-4 bg-white">
      <div className="px-3 py-2 bg-[#f7f8fa] border-b border-[#e5e5e5] flex items-center gap-2 flex-wrap">
        <span className="text-[13px] font-semibold text-[#171717]">{title}</span>
        <span className="text-[10.5px] text-[#a3a3a3]">· tasks are the source of truth; higher levels roll up</span>
        <div className="ml-auto"><AddTiedPicker scope={scope} taskId={taskId} tiedIds={new Set(items.map((i) => i.id))} refetch={refetch} /></div>
      </div>
      {items.length === 0 && <EmptyState baseClassName="px-3 py-3 text-[12px] text-[#a3a3a3]" message={empty} />}
      {items.map((item) => (
        <div key={item.id} className="border-t border-[#eef1f4] first:border-t-0">
          <div className="px-3 pt-2 pb-1 flex items-center gap-2">
            <span className="text-[12px] font-medium text-[#171717]">
              {item.name} {item.source && <span className="text-[10px] text-[#a3a3a3] font-normal">· {item.source}</span>}
            </span>
            <button className="ml-auto text-[#dc2626] hover:text-[#b91c1c]" title="Remove from this task" onClick={() => removeTied(item)}>✕</button>
          </div>
          {(['CHECKLIST', 'TEST'] as const).map((kind) => (
            <TiedStepsTable
              key={kind}
              kind={kind}
              rows={kind === 'CHECKLIST' ? item.checklist : item.testing}
              itemId={item.id}
              idField={idField}
              scope={scope}
              base={base}
              save={save}
              refetch={refetch}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function TiedStepsTable({ kind, rows, itemId, idField, scope, base, save, refetch }: {
  kind: 'CHECKLIST' | 'TEST';
  rows: EvidenceRow[];
  itemId: string;
  idField: string;
  scope: 'standard' | 'regulation';
  base: string;
  save: (rows: Record<string, unknown>[]) => Promise<unknown>;
  refetch: () => void;
}) {
  const dialogs = useDialogs();
  const [ordered, setOrdered] = useState<EvidenceRow[]>(rows);
  useEffect(() => { setOrdered(rows); }, [rows]);
  const sort = useSortable(ordered.length, (from, to) => {
    const next = moveItem(ordered, from, to);
    setOrdered(next);
    save(next.map((r, i) => ({ id: r.id, kind, [idField]: itemId, sortOrder: i })));
  });
  return (
    <table className="w-full table-fixed border-collapse text-[12.5px]">
      <colgroup><col style={{ width: 36 }} /><col style={{ width: '38%' }} /><col /><col style={{ width: 40 }} /></colgroup>
      <tbody>
        <tr>
          <td colSpan={4} className="border border-[#e8ebee] bg-[#fafbfc] px-3 py-1.5 text-left text-[10.5px] font-medium text-[#8a94a0]">
            {kind === 'CHECKLIST' ? 'Checklist' : 'Testing'}
          </td>
        </tr>
        {ordered.map((r, i) => {
          return (
          <tr key={r.id} className="border-t border-[#f3f5f7]" style={sort.rowStyle(i)}>
            <td className="border border-[#e8ebee] px-2 py-2.5 text-right align-top text-[11px] text-[#a3a3a3] whitespace-nowrap"><DragHandle {...sort.handleProps(i)} />{i + 1}</td>
            <td className="border border-[#e8ebee] px-2 py-1.5 text-left align-top">
              <EvidenceStepInput row={r} onSave={(step) => save([{ id: r.id, kind, [idField]: itemId, step }])} />
            </td>
            <td className="border border-[#e8ebee] px-2 py-1.5 text-left align-top">
              <ValueCell valueKind="TEXT" current={r} onSave={(patch) => save([{ id: r.id, kind, [idField]: itemId, ...patch }])} />
            </td>
            <td className="border border-[#e8ebee] px-2 py-2.5 align-top text-center">
              <button
                className="text-[#dc2626] hover:text-[#b91c1c]"
                onClick={() => api.delete(`${base}/${scope}/${r.id}`).then(refetch)}
              >
                ✕
              </button>
            </td>
          </tr>
          );
        })}
        <tr className="border-t border-[#f3f5f7]">
          <td colSpan={4} className="border border-[#e8ebee] px-3 py-2">
            <LinkButton
              className="text-[11.5px]"
              onClick={async () => {
                const step = await dialogs.prompt({ title: `Add ${kind === 'CHECKLIST' ? 'checklist' : 'testing'} step`, label: 'Step' });
                if (step?.trim()) await save([{ kind, [idField]: itemId, step: step.trim() }]);
              }}
            >
              + Add {kind === 'CHECKLIST' ? 'checklist' : 'testing'} step
            </LinkButton>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function EvidenceStepInput({ row, onSave }: { row: EvidenceRow; onSave: (step: string) => void }) {
  const [text, setText] = useState(row.step);
  useEffect(() => { setText(row.step); }, [row.step]);
  return (
    <input
      className={cellInput + ' text-[#171717]'}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { if (text.trim() && text !== row.step) onSave(text.trim()); }}
    />
  );
}
