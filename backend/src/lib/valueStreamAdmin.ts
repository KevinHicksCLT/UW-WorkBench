import { prisma } from '../db/prisma.js';
import { logAudit, computeDiff } from '../services/audit.js';
import type { AdminEntity } from './adminRegistry.js';
import { closureFor } from './closure.js';
import { invalidateStructureCounts } from './resolvers/index.js';

// ─── Generic configurable "level" admin (Value Streams + Organization) ───
// erd_v5: the two configurable trees are the real level-typed spines —
// `ProcessNode` (value streams) and `OrgUnit` (organization). Each is folded into
// the admin console as one level-numbered list: the level depth comes from the
// node's level type (ProcessLevelType / OrgLevelType `levelNumber`) and `parentId`
// connects each node to the one above. Named-spine convention: `dbValue` is the
// canonical system name and `displayValue` is the editable label — the level
// editor edits `displayValue` and surfaces it as `name`.
//
// This module builds an identical list/get/create/update/delete handler set for
// each tree, parameterized only by the Prisma delegate + its level-type relation.
//
// Closure maintenance: ProcessNodeClosure / OrgUnitClosure are DERIVED
// move-with-children edges. The write paths below maintain them transactionally
// via lib/closure.ts — create → insertNode, parent reassignment → moveSubtree,
// remove → deleteSubtree — so the spine read resolvers always see correct edges.

export const VS_MODEL = '__valueStreams';
export const ORG_MODEL = '__organization';
const MAX_LEVEL = 6;

// Editable-detail columns the legacy Level editor exposed. ProcessNode/OrgUnit do
// not have dedicated columns for these, so they are kept in `attributes` JSON.
const DETAIL = ['description', 'leads', 'supporting', 'inputs', 'outputs', 'externalParticipants', 'notes'] as const;

type SpineRow = {
  id: string;
  displayValue: string;
  parentId: string | null;
  sortOrder: number;
  attributes?: Record<string, unknown> | null;
  levelNumber: number;
};
type Row = {
  id: string; name: string; levelNumber: number; parentId: string | null; sortOrder: number;
  description: string | null; leads: string | null; supporting: string | null;
  inputs: string | null; outputs: string | null; externalParticipants: string | null; notes: string | null;
  level: string; optionLabel: string; _lvl: number;
};

const str = (v: unknown): string | null => (v === undefined || v === null || v === '' ? null : String(v));
const nameFilter = (search: string) => (search ? { displayValue: { contains: search, mode: 'insensitive' as const } } : {});

function detailFrom(attributes: Record<string, unknown> | null | undefined): Record<(typeof DETAIL)[number], string | null> {
  const a = attributes ?? {};
  const out = {} as Record<(typeof DETAIL)[number], string | null>;
  for (const f of DETAIL) out[f] = str(a[f]);
  return out;
}

function toRow(r: SpineRow): Row {
  const d = detailFrom(r.attributes);
  const level = `Level ${r.levelNumber}`;
  return {
    id: r.id, name: r.displayValue, levelNumber: r.levelNumber, parentId: r.parentId, sortOrder: r.sortOrder,
    ...d, level, optionLabel: `${level} — ${r.displayValue}`, _lvl: r.levelNumber,
  };
}

// Merge the editable DETAIL fields from a request body into an attributes object.
function mergeDetail(existing: Record<string, unknown> | null | undefined, body: Record<string, unknown>) {
  const next = { ...(existing ?? {}) };
  for (const f of DETAIL) if (f in body) next[f] = str(body[f]);
  return next;
}

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

export type LevelHandlers = {
  entity: AdminEntity;
  list: (tenantId: string, companyId: string, search: string, take: number, skip: number) => Promise<unknown>;
  getOne: (tenantId: string, companyId: string, id: string) => Promise<Row | null>;
  create: (tenantId: string, companyId: string, actorEmail: string, body: Record<string, unknown>) => Promise<Row>;
  update: (tenantId: string, companyId: string, actorEmail: string, id: string, body: Record<string, unknown>) => Promise<Row | null>;
  remove: (tenantId: string, companyId: string, actorEmail: string, id: string) => Promise<boolean>;
};

type Spine = 'processNode' | 'orgUnit';

