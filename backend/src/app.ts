import './types/express.js'; // loads the Express.Request augmentation into the build graph
import express from 'express';
import type { Request, Response, ErrorRequestHandler } from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import type { HealthResponse } from '@cascade/shared';

import { prisma } from './db/prisma.js';
import authRoutes from './routes/auth.js';
import auditRoutes from './routes/audit.js';
import companyRoutes from './routes/companies.js';
import divisionRoutes from './routes/divisions.js';
import departmentRoutes from './routes/departments.js';
import roleRoutes from './routes/roles.js';
import valueStreamRoutes from './routes/valueStreams.js';
import externalInteractionRoutes from './routes/externalInteractions.js';
import explorerRoutes from './routes/explorer.js';
import aiAnalysisRoutes from './routes/aiAnalysis.js';
import applicationRoutes from './routes/applications.js';
import searchRoutes from './routes/search.js';
import adminRoutes from './routes/admin.js';
import adminAiRoutes from './routes/adminAi.js';
import builderRoutes from './routes/builder.js';
import adminRoleRoutes from './routes/adminRole.js';
import dashboardRoutes from './routes/dashboard.js';
import rationalizationRoutes from './routes/rationalization.js';
import portfolioRoutes from './routes/portfolio.js';
import workRoutes from './routes/work.js';
import chatRoutes from './routes/chat.js';
import standardsSkillsRoutes from './routes/standardsSkills.js';
import regulationsRoutes from './routes/regulations.js';

const app = express();
app.use(cors());
// Gzip every response — the /work and /explorer payloads are MB-scale JSON
// that compresses ~10×, which is most of the tab-load latency.
app.use(compression());
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
app.use('/audit', auditRoutes);
app.use('/companies', companyRoutes);
app.use('/divisions', divisionRoutes);
app.use('/departments', departmentRoutes);
app.use('/roles', roleRoutes);
app.use('/value-streams', valueStreamRoutes);
app.use('/external-interactions', externalInteractionRoutes);
app.use('/explorer', explorerRoutes);
app.use('/ai-analysis', aiAnalysisRoutes);
app.use('/applications', applicationRoutes);
app.use('/search', searchRoutes);
// Mount the AI overlay + role-context before the generic admin router so their
// paths aren't captured by the /:entity catch-all in adminRoutes.
app.use('/admin/ai', adminAiRoutes);
app.use('/builder', builderRoutes);
app.use('/admin/role-context', adminRoleRoutes);
app.use('/admin', adminRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/rationalization', rationalizationRoutes);
app.use('/portfolio', portfolioRoutes);
app.use('/work', workRoutes);
app.use('/chat', chatRoutes);
app.use('/standards-skills', standardsSkillsRoutes);
app.use('/regulations', regulationsRoutes);

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
