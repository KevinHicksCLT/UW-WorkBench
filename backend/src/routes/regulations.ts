// Regulations API — the 50-state insurance regulatory baseline behind the
// Regulations tab. Read shapes for the three lenses (States / Requirements /
// Coverage) + the state detail page, and the transactional writes the UI
// needs (requirement create/edit, value-stream link replacement). Generic CRUD
// for every regulations entity additionally comes free via /admin/:entity.
// Scoped to tenant (JWT) + active company (?companyId, falling back to the
// tenant's first company); cross-company misses return 404, never 403.
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit, computeDiff } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

async function activeCompanyId(req: Request, res: Response): Promise<string | null> {
  const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  const company = await prisma.company.findFirst({
    where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!company) {
    res.status(404).json({ error: 'No company found' });
    return null;
  }
  return company.id;
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
// Multi-select filters arrive as comma-separated values.
const list = (v: unknown) => (typeof v === 'string' && v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);

// erd_v5: requirement ↔ value-stream is NodeRegulation (processNodeId → ProcessNode).
// The frontend still consumes `valueStreamLinks[]` as { valueStreamId, valueStream:
// { id, name }, relationship, notes }, so we include the node regulations and alias
// them through the ProcessNode displayValue.
const NODE_REG_INCLUDE = { nodeRegulations: { include: { processNode: { select: { id: true, displayValue: true } } } } } as const;

type NodeRegRow = { id: string; processNodeId: string; relationship: string; notes: string | null; processNode: { id: string; displayValue: string } };
function withValueStreamLinks<T extends { nodeRegulations: NodeRegRow[] }>(r: T) {
  const { nodeRegulations, ...rest } = r;
  return {
    ...rest,
    valueStreamLinks: nodeRegulations.map((n) => ({
      id: n.id,
      valueStreamId: n.processNodeId,
      relationship: n.relationship,
      notes: n.notes,
      valueStream: { id: n.processNode.id, name: n.processNode.displayValue },
    })),
  };
}

// ── Overview ──────────────────────────────────────────────────────────────────
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const [jurisdictions, reqByCategory, reqByConfidence, requirementCount, mappedCount, bulletinCount, ruleCount, sourceCount, coverage] = await Promise.all([
      prisma.jurisdiction.findMany({ where: { companyId, regulatorType: { not: 'FEDERAL_SECURITIES' } }, select: { filingPortal: true, compactStatus: true, autoVerification: true, workersCompModel: true, apcd: true, sbs: true, priorityTier: true, profileDepth: true, lastVerifiedAt: true } }),
      prisma.regulatoryRequirement.groupBy({ by: ['category'], where: { companyId, status: 'ACTIVE' }, _count: true }),
      prisma.regulatoryRequirement.groupBy({ by: ['confidence'], where: { companyId, status: 'ACTIVE' }, _count: true }),
      prisma.regulatoryRequirement.count({ where: { companyId, status: 'ACTIVE' } }),
      prisma.regulatoryRequirement.count({ where: { companyId, status: 'ACTIVE', nodeRegulations: { some: {} } } }),
      prisma.regulatoryBulletin.count({ where: { companyId } }),
      prisma.complianceRule.count({ where: { companyId, active: true } }),
      prisma.regulatorySource.count({ where: { companyId } }),
      prisma.nodeRegulation.groupBy({ by: ['processNodeId'], where: { regulation: { companyId, status: 'ACTIVE' } }, _count: true }),
    ]);
    const tally = (key: keyof (typeof jurisdictions)[number]) => {
      const out: Record<string, number> = {};
      for (const j of jurisdictions) { const v = String(j[key] ?? ''); out[v] = (out[v] ?? 0) + 1; }
      return out;
    };
    // All company value-stream NODES (level 2) — the UI's filter dropdown, link
    // editor, and Coverage lens need the full option list. Exposed as { id, name }
    // via the editable displayValue.
    const vsNodes = await prisma.processNode.findMany({ where: { companyId, processLevelType: { levelNumber: 2 } }, select: { id: true, displayValue: true }, orderBy: { displayValue: 'asc' } });
    const valueStreams = vsNodes.map((v) => ({ id: v.id, name: v.displayValue }));
    const vsName = new Map(valueStreams.map((v) => [v.id, v.name]));
    res.json({
      jurisdictionCount: jurisdictions.length,
      flags: {
        filingPortal: tally('filingPortal'), compactStatus: tally('compactStatus'),
        autoVerification: tally('autoVerification'), workersCompModel: tally('workersCompModel'),
        apcd: tally('apcd'), sbs: tally('sbs'), priorityTier: tally('priorityTier'), profileDepth: tally('profileDepth'),
      },
      requirements: {
        total: requirementCount,
        mapped: mappedCount,
        unmapped: requirementCount - mappedCount,
        byCategory: Object.fromEntries(reqByCategory.map((r) => [r.category, r._count])),
        byConfidence: Object.fromEntries(reqByConfidence.map((r) => [r.confidence, r._count])),
      },
      coverageByValueStream: coverage
        .map((c) => ({ valueStreamId: c.processNodeId, valueStream: vsName.get(c.processNodeId) ?? null, requirementCount: c._count }))
        .sort((a, b) => b.requirementCount - a.requirementCount),
      bulletinCount, ruleCount, sourceCount,
      verifiedJurisdictions: jurisdictions.filter((j) => j.lastVerifiedAt).length,
      valueStreams,
    });
  } catch (e) { next(e); }
});

