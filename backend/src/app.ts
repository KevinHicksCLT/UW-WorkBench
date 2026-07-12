import './types/express.js'; // loads the Express.Request augmentation into the build graph
import express from 'express';
import type { Request, Response, ErrorRequestHandler } from 'express';
import cors from 'cors';
import compression from 'compression';
import type { HealthResponse } from '@cascade/shared';

import { logger, httpLogger } from './lib/logger.js';

import { prisma } from './db/prisma.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me/index.js';
import auditRoutes from './routes/audit.js';
import companyRoutes from './routes/companies.js';
import divisionRoutes from './routes/divisions.js';
import departmentRoutes from './routes/departments.js';
import roleRoutes from './routes/roles.js';
import roleValidationRoutes from './routes/roleValidation.js';
import roleManageRoutes from './routes/roleManage.js';
import valueStreamRoutes from './routes/valueStreams.js';
import externalInteractionRoutes from './routes/externalInteractions.js';
import explorerRoutes from './routes/explorer/index.js';
import inspectorRoutes from './routes/inspector/index.js';
import aiAnalysisRoutes from './routes/aiAnalysis.js';
import applicationRoutes from './routes/applications.js';
import searchRoutes from './routes/search.js';
import adminRoutes from './routes/admin/index.js';
import adminAiRoutes from './routes/adminAi.js';
import builderRoutes from './routes/builder.js';
import adminRoleRoutes from './routes/adminRole.js';
import dashboardRoutes from './routes/dashboard.js';
import rationalizationRoutes from './routes/rationalization/index.js';
import taxonomyRoutes from './routes/taxonomy.js';
import productModelRoutes from './routes/product-models/index.js';
import portfolioRoutes from './routes/portfolio/index.js';
import workRoutes from './routes/work.js';
import workLibraryRoutes from './routes/work-library/index.js';
import chatRoutes from './routes/chat.js';
import standardsSkillsRoutes from './routes/standardsSkills.js';
import regulationsRoutes from './routes/regulations/index.js';
import usersRoutes from './routes/users/index.js';
import feedbackRoutes from './routes/feedback.js';
import provisioningRoutes from './routes/provisioning/index.js';
import approvalsRoutes from './routes/approvals/index.js';
import './lib/approvals/applyHandlers.js'; // registers replay handlers (side-effect import)
import { clearResponseCache } from './lib/responseCache.js';

const app = express();
app.disable('x-powered-by');
// Open CORS is intentional: the API is only reachable via the same-origin /api
// proxy (Vite dev proxy / Vercel routePrefix) and every route requires a JWT.
// eslint-disable-next-line sonarjs/cors
app.use(cors());
// Gzip every response — the /work and /explorer payloads are MB-scale JSON
// that compresses ~10×, which is most of the tab-load latency.
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
// Any write invalidates the GET response cache (see lib/responseCache.ts), so a
// mutation on any router is always followed by fresh reads.
app.use((req, _res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') clearResponseCache();
  next();
});
// Structured request logging (pino) — method/url/status/duration/tenantId +
// a per-request UUID echoed as X-Request-Id (see lib/logger.ts).
app.use(httpLogger);

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
    logger.warn({ err: e }, 'health check failed — DB unreachable');
    const body: HealthResponse = { ok: false, db: 'unreachable', commit };
    res.status(503).json(body);
  }
});

app.use('/auth', authRoutes);
app.use('/me', meRoutes);
app.use('/audit', auditRoutes);
app.use('/companies', companyRoutes);
app.use('/divisions', divisionRoutes);
app.use('/departments', departmentRoutes);
// Validation + management routes mount first so /validation-targets,
// /task-links/… and /manage/… are never captured by the roles router's /:id
// catch-all (mutations and specific reads resolve before the generic reads).
app.use('/roles', roleValidationRoutes);
app.use('/roles', roleManageRoutes);
app.use('/roles', roleRoutes);
app.use('/value-streams', valueStreamRoutes);
app.use('/external-interactions', externalInteractionRoutes);
app.use('/explorer', explorerRoutes);
app.use('/inspector', inspectorRoutes);
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
app.use('/taxonomy', taxonomyRoutes);
app.use('/product-models', productModelRoutes);
app.use('/portfolio', portfolioRoutes);
app.use('/work', workRoutes);
app.use('/work-library', workLibraryRoutes);
app.use('/chat', chatRoutes);
app.use('/standards-skills', standardsSkillsRoutes);
app.use('/regulations', regulationsRoutes);
app.use('/users', usersRoutes);
app.use('/provisioning', provisioningRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/approvals', approvalsRoutes);

/**
 * Central error handler — logs the full error with request context (request id,
 * tenant, url) via pino, then responds with the canonical shape
 * `{ error: message }` (+ `stack` outside production). Status = err.status || 500.
 */
const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
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
