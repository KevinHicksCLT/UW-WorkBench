import { feedbackCategoryLabel } from '@cascade/shared';
import type { FeedbackConfig } from './config.js';
import type { TicketContent } from './generateTicket.js';

/**
 * Jira Cloud REST v3 integration — direct fetch, no SDK. Two operations:
 * create an issue (description body is Atlassian Document Format JSON, not
 * markdown) and attach the screenshot (multipart with the CSRF-bypass header
 * Jira requires). Auth is basic (email + API token) from the environment.
 */

type JiraSettings = FeedbackConfig['jira'];

// ── Minimal ADF node types (only what the description builder emits) ────────
type AdfText = { type: 'text'; text: string; marks?: { type: string }[] };
type AdfParagraph = { type: 'paragraph'; content: AdfText[] };
type AdfHeading = { type: 'heading'; attrs: { level: number }; content: AdfText[] };
type AdfListItem = { type: 'listItem'; content: AdfParagraph[] };
type AdfBulletList = { type: 'bulletList'; content: AdfListItem[] };
type AdfBlockquote = { type: 'blockquote'; content: AdfParagraph[] };
type AdfNode = AdfParagraph | AdfHeading | AdfBulletList | AdfBlockquote;
export type AdfDoc = { type: 'doc'; version: 1; content: AdfNode[] };

function text(value: string): AdfText {
  return { type: 'text', text: value };
}
function paragraph(value: string): AdfParagraph {
  return { type: 'paragraph', content: [text(value)] };
}
function heading(value: string): AdfHeading {
  return { type: 'heading', attrs: { level: 3 }, content: [text(value)] };
}
function bulletList(items: string[]): AdfBulletList {
  return {
    type: 'bulletList',
    content: items.map((item) => ({ type: 'listItem', content: [paragraph(item)] })),
  };
}

export type FeedbackContext = {
  text: string;
  category: string | null; // FeedbackCategory; null on rows predating the field
  name: string | null;
  route: string;
  commitSha: string;
  userAgent: string;
  tenantId: string;
  userId: string;
};

/** Full issue description: summary, verbatim comment, context, story, ACs. */
export function buildDescriptionAdf(feedback: FeedbackContext, ticket: TicketContent): AdfDoc {
  return {
    type: 'doc',
    version: 1,
    content: [
      paragraph(ticket.summary),
      heading('Original feedback (verbatim)'),
      { type: 'blockquote', content: [paragraph(feedback.text)] },
      heading('Captured context'),
      bulletList([
        `Category: ${feedbackCategoryLabel(feedback.category)}`,
        `Submitted by: ${feedback.name ?? 'anonymous'} (user ${feedback.userId}, tenant ${feedback.tenantId})`,
        `Screen: ${feedback.route}`,
        `Commit: ${feedback.commitSha}`,
        `Browser: ${feedback.userAgent}`,
      ]),
      heading('Implementation story'),
      paragraph(ticket.story),
      heading('Acceptance criteria'),
      bulletList(ticket.acceptanceCriteria),
    ],
  };
}

function jiraAuthHeader(): string {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) {
    throw new Error(
      'Jira is enabled in feedback.config.json but JIRA_EMAIL / JIRA_API_TOKEN are not set',
    );
  }
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
}

async function jiraError(res: Response, action: string): Promise<Error> {
  const body = await res.text().catch(() => '');
  return new Error(`Jira ${action} failed: HTTP ${res.status} ${body.slice(0, 500)}`);
}

/** Create the issue; resolves to the new issue key (e.g. TB-123). */
export async function createJiraIssue(
  settings: JiraSettings,
  feedback: FeedbackContext,
  ticket: TicketContent,
): Promise<string> {
  const res = await fetch(`${settings.baseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      Authorization: jiraAuthHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      fields: {
        project: { key: settings.projectKey },
        issuetype: { name: settings.issueType },
        labels: settings.labels,
        summary: ticket.title,
        description: buildDescriptionAdf(feedback, ticket),
      },
    }),
  });
  if (!res.ok) throw await jiraError(res, 'issue create');
  const body = (await res.json()) as { key?: string };
  if (!body.key) throw new Error('Jira issue create returned no key');
  return body.key;
}

/** Attach the screenshot bytes to an existing issue. */
export async function attachScreenshot(
  settings: JiraSettings,
  issueKey: string,
  screenshot: Uint8Array,
  mimeType: string,
): Promise<void> {
  const form = new FormData();
  const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
  form.append('file', new Blob([screenshot], { type: mimeType }), `screenshot.${extension}`);
  const res = await fetch(`${settings.baseUrl}/rest/api/3/issue/${issueKey}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: jiraAuthHeader(),
      // Required by Jira to bypass XSRF protection on multipart uploads.
      'X-Atlassian-Token': 'no-check',
    },
    body: form,
  });
  if (!res.ok) throw await jiraError(res, 'attachment upload');
}

/** Browse URL for a created issue (used in the notification email). */
export function jiraIssueUrl(settings: JiraSettings, issueKey: string): string {
  return `${settings.baseUrl}/browse/${issueKey}`;
}