// ── States lens ───────────────────────────────────────────────────────────────
router.get('/jurisdictions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const q = req.query;
    // States lens covers state insurance regulators only — federal securities
    // regulators (FINRA/SEC/MSRB) carry no state flags and surface in the
    // Requirements/Coverage lenses instead.
    const where: Record<string, unknown> = { companyId, regulatorType: { not: 'FEDERAL_SECURITIES' } };
    for (const f of ['filingPortal', 'compactStatus', 'autoVerification', 'workersCompModel', 'apcd', 'sbs', 'priorityTier', 'profileDepth'] as const) {
      const vals = list(q[f]);
      if (vals) where[f] = vals.length === 1 ? vals[0] : { in: vals };
    }
    if (str(q.code)) where.code = String(q.code).toUpperCase();
    if (str(q.search)) {
      where.OR = [
        { name: { contains: String(q.search), mode: 'insensitive' } },
        { code: { equals: String(q.search).toUpperCase() } },
        { regulatorName: { contains: String(q.search), mode: 'insensitive' } },
      ];
    }
    const rows = await prisma.jurisdiction.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true, code: true, name: true, regulatorName: true, regulatorWebsite: true,
        filingPortal: true, filingPortalDetail: true, compactStatus: true,
        autoVerification: true, autoVerificationDetail: true,
        workersCompModel: true, workersCompDetail: true, apcd: true, sbs: true,
        priorityTier: true, profileDepth: true, lastReviewedAt: true, lastVerifiedAt: true, updatedAt: true,
        _count: { select: { requirements: true, bulletins: true, rules: true, integrations: true, sources: true } },
      },
    });
    res.json(rows);
  } catch (e) { next(e); }
});

// State detail — accepts the row id or the USPS code (the UI routes by code).
router.get('/jurisdictions/:idOrCode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const p = req.params.idOrCode;
    const jur = await prisma.jurisdiction.findFirst({
      where: { companyId, OR: [{ id: p }, { code: p.toUpperCase() }] },
      include: {
        requirements: {
          orderBy: [{ category: 'asc' }, { title: 'asc' }],
          include: NODE_REG_INCLUDE,
        },
        integrations: { include: { system: true }, orderBy: { system: { name: 'asc' } } },
        bulletins: { orderBy: [{ issuedDate: 'desc' }, { reference: 'desc' }] },
        rules: { orderBy: { ruleCode: 'asc' } },
        sources: { orderBy: [{ sourceType: 'asc' }, { name: 'asc' }] },
      },
    });
    if (!jur) return res.status(404).json({ error: 'Not found' });
    res.json({ ...jur, requirements: jur.requirements.map(withValueStreamLinks) });
  } catch (e) { next(e); }
});

