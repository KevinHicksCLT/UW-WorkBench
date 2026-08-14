# AAA rollout runbook — apply the pilot treatment to a value stream

The reviewed treatment (PR #93): every L5 task regroups into thematic,
single-actor L6 tasks; verification detail folds into each action's
Definition of Done ("Done when in <App> <pass condition>"); one Owner per
node; text-referenced app links; per-L4 dependsOn edges. The map and
inspector need no changes — they render any treated L4.

All commands run from `backend/` with the pilot-era `.env`.

## Step 1 — rollout (needs ANTHROPIC_API_KEY with credit)

```bash
npx tsx --env-file=.env scripts/aaa-tech-rollout.ts <l2Id>
```

One Sonnet call per L5 (grouping + doer realism), 8-way concurrency,
resumable (`attributes.l6Regrouped` marks done mains — reruns skip them and
go straight to missing dependency passes). Watch the log for
`fallback groupings` (deterministic per-actor split after a failed AI
partition — structurally valid, less thematic) and `deps FAILED` lines.

## Step 2 — strays finisher (no API)

```bash
npx tsx --env-file=.env scripts/aaa-tech-strays.ts <l2Id>
```

Rehomes actions whose text starts with the verb "Verify" (the parser holds
them back as verification pairs). Always run after step 1. Expect
`remaining Verify-keyed rows on L5s: 0`.

## Step 3 — dependency passes without API credit (Max-plan mode)

If step 1 logged `deps FAILED` (e.g. credit exhaustion), the session model
authors the edges itself:

1. `npx tsx --env-file=.env scripts/aaa-deps-dump.ts <l2Id> [...]` — writes
   `scripts/deps-input.json` and prints an index-stable task list per L4.
2. The Claude session reads the printout and writes `scripts/deps-out-*.json`
   keyed by L4 index: `{"<l4Idx>":[{"t":<taskIdx>,"d":[<depIdx>,...]},...]}`
   — load-bearing input edges only, max 3 per task, no cycles.
3. `npx tsx --env-file=.env scripts/aaa-deps-apply.ts deps-out-1.json ...` —
   validates bounds/self-refs/cycles and writes `attributes.dependsOn`.

## Verify (no API)

Owner purity, leftover verify rows, deps coverage — the sweep used for every
stream so far (inline in session; assert): every L5+L6 node has exactly one
Owner link; `kind='TEST'` rows with `'. Verify'` keys count 0 in scope; L5
dependsOn coverage roughly (tasks - roots - single-child L4s).

## L2 ids (Technology domain — all DONE 2026-08-04)

- `bb67119f-5481-4e4b-9314-0a46acae47e6` Technology & Engineering
- `17cb3453-4288-4970-bfd0-925a71ee174a` Data & AI
- `a4afae36-3189-4957-8eee-f435c3fa6fe2` Cybersecurity & IAM

Known wart: groupings that fell back deterministically carry names like
"<task> — <actor>". Re-theme by clearing `attributes.l6Regrouped` on those
mains and re-running step 1 (their L6s must be dissolved back first — or ask
the session to re-theme names in place).
