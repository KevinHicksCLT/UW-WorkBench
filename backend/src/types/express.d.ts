import type { User } from '@prisma/client';

// requireAuth populates these on every authenticated request. Declared as
// required (not optional) so route handlers can read them without `!` — the
// near-universal `router.use(requireAuth)` guarantees they are set.
declare global {
  namespace Express {
    interface Request {
      user: User;
      tenantId: string;
    }
  }
}

export {};
