# Workspace Renovation — Plan & Item Disposition

Branch `workspace-renovation` · from Kevin's 15-item request (2026-07-06) against the Application Rationalization board (`frontend/src/pages/greenfield-migration/`, `backend/src/routes/rationalization.ts`, `Rationalization*` models).

## Item map (WR-## = Kevin's #1–15)

| WR | Ask (condensed) | Phase | Status |
|----|-----------------|-------|--------|
| WR-01 | Three explicit inspection modes — multiple **Applications** OR **Value streams** OR **Roles** | R1 | **SHIPPED 2026-07-06** (tri-mode multi-select lens; server-side role→stream resolution; workspace applicationId FK) |
| WR-02 | Remove status verbiage; generic "+ New…" label; Edit board moved onto the selector row | R0 | **SHIPPED** |
| WR-03 | Structured label/row/column alignment — options to review first | R0 | **SHIPPED — Option C chosen (Kevin, 2026-07-06)**: contained-column panels, in-band headers, shared baseline slot grid |
| WR-04 | "Green-field" → "Greenfield" | R0 | **SHIPPED** |
| WR-05 | Tan/lavender/green boxes larger; content uncramped | R0 | **SHIPPED** (widths 250/240/260→290/285/300, row height 155→180, padding up) |
| WR-06 | Robust layer boxes: screen links per L4; Components vs Behavior views; "should NOT be here" categories per layer | R1 | **SHIPPED 2026-07-06** (anatomy fields + 57-row catalog + ScreenAsset; Components\|Behavior toggle; screen links) |
| WR-07 | Transformation Bridge as a self-anatomy example; chatbot answers ("all business validations for screen/L4 X"); semantic diff between two legacy apps | R2 | **Self-anatomy board SHIPPED** (79 findings, 13 misplaced, 30 screens — in-session analysis, no API key); chatbot suggestions + semantic diff remain R2 |
| WR-08 | Chatbot edits the board on a human's instruction (audit shows the human); approval-held changes visible as *proposed* on the board | R3 | Planned |
| WR-09 | "CAPDAN — Normalize" → "Normalize" | R0 | **SHIPPED** |
| WR-10 | Sub-section expansion IN the box (+/−), plain-language for non-technical readers (replace sparse technical drawer) | R1 | **SHIPPED 2026-07-06** (in-box expansion with variable slot heights preserving Option C alignment; cell drawer removed) |
| WR-11 | Context-aware chatbot (who I am, role, value streams, deliverables/tasks, current screen; Jira/Rally + HR later) | R2 | Planned |
| WR-12 | Semantic search, not keyword-only | R2 | Planned |
| WR-13 | Green items map to same layer in Normalize; red to AI-recommended layer; multi-app normalize with duplicate detection + "clean up duplicates" | R2 | Planned |
| WR-14 | Drop Building/Planned labels; show which Normalize capabilities exist in the greenfield vs where they'll be added; Normalize→Greenfield 1:N | R3 | Planned |
| WR-15 | E2E view includes shared applications/services (e.g. MDM/RDM call replacing local reference data) | R1 | Planned |

## Phase R0 — shipped on this branch (2026-07-06)

WR-02/04/05/09 live and verified: headers read **Normalize** and **Greenfield** everywhere (board, drawers, edit modals); the status/verbiage bar is gone (edit-mode instructions appear only while editing); **Edit board** and **+ New…** sit on the selector row; boxes are ~16% wider with taller rows and roomier padding. WR-03: three structural treatments delivered as a review artifact — decision pending.

## Phase R1 — board structure & the anatomy model

**Goal:** the board becomes a legible anatomy instrument rather than a diagram.

