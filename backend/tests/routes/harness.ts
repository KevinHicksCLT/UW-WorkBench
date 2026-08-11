// Shared harness for route-level tests (rationalization / product-models).
// Mounts a feature router on a real express app on an ephemeral port so the
// full request path (routing, params, query parsing, JSON bodies, status
// codes) is exercised. Auth/permissions are stubbed — the tenant comes from an
// x-test-tenant header — and prisma is ALWAYS mocked per suite (vi.hoisted +
// vi.mock in each test file, same style as tests/middleware/permissions.test.ts).
import express from 'express';
import type { ErrorRequestHandler, NextFunction, Request, Response, Router } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import '../../src/types/express.js';

export const TENANT_A = 't-alpha';
export const TENANT_B = 't-beta';

/**
 * vi.mock factory body for src/middleware/auth.js. requireAuth trusts the
 * x-test-tenant header (defaults to TENANT_A) — tenant-isolation tests issue
 * the same request as another tenant and must see 404, never 403.
 */
export function fakeAuthModule() {
  return {
    requireAuth: (req: Request, _res: Response, next: NextFunction) => {
      const header = req.headers['x-test-tenant'];
      const tenantId = typeof header === 'string' && header ? header : TENANT_A;
      req.tenantId = tenantId;
      req.user = {
        id: `u-${tenantId}`,
        tenantId,
        email: `tester@${tenantId}.demo`,
        role: 'SITE_ADMIN',
        status: 'ACTIVE',
      } as unknown as Request['user'];
      next();
    },
    requireRole: () => (_req: Request, _res: Response, next: NextFunction) => next(),
    signToken: () => 'test-token',
  };
}

/** vi.mock factory body for src/middleware/permissions.js — always allow. */
export function fakePermissionsModule() {
  const pass = () => (_req: Request, _res: Response, next: NextFunction) => next();
  return {
    requirePermission: pass,
    requireAnyPermission: pass,
    requireUserAdmin: pass,
    userScopeWhere: () => ({}),
  };
}

export interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface RouteServer {
  request<T = Record<string, unknown>>(
    method: string,
    path: string,
    opts?: { body?: unknown; tenant?: string },
  ): Promise<RouteResponse<T>>;
  close(): Promise<void>;
}

/** Mount a router at `mount` and listen on an ephemeral loopback port. */
export async function startRouteServer(mount: string, router: Router): Promise<RouteServer> {
  const app = express();
  // Test-only server on loopback — still drop the version-disclosing header
  // (sonarjs/x-powered-by) so the harness mirrors production app hygiene.
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(mount, router);
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  };
  app.use(onError);

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  return {
    async request<T>(
      method: string,
      path: string,
      opts: { body?: unknown; tenant?: string } = {},
    ): Promise<RouteResponse<T>> {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          'x-test-tenant': opts.tenant ?? TENANT_A,
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
      const text = await res.text();
      return { status: res.status, body: (text ? JSON.parse(text) : undefined) as T };
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

type Where = Record<string, unknown>;

/**
 * findFirst stand-in that honors the id + tenantId (and any other scalar
 * equality) filters routes use for tenant walks — a row from another tenant
 * resolves to null exactly like the real query, driving the 404 path.
 */
export function findFirstFrom<T extends Record<string, unknown>>(rows: T[]) {
  return ({ where }: { where: Where }): Promise<T | null> => {
    const match = rows.find((r) =>
      Object.entries(where).every(
        ([k, v]) => typeof v === 'object' || r[k] === v || v === undefined,
      ),
    );
    return Promise.resolve(match ?? null);
  };
}
