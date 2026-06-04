import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { logAudit, computeDiff } from '../services/audit.js';
import type { AdminEntity } from './adminRegistry.js';

// ─── Generic configurable "level" admin (Value Streams + Organization) ───
// Two SEPARATE self-referential tables — `Level` (value streams) and `OrgLevel`
// (organization) — are each folded into the admin console as one level-numbered
// list: `levelNumber` is the depth and `parentId` connects each node to the one
// above. Keeping them distinct means configuring one never touches the other or
// the live operating data (IoItem/ProcessStep/RoleValueStream/etc.). This module
// builds an identical create/edit/delete + re-parent + import-from-catalog
// handler set for each, parameterized only by the Prisma delegate.

export const VS_MODEL = '__valueStreams';
export const ORG_MODEL = '__organization';
const MAX_LEVEL = 6;

type LevelRec = {
  id: string; name: string; levelNumber: number; parentId: string | null; sortOrder: number;
  description: string | null; leads: string | null; supporting: string | null;
  inputs: string | null; outputs: string | null; externalParticipants: string | null; notes: string | null;
};
type Row = LevelRec & { level: string; optionLabel: string; _lvl: number };

const SELECT = {
  id: true, name: true, levelNumber: true, parentId: true, sortOrder: true,
  description: true, leads: true, supporting: true, inputs: true, outputs: true,
  externalParticipants: true, notes: true,
} as const;
const DETAIL = ['description', 'leads', 'supporting', 'inputs', 'outputs', 'externalParticipants', 'notes'] as const;

function toRow(l: LevelRec): Row {
  const level = `Level ${l.levelNumber}`;
  return { ...l, level, optionLabel: `${level} — ${l.name}`, _lvl: l.levelNumber };
}
const str = (v: unknown): string | null => (v === undefined || v === null || v === '' ? null : String(v));
const nameFilter = (search: string) => (search ? { name: { contains: search, mode: 'insensitive' as const } } : {});
function detail(body: Record<string, unknown>) {
  const d: Record<string, unknown> = {};
  for (const f of DETAIL) if (f in body) d[f] = str(body[f]);
  return d;
}
function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

// Resolve an org node's name for Import-from-Data-Catalog (Division/Department/Role).
async function orgNodeName(tenantId: string, companyId: string, ref: Record<string, unknown>): Promise<string | null> {
  const id = str(ref.id);
  const type = str(ref.type);
  if (!id || !type) return null;
  const where = { id, tenantId, companyId };
  if (type === 'division') return (await prisma.division.findFirst({ where, select: { name: true } }))?.name ?? null;
  if (type === 'department') return (await prisma.department.findFirst({ where, select: { name: true } }))?.name ?? null;
  if (type === 'role') return (await prisma.role.findFirst({ where, select: { name: true } }))?.name ?? null;
  return null;
}

export type LevelHandlers = {
  entity: AdminEntity;
  list: (tenantId: string, companyId: string, search: string, take: number, skip: number) => Promise<unknown>;
  getOne: (tenantId: string, companyId: string, id: string) => Promise<Row | null>;
  create: (tenantId: string, companyId: string, actorEmail: string, body: Record<string, unknown>) => Promise<Row>;
  update: (tenantId: string, companyId: string, actorEmail: string, id: string, body: Record<string, unknown>) => Promise<Row | null>;
  remove: (tenantId: string, companyId: string, actorEmail: string, id: string) => Promise<boolean>;
};

