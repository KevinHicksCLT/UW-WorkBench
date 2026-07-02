import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts', './tests/setup.ts'],
    // Tests live in a separate mirrored tree (tests/**), not colocated with src.
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Coverage is measured over the shared building blocks (lib + ui
      // component library). Page-level composition is exercised by the E2E
      // smoke suite, which asserts every route renders against the baseline.
      include: ['src/lib/**/*.{ts,tsx}', 'src/components/ui/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.*',
        'src/test/**',
        // Pure data catalogs — static term/config/widget/skill definitions with
        // no logic. Measuring line coverage of constant data is padding, not
        // signal; every function-bearing lib module stays measured.
        'src/lib/glossary.ts',
        'src/lib/adminConfig.ts',
        'src/lib/dashboardWidgets.tsx',
        'src/lib/skills.ts',
      ],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
});
