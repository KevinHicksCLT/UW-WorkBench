/**
 * Templates editor (ADMIN) for the Work Library — add/remove/rename checklist
 * and testing templates and their generic keys, with drag-reorder that
 * propagates to every plan. Extracted verbatim from WorkLibrary.tsx.
 */
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { EmptyState, LinkButton } from '../../components/ui';
import { useSortable, moveItem, DragHandle, type Template, type TemplateKey } from './shared';

// ── Templates editor (ADMIN) ─────────────────────────────────────────────

export function TemplatesEditor({
  templates,
  refetch,
  isAdmin,
}: {
  templates: Template[];
  refetch: () => void;
  isAdmin: boolean;
}) {
  const dialogs = useDialogs();
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null);
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0] ?? null;
  const [name, setName] = useState(selected?.name ?? '');
  useEffect(() => {
    setName(selected?.name ?? '');
  }, [selected?.id, selected?.name]);
  // Drag-reorder the generic keys — the new order propagates to every plan.
  const [orderedKeys, setOrderedKeys] = useState<TemplateKey[]>(selected?.keys ?? []);
  useEffect(() => {
    setOrderedKeys(selected?.keys ?? []);
  }, [selected?.id, selected?.keys]);
  const sort = useSortable(orderedKeys.length, (from, to) => {
    if (!selected) return;
    const next = moveItem(orderedKeys, from, to);
    setOrderedKeys(next);
    api
      .put(`/work-library/templates/${selected.id}/keys/order`, { keyIds: next.map((k) => k.id) })
      .then(refetch);
  });

  if (!isAdmin)
    return (
      <div className="p-6 text-[13px] text-[#6b7785]">
        Template editing requires the ADMIN role.
      </div>
    );

  const usage = selected
    ? (selected.usage?.tasks ?? 0) +
      (selected.usage?.standards ?? 0) +
      (selected.usage?.regulations ?? 0) +
      (selected.usage?.compliance ?? 0)
    : 0;

  return (
    <div className="grid grid-cols-[240px_minmax(0,1fr)] min-h-[420px]">
      <div className="border-r border-[#e5e5e5] p-2.5 overflow-auto">
        {(['CHECKLIST', 'TEST'] as const).map((kind) => (
          <div key={kind} className="mb-2.5">
            <div className="px-1.5 py-1 text-[10.5px] font-medium text-[#8a94a0]">
              {kind === 'CHECKLIST' ? 'Checklist patterns' : 'Testing patterns'}
            </div>
            {templates
              .filter((t) => t.kind === kind)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={
                    'block w-full text-left rounded-md px-2 py-1.5 text-[12px] leading-snug ' +
                    (selected?.id === t.id
                      ? 'bg-[#eaf2fd] text-[#1d4ed8] font-medium'
                      : 'text-[#525252] hover:bg-[#fafafa]')
                  }
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
            const kind = (await dialogs.confirm({
              title: 'Template type',
              message: 'OK = Checklist pattern · Cancel = Testing pattern',
              confirmLabel: 'Checklist',
            }))
              ? 'CHECKLIST'
              : 'TEST';
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
                onBlur={() => {
                  if (name.trim() && name !== selected.name)
                    api
                      .patch(`/work-library/templates/${selected.id}`, { name: name.trim() })
                      .then(refetch);
                }}
              />
              <span className="text-[10.5px] px-2 py-0.5 rounded-full border border-[#e5e5e5] text-[#6b7785]">
                {selected.kind === 'CHECKLIST' ? 'Checklist' : 'Testing'}
              </span>
              <button
                className="text-[12px] text-[#dc2626] hover:underline"
                onClick={async () => {
                  if (
                    !(await dialogs.confirm({
                      title: `Delete "${selected.name}"?`,
                      message: `Used by ${usage} work items. Their saved values are kept; the pattern is removed from their plans.`,
                      danger: true,
                    }))
                  )
                    return;
                  await api.delete(`/work-library/templates/${selected.id}`);
                  setSelectedId(null);
                  refetch();
                }}
              >
                Delete template
              </button>
            </div>
            <div className="text-[11px] text-[#a3a3a3] mb-3">
              Used by {usage.toLocaleString()} work items · rename or edit keys and every plan using
              this pattern updates
            </div>
            <table className="w-full table-fixed border-collapse text-[12.5px]">
              <thead>
                <tr className="text-[10.5px] text-[#8a94a0]">
                  <td className="w-9 border border-[#e8ebee] bg-[#fafbfc] px-2 py-1.5"></td>
                  <td className="w-[52%] border border-[#e8ebee] bg-[#fafbfc] px-2 py-1.5 text-left">
                    Key (the question asked on every plan)
                  </td>
                  <td className="border border-[#e8ebee] bg-[#fafbfc] px-2 py-1.5 text-left">
                    Value type
                  </td>
                  <td className="w-10 border border-[#e8ebee] bg-[#fafbfc]"></td>
                </tr>
              </thead>
              <tbody>
                {orderedKeys.map((k, i) => (
                  <TemplateKeyRow
                    key={k.id}
                    k={k}
                    index={i}
                    refetch={refetch}
                    rowStyle={sort.rowStyle(i)}
                    handleProps={sort.handleProps(i)}
                  />
                ))}
                <tr>
                  <td colSpan={4} className="border border-[#e8ebee] px-2 py-2">
                    <LinkButton
                      className="text-[12px]"
                      onClick={async () => {
                        const key = await dialogs.prompt({ title: 'Add key', label: 'Key' });
                        if (key?.trim()) {
                          await api.post(`/work-library/templates/${selected.id}/keys`, {
                            key: key.trim(),
                          });
                          refetch();
                        }
                      }}
                    >
                      + Add key
                    </LinkButton>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="mt-3 pt-2 border-t border-[#eef1f4] text-[11px] text-[#a3a3a3]">
              Value type drives the combobox on plans: Free text · Application (SOR catalog) · Role
              · Deliverable
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TemplateKeyRow({
  k,
  index,
  refetch,
  rowStyle,
  handleProps,
}: {
  k: TemplateKey;
  index: number;
  refetch: () => void;
  rowStyle: React.CSSProperties;
  handleProps: React.HTMLAttributes<HTMLSpanElement>;
}) {
  const dialogs = useDialogs();
  const [text, setText] = useState(k.key);
  useEffect(() => {
    setText(k.key);
  }, [k.key]);
  return (
    <tr className="border-t border-[#eef1f4]" style={rowStyle}>
      <td className="border border-[#e8ebee] px-2 py-2 text-right text-[11px] text-[#a3a3a3] align-middle whitespace-nowrap">
        <DragHandle {...handleProps} />
        {index + 1}
      </td>
      <td className="border border-[#e8ebee] px-2 py-1.5 text-left">
        <input
          className="w-full rounded-md border border-[#e2e6ea] px-2 py-1.5 text-[12.5px] focus:border-[#7aa7d9] focus:outline-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text.trim() && text !== k.key)
              api.patch(`/work-library/keys/${k.id}`, { key: text.trim() }).then(refetch);
          }}
        />
      </td>
      <td className="border border-[#e8ebee] px-2 py-1.5 text-left">
        <select
          className="w-full rounded-md border border-[#e2e6ea] px-1.5 py-1.5 text-[12px] bg-white"
          value={k.valueKind}
          onChange={(e) =>
            api.patch(`/work-library/keys/${k.id}`, { valueKind: e.target.value }).then(refetch)
          }
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
            if (
              await dialogs.confirm({
                title: `Remove key "${k.key}"?`,
                message: 'Saved values for this key are deleted from every plan.',
                danger: true,
              })
            ) {
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
