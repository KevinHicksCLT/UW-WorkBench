import { Prisma } from '@prisma/client';
import { LEVEL_ENTITIES } from './valueStreamAdmin.js';

// ─── Generic admin registry ─────────────────────────────────────────────
// Derives editable-entity metadata directly from Prisma's DMMF (the runtime
// description of schema.prisma). Adding a column or a whole model to the schema
// surfaces it here automatically — no per-entity config to maintain. This is
// what makes the admin console "fully configurable".

export type FieldKind = 'string' | 'int' | 'float' | 'boolean' | 'datetime';

export type AdminField = {
  name: string;
  kind: FieldKind;
  required: boolean; // must be supplied on create (no default, not nullable)
  nullable?: boolean; // the DB column accepts NULL. When false, an empty value is
                      // OMITTED on write (so a non-null column's default applies)
                      // rather than sent as null — which Prisma would reject.
  multiline: boolean; // render as a textarea (long-form text)
  readonly?: boolean; // derived value — shown in the list, not editable in the form
  createOnly?: boolean; // editable only when creating (e.g. structural parent link)
  relation?: { entity: string; labelField: string }; // FK scalar → target entity slug
};

// How an entity is tied to a Company. `direct` = the table has its own
// `companyId` column (auto-set on create). `relation` = it inherits company
// through a parent FK (e.g. ChecklistItem → role → company). `null` = the
// Company table itself (scoped by tenant only).
export type CompanyVia =
  | { kind: 'direct' }
  | { kind: 'relation'; objectField: string; scalarField: string; targetSlug: string }
  | null;

export type AdminEntity = {
  slug: string; // URL segment == Prisma client property (camelCase model name)
  model: string;
  label: string; // human label, e.g. "Value Stream Domain"
  labelField: string; // field used for display + search
  companyVia: CompanyVia; // how records scope to a company
  fields: AdminField[]; // editable fields (excludes id, tenantId, companyId, createdAt, updatedAt)
  hidden?: boolean; // kept resolvable (FK target) but not listed in the sidebar
  group?: string; // sidebar section this entity belongs to (assigned from GROUPS)
};

// Tables excluded from the editable console:
//   • Identity / immutable-log (password hashing, append-only audit), and Tenant.
// The Initiatives tab's SPM hierarchy (Program → Workstream → PortfolioInitiative)
// IS surfaced — those carry tenantId + companyId and back a live tab, so they must
// be configurable. Their time-phased line items (BenefitLine, CostLine,
// MetricValue, Milestone, RaidItem) have no tenantId and stay excluded (they're
// edited through the specialized in-app financial/RAID grids).
const DENY = new Set([
  'User', 'AuditEntry', 'Tenant',
]);

// Label-field overrides for tables whose identifying column isn't name/title/text.
// Without these the list would fall back to showing the raw id.
const LABEL_OVERRIDES: Record<string, string> = {
  standard: 'department',
  personAppUsage: 'appName',
  roleValueStream: 'participationType',
  applicationValueStream: 'systemRole',
  initiativeValueStream: 'impactType',
  initiativeDivision: 'role',
  assignment: 'employmentType',
};

// The raw value-stream tables back FK pickers elsewhere, so they stay resolvable
// but are hidden from the sidebar — the unified "Value Streams" entity (below)
// replaces them with one level-numbered (L1–L5) list.
const HIDDEN = new Set(['valueStream', 'subValueStream', 'level', 'orgLevel']);

// Sidebar groups — entities organized by operating-model area so a user can find
// what to update at a glance. This array defines BOTH the section order and the
// within-section order. The Data Dictionary (frontend lib/glossary.ts) mirrors
// these group names and order. Entities not listed fall into "Other" at the end.
const GROUPS: { group: string; slugs: string[] }[] = [
  { group: 'Organization', slugs: ['organization', 'company', 'valueStreamDomain', 'division', 'department', 'role'] },
  { group: 'Value Streams', slugs: ['valueStreams', 'processStep', 'ioItem'] },
  { group: 'Role Work', slugs: ['category', 'checklistItem', 'roleTask', 'roleValueStream'] },
  { group: 'Applications & Metrics', slugs: ['application', 'applicationValueStream', 'metric', 'standard', 'standardItem'] },
  { group: 'People', slugs: ['person', 'assignment', 'personTask', 'personMetric', 'personAppUsage', 'personSignal'] },
  { group: 'Change & Risk', slugs: ['initiative', 'initiativeValueStream', 'initiativeDivision', 'risk', 'scenario'] },
  { group: 'Deliverables & Tasks', slugs: ['deliverable', 'task'] },
  { group: 'Initiative Tracker (SPM)', slugs: ['program', 'workstream', 'portfolioInitiative'] },
  { group: 'Application Rationalization', slugs: ['rationalizationWorkspace', 'rationalizationApp', 'rationalizationComponent', 'rationalizationCapability', 'rationalizationMicroservice', 'rationalizationPlanStep'] },
  { group: 'External', slugs: ['externalInteraction'] },
];
const OTHER_GROUP = 'Other';

