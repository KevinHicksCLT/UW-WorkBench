# UW Workbench — API Contracts (REST + MCP)

**Module:** UW-WORKBENCH · **Mount:** `/uw` (frontend calls via `/api/uw/*`) · **Version:** 0.1.0
**Sources:** UW-WORK-04 LLD §2, UW-WORK-11 Validation & Integration Spec §4, tb-uw-workbench ontology v0.1.0

Three surfaces, one service:

1. **REST** — the human-plane surface (documented below).
2. **MCP** — `POST /uw/mcp` (streamable-HTTP JSON-RPC 2.0) mirrors the read surface plus
   proposal issuance for agent callers. Every `tools/call` is wrapped in a `UwAgentAction`
   with exactly one audited-by `UwGovernanceEvent` (INV-5).
3. **Governance event stream** — `GET /uw/events` is the audit export; the audit **is** the
   event log (NFR-04). The 13 webhook-equivalent event types land on this spine.

## Conventions

- **Auth:** Bearer JWT (same as the rest of TB). `requireAuth` sets `tenantId` from the token —
  never from the body. Router-level `requirePermission('uw-workbench')` applies menu-key RBAC
  (CRUD action derived from HTTP method); ABAC facets (operating role, escalation chain, CUO
  seat, dual-control role distinctness) are enforced per-endpoint.