// ── Federal / National lens ───────────────────────────────────────────────────
// National / supranational regulators carry no state taxonomy flags, so they are
// excluded from the States lens. Here they are organized by country/union so the
// federal securities regime (FINRA/SEC/MSRB, E-02) is findable. The map is keyed
// by regulatorType so other countries/unions (EU, UK, …) can be added later.
const FEDERAL_GROUP: Record<string, { country: string; countryCode: string; level: string }> = {
  FEDERAL_SECURITIES: { country: 'United States', countryCode: 'US', level: 'Federal — Securities & Markets' },
};
router.get('/federal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const rows = await prisma.jurisdiction.findMany({
      where: { companyId, regulatorType: { in: Object.keys(FEDERAL_GROUP) } },
      orderBy: { code: 'asc' },
      select: {
        id: true, code: true, name: true, regulatorName: true, regulatorWebsite: true,
        regulatorType: true, summaryRegulator: true, lastVerifiedAt: true, updatedAt: true,
        requirements: {
          where: { status: 'ACTIVE' },
          orderBy: [{ category: 'asc' }, { title: 'asc' }],
          select: {
            id: true, title: true, category: true, requirement: true, citation: true, citationUrl: true,
            obligationType: true, lineOfBusiness: true, confidence: true,
            ...NODE_REG_INCLUDE,
          },
        },
      },
    });
    const byCountry = new Map<string, { country: string; countryCode: string; regulators: unknown[] }>();
    for (const j of rows) {
      const g = FEDERAL_GROUP[j.regulatorType] ?? { country: 'Other', countryCode: 'XX', level: 'National' };
      if (!byCountry.has(g.country)) byCountry.set(g.country, { country: g.country, countryCode: g.countryCode, regulators: [] });
      byCountry.get(g.country)!.regulators.push({
        id: j.id, code: j.code, name: j.name, regulatorName: j.regulatorName,
        regulatorWebsite: j.regulatorWebsite, level: g.level, summary: j.summaryRegulator,
        lastVerifiedAt: j.lastVerifiedAt, updatedAt: j.updatedAt,
        requirements: j.requirements.map(withValueStreamLinks),
      });
    }
    res.json({ groups: [...byCountry.values()] });
  } catch (e) { next(e); }
});

// ── Requirements lens ─────────────────────────────────────────────────────────
router.get('/requirements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const q = req.query;
    const where: Record<string, unknown> = { companyId };
    for (const f of ['category', 'lineOfBusiness', 'obligationType', 'status', 'confidence'] as const) {
      const vals = list(q[f]);
      if (vals) where[f] = vals.length === 1 ? vals[0] : { in: vals };
    }
    if (!where.status) where.status = 'ACTIVE';
    const states = list(q.state);
    if (states) where.jurisdiction = { code: { in: states.map((s) => s.toUpperCase()) } };
    if (str(q.valueStreamId)) where.nodeRegulations = { some: { processNodeId: String(q.valueStreamId) } };
    if (q.unmapped === '1') where.nodeRegulations = { none: {} };
    if (str(q.search)) {
      where.OR = [
        { title: { contains: String(q.search), mode: 'insensitive' } },
        { requirement: { contains: String(q.search), mode: 'insensitive' } },
        { citation: { contains: String(q.search), mode: 'insensitive' } },
      ];
    }
    const rows = await prisma.regulatoryRequirement.findMany({
      where,
      orderBy: [{ jurisdiction: { name: 'asc' } }, { category: 'asc' }, { title: 'asc' }],
      include: {
        jurisdiction: { select: { id: true, code: true, name: true, priorityTier: true } },
        ...NODE_REG_INCLUDE,
      },
    });
    res.json(rows.map(withValueStreamLinks));
  } catch (e) { next(e); }
});

const requirementSchema = z.object({
  jurisdictionId: z.string().min(1),
  category: z.string().min(1),
  title: z.string().min(1),
  requirement: z.string().min(1),
  lineOfBusiness: z.string().optional(),
  citation: z.string().nullable().optional(),
  citationUrl: z.string().nullable().optional(),
  obligationType: z.string().optional(),
  frequency: z.string().nullable().optional(),
  status: z.string().optional(),
  effectiveDate: z.string().nullable().optional(),
  confidence: z.string().optional(),
  sourceNote: z.string().nullable().optional(),
});

router.post('/requirements', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const body = requirementSchema.parse(req.body);
    const jur = await prisma.jurisdiction.findFirst({ where: { id: body.jurisdictionId, companyId }, select: { id: true } });
    if (!jur) return res.status(404).json({ error: 'Jurisdiction not found' });
    const row = await prisma.regulatoryRequirement.create({
      data: {
        tenantId: req.tenantId, companyId, jurisdictionId: jur.id,
        category: body.category, title: body.title, requirement: body.requirement,
        lineOfBusiness: body.lineOfBusiness ?? 'ALL',
        citation: body.citation ?? null, citationUrl: body.citationUrl ?? null,
        obligationType: body.obligationType ?? 'ONGOING',
        frequency: body.frequency ?? null,
        status: body.status ?? 'ACTIVE',
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : null,
        confidence: body.confidence ?? 'BASELINE',
        sourceNote: body.sourceNote ?? 'manually created',
      },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'regulatoryRequirement', entityId: row.id, action: 'CREATE', diff: { title: row.title, jurisdictionId: row.jurisdictionId } });
    res.status(201).json(row);
  } catch (e) { next(e); }
});

const EDITABLE = ['category', 'title', 'requirement', 'lineOfBusiness', 'citation', 'citationUrl', 'obligationType', 'frequency', 'status', 'effectiveDate', 'confidence', 'sourceNote'] as const;

