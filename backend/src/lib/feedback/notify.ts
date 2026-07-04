import type { TicketContent } from './generateTicket.js';

/**
 * Notification email via the Resend HTTP API — plain fetch, no SDK dependency.
 * Sender defaults to Resend's shared onboarding address so the pipeline works
 * before a custom domain is verified; override with FEEDBACK_FROM_EMAIL.
 */

export type NotificationInput = {
  jiraKey: string;
  jiraUrl: string;
  ticket: TicketContent;
  submittedBy: string | null;
  route: string;
};

/** Assemble subject + HTML body (exported for tests). */
export function buildNotificationEmail(input: NotificationInput): {
  subject: string;
  html: string;
} {
  const subject = `[Feedback] ${input.jiraKey}: ${input.ticket.title}`;
  const html = [
    `<p>New feedback was triaged into <a href="${input.jiraUrl}">${input.jiraKey}</a>.</p>`,
    `<p><strong>${escapeHtml(input.ticket.title)}</strong></p>`,
    `<p>${escapeHtml(input.ticket.summary)}</p>`,
    `<p>Submitted by ${escapeHtml(input.submittedBy ?? 'anonymous')} from <code>${escapeHtml(input.route)}</code>.</p>`,
  ].join('\n');
  return { subject, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Send the notification to the configured recipient list. */
export async function sendNotification(emails: string[], input: NotificationInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Notifications are enabled in feedback.config.json but RESEND_API_KEY is not set',
    );
  }
  const { subject, html } = buildNotificationEmail(input);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.FEEDBACK_FROM_EMAIL || 'Transformation Bridge <onboarding@resend.dev>',
      to: emails,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Notification email failed: HTTP ${res.status} ${body.slice(0, 500)}`);
  }
}
