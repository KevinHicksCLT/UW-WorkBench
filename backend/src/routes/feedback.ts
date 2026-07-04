import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../lib/logger.js';
import { loadFeedbackConfig } from '../lib/feedback/config.js';
import { runFeedbackPipeline } from '../lib/feedback/pipeline.js';

// In-app feedback capture. The widget POSTs one multipart request (text +
// auto-captured context + optional screenshot); the row is persisted
// immediately and the delivery pipeline (LLM ticket → Jira → email) runs
// asynchronously — see lib/feedback/pipeline.ts. Mounted at /feedback; the
// frontend calls it via the /api prefix.

const router = Router();
router.use(requireAuth);

// Screenshots only — image mime, 5 MB cap, held in memory (stored as bytea).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

const submissionSchema = z.object({
  text: z.string().trim().min(1).max(10_000),
  name: z.string().trim().max(200).optional(),
  route: z.string().trim().min(1).max(500),
  commitSha: z.string().trim().max(64).default('unknown'),
  userAgent: z.string().trim().max(500).default('unknown'),
});

// Widget visibility toggle — read fresh from feedback.config.json each call so
// flipping the file takes effect without a backend restart.
router.get('/config', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = loadFeedbackConfig();
    res.json({ enabled: config.feedbackButtonEnabled });
  } catch (e) {
    next(e);
  }
});

router.post(
  '/',
  upload.single('screenshot'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = loadFeedbackConfig();
      if (!config.feedbackButtonEnabled) {
        return res.status(403).json({ error: 'Feedback capture is disabled' });
      }
      const body = submissionSchema.parse(req.body);

      // DB-backed rate limit (survives serverless instance churn): 5/min/user.
      const oneMinuteAgo = new Date(Date.now() - 60_000);
      const recent = await prisma.feedback.count({
        where: { userId: req.user.id, createdAt: { gte: oneMinuteAgo } },
      });
      if (recent >= 5) {
        return res
          .status(429)
          .json({ error: 'Too many feedback submissions — try again in a minute' });
      }

      const row = await prisma.feedback.create({
        data: {
          tenantId: req.tenantId, // from the JWT — never from the body
          userId: req.user.id,
          name: body.name || null,
          text: body.text,
          route: body.route,
          commitSha: body.commitSha,
          userAgent: body.userAgent,
          screenshot: req.file ? new Uint8Array(req.file.buffer) : null,
          screenshotMime: req.file?.mimetype ?? null,
        },
        select: { id: true, status: true, createdAt: true },
      });

      // Respond immediately; the pipeline continues in the background.
      // waitUntil keeps the Vercel function alive until the pipeline settles
      // (without it the lambda freezes the moment the response is sent and
      // tickets/emails stall until a later invocation thaws it). Outside
      // Vercel it is a no-op and the promise runs on the persistent process.
      const pipeline = runFeedbackPipeline(row.id).catch((e) =>
        logger.error({ err: e, feedbackId: row.id }, 'feedback pipeline crashed'),
      );
      waitUntil(pipeline);

      res.status(201).json(row);
    } catch (e) {
      next(e);
    }
  },
);

// ── Admin surface: inspect submissions, retry failed deliveries ─────────────

router.get(
  '/',
  requireRole('SITE_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await prisma.feedback.findMany({
        where: { tenantId: req.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          name: true,
          text: true,
          route: true,
          commitSha: true,
          status: true,
          ticket: true,
          jiraKey: true,
          error: true,
          screenshotMime: true,
          createdAt: true,
        },
      });
      res.json(rows);
    } catch (e) {
      next(e);
    }
  },
);

// Tenant-scoped screenshot bytes (also what a future admin UI thumbnails).
router.get('/:id/screenshot', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await prisma.feedback.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      select: { screenshot: true, screenshotMime: true },
    });
    if (!row?.screenshot || !row.screenshotMime) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.setHeader('Content-Type', row.screenshotMime);
    res.send(Buffer.from(row.screenshot));
  } catch (e) {
    next(e);
  }
});

// Re-run the pipeline from the first incomplete step (completed steps are
// checkpointed on the row and skipped — no duplicate Jira tickets).
router.post(
  '/:id/retry',
  requireRole('SITE_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await prisma.feedback.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        select: { id: true },
      });
      if (!row) return res.status(404).json({ error: 'Not found' });
      await runFeedbackPipeline(row.id);
      const updated = await prisma.feedback.findUnique({
        where: { id: row.id },
        select: { id: true, status: true, jiraKey: true, error: true },
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

export default router;
