import type { User } from '@prisma/client';

// requireAuth populates these on every authenticated request. Declared as
// required (not optional) so route handlers can read them without `!` — the
// near-universal `router.use(requireAuth)` guarantees they are set.
//
// Augments express-serve-static-core's Request (the interface Express's Request
// extends) via ESM module augmentation. This is a real module (not a .d.ts)
// and is side-effect-imported by app.ts so the augmentation is always part of
// the entry-point compilation.
declare module 'express-serve-static-core' {
  interface Request {
    user: User;
    tenantId: string;
    /** Raw request body captured by express.json verify — needed for webhook HMAC. */
    rawBody?: Buffer;
  }
}

export {};
