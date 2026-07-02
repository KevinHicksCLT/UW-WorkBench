# Codebase Refactor Charter

**Goal:** Refactor this codebase to meet enterprise-grade design, architecture, coding
standards, and regulatory expectations — using the right tools for the right jobs. The
guiding constraint for every task: **all existing functionality must work exactly as it
does today when the refactor is complete.** No task is "done" until that is verified.

**Reference deployment (behavior must match):**
https://transform-platform-git-develop-kevins-projects-e3a4abb1.vercel.app

Branches: git `refactor` + Neon DB `refactor` (`br-ancient-hat-aq0y4y43`), both cut from
`develop` on 2026-07-02. Behavioral baseline: `documents/refactor-baseline/`.

---

## Frontend & Architecture

- **Task 1 — Database-driven configuration.** No hardcoded display data/structure/prefs;
  company-configurable from DB; onboarding via data alone.
- **Task 2 — Break up the monolithic frontend.** Modular structure, best practices,
  measured performance improvement (bundle size, load times, Core Web Vitals).
- **Task 3 — Internal component library.** One canonical implementation per shared
  component (lists/tables, maps, checklists, cards, headers, buttons, inputs, modals,
  loading/empty/error states). Pages compose from the library.
- **Task 4 — Logical code organization.** Feature-based grouping; no files over
  ~300–500 lines; helpers/utils/hooks/services extracted.

## Code Quality & Standards

- **Task 5 — Comprehensive documentation.** Inline comments for non-obvious logic,
  TSDoc on shared utilities/components, README per major module.
- **Task 6 — Strict type safety.** TS strict mode, no `any`, no suppressed errors.
- **Task 7 — Automated quality gates.** Lint (+ static analysis) on pre-commit and CI;
  pushes/merges blocked on any error or warning.
- **Task 8 — Unit testing to 80%+ coverage.** Meaningful tests, critical logic first,
  coverage as CI gate.
- **Task 9 — Remove all dead code.** Unused components/functions/imports/styles/deps;
  verified by regression checks.
- **Task 10 — Git workflow & mandatory code review.** feature → develop → master,
  protected branches, PR review, CONTRIBUTING.md.

## API & Backend

- **Task 11 — Correct API structure & tooling.** Consistent documented structure,
  proper status codes, reusable/configurable.
- **Task 12 — API performance & best practices.** Profile slow endpoints first, fix
  actual bottlenecks (measured before/after), pagination/caching/N+1 elimination/payload
  minimization, p95 targets met.
- **Task 13 — Error handling, logging & monitoring.** Structured errors, centralized
  logs with tenant context, graceful UI error states — nothing silently swallowed.
- **Task 14 — Security & tenant isolation.** ⏸️ **ON HOLD** — deferred, revisit before
  production cutover / multi-company onboarding.

## Database

- **Task 15 — Evaluate Prisma.** Documented ORM decision (misconfigured vs wrong tool);
  schema/data carry over; one-command local setup.
- **Task 16 — Remove dead tables & data.** Zero-code-reference verification + backup +
  reversible migration before any drop.
- **Task 17 — Single source of truth.** Normalized, FKs enforce integrity, indexes match
  real query patterns.
- **Task 18 — Migration & seeding workflow.** Version-controlled migrations only;
  migrate + seed produces identical environments.

## Process & Delivery

- **Task 19 — Big-bang execution plan.** Behavioral baseline before work (E2E smoke,
  screenshots, API contracts); verify new build against full baseline; rehearsed cutover
  with rollback path.
- **Task 20 — CI/CD pipeline.** Lint, typecheck, static analysis, tests, build on every
  push; auto-deploy to staging.
- **Task 21 — Environment-synchronized deployment pipeline.** One merge = code + Neon DB
  branch promotion (migrations) + Vercel env verification + monitored deploy + automatic
  branch cleanup (git and Neon).
- **Task 22 — Onboarding documentation.** Clone → running app → first merged PR in under
  a day, from docs alone.

---

Original raw drafts preserved as `charter-draft-1.txt` / `charter-draft-2.txt`.
