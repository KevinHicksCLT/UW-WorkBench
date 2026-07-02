// Flat ESLint config for the whole monorepo (backend, frontend, shared, e2e).
// Quality gate: CI and the pre-commit hook both run with --max-warnings 0.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import sonarjs from 'eslint-plugin-sonarjs';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'documents/**',
      'playwright-report/**',
      'test-results/**',
      'backend/prisma/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    rules: {
      // Charter Task 6: no `any`, no suppressed type errors.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Cognitive-complexity and duplication rules are advisory during the
      // refactor burn-down; correctness rules stay errors.
      'sonarjs/cognitive-complexity': ['warn', 25],
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-nested-conditional': 'off',
      'sonarjs/no-nested-template-literals': 'off',
      'sonarjs/todo-tag': 'warn',
    },
  },
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Node-side code may log; scripts are operational tooling.
    files: ['backend/**/*.ts', 'e2e/**/*.ts', '*.ts', '*.js'],
    rules: {},
  },
);
