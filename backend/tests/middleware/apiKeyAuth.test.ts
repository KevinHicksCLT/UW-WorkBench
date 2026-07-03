// middleware/apiKeyAuth — machine auth for /provisioning: prefix lookup,
// constant-time hash comparison, revoked/unknown rejection, tenant stamping,
// and the fire-and-forget lastUsedAt update. Prisma is mocked.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const prismaMock = vi.hoisted(() => ({
  apiKey: { findMany: vi.fn(), update: vi.fn() },
}));
vi.mock('../../src/db/prisma.js', () => ({ prisma: prismaMock }));

const { apiKeyAuth } = await import('../../src/middleware/apiKeyAuth.js');
const { generateApiKey } = await import('../../src/lib/apiKeys.js');

const generated = generateApiKey();
const dbKey = {
  id: 'key-1',
  tenantId: 'tenant-1',
  name: 'okta-prod',
  keyPrefix: generated.prefix,
  keyHash: generated.hash,
  webhookSecret: null,
  revokedAt: null,
};

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function makeNext(): NextFunction & ReturnType<typeof vi.fn> {
  return vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.apiKey.update.mockResolvedValue(dbKey);
});

describe('apiKeyAuth', () => {
  it('accepts a valid Bearer key, stamps tenantId + apiKey, and touches lastUsedAt', async () => {
    prismaMock.apiKey.findMany.mockResolvedValue([dbKey]);
    const req = makeReq({ authorization: `Bearer ${generated.raw}` });
    const next = makeNext();

    await apiKeyAuth(req, makeRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.tenantId).toBe('tenant-1');
    expect(req.apiKey).toBe(dbKey);
    expect(req.user).toBeUndefined(); // provisioning surface never has a user
    // Prefix lookup excludes revoked keys at the query level.
    expect(prismaMock.apiKey.findMany).toHaveBeenCalledWith({
      where: { keyPrefix: generated.raw.slice(0, 12), revokedAt: null },
    });
    expect(prismaMock.apiKey.update).toHaveBeenCalledWith({
      where: { id: 'key-1' },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it('accepts the key via X-Api-Key too', async () => {
    prismaMock.apiKey.findMany.mockResolvedValue([dbKey]);
    const req = makeReq({ 'x-api-key': generated.raw });
    const next = makeNext();
    await apiKeyAuth(req, makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.tenantId).toBe('tenant-1');
  });

  it('rejects a missing/malformed key with 401 before touching the DB', async () => {
    const cases: Record<string, string>[] = [
      {},
      { authorization: 'Bearer nope' },
      { 'x-api-key': 'sk_wrongscheme' },
    ];
    for (const headers of cases) {
      const res = makeRes();
      const next = makeNext();
      await apiKeyAuth(makeReq(headers), res, next);
      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    }
    expect(prismaMock.apiKey.findMany).not.toHaveBeenCalled();
  });

  it('rejects an unknown key (right prefix, wrong secret) with 401', async () => {
    prismaMock.apiKey.findMany.mockResolvedValue([dbKey]);
    const forged = generated.raw.slice(0, 12) + 'X'.repeat(31);
    const res = makeRes();
    const next = makeNext();
    await apiKeyAuth(makeReq({ authorization: `Bearer ${forged}` }), res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or revoked API key' });
    expect(next).not.toHaveBeenCalled();
    expect(prismaMock.apiKey.update).not.toHaveBeenCalled();
  });

  it('rejects a revoked key with 401 (filtered by the query)', async () => {
    prismaMock.apiKey.findMany.mockResolvedValue([]); // revokedAt: null filter excluded it
    const res = makeRes();
    const next = makeNext();
    await apiKeyAuth(makeReq({ authorization: `Bearer ${generated.raw}` }), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not fail the request when the lastUsedAt update rejects', async () => {
    prismaMock.apiKey.findMany.mockResolvedValue([dbKey]);
    prismaMock.apiKey.update.mockRejectedValue(new Error('write timeout'));
    const next = makeNext();
    await apiKeyAuth(makeReq({ authorization: `Bearer ${generated.raw}` }), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
