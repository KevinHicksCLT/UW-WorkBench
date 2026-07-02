import { defineConfig } from '@playwright/test';

/**
 * E2E smoke suite configuration.
 *
 * Expects the app already running locally (backend :4000, frontend :5173) —
 * `npm run dev:backend` + `npm run dev:frontend`. The suite logs in as the
 * seeded admin and walks every top-level route, failing on console errors,
 * failed API calls, or blank screens. Screenshot output directory is
 * controlled by the SCREEN_DIR env var (defaults to e2e/screens).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1600, height: 900 },
    screenshot: 'off',
    trace: 'off',
  },
});
