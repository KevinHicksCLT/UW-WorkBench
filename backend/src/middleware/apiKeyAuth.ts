// Machine authentication for the /provisioning surface. Accepts the raw key
// via `Authorization: Bearer tbk_…` or `X-Api-Key`, looks candidates up by the
// stored 12-char prefix, and compares sha256 hashes in constant time. On
// success sets req.tenantId + req.apiKey — req.user stays UNSET, so
// provisioning routes must never touch req.user.
import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { hashApiKey } from '../lib/apiKeys.js';
import { logger } from '../lib/logger.js';

function extractRawKey(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey !== '') return xApiKey;
  return undefined;
}

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = extractRawKey(req);
    if (!raw || !raw.startsWith('tbk_') || raw.length <= 12) {
      return res.status(401).json({ error: 'Missing or malformed API key' });
    }

    const candidates = await prisma.apiKey.findMany({
      where: { keyPrefix: raw.slice(0, 12), revokedAt: null },
    });
    const hash = hashApiKey(raw);
    const hashBuf = Buffer.from(hash, 'utf8');
    const key = candidates.find((k) => {
      const stored = Buffer.from(k.keyHash, 'utf8');
      return stored.length === hashBuf.length && timingSafeEqual(stored, hashBuf);
    });
    if (!key) {
      // Unknown and revoked keys are indistinguishable to the caller.
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    req.apiKey = key;
    req.tenantId = key.tenantId;

    // Fire-and-forget usage stamp — never block or fail the request on it.
    prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch((e: unknown) => logger.warn({ err: e, apiKeyId: key.id }, 'lastUsedAt update failed'));

    next();
  } catch (e) {
    next(e);
  }
}
