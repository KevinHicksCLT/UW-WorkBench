import { prisma } from '../db/prisma.js';
import { logAudit, computeDiff } from '../services/audit.js';
import type { AdminEntity } from './adminRegistry.js';

// ─── Unified "Value Streams" admin entity ────────────────────────────────
// The value-stream hierarchy lives in three physical tables — ValueStreamDomain
// (the grouping), ValueStream (the stream), and SubValueStream (the L3–L5
// breakdown). Those tables are still referenced as FK targets elsewhere, so they
// stay in the registry (hidden from the sidebar). This module folds all three
// into ONE level-numbered list (L1 Domain → L2 Stream → L3/L4/L5 sub-levels) so
// value streams read by level — never bucketed under a company's divisions.
//
// Rows carry a prefixed id (`d:`, `v:`, `s:`) so a generic create/edit/delete
// from the unified list can be routed back to the correct underlying table.

export const VS_MODEL = '__valueStreams';

// Level numbers follow the value-stream-intrinsic axis used across the app's
// glossary (Domain = L1, Stream = L2). SubValueStream stores its own level
// (3/4/5), which is already the L number — so no renumbering is needed.
const DOMAIN_LEVEL = 1;
const STREAM_LEVEL = 2;
const MAX_LEVEL = 5;

type Kind = 'domain' | 'stream' | 'sub';
const PREFIX: Record<Kind, string> = { domain: 'd:', stream: 'v:', sub: 's:' };

function encodeId(kind: Kind, id: string): string {
  return PREFIX[kind] + id;
}
function decodeId(prefixed: string): { kind: Kind; id: string } | null {
  if (prefixed.startsWith('d:')) return { kind: 'domain', id: prefixed.slice(2) };
  if (prefixed.startsWith('v:')) return { kind: 'stream', id: prefixed.slice(2) };
  if (prefixed.startsWith('s:')) return { kind: 'sub', id: prefixed.slice(2) };
  return null;
}

// The synthetic registry entry. `level` and `parent` are surfaced so the list
// shows a level column and the form offers a parent picker; `level` is derived
// (read-only). Descriptive fields only apply to sub-levels but are harmless on
// the others.
export const VALUE_STREAMS_ENTITY: AdminEntity = {
  slug: 'valueStreams',
  model: VS_MODEL,
  label: 'Value Streams',
  labelField: 'name',
  companyVia: { kind: 'direct' },
  fields: [
    { name: 'level', kind: 'string', required: false, multiline: false, readonly: true },
    { name: 'name', kind: 'string', required: true, multiline: false },
    { name: 'parentId', kind: 'string', required: false, multiline: false, createOnly: true, relation: { entity: 'valueStreams', labelField: 'name' } },
    { name: 'inputs', kind: 'string', required: false, multiline: true },
    { name: 'outputs', kind: 'string', required: false, multiline: true },
    { name: 'upstream', kind: 'string', required: false, multiline: true },
    { name: 'downstream', kind: 'string', required: false, multiline: true },
    { name: 'notes', kind: 'string', required: false, multiline: true },
  ],
};

type Row = {
  id: string;
  name: string;
  level: string;
  parentId: string | null;
  inputs: string | null;
  outputs: string | null;
  upstream: string | null;
  downstream: string | null;
  notes: string | null;
  _lvl: number; // numeric level, for ordering only
};

function domainRow(d: { id: string; name: string }): Row {
  return { id: encodeId('domain', d.id), name: d.name, level: `L${DOMAIN_LEVEL}`, parentId: null, inputs: null, outputs: null, upstream: null, downstream: null, notes: null, _lvl: DOMAIN_LEVEL };
}
function streamRow(v: { id: string; name: string; domainId: string | null }): Row {
  return { id: encodeId('stream', v.id), name: v.name, level: `L${STREAM_LEVEL}`, parentId: v.domainId ? encodeId('domain', v.domainId) : null, inputs: null, outputs: null, upstream: null, downstream: null, notes: null, _lvl: STREAM_LEVEL };
}
function subRow(s: { id: string; name: string; level: number; valueStreamId: string; parentId: string | null; inputs: string | null; outputs: string | null; upstream: string | null; downstream: string | null; notes: string | null }): Row {
  return {
    id: encodeId('sub', s.id),
    name: s.name,
    level: `L${s.level}`,
    parentId: s.parentId ? encodeId('sub', s.parentId) : encodeId('stream', s.valueStreamId),
    inputs: s.inputs, outputs: s.outputs, upstream: s.upstream, downstream: s.downstream, notes: s.notes,
    _lvl: s.level,
  };
}

