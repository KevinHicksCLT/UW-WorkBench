// Product-model rationalization boards (PM-04/05 server half): list, the
// StageDetail-mirror board DTO (§6.2 — same key names as the app domain so
// Agent 3's board builder stays domain-generic), workspace creation, and the
// matcher-driven Normalize rebuild. Rows are the 11 product components; cards
// color by finding scope (Common | Segment | Geography | Eliminate).
import type { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import {
  canonicalStatusOf,
  columnStatsOf,
  normalizeStatsOf,
  progressOf,
} from '../../lib/rationalization.js';
import { matchItems, type Concept, type RawItem } from '../../lib/ontology/matcher.js';
import { logAudit } from '../../services/audit.js';
import { activeCompanyId, componentAxis, csv, scopeCounts } from './helpers.js';

const createSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  northstar: z.string().nullable().optional(),
});

export function registerWorkspaceRoutes(router: Router) {
  // GET /product-models/workspaces — board list with per-board roll-ups.
  router.get('/workspaces', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const boards = await prisma.productModelWorkspace.findMany({
        where: { tenantId: req.tenantId, companyId },
        orderBy: { name: 'asc' },
        include: { findings: { select: { scope: true, migrationStatus: true } } },
      });
      res.json(
        boards.map((b) => ({
          id: b.id,
          name: b.name,
          description: b.description,
          status: b.status,
          domain: 'PRODUCT_MODEL',
          illustrative: b.illustrative,
          findings: b.findings.length,
          byScope: scopeCounts(b.findings),
          progress: progressOf(b.findings.map((f) => f.migrationStatus)),
        })),
      );
    } catch (e) {
      next(e);
    }
  });

  // POST /product-models/workspaces — start a new product-model board.
  router.post('/workspaces', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      }
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const exists = await prisma.productModelWorkspace.findFirst({
        where: { tenantId: req.tenantId, companyId, name: parsed.data.name },
        select: { id: true },
      });
      if (exists) {
        return res.status(409).json({ error: 'A workspace with that name already exists' });
      }
      const created = await prisma.productModelWorkspace.create({
        data: { ...parsed.data, tenantId: req.tenantId, companyId },
      });
      res.status(201).json({ id: created.id, name: created.name });
    } catch (e) {
      next(e);
    }
  });

  // GET /product-models/workspaces/:id — one board's full decomposition.
  // Inspection-mode filters (PM-05): ?legacyModelIds=a,b · ?segments=SMB,…
  // · ?geographies=US-NY,… narrow the legacy columns (findings follow).
  router.get('/workspaces/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const w = await prisma.productModelWorkspace.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        include: {
          legacyModels: { orderBy: [{ position: 'asc' }, { name: 'asc' }] },
          components: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
          canonicalModels: {
            orderBy: [{ position: 'asc' }, { name: 'asc' }],
            include: {
              ownerRole: { select: { displayValue: true } },
              components: { select: { migrationStatus: true } },
            },
          },
          findings: true,
          normalizationEntries: {
            orderBy: [{ layer: 'asc' }, { sortOrder: 'asc' }, { notation: 'asc' }],
            include: { findings: { select: { id: true } } },
          },
        },
      });
      if (!w) return res.status(404).json({ error: 'Not found' });

      const legacyModelIds = csv(req.query.legacyModelIds);
      const segments = csv(req.query.segments);
      const geographies = csv(req.query.geographies);
      const models = w.legacyModels.filter(
        (m) =>
          (legacyModelIds.length === 0 || legacyModelIds.includes(m.id)) &&
          (segments.length === 0 || (m.segment !== null && segments.includes(m.segment))) &&
          (geographies.length === 0 || (m.geography !== null && geographies.includes(m.geography))),
      );
      const modelIds = new Set(models.map((m) => m.id));
      const findings = w.findings.filter((f) => modelIds.has(f.legacyModelId));

      const componentById = new Map(w.components.map((c) => [c.id, c.component]));
      const axis = await componentAxis(w.companyId, [
        ...w.components.map((c) => c.component),
        ...findings.map((f) => f.component),
      ]);

      const byLayer = axis.map((component) => {
        const rows = findings.filter((f) => f.component === component);
        return {
          layer: component,
          findings: rows.length,
          progress: progressOf(rows.map((r) => r.migrationStatus)),
          byScope: scopeCounts(rows),
          relocateOut: rows.filter(
            (r) => r.targetComponentId && componentById.get(r.targetComponentId) !== r.component,
          ).length,
        };
      });

      res.json({
        id: w.id,
        name: w.name,
        description: w.description,
        northstar: w.northstar,
        status: w.status,
        domain: 'PRODUCT_MODEL',
        illustrative: w.illustrative,
        layout: w.layout ?? null,
        progress: progressOf(findings.map((f) => f.migrationStatus)),
        counts: { findings: findings.length, ...scopeCounts(findings) },
        byLayer,
        // Legacy product models fill the app-domain DTO's column slot.
        apps: models.map((m) => ({
          id: m.id,
          name: m.name,
          kind: m.sourceSystem,
          segment: m.segment,
          geography: m.geography,
          disposition: m.disposition,
          position: m.position,
        })),
        // Normalized per-component targets (destination = canonical model).
        components: w.components.map((c) => ({
          id: c.id,
          layer: c.component,
          name: c.name,
          principle: c.principle,
          canonicalModelId: c.canonicalModelId,
          migrationStatus: c.migrationStatus,
        })),
        // Canonical (north-star) models fill the green-field slot; status is
        // rolled up on read from their linked components (PM-08).
        microservices: w.canonicalModels.map((cm) => ({
          id: cm.id,
          name: cm.name,
          kind: cm.lineOfBusiness,
          status: canonicalStatusOf(cm.components.map((c) => c.migrationStatus)),
          techStack: null,
          ownerRole: cm.ownerRole?.displayValue ?? null,
        })),
        columnStats: columnStatsOf(
          findings.map((f) => ({
            sourceId: f.legacyModelId,
            moves:
              f.scope === 'Eliminate' ||
              (f.targetComponentId !== null &&
                componentById.get(f.targetComponentId) !== f.component),
            dead: f.deadCode,
          })),
        ),
        normalizeStats: normalizeStatsOf(
          findings.length,
          w.normalizationEntries.map((n) => n.matchStatus),
        ),
        normalizationEntries: w.normalizationEntries.map((n) => ({
          id: n.id,
          layer: n.layer,
          notation: n.notation,
          name: n.name,
          matchStatus: n.matchStatus,
          matchBasis: n.matchBasis,
          differenceNote: n.differenceNote,
          proposedResolution: n.proposedResolution,
          componentId: n.componentId,
          findingIds: n.findings.map((f) => f.id),
        })),
        findings: findings.map((f) => ({
          id: f.id,
          appId: f.legacyModelId,
          layer: f.component,
          name: f.name,
          detail: f.detail,
          scope: f.scope,
          segmentValue: f.segmentValue,
          geographyValue: f.geographyValue,
          sourceRef: f.sourceRef,
          anatomyCategoryId: f.anatomyCategoryId,
          targetComponentId: f.targetComponentId,
          migrationStatus: f.migrationStatus,
          deadCode: f.deadCode,
          normalizationEntryId: f.normalizationEntryId,
          whyThisMoves: f.whyThisMoves ?? null,
        })),
      });
    } catch (e) {
      next(e);
    }
  });

  // POST /product-models/workspaces/:id/rematch — product twin of the app
  // domain's rematch: cluster findings per component across legacy models
  // against the ProductModelAnatomyCategory concepts (slug = SKOS id).
  router.post(
    '/workspaces/:id/rematch',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const w = await prisma.productModelWorkspace.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId },
          select: {
            id: true,
            tenantId: true,
            companyId: true,
            findings: { select: { id: true, legacyModelId: true, component: true, name: true } },
            components: { select: { id: true, component: true } },
          },
        });
        if (!w) return res.status(404).json({ error: 'Not found' });

        const catalog = await prisma.productModelAnatomyCategory.findMany({
          where: { companyId: w.companyId },
          select: { component: true, slug: true, name: true },
        });
        const conceptsByComponent = new Map<string, Concept[]>();
        for (const c of catalog) {
          const list = conceptsByComponent.get(c.component) ?? [];
          list.push({ slug: c.slug, label: c.name });
          conceptsByComponent.set(c.component, list);
        }
        const componentRowByToken = new Map(w.components.map((c) => [c.component, c.id]));
        const axis = await componentAxis(
          w.companyId,
          w.findings.map((f) => f.component),
        );

        const entries: {
          id: string;
          layer: string;
          notation: string;
          name: string;
          matchStatus: string;
          matchBasis: string | null;
          differenceNote: string | null;
          componentId: string | null;
          sortOrder: number;
          findingIds: string[];
        }[] = [];
        axis.forEach((component, ci) => {
          const items: RawItem[] = w.findings
            .filter((f) => f.component === component)
            .map((f) => ({ id: f.id, sourceId: f.legacyModelId, name: f.name }));
          if (items.length === 0) return;
          const groups = matchItems(items, conceptsByComponent.get(component) ?? []);
          groups.forEach((g, gi) => {
            entries.push({
              id: randomUUID(),
              layer: component,
              notation: `N-${ci + 1}${String(gi + 1).padStart(2, '0')}`,
              name: g.items[0].name,
              matchStatus: g.status,
              matchBasis: g.matchBasis,
              differenceNote: g.differenceNote,
              componentId: componentRowByToken.get(component) ?? null,
              sortOrder: gi,
              findingIds: g.items.map((i) => i.id),
            });
          });
        });

        await prisma.$transaction([
          prisma.productModelNormalizationEntry.deleteMany({ where: { workspaceId: w.id } }),
          prisma.productModelNormalizationEntry.createMany({
            data: entries.map(({ findingIds: _findingIds, ...e }) => ({
              ...e,
              tenantId: w.tenantId,
              companyId: w.companyId,
              workspaceId: w.id,
            })),
          }),
          ...entries.map((e) =>
            prisma.productModelFinding.updateMany({
              where: { id: { in: e.findingIds } },
              data: { normalizationEntryId: e.id },
            }),
          ),
        ]);

        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'ProductModelWorkspace',
          entityId: w.id,
          action: 'REMATCH_NORMALIZATION',
          diff: {
            summary: `${entries.length} normalized entries from ${w.findings.length} raw findings`,
          },
        });
        res.json({
          ok: true,
          entries: entries.length,
          awaitingReview: entries.filter((e) => e.matchStatus !== 'AUTO').length,
        });
      } catch (e) {
        next(e);
      }
    },
  );
}
