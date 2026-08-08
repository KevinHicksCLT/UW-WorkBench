# UW WorkBench

Standalone AI-native underwriting workbench (UW-WORK module): the
submission → clearance → enrichment → triage → desk decision → authority /
referral → quote → bind spine, on an append-only governance event log shared
by humans and AI agents.

This application was extracted from the Transformation Bridge
platform, where it first shipped as the `/uw-workbench` module. The 19 UW
entities, the `/uw` API (invariants INV-1..7, ADR-02/03), the MCP agent
surface, the deterministic decision engine, and the seven frontend surfaces
are carried over one-for-one; the platform's operating-model graph is reduced
to the minimal catalog the UW domain joins against (Company, Role, OrgUnit,
Application, ProcessNode).

## Architecture

npm-workspaces monorepo, TypeScript + ESM throughout (relative imports carry a
`.js` extension — required by the tsx/ESM resolver).

```
backend/    Express :4000 — routes/uw (feature-module routers), lib/uw engine,
            Prisma + Postgres, pino logging, JWT auth (app-layer tenancy)
frontend/   Vite + React 18 + Tailwind :5173 — /api/* proxied to :4000 with
            the prefix stripped (Express mounts routers at the root)
docs/       API contracts + capability gap analysis
```

Key surfaces:

- **Pipeline Triage, Risk Workspace, Appetite Studio, Authority Matrix,
  Rationalization, Governance Audit, SDLC View** — the seven workbench tabs
  (`frontend/src/pages/uw-workbench/`).
- **`POST /uw/mcp`** — JSON-RPC 2.0 MCP surface, 9 tools mirroring REST; every
  call is wrapped in a `UwAgentAction` + `UwGovernanceEvent`, and mutations are
  ProposalEnvelopes only (ADR-02).
- **Validation convention (UW-WORK-11):** syntax gates are inline zod (the
  central error handler renders 422 with per-field violations); semantic gates
  return 403/409 with the violated invariant (INV-1..7) named in the body.

## Quickstart

Requires Node ≥ 20 and a Postgres database (Neon or local).

```bash
npm install
cp backend/.env.example backend/.env   # point DATABASE_URL / DIRECT_URL at your DB

npm run db:setup -w uw-workbench-backend   # migrate deploy + seed demo estate

# Two terminals:
npm run dev:backend     # Express on :4000
npm run dev:frontend    # Vite on :5173
```

Demo login after seeding: `kevin.hicks@capgemini.com` / `demo1234`
(SITE_ADMIN; operating role = Chief Underwriting Officer, so the CUO gate
INV-6 and dual-control release INV-4 are exercisable out of the box). A
second, non-privileged desk login: `underwriter@demo-carrier.io` / `demo1234`.

## Commands

```bash
npm run typecheck       # tsc --noEmit, backend + frontend
npm test                # vitest — 16 engine unit tests
npm run test:coverage   # + coverage thresholds over lib/uw
npm run build           # prisma generate + vite build

npm run db:migrate -w uw-workbench-backend   # new migration (never db push)
npm run db:seed    -w uw-workbench-backend   # reseed the UW demo estate
```

Schema changes go through migrations only. The seed is idempotent: catalog
rows upsert by natural key; the UW domain is delete-then-recreate per company.