const nameFilter = (search: string) =>
  search ? { name: { contains: search, mode: 'insensitive' as const } } : {};

// GET — the merged, level-ordered list (paginated in memory; admin-scale data).
export async function vsList(tenantId: string, companyId: string, search: string, take: number, skip: number) {
  const [domains, streams, subs] = await Promise.all([
    prisma.valueStreamDomain.findMany({ where: { tenantId, companyId, ...nameFilter(search) }, select: { id: true, name: true } }),
    prisma.valueStream.findMany({ where: { tenantId, companyId, ...nameFilter(search) }, select: { id: true, name: true, domainId: true } }),
    prisma.subValueStream.findMany({ where: { tenantId, valueStream: { companyId }, ...nameFilter(search) }, select: { id: true, name: true, level: true, valueStreamId: true, parentId: true, inputs: true, outputs: true, upstream: true, downstream: true, notes: true } }),
  ]);

  const rows: Row[] = [
    ...domains.map(domainRow),
    ...streams.map(streamRow),
    ...subs.map(subRow),
  ].sort((a, b) => a._lvl - b._lvl || a.name.localeCompare(b.name));

  const total = rows.length;
  return { rows: rows.slice(skip, skip + take), total, limit: take, offset: skip };
}

// GET one — used by the edit form's initial load.
export async function vsGetOne(tenantId: string, companyId: string, prefixed: string): Promise<Row | null> {
  const ref = decodeId(prefixed);
  if (!ref) return null;
  if (ref.kind === 'domain') {
    const d = await prisma.valueStreamDomain.findFirst({ where: { id: ref.id, tenantId, companyId }, select: { id: true, name: true } });
    return d ? domainRow(d) : null;
  }
  if (ref.kind === 'stream') {
    const v = await prisma.valueStream.findFirst({ where: { id: ref.id, tenantId, companyId }, select: { id: true, name: true, domainId: true } });
    return v ? streamRow(v) : null;
  }
  const s = await prisma.subValueStream.findFirst({ where: { id: ref.id, tenantId, valueStream: { companyId } }, select: { id: true, name: true, level: true, valueStreamId: true, parentId: true, inputs: true, outputs: true, upstream: true, downstream: true, notes: true } });
  return s ? subRow(s) : null;
}

const str = (v: unknown): string | null => {
  if (v === undefined || v === null || v === '') return null;
  return String(v);
};

// POST — create a node. The chosen parent determines which table/level it lands
// in: no parent → a new L1 domain; under a domain → an L2 stream; under a stream
// → an L3 sub-level; under a sub-level → the next level down (capped at L5).
export async function vsCreate(tenantId: string, companyId: string, actorEmail: string, body: Record<string, unknown>): Promise<Row> {
  const name = str(body.name);
  if (!name) throw httpError('name is required', 400);
  const parentRef = body.parentId ? decodeId(String(body.parentId)) : null;

  let created: Row;
  let model: string;
  let id: string;

  if (!parentRef) {
    const d = await prisma.valueStreamDomain.create({ data: { tenantId, companyId, name } });
    created = domainRow(d); model = 'ValueStreamDomain'; id = d.id;
  } else if (parentRef.kind === 'domain') {
    const domain = await prisma.valueStreamDomain.findFirst({ where: { id: parentRef.id, tenantId, companyId }, select: { id: true, name: true } });
    if (!domain) throw httpError('Parent domain not found in this company', 400);
    const v = await prisma.valueStream.create({ data: { tenantId, companyId, name, domainId: domain.id, domain: domain.name } });
    created = streamRow(v); model = 'ValueStream'; id = v.id;
  } else if (parentRef.kind === 'stream') {
    const stream = await prisma.valueStream.findFirst({ where: { id: parentRef.id, tenantId, companyId }, select: { id: true } });
    if (!stream) throw httpError('Parent value stream not found in this company', 400);
    const s = await prisma.subValueStream.create({ data: { tenantId, valueStreamId: stream.id, level: 3, name, ...descriptive(body) } });
    created = subRow(s); model = 'SubValueStream'; id = s.id;
  } else {
    const parent = await prisma.subValueStream.findFirst({ where: { id: parentRef.id, tenantId, valueStream: { companyId } }, select: { id: true, level: true, valueStreamId: true } });
    if (!parent) throw httpError('Parent process step not found in this company', 400);
    if (parent.level >= MAX_LEVEL) throw httpError(`Cannot nest deeper than L${MAX_LEVEL}`, 400);
    const s = await prisma.subValueStream.create({ data: { tenantId, valueStreamId: parent.valueStreamId, parentId: parent.id, level: parent.level + 1, name, ...descriptive(body) } });
    created = subRow(s); model = 'SubValueStream'; id = s.id;
  }

  logAudit({ tenantId, actorEmail, entityType: model, entityId: id, action: 'CREATE', diff: { name } });
  return created;
}

