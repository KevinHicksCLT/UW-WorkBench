// middleware/auth — JWT accept/reject/expiry, tenantId provenance (from the DB
// user resolved off the JWT, never the request body), and requireRole. Uses
// real jsonwebtoken signing against the dev secret; prisma is mocked.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import type { User } from '@prisma/client';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}));
vi.mock('../../src/db/prisma.js', () => ({ prisma: prismaMock }));

// The middleware falls back to the dev secret when JWT_SECRET is unset; pin the
// env before the module (and its module-level SECRET constant) is loaded.
delete process.env.JWT_SECRET;
const SECRET = 'dev-secret';
const { requireAuth, requireRole, signToken } = await import('../../src/middleware/auth.js');

const dbUser = {
  id: 'u1',
  tenantId: 'tenant-good',
  email: 'kevin.hicks@capgemini.com',
  role: 'ADMIN',
} as unknown as User;

function makeReq(authorization?: string, body: Record<string, unknown> = {}): Request {
  return { headers: authorization ? { authorization } : {}, body } as unknown as Request;
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

// A spy that satisfies Express's overloaded NextFunction signature.
function makeNext(): NextFunction & ReturnType<typeof vi.fn> {
  return vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('signToken', () => {
  it('embeds sub/tenantId/email/role and a 7-day expiry', () => {
    const token = signToken(dbUser);
    // eslint-disable-next-line sonarjs/hardcoded-secret-signatures -- test-only verification against the middleware's documented dev fallback secret
    const payload = jwt.verify(token, SECRET) as jwt.JwtPayload;
    expect(payload.sub).toBe('u1');
    expect(payload.tenantId).toBe('tenant-good');
    expect(payload.email).toBe('kevin.hicks@capgemini.com');
    expect(payload.role).toBe('ADMIN');
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(7 * 24 * 60 * 60);
  });
});

describe('requireAuth', () => {
  it('accepts a valid token, loads the user, and stamps req.tenantId from the DB user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser);
    // A hostile body claiming another tenant must be ignored.
    const req = makeReq(`Bearer ${signToken(dbUser)}`, { tenantId: 'tenant-evil' });
    const res = makeRes();
    const next = makeNext();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBe(dbUser);
    expect(req.tenantId).toBe('tenant-good');
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('rejects a missing Authorization header with 401', async () => {
    const res = makeRes();
    const next = makeNext();
    await requireAuth(makeReq(), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a non-Bearer header with 401', async () => {
    const res = makeRes();
    const next = makeNext();
    await requireAuth(makeReq('Basic abc123'), res, next);
    expect(res.statusCode).toBe(401);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a token signed with the wrong secret with 401', async () => {
    // eslint-disable-next-line sonarjs/hardcoded-secret-signatures -- deliberately forging with a WRONG secret to prove rejection
    const forged = jwt.sign({ sub: 'u1', tenantId: 'tenant-good' }, 'attacker-secret');
    const res = makeRes();
    const next = makeNext();
    await requireAuth(makeReq(`Bearer ${forged}`), res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an expired token with 401', async () => {
    // eslint-disable-next-line sonarjs/hardcoded-secret-signatures -- test-only expired token minted with the dev fallback secret
    const expired = jwt.sign(
      { sub: 'u1', tenantId: 'tenant-good', email: dbUser.email, role: 'ADMIN' },
      SECRET,
      { expiresIn: -10 },
    );
    const res = makeRes();
    const next = makeNext();
    await requireAuth(makeReq(`Bearer ${expired}`), res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or expired token' });
  });

  it('rejects a valid token whose user no longer exists with 401', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = makeRes();
    const next = makeNext();
    await requireAuth(makeReq(`Bearer ${signToken(dbUser)}`), res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'User no longer exists' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  const withRole = (role: string) => ({ user: { role } }) as unknown as Request;

  it('passes through when the user role is allowed', () => {
    const next = makeNext();
    requireRole('ADMIN', 'EDITOR')(withRole('EDITOR'), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('responds 403 (listing the allowed roles) otherwise', () => {
    const res = makeRes();
    const next = makeNext();
    requireRole('ADMIN')(withRole('VIEWER'), res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Requires role: ADMIN' });
    expect(next).not.toHaveBeenCalled();
  });
});
