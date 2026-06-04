// Mirror of the backend admin registry shape (GET /admin/_meta). Kept in sync
// with backend/src/lib/adminRegistry.ts.

export type FieldKind = 'string' | 'int' | 'float' | 'boolean' | 'datetime';

export type AdminField = {
  name: string;
  kind: FieldKind;
  required: boolean;
  multiline: boolean;
  readonly?: boolean; // derived — shown in the list, not editable in the form
  createOnly?: boolean; // editable only when creating
  relation?: { entity: string; labelField: string };
};

export type AdminEntity = {
  slug: string;
  model: string;
  label: string;
  labelField: string;
  fields: AdminField[];
  group?: string; // sidebar section (entities arrive pre-ordered by group)
};

export type ListResponse = {
  rows: Record<string, any>[];
  total: number;
  limit: number;
  offset: number;
};
