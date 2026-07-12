// Board-box edits: CAPDAN normalize components, brown-field legacy apps /
// shared services, and green-field target microservices. Every change is
// audited against the parent workspace so the change log captures the full
// edit history.
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { STATUS_WEIGHT } from '../../lib/rationalization.js';
import { logAudit, computeDiff } from '../../services/audit.js';
import { patchBoxEntity } from './helpers.js';

// PATCH /rationalization/components/:id — edit a CAPDAN normalize component
// (the "Edit CAPDAN" panel). Every change is audited against the parent
// workspace so the workspace change log captures the full edit history.
const COMPONENT_FIELDS = [
  'name',
  'principle',
  'pattern',
  'targetTech',
  'destination',
  'migrationStatus',
] as const;

function toComponentDto(c: {
  id: string;
  layer: string;
  name: string;
  principle: string | null;
  pattern: string | null;
  targetTech: string | null;
  destination: string | null;
  microserviceId: string | null;
  migrationStatus: string;
}) {
  return {
    id: c.id,
    layer: c.layer,
    name: c.name,
    principle: c.principle,
    pattern: c.pattern,
    targetTech: c.targetTech,
    destination: c.destination,
    microserviceId: c.microserviceId,
    migrationStatus: c.migrationStatus,
  };
}

// PATCH /rationalization/apps/:id — edit a brown-field legacy app (column)
// or a shared service (WR-15: kind toggles which lane the box renders in).
const APP_FIELDS = [
  'name',
  'kind',
  'techStack',
  'disposition',
  'vendor',
  'hosting',
  'criticality',
] as const;
const APP_KINDS = ['LEGACY', 'SHARED_SERVICE'];

// PATCH /rationalization/microservices/:id — edit a green-field target service.
// ownerRole is now an optional Role FK (ownerRoleId), not free text, so it is no
// longer a directly-patchable string field on this box.
const MS_FIELDS = ['name', 'kind', 'status', 'techStack'] as const;

export function registerFindingRoutes(router: Router) {
  router.patch('/components/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const before = await prisma.rationalizationComponent.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
      });
      if (!before) return res.status(404).json({ error: 'Not found' });

      const body = (req.body ?? {}) as Record<string, unknown>;
      const data: Record<string, unknown> = {};
      for (const f of COMPONENT_FIELDS) {
        if (!(f in body)) continue;
        const v = body[f];
        if (v !== null && typeof v !== 'string')
          return res.status(400).json({ error: `${f} must be a string` });
        data[f] = typeof v === 'string' && v.trim() === '' ? null : v;
      }
      if (data.name === null) return res.status(400).json({ error: 'name is required' });
      if (typeof data.migrationStatus === 'string' && !(data.migrationStatus in STATUS_WEIGHT)) {
        return res.status(400).json({ error: 'Invalid migrationStatus' });
      }
      if (Object.keys(data).length === 0) return res.json(toComponentDto(before));

      const updated = await prisma.rationalizationComponent.update({
        where: { id: before.id },
        data,
      });
      const changes = computeDiff(before, updated, [...COMPONENT_FIELDS]);
      if (Object.keys(changes).length) {
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'RationalizationWorkspace',
          entityId: updated.workspaceId,
          action: 'UPDATE_CAPDAN',
          diff: { subject: updated.name, layer: updated.layer, changes },
        });
      }
      res.json(toComponentDto(updated));
    } catch (e) {
      next(e);
    }
  });

  router.patch('/apps/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const kind = (req.body ?? {}).kind;
      if (kind !== undefined && !APP_KINDS.includes(kind as string))
        return res.status(400).json({ error: `kind must be one of ${APP_KINDS.join(' | ')}` });
      const updated = await patchBoxEntity(
        req,
        res,
        () =>
          prisma.rationalizationApp.findFirst({
            where: { id: req.params.id, tenantId: req.tenantId },
          }),
        (id, data) => prisma.rationalizationApp.update({ where: { id }, data }),
        APP_FIELDS,
        'UPDATE_BROWNFIELD',
      );
      if (updated)
        res.json({
          id: updated.id,
          name: updated.name,
          kind: updated.kind,
          techStack: updated.techStack ?? null,
          disposition: updated.disposition ?? null,
          position: updated.position,
        });
    } catch (e) {
      next(e);
    }
  });

  router.patch('/microservices/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await patchBoxEntity(
        req,
        res,
        () =>
          prisma.rationalizationMicroservice.findFirst({
            where: { id: req.params.id, tenantId: req.tenantId },
          }),
        (id, data) => prisma.rationalizationMicroservice.update({ where: { id }, data }),
        MS_FIELDS,
        'UPDATE_GREENFIELD',
      );
      if (updated)
        res.json({
          id: updated.id,
          name: updated.name,
          kind: updated.kind,
          status: updated.status,
          techStack: updated.techStack ?? null,
          ownerRole: null,
        });
    } catch (e) {
      next(e);
    }
  });
}