- **Tenancy:** every query is scoped `tenantId` + active company (`?companyId`, defaulting to
  the tenant's first company). Cross-tenant refs → **404**, never 403.
- **Syntax gates** (shape: type/pattern/range/enum) are inline zod — failures render **422**
  `{ error: 'validation_failed', violations: [{ field, message }] }` before business logic runs.
- **Semantic gates** (meaning vs current state) return **403** (actor lacks the seat) or **409**
  (state forbids the transition) with the violated invariant named:
  `{ error: '…', invariant: 'INV-4' }`.
- **String enums** match `schema.prisma` comments exactly (no Prisma enums).

## Invariants enforced in the service layer

| ID | Rule | Where |
|---|---|---|
| INV-1 | No decision without a passing AuthorityGrant validation or resolved ReferralCase | `POST /uw/decisions` |
| INV-2 | No bind without a human-dispositioned QUOTE decision (G4-approved `stpPath` rules excepted) | `POST /uw/bind` |
| INV-3 | Appetite / rules / grants are versioned, never mutated — publish creates `ref@version+1` | `POST /uw/appetite/statements`, `POST /uw/authority/grants` |
| INV-4 | Watchlist release requires two governance events from **distinct roles** (dual control) | `POST /uw/clearance/:checkId/release` |
| INV-5 | Every AgentAction has exactly one audited-by GovernanceEvent; agent writes are ProposalEnvelopes only | `recordAgentAction` helper, MCP wrapper |
| INV-6 | Divergence merge/retire requires impact-preview ack + CUO role; losers tombstoned | `POST /uw/rationalization/divergence/:id/action` |
| INV-7 | Cross-module refs (`priced-by` modelRef, `documented-by` formSetRef) must resolve before bind | `POST /uw/bind` |
| ADR-02 | Only a human principal disposes a proposal; envelopes never auto-apply | `POST /uw/agent-actions/:id/disposition` |

## REST endpoints

### Submission plane

| Endpoint | Behavior | Guards |
|---|---|---|
| `POST /uw/submissions` | Intake (any channel normalizes here) → clearance seeding → appetite evaluation → `SubmissionCreated`/`ExtractionCompleted`/`AppetiteEvaluated` events. Extracted fields carry `{field, value, confidence ∈ [0,1], provenance{docId, page?, bbox?, extractorVersion}}`; confidence < 0.70 quarantines to the exception lane (LLR-01) | 422 on shape; duplicate flagged as clearance HIT |
| `GET /uw/submissions?status=&sort=` | Pipeline queue with latest triage score, clearance state, open referrals. `sort ∈ triage\|sla\|appetite\|received` | 422 on bad sort key |
| `GET /uw/submissions/:id` | Risk-workspace projection — the full submission graph resolved in one read (LLR-07: projection, no duplicate storage) | 404 tenant-scoped |
| `POST /uw/submissions/bulk-decline` | `{submissionIds[], reason ≥ 10 chars}`; IN-appetite submissions are **skipped** (individual review required); each decline emits `DecisionRecorded` | 422; semantic skip list returned |
| `POST /uw/submissions/:id/proposals` | Agent proposal issuance → ProposalEnvelope + AgentAction + event | INV-5 |

### Signal plane

| Endpoint | Behavior | Guards |
|---|---|---|
| `POST /uw/submissions/:id/clearance` | Run `checks[] ⊆ {DUPLICATE, BLOCKED, WATCHLIST}`; watchlist match ≥ 0.85 → HIT; all-clear advances status | 422 |
| `POST /uw/clearance/:checkId/release` | Dual-control release: first call = first signature; second call must be a **distinct role and principal** | 403 INV-4 on same role/principal; 409 non-watchlist |
| `POST /uw/triage/rescore` | Appends a versioned `UwTriageScore` (per-lens: appetiteFit/winnability/expectedValue/effort + weightsVersion + rationale) — never overwrites (LLR-05) | 422 |
| `POST /uw/risk-objects/:id/enrich` | Jurisdiction-filtered fan-out over registered sources (NFR-06); TTL-respecting cache (LLR-06); returns `{fetched[], skipped[{source, reason}]}` | filter table authoritative |
| `GET /uw/enrichment-sources` | Source registry (kind, costClass, ttlHours, jurisdictions) | — |

### Decision plane

| Endpoint | Behavior | Guards |
|---|---|---|
| `GET /uw/appetite/statements` | Versioned statement inventory with owner org unit | — |
| `POST /uw/appetite/statements` | Publish v+1 (INV-3). NAICS `^\d{4,6}$` list, ISO dates with `effectiveTo > effectiveFrom`, rationale ≥ 20, capacity rejected on DECLINE. Overlapping different-stance statements emit DivergencePairs; publish re-evaluates open submissions | 403 backdated without CUO |
| `GET /uw/appetite/evaluate?submissionId=` | Pure evaluation `{verdict IN\|EDGE\|OUT\|NO_STATEMENT, citedStatements[]}` — always cites (HLR-05) | read-only |
| `GET /uw/authority/grants` | Grants inventory with Role-catalog binding | — |
| `POST /uw/authority/grants` | Issue/re-issue (version+1, prior retained). `roleId` must resolve in the Roles catalog (ADR-03); delegable requires bordereaux attached (CAP-13) | 422 |
| `POST /uw/decisions` | Pure-function authority validation (per-limit check rows returned); breach → outcome coerced to REFER + auto ReferralCase up the Roles-catalog chain; EDGE appetite requires resolved referral; unreleased watchlist blocks | 409 INV-1/INV-4 |
| `GET /uw/referrals` | Referral inventory with SLA state | — |
| `POST /uw/referrals/:id/resolve` | `{resolution ∈ approve\|decline\|return, rationale ≥ 20}`. Resolver must appear in the escalation chain; SLA clock stopped, breach recorded | 403 LLR-11 |

### Commercial plane

| Endpoint | Behavior | Guards |
|---|---|---|
| `POST /uw/quotes` | Assemble quote from a QUOTE decision. `modelRef ^M-[A-Z]{2}-\d{2}$` (priced-by → RATE-PRICING), `formSetRef ^FS-[A-Z-]+-\d{2}$` (documented-by → FORMS-RATION) | 409 INV-2 |
| `POST /uw/bind` | Idempotent on `correlationId` — replay returns the existing `pasPolicyRef` (LLR-12). Requires human-dispositioned passing decision (INV-1/2) and resolved cross-module refs (INV-7); target must be a registered PAS `Application` node | 409 with invariant |

### Governance plane

| Endpoint | Behavior | Guards |
|---|---|---|
| `GET /uw/events` | Keyset-paginated audit stream (window/correlation/type filters) — NFR-04 export path | compliance read |
| `GET /uw/agent-actions?disposition=` | Proposal inbox (assurance envelopes) | — |
| `POST /uw/agent-actions/:id/disposition` | Human `accept\|modify\|reject` (modify carries a patch) | 409 already dispositioned (ADR-02) |
| `GET /uw/rationalization/divergence?kind=` | DivergencePair inventory (`APPETITE\|RULE\|AUTHORITY`), weight = 1 − similarity | — |
| `GET /uw/rationalization/divergence/:id/impact` | Impact preview: affected submissions / roles / PAS bindings (persisted on the pair) | — |
| `POST /uw/rationalization/divergence/:id/action` | `{action ∈ merge\|retire\|keep-both, impactPreviewAck: true, note ≥ 10}`; loser tombstoned RETIRED, never deleted | 403 CUO (INV-6); 409 without preview |

## MCP tools (`POST /uw/mcp`, JSON-RPC 2.0: `initialize` / `tools/list` / `tools/call`)

| Tool | Mirrors | Notes |
|---|---|---|
| `uw_list_submissions` | GET /uw/submissions | read |
| `uw_get_submission` | GET /uw/submissions/:id | read |
| `uw_evaluate_appetite` | GET /uw/appetite/evaluate | read, always cites |
| `uw_list_appetite_statements` | GET /uw/appetite/statements | read |
| `uw_list_authority_grants` | GET /uw/authority/grants | read |
| `uw_list_referrals` | GET /uw/referrals | read |
| `uw_list_divergence_pairs` | GET /uw/rationalization/divergence | read |
| `uw_audit_trail` | GET /uw/events?correlationId= | read |
| `uw_propose_decision` | POST /uw/submissions/:id/proposals | **write-as-proposal only** — returns the AgentAction id; a human disposes it (ADR-02) |

Every call (reads included) is recorded as an `MCP_TOOL` AgentAction with one GovernanceEvent —
the agent plane has no unaudited path to the system (INV-5).

## Event types (the 13 + control)

`SubmissionCreated · ExtractionCompleted · ClearanceCompleted · AppetiteEvaluated · TriageScored ·
EnrichmentRecorded · ProposalIssued · DecisionRecorded · ReferralOpened · ReferralResolved ·
QuoteProposed · BindExecuted · DivergenceDetected · RationalizationActioned (+ AgentControl)`

`correlationId` (= submission id for the intake-to-bind thread) stitches the narrative across
modules; `GET /uw/events?correlationId=<id>` replays a full submission lifecycle.
