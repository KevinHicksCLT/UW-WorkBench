import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { fieldLabel } from '../lib/adminFormat';
import type { AdminEntity, AdminField } from '../lib/adminTypes';
import { Button, ErrorMessage, Input, Label, Select, Textarea } from './ui';

// Auto-generated create/edit form for a single admin entity. Renders one input
// per editable field (type derived from the registry); FK fields become a
// <select> populated from the related entity's list.

type Props = {
  entity: AdminEntity;
  companyId: string | null; // active company — scopes writes + FK option lists
  record: Record<string, unknown> | null; // null = create
  fixed?: Record<string, unknown>; // values injected + hidden (e.g. a parent FK in master-detail)
  defaults?: Record<string, string | boolean>; // prefilled-but-editable values on create (e.g. role name in keyRoles)
  onClose: () => void;
  onSaved: () => void;
};

type Option = { id: string; label: string };

function withCompany(path: string, companyId: string | null) {
  if (!companyId) return path;
  return path + (path.includes('?') ? '&' : '?') + `companyId=${companyId}`;
}

function initialValue(field: AdminField, record: Record<string, unknown> | null) {
  const v = record ? record[field.name] : undefined;
  if (field.kind === 'boolean') return Boolean(v);
  if (v === null || v === undefined) return '';
  if (field.kind === 'datetime') {
    // ISO → value accepted by <input type="datetime-local"> (local, no seconds)
    const d = new Date(v as string | number | Date);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return String(v);
}

export default function EntityForm({ entity, companyId, record, fixed, defaults, onClose, onSaved }: Props) {
  // Fields actually shown in the form: skip derived (readonly) fields and skip
  // create-only fields when editing. A field supplied via `fixed` (e.g. the
  // parent FK in a master-detail child form) is preset + hidden on CREATE, but
  // shown when EDITING so an existing row can be moved to a different parent.
  const fixedKeys = fixed ? new Set(Object.keys(fixed)) : new Set<string>();
  const formFields = entity.fields.filter(
    (f) => !f.readonly && !(f.createOnly && record) && !(fixedKeys.has(f.name) && !record),
  );

  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const f of formFields) init[f.name] = initialValue(f, record);
    // On create, apply editable defaults for any field the caller prefilled.
    if (!record && defaults) for (const k of Object.keys(defaults)) if (k in init) init[k] = defaults[k];
    return init;
  });
  const [fkOptions, setFkOptions] = useState<Record<string, Option[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load options for every FK field on this form.
  useEffect(() => {
    const fkFields = formFields.filter((f) => f.relation);
    let active = true;
    Promise.all(
      fkFields.map(async (f) => {
        const rel = f.relation!;
        // Scope FK options to the active company so you can only link in-company
        // records (the Company table ignores the param server-side).
        const res = await api.get(withCompany(`/admin/${rel.entity}?limit=200`, companyId));
        const opts: Option[] = res.rows.map((r: Record<string, unknown>) => ({ id: r.id as string, label: String(r[rel.labelField] ?? r.id) }));
        return [f.name, opts] as const;
      }),
    )
      .then((pairs) => { if (active) setFkOptions(Object.fromEntries(pairs)); })
      .catch(() => {});
    return () => { active = false; };
  }, [entity.slug, companyId]);

  const set = (name: string, v: string | boolean) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      // `fixed` presets only apply on create — on edit the same fields are
      // visible in the form, so the user's choice (a move) must win.
      const payload = record ? { ...values } : { ...values, ...(fixed ?? {}) };
      if (record) await api.patch(withCompany(`/admin/${entity.slug}/${record.id}`, companyId), payload);
      else await api.post(withCompany(`/admin/${entity.slug}`, companyId), payload);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md h-full bg-white border-l border-[#eaeaea] shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 h-14 border-b border-[#eaeaea] flex-shrink-0">
          <h2 className="text-sm font-semibold text-[#171717]">
            {record ? 'Edit' : 'New'} {entity.label}
          </h2>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-[#171717]" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <form id="entity-form" onSubmit={submit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {formFields.map((f) => (
            <div key={f.name}>
              <Label htmlFor={`f-${f.name}`}>
                {fieldLabel(entity.slug, f.name)}{f.required && <span className="text-[#be123c]"> *</span>}
                {f.relation && <span className="text-[#a3a3a3] font-normal normal-case tracking-normal"> → {f.relation.entity}</span>}
              </Label>

              {f.relation ? (
                <Select
                  id={`f-${f.name}`}
                  value={values[f.name] as string}
                  required={f.required}
                  onChange={(e) => set(f.name, e.target.value)}
                >
                  <option value="">{f.required ? 'Select…' : '— none —'}</option>
                  {(fkOptions[f.name] ?? []).map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </Select>
              ) : f.kind === 'boolean' ? (
                <label className="inline-flex items-center gap-2 text-sm text-[#171717]">
                  <input
                    id={`f-${f.name}`}
                    type="checkbox"
                    checked={Boolean(values[f.name])}
                    onChange={(e) => set(f.name, e.target.checked)}
                    className="h-4 w-4 rounded border-[#d4d4d4]"
                  />
                  {values[f.name] ? 'true' : 'false'}
                </label>
              ) : f.multiline ? (
                <Textarea
                  id={`f-${f.name}`}
                  className="min-h-[80px]"
                  value={values[f.name] as string}
                  required={f.required}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              ) : (
                <Input
                  id={`f-${f.name}`}
                  type={f.kind === 'int' || f.kind === 'float' ? 'number' : f.kind === 'datetime' ? 'datetime-local' : 'text'}
                  step={f.kind === 'float' ? 'any' : undefined}
                  value={values[f.name] as string}
                  required={f.required}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
            </div>
          ))}
        </form>

        <div className="flex-shrink-0 border-t border-[#eaeaea] px-5 py-3 space-y-2">
          {error && <ErrorMessage baseClassName="text-xs text-[#be123c]">{error}</ErrorMessage>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" form="entity-form" disabled={saving} className="disabled:opacity-50">
              {saving ? 'Saving…' : record ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
