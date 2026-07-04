import { readFileSync } from 'fs';
import { z } from 'zod';

/**
 * Feedback pipeline configuration — non-secret settings live in
 * backend/config/feedback.config.json so the feature can be toggled and the
 * Jira target changed without a code deploy. Secrets (JIRA_EMAIL,
 * JIRA_API_TOKEN, RESEND_API_KEY, ANTHROPIC_API_KEY) stay in the environment.
 *
 * The file is re-read on every call (it is tiny) so edits take effect without
 * a backend restart — the frontend button toggle picks changes up on the next
 * page load.
 */

const feedbackConfigSchema = z.object({
  /** Master switch for the header feedback button (served to the frontend). */
  feedbackButtonEnabled: z.boolean(),
  jira: z.object({
    /** When false the pipeline stops after ticket generation (status GENERATED). */
    enabled: z.boolean(),
    /** e.g. https://your-site.atlassian.net */
    baseUrl: z.string().min(1),
    projectKey: z.string().min(1),
    issueType: z.string().min(1).default('Task'),
    labels: z.array(z.string()).default(['feedback']),
  }),
  notifications: z.object({
    /** When false (or emails empty) the pipeline finishes at TICKETED. */
    enabled: z.boolean(),
    emails: z.array(z.string().email()).default([]),
  }),
});

export type FeedbackConfig = z.infer<typeof feedbackConfigSchema>;

// src/lib/feedback/ → backend/config/feedback.config.json
const DEFAULT_CONFIG_URL = new URL('../../../config/feedback.config.json', import.meta.url);

/** Validate raw JSON (exported separately so tests cover the schema directly). */
export function parseFeedbackConfig(raw: unknown): FeedbackConfig {
  return feedbackConfigSchema.parse(raw);
}

/** Load + validate the config file (path overridable via FEEDBACK_CONFIG_PATH). */
export function loadFeedbackConfig(): FeedbackConfig {
  const source = process.env.FEEDBACK_CONFIG_PATH ?? DEFAULT_CONFIG_URL;
  const text = readFileSync(source, 'utf8');
  return parseFeedbackConfig(JSON.parse(text));
}
