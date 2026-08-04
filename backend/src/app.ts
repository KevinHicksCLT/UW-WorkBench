import './types/express.js'; // loads the Express.Request augmentation into the build graph
import express from 'express';
import type { ErrorRequestHandler, Request, Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import { ZodError } from 'zod';

import { httpLogger, logger } from './lib/logger.js';
import { prisma } from './db/prisma.js';
import authRoutes from './routes/auth.js';
import { applicationsRouter, companiesRouter, rolesRouter } from './routes/catalog.js';
import uwRoutes from './routes/uw/index.js';

const app = express();
app.disable('x-powered-by');
// Open CORS is intentional: the API is only reachable via the same-origin /api
// proxy (Vite dev proxy / hosting rewrite) and every route requires a JWT.
app.use(cors());
app.use(compression());
app.use(
  express.json({
    limit: '5mb',
    // Keep the raw body around for webhook HMAC verification (X-Signature is
    // computed over the exact bytes, not the re-serialized JSON).
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
// Structured request logging (pino) — method/url/status/duration/tenantId +
// a per-request UUID echoed as X-Request-Id (see lib/logger.ts).
app.use(httpLogger);

// Health check — confirms a live DB round-trip. Routers mount at the root:
// the /api prefix is stripped by the dev proxy / hosting rewrite before the
// request reaches Express, so the browser-visible path is /api/health.
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'reachable' });
  } catch (e) {
    logger.warn({ err: e }, 'health check failed — DB unreachable');
    res.status(503).json({ ok: false, db: 'unreachable' });
  }
});

app.use('/auth', authRoutes);
app.use('/companies', companiesRouter);
app.use('/roles', rolesRouter);
app.use('/applications', applicationsRouter);
app.use('/uw', uwRoutes);

/**
 * Central error handler — logs the full error with request context via pino,
 * then responds with the canonical `{ error: message }` shape. A ZodError is
 * the syntax-gate contract (UW-WORK-11): 422 with per-field violations.
 */
const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: 'validation_failed',
      violations: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  const e = err as { status?: number; message?: string; stack?: string };
  const status = e.status || 500;
  logger.error(
    { err, requestId: req.id, tenantId: req.tenantId ?? null, url: req.originalUrl, status },
    'request error',
  );
  res.status(status).json({
    error: e.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: e.stack }),
  });
};
app.use(errorHandler);

export default app;
