import type { User } from '@prisma/client';

// requireAuth populates these on every authenticated request. Declared as
// required (not optional) so route handlers can read them without `!` — the
// near-universal `router.use(requireAuth)` guarantees they are set.
//
// This is a real module (not a .d.ts) and is side-effect-imported by app.ts so
// the global augmentation is always part of the entry-point compilation —
// Vercel's backend builder type-checks from the app.ts import graph and would
// otherwise miss an un-imported ambient .d.ts.
declare global {
  namespace Express {
    interface Request {
      user: User;
      tenantId: string;
    }
  }
}

export {};
