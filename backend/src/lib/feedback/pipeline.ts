import { prisma } from '../../db/prisma.js';
import { logger } from '../logger.js';
import { loadFeedbackConfig } from './config.js';
import { generateTicket, parseTicketContent, type TicketContent } from './generateTicket.js';
import { attachScreenshot, createJiraIssue, jiraIssueUrl } from './jira.js';
import { sendNotification } from './notify.js';

/**
 * The feedback delivery pipeline: generate ticket content → create Jira issue
 * → attach screenshot → notify. Each step checkpoints its result onto the
 * Feedback row and is SKIPPED when that checkpoint already exists, so a retry
 * resumes from the failed step and can never create a duplicate Jira ticket.
 *
 * Status walk: PENDING → GENERATED → TICKETED → NOTIFIED, with FAILED + error
 * recorded on any step failure (retryable via POST /feedback/:id/retry).
 *
 * Execution model: started from the route after the response is sent, kept
 * alive on Vercel via waitUntil (see routes/feedback.ts) and running plainly
 * on the persistent dev server. Rows that still die mid-flight (deploy,
 * timeout) surface as PENDING/partial in GET /feedback and resume via retry.
 * A durable runner (Inngest — these steps are already shaped as its
 * step.run() blocks) remains the hardening upgrade if volume grows.
 */

async function markFailed(feedbackId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.feedback
    .update({
      where: { id: feedbackId },
      data: { status: 'FAILED', error: message.slice(0, 2000) },
    })
    .catch(() => {}); // the original failure is what we log/report
}

export async function runFeedbackPipeline(feedbackId: string): Promise<void> {
  const log = logger.child({ module: 'feedback-pipeline', feedbackId });
  const startedAt = Date.now();
  const feedback = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!feedback) {
    log.warn('feedback row not found — nothing to run');
    return;
  }
  log.info(
    {
      status: feedback.status,
      hasTicket: Boolean(feedback.ticket),
      jiraKey: feedback.jiraKey,
      hasScreenshot: Boolean(feedback.screenshot),
      route: feedback.route,
    },
    'pipeline start',
  );

  try {
    // Config inside the try: a broken feedback.config.json marks the row
    // FAILED with the parse error instead of dying invisibly.
    const config = loadFeedbackConfig();
    // Step 1 — ticket content (LLM). Reuse the stored ticket on retries so a
    // Jira outage never re-bills a generation call.
    let ticket: TicketContent;
    if (feedback.ticket) {
      ticket = parseTicketContent(feedback.ticket);
      log.info('step 1 skipped — ticket already generated (checkpoint)');
    } else {
      log.info('step 1: generating ticket content (Anthropic)');
      ticket = await generateTicket(
        {
          text: feedback.text,
          category: feedback.category,
          name: feedback.name,
          route: feedback.route,
          commitSha: feedback.commitSha,
          userAgent: feedback.userAgent,
        },
        config.jira.epics,
      );
      await prisma.feedback.update({
        where: { id: feedbackId },
        data: { ticket, status: 'GENERATED', error: null },
      });
      log.info(
        { title: ticket.title, ms: Date.now() - startedAt },
        'step 1 done: ticket content generated → GENERATED',
      );
    }

    if (!config.jira.enabled) {
      log.warn(
        'jira.enabled=false in feedback.config.json — pipeline stops at GENERATED (no Jira ticket will be created)',
      );
      return;
    }

    // Step 2 — Jira issue. jiraKey on the row is the idempotency guard.
    let jiraKey = feedback.jiraKey;
    if (jiraKey) {
      log.info({ jiraKey }, 'step 2 skipped — jira issue already exists (checkpoint)');
    } else {
      log.info(
        { baseUrl: config.jira.baseUrl, projectKey: config.jira.projectKey },
        'step 2: creating jira issue',
      );
      jiraKey = await createJiraIssue(config.jira, feedback, ticket);
      await prisma.feedback.update({
        where: { id: feedbackId },
        data: { jiraKey, status: 'TICKETED', error: null },
      });
      log.info({ jiraKey }, 'step 2 done: jira issue created → TICKETED');
    }

    // Step 3 — screenshot attachment (skipped when none was included).
    if (feedback.screenshot && feedback.screenshotMime && !feedback.screenshotAttachedAt) {
      log.info({ jiraKey, bytes: feedback.screenshot.length }, 'step 3: attaching screenshot');
      await attachScreenshot(config.jira, jiraKey, feedback.screenshot, feedback.screenshotMime);
      await prisma.feedback.update({
        where: { id: feedbackId },
        data: { screenshotAttachedAt: new Date(), error: null },
      });
      log.info({ jiraKey }, 'step 3 done: screenshot attached');
    } else {
      log.info(
        {
          hadScreenshot: Boolean(feedback.screenshot),
          alreadyAttached: Boolean(feedback.screenshotAttachedAt),
        },
        'step 3 skipped',
      );
    }

    // Step 4 — notification email (terminal state stays TICKETED when off).
    if (!config.notifications.enabled || config.notifications.emails.length === 0) {
      log.warn(
        'step 4 skipped — notifications disabled or recipient list empty; final status TICKETED',
      );
    } else if (feedback.notifiedAt) {
      log.info('step 4 skipped — already notified (checkpoint)');
    } else {
      log.info(
        { recipients: config.notifications.emails.length },
        'step 4: sending notification email (Resend)',
      );
      await sendNotification(config.notifications.emails, {
        jiraKey,
        jiraUrl: jiraIssueUrl(config.jira, jiraKey),
        ticket,
        submittedBy: feedback.name,
        route: feedback.route,
      });
      await prisma.feedback.update({
        where: { id: feedbackId },
        data: { notifiedAt: new Date(), status: 'NOTIFIED', error: null },
      });
      log.info({ jiraKey }, 'step 4 done: notification sent → NOTIFIED');
    }
    log.info({ ms: Date.now() - startedAt }, 'pipeline complete');
  } catch (e) {
    // Row records status FAILED + the message (visible in GET /feedback);
    // full stack lands here in the structured log.
    log.error(
      { err: e, ms: Date.now() - startedAt },
      'feedback pipeline step FAILED — row marked FAILED, retry via POST /feedback/:id/retry',
    );
    await markFailed(feedbackId, e);
  }
}
