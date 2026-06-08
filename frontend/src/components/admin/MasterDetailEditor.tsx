import { useState } from 'react';
import EntityList from './EntityList';
import EntityForm from '../EntityForm';
import type { AdminEntity } from '../../lib/adminTypes';

// Master-detail editor: a selectable parent list on the left, and on the right
// the selected parent's own edit affordance plus one or more child collections
// (each filtered to the parent and pre-linked on create). This is the right shape
// for Standards (area → items), Deliverables (deliverable → tasks), and any
// "container + line items" data — far clearer than two disconnected flat tables.

export type ChildSpec = {
  entity: AdminEntity;
  fkField: string; // child field that points back to the parent id
  title?: string;
  newLabel?: string;
};

type Props = {
  companyId: string | null;
  parent: AdminEntity;
  parentTitle?: string;
  childSpecs: ChildSpec[];
  intro?: string;
};

export default function MasterDetailEditor({ companyId, parent, parentTitle, childSpecs, intro }: Props) {
  const [selected, setSelected] = useState<Record<string, any> | null>(null);
  const [editingParent, setEditingParent] = useState(false);
  const [parentRefresh, setParentRefresh] = useState(0);

  const label = (row: Record<string, any>) => row[parent.labelField] ?? row.id;

  return (
    <div>
      {intro && <p className="text-sm text-[#666666] mb-4 max-w-2xl">{intro}</p>}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Parent list — bounded + scrollable so the detail pane stays in view. */}
        <div className="lg:w-[40%] flex-shrink-0 lg:sticky lg:top-2">
          <EntityList
            key={parentRefresh}
            entity={parent}
            companyId={companyId}
            title={parentTitle ?? parent.label}
            selectable
            selectedId={selected?.id ?? null}
            onSelect={(row) => setSelected(row)}
            onChanged={() => setParentRefresh((n) => n + 1)}
            dense
            bodyMaxHeight="60vh"
          />
        </div>

        {/* Detail pane */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="card-elevated p-10 text-center text-sm text-[#a3a3a3]">
              Select a {parent.label.toLowerCase()} on the left to edit it and manage its items.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="card p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{parent.label}</div>
                  <div className="text-base font-semibold text-[#171717] truncate">{label(selected)}</div>
                </div>
                <button className="btn-secondary flex-shrink-0" onClick={() => setEditingParent(true)}>Edit {parent.label.toLowerCase()}</button>
              </div>

              {childSpecs.map((spec) => (
                <div key={spec.entity.slug}>
                  <EntityList
                    entity={spec.entity}
                    companyId={companyId}
                    title={spec.title ?? spec.entity.label}
                    newLabel={spec.newLabel}
                    fixed={{ [spec.fkField]: selected.id }}
                    filter={(r) => r[spec.fkField] === selected.id}
                    emptyHint={`No ${(spec.title ?? spec.entity.label).toLowerCase()} yet — add one.`}
                    dense
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingParent && selected && (
        <EntityForm
          entity={parent}
          companyId={companyId}
          record={selected}
          onClose={() => setEditingParent(false)}
          onSaved={() => { setEditingParent(false); setParentRefresh((n) => n + 1); }}
        />
      )}
    </div>
  );
}
