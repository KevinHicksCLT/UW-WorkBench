import { Fragment, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { useDialogs } from '../lib/dialogs';
import { EmptyState, LinkButton, LoadingState } from '../components/ui';

// Work Library — checklist/testing plans at the atomic level of work (L5 task
// ProcessNodes, leaf Standards, Regulations) built from reusable generic
// templates. Plans view: pick a work item, choose its checklist modules + test
// pattern (dropdowns), fill the key/value matrix; generic keys are grayed and
// removable (never addable), specific steps are free. Values are entity-backed
// comboboxes (SOR → Applications, owner → Roles, …) — adding a new option
// writes the owning table. Templates view (ADMIN): add/remove/rename templates
// and their keys. Everything persists to the DB via /work-library.

type SubjectType = 'task' | 'standard' | 'regulation';

type Subject = { id: string; name: string; path: string };
type TemplateKey = { id: string; key: string; guidance: string | null; valueKind: string; sortOrder: number };
type Template = {
  id: string; kind: 'CHECKLIST' | 'TEST'; name: string; description: string | null; isDefault: boolean;
  keys: TemplateKey[]; usage?: { tasks: number; standards: number; regulations: number };
};
type EntityRef = { id: string; name: string } | null;
type Answer = {
  id: string; templateKeyId: string | null; customKey: string | null; kind: string | null; value: string | null;
  suppressed: boolean; sortOrder: number; application: EntityRef; role: EntityRef; deliverable: EntityRef;
};
type PlanKey = TemplateKey & { answer: Answer | null };
type Section = { id: string; kind: 'CHECKLIST' | 'TEST'; name: string; description: string | null; keys: PlanKey[] };
type EvidenceRow = {
  id: string; kind: string; step: string; value: string | null; sortOrder: number;
  application: EntityRef; role: EntityRef; deliverable: EntityRef;
};
type TiedItem = { id: string; name: string; source: string | null; direct: boolean; checklist: EvidenceRow[]; testing: EvidenceRow[] };
type Plan = {
  subject: { type: SubjectType; id: string; name: string; path: string };
  assignedTemplateIds: string[];
  sections: Section[];
  customRows: Answer[];
  standards: TiedItem[];
  regulations: TiedItem[];
};

const cellInput = 'w-full text-[12.5px] px-2 py-1.5 rounded-md border border-transparent hover:border-[#d4d4d4] focus:border-[#7aa7d9] focus:outline-none bg-transparent';

// Pointer-based row reorder with live animation: grab the ⋮⋮ handle and the
// row follows the cursor while the other rows slide out of the way; on release
// the new order is applied optimistically and persisted. (Pointer events, not
// HTML5 drag — so it animates and row inputs keep normal text selection.)
type SortState = { from: number; over: number; dy: number; rowH: number };

function useSortable(count: number, onMove: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<SortState | null>(null);
  const live = useRef<SortState | null>(null);

  const handleProps = (index: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const tr = (e.target as HTMLElement).closest('tr');
      const rowH = tr?.getBoundingClientRect().height || 40;
      const startY = e.clientY;
      live.current = { from: index, over: index, dy: 0, rowH };
      setDrag(live.current);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      const move = (ev: PointerEvent) => {
        const dy = ev.clientY - startY;
        const over = Math.max(0, Math.min(count - 1, index + Math.round(dy / rowH)));
        live.current = { from: index, over, dy, rowH };
        setDrag(live.current);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        const d = live.current;
        live.current = null;
        setDrag(null);
        if (d && d.over !== d.from) onMove(d.from, d.over);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
  });

  const rowStyle = (index: number): React.CSSProperties => {
    if (!drag) return {};
    const { from, over, dy, rowH } = drag;
    if (index === from) {
      return { transform: `translateY(${dy}px)`, position: 'relative', zIndex: 5, background: '#f0f6ff', boxShadow: '0 2px 10px rgba(15,40,80,0.15)', transition: 'none' };
    }
    if (from < over && index > from && index <= over) return { transform: `translateY(-${rowH}px)`, transition: 'transform 140ms ease' };
    if (from > over && index >= over && index < from) return { transform: `translateY(${rowH}px)`, transition: 'transform 140ms ease' };
    return { transform: 'translateY(0)', transition: 'transform 140ms ease' };
  };

  return { handleProps, rowStyle };
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

const DragHandle = (props: React.HTMLAttributes<HTMLSpanElement>) => (
  <span {...props} className="cursor-grab touch-none select-none mr-1.5 text-[#94a3b8] hover:text-[#475569]" title="Drag to reorder">⋮⋮</span>
);

function valueText(a: Answer | EvidenceRow | null | undefined): string {
  if (!a) return '';
  return a.application?.name ?? a.role?.name ?? a.deliverable?.name ?? a.value ?? '';
}

// ── Entity-backed value combobox ─────────────────────────────────────────

function ValueCell({ valueKind, current, onSave }: {
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
      api.get(`/work-library/options?kind=${valueKind}&q=${encodeURIComponent(text)}`)
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

function PatternDropdown({ label, templates, selectedIds, multi, onChange }: {
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

// ── Plan matrix block (Checklist / Testing) ──────────────────────────────

function PlanBlock({ title, sections, customRows, blockKind, subject, refetch }: {
  title: string;
  sections: Section[];
  customRows: Answer[];
  blockKind: 'CHECKLIST' | 'TEST';
  subject: { type: SubjectType; id: string };
  refetch: () => void;
}) {
  const dialogs = useDialogs();
  const base = `/work-library/plan/${subject.type}/${subject.id}`;
  const saveRows = (rows: Record<string, unknown>[]) => api.put(`${base}/answers`, { rows }).then(refetch);
  // Drag-reorder the item-specific steps (generic order comes from the template
  // and is reordered in the Templates tab, propagating everywhere). Order is
  // applied locally on release, then persisted.
  const [orderedCustom, setOrderedCustom] = useState<Answer[]>(customRows);
  useEffect(() => { setOrderedCustom(customRows); }, [customRows]);
  const sort = useSortable(orderedCustom.length, (from, to) => {
    const next = moveItem(orderedCustom, from, to);
    setOrderedCustom(next);
    saveRows(next.map((r, i) => ({ id: r.id, sortOrder: 100 + i })));
  });

  let n = 0;
  return (
    <div className="rounded-xl border border-[#dfe3e8] overflow-hidden mb-4 bg-white">
      <div className="px-3 py-2 bg-[#f7f8fa] border-b border-[#e5e5e5] text-[13px] font-semibold text-[#171717]">{title}</div>
      <table className="w-full table-fixed border-collapse text-[12.5px]">
        <colgroup><col style={{ width: 36 }} /><col style={{ width: '38%' }} /><col /><col style={{ width: 40 }} /></colgroup>
        <tbody>
          {sections.map((s) => (
            <Fragment key={s.id}>
              {sections.length > 1 && (
                <tr>
                  <td colSpan={4} className="border border-[#e8ebee] bg-[#fafbfc] px-3 py-2 text-left text-[11px] font-medium text-[#8a94a0]">{s.name}</td>
                </tr>
              )}
              {s.keys.map((k) => {
                const suppressed = k.answer?.suppressed;
                if (!suppressed) n += 1;
                const num = n;
                return (
                  <tr key={k.id} className="border-t border-[#eef1f4]">
                    <td className="border border-[#e8ebee] px-2 py-2.5 text-right align-top text-[11px] text-[#a3a3a3]">{suppressed ? '' : num}</td>
                    <td className={'border border-[#e8ebee] px-3 py-2.5 text-left align-top ' + (suppressed ? 'text-[#c0c6cc] line-through' : 'text-[#8a94a0]')}>
                      {k.key}
                    </td>
                    <td className="border border-[#e8ebee] px-2 py-1.5 text-left align-top">
                      {suppressed ? (
                        <span className="text-[11px] text-[#a3a3a3] px-2 py-1.5 inline-block">Removed for this item</span>
                      ) : (
                        <ValueCell
                          valueKind={k.valueKind}
                          current={k.answer}
                          onSave={(patch) => saveRows([{ templateKeyId: k.id, ...patch }])}
                        />
                      )}
                    </td>
                    <td className="border border-[#e8ebee] px-2 py-2.5 align-top text-center">
                      {suppressed ? (
                        <button
                          className="text-[11px] text-[#1d4ed8]"
                          onClick={() => saveRows([{ templateKeyId: k.id, suppressed: false }])}
                        >
                          restore
                        </button>
                      ) : (
                        <button
                          className="text-[#dc2626] hover:text-[#b91c1c]"
                          title="Remove this generic step for this item"
                          onClick={() => saveRows([{ templateKeyId: k.id, suppressed: true }])}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
          {orderedCustom.map((r, ci) => {
            n += 1;
            const num = n;
            return (
              <tr key={r.id} className="border-t border-[#eef1f4]" style={sort.rowStyle(ci)}>
                <td className="border border-[#e8ebee] px-2 py-2.5 text-right align-top text-[11px] text-[#a3a3a3] whitespace-nowrap"><DragHandle {...sort.handleProps(ci)} />{num}</td>
                <td className="border border-[#e8ebee] px-2 py-1.5 text-left align-top">
                  <CustomKeyInput row={r} onSave={(key) => saveRows([{ id: r.id, customKey: key }])} />
                </td>
                <td className="border border-[#e8ebee] px-2 py-1.5 text-left align-top">
                  <ValueCell valueKind="TEXT" current={r} onSave={(patch) => saveRows([{ id: r.id, ...patch }])} />
                </td>
                <td className="border border-[#e8ebee] px-2 py-2.5 align-top text-center">
                  <button
                    className="text-[#dc2626] hover:text-[#b91c1c]"
                    title="Delete this specific step"
                    onClick={() => api.delete(`${base}/answers/${r.id}`).then(refetch)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-[#eef1f4]">
            <td colSpan={4} className="border border-[#e8ebee] px-3 py-2">
              <LinkButton
                className="text-[12px]"
                onClick={async () => {
                  const step = await dialogs.prompt({ title: 'Add specific step', label: 'Step' });
                  if (step?.trim()) await saveRows([{ customKey: step.trim(), kind: blockKind }]);
                }}
              >
                + Add specific step
              </LinkButton>
              <span className="text-[10.5px] text-[#a3a3a3] ml-2.5">Generic steps come from the pattern — removable, not addable</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CustomKeyInput({ row, onSave }: { row: Answer; onSave: (key: string) => void }) {
  const [text, setText] = useState(row.customKey ?? '');
  useEffect(() => { setText(row.customKey ?? ''); }, [row.customKey]);
  return (
    <input
      className={cellInput + ' text-[#171717]'}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { if (text.trim() && text !== row.customKey) onSave(text.trim()); }}
    />
  );
}

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

function TiedBlock({ title, empty, items, scope, taskId, refetch }: {
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

// ── Templates editor (ADMIN) ─────────────────────────────────────────────

function TemplatesEditor({ templates, refetch, isAdmin }: { templates: Template[]; refetch: () => void; isAdmin: boolean }) {
  const dialogs = useDialogs();
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null);
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0] ?? null;
  const [name, setName] = useState(selected?.name ?? '');
  useEffect(() => { setName(selected?.name ?? ''); }, [selected?.id, selected?.name]);
  // Drag-reorder the generic keys — the new order propagates to every plan.
  const [orderedKeys, setOrderedKeys] = useState<TemplateKey[]>(selected?.keys ?? []);
  useEffect(() => { setOrderedKeys(selected?.keys ?? []); }, [selected?.id, selected?.keys]);
  const sort = useSortable(orderedKeys.length, (from, to) => {
    if (!selected) return;
    const next = moveItem(orderedKeys, from, to);
    setOrderedKeys(next);
    api.put(`/work-library/templates/${selected.id}/keys/order`, { keyIds: next.map((k) => k.id) }).then(refetch);
  });

  if (!isAdmin) return <div className="p-6 text-[13px] text-[#6b7785]">Template editing requires the ADMIN role.</div>;

  const usage = selected ? (selected.usage?.tasks ?? 0) + (selected.usage?.standards ?? 0) + (selected.usage?.regulations ?? 0) : 0;

  return (
    <div className="grid grid-cols-[240px_minmax(0,1fr)] min-h-[420px]">
      <div className="border-r border-[#e5e5e5] p-2.5 overflow-auto">
        {(['CHECKLIST', 'TEST'] as const).map((kind) => (
          <div key={kind} className="mb-2.5">
            <div className="px-1.5 py-1 text-[10.5px] font-medium text-[#8a94a0]">
              {kind === 'CHECKLIST' ? 'Checklist patterns' : 'Testing patterns'}
            </div>
            {templates.filter((t) => t.kind === kind).map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={'block w-full text-left rounded-md px-2 py-1.5 text-[12px] leading-snug ' +
                  (selected?.id === t.id ? 'bg-[#eaf2fd] text-[#1d4ed8] font-medium' : 'text-[#525252] hover:bg-[#fafafa]')}
              >
                {t.name} <span className="text-[10px] text-[#a3a3a3]">{t.keys.length}</span>
              </button>
            ))}
          </div>
        ))}
        <button
          className="w-full rounded-md border border-[#d4d4d4] px-2 py-1.5 text-[12px] text-[#525252] hover:bg-[#fafafa]"
          onClick={async () => {
            const n = await dialogs.prompt({ title: 'New template', label: 'Name' });
            if (!n?.trim()) return;
            const kind = (await dialogs.confirm({ title: 'Template type', message: 'OK = Checklist pattern · Cancel = Testing pattern', confirmLabel: 'Checklist' })) ? 'CHECKLIST' : 'TEST';
            const d = await api.post('/work-library/templates', { kind, name: n.trim() });
            refetch();
            setSelectedId(d.template.id);
          }}
        >
          + New template
        </button>
      </div>
      <div className="p-4">
        {!selected ? (
          <EmptyState baseClassName="text-[13px] text-[#a3a3a3]" message="Select a template." />
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <input
                className="flex-1 rounded-md border border-[#d4d4d4] px-2.5 py-1.5 text-[13px] font-medium"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => { if (name.trim() && name !== selected.name) api.patch(`/work-library/templates/${selected.id}`, { name: name.trim() }).then(refetch); }}
              />
              <span className="text-[10.5px] px-2 py-0.5 rounded-full border border-[#e5e5e5] text-[#6b7785]">
                {selected.kind === 'CHECKLIST' ? 'Checklist' : 'Testing'}
              </span>
              <button
                className="text-[12px] text-[#dc2626] hover:underline"
                onClick={async () => {
                  if (!(await dialogs.confirm({ title: `Delete "${selected.name}"?`, message: `Used by ${usage} work items. Their saved values are kept; the pattern is removed from their plans.`, danger: true }))) return;
                  await api.delete(`/work-library/templates/${selected.id}`);
                  setSelectedId(null);
                  refetch();
                }}
              >
                Delete template
              </button>
            </div>
            <div className="text-[11px] text-[#a3a3a3] mb-3">
              Used by {usage.toLocaleString()} work items · rename or edit keys and every plan using this pattern updates
            </div>
            <table className="w-full table-fixed border-collapse text-[12.5px]">
              <thead>
                <tr className="text-[10.5px] text-[#8a94a0]">
                  <td className="w-9 border border-[#e8ebee] bg-[#fafbfc] px-2 py-1.5"></td>
                  <td className="w-[52%] border border-[#e8ebee] bg-[#fafbfc] px-2 py-1.5 text-left">Key (the question asked on every plan)</td>
                  <td className="border border-[#e8ebee] bg-[#fafbfc] px-2 py-1.5 text-left">Value type</td>
                  <td className="w-10 border border-[#e8ebee] bg-[#fafbfc]"></td>
                </tr>
              </thead>
              <tbody>
                {orderedKeys.map((k, i) => (
                  <TemplateKeyRow key={k.id} k={k} index={i} refetch={refetch} rowStyle={sort.rowStyle(i)} handleProps={sort.handleProps(i)} />
                ))}
                <tr>
                  <td colSpan={4} className="border border-[#e8ebee] px-2 py-2">
                    <LinkButton
                      className="text-[12px]"
                      onClick={async () => {
                        const key = await dialogs.prompt({ title: 'Add key', label: 'Key' });
                        if (key?.trim()) { await api.post(`/work-library/templates/${selected.id}/keys`, { key: key.trim() }); refetch(); }
                      }}
                    >
                      + Add key
                    </LinkButton>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="mt-3 pt-2 border-t border-[#eef1f4] text-[11px] text-[#a3a3a3]">
              Value type drives the combobox on plans: Free text · Application (SOR catalog) · Role · Deliverable
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TemplateKeyRow({ k, index, refetch, rowStyle, handleProps }: {
  k: TemplateKey; index: number; refetch: () => void;
  rowStyle: React.CSSProperties;
  handleProps: React.HTMLAttributes<HTMLSpanElement>;
}) {
  const dialogs = useDialogs();
  const [text, setText] = useState(k.key);
  useEffect(() => { setText(k.key); }, [k.key]);
  return (
    <tr className="border-t border-[#eef1f4]" style={rowStyle}>
      <td className="border border-[#e8ebee] px-2 py-2 text-right text-[11px] text-[#a3a3a3] align-middle whitespace-nowrap"><DragHandle {...handleProps} />{index + 1}</td>
      <td className="border border-[#e8ebee] px-2 py-1.5 text-left">
        <input
          className="w-full rounded-md border border-[#e2e6ea] px-2 py-1.5 text-[12.5px] focus:border-[#7aa7d9] focus:outline-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => { if (text.trim() && text !== k.key) api.patch(`/work-library/keys/${k.id}`, { key: text.trim() }).then(refetch); }}
        />
      </td>
      <td className="border border-[#e8ebee] px-2 py-1.5 text-left">
        <select
          className="w-full rounded-md border border-[#e2e6ea] px-1.5 py-1.5 text-[12px] bg-white"
          value={k.valueKind}
          onChange={(e) => api.patch(`/work-library/keys/${k.id}`, { valueKind: e.target.value }).then(refetch)}
        >
          <option value="TEXT">Free text</option>
          <option value="APPLICATION">Application (SOR)</option>
          <option value="ROLE">Role</option>
          <option value="DELIVERABLE">Deliverable</option>
        </select>
      </td>
      <td className="border border-[#e8ebee] px-2 py-1.5 text-center">
        <button
          className="text-[#dc2626] hover:text-[#b91c1c]"
          onClick={async () => {
            if (await dialogs.confirm({ title: `Remove key "${k.key}"?`, message: 'Saved values for this key are deleted from every plan.', danger: true })) {
              await api.delete(`/work-library/keys/${k.id}`);
              refetch();
            }
          }}
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function WorkLibrary() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'templates' ? 'templates' : 'plans';
  const type = (params.get('type') as SubjectType) || 'task';
  const selectedId = params.get('id');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), 250); return () => clearTimeout(t); }, [q]);

  const missingOnly = params.get('missing') === 'test';
  const { data: templatesData, refetch: refetchTemplates } = useApi<{ templates: Template[] }>('/work-library/templates');
  const { data: subjectsData, loading: subjectsLoading } = useApi<{ subjects: Subject[]; meta?: { total: number; missingTest: number } }>(
    `/work-library/subjects?type=${type}&q=${encodeURIComponent(debouncedQ)}${missingOnly && type === 'task' ? '&missing=test' : ''}`
  );
  const { data: plan, refetch: refetchPlan } = useApi<Plan>(selectedId ? `/work-library/plan/${type}/${selectedId}` : null);

  const templates = templatesData?.templates ?? [];
  const checklistTemplates = templates.filter((t) => t.kind === 'CHECKLIST');
  const testTemplates = templates.filter((t) => t.kind === 'TEST');

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v === null) next.delete(k); else next.set(k, v); }
    setParams(next, { replace: true });
  };

  // Optimistic pattern selection — the dropdowns reflect a toggle instantly
  // while the PUT + plan refetch land in the background.
  const [optimisticIds, setOptimisticIds] = useState<string[] | null>(null);
  useEffect(() => { setOptimisticIds(null); }, [selectedId]);
  const assigned = optimisticIds ?? plan?.assignedTemplateIds ?? [];
  const assignedChecklist = checklistTemplates.filter((t) => assigned.includes(t.id)).map((t) => t.id);
  const assignedTest = testTemplates.filter((t) => assigned.includes(t.id)).map((t) => t.id);

  const saveAssignments = (checklistIds: string[], testIds: string[]) => {
    if (!plan) return;
    const core = checklistTemplates.find((t) => t.isDefault);
    const ids = [...new Set([...(core ? [core.id] : []), ...checklistIds, ...testIds])];
    setOptimisticIds(ids);
    api.put(`/work-library/plan/${plan.subject.type}/${plan.subject.id}/templates`, { templateIds: ids })
      .then(() => refetchPlan())
      .finally(() => setOptimisticIds(null));
  };

  const checklistSections = plan?.sections.filter((s) => s.kind === 'CHECKLIST') ?? [];
  const testSections = plan?.sections.filter((s) => s.kind === 'TEST') ?? [];
  const checklistCustom = plan?.customRows.filter((r) => r.kind !== 'TEST') ?? [];
  const testCustom = plan?.customRows.filter((r) => r.kind === 'TEST') ?? [];

  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-[17px] font-semibold text-[#171717]">Work Library</h1>
        <div className="flex gap-0.5 rounded-lg bg-[#f0f1f3] p-0.5">
          {(['plans', 'templates'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setParam({ view: v === 'plans' ? null : v })}
              className={'px-3 py-1 rounded-md text-[12px] ' + (view === v ? 'bg-white border border-[#e5e5e5] font-medium text-[#171717]' : 'text-[#6b7785]')}
            >
              {v === 'plans' ? 'Plans' : 'Templates'}
            </button>
          ))}
        </div>
        {view === 'templates' && (
          <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-[#eaf2fd] text-[#1d4ed8]">Admin only</span>
        )}
      </div>

      <div className="rounded-2xl border border-[#e5e5e5] bg-white overflow-hidden">
        {view === 'templates' ? (
          <TemplatesEditor templates={templates} refetch={refetchTemplates} isAdmin={user?.role === 'ADMIN'} />
        ) : (
          <div className="grid grid-cols-[250px_minmax(0,1fr)] min-h-[480px]">
            <div className="border-r border-[#e5e5e5] p-2.5 overflow-auto">
              <div className="flex gap-0.5 rounded-md bg-[#f0f1f3] p-0.5 mb-2">
                {(['task', 'standard', 'regulation'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setParam({ type: t, id: null })}
                    className={'flex-1 py-1 rounded text-[11px] ' + (type === t ? 'bg-white border border-[#e5e5e5] font-medium text-[#171717]' : 'text-[#6b7785]')}
                  >
                    {t === 'task' ? 'Tasks' : t === 'standard' ? 'Standards' : 'Regs'}
                  </button>
                ))}
              </div>
              <input
                className="w-full rounded-md border border-[#e2e6ea] px-2 py-1.5 text-[12px] mb-2 focus:border-[#7aa7d9] focus:outline-none"
                placeholder={`Search ${type === 'task' ? 'tasks' : type === 'standard' ? 'standards' : 'regulations'}`}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {type === 'task' && subjectsData?.meta && (
                <button
                  onClick={() => setParam({ missing: missingOnly ? null : 'test', id: null })}
                  className={'w-full mb-2 rounded-md px-2 py-1.5 text-[11px] text-left border ' +
                    (missingOnly ? 'border-[#f0b4b4] bg-[#fdf2f2] text-[#b91c1c] font-medium' : 'border-[#e2e6ea] text-[#6b7785] hover:bg-[#fafafa]')}
                >
                  ✗ Missing testing pattern · {subjectsData.meta.missingTest.toLocaleString()} of {subjectsData.meta.total.toLocaleString()}
                  {missingOnly && <span className="float-right">clear</span>}
                </button>
              )}
              {subjectsLoading && <LoadingState baseClassName="px-1.5 py-1 text-[11px] text-[#a3a3a3]" />}
              {(subjectsData?.subjects ?? []).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setParam({ id: s.id })}
                  className={'block w-full text-left rounded-md px-2 py-1.5 mb-0.5 text-[12px] leading-snug ' +
                    (selectedId === s.id ? 'bg-[#eaf2fd] text-[#1d4ed8] font-medium' : 'text-[#525252] hover:bg-[#fafafa]')}
                >
                  {s.name}
                  {s.path && <span className="block text-[10px] text-[#a3a3a3]">{s.path}</span>}
                </button>
              ))}
            </div>
            <div className="p-4 overflow-auto">
              {!plan ? (
                <LoadingState
                  baseClassName="text-[13px] text-[#a3a3a3] pt-6 text-center"
                  message={selectedId ? 'Loading plan…' : 'Pick a work item to open its checklist and testing plan.'}
                />
              ) : (
                <>
                  <div className="mb-3">
                    <div className="text-[14px] font-semibold text-[#171717]">{plan.subject.name}</div>
                    {plan.subject.path && <div className="text-[11px] text-[#8a94a0]">{plan.subject.path}</div>}
                  </div>
                  <div className="flex flex-wrap gap-4 mb-4">
                    <PatternDropdown
                      label="Checklist pattern"
                      templates={checklistTemplates}
                      selectedIds={assignedChecklist}
                      multi
                      onChange={(ids) => saveAssignments(ids, assignedTest)}
                    />
                    <div>
                      <PatternDropdown
                        label="Testing pattern"
                        templates={testTemplates}
                        selectedIds={assignedTest}
                        multi={false}
                        onChange={(ids) => saveAssignments(assignedChecklist, ids)}
                      />
                      <div className="text-[10.5px] text-[#a3a3a3] mt-1">Switching patterns keeps saved values per item</div>
                    </div>
                  </div>
                  <PlanBlock
                    title="Checklist"
                    sections={checklistSections}
                    customRows={checklistCustom}
                    blockKind="CHECKLIST"
                    subject={plan.subject}
                    refetch={refetchPlan}
                  />
                  <PlanBlock
                    title="Testing"
                    sections={testSections}
                    customRows={testCustom}
                    blockKind="TEST"
                    subject={plan.subject}
                    refetch={refetchPlan}
                  />
                  {plan.subject.type === 'task' && (
                    <>
                      <TiedBlock
                        title="Standards tied to this task"
                        empty="No standards tied yet — use the picker above to tie one."
                        items={plan.standards}
                        scope="standard"
                        taskId={plan.subject.id}
                        refetch={refetchPlan}
                      />
                      <TiedBlock
                        title="Regulations tied to this task"
                        empty="No regulations tied yet — use the picker above to tie one."
                        items={plan.regulations}
                        scope="regulation"
                        taskId={plan.subject.id}
                        refetch={refetchPlan}
                      />
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
