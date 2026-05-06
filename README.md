# Cascade — Enterprise Transformation & Program Management Platform

A working MVP of a strategic portfolio management platform for enterprise transformation programs, modeled on the capabilities surveyed in the companion research report. Built as a generic, reusable codebase: nothing in here references any specific commercial product.

## What it does

- **Program / Workstream / Initiative hierarchy** with full roll-up of financials, status, and dates
- **Time-phased value capture (Metrics + Datasets)** — every financial line item carries monthly Actual / Target / Forecast / Variance series
- **Stage-gated initiative workflow** (Idea → Plan → Execute → Realize → Complete) with two-step approvals and audit history
- **RAID log** (Risks / Assumptions / Issues / Decisions) with severity heatmap
- **OKR module** — Strategic Objectives, KPIs with weighted aggregation, Initiative ↔ Objective alignment with Level-of-Impact value scoring
- **Dashboards** — KPI tiles, status roll-ups, financial waterfalls, portfolio Gantt
- **Business rules engine** — event-driven actions (Set Value, Send Notification, Run Rule)
- **Multi-tenant** with row-level isolation and JWT auth
- **REST API** (kept simple for the MVP; a GraphQL layer is a stage-2 add)

## Architecture

```
┌─────────────────┐         ┌────────────────────┐         ┌──────────────┐
│  React + Vite   │ ──────▶ │  Express + Prisma  │ ──────▶ │   SQLite     │
│  Tailwind, RC   │  REST   │  JWT, RBAC, rules  │  ORM    │  (or PG)     │
└─────────────────┘         └────────────────────┘         └──────────────┘
                                     │
                                     ├── Workflow engine
                                     ├── Roll-up engine
                                     ├── Business rules engine
                                     └── Notification dispatcher
```

## Quick start

```bash
# Backend
cd backend
npm install
npm run db:setup    # creates schema + seeds demo data
npm run dev         # http://localhost:4000

# Frontend (new terminal)
cd frontend
npm install
npm run dev         # http://localhost:5173
```

Default demo login: `demo@cascade.io` / `demo1234`

## Repository layout

```
backend/
  prisma/schema.prisma     # full data model
  src/
    routes/                # REST endpoints
    services/              # rollups, workflow, rules engine
    middleware/            # auth, tenant scoping, RBAC
    seed/                  # demo data generator
frontend/
  src/
    pages/                 # Portfolio, Program, Initiative, OKR, RAID
    components/            # KpiTile, GanttChart, RaidHeatmap, etc.
    lib/                   # API client, auth context
docs/
  FUNCTIONAL.md            # functional spec by module
  TECHNICAL.md             # data model, API, services
  PRODUCT_GUIDE.md         # end-user product guide
```

See `docs/` for the full functional and technical documentation.

## Deploy to Vercel (free, click-through)

The repo is configured as a single Vercel project: the Vite frontend is served as static assets, and the Express backend runs as a serverless function at `/api/*`. Push to GitHub once; every push after that auto-deploys.

The build itself runs `prisma db push` and seeds the demo data on the first deploy — there is nothing to run from your terminal.

### Step 1 — Push to GitHub (use GitHub Desktop, no terminal)

1. Open **GitHub Desktop** → *File* → *Add local repository* → choose `transform-platform/`.
2. When prompted, click **Create a repository** (it'll initialize git for you).
3. Click **Publish repository** → choose private/public → publish.

### Step 2 — Create a Postgres database (Neon free tier)

1. Go to https://neon.tech, sign in with GitHub, create a project.
2. Copy the **Pooled connection** string (looks like `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require`).

### Step 3 — Import the repo into Vercel

1. Go to https://vercel.com/new, sign in with GitHub.
2. Pick the repo you just published. Vercel auto-detects the config in `vercel.json`.
3. Before clicking **Deploy**, expand **Environment Variables** and add:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | Paste the Neon pooled connection string |
   | `JWT_SECRET` | Any long random string — e.g. mash the keyboard, or use https://generate-secret.vercel.app/32 |

4. Click **Deploy**.

That's it. Vercel will:
- install both workspaces,
- generate the Prisma client,
- push the schema to Neon (creates the tables),
- seed the demo tenant (only runs when the DB is empty — safe to re-deploy),
- build the frontend.

When it finishes, your app is live at `https://<project>.vercel.app`. Log in with `demo@cascade.io` / `demo1234`.

### Subsequent deploys

Push to your default branch in GitHub Desktop. Vercel rebuilds automatically. The seed script no-ops if data already exists, so it won't wipe your DB. Schema changes that are non-destructive (new tables, new optional columns) will be pushed by `prisma db push` on the next deploy.

### Re-seeding (optional)

To wipe + re-seed, in Vercel set env var `SEED_FORCE=1`, redeploy, then **remove** the var (otherwise every future deploy will wipe data).

