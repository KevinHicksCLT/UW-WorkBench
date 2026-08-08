# UW Workbench

**The open-source, AI-native underwriting workbench.** Submission → clearance → enrichment →
triage → desk decision → authority & referral → quote → bind, on an append-only governance
spine shared by humans and AI agents — with the underwriting content itself (appetite,
guidelines, authority) as **shareable, versioned, crowdsourced packs**.

Anyone can stand up an underwriting company in minutes. Anyone can share the book of rules
they wish they'd started with.

```
npx create-uw-workbench my-carrier
```

*(or clone this repo — Quickstart below)*

---

## Why this exists

Commercial underwriting platforms are closed, expensive, and re-implement the same spine:
intake, clearance, appetite, triage, authority, referral, quote, bind, audit. The spine is
not the differentiator — **the judgment encoded in appetite statements, guideline rules, and
authority grants is**. So this project open-sources the spine and makes the judgment layer a
portable, versioned artifact (a *content pack*) that the community can fork, improve, and
share — the way infrastructure teams share Terraform modules.

## The load-bearing design decisions

| Principle | What it means here |
|---|---|
| **Appetite as code** | Appetite statements are versioned, effective-dated data. Publishing creates `ref@version+1`; in-place mutation is structurally impossible (INV-3). Every verdict cites the statement refs it derived from. |
| **Authority as data** | Grants bind to a **Roles catalog**, never to user ids (ADR-03). Every decision runs through a pure-function validator that returns per-limit check rows; a breach auto-opens a referral routed up the role chain (INV-1). |
| **Deterministic core, probabilistic edge** | Rules are decision tables evaluated by a pure, sandboxed evaluator with an `inputsHash` — same inputs, same verdict, replayable forever (NFR-02). LLM/agent output enters only as a **ProposalEnvelope** a human must dispose (ADR-02). |
| **No unaudited agency** | Every agent action — including every MCP tool call, reads included — is wrapped in an `AgentAction` with exactly one governance event (INV-5). |
| **The audit *is* the event log** | An append-only governance spine records the whole intake-to-bind narrative under one correlation id (NFR-04). There is no update or delete path in the service layer. |
| **Human-in-the-loop by default** | No bind without a human-dispositioned decision (INV-2). Straight-through processing is a per-rule, explicitly approved privilege — never a default. Watchlist releases need two signatures from **distinct roles** (INV-4). |
| **PAS stays the system of record** | Bind is an idempotent, correlation-keyed handoff to a registered PAS target; this workbench holds the underwriting projection. |

## What's in the box

- **Server** (`server/`) — Express + Prisma/Postgres API: 19-entity underwriting domain in five
  planes, syntax gates (zod → `422` with per-field violations) and semantic gates (`403`/`409`
  with the violated invariant named), self-service signup that provisions a complete
  underwriting operation, and a dependency-free **MCP server** (`POST /uw/mcp`) so any
  MCP-capable agent can work the pipeline under governance.
- **Web** (`web/`) — the workbench: Pipeline Triage, Risk Workspace (desk mode with evidence
  provenance, proposal cards, authority check rows, quote & bind), Appetite Studio, Authority
  Matrix, Rationalization, Governance Audit, and the Packs library.
- **Packs** (`packs/`) — the commons. Versioned JSON bundles of appetite + rules + authority
  templates + enrichment sources, validated against [`packs/pack.schema.json`](packs/pack.schema.json).
  Two starters ship today: `commercial-property-starter` and `mga-delegated-authority`.
- **CLI** (`cli/`) — `npx create-uw-workbench`: clone → install → Postgres via Docker →
  migrate → seed → running desk with a demo pipeline.

## Quickstart

```bash
git clone https://github.com/KevinHicksCLT/uw-workbench.git
cd uw-workbench
npm install
docker compose up -d                 # Postgres on :5433
cp .env.example server/.env
npm run db:setup                     # migrate + seed the demo estate
npm run dev:server                   # API on :4000
npm run dev:web                      # UI  on :5173
```

