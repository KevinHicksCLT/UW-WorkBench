/**
 * Plan matrix block (Sub-tasks / Sub-task testing) for the Work Library page —
 * the numbered key/value grid of item-specific steps, drag-reorderable.
 * Generic template keys are intentionally NOT rendered here (they stay in the
 * DB and the API — this is a UI-level simplification).
 */
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { LinkButton } from '../../components/ui';
import {
  cellInput,
  useSortable,
  moveItem,
  DragHandle,
  type Answer,
  type SubjectType,
} from './shared';
import { ProcedureCells } from './ProcedureCells';

// ── Plan matrix block (Sub-tasks / Sub-task testing) ─────────────────────

export function PlanBlock({
  title,
  customRows,
  blockKind,
  subject,
  refetch,
}: {
  title: string;
  customRows: Answer[];
  blockKind: 'CHECKLIST' | 'TEST';
  subject: { type: SubjectType; id: string };
  refetch: () => void;
}) {
  const dialogs = useDialogs();
  const noun = blockKind === 'CHECKLIST' ? 'sub-task' : 'sub-task test';
  const base = `/work-library/plan/${subject.type}/${subject.id}`;
  const saveRows = (rows: Record<string, unknown>[]) =>
    api.put(`${base}/answers`, { rows }).then(refetch);
  // Drag-reorder the steps. Order is applied locally on release, then persisted.
  const [orderedCustom, setOrderedCustom] = useState<Answer[]>(customRows);
  useEffect(() => {
    setOrderedCustom(customRows);
  }, [customRows]);
  const sort = useSortable(orderedCustom.length, (from, to) => {
    const next = moveItem(orderedCustom, from, to);
    setOrderedCustom(next);
    saveRows(next.map((r, i) => ({ id: r.id, sortOrder: 100 + i })));
  });

  return (
    <div className="rounded-xl border border-[#dfe3e8] overflow-hidden mb-4 bg-white">
      <div className="px-3 py-2 bg-[#f7f8fa] border-b border-[#e5e5e5] text-[13px] font-semibold text-[#171717]">
        {title}
      </div>
      <table className="w-full table-fixed border-collapse text-[12.5px]">
        <colgroup>
          <col style={{ width: 36 }} />
          <col style={{ width: '38%' }} />
          <col />
          <col style={{ width: 40 }} />
        </colgroup>
        <tbody>
          {orderedCustom.map((r, ci) => (
            <tr key={r.id} className="border-t border-[#eef1f4]" style={sort.rowStyle(ci)}>
              <td className="border border-[#e8ebee] px-2 py-2.5 text-right align-top text-[11px] text-[#525252] whitespace-nowrap">
                <DragHandle {...sort.handleProps(ci)} />
                {ci + 1}
              </td>
              <td className="border border-[#e8ebee] px-2 py-1.5 text-left align-top">
                <CustomKeyInput
                  row={r}
                  onSave={(key) => saveRows([{ id: r.id, customKey: key }])}
                />
              </td>
              <td className="border border-[#e8ebee] px-2 py-1.5 text-left align-top">
                <ProcedureCells
                  current={r}
                  onSave={(patch) => saveRows([{ id: r.id, ...patch }])}
                />
              </td>
              <td className="border border-[#e8ebee] px-2 py-2.5 align-top text-center">
                <button
                  className="text-[#dc2626] hover:text-[#b91c1c]"
                  title={`Delete this ${noun}`}
                  onClick={() => api.delete(`${base}/answers/${r.id}`).then(refetch)}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
          <tr className="border-t border-[#eef1f4]">
            <td colSpan={4} className="border border-[#e8ebee] px-3 py-2">
              <LinkButton
                className="text-[12px]"
                onClick={async () => {
                  const step = await dialogs.prompt({ title: `Add ${noun}`, label: 'Step' });
                  if (step?.trim()) await saveRows([{ customKey: step.trim(), kind: blockKind }]);
                }}
              >
                + Add {noun}
              </LinkButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CustomKeyInput({ row, onSave }: { row: Answer; onSave: (key: string) => void }) {
  const [text, setText] = useState(row.customKey ?? '');
  useEffect(() => {
    setText(row.customKey ?? '');
  }, [row.customKey]);
  return (
    <input
      className={cellInput + ' text-[#171717]'}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text.trim() && text !== row.customKey) onSave(text.trim());
      }}
    />
  );
}
