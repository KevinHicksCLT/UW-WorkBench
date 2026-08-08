# Roadmap

v0.1 ships the full governed submission-to-bind spine with real validation, a real governance
event log, real MCP, and shareable content packs. The categories below are the honest gap
list — each has a defined seam waiting for a contributor.

## Simulated today (contract real, implementation stubbed)

| Area | Today | The seam |
|---|---|---|
| Document extraction (ACORD forms, SOVs, loss runs) | Intake accepts the extraction contract `{field, value, confidence, provenance}` | An adapter service that OCRs/parses and emits that contract; <0.70 confidence already quarantines |
| Sanctions screening | Watchlist verdicts accept caller-supplied match evidence | Provider adapter (OFAC/UN/EU consolidated lists) behind `POST /uw/submissions/:id/clearance` |
| Enrichment providers | Registry + jurisdiction filter + TTL cache are real; payloads simulated | Per-source fetch adapters keyed by `EnrichmentSource.kind` |
| PAS bind | Idempotent, governed, generates the policy ref | Connector interface per PAS; `UwPasBinding.contractVersion` pins payload shape |
| LLM agent plane | ProposalEnvelope + disposition + MCP wrapper are real; no live model server-side | An agent worker that reads the pipeline via MCP and proposes via `uw_propose_decision`, with recorded fixtures in CI |

## Not yet built (design intent documented)

- **Webhook dispatcher** — the 14 event types land on the governance spine; outbound
  HMAC-signed at-least-once delivery + replay from `GET /uw/events`.
- **Renewals** — expiring-term diff, repricing, rate-change rationale.
- **Portfolio steering** — mix vs plan, aggregation/accumulation watch, capacity burn-down.
- **Knowledge Q&A** — guideline corpus Q&A with clause-level citations.
- **Bordereaux pipeline** — nightly delegated-book parse vs grant limits feeding
  `breachCount90d` (the field and gates already exist).
- **Agent budgets & kill switch** — per-tenant spend/action ceilings; the `AgentControl`
  event type is reserved for it.
- **Broker management** — producer scoring, tiering, per-relationship SLAs.
- **Pack registry service** — today packs are bundled + PR-contributed; a hosted registry with
  signing and download counts is the end-state.
- **Postgres RLS** — tenancy is app-layer scoped on every query today; DB-level RLS is the
  defense-in-depth follow-up.

## Principles that survive every roadmap item

Deterministic core / probabilistic edge · proposal-only agents · authority bound to roles ·
append-only audit · human-dispositioned bind · versioned-never-mutated governed artifacts.
