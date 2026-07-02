/**
 * Plan matrix block (Checklist / Testing) for the Work Library page — the
 * key/value grid with suppressible generic keys and drag-reorderable
 * item-specific steps. Extracted verbatim from WorkLibrary.tsx.
 */
import { Fragment, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { LinkButton } from '../../components/ui';
import { cellInput, useSortable, moveItem, DragHandle, type Answer, type Section, type SubjectType } from './shared';
import { ValueCell } from './controls';

// ── Plan matrix block (Checklist / Testing) ──────────────────────────────

export function PlanBlock({ title, sections, customRows, blockKind, subject, refetch }: {
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