function buildLevelAdmin(opts: { model: string; slug: string; label: string; delegateName: 'level' | 'orgLevel'; tableName: string }): LevelHandlers {
  const del = () => (prisma as unknown as Record<string, any>)[opts.delegateName];
  const auditModel = opts.delegateName === 'level' ? 'Level' : 'OrgLevel';

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

  const list = async (tenantId: string, companyId: string, search: string, take: number, skip: number) => {
    const where = { tenantId, companyId, ...nameFilter(search) };
    const [rows, total] = await Promise.all([
      del().findMany({ where, select: SELECT, orderBy: [{ levelNumber: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }], take, skip }),
      del().count({ where }),
    ]);
    return { rows: (rows as LevelRec[]).map(toRow), total, limit: take, offset: skip };
  };

  const getOne = async (tenantId: string, companyId: string, id: string): Promise<Row | null> => {
    const l = await del().findFirst({ where: { id, tenantId, companyId }, select: SELECT });
    return l ? toRow(l as LevelRec) : null;
  };

  const create = async (tenantId: string, companyId: string, actorEmail: string, body: Record<string, unknown>): Promise<Row> => {
    let name = str(body.name);
    if (!name && body.importOrg) name = await orgNodeName(tenantId, companyId, body.importOrg as Record<string, unknown>);
    if (!name) throw httpError('name is required', 400);
    let parentId: string | null = null;
    let levelNumber = 0;
    if (body.parentId) {
      const parent = await del().findFirst({ where: { id: String(body.parentId), tenantId, companyId }, select: { id: true, levelNumber: true } });
      if (!parent) throw httpError('Parent level not found in this company', 400);
      if (parent.levelNumber >= MAX_LEVEL) throw httpError(`Cannot nest deeper than Level ${MAX_LEVEL}`, 400);
      parentId = parent.id;
      levelNumber = parent.levelNumber + 1;
    }
    const org = body.importOrg as { type?: unknown; id?: unknown } | undefined;
    const created = await del().create({
      data: { tenantId, companyId, name, parentId, levelNumber, sourceType: org ? str(org.type) : 'manual', sourceRefId: org ? str(org.id) : null, ...detail(body) },
      select: SELECT,
    });
    logAudit({ tenantId, actorEmail, entityType: auditModel, entityId: created.id, action: 'CREATE', diff: { name } });
    return toRow(created as LevelRec);
  };

  const update = async (tenantId: string, companyId: string, actorEmail: string, id: string, body: Record<string, unknown>): Promise<Row | null> => {
    const before = await del().findFirst({ where: { id, tenantId, companyId } });
    if (!before) return null;
    const data: Record<string, unknown> = {};
    if ('name' in body) data.name = str(body.name) ?? before.name;
    for (const f of DETAIL) if (f in body) data[f] = str(body[f]);
    let delta = 0;
    if ('parentId' in body) {
      const pid = body.parentId ? String(body.parentId) : null;
      let newLevelNumber: number;
      if (pid) {
        if (pid === id) throw httpError('A level cannot be its own parent', 400);
        const parent = await del().findFirst({ where: { id: pid, tenantId, companyId }, select: { id: true, levelNumber: true } });
        if (!parent) throw httpError('Parent level not found in this company', 400);
        if (await isWithinSubtree(opts.delegateName, tenantId, companyId, id, parent.id)) throw httpError('Cannot connect a level to one of its own descendants', 400);
        data.parentId = parent.id;
        newLevelNumber = parent.levelNumber + 1;
      } else {
        data.parentId = null;
        newLevelNumber = 0;
      }
      if (newLevelNumber > MAX_LEVEL) throw httpError(`Cannot nest deeper than Level ${MAX_LEVEL}`, 400);
      delta = newLevelNumber - before.levelNumber;
      if (delta !== 0) data.levelNumber = newLevelNumber;
    }
    const after = await del().update({ where: { id }, data, select: SELECT });
    if (delta !== 0) await shiftSubtree(opts.delegateName, opts.tableName, tenantId, companyId, id, delta);
    const diff = computeDiff(before, after as Record<string, unknown>, ['name', 'parentId', 'levelNumber', ...DETAIL]);
    if (Object.keys(diff).length) logAudit({ tenantId, actorEmail, entityType: auditModel, entityId: id, action: 'UPDATE', diff });
    return toRow(after as LevelRec);
  };

  const remove = async (tenantId: string, companyId: string, actorEmail: string, id: string): Promise<boolean> => {
    const before = await del().findFirst({ where: { id, tenantId, companyId }, select: { id: true, name: true } });
    if (!before) return false;
    await del().delete({ where: { id } });
    logAudit({ tenantId, actorEmail, entityType: auditModel, entityId: id, action: 'DELETE', diff: { name: before.name } });
    return true;
  };

  return { entity, list, getOne, create, update, remove };
}

async function isWithinSubtree(delegateName: 'level' | 'orgLevel', tenantId: string, companyId: string, rootId: string, candidateId: string): Promise<boolean> {
  const del = (prisma as unknown as Record<string, any>)[delegateName];
  let cur: string | null = candidateId;
  for (let i = 0; i < MAX_LEVEL + 2 && cur; i++) {
    const curId: string = cur;
    if (curId === rootId) return true;
    const p: { parentId: string | null } | null = await del.findFirst({ where: { id: curId, tenantId, companyId }, select: { parentId: true } });
    cur = p?.parentId ?? null;
  }
  return false;
}

async function shiftSubtree(delegateName: 'level' | 'orgLevel', tableName: string, tenantId: string, companyId: string, rootId: string, delta: number): Promise<void> {
  const del = (prisma as unknown as Record<string, any>)[delegateName];
  let frontier = [rootId];
  const descendants: string[] = [];
  for (let depth = 0; depth < MAX_LEVEL + 2 && frontier.length; depth++) {
    const kids = await del.findMany({ where: { tenantId, companyId, parentId: { in: frontier } }, select: { id: true } });
    const ids = (kids as { id: string }[]).map((k) => k.id);
    descendants.push(...ids);
    frontier = ids;
  }
  if (descendants.length) {
    await prisma.$executeRawUnsafe(
      `UPDATE "${tableName}" SET "levelNumber" = "levelNumber" + $1 WHERE "id" IN (${descendants.map((_, i) => `$${i + 2}`).join(', ')})`,
      delta, ...descendants,
    );
  }
}

// The two configurable level entities.
export const VALUE_STREAMS = buildLevelAdmin({ model: VS_MODEL, slug: 'valueStreams', label: 'Value Streams', delegateName: 'level', tableName: 'Level' });
export const ORGANIZATION = buildLevelAdmin({ model: ORG_MODEL, slug: 'organization', label: 'Organization', delegateName: 'orgLevel', tableName: 'OrgLevel' });

export const VALUE_STREAMS_ENTITY = VALUE_STREAMS.entity;
export const LEVEL_ENTITIES: AdminEntity[] = [VALUE_STREAMS.entity, ORGANIZATION.entity];
export const LEVEL_HANDLERS: Record<string, LevelHandlers> = {
  [VS_MODEL]: VALUE_STREAMS,
  [ORG_MODEL]: ORGANIZATION,
};
