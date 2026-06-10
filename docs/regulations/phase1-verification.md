# Regulations Module — Phase 1 Verification Checklist

Run date: 2026-06-10 · Branch: `regulations` (git) / `br-mute-thunder-aqhp6vv4` "regulations" (Neon, forked from production `br-curly-poetry`) · Verifier: coding agent (design doc §8, step 1.9)

## Row counts (design §4.9)

| Check | Expected | Actual | ✓ |
|---|---|---|---|
| Jurisdictions | 51 | 51 | ✓ |
| FULL_PROFILE states | 12 (GA FL TX NY MA CA NC WI MI CT MD CO) | 12 | ✓ |
| PRIORITY tier | 5 (FL TX NY CA NC) | 5 | ✓ |
| DOCUMENT-origin rule-set states | 11 per design — **10 in reality** | 10 (CA CT FL GA MA MD MI NY TX WI) | ✓* |
| Integration systems | ~15 | 14 | ✓ |
| Requirements | — | 306 (282 BASELINE / 24 DERIVED) | ✓ |
| Requirement → value-stream links | — | 477 (all `auto-suggested at seed`) | ✓ |
| Jurisdiction–system links | — | 377 | ✓ |
| Compliance rules | — | 286 | ✓ |
| Sources | — | 108 (105 state + 3 national) | ✓ |
| Bulletins | ~dozen named in doc | 7 (AL 2026-01/2025-04/2025-06, AK B26-03, KY 2025-1, MS 2022-5, OR 2024-5) | ✓ |

\* **Deviation from design doc:** the design expected 11 document rules YAMLs (NC included). In the source document the `NCcompliancerules.yaml` **and** `CO_compliance_rules.yaml` headings both have empty bodies, so NC and CO are TEMPLATE_DERIVED (flagged in `regulations-baseline.json` → `meta.knownGaps`). WI's rules body lost every underscore in the docx→md conversion; tokens were restored against a vocabulary built from the clean YAML bodies + master template and spot-checked (rule ids, enum values, if/then structure all correct).

## Spot checks (design §4.9)

| Assertion | Result |
|---|---|
| FL `filingPortal = PROPRIETARY` (detail "Proprietary (IRFS)") | ✓ |
| CA / NY / FL / TX `compactStatus = NON_MEMBER` | ✓ |
| ND / OH / WA / WY `workersCompModel = MONOPOLISTIC_FUND` | ✓ |
| GA rule `GA-FILING-001` present, origin DOCUMENT | ✓ |

## Field-by-field cross-check vs source doc (5 states: FL, TX, NY, CA + MN random)

All six taxonomy flags, regulator name, website, statutory citation, priority tier, and profile depth checked against the doc's Cross-State Taxonomy Table and per-state narrative:

| State | Taxonomy (6 flags) | Regulator | Website | Citation |
|---|---|---|---|---|
| FL | ✓ Proprietary/Non-member/Yes/EDI/No/No | Florida Office of Insurance Regulation (OIR) ✓ | floir.gov ✓ | Florida Insurance Code ✓ |
| TX | ✓ SERFF/Non-member/Yes/EDI/No/Partial | Texas Department of Insurance (TDI) ✓ | tdi.texas.gov ✓ | Texas Insurance Code ✓ (fixed: heuristic initially picked "Insurance statutes") |
| NY | ✓ SERFF/Non-member/No/EDI/No/No | NY Department of Financial Services (DFS) ✓ | dfs.ny.gov ✓ (fixed: URL initially kept a pandoc `\_` escape) | NY Consolidated Laws, Insurance (ISC) ✓ |
| CA | ✓ SERFF/Non-member/No/EDI/No/No | California Department of Insurance (CDI) ✓ | insurance.ca.gov ✓ | Title 10, Ch. 5 CCR ✓ (the doc bolds the CCR cite; the Insurance Code mention is italic) |
| MN | ✓ SERFF/Member/"Random verification, not continuous"→PARTIAL+detail/EDI/Yes/Yes | MN Dept of Commerce (Insurance Division) ✓ | mn.gov/commerce ✓ | Minnesota Statutes Chapters 59A–79A ✓ |

Two defects found during this pass were fixed in the extractor and the data force-reseeded: pandoc `\_` escapes leaking into narrative-extracted URLs, and the statutory-citation heuristic taking the doc's generic shorthand instead of the full citation.

## API & UI verification

- `curl` with demo token: `/regulations/overview`, `/jurisdictions` (+filters), `/jurisdictions/FL` (by code), `/requirements` (+state/category/VS filters), `/integrations`, `/bulletins` — all correct; unauthorized → 401; bad id → 404.
- Writes: `PATCH /requirements/:id` and `PUT /requirements/:id/value-streams` round-trip with `AuditEntry` rows (UPDATE field diff + SET_VALUE_STREAMS payload); cross-company/bad ids → 404.
- Browser (Playwright, zero console errors): States lens filters + badges; FL detail (header flags, executive summary markdown, IRFS REQUIRED / SERFF NOT_USED matrix, rules JSON viewer, sources); Requirements lens + link-editor save round-trip persisted to DB; Coverage lens grouping; Data Admin → Regulations group (8 entities, jurisdiction master-detail with 5 child panels, `code` field surfaced).
- Seeder idempotent: second run no-ops without `SEED_FORCE=1`.

## Known limitations (Phase 1, by design)

- Every row is `confidence: BASELINE` from a point-in-time document (early 2026); nothing is yet pipeline-verified. The Phase 2 pipeline + quarterly RECHECK is the corrective.
- Requirements/integrations are deterministically derived from the doc's taxonomy + narratives (not LLM-extracted prose), so they capture the per-state pattern (filing channel, compact, auto-verify, WC EDI, APCD, premium tax) rather than every narrative nuance; `summaryStatutes`/`summaryIntegration` carry the full narrative on each state page.
- Value-stream links are category heuristics, annotated `auto-suggested at seed`, awaiting human curation in the UI.
- Bulletin metadata (issuedDate) is not populated — the doc names references without reliable dates.
