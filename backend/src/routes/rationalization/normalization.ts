// v3 Normalize column — resolve REVIEW/HELD entries and rebuild the entry set
// from the ontology-backed matcher (plan §3, 2-B/2-D). Every resolution is
// audited against the parent workspace like the board layout commit.
import type { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { LAYERS } from '../../lib/rationalization.js';
import { matchItems, type Concept, type RawItem } from '../../lib/ontology/matcher.js';
import { logAudit, computeDiff } from '../../services/audit.js';

const patchSchema = z.object({
  matchStatus: z.enum(['AUTO', 'REVIEW', 'HELD']).optional(),
  name: z.string().trim().min(1).optional(),
  proposedResolution: z.string().nullable().optional(),
  differenceNote: z.string().nullable().optional(),
  componentId: z.string().nullable().optional(),
});

const ENTRY_FIELDS = [
  'name',
  'matchStatus',
  'proposedResolution',
  'differenceNote',
  'componentId',
] as const;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export function registerNormalizationRoutes(router: Router) {
  // PATCH /rationalization/normalization-entries/:id — approve / hold / re-map
  // a Normalize entry (the REVIEW and HELD cards' sign-off actions).
  router.patch(
    '/normalization-entries/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = patchSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
        }
        const before = await prisma.normalizationEntry.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId },
        });
        if (!before) return res.status(404).json({ error: 'Not found' });

        const data = parsed.data;
        if (data.componentId) {
          // Re-map target must live on the same board (tenant walk + workspace).
          const component = await prisma.rationalizationComponent.findFirst({
            where: {
              id: data.componentId,
              tenantId: req.tenantId,
              workspaceId: before.workspaceId,
            },
            select: { id: true },
          });
          if (!component) return res.status(400).json({ error: 'Unknown componentId' });
        }
        if (Object.keys(data).length === 0) return res.json(before);

        const updated = await prisma.normalizationEntry.update({
          where: { id: before.id },
          data,
        });
        const changes = computeDiff(before, updated, [...ENTRY_FIELDS]);
        if (Object.keys(changes).length) {
          logAudit({
            tenantId: req.tenantId,
            actorEmail: req.user.email,
            entityType: 'RationalizationWorkspace',
            entityId: updated.workspaceId,
            action: 'RESOLVE_NORMALIZATION',
            diff: { subject: `${updated.notation} ${updated.name}`, changes },
          });
        }
        res.json(updated);
      } catch (e) {
        next(e);
      }
    },
  );

  // POST /rationalization/:id/rematch — rebuild the workspace's Normalize
  // entries from the semantic matcher: raw findings are clustered per layer
  // across the legacy apps, against the anatomy catalog's concepts. Wholesale
  // rebuild (deterministic); manual resolutions are re-derivable via PATCH.
  router.post('/:id/rematch', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const w = await prisma.rationalizationWorkspace.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        select: {
          id: true,
          tenantId: true,
          companyId: true,
          capabilities: {
            select: { id: true, appId: true, layer: true, name: true, componentId: true },
          },
          components: { select: { id: true, layer: true } },
        },
      });
      if (!w) return res.status(404).json({ error: 'Not found' });

      const catalog = await prisma.anatomyCategory.findMany({
        where: { companyId: w.companyId },
        select: { layer: true, name: true },
      });
      const conceptsByLayer = new Map<string, Concept[]>();
      for (const c of catalog) {
        const list = conceptsByLayer.get(c.layer) ?? [];
        list.push({ slug: slugify(c.name), label: c.name });
        conceptsByLayer.set(c.layer, list);
      }
      const componentByLayer = new Map(w.components.map((c) => [c.layer, c.id]));

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
      LAYERS.forEach((layer, li) => {
        const items: RawItem[] = w.capabilities
          .filter((c) => c.layer === layer)
          .map((c) => ({ id: c.id, sourceId: c.appId, name: c.name }));
        if (items.length === 0) return;
        const groups = matchItems(items, conceptsByLayer.get(layer) ?? []);
        groups.forEach((g, gi) => {
          entries.push({
            id: randomUUID(),
            layer,
            notation: `N-${li + 1}${String(gi + 1).padStart(2, '0')}`,
            // Entry name = the first source's name (the normalized label).
            name: g.items[0].name,
            matchStatus: g.status,
            matchBasis: g.matchBasis,
            differenceNote: g.differenceNote,
            componentId: componentByLayer.get(layer) ?? null,
            sortOrder: gi,
            findingIds: g.items.map((i) => i.id),
          });
        });
      });

      await prisma.$transaction([
        prisma.normalizationEntry.deleteMany({ where: { workspaceId: w.id } }),
        prisma.normalizationEntry.createMany({
          data: entries.map(({ findingIds: _findingIds, ...e }) => ({
            ...e,
            tenantId: w.tenantId,
            companyId: w.companyId,
            workspaceId: w.id,
          })),
        }),
        ...entries.map((e) =>
          prisma.rationalizationCapability.updateMany({
            where: { id: { in: e.findingIds } },
            data: { normalizationEntryId: e.id },
          }),
        ),
      ]);

      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'RationalizationWorkspace',
        entityId: w.id,
        action: 'REMATCH_NORMALIZATION',
        diff: {
          summary: `${entries.length} normalized entries from ${w.capabilities.length} raw findings`,
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
  });
}
