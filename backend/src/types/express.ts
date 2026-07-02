import type { User } from '@prisma/client';

// requireAuth populates these on every authenticated request. Declared as
// required (not optional) so route handlers can read them without `!` — the
// near-universal `router.use(requireAuth)` guarantees they are set.
//
// Augments express-serve-static-core's Request (the interface Express's Request
// extends) via ESM module augmentation — same effect as the legacy
// `declare global { namespace Express }` pattern without the namespace syntax.
//
// This is a real module (not a .d.ts) and is side-effect-imported by app.ts so
// the augmentation is always part of the entry-point compilation — Vercel's
// backend builder type-checks from the app.ts import graph and would otherwise
// miss an un-imported ambient .d.ts.
declare module 'express-serve-static-core' {
  interface Request {
    user: User;
    tenantId: string;
  }
}

export {};
