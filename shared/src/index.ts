// Shared API contract — zod schemas + inferred types used by both the API
// (request validation) and the frontend (typed forms / responses).
import { z } from 'zod';

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

// ─── Health ────────────────────────────────────────────────────────────

export type HealthResponse = {
  ok: boolean;
  db: 'reachable' | 'unreachable';
  commit: string | null;
};
