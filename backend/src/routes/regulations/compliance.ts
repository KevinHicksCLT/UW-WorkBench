/**
 * Compliance register reads (SCRUM-46 v2) — the three-level determination-ready
 * register: ComplianceRegulation (L1, REG-###) → ComplianceItem (L2,
 * REG-###-C##) → RegulatoryRequirement L3 source rows linked via
 * complianceRegulationId. Counts must reconcile exactly with the frozen v2
 * workbook Summary (538 / 4,089 / 23,928 / 23,664 / 264 / 51) until the app
 * mutates the register. Items are determination-READY, not determinations —
 * nothing is authoritative until signOff = CONFIRMED.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { activeCompanyId, str, list, lensRegulatorTypes } from './helpers.js';

/**
 * Classifies every regulation in the register into ONE lens (state / federal /
 * international) by the majority regulator type of its linked L3 source rows —
 * so per-lens tile counts always sum back to the workbook totals. Derived at
 * read time from the FK linkage (one grouped query), never stored.
 */
async function regulationLensMap(companyId: string): Promise<Map<string, string>> {
  const rows = await prisma.$queryRaw<
    { regId: string; regulatorType: string; n: bigint }[]
  >(Prisma.sql`
    SELECT rr."complianceRegulationId" AS "regId", j."regulatorType", count(*)::bigint AS n
    FROM "RegulatoryRequirement" rr
    JOIN "Jurisdiction" j ON j.id = rr."jurisdictionId"
    WHERE rr."companyId" = ${companyId} AND rr."complianceRegulationId" IS NOT NULL
    GROUP BY 1, 2
  `);
  const toLens = (rt: string) =>
    rt === 'INTERNATIONAL' ? 'international' : rt.startsWith('FEDERAL') ? 'federal' : 'state';
  const tally = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const perReg = tally.get(r.regId) ?? new Map<string, number>();
    const lens = toLens(r.regulatorType);
    perReg.set(lens, (perReg.get(lens) ?? 0) + Number(r.n));
    tally.set(r.regId, perReg);
  }
  const map = new Map<string, string>();
  for (const [regId, perReg] of tally) {
    let best = 'state';
    let bestN = -1;
    for (const [lens, n] of perReg) if (n > bestN) [best, bestN] = [lens, n];
    map.set(regId, best);
  }
  return map;
}

/** Regulation ids belonging to a lens, or null when no lens filter applies. */
async function lensRegulationIds(companyId: string, lens: unknown): Promise<string[] | null> {
  const v = str(lens);
  if (!v || !['state', 'federal', 'international'].includes(v)) return null;
  const map = await regulationLensMap(companyId);
  return [...map.entries()].filter(([, l]) => l === v).map(([id]) => id);
}

const ITEM_LIST_SELECT = {
  id: true,
  itemCode: true,
  name: true,
  ownerTeam: true,
  frequency: true,
  evidence: true,
  jurisdictionScope: true,
  supportingReqRows: true,
  groundingBasis: true,
  officialSourceRows: true,
  frequencyAlignment: true,
  determinationStatus: true,
  confidence: true,
  signOff: true,
  reviewer: true,
} as const;