// slug → { group, group index, within-group index } for labeling + ordering.
const SLUG_POS = new Map<string, { group: string; gi: number; wi: number }>();
GROUPS.forEach((g, gi) => g.slugs.forEach((slug, wi) => SLUG_POS.set(slug, { group: g.group, gi, wi })));

const camel = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const humanize = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');

function scalarKind(type: string): FieldKind {
  switch (type) {
    case 'Int':
    case 'BigInt':
      return 'int';
    case 'Float':
    case 'Decimal':
      return 'float';
    case 'Boolean':
      return 'boolean';
    case 'DateTime':
      return 'datetime';
    default:
      return 'string';
  }
}

const MULTILINE = new Set([
  'description', 'responsibilities', 'notes', 'mitigation', 'text', 'charter',
  'inputs', 'outputs', 'upstream', 'downstream', 'dataElements', 'formula',
]);

function pickLabelField(model: Prisma.DMMF.Model): string {
  const names = new Set(model.fields.filter((f) => f.kind === 'scalar' && f.type === 'String').map((f) => f.name));
  for (const cand of ['name', 'title', 'text', 'code', 'email']) {
    if (names.has(cand)) return cand;
  }
  return 'id';
}

function buildEntity(model: Prisma.DMMF.Model, companyModels: Set<string>): AdminEntity {
  // FK scalar → target model name, e.g. { companyId: 'Company' }.
  const fkTarget: Record<string, string> = {};
  for (const f of model.fields) {
    if (f.kind === 'object' && f.relationFromFields && f.relationFromFields.length === 1) {
      fkTarget[f.relationFromFields[0]] = f.type;
    }
  }

  const hasCompanyId = model.fields.some((f) => f.name === 'companyId' && f.kind === 'scalar');
  // Resolve how this table scopes to a company.
  let companyVia: CompanyVia = null;
  if (model.name === 'Company') {
    companyVia = null;
  } else if (hasCompanyId) {
    companyVia = { kind: 'direct' };
  } else {
    // Inherit company via the first FK whose target table carries companyId.
    for (const f of model.fields) {
      if (f.kind === 'object' && f.relationFromFields?.length === 1 && companyModels.has(f.type)) {
        companyVia = { kind: 'relation', objectField: f.name, scalarField: f.relationFromFields[0], targetSlug: camel(f.type) };
        break;
      }
    }
  }

  const fields: AdminField[] = [];
  for (const f of model.fields) {
    if (f.kind === 'object' || f.isList) continue;
    if (f.isId || f.isUpdatedAt) continue;
    if (f.name === 'tenantId' || f.name === 'createdAt') continue;
    // companyId is auto-set from the active company, never edited in the form.
    if (f.name === 'companyId') continue;
    // Provenance / legacy columns are noise in the admin sheets — never surface.
    if (f.name === 'sourceSheet' || f.name === 'sourceRow' || f.name === 'code') continue;

    const target = fkTarget[f.name];
    fields.push({
      name: f.name,
      kind: target ? 'string' : scalarKind(f.type),
      required: Boolean(f.isRequired && !f.hasDefaultValue),
      // DMMF isRequired === true means the column is NOT NULL. Such a field is
      // "optional to supply" only because it has a default — so when left empty we
      // must omit it (let the default apply), never send null.
      nullable: !f.isRequired,
      multiline: !target && f.type === 'String' && MULTILINE.has(f.name),
      ...(target ? { relation: { entity: camel(target), labelField: '' } } : {}),
    });
  }

  return {
    slug: camel(model.name),
    model: camel(model.name),
    label: humanize(model.name),
    labelField: LABEL_OVERRIDES[camel(model.name)] ?? pickLabelField(model),
    companyVia,
    fields,
  };
}

