# Hardcoded Data Audit (Charter Task 1)

Audited 2026-07-02 on the `refactor` branch. Question: can a new company be onboarded
through data/configuration alone, with no code changes?

## Verdict

**The runtime app is database-driven.** Level names come from
`OrgLevelType`/`ProcessLevelType.displayValue`, dashboard layout from
`Company.dashboardConfig`, risk bands from `RiskScoringBand`, AI adoption from
`NodeAiAdoption`, terminology overrides from `Terminology`, and every route scopes by
`companyId`/`tenantId` — no route assumes a specific company. Frontend components render
API-fetched display values; a grep for hardcoded "Division"/"Value Stream" strings in UI
components found none.

What remains is **seed-time** configuration plus two cosmetic strings — fixed in this
refactor (see below).

## Classification summary

| Class | Meaning | Examples | Action |
| --- | --- | --- | --- |
| A — app chrome | Generic UI config, legitimately code | admin tab layout (`adminConfig.ts`), score palettes (`aiAdoption.ts`), CAPDAN layer schema, stage enums (`format.ts`) | none |
| B — DB-configurable already | Has a live DB override path | level labels (Data Admin), widget layout/titles, risk bands, AI adoption, telemetry catalog | none |
| C — tenant data hardcoded | Would be wrong for company #2 | items below | fixed / documented |

## Class-C items and their resolution

| Item | Where | Resolution |
| --- | --- | --- |
| Company slug `abc-insurance` | `seed/seed.ts`, `seed/seedMaster.ts` | Parameterized via `SEED_COMPANY_SLUG` env (default keeps demo behavior) |
| L3 org label `Department` | `seed/seedOrgFromDevelop.ts` | Parameterized via `SEED_L3_LABEL` env (default `Department`) |
| "Capgemini Transformation Bridge" in AI system prompts | `routes/adminAi.ts`, `routes/chat.ts` | Branding now env-configurable via `PLATFORM_NAME` (default keeps current text); the admin copilot already interpolates the active company's name from the DB |
| `higherCategory ?? 'Core Business'` fallback | `frontend/src/pages/Explorer.tsx` | Fallback only renders when the DB value is null (never in practice — L1 nodes carry displayValue); left as a safe default, documented here |
| Insurance-specific structure in `backend/data/seed/master_v5.json` + `org-from-develop.json` | seed data files | **Correct as-is** — this is the demo company's *data*, not code. Company #2 gets its own master workbook/JSON; the seed pipeline is structure-agnostic (levels, nodes, junctions all generic). |
| Skill-pack KEEP list (`skillPacks.ts`) | backend lib | Universal regulatory packs (GDPR/CCPA/SOX/ACORD/NYDFS), not tenant data — stays |

## Onboarding a second company (data-only path)

1. Produce a `master_<company>.json` in the same shape as `master_v5.json`
   (level types, process nodes, org units, roles, junctions).
2. `SEED_COMPANY_SLUG=<slug> npm run db:seed:master -w cascade-backend` against the
   tenant's DB branch.
3. Adjust level labels / terminology / dashboard in Data Admin (all DB-backed).

No code changes required.
