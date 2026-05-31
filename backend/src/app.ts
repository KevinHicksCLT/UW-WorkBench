import express from 'express';
import type { Request, Response, ErrorRequestHandler } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import type { HealthResponse } from '@cascade/shared';

import { prisma } from './db/prisma.js';
import authRoutes from './routes/auth.js';
import programRoutes from './routes/programs.js';
import workstreamRoutes from './routes/workstreams.js';
import initiativeRoutes from './routes/initiatives.js';
import benefitCostRoutes from './routes/benefitsCosts.js';
import raidRoutes from './routes/raid.js';
import okrRoutes from './routes/okr.js';
import dashboardRoutes from './routes/dashboard.js';
import notificationRoutes from './routes/notifications.js';
import auditRoutes from './routes/audit.js';
import rulesRoutes from './routes/rules.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check — confirms a live DB round-trip. Routers are mounted at the
// root: the Vercel `experimentalServices` backend (routePrefix "/api") and the
// dev proxy both strip the /api prefix before the request reaches Express, so
// the browser-visible path is /api/health while Express serves /health.
app.get('/health', async (_req: Request, res: Response) => {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    const body: HealthResponse = { ok: true, db: 'reachable', commit };
    res.json(body);
  } catch (e) {
    const body: HealthResponse = { ok: false, db: 'unreachable', commit };
    res.status(503).json(body);
  }
});

app.use('/auth', authRoutes);
app.use('/programs', programRoutes);
app.use('/workstreams', workstreamRoutes);
app.use('/initiatives', initiativeRoutes);
app.use('/benefits-costs', benefitCostRoutes);
app.use('/raid', raidRoutes);
app.use('/okr', okrRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/notifications', notificationRoutes);
app.use('/audit', auditRoutes);
app.use('/rules', rulesRoutes);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
app.use(errorHandler);

export default app;
