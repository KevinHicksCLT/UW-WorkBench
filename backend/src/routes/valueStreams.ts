import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { tenantValueStream } from '../lib/tenant.js';
import { legacyNamesFor } from '../lib/vsMapping.js';

const router = Router();
router.use(requireAuth);

type SubRow = {
  id: string;
  parentId: string | null;
  level: number;
  name: string;
  inputs: string | null;
  outputs: string | null;
  upstream: string | null;
  downstream: string | null;
  notes: string | null;
  depth: number;
};

// GET /value-streams — the canonical streams (value_stream nodes), with the
// parent division as the domain grouping.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nodes = await prisma.node.findMany({
      where: { typeKey: 'value_stream', company: { tenantId: req.tenantId } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, parent: { select: { name: true } } },
    });
    res.json(nodes.map((n) => ({ id: n.id, name: n.name, domain: n.parent?.name ?? null })));
  } catch (e) { next(e); }
});

// GET /value-streams/:id — stream + L3/L4 sub-streams (recursive CTE) +
// participating roles with their participation type.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Accept the canonical value_stream node id (the map / Telemetry namespace)
    // or a legacy ValueStream id. A node aggregates every legacy stream folded
    // into it by the 29→21 mapping.
    const node = await prisma.node.findFirst({
      where: { id: req.params.id, typeKey: 'value_stream', company: { tenantId: req.tenantId } },
      select: { id: true, name: true, companyId: true, parent: { select: { name: true } } },
    });
    let vsIds: string[];
    let header: { id: string; name: string; domain: string | null };
    if (node) {
      const rows = await prisma.valueStream.findMany({ where: { companyId: node.companyId, name: { in: legacyNamesFor(node.name) } }, select: { id: true } });
      vsIds = rows.map((r) => r.id);
      header = { id: node.id, name: node.name, domain: node.parent?.name ?? null };
    } else {
      const vs = await tenantValueStream(req.params.id, req.tenantId);
      if (!vs) return res.status(404).json({ error: 'Not found' });
      vsIds = [vs.id];
      header = { id: vs.id, name: vs.name, domain: vs.domain };
    }
    const vsIdsSafe = vsIds.length ? vsIds : ['_'];

    // Prisma can't express WITH RECURSIVE through the query builder, so the
    // L3→L4 sub-stream tree is a typed raw query. The id list is parameterized.
    const subStreams = await prisma.$queryRaw<SubRow[]>`
      WITH RECURSIVE tree AS (
        SELECT id, "parentId", level, name, inputs, outputs, upstream, downstream, notes, 0 AS depth
        FROM "SubValueStream"
        WHERE "valueStreamId" IN (${Prisma.join(vsIdsSafe)}) AND "parentId" IS NULL
        UNION ALL
        SELECT s.id, s."parentId", s.level, s.name, s.inputs, s.outputs, s.upstream, s.downstream, s.notes, tree.depth + 1
        FROM "SubValueStream" s
        JOIN tree ON s."parentId" = tree.id
      )
      SELECT id, "parentId", level, name, inputs, outputs, upstream, downstream, notes, depth FROM tree
      ORDER BY depth, name
    `;

    const roleLinks = await prisma.roleValueStream.findMany({
      where: { valueStreamId: { in: vsIdsSafe } },
      orderBy: [{ participationType: 'asc' }, { subStream: 'asc' }],
      include: { role: { select: { id: true, name: true, roleFamily: true } } },
    });

    // Process Areas & Sub-Processes — the canonical L3/L4 backbone comes from
    // SubValueStream in workbook (sourceRow) order, but the step list and the
    // inputs/outputs are pulled from the newer ProcessStep / IoItem model (the
    // SubValueStream L5 rows order alphabetically and lack lead/role detail).
    const [backbone, processSteps, ioItems] = await Promise.all([
      prisma.subValueStream.findMany({
        where: { valueStreamId: { in: vsIdsSafe }, level: { in: [3, 4] } },
        orderBy: { sourceRow: 'asc' },
        select: { id: true, parentId: true, level: true, name: true, notes: true },
      }),
      prisma.processStep.findMany({
        where: { valueStreamId: { in: vsIdsSafe } },
        orderBy: { stepNumber: 'asc' },
        select: { l3: true, l4: true, stepNumber: true, name: true, leads: true },
      }),
      prisma.ioItem.findMany({
        where: { valueStreamId: { in: vsIdsSafe } },
        select: { l3: true, l4: true, type: true, name: true },
      }),
    ]);

    // Index steps and I/O by their "L3 — L4" coordinate so each sub-process can
    // claim its own ordered steps + inputs/outputs.
    const key = (l3: string | null, l4: string | null) => `${l3 ?? ''}||${l4 ?? ''}`;
    const stepsByKey = new Map<string, { name: string; leads: string | null }[]>();
    for (const s of processSteps) {
      const k = key(s.l3, s.l4);
      if (!stepsByKey.has(k)) stepsByKey.set(k, []);
      stepsByKey.get(k)!.push({ name: s.name, leads: s.leads });
    }
    const ioByKey = new Map<string, { inputs: string[]; outputs: string[] }>();
    for (const io of ioItems) {
      const k = key(io.l3, io.l4);
      if (!ioByKey.has(k)) ioByKey.set(k, { inputs: [], outputs: [] });
      (io.type === 'Input' ? ioByKey.get(k)!.inputs : ioByKey.get(k)!.outputs).push(io.name);
    }

    const l3s = backbone.filter((s) => s.level === 3);
    const l4sByParent = new Map<string, typeof backbone>();
    for (const s of backbone) {
      if (s.level !== 4 || !s.parentId) continue;
      if (!l4sByParent.has(s.parentId)) l4sByParent.set(s.parentId, []);
      l4sByParent.get(s.parentId)!.push(s);
    }
    const subOf = (area: { id: string; name: string }) =>
      (l4sByParent.get(area.id) ?? []).map((sub) => {
        const k = key(area.name, sub.name);
        const io = ioByKey.get(k) ?? { inputs: [], outputs: [] };
        return {
          id: sub.id,
          name: sub.name,
          description: sub.notes,
          inputs: io.inputs,
          outputs: io.outputs,
          steps: stepsByKey.get(k) ?? [],
        };
      });
    const processAreas = l3s.map((area) => ({ id: area.id, name: area.name, subProcesses: subOf(area) }));

    res.json({
      id: header.id,
      name: header.name,
      domain: header.domain,
      subStreams, // retained for the Flow Map tab
      processAreas,
      roles: roleLinks.map((l) => ({
        roleId: l.roleId,
        roleName: l.role.name,
        participationType: l.participationType,
        subStream: l.subStream,
      })),
    });
  } catch (e) { next(e); }
});

export default router;