// PATCH — update name (+ descriptive fields for sub-levels). Level and parent
// are structural and not edited here.
export async function vsUpdate(tenantId: string, companyId: string, actorEmail: string, prefixed: string, body: Record<string, unknown>): Promise<Row | null> {
  const ref = decodeId(prefixed);
  if (!ref) return null;

  if (ref.kind === 'domain') {
    const before = await prisma.valueStreamDomain.findFirst({ where: { id: ref.id, tenantId, companyId } });
    if (!before) return null;
    const data = 'name' in body ? { name: str(body.name) ?? before.name } : {};
    const after = await prisma.valueStreamDomain.update({ where: { id: ref.id }, data });
    audit(tenantId, actorEmail, 'ValueStreamDomain', ref.id, before, after, ['name']);
    return domainRow(after);
  }
  if (ref.kind === 'stream') {
    const before = await prisma.valueStream.findFirst({ where: { id: ref.id, tenantId, companyId } });
    if (!before) return null;
    const data = 'name' in body ? { name: str(body.name) ?? before.name } : {};
    const after = await prisma.valueStream.update({ where: { id: ref.id }, data });
    audit(tenantId, actorEmail, 'ValueStream', ref.id, before, after, ['name']);
    return streamRow(after);
  }
  const before = await prisma.subValueStream.findFirst({ where: { id: ref.id, tenantId, valueStream: { companyId } } });
  if (!before) return null;
  const data: Record<string, unknown> = {};
  if ('name' in body) data.name = str(body.name) ?? before.name;
  for (const f of ['inputs', 'outputs', 'upstream', 'downstream', 'notes'] as const) {
    if (f in body) data[f] = str(body[f]);
  }
  const after = await prisma.subValueStream.update({ where: { id: ref.id }, data });
  audit(tenantId, actorEmail, 'SubValueStream', ref.id, before, after, ['name', 'inputs', 'outputs', 'upstream', 'downstream', 'notes']);
  return subRow(after);
}

// DELETE — removes the node (cascades to children for streams/sub-levels).
export async function vsDelete(tenantId: string, companyId: string, actorEmail: string, prefixed: string): Promise<boolean> {
  const ref = decodeId(prefixed);
  if (!ref) return false;
  if (ref.kind === 'domain') {
    const before = await prisma.valueStreamDomain.findFirst({ where: { id: ref.id, tenantId, companyId }, select: { id: true, name: true } });
    if (!before) return false;
    await prisma.valueStreamDomain.delete({ where: { id: ref.id } });
    logAudit({ tenantId, actorEmail, entityType: 'ValueStreamDomain', entityId: ref.id, action: 'DELETE', diff: { name: before.name } });
    return true;
  }
  if (ref.kind === 'stream') {
    const before = await prisma.valueStream.findFirst({ where: { id: ref.id, tenantId, companyId }, select: { id: true, name: true } });
    if (!before) return false;
    await prisma.valueStream.delete({ where: { id: ref.id } });
    logAudit({ tenantId, actorEmail, entityType: 'ValueStream', entityId: ref.id, action: 'DELETE', diff: { name: before.name } });
    return true;
  }
  const before = await prisma.subValueStream.findFirst({ where: { id: ref.id, tenantId, valueStream: { companyId } }, select: { id: true, name: true } });
  if (!before) return false;
  await prisma.subValueStream.delete({ where: { id: ref.id } });
  logAudit({ tenantId, actorEmail, entityType: 'SubValueStream', entityId: ref.id, action: 'DELETE', diff: { name: before.name } });
  return true;
}

function descriptive(body: Record<string, unknown>) {
  return {
    inputs: str(body.inputs),
    outputs: str(body.outputs),
    upstream: str(body.upstream),
    downstream: str(body.downstream),
    notes: str(body.notes),
  };
}

function audit(tenantId: string, actorEmail: string, model: string, id: string, before: Record<string, unknown>, after: Record<string, unknown>, fields: string[]) {
  const diff = computeDiff(before, after, fields);
  if (Object.keys(diff).length) {
    logAudit({ tenantId, actorEmail, entityType: model, entityId: id, action: 'UPDATE', diff });
  }
}

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}
