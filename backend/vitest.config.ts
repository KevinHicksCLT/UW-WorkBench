import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Tests live in a separate mirrored tree (tests/**), not colocated with src.
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Coverage is measured over the pure logic layers (resolvers, lib,
      // middleware helpers). Route handlers and seed scripts are exercised by
      // the E2E smoke suite + API baseline diff instead of unit tests.
      include: ['src/lib/**/*.ts', 'src/middleware/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/lib/skillPacks.ts', 'src/lib/adminRegistry.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
});
