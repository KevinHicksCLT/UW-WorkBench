# UW Workbench — Capability Gap Analysis

**Version:** 0.1.0 · **Date:** 2026-08-03 · **Status:** documented per build instruction —
"if there are missing categories of capability based on research, document those and proceed."

The v0.1 build implements the full submission→bind spine (CAP-01..10, 12..14) with real
syntax/semantic validation, the governance spine, and MCP. The categories below are **known
gaps** — either simulated in this build, or absent from the source deliverables entirely and
identified from the wider commercial landscape (Guidewire UnderwritingCenter/Predict, Duck
Creek + Send, hyperexponential, Earnix, Federato, Cytora, Groundspeed/Convr, Origami, Verisk).

## A. Simulated in v0.1 (interface real, implementation stubbed)

| # | Capability | v0.1 state | Path to real |
|---|---|---|---|
| A1 | **Document intelligence / extraction** (ACORD 125/126/140, SOV xlsx, loss runs) | Intake accepts the LLR-01 extraction contract as input; no OCR/LLM extractor runs in-process | Wire an extraction service (Azure Doc Intelligence / Textract / LLM vision) behind CAP-01; keep the per-field confidence + provenance contract unchanged |
| A2 | **Sanctions screening** | Watchlist verdict accepts screening evidence (matchScore, list) from the caller; no live OFAC/UN/EU list service | Bridger/Dow Jones-class connector; tenant-config fuzzy thresholds + refresh cadence |
| A3 | **Enrichment providers** | Registry + jurisdiction filter + TTL cache are real; payloads are simulated | Per-source adapters (HazardHub-class hazard, D&B firmographics, geocoding, cat models) via the TB connector layer |
| A4 | **PAS bind connectors** | Bind is idempotent and governed; `pasPolicyRef` is generated, not written to a live PAS | INTEG-FRAMEWORK adapters (Guidewire PolicyCenter, Duck Creek Policy) with versioned payload contracts — ADR-01/ADR-03 boundary decision applies |
| A5 | **LLM agent plane** | ProposalEnvelope, disposition, budgets-by-schema and the MCP wrapper are real; no live model call is made server-side | Route agents through the AI gateway already present in TB (`@anthropic-ai/sdk` is a dependency); recorded fixtures in CI, never live LLM |

## B. Missing capability categories (not in the UW-WORK deliverables; recommended)

| # | Category | Why it matters | Landscape evidence |
|---|---|---|---|
| B1 | **UW knowledge Q&A with citations (CAP-11)** | HLR-15 defines it but no schema/service was specified ("RAG service; no schema LLR"). Guideline corpus Q&A with clause-level citations is table stakes | GW ProNavigator acquisition; DC "Clarity"; hx knowledge surface |
| B2 | **Renewal book management** | The workbench is new-business-shaped. Renewals (pull history, reprice, expiring-terms diff, rate-change rationale) are most of a commercial desk's volume | hx Renew is named for it; Send renewal workflows |
| B3 | **Portfolio steering analytics** | CAP-12 shipped as pipeline KPIs only. Mix-vs-plan, aggregation/accumulation watch (cat zones, per-account stacking), capacity burn-down need a real analytics layer | hx Portfolio Intelligence; Federato RiskOps is *built* on portfolio-first triage |
| B4 | **Premium/rate adequacy feedback loop** | Bound-vs-quoted-vs-technical price telemetry back into appetite + triage weights; drift detection on the triage model | Earnix deployed-rate monitoring; RATE-PRICE CAP-14 |
| B5 | **Broker/producer management** | Broker is a string today. Submission quality scoring by producer, tiering, response-time SLAs per relationship | Send broker portal; GW producer engagement |
| B6 | **Work management / assignment engine** | Round-robin / skill-based / workload-balanced assignment beyond a single assignedRole; OOO coverage; team queues | DC Send "authority & SLA management"; ops manager persona P-3 |
| B7 | **Capacity & treaty awareness** | Line size vs treaty capacity, facultative placement triggers, cession hints at quote time | London-market workbenches (Send); hx treaty stress-testing |
| B8 | **Loss-run intelligence** | Structured loss-history normalization (frequency/severity trending, development) feeding triage EV lens | Groundspeed/Convr class |
| B9 | **Peer benchmark & pricing context in the desk** | "Risks like this one" comparables surfaced beside the decision | hx auto-generated run DB; Federato similar-risk retrieval |
| B10 | **Compliance register binding** | UW guidelines/appetite should link to the existing TB compliance register (538 regs) the way RATE-PRICE filing packets do (REG-018 grain) | TB-native adjacency, cheap win |
| B11 | **Webhook delivery** | The 13 event types land on the governance spine; outbound HMAC-signed, at-least-once webhook delivery + replay (`GET /uw/events` is the replay source) is not yet implemented | UW-WORK-11 §4 names it |
| B12 | **Postgres RLS enforcement** | NFR-03 asks for DB-level RLS; TB standard today is app-layer scoping (every query tenant-walked). Consistent with the platform, but the NFR remains formally open | TB CLAUDE.md multi-tenancy section |
| B13 | **Bordereaux ingestion pipeline** | Delegated-authority grants carry the bordereaux gate and breach counter; the nightly bordereaux parse/compare job is not implemented | CAP-13, HLR-17 |
| B14 | **Kill-switch & agent budget enforcement** | NFR-05 budget caps/rate limits per tenant + per-agent kill switch emitting its own GovernanceEvent (`AgentControl` event type is reserved for it) | DC AI Assurance; GW Agent Studio |

## C. Deliberate boundaries (not gaps)

- **TB is not the production rating engine** (RATE-PRICE ADR-002) — `modelRef` resolves to the
  RATE-PRICING module; premium math stays there.
- **Forms content stays in FORMS-RATION** — `formSetRef` is a cross-module edge, not a copy.
- **PAS remains system of record** — the workbench holds the underwriting projection keyed by
  correlation/pas refs (CAP-18 pattern).