Log in with **demo@uw-workbench.dev / underwrite!** — or hit **/signup** and create your own
company: you get a tenant, an org, a role ladder with a real escalation chain, a PAS target,
and a starter pack applied, decision-ready.

The seeded demo pipeline exercises every invariant: an in-appetite risk ready to quote, an
edge-appetite risk carrying a pending AI proposal (disposition it), and a sanctions watchlist
hold waiting for its two-role dual-control release.

## Content packs — the crowdsourced commodity

```
GET  /uw/packs                    # list bundled packs
POST /uw/packs/import             # { slug } or { pack: <json> } — versioned, never mutates
POST /uw/packs/export             # your ACTIVE estate → shareable pack JSON
```

Import a pack to start a book. Reshape it in the Appetite Studio and Authority Matrix. Export
it, and **open a PR adding it under `packs/`** — every pack is schema-validated in CI. Grant
templates reference roles by *label* and resolve against the importing company's own Roles
catalog, so authority never travels as user ids.

## MCP: agents as governed colleagues

Point any MCP client at `POST http://localhost:4000/uw/mcp` with a Bearer JWT. Nine tools
mirror the REST surface: list/inspect the pipeline, evaluate appetite (always with citations),
read the audit trail — and `uw_propose_decision`, which **never transitions state**: it writes
a ProposalEnvelope that a human accepts, modifies, or rejects in the workbench. Every call
lands on the governance spine.

## API in 60 seconds

| | |
|---|---|
| `POST /auth/signup` | create a company (tenant + org + role chain + starter pack) |
| `POST /uw/submissions` | intake with per-field extraction confidence + provenance; <0.70 quarantined |
| `POST /uw/submissions/:id/clearance` · `POST /uw/clearance/:id/release` | duplicate/blocked/watchlist; dual-control release (INV-4) |
| `POST /uw/triage/rescore` | versioned, explainable 4-lens scores — appended, never overwritten |
| `GET/POST /uw/appetite/statements` · `GET /uw/appetite/evaluate` | governed appetite; publish = v+1; verdicts cite refs |
| `GET/POST /uw/authority/grants` · `POST /uw/decisions` · `POST /uw/referrals/:id/resolve` | authority-as-data; pure-fn validation; escalation chain from the Roles catalog |
| `POST /uw/quotes` · `POST /uw/bind` | bind gated on human decision (INV-2) + resolved refs (INV-7); idempotent by correlationId |
| `GET /uw/events` · `GET/POST /uw/agent-actions*` | the append-only audit spine + proposal inbox |
| `GET /uw/rationalization/divergence*` | cross-estate divergence pairs; CUO-gated merge/retire with impact preview (INV-6) |

Full error contract: syntax failures are `422 {error:'validation_failed', violations:[…]}`;
semantic failures are `403`/`409` with the violated invariant named — so integration failures
are always explainable.

## Design lineage & status

The domain model implements a formal underwriting decisioning ontology (19 node types, five
planes, invariants INV-1..7) developed against the commercial underwriting-platform landscape
(design lineage: a v0.1 requirements workbook, HLD/LLD, wireframes, and validation spec).
This is a **v0.1 foundation**: document extraction, sanctions screening, enrichment providers,
PAS connectors, and the live LLM agent plane are simulated behind real contracts — see
[`docs/ROADMAP.md`](docs/ROADMAP.md) for the honest gap list and how to help close it.

## Contributing

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md). The two highest-leverage contributions:

1. **Share a pack.** Your niche's appetite/guideline/authority starter is someone else's
   cold-start solved.
2. **Close a roadmap gap.** Extraction adapters, screening providers, PAS connectors, and the
   webhook dispatcher all have defined seams waiting.

## License

[Apache-2.0](LICENSE) — permissive, patent-granting, enterprise-friendly. Underwrite freely.
