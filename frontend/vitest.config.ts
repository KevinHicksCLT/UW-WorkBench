import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Coverage is measured over the shared building blocks (lib + ui
      // component library). Page-level composition is exercised by the E2E
      // smoke suite, which asserts every route renders against the baseline.
      include: ['src/lib/**/*.{ts,tsx}', 'src/components/ui/**/*.{ts,tsx}'],
      exclude: ['**/*.test.*', 'src/test/**'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
});
