// Shared API contract — zod schemas + inferred types used by both the API
// (request validation) and the frontend (typed forms / responses).
import { z } from 'zod';

export * from './menuRegistry.js';
export * from './userTypes.js';
export * from './entitlements.js';

// ─── Auth ──────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});
export type LoginRequest = z.infer<typeof loginSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.string(),
  tenantId: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

// ─── Feedback ──────────────────────────────────────────────────────────

// Submitter-chosen classification of an in-app feedback submission.
export const FEEDBACK_CATEGORIES = [
  'FUNCTIONAL_DEFECT',
  'FUNCTIONAL_ENHANCEMENT',
  'DATA_ISSUE',
] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Readonly<Record<FeedbackCategory, string>> = {
  FUNCTIONAL_DEFECT: 'Functional Defect',
  FUNCTIONAL_ENHANCEMENT: 'Functional Enhancement',
  DATA_ISSUE: 'Data Issue',
};

/** Human label for a stored category (legacy rows predate the field). */
export function feedbackCategoryLabel(category: string | null): string {
  if (!category) return 'Unclassified';
  return (FEEDBACK_CATEGORIES as readonly string[]).includes(category)
    ? FEEDBACK_CATEGORY_LABELS[category as FeedbackCategory]
    : category;
}

// ─── Health ────────────────────────────────────────────────────────────

export type HealthResponse = {
  ok: boolean;
  db: 'reachable' | 'unreachable';
  commit: string | null;
};
