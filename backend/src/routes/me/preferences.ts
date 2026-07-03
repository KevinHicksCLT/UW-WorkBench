/**
 * Per-user preference store — row-per-key (UserPreference), auto-save friendly.
 *   GET    /me/preferences        → { [key]: value } (every saved key)
 *   PATCH  /me/preferences        → { [key]: value, … } multi-key upsert; null value deletes
 *   DELETE /me/preferences/:key   → reset one key to default
 * Reserved keys (startPage / notification / dashboard) validate against their
 * shared zod schemas; dynamic families (sheet.columns.*, work.toc.group.*) are
 * pattern-checked and size-capped. Not audited — high-frequency, user-owned,
 * non-security state.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import {
  DYNAMIC_PREFERENCE_KEY_PATTERNS,
  RESERVED_PREFERENCE_SCHEMAS,
  isMenuKey,
  isValidPreferenceKey,
} from '@cascade/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { getEffectivePermissions, hasPermission } from '../../services/permissionService.js';

// Generous per-value cap for dynamic keys (a sheet's column state is ~1KB).
const MAX_DYNAMIC_VALUE_BYTES = 32 * 1024;

export function registerPreferenceRoutes(router: Router): void {
  router.get('/preferences', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await prisma.userPreference.findMany({
        where: { userId: req.user.id },
        select: { key: true, value: true },
      });
      const out: Record<string, unknown> = {};
      for (const r of rows) out[r.key] = r.value;
      res.json(out);
    } catch (e) {
      next(e);
    }
  });

  router.patch('/preferences', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({ error: 'Body must be an object of { key: value }' });
      }
      const entries = Object.entries(body);
      if (entries.length === 0) return res.json({ ok: true });
      if (entries.length > 50)
        return res.status(400).json({ error: 'Too many keys in one request' });

      const deletes: string[] = [];
      const upserts: { key: string; value: Prisma.InputJsonValue }[] = [];
      for (const [key, value] of entries) {
        if (!isValidPreferenceKey(key)) {
          return res.status(400).json({ error: `Unknown preference key: ${key}` });
        }
        if (value === null) {
          deletes.push(key);
          continue;
        }
        const schema = RESERVED_PREFERENCE_SCHEMAS[key];
        if (schema) {
          const parsed = schema.safeParse(value);
          if (!parsed.success) {
            return res
              .status(400)
              .json({
                error: `Invalid value for ${key}: ${parsed.error.issues[0]?.message ?? 'invalid'}`,
              });
          }
        } else if (DYNAMIC_PREFERENCE_KEY_PATTERNS.some((re) => re.test(key))) {
          if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_DYNAMIC_VALUE_BYTES) {
            return res.status(400).json({ error: `Value for ${key} exceeds the size cap` });
          }
        }
        // startPage must be a page the user can actually read.
        if (key === 'startPage') {
          const page = value as string;
          const perms = await getEffectivePermissions(req.user);
          if (!isMenuKey(page) || !hasPermission(perms, page, 'read')) {
            return res.status(400).json({ error: 'startPage must be a page you can read' });
          }
        }
        upserts.push({ key, value: value as Prisma.InputJsonValue });
      }

      await prisma.$transaction([
        ...(deletes.length > 0
          ? [
              prisma.userPreference.deleteMany({
                where: { userId: req.user.id, key: { in: deletes } },
              }),
            ]
          : []),
        ...upserts.map((u) =>
          prisma.userPreference.upsert({
            where: { userId_key: { userId: req.user.id, key: u.key } },
            update: { value: u.value },
            create: { userId: req.user.id, key: u.key, value: u.value },
          }),
        ),
      ]);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  router.delete('/preferences/:key', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = req.params.key;
      if (!isValidPreferenceKey(key))
        return res.status(400).json({ error: `Unknown preference key: ${key}` });
      await prisma.userPreference.deleteMany({ where: { userId: req.user.id, key } });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });
}