function buildLevelAdmin(opts: { model: string; slug: string; label: string; spine: Spine; auditModel: string }): LevelHandlers {
  const del = () => (prisma as unknown as Record<string, any>)[opts.spine];
  // The level-type relation + delegate that resolves a node's levelNumber.
  const levelRelation = opts.spine === 'processNode' ? 'processLevelType' : 'orgLevelType';
  const levelDelegate = () => (prisma as unknown as Record<string, any>)[opts.spine === 'processNode' ? 'processLevelType' : 'orgLevelType'];

  const SELECT = {
    id: true, displayValue: true, dbValue: true, parentId: true, sortOrder: true, attributes: opts.spine === 'processNode',
    [levelRelation]: { select: { levelNumber: true } },
  } as const;

  // Normalize a raw spine row (with its level-type relation) into SpineRow.
  const norm = (r: any): SpineRow => ({
    id: r.id, displayValue: r.displayValue, parentId: r.parentId, sortOrder: r.sortOrder,
    attributes: opts.spine === 'processNode' ? (r.attributes ?? null) : null,
    levelNumber: r[levelRelation]?.levelNumber ?? 0,
  });

  const entity: AdminEntity = {
    slug: opts.slug,
    model: opts.model,
    label: opts.label,
    labelField: 'name',
    companyVia: { kind: 'direct' },
    fields: [
      { name: 'level', kind: 'string', required: false, multiline: false, readonly: true },
      { name: 'name', kind: 'string', required: true, multiline: false },
      { name: 'parentId', kind: 'string', required: false, multiline: false, relation: { entity: opts.slug, labelField: 'optionLabel' } },
      { name: 'description', kind: 'string', required: false, multiline: true },
      { name: 'leads', kind: 'string', required: false, multiline: false },
      { name: 'supporting', kind: 'string', required: false, multiline: false },
      { name: 'inputs', kind: 'string', required: false, multiline: true },
      { name: 'outputs', kind: 'string', required: false, multiline: true },
      { name: 'externalParticipants', kind: 'string', required: false, multiline: false },
      { name: 'notes', kind: 'string', required: false, multiline: true },
    ],
  };

  // Resolve the ProcessLevelType/OrgLevelType id for a given level number in a
  // company (creating one is out of scope — the spine is seeded). Returns null if
  // the company has no such level type.
  const levelTypeIdFor = async (companyId: string, levelNumber: number): Promise<string | null> => {
    const lt = await levelDelegate().findFirst({ where: { companyId, levelNumber }, select: { id: true } });
    return lt?.id ?? null;
  };

  const list = async (_tenantId: string, companyId: string, search: string, take: number, skip: number) => {
    const where = { companyId, ...nameFilter(search) };
    const [rows, total] = await Promise.all([
      del().findMany({ where, select: SELECT, orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }], take, skip }),
      del().count({ where }),
    ]);
    const mapped = (rows as any[]).map(norm).map(toRow).sort((a, b) => a.levelNumber - b.levelNumber || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    return { rows: mapped, total, limit: take, offset: skip };
  };

  const getOne = async (_tenantId: string, companyId: string, id: string): Promise<Row | null> => {
    const r = await del().findFirst({ where: { id, companyId }, select: SELECT });
    return r ? toRow(norm(r)) : null;
  };

  const create = async (tenantId: string, companyId: string, actorEmail: string, body: Record<string, unknown>): Promise<Row> => {
    const name = str(body.name);
    if (!name) throw httpError('name is required', 400);
    let parentId: string | null = null;
    let levelNumber = 1; // top of the configurable tree
    if (body.parentId) {
      const parent = await del().findFirst({ where: { id: String(body.parentId), companyId }, select: { id: true, [levelRelation]: { select: { levelNumber: true } } } });
      if (!parent) throw httpError('Parent node not found in this company', 400);
      const parentLevel = parent[levelRelation]?.levelNumber ?? 0;
      if (parentLevel >= MAX_LEVEL) throw httpError(`Cannot nest deeper than Level ${MAX_LEVEL}`, 400);
      parentId = parent.id;
      levelNumber = parentLevel + 1;
    }
    const levelTypeId = await levelTypeIdFor(companyId, levelNumber);
    if (!levelTypeId) throw httpError(`This company has no level ${levelNumber} configured`, 400);
    const data: Record<string, unknown> = {
      companyId, dbValue: name, displayValue: name, parentId,
      [opts.spine === 'processNode' ? 'processLevelTypeId' : 'orgLevelTypeId']: levelTypeId,
    };
    if (opts.spine === 'processNode') data.attributes = mergeDetail(null, body);
    const created = await del().create({ data, select: SELECT });
    // Closure: self-row + ancestor edges (transactional).
    await closureFor(opts.spine).insertNode({ nodeId: created.id, parentId });
    invalidateStructureCounts(companyId);
    logAudit({ tenantId, actorEmail, entityType: opts.auditModel, entityId: created.id, action: 'CREATE', diff: { name } });
    return toRow(norm(created));
  };

  const update = async (tenantId: string, companyId: string, actorEmail: string, id: string, body: Record<string, unknown>): Promise<Row | null> => {
    const before = await del().findFirst({ where: { id, companyId }, select: SELECT });
    if (!before) return null;
    const data: Record<string, unknown> = {};
    if ('name' in body) { const n = str(body.name); if (n) { data.displayValue = n; } }
    if (opts.spine === 'processNode' && DETAIL.some((f) => f in body)) {
      data.attributes = mergeDetail(before.attributes ?? null, body);
    }
    // Parent reassignment. The reparent is applied via closure.moveSubtree (which
    // sets parentId + rebuilds the subtree edges transactionally); the level-type
    // FK that the new depth implies is set here on `data` (the level type is local
    // to the moved node — re-leveling the whole subtree is not supported).
    let moveTo: string | null | undefined; // undefined = no move requested
    if ('parentId' in body) {
      const pid = body.parentId ? String(body.parentId) : null;
      if (pid === id) throw httpError('A node cannot be its own parent', 400);
      if (pid) {
        const parent = await del().findFirst({ where: { id: pid, companyId }, select: { id: true, [levelRelation]: { select: { levelNumber: true } } } });
        if (!parent) throw httpError('Parent node not found in this company', 400);
        const newLevel = (parent[levelRelation]?.levelNumber ?? 0) + 1;
        if (newLevel > MAX_LEVEL) throw httpError(`Cannot nest deeper than Level ${MAX_LEVEL}`, 400);
        const levelTypeId = await levelTypeIdFor(companyId, newLevel);
        if (!levelTypeId) throw httpError(`This company has no level ${newLevel} configured`, 400);
        // Cycle guard: the new parent must not be inside this node's own subtree.
        let cursor: string | null = pid;
        for (let i = 0; i < 64 && cursor; i++) {
          if (cursor === id) throw httpError('Cannot move a node under its own descendant', 400);
          const up: { parentId: string | null } | null = await del().findUnique({ where: { id: cursor }, select: { parentId: true } });
          cursor = up?.parentId ?? null;
        }
        data[opts.spine === 'processNode' ? 'processLevelTypeId' : 'orgLevelTypeId'] = levelTypeId;
      }
      moveTo = pid;
    }
    if (Object.keys(data).length) await del().update({ where: { id }, data });
    if (moveTo !== undefined) {
      await closureFor(opts.spine).moveSubtree({ nodeId: id, newParentId: moveTo });
      invalidateStructureCounts(companyId);
    }
    const after = await del().findFirst({ where: { id, companyId }, select: SELECT });
    if (!after) return null;
    const diff = computeDiff(toRow(norm(before)) as unknown as Record<string, unknown>, toRow(norm(after)) as unknown as Record<string, unknown>, ['name', 'parentId', 'levelNumber', ...DETAIL]);
    if (Object.keys(diff).length) logAudit({ tenantId, actorEmail, entityType: opts.auditModel, entityId: id, action: 'UPDATE', diff });
    return toRow(norm(after));
  };

  const remove = async (tenantId: string, companyId: string, actorEmail: string, id: string): Promise<boolean> => {
    const before = await del().findFirst({ where: { id, companyId }, select: { id: true, displayValue: true } });
    if (!before) return false;
    // Closure: delete the whole subtree (nodes + closure rows) transactionally.
    await closureFor(opts.spine).deleteSubtree({ nodeId: id });
    invalidateStructureCounts(companyId);
    logAudit({ tenantId, actorEmail, entityType: opts.auditModel, entityId: id, action: 'DELETE', diff: { name: before.displayValue } });
    return true;
  };

  return { entity, list, getOne, create, update, remove };
}

// The two configurable level entities.
export const VALUE_STREAMS = buildLevelAdmin({ model: VS_MODEL, slug: 'valueStreams', label: 'Value Streams', spine: 'processNode', auditModel: 'ProcessNode' });
export const ORGANIZATION = buildLevelAdmin({ model: ORG_MODEL, slug: 'organization', label: 'Organization', spine: 'orgUnit', auditModel: 'OrgUnit' });

export const VALUE_STREAMS_ENTITY = VALUE_STREAMS.entity;
export const LEVEL_ENTITIES: AdminEntity[] = [VALUE_STREAMS.entity, ORGANIZATION.entity];
export const LEVEL_HANDLERS: Record<string, LevelHandlers> = {
  [VS_MODEL]: VALUE_STREAMS,
  [ORG_MODEL]: ORGANIZATION,
};
