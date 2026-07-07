/**
 * Regulations read lenses — Overview, States (jurisdictions), Federal,
 * International, and the Requirements list. Read-only handlers; the
 * value-stream chips are rolled up from task-level NodeRegulation rows via
 * vsForRegulations (lib/govRollup.ts).
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { vsForRegulations } from '../../lib/govRollup.js';
import { activeCompanyId, str, list, NODE_REG_INCLUDE, withValueStreamLinks } from './helpers.js';

/** Registers the five read-lens GET routes on the shared regulations router. */
export function registerLensRoutes(router: Router): void {
  // ── Overview ──────────────────────────────────────────────────────────────────
  router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const [
        jurisdictions,
        reqByCategory,
        reqByConfidence,
        requirementCount,
        mappedCount,
        bulletinCount,
        ruleCount,
        sourceCount,
        coverage,
      ] = await Promise.all([
        prisma.jurisdiction.findMany({
          where: { companyId, regulatorType: { notIn: ['FEDERAL_SECURITIES', 'INTERNATIONAL'] } },
          select: {
            filingPortal: true,
            compactStatus: true,
            autoVerification: true,
            workersCompModel: true,
            apcd: true,
            sbs: true,
            priorityTier: true,
            profileDepth: true,
            lastVerifiedAt: true,
          },
        }),
        prisma.regulatoryRequirement.groupBy({
          by: ['category'],
          where: { companyId, status: 'ACTIVE' },
          _count: true,
        }),
        prisma.regulatoryRequirement.groupBy({
          by: ['confidence'],
          where: { companyId, status: 'ACTIVE' },
          _count: true,
        }),
        prisma.regulatoryRequirement.count({ where: { companyId, status: 'ACTIVE' } }),
        prisma.regulatoryRequirement.count({
          where: { companyId, status: 'ACTIVE', nodeRegulations: { some: {} } },
        }),
        prisma.regulatoryBulletin.count({ where: { companyId } }),
        prisma.complianceRule.count({ where: { companyId, active: true } }),
        prisma.regulatorySource.count({ where: { companyId } }),
        // Coverage rolls task-grain NodeRegulation rows up to their L2 value
        // stream through the closure — distinct regulations per stream (the raw
        // groupBy would count task nodes, which carry no display name).
        prisma.$queryRaw<{ id: string; name: string; cnt: number }[]>(Prisma.sql`
        SELECT vs.id, vs."displayValue" AS name, COUNT(DISTINCT nr."regId")::int AS cnt
        FROM public."NodeRegulation" nr
        JOIN public."RegulatoryRequirement" r ON r.id = nr."regId" AND r."companyId" = ${companyId} AND r.status = 'ACTIVE'
        JOIN public."ProcessNodeClosure" c ON c."descendantId" = nr."processNodeId"
        JOIN public."ProcessNode" vs ON vs.id = c."ancestorId"
        JOIN public."ProcessLevelType" plt ON plt.id = vs."processLevelTypeId" AND plt."levelNumber" = 2
        WHERE NOT nr.excluded
        GROUP BY 1, 2`),
      ]);
      const tally = (key: keyof (typeof jurisdictions)[number]) => {
        const out: Record<string, number> = {};
        for (const j of jurisdictions) {
          const v = String(j[key] ?? '');
          out[v] = (out[v] ?? 0) + 1;
        }
        return out;
      };
      // All company value-stream NODES (level 2) — the UI's filter dropdown, link
      // editor, and Coverage lens need the full option list. Exposed as { id, name }
      // via the editable displayValue.
      const vsNodes = await prisma.processNode.findMany({
        where: { companyId, processLevelType: { levelNumber: 2 } },
        select: { id: true, displayValue: true },
        orderBy: { displayValue: 'asc' },
      });
      const valueStreams = vsNodes.map((v) => ({ id: v.id, name: v.displayValue }));
      const vsName = new Map(valueStreams.map((v) => [v.id, v.name]));
      res.json({
        jurisdictionCount: jurisdictions.length,
        flags: {
          filingPortal: tally('filingPortal'),
          compactStatus: tally('compactStatus'),
          autoVerification: tally('autoVerification'),
          workersCompModel: tally('workersCompModel'),
          apcd: tally('apcd'),
          sbs: tally('sbs'),
          priorityTier: tally('priorityTier'),
          profileDepth: tally('profileDepth'),
        },
        requirements: {
          total: requirementCount,
          mapped: mappedCount,
          unmapped: requirementCount - mappedCount,
          byCategory: Object.fromEntries(reqByCategory.map((r) => [r.category, r._count])),
          byConfidence: Object.fromEntries(reqByConfidence.map((r) => [r.confidence, r._count])),
        },
        coverageByValueStream: coverage
          .map((c) => ({
            valueStreamId: c.id,
            valueStream: vsName.get(c.id) ?? c.name,
            requirementCount: c.cnt,
          }))
          .sort((a, b) => b.requirementCount - a.requirementCount),
        bulletinCount,
        ruleCount,
        sourceCount,
        verifiedJurisdictions: jurisdictions.filter((j) => j.lastVerifiedAt).length,
        valueStreams,
      });
    } catch (e) {
      next(e);
    }
  });

  // ── States lens ───────────────────────────────────────────────────────────────
  router.get('/jurisdictions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const q = req.query;
      // States lens covers state insurance regulators only — federal securities
      // (FINRA/SEC/MSRB) and international (EU/GDPR) regulators carry no state flags
      // and surface in the Federal / International lenses instead.
      const where: Record<string, unknown> = {
        companyId,
        regulatorType: { notIn: ['FEDERAL_SECURITIES', 'INTERNATIONAL'] },
      };
      for (const f of [
        'filingPortal',
        'compactStatus',
        'autoVerification',
        'workersCompModel',
        'apcd',
        'sbs',
        'priorityTier',
        'profileDepth',
      ] as const) {
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
          id: true,
          code: true,
          name: true,
          regulatorName: true,
          regulatorWebsite: true,
          filingPortal: true,
          filingPortalDetail: true,
          compactStatus: true,
          autoVerification: true,
          autoVerificationDetail: true,
          workersCompModel: true,
          workersCompDetail: true,
          apcd: true,
          sbs: true,
          priorityTier: true,
          profileDepth: true,
          lastReviewedAt: true,
          lastVerifiedAt: true,
          updatedAt: true,
          _count: {
            select: {
              requirements: { where: { status: 'ACTIVE' } },
              bulletins: true,
              rules: true,
              integrations: true,
              sources: true,
            },
          },
        },
      });
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });

  // State detail — accepts the row id or the USPS code (the UI routes by code).
  router.get(
    '/jurisdictions/:idOrCode',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const p = req.params.idOrCode;
        const jur = await prisma.jurisdiction.findFirst({
          where: { companyId, OR: [{ id: p }, { code: p.toUpperCase() }] },
          include: {
            requirements: {
              where: { status: 'ACTIVE' },
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
        const vsMap = await vsForRegulations(jur.requirements.map((r) => r.id));
        res.json({
          ...jur,
          requirements: jur.requirements.map((r) => withValueStreamLinks(r, vsMap)),
        });
      } catch (e) {
        next(e);
      }
    },
  );

  // ── Federal / National lens ───────────────────────────────────────────────────
  // National / supranational regulators carry no state taxonomy flags, so they are
  // excluded from the States lens. Here they are organized by country/union so the
  // federal securities regime (FINRA/SEC/MSRB, E-02) is findable. The map is keyed
  // by regulatorType so other countries/unions (EU, UK, …) can be added later.
  const FEDERAL_GROUP: Record<string, { country: string; countryCode: string; level: string }> = {
    FEDERAL_SECURITIES: {
      country: 'United States',
      countryCode: 'US',
      level: 'Federal — Securities & Markets',
    },
  };
  router.get('/federal', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const rows = await prisma.jurisdiction.findMany({
        where: { companyId, regulatorType: { in: Object.keys(FEDERAL_GROUP) } },
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          regulatorName: true,
          regulatorWebsite: true,
          regulatorType: true,
          summaryRegulator: true,
          lastVerifiedAt: true,
          updatedAt: true,
          requirements: {
            where: { status: 'ACTIVE' },
            orderBy: [{ category: 'asc' }, { title: 'asc' }],
            select: {
              id: true,
              title: true,
              category: true,
              requirement: true,
              citation: true,
              citationUrl: true,
              obligationType: true,
              lineOfBusiness: true,
              confidence: true,
              regime: true,
              ...NODE_REG_INCLUDE,
            },
          },
        },
      });
      const vsMap = await vsForRegulations(rows.flatMap((j) => j.requirements.map((r) => r.id)));
      const byCountry = new Map<
        string,
        { country: string; countryCode: string; regulators: unknown[] }
      >();
      for (const j of rows) {
        const g = FEDERAL_GROUP[j.regulatorType] ?? {
          country: 'Other',
          countryCode: 'XX',
          level: 'National',
        };
        if (!byCountry.has(g.country))
          byCountry.set(g.country, {
            country: g.country,
            countryCode: g.countryCode,
            regulators: [],
          });
        byCountry.get(g.country)!.regulators.push({
          id: j.id,
          code: j.code,
          name: j.name,
          regulatorName: j.regulatorName,
          regulatorWebsite: j.regulatorWebsite,
          level: g.level,
          summary: j.summaryRegulator,
          lastVerifiedAt: j.lastVerifiedAt,
          updatedAt: j.updatedAt,
          requirements: j.requirements.map((r) => withValueStreamLinks(r, vsMap)),
        });
      }
      res.json({ groups: [...byCountry.values()] });
    } catch (e) {
      next(e);
    }
  });

  // ── International lens (FB-60) ─────────────────────────────────────────────────
  // Non-US / supranational regulators (EU/GDPR today). Same regulator-grouped shape
  // as the Federal lens, keyed by regulatorType so other regimes (UK ICO, etc.) can
  // be added later. The migrated GDPR obligations (FB-59) surface here.
  const INTERNATIONAL_GROUP: Record<string, { region: string; regionCode: string; level: string }> =
    {
      INTERNATIONAL: {
        region: 'European Union',
        regionCode: 'EU',
        level: 'International — Data Protection',
      },
    };
  router.get('/international', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const rows = await prisma.jurisdiction.findMany({
        where: { companyId, regulatorType: { in: Object.keys(INTERNATIONAL_GROUP) } },
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          regulatorName: true,
          regulatorWebsite: true,
          regulatorType: true,
          summaryRegulator: true,
          lastVerifiedAt: true,
          updatedAt: true,
          requirements: {
            where: { status: 'ACTIVE' },
            orderBy: [{ category: 'asc' }, { title: 'asc' }],
            select: {
              id: true,
              title: true,
              category: true,
              requirement: true,
              citation: true,
              citationUrl: true,
              obligationType: true,
              lineOfBusiness: true,
              confidence: true,
              agentSkill: true,
              regime: true,
              ...NODE_REG_INCLUDE,
            },
          },
        },
      });
      const vsMap = await vsForRegulations(rows.flatMap((j) => j.requirements.map((r) => r.id)));
      const byRegion = new Map<
        string,
        { country: string; countryCode: string; regulators: unknown[] }
      >();
      for (const j of rows) {
        const g = INTERNATIONAL_GROUP[j.regulatorType] ?? {
          region: 'Other',
          regionCode: 'XX',
          level: 'International',
        };
        if (!byRegion.has(g.region))
          byRegion.set(g.region, { country: g.region, countryCode: g.regionCode, regulators: [] });
        byRegion.get(g.region)!.regulators.push({
          id: j.id,
          code: j.code,
          name: j.name,
          regulatorName: j.regulatorName,
          regulatorWebsite: j.regulatorWebsite,
          level: g.level,
          summary: j.summaryRegulator,
          lastVerifiedAt: j.lastVerifiedAt,
          updatedAt: j.updatedAt,
          requirements: j.requirements.map((r) => withValueStreamLinks(r, vsMap)),
        });
      }
      res.json({ groups: [...byRegion.values()] });
    } catch (e) {
      next(e);
    }
  });

  // ── Requirements lens ─────────────────────────────────────────────────────────
  router.get('/requirements', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const q = req.query;
      const where: Record<string, unknown> = { companyId };
      for (const f of [
        'category',
        'lineOfBusiness',
        'obligationType',
        'status',
        'confidence',
      ] as const) {
        const vals = list(q[f]);
        if (vals) where[f] = vals.length === 1 ? vals[0] : { in: vals };
      }
      if (!where.status) where.status = 'ACTIVE';
      const states = list(q.state);
      if (states) where.jurisdiction = { code: { in: states.map((s) => s.toUpperCase()) } };
      // Rows live on tasks; "in this value stream" = any linked task under the VS.
      if (str(q.valueStreamId))
        where.nodeRegulations = {
          some: {
            processNode: { descendantEdges: { some: { ancestorId: String(q.valueStreamId) } } },
          },
        };
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
          // Combined-columns merge (FB-61): the requirement row also surfaces its
          // jurisdiction's key state flags, so include them here.
          jurisdiction: {
            select: {
              id: true,
              code: true,
              name: true,
              priorityTier: true,
              regulatorType: true,
              filingPortal: true,
              compactStatus: true,
            },
          },
          ...NODE_REG_INCLUDE,
        },
      });
      const vsMap = await vsForRegulations(rows.map((r) => r.id));
      res.json(rows.map((r) => withValueStreamLinks(r, vsMap)));
    } catch (e) {
      next(e);
    }
  });

  // ── Single regulation detail ──────────────────────────────────────────────────
  // Full record behind /regulations/requirement/:id — every scalar, the issuing
  // jurisdiction, owner/contributor roles, value-stream rollup, and any
  // bulletins that reference the requirement.
  router.get('/requirements/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const row = await prisma.regulatoryRequirement.findFirst({
        where: { id: req.params.id, companyId },
        include: {
          jurisdiction: {
            select: {
              id: true,
              code: true,
              name: true,
              regulatorName: true,
              regulatorWebsite: true,
              priorityTier: true,
              regulatorType: true,
            },
          },
          bulletins: {
            orderBy: [{ issuedDate: 'desc' }],
            select: {
              id: true,
              reference: true,
              title: true,
              summary: true,
              url: true,
              issuedDate: true,
            },
          },
          ...NODE_REG_INCLUDE,
        },
      });
      if (!row) return res.status(404).json({ error: 'Not found' });
      const vsMap = await vsForRegulations([row.id]);
      res.json(withValueStreamLinks(row, vsMap));
    } catch (e) {
      next(e);
    }
  });
}