router.patch('/requirements/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const before = await prisma.regulatoryRequirement.findFirst({ where: { id: req.params.id, companyId } });
    if (!before) return res.status(404).json({ error: 'Not found' });
    const body = requirementSchema.partial().parse(req.body);
    const data: Record<string, unknown> = {};
    for (const f of EDITABLE) {
      if (!(f in body)) continue;
      data[f] = f === 'effectiveDate' && body.effectiveDate ? new Date(body.effectiveDate) : (body as Record<string, unknown>)[f];
    }
    const row = await prisma.regulatoryRequirement.update({ where: { id: before.id }, data });
    logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'regulatoryRequirement', entityId: row.id, action: 'UPDATE',
      diff: computeDiff(before as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>, [...EDITABLE]),
    });
    res.json(row);
  } catch (e) { next(e); }
});

// Replace a requirement's full value-stream link set.
const linksSchema = z.object({
  links: z.array(z.object({
    valueStreamId: z.string().min(1),
    relationship: z.enum(['GOVERNS', 'REQUIRES_INTEGRATION', 'INFORMS']).default('GOVERNS'),
    notes: z.string().nullable().optional(),
  })),
});

router.put('/requirements/:id/value-streams', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const requirement = await prisma.regulatoryRequirement.findFirst({ where: { id: req.params.id, companyId }, select: { id: true, companyId: true } });
    if (!requirement) return res.status(404).json({ error: 'Not found' });
    const { links } = linksSchema.parse(req.body);
    // Validate every target value-stream NODE belongs to the company before writing.
    const ids = [...new Set(links.map((l) => l.valueStreamId))];
    const owned = await prisma.processNode.count({ where: { id: { in: ids }, companyId } });
    if (owned !== ids.length) return res.status(404).json({ error: 'Value stream not found' });
    const result = await prisma.$transaction(async (tx) => {
      await tx.nodeRegulation.deleteMany({ where: { regId: requirement.id } });
      for (const l of links) {
        await tx.nodeRegulation.create({
          data: { companyId: requirement.companyId, regId: requirement.id, processNodeId: l.valueStreamId, relationship: l.relationship, notes: l.notes ?? null },
        });
      }
      return tx.nodeRegulation.findMany({
        where: { regId: requirement.id },
        include: { processNode: { select: { id: true, displayValue: true } } },
      });
    });
    logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'regulatoryRequirement', entityId: requirement.id, action: 'SET_VALUE_STREAMS',
      diff: { links: links.map((l) => ({ valueStreamId: l.valueStreamId, relationship: l.relationship })) },
    });
    // Return the link rows in the frontend's valueStreamLinks shape.
    res.json(result.map((n) => ({
      id: n.id, valueStreamId: n.processNodeId, relationship: n.relationship, notes: n.notes,
      valueStream: { id: n.processNode.id, name: n.processNode.displayValue },
    })));
  } catch (e) { next(e); }
});

// ── Integrations matrix ───────────────────────────────────────────────────────
router.get('/integrations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const [systems, usages] = await Promise.all([
      prisma.integrationSystem.findMany({ where: { companyId }, orderBy: { name: 'asc' } }),
      prisma.jurisdictionIntegration.findMany({
        where: { jurisdiction: { companyId } },
        include: { jurisdiction: { select: { code: true, name: true } } },
      }),
    ]);
    res.json({
      systems,
      usages: usages.map((u) => ({
        systemId: u.systemId, jurisdictionCode: u.jurisdiction.code, jurisdictionName: u.jurisdiction.name,
        usage: u.usage, scope: u.scope, notes: u.notes,
      })),
    });
  } catch (e) { next(e); }
});

// ── Bulletins feed ────────────────────────────────────────────────────────────
router.get('/bulletins', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const q = req.query;
    const where: Record<string, unknown> = { companyId };
    const states = list(q.state);
    if (states) where.jurisdiction = { code: { in: states.map((s) => s.toUpperCase()) } };
    if (str(q.discoveredVia)) where.discoveredVia = String(q.discoveredVia);
    if (str(q.from) || str(q.to)) {
      where.issuedDate = {
        ...(str(q.from) ? { gte: new Date(String(q.from)) } : {}),
        ...(str(q.to) ? { lte: new Date(String(q.to)) } : {}),
      };
    }
    const rows = await prisma.regulatoryBulletin.findMany({
      where,
      orderBy: [{ issuedDate: 'desc' }, { createdAt: 'desc' }],
      include: { jurisdiction: { select: { code: true, name: true } } },
    });
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