- **WR-01 — tri-mode lens.** Replace the Application/L3/L4 cascade with a mode switch (`Applications | Value streams | Roles`) + multi-select combobox. Mode drives the board: applications mode = one legacy column per selected app (board already supports 2; generalize `appX[]`); value-stream / role modes pivot the same findings by `valueStreamNodeId` / owner-role joins. Needs `RationalizationWorkspace.application` promoted from free text to an FK (`applicationId → Application`) — the db-data-model rule this string always violated.
- ~~WR-03~~ — **done in R0** (Option C). Note for WR-01: the panel model was chosen partly because multi-app selection simply adds panels (`panelX(i)` already generalizes past two apps).
- **WR-06 + WR-10 — anatomy catalog inside the boxes.** Seed Kevin's layer taxonomy as reference data (`AnatomyCategory`: layer × view × name × plain-language description × belongs-here flag — the Components list, the Behavior list, and the per-layer "misplaced" lists incl. the Modern-vs-Legacy summary table). Extend `RationalizationCapability` with `view` (COMPONENT|BEHAVIOR), `screenRef` (screen/modal tag), `plainSummary` (non-technical sentence), `recommendedLayer` (AI-suggested correct layer for misplaced items). Boxes get: Components/Behavior toggle, expand/collapse (+/−) rows *inside* the box (React Flow nodes re-measure on size change — the drawer stays only for deep detail), screen links (per-L4 `ScreenAsset` rows: name, kind screen|modal, url/image).
- **WR-15 — shared services lane.** `RationalizationApp.kind` gains `SHARED_SERVICE`; shared boxes (MDM/RDM, auth, document services) render in a separate lane and can be targets of relocate edges, so the E2E L4 picture includes calls that replace local hard-coding.

## Phase R2 — semantics (self-anatomy, search, chat context)

- **WR-07 — TB self-anatomy.** An agent-driven analysis of this repo produces a seeded "Transformation Bridge" workspace: every finding tagged with layer, view, category, `screenRef` (the page/modal per `MENU_TREE`), `codeRef`, and plain summary; misplaced items flagged with `recommendedLayer` (the earlier ontology/SHACL work already found candidates, e.g. enum lists hard-coded in schema comments = "reference data in code"). Chatbot gains rationalization SQL suggestions so "list all business validations for the Roles screen" answers from `RationalizationCapability`.
- **WR-12 — semantic search.** pgvector embeddings (Neon supports it) over names+descriptions of the graph (nodes, roles, deliverables, findings, standards); `/search` blends keyword + vector results. The same embeddings power **WR-13** duplicate detection (cosine-near findings mapped into one Normalize box from different legacy apps) and the WR-07 **semantic diff** (same L4 process implemented in two apps: common / different / one-sided, by validation and by field).
- **WR-13 — normalize mapping rules.** Deterministic part: green (Common/Different) findings map to the same layer's Normalize box; red Relocate items map to their `recommendedLayer` per Kevin's layer table (business logic→domain, reference data→config/API, integration→service, security→auth, UI keeps presentation only). "Clean up duplicates" action = embedding-driven cluster review (accept merge / keep as justified variation) — variation as exception, not preference.
- **WR-11 — context-aware chat.** Extend `/chat` context: authenticated user (name, user type, operating role, value streams, manager), their deliverables/tasks (role joins), pending approvals, current screen (already sent), selected board state. Jira/Rally + HR feeds phase later; everything else is already in TB.

## Phase R3 — assisted editing & greenfield coverage

- **WR-08 — chatbot board editing.** A `propose_board_change` chat tool that calls the SAME endpoints (`PATCH /rationalization/*`, `POST /:id/layout`) as the UI, actor = the logged-in human (chat is a channel, not an author — same principle as the approval framework's channels). Where a policy governs the change, the 202-held response renders on the board as a **proposed** state (ghost/dashed styling from the pending `ApprovalRequest` payload) until approved. Depends on PR #44 landing in develop.
- **WR-14 — greenfield coverage.** Remove the BUILDING/PLANNED box labels; introduce `NormalizeTarget` junction (component/capability → microservice, 1:N) with per-link status `EXISTS | PLANNED(target)` so each Normalize capability shows where it lives or will live in the greenfield ecosystem; box-level status derives from its links instead of a hand-set label.

## Sequencing & dependencies

R1 is pure TB work (one migration: anatomy fields + catalog + ScreenAsset + app FK). R2 needs pgvector enablement + an embedding pipeline (one-off + on-write). R3's WR-08 needs the approval framework (PR #44) merged. Recommended order: R1 → R2 → R3, with WR-07's TB self-analysis started during R1 (its output validates the R1 schema).
