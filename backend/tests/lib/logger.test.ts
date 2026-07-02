// logger — the pino/pino-http wiring. Both libraries are mocked so no worker
// threads or real sinks spin up; assertions target the OPTIONS this module
// passes (request-id generation, tenant customProps, lean serializers, and the
// status→level mapping), which is the module's actual logic.
import { describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';

const { pinoMock, pinoHttpMock } = vi.hoisted(() => ({
  pinoMock: vi.fn((..._args: unknown[]) => ({ level: 'info', child: vi.fn() })),
  pinoHttpMock: vi.fn((opts: unknown) => opts),
}));
vi.mock('pino', () => ({ pino: pinoMock }));
vi.mock('pino-http', () => ({ pinoHttp: pinoHttpMock }));

// NODE_ENV is 'test' under vitest → the dev (pino-pretty) branch is taken.
const { httpLogger, logger } = await import('../../src/lib/logger.js');

type HttpOpts = {
  logger: unknown;
  genReqId: (req: IncomingMessage, res: ServerResponse) => string;
  customProps: (req: IncomingMessage) => { tenantId: string | null };
  serializers: {
    req: (req: { method?: string; url?: string }) => { method?: string; url?: string };
    res: (res: { statusCode?: number }) => { status?: number };
  };
  customLogLevel: (req: IncomingMessage, res: ServerResponse, err?: Error) => string;
};

const opts = pinoHttpMock.mock.calls[0][0] as HttpOpts;

describe('logger', () => {
  it('creates one shared pino instance with the pretty transport outside production', () => {
    expect(pinoMock).toHaveBeenCalledTimes(1);
    const cfg = pinoMock.mock.calls[0][0] as { level: string; transport?: { target: string } };
    expect(cfg.level).toBe('info');
    expect(cfg.transport?.target).toBe('pino-pretty');
    expect(logger).toBe(pinoMock.mock.results[0].value);
  });
});

describe('httpLogger options', () => {
  it('is built from the shared logger', () => {
    expect(httpLogger).toBe(opts);
    expect(opts.logger).toBe(logger);
  });

  it('genReqId returns a UUID and echoes it as X-Request-Id', () => {
    const setHeader = vi.fn();
    const id = opts.genReqId({} as IncomingMessage, { setHeader } as unknown as ServerResponse);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', id);
  });

  it('customProps carries the tenantId requireAuth stamped (null when unauthenticated)', () => {
    expect(opts.customProps({ tenantId: 't1' } as unknown as IncomingMessage)).toEqual({ tenantId: 't1' });
    expect(opts.customProps({} as IncomingMessage)).toEqual({ tenantId: null });
  });

  it('serializes lean req/res lines (method, url, status only)', () => {
    expect(opts.serializers.req({ method: 'GET', url: '/roles', headers: {} } as never)).toEqual({
      method: 'GET',
      url: '/roles',
    });
    expect(opts.serializers.res({ statusCode: 204 })).toEqual({ status: 204 });
  });

  it('maps status/err to log levels: 5xx or err → error, 4xx → warn, else info', () => {
    const res = (statusCode: number) => ({ statusCode }) as unknown as ServerResponse;
    const req = {} as IncomingMessage;
    expect(opts.customLogLevel(req, res(200))).toBe('info');
    expect(opts.customLogLevel(req, res(302))).toBe('info');
    expect(opts.customLogLevel(req, res(404))).toBe('warn');
    expect(opts.customLogLevel(req, res(500))).toBe('error');
    expect(opts.customLogLevel(req, res(200), new Error('boom'))).toBe('error');
  });
});
