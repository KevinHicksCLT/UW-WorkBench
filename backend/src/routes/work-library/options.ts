/**
 * Work Library entity options — pick-lists (applications / roles /
 * deliverables) for entity-typed template keys, plus quick-create.
 */
import type { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { defaultRoleHome } from '../../lib/roleHome.js';
import { activeCompanyId } from './helpers.js';

/** Registers the options routes on the shared router (order preserved). */
export function registerOptionRoutes(router: Router): void {
  const OPTION_KINDS = ['APPLICATION', 'ROLE', 'DELIVERABLE'] as const;

  router.get('/options', async (req, res, next) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const kind = String(req.query.kind ?? '');
      if (!(OPTION_KINDS as readonly string[]).includes(kind))
        return res.status(400).json({ error: 'kind must be APPLICATION | ROLE | DELIVERABLE' });
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const take = 30;
      if (kind === 'APPLICATION') {
        const rows = await prisma.application.findMany({
          where: { companyId, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
          orderBy: { name: 'asc' },
          take,
          select: { id: true, name: true, kind: true },
        });
        return res.json({ options: rows.map((r) => ({ id: r.id, name: r.name, detail: r.kind })) });
      }
      if (kind === 'ROLE') {
        const rows = await prisma.role.findMany({
          where: {
            companyId,
            ...(q ? { displayValue: { contains: q, mode: 'insensitive' } } : {}),
          },
          orderBy: { displayValue: 'asc' },
          take,
          select: { id: true, displayValue: true },
        });
        return res.json({
          options: rows.map((r) => ({ id: r.id, name: r.displayValue, detail: null })),
        });
      }
      const rows = await prisma.deliverable.findMany({
        where: { companyId, ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}) },
        orderBy: { title: 'asc' },
        take,
        select: { id: true, title: true },
      });
      res.json({ options: rows.map((r) => ({ id: r.id, name: r.title, detail: null })) });
    } catch (e) {
      next(e);
    }
  });

  // "Add new" from a value combobox — creates the row in its OWNING table (it
  // appears on the Applications/Roles/Deliverables tabs) and returns the FK.
  router.post('/options', async (req, res, next) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const { kind, name } = z
        .object({ kind: z.enum(OPTION_KINDS), name: z.string().trim().min(1) })
        .parse(req.body);
      if (kind === 'APPLICATION') {
        const existing = await prisma.application.findFirst({
          where: { companyId, name: { equals: name, mode: 'insensitive' } },
        });
        if (existing) return res.json({ option: { id: existing.id, name: existing.name } });
        const row = await prisma.application.create({
          data: { companyId, name, kind: 'SystemOfRecord', illustrative: false },
        });
        return res.status(201).json({ option: { id: row.id, name: row.name } });
      }
      if (kind === 'ROLE') {
        const existing = await prisma.role.findFirst({
          where: { companyId, displayValue: { equals: name, mode: 'insensitive' } },
        });
        if (existing) return res.json({ option: { id: existing.id, name: existing.displayValue } });
        // Home the new role (lib/roleHome.ts) — an unhomed role lands in the org
        // views' dead "Unassigned" bucket.
        const row = await prisma.role.create({
          data: {
            companyId,
            dbValue: name,
            displayValue: name,
            orgUnitId: await defaultRoleHome(companyId),
          },
        });
        return res.status(201).json({ option: { id: row.id, name: row.displayValue } });
      }
      const existing = await prisma.deliverable.findFirst({
        where: { companyId, title: { equals: name, mode: 'insensitive' } },
      });
      if (existing) return res.json({ option: { id: existing.id, name: existing.title } });
      const row = await prisma.deliverable.create({ data: { companyId, title: name } });
      res.status(201).json({ option: { id: row.id, name: row.title } });
    } catch (e) {
      next(e);
    }
  });
}