/** Registers the compliance-register read routes on the shared regulations router. */
export function registerComplianceRoutes(router: Router): void {
  // Register-wide reconciliation tiles + workflow progress.
  router.get(
    '/compliance-register/summary',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        // Optional ?lens=state|federal|international scopes every tile to the
        // regulations classified into that lens (per-lens tiles sum to the
        // workbook totals). Informational rows carry no regulation link, so
        // they scope by their own jurisdiction's regulator type.
        const regIds = await lensRegulationIds(companyId, req.query.lens);
        const regScope = regIds ? { regulationId: { in: regIds } } : {};
        const itemWhere = { companyId, ...regScope };
        const lensTypes = regIds ? lensRegulatorTypes(req.query.lens) : null;
        const [
          regulations,
          items,
          binding,
          informational,
          signOffRows,
          confidenceRows,
          grounding,
          variants,
          promoted,
        ] = await Promise.all([
          regIds
            ? Promise.resolve(regIds.length)
            : prisma.complianceRegulation.count({ where: { companyId } }),
          prisma.complianceItem.count({ where: itemWhere }),
          prisma.regulatoryRequirement.count({
            where: {
              companyId,
              complianceRequired: true,
              ...(regIds ? { complianceRegulationId: { in: regIds } } : {}),
            },
          }),
          prisma.regulatoryRequirement.count({
            where: {
              companyId,
              complianceRequired: false,
              ...(lensTypes ? { jurisdiction: { regulatorType: { in: lensTypes } } } : {}),
            },
          }),
          prisma.complianceItem.groupBy({ by: ['signOff'], where: itemWhere, _count: true }),
          prisma.complianceItem.groupBy({ by: ['confidence'], where: itemWhere, _count: true }),
          prisma.complianceItem.groupBy({
            by: ['groundingBasis'],
            where: itemWhere,
            _count: true,
          }),
          prisma.complianceJurisdictionVariant.count({ where: itemWhere }),
          prisma.complianceJurisdictionVariant.count({
            where: { ...itemWhere, promotedItemId: { not: null } },
          }),
        ]);
        const tally = (
          rows: { _count: number }[],
          key: string,
          field: 'signOff' | 'confidence' | 'groundingBasis',
        ) =>
          (rows as Array<Record<string, unknown> & { _count: number }>).find(
            (r) => r[field] === key,
          )?._count ?? 0;
        res.json({
          regulations,
          items,
          requirementRows: { total: binding + informational, binding, informational },
          signOff: {
            pending: tally(signOffRows, 'PENDING', 'signOff'),
            confirmed: tally(signOffRows, 'CONFIRMED', 'signOff'),
            rejected: tally(signOffRows, 'REJECTED', 'signOff'),
            needsResearch: tally(signOffRows, 'NEEDS_RESEARCH', 'signOff'),
          },
          confidence: {
            high: tally(confidenceRows, 'HIGH', 'confidence'),
            medium: tally(confidenceRows, 'MEDIUM', 'confidence'),
            low: tally(confidenceRows, 'LOW', 'confidence'),
          },
          grounding: {
            item: tally(grounding, 'ITEM', 'groundingBasis'),
            regulation: tally(grounding, 'REGULATION', 'groundingBasis'),
          },
          variants: { total: variants, promoted },
        });
      } catch (e) {
        next(e);
      }
    },
  );

  // L1 table — all regulations with child counts and sign-off progress.
  router.get(
    '/compliance-register/regulations',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const categories = list(req.query.category);
        const search = str(req.query.search)?.toLowerCase();
        const where = {
          companyId,
          ...(categories ? { category: { in: categories } } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { regCode: { contains: search, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        };
        const [lensMap, regs, signOffByReg, reqByReg, variantByReg] = await Promise.all([
          regulationLensMap(companyId),
          prisma.complianceRegulation.findMany({
            where,
            orderBy: { regCode: 'asc' },
            select: {
              id: true,
              regCode: true,
              name: true,
              category: true,
              lineOfBusiness: true,
              jurisdictionScope: true,
              ownerTeam: true,
              frequency: true,
              productImpact: true,
              processImpact: true,
              systemImpact: true,
              evidenceRequired: true,
              dueDate: true,
              representativeRequirement: true,
            },
          }),
          prisma.complianceItem.groupBy({
            by: ['regulationId', 'signOff'],
            where: { companyId },
            _count: true,
          }),
          prisma.regulatoryRequirement.groupBy({
            by: ['complianceRegulationId'],
            where: { companyId, complianceRegulationId: { not: null } },
            _count: true,
          }),
          prisma.complianceJurisdictionVariant.groupBy({
            by: ['regulationId'],
            where: { companyId },
            _count: true,
          }),
        ]);
        const itemStats = new Map<string, { total: number; confirmed: number }>();
        for (const r of signOffByReg) {
          const cur = itemStats.get(r.regulationId) ?? { total: 0, confirmed: 0 };
          cur.total += r._count;
          if (r.signOff === 'CONFIRMED') cur.confirmed += r._count;
          itemStats.set(r.regulationId, cur);
        }
        const reqCounts = new Map(reqByReg.map((r) => [r.complianceRegulationId, r._count]));
        const variantCounts = new Map(variantByReg.map((r) => [r.regulationId, r._count]));
        const lens = str(req.query.lens);
        res.json({
          rows: regs
            .filter((r) => !lens || (lensMap.get(r.id) ?? 'state') === lens)
            .map((r) => ({
              ...r,
              lens: lensMap.get(r.id) ?? 'state',
              itemCount: itemStats.get(r.id)?.total ?? 0,
              confirmedCount: itemStats.get(r.id)?.confirmed ?? 0,
              requirementRowCount: reqCounts.get(r.id) ?? 0,
              variantCount: variantCounts.get(r.id) ?? 0,
            })),
        });
      } catch (e) {
        next(e);
      }
    },
  );

  // L1 detail — regulation + its items + jurisdiction variants.
  router.get(
    '/compliance-register/regulations/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const reg = await prisma.complianceRegulation.findFirst({
          where: { id: req.params.id, companyId },
          include: {
            items: { orderBy: { itemCode: 'asc' }, select: ITEM_LIST_SELECT },
            variants: {
              orderBy: [{ jurisdiction: 'asc' }, { deadlineVariant: 'asc' }],
              include: { promotedItem: { select: { id: true, itemCode: true, signOff: true } } },
            },
          },
        });
        if (!reg) return res.status(404).json({ error: 'Regulation not found' });
        const requirementRowCount = await prisma.regulatoryRequirement.count({
          where: { companyId, complianceRegulationId: reg.id },
        });
        res.json({ ...reg, requirementRowCount });
      } catch (e) {
        next(e);
      }
    },
  );

  // L2 catalog / review queue — paginated, filterable; queue order puts the
  // weakest grounding first (LOW → MEDIUM → HIGH) so counsel triages honestly.
  router.get(
    '/compliance-register/items',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const search = str(req.query.search);
        const lensIds = await lensRegulationIds(companyId, req.query.lens);
        const where = {
          companyId,
          ...(lensIds ? { regulationId: { in: lensIds } } : {}),
          ...(list(req.query.signOff) ? { signOff: { in: list(req.query.signOff) } } : {}),
          ...(list(req.query.confidence) ? { confidence: { in: list(req.query.confidence) } } : {}),
          ...(str(req.query.groundingBasis)
            ? { groundingBasis: str(req.query.groundingBasis) }
            : {}),
          ...(str(req.query.regulationId) ? { regulationId: str(req.query.regulationId) } : {}),
          ...(list(req.query.category)
            ? { regulation: { category: { in: list(req.query.category) } } }
            : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { itemCode: { contains: search, mode: 'insensitive' as const } },
                  { regulation: { name: { contains: search, mode: 'insensitive' as const } } },
                ],
              }
            : {}),
        };
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize) || 50));
        const queueOrder = str(req.query.sort) === 'queue';
        const [total, rows] = await Promise.all([
          prisma.complianceItem.count({ where }),
          prisma.complianceItem.findMany({
            where,
            select: {
              ...ITEM_LIST_SELECT,
              regulation: { select: { id: true, regCode: true, name: true, category: true } },
            },
            // LOW < MEDIUM < HIGH is not alphabetical, so queue mode loads the
            // filtered set (≤4,089 slim rows) and ranks in memory before paging.
            orderBy: [{ itemCode: 'asc' }],
            ...(queueOrder ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
          }),
        ]);
        if (queueOrder) {
          const rank: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
          rows.sort(
            (a, b) =>
              (rank[a.confidence] ?? 3) - (rank[b.confidence] ?? 3) ||
              a.itemCode.localeCompare(b.itemCode),
          );
          const start = (page - 1) * pageSize;
          return res.json({ rows: rows.slice(start, start + pageSize), total, page, pageSize });
        }
        res.json({ rows, total, page, pageSize });
      } catch (e) {
        next(e);
      }
    },
  );

  // L2 detail — the three zones (task / grounding evidence / determination),
  // reviewer-selected supporting rows, sign-off history, and a preview of the
  // parent regulation's L3 source rows for deep-linking.
  router.get(
    '/compliance-register/items/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const item = await prisma.complianceItem.findFirst({
          where: { id: req.params.id, companyId },
          include: {
            regulation: {
              select: {
                id: true,
                regCode: true,
                name: true,
                category: true,
                jurisdictionScope: true,
                representativeRequirement: true,
              },
            },
            requirementLinks: {
              include: {
                requirement: {
                  select: {
                    id: true,
                    title: true,
                    citation: true,
                    citationUrl: true,
                    jurisdiction: { select: { name: true, code: true } },
                  },
                },
              },
            },
            signOffEvents: { orderBy: { createdAt: 'desc' } },
          },
        });
        if (!item) return res.status(404).json({ error: 'Compliance item not found' });
        // Every L3 source row of the parent regulation, deduplicated by
        // citation text (falling back to the row title) so the drawer can show
        // the full jurisdiction coverage without repeating identical citations.
        const allRows = await prisma.regulatoryRequirement.findMany({
          where: { companyId, complianceRegulationId: item.regulation.id },
          orderBy: [{ citation: 'asc' }, { title: 'asc' }],
          select: {
            id: true,
            title: true,
            citation: true,
            citationUrl: true,
            jurisdiction: { select: { name: true, code: true } },
          },
        });
        const byCitation = new Map<
          string,
          {
            citation: string;
            url: string | null;
            requirementId: string;
            jurisdictions: Map<string, string>;
          }
        >();
        for (const r of allRows) {
          const key = (r.citation ?? r.title).trim();
          const cur = byCitation.get(key) ?? {
            citation: key,
            url: r.citationUrl,
            requirementId: r.id,
            jurisdictions: new Map<string, string>(),
          };
          cur.url ??= r.citationUrl;
          cur.jurisdictions.set(r.jurisdiction.code, r.jurisdiction.name);
          byCitation.set(key, cur);
        }
        const citations = [...byCitation.values()]
          .map((c) => ({
            citation: c.citation,
            url: c.url,
            requirementId: c.requirementId,
            jurisdictions: [...c.jurisdictions.entries()]
              .map(([code, name]) => ({ code, name }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          }))
          .sort((a, b) => a.citation.localeCompare(b.citation));
        res.json({
          ...item,
          selectedRequirements: item.requirementLinks.map((l) => l.requirement),
          requirementLinks: undefined,
          sourceRowCount: allRows.length,
          citations,
        });
      } catch (e) {
        next(e);
      }
    },
  );
}
