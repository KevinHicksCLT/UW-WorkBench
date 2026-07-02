/**
 * logger — the single pino instance + HTTP logging middleware for the backend.
 *
 * Structured request logging (replaces morgan): every completed request logs
 * method, url, status, duration (pino-http's responseTime) and the tenantId
 * that requireAuth stamped on the request. Each request gets a UUID request id
 * (crypto.randomUUID) which is echoed back as the `X-Request-Id` response
 * header and carried on every log line for correlation.
 *
 * In dev (NODE_ENV !== 'production') output is prettified via pino-pretty;
 * in production it stays newline-delimited JSON for log aggregation.
 */
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const isProd = process.env.NODE_ENV === 'production';

/** Shared application logger — use `logger.child({...})` for scoped context. */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
        },
      }),
});

/**
 * Express middleware: structured per-request logging. Mounted once in app.ts,
 * ahead of every router. tenantId is resolved at response time (customProps
 * runs when the completion line is written), so requireAuth has already set it
 * for authenticated routes; unauthenticated paths log tenantId: null.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (_req: IncomingMessage, res: ServerResponse): string => {
    const id = randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customProps: (req: IncomingMessage) => ({
    tenantId: (req as Partial<{ tenantId: string }>).tenantId ?? null,
  }),
  // Lean lines: just the fields the charter asks for (method/url/status);
  // duration arrives as pino-http's standard `responseTime` (ms).
  serializers: {
    req: (req: { method?: string; url?: string }) => ({ method: req.method, url: req.url }),
    res: (res: { statusCode?: number }) => ({ status: res.statusCode }),
  },
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) =>
    err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
});
