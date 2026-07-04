/// <reference types="vite/client" />

/**
 * Build-time constant injected by the `define` block in vite.config.ts —
 * the deployed commit SHA (Vercel's VERCEL_GIT_COMMIT_SHA) or "dev" locally.
 */
declare const __COMMIT_SHA__: string;
