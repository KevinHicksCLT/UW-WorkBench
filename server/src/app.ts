import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import './types/express.js';
import { httpLogger, logger } from './lib/logger.js';
import authRoutes from './routes/auth.js';
import uwRoutes from './routes/uw/index.js';

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(httpLogger);

app.get('/health', (_req, res) => res.json({ ok: true, service: 'uw-workbench', version: '0.1.0' }));

app.use('/auth', authRoutes);
app.use('/uw', uwRoutes);

const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  if (err instanceof ZodError) {
    // Syntax gate: shape failures are 422 with per-field violations.
    return res.status(422).json({
      error: 'validation_failed',
      violations: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  const e = err as { status?: number; message?: string; stack?: string };
  const status = e.status ?? 500;
  logger.error({ err, requestId: req.id, tenantId: req.tenantId ?? null, url: req.originalUrl, status }, 'request error');
  res.status(status).json({
    error: e.message ?? 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: e.stack }),
  });
};
app.use(errorHandler);

export default app;
