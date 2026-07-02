// Flat ESLint config for the monorepo. Quality gate: CI and the pre-commit
// hook run `eslint . --max-warnings 0`, so every enabled rule is effectively
// blocking. Rules we consciously defer are disabled with a rationale rather
// than left as warnings.
//
// Scope: the gate covers application source (backend/src, frontend/src,
// shared, e2e, root configs). Excluded with rationale:
//   - documents/**, standards/** — content artifacts served from the DB /
//     authored docs, not executable app code.
//   - backend/scripts/**, scripts/**, .claude/** — one-off operational /
//     data-migration / verification scripts kept for replayability; they
//     never ship and are exercised manually.
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
      'standards/**',
      'backend/scripts/**',
      'scripts/**',
      '.claude/**',
      'playwright-report/**',
      'test-results/**',
      'backend/prisma/migrations/**',
      'frontend/public/**',
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
      // Deferred (documented): complexity is being reduced structurally by the
      // file-split work; re-enable once the split settles so the number is a
      // ratchet, not noise.
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-nested-conditional': 'off',
      'sonarjs/no-nested-template-literals': 'off',
      'sonarjs/no-nested-functions': 'off',
      'sonarjs/todo-tag': 'off',
    },
  },
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Classic hook correctness rules only. The React-Compiler-era rules
      // (set-state-in-effect, use-memo, purity, …) and exhaustive-deps demand
      // rewrites of effect logic — behavior-risky during a pixel-identical
      // refactor. Deliberately deferred to a post-cutover hardening pass.
      'react-hooks/rules-of-hooks': 'error',
      'react-refresh/only-export-components': 'off',
    },
  },
);
