import type { AdminEntity, AdminField } from './adminTypes';

// Shared display helpers for the Data Admin console.

// valueStreamId → "Value Stream"; email → "Email".
export function humanize(name: string): string {
  return name
    .replace(/Id$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

// Per-entity field-label overrides where the raw column name reads poorly in
// the UI (defect backlog 02, D12.4: checklist "Text" → "Description").
const FIELD_LABELS: Record<string, Record<string, string>> = {
  checklistItem: { text: 'Description' },
  roleTask: { text: 'Description' },
};

// Columns kept in the DB but dropped from the admin record tables.
const HIDDEN_LIST_COLUMNS: Record<string, string[]> = {
  checklistItem: ['crossRole'],
};

export function fieldLabel(entitySlug: string, fieldName: string): string {
  return FIELD_LABELS[entitySlug]?.[fieldName] ?? humanize(fieldName);
}

export function cellText(field: { kind: string }, v: any): string {
  if (v === null || v === undefined || v === '') return '—';
  if (field.kind === 'boolean') return v ? '✓' : '–';
  if (field.kind === 'datetime') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
  }
  const s = String(v);
  return s.length > 48 ? s.slice(0, 47) + '…' : s;
}

// Columns shown in a record table: label field first, then a few short scalars.
export function pickColumns(entity: AdminEntity): AdminField[] {
  const hidden = HIDDEN_LIST_COLUMNS[entity.slug] ?? [];
  const label = entity.fields.find((f) => f.name === entity.labelField);
  const rest = entity.fields
    .filter((f) => f.name !== entity.labelField && !f.relation && !f.multiline && !hidden.includes(f.name))
    .slice(0, 4);
  return [label, ...rest].filter(Boolean) as AdminField[];
}
