import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

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

app.get('/health', (_, res) => res.json({ ok: true, version: '0.1.0' }));

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

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

export default app;
