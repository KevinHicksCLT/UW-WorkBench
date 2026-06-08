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
  const label = entity.fields.find((f) => f.name === entity.labelField);
  const rest = entity.fields
    .filter((f) => f.name !== entity.labelField && !f.relation && !f.multiline)
    .slice(0, 4);
  return [label, ...rest].filter(Boolean) as AdminField[];
}