function build(): Record<string, AdminEntity> {
  const models = Prisma.dmmf.datamodel.models.filter(
    (m) => !DENY.has(m.name) && m.fields.some((f) => f.name === 'tenantId'),
  );
  // Tables that carry their own companyId — used to resolve transitive scoping.
  const companyModels = new Set(
    Prisma.dmmf.datamodel.models
      .filter((m) => m.fields.some((f) => f.name === 'companyId' && f.kind === 'scalar'))
      .map((m) => m.name),
  );
  const entities = models.map((m) => buildEntity(m, companyModels));
  const bySlug: Record<string, AdminEntity> = {};
  for (const e of entities) bySlug[e.slug] = e;

  // Second pass: resolve each FK relation's target labelField now that all
  // entities exist (used by the frontend to show a name instead of a raw id).
  for (const e of entities) {
    for (const f of e.fields) {
      if (f.relation) f.relation.labelField = bySlug[f.relation.entity]?.labelField ?? 'id';
    }
  }
  return bySlug;
}

export const ENTITIES: Record<string, AdminEntity> = build();

// Mark the raw value-stream tables hidden, then inject the unified entity.
for (const slug of HIDDEN) {
  if (ENTITIES[slug]) ENTITIES[slug].hidden = true;
}
for (const e of LEVEL_ENTITIES) ENTITIES[e.slug] = e;

// Tag every entity with its sidebar group (unlisted ones → "Other").
for (const e of Object.values(ENTITIES)) {
  e.group = SLUG_POS.get(e.slug)?.group ?? OTHER_GROUP;
}

// Ordered list for the sidebar / _meta response: by group order, then by the
// order declared within the group. Hidden entities stay in ENTITIES for FK
// resolution but are dropped from the list. The frontend renders a section
// header whenever `group` changes.
export const ENTITY_LIST: AdminEntity[] = Object.values(ENTITIES)
  .filter((e) => !e.hidden)
  .sort((a, b) => {
    const pa = SLUG_POS.get(a.slug);
    const pb = SLUG_POS.get(b.slug);
    const gia = pa ? pa.gi : GROUPS.length;
    const gib = pb ? pb.gi : GROUPS.length;
    if (gia !== gib) return gia - gib;
    const wia = pa ? pa.wi : 0;
    const wib = pb ? pb.wi : 0;
    return wia - wib || a.label.localeCompare(b.label);
  });

export function getEntity(slug: string): AdminEntity | undefined {
  return ENTITIES[slug];
}

// Prisma `where` fragment that scopes an entity's rows to one company. Empty for
// the Company table (tenant-scoped only).
export function companyWhere(entity: AdminEntity, companyId: string): Record<string, unknown> {
  const v = entity.companyVia;
  if (!v) return {};
  if (v.kind === 'direct') return { companyId };
  return { [v.objectField]: { companyId } };
}

// Coerce a raw JSON value from the request body into the type Prisma expects for
// a field. Returns `undefined` to mean "skip this field" (absent / empty
// optional). Throws on a malformed value so the route can return 400.
export function coerceValue(field: AdminField, raw: unknown): unknown {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') {
    if (field.required) throw new Error(`${field.name} is required`);
    // Non-nullable columns (with a default) must be omitted when empty so the
    // default applies — sending null would violate NOT NULL. Nullable columns
    // accept null.
    return field.nullable === false ? undefined : null;
  }
  switch (field.kind) {
    case 'boolean':
      if (typeof raw === 'boolean') return raw;
      return raw === 'true' || raw === 1 || raw === '1';
    case 'int': {
      const n = Number(raw);
      if (!Number.isInteger(n)) throw new Error(`${field.name} must be an integer`);
      return n;
    }
    case 'float': {
      const n = Number(raw);
      if (Number.isNaN(n)) throw new Error(`${field.name} must be a number`);
      return n;
    }
    case 'datetime': {
      const d = new Date(raw as string);
      if (Number.isNaN(d.getTime())) throw new Error(`${field.name} must be a valid date`);
      return d;
    }
    default:
      return String(raw);
  }
}

// Build a Prisma `data` object from a request body for create/update, coercing
// every known field and skipping unknown / absent ones. `partial` (update)
// skips the required-on-create check for fields that are simply absent.
export function buildData(entity: AdminEntity, body: Record<string, unknown>, partial: boolean) {
  const data: Record<string, unknown> = {};
  for (const f of entity.fields) {
    if (partial && !(f.name in body)) continue;
    const v = coerceValue(f, body[f.name]);
    if (v === undefined) {
      // Absent on create: enforce required here (coerceValue only catches the
      // null/empty case, not a missing key).
      if (!partial && f.required) throw new Error(`${f.name} is required`);
      continue;
    }
    data[f.name] = v;
  }
  return data;
}
