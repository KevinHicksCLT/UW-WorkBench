# Contributing to UW Workbench

Thanks for helping build the open underwriting commons. Two kinds of contribution matter here,
and they have different bars.

## 1. Content packs (the fast lane)

Packs are the crowdsourced commodity — appetite statements, guideline rules, authority grant
templates, and enrichment source registries for a line of business, territory, or operating
model.

**To contribute a pack:**

1. Build your estate in the app (or by hand), then `POST /uw/packs/export` (or use the Packs
   tab → Export).
2. Drop the JSON under `packs/<category>/<your-pack-slug>.json`.
3. Validate: it must pass [`packs/pack.schema.json`](packs/pack.schema.json) — CI enforces this.
4. Open a PR describing the book it's for and the judgment encoded (why these stances, why
   these ceilings).

**Pack rules:**

- `packFormat: 1`, semver `version`, unique `slug`, Apache-2.0 (or compatible) `license`.
- **No real-company data.** Statements and rules must be generic underwriting judgment, not a
  copy of any carrier's confidential guidelines. You must have the right to share what you
  submit.
- Authority templates reference roles by **label** — never user identities.
- Rationale fields are required for a reason: a stance without a why is not shareable judgment.

## 2. Code

- Node ≥ 20, npm workspaces. `npm install` at the root, `docker compose up -d` for Postgres.
- **Gates:** `npm run typecheck` and `npm test` must pass. TypeScript is strict everywhere;
  no `any`, no `@ts-ignore`. Keep files under ~500 lines.
- **Invariants are not negotiable.** INV-1..7 and the proposal-only agent contract (ADR-02)
  are the project's identity. A PR that lets an agent transition state directly, adds an
  update path to the governance spine, or lets a bind skip the human-dispositioned decision
  will be declined regardless of how useful the feature is. New capabilities must arrive
  *inside* the governance model.
- **Schema changes** go through `prisma migrate dev` (never `db push`) and ship with the
  migration in the same PR.
- Semantic gates return `403`/`409` with the violated invariant named; syntax gates are zod →
  `422 validation_failed`. Keep that contract.

### Where help is most wanted

See [`docs/ROADMAP.md`](docs/ROADMAP.md). Headlines: document-extraction adapters (the
LLR-01 confidence + provenance contract is fixed; plug your extractor behind it), sanctions
screening providers, PAS bind connectors, the webhook dispatcher, renewal workflows, and
portfolio steering analytics.

## Conduct

Be excellent to each other. Underwriting judgment invites strong opinions — argue about
stances and thresholds with rationale, not heat. Maintainers may summarize and close
unproductive threads.

## Provenance

By contributing you certify the Developer Certificate of Origin (DCO) — you wrote the
contribution or otherwise have the right to submit it under Apache-2.0.
