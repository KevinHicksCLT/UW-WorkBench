---
name: engineering-development-sdlc-compliance
description: >
  Enforce and evidence the Engineering & Development standards area (24 standards owned by the CTO /
  Engineering Lead) across the software delivery lifecycle — requirements, design, development, and
  testing — for any code that will be merged, deployed, or operated. Use this skill whenever
  delivery work involves writing or reviewing code, branching and commits, pull requests, unit or
  integration testing, CI/CD pipelines and quality gates, deployments and rollback, repo
  documentation, or logging/metrics/alerting — even if the user does not say "engineering standard."
  Also use when setting up a new repository or pipeline, defining a squad's definition of done, or
  producing evidence that quality gates were enforced on a release. When unsure whether a change is
  held to these standards (it almost always is), run the scope gate rather than skipping it.
---

# Engineering Standards Across the SDLC — Quality Gates That Block, Not Suggest

## What this skill does

The Engineering & Development area defines **24 standards** across Code Quality, Version Control,
Code Review, Testing, CI/CD, Documentation, and Observability. Nearly all are **Build-phase** and
machine-enforceable — this skill turns them into **SDLC gates** wired into the pipeline, and names
the **evidence artifact** each leaves behind (SonarQube gate result, PR approval, coverage report),
so "we follow the standards" is a query against CI history, not a claim.

The source standards live in the app's Standards area (**Data Admin → Standards → Engineering &
Development**), each with category, Build/Run phase, and responsible role (Tech Lead, Test Lead,
DevOps Engineer, SRE).

## Operating principle (read once, apply always)

> **A standard that doesn't fail the build is a suggestion.** *Quality Gates* says the build fails
> on test failure, coverage drop, High+ security findings, or lint errors. Encode every enforceable
> standard as a pipeline gate; reserve human review for what machines can't judge.

Maintain the evidence in the pipeline itself: CI runs, gate results, and PR history **are** the
Engineering Compliance Record.

## STEP 0 — Scope gate (always run first)

1. **Will this code merge to a shared branch or deploy anywhere?** Then all standards apply — there
   is no "quick fix" exemption (*Branch Protection*: no direct commits to main, no force push).
2. **New repository?** Run the repo checklist first: CI pipeline (*Pipeline Standards* — builds
   < 15 min, auto-deploy to dev on merge), branch protection (PR + 2 approvers + CI green),
   *README Standards* (purpose, setup, run, test, deploy), linters per *Coding Standards*.
3. **Spike/throwaway?** Mark it clearly, keep it off main, and record that determination — spikes
   that ship become unmarked debt.

## The four phase gates

Each gate lists mandatory checks (named standards in italics) and the evidence each leaves behind.

### 1. Requirements
- Stories meet the squad's definition of ready with testable acceptance criteria — these become the
  unit/integration tests the Testing gate measures.
- Tag known shortcuts up front per *Technical Debt* (debt tagged in backlog, addressed within
  2 sprints, debt ratio < 15% of velocity).
- **Evidence:** acceptance criteria on the work item; debt items tagged and linked.

### 2. Design
- Plan the branch per *Branching Strategy* (GitFlow or trunk-based; feature branches < 3 days).
- Record significant decisions per *Architecture Docs* (ADRs; C4 diagrams maintained).
- Design observability in, not on: *Logging Standards* (structured JSON, correlation IDs, **no PII
  in logs**), *Metrics & Tracing* (RED metrics, distributed tracing, dashboard per service).
- For complex features, schedule *Pair Programming*.
- **Evidence:** ADR(s), logging/metrics design notes, branch plan on the work item.

### 3. Development
- *Coding Standards* and *Code Complexity* enforced by tooling: linters + Prettier/Black; cyclomatic
  complexity < 10, methods < 50 lines, classes < 500 lines — SonarQube gates, not opinions.
- *Commit Standards*: conventional commits, atomic, linked to the work item. *Code Comments*: no
  commented-out code in main.
- *Unit Test Coverage*: ≥ 80% line coverage, ≥ 90% on critical paths, no untested public methods.
- PRs per *PR Review SLA* (reviewed within 4 hours; nothing open > 48 hours) using the *Review
  Checklist* (functionality, tests, security, performance, maintainability).
- **Evidence:** green SonarQube gate, coverage report, PR approvals with checklist, conventional-commit history.

### 4. Testing
- *Integration Testing*: contract tests for APIs; integration tests for external dependencies;
  managed test data.
- *Test Automation*: all regression automated; manual testing for exploratory only; test pyramid
  observed.
- *Performance Testing*: load test before production; baseline established; regressions detected
  automatically.
- Release path per *Deployment Standards*: blue-green or canary, feature flags for gradual rollout,
  instant rollback verified. *Environment Parity*: dev/test/prod consistent via IaC, config
  externalized.
- **Evidence:** automated-suite results, load-test baseline + comparison, rollback rehearsal record.

## Run / operate handoff (not build gates)
*Alerting Standards* (alerts actionable, runbook linked, on-call rotation, alert fatigue monitored),
log/metric dashboard upkeep, *API Documentation* changelog maintenance, weekly knowledge-sharing
sessions, and ongoing debt-ratio tracking. Each needs a named owner (typically the Tech Lead or SRE).

## How to use this skill in practice
- **Reviewing a PR or repo:** run the Development gate checklist; anything not machine-enforced yet
  becomes a pipeline-gate work item.
- **New repo/pipeline setup:** run STEP 0's repo checklist before the first feature branch.
- **Release/audit prep:** pull CI history — gate results, coverage trend, PR approvals — as the
  evidence record.

## Boundaries
Engineering guidance for delivery teams. Waiving a gate (coverage exception, complexity exception,
expedited review) is a Tech Lead / Engineering Lead decision and must be recorded on the work item —
this skill never waives a gate silently. Architecture-level choices belong to the
enterprise-solution-architecture skill; security scanning depth to the cybersecurity-iso skill.
