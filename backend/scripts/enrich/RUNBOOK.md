# Domain gold-standard enrichment runbook

How to bring **every task in a domain** to the **Software Engineering & Delivery (SWE&D) gold standard**, first try. This is the exact pipeline used for the whole **Technology** domain (2,288 tasks, PR #77); follow it verbatim for **Core Business** (~4,945 tasks) or any domain.

Two surfaces get filled — do **both**:

1. **Junction enrichment** (`NodeRole` / `NodeAppUsage` / `NodeStandard` / `NodeRegulation` / `NodeChecklist` / `TestingTemplate`) — powers the Inspector Roles/Apps/Checklist/Testing/Governance tabs.
2. **Work Library plans** (`NodeTemplateAnswer`) — powers the **Work tab** (`PlanBlock`): the "Generic steps · pattern" keys + task-specific steps. **This is the surface the user cares most about.**

Then a **cleanup** removes empty non-default templates.

Everything derives from these junctions → one write updates every tab. Never denormalize; reuse catalog IDs (see the `db-data-model` skill).

---

## 0. Facts for Core Business

- Domain L1 node: `displayValue = 'Core Business'` (id `540fdf27-7c07-4d72-ae95-de26e9e05276`).
- 8 value streams (L2) → their L3 areas are the **unit of work** (one authoring agent per area):

| Value stream                    | ~tasks |
| ------------------------------- | ------ |
| Actuarial                       | 643    |
| Business Operations             | 674    |
| Call Center                     | 176    |
| Claims                          | 837    |
| Product & Delivery              | 308    |
| Reinsurance                     | 862    |
| Sales, Distribution & Marketing | 850    |
| Underwriting                    | 595    |

Get the exact L3 area names + counts with the query in **§7**. There are ~40–45 areas total.

- **Relevant standard departments** (pass to `--std-depts`): `Actuarial, Claims Operations, Underwriting, Finance & Accounting, Operations & Customer Service, Data & Analytics, Compliance & Risk Management, Legal & Governance`.
- **Role/app palette** comes automatically from roles/apps that already touch Core Business tasks (real day-to-day: Actuary, Claims Adjuster, Underwriter, CSR, Reinsurance Analyst, …). The authoring agent drops cross-domain noise per task.

---

## 1. Session setup (before any edit) — see the `session-flow` skill

You are told to stay on the current git branch or cut `feature/core-business-enrichment`. Either way you need a **feature Neon branch forked from `develop`** and `backend/.env` repointed at it (pooled → `DATABASE_URL`, direct → `DIRECT_URL`). Steps:

```bash
cd backend
npx -y neonctl@2 branches create --name <branch> --parent develop \
  --project-id billowing-salad-46113160 --org-id org-misty-bar-64403461
npx -y neonctl@2 connection-string <branch> --project-id billowing-salad-46113160 \
  --org-id org-misty-bar-64403461 --database-name neondb --role-name neondb_owner --pooled   # → DATABASE_URL
npx -y neonctl@2 connection-string <branch> --project-id billowing-salad-46113160 \
  --org-id org-misty-bar-64403461 --database-name neondb --role-name neondb_owner            # → DIRECT_URL
```

Comment out the old `DATABASE_URL`/`DIRECT_URL`, add the new ones. Restart `npm run dev:backend` if verifying in-app.

---

## 2. Dump the catalog + per-area task lists

The catalog (controlled vocabulary) is domain-wide and regenerated on every run (last wins — fine). Loop over **every** L3 area:

```bash
cd backend
for AREA in "Pricing & Rate Development" "Loss Reserving" ... ; do
  npx tsx --env-file=.env scripts/enrich/dump-catalog.ts "$AREA" \
    --domain "Core Business" \
    --std-depts "Actuarial,Claims Operations,Underwriting,Finance & Accounting,Operations & Customer Service,Data & Analytics,Compliance & Risk Management,Legal & Governance"
done
```

Writes `scripts/output/enrich-catalog.json` (roles/apps/standards/regs + companyId) and one `scripts/output/enrich-tasks-<slug>.json` per area. **Note the slug** printed per area — every later file uses it. (These two file types are gitignored — regenerable.)

> The loop can time out at ~2 min; just re-run for the remaining areas. Order doesn't matter.

---

## 3. PHASE A — author junction enrichment (roles/apps/standards/regs + checklist + testing)

**One agent per area.** Spawn in waves of ≤8. Give each agent this prompt (fill `<AREA>`, `<SLUG>`, `<N>`, and a one-line domain flavor). **CRITICAL rules are in the prompt — keep them all.**

```
Author GOLD-STANDARD task enrichment DATA (JSON), grounded in real day-to-day <domain flavor, e.g. actuarial pricing> practice. Output is DATA, not prose.
IMPORTANT: author ALL tasks YOURSELF in this one agent — do NOT use the Agent tool, do NOT spawn subagents, do NOT split into batch/part files. The ONLY output file is the one named below.

READ (repo root <abs path>\backend):
1. scripts/output/enrich-catalog.json — roles[{id,displayValue,orgUnit}], apps[{id,name,kind}], standards[{id,name,department,category}], regs[{id,title,category}], companyId.
2. scripts/output/enrich-tasks-<SLUG>.json — {area, tasks[{id,subProcess,task,description,currentRoles,currentApps,deliverable}]}.

SCOPE: ALL <N> tasks. Every task, no skips.

For EACH task author one object. GOAL: lean, realistic, click-button detail. Current roles/apps are BLOATED/WRONG — REPLACE with correct lean sets.
- roles: EXACTLY 1 Owner + 1-2 Participants, ids from catalog.roles ONLY. Owner = the role that genuinely performs THIS task. Realistic for this domain: <list 6-10 real roles>. NO cross-domain (no unrelated Legal/HR/IT/Actuarial unless the task truly is that).
- apps: 1-3 real tools this task uses, ids from catalog.apps ONLY. Prefer <list the real systems for this VS>. NEVER unrelated apps.
- standards: 1-4 ids from catalog.standards relevant to the task; prefer department <the VS's dept(s)>. Verify each id exists.
- regs: 0-2 ids from catalog.regs ONLY if the task genuinely triggers a legal obligation. Most tasks = []. Don't force.
- checklistGeneric: 2-3 short reusable control items.
- checklistSpecific: 3-5 TASK-SPECIFIC concrete verifiable click-items unique to THIS task. The gold detail.
- testing: 1-2 items {system,location,checkType:"presence"|"absence",expected} tailored to the task.

OUTPUT: raw JSON array (no wrapper) to scripts/output/enrichment-part-<SLUG>.json. Element:
{"taskId":"<id>","roles":[{"roleId":"<id>","rel":"Owner"},{"roleId":"<id>","rel":"Participant"}],"apps":[{"appId":"<id>","use":"performed"}],"standards":["<id>"],"regs":[{"regId":"<id>","rel":"GOVERNS"}],"checklistGeneric":["..."],"checklistSpecific":["..."],"testing":[{"system":null,"location":null,"checkType":"presence","expected":"..."}]}

Every id MUST exist in the catalog — verify each id against the catalog file. Cover ALL <N> tasks. After writing, re-read the file: confirm valid JSON and exactly <N> objects; append any missing. Return a short summary (counts + notes) only.
```

**Then load** (merge + coverage-check + idempotent load, per area). Run in the background — it's slow (sequential per-task writes; a whole VS ≈ 10–15 min):

```bash
npx tsx --env-file=.env scripts/enrich/build-and-load.ts <slug1> <slug2> ...   # add --dry-run first
```

`build-and-load` reports `authored N/N` and `created/removed/skipped`. **`skipped` must be 0** (every id valid). Roles/apps are reconciled to the authored set (bloat removed); standards/regs/checklist/testing are additive.

Verify Phase A depth per VS with the query in **§7a**: expect ~2–3 roles, ~2–3 apps, ≥2 standards, ~12 checklist, ~2 testing per task, **0 tasks without an owner or standard**.

Commit the `enrichment-part-*.json` + merged `enrichment-*.json` as replay artifacts. Push → draft PR into `develop`.

---

## 4. PHASE B — author Work Library plans (the Work tab)

### 4a. Build the authoring seed per area

Joins each task's name/description with the Phase-A owner/apps/specific-checklist (resolved to names):

```bash
for SLUG in <all slugs> ; do npx tsx --env-file=.env scripts/enrich/dump-workplan-seed.ts "$SLUG"; done
```

Writes `scripts/output/wp-seed-<slug>.json`.

### 4b. Author — one agent per area, STRICT no-fanout

The plan has two parts per task: **11 generic TEXT answers** + **6–12 paired custom steps**. The ROLE keys (Data owner / Approver / Named process owner) and the APPLICATION key (Named SOR) are filled automatically from the task's Owner + primary app — **do NOT author those**. Prompt:

```
Author GOLD-STANDARD Work Library PLAN data (JSON). Output is DATA, not prose.
IMPORTANT: author ALL tasks YOURSELF in this one agent — do NOT use the Agent tool, do NOT spawn subagents, do NOT split into batch/part files. The ONLY output file is the one named below.

READ: <abs path>\backend\scripts\output\wp-seed-<SLUG>.json — {area, tasks[{id,subProcess,name,description,owner,participants[],apps[],specificChecklist[],testing[]}]}. <N> tasks.

For EACH task author one plan object:
(A) generic — EXACTLY these 11 keys, each a concrete task-specific sentence ≤130 chars, NO semicolons:
CHECKLIST: "Defined scope/population","In-scope period","Required fields populated and valid","Control totals or record counts reconcile","Evidence retained with timestamp/version","Exceptions logged with disposition"
TEST: "Test population","Pass/fail thresholds","Exception handling path","Documented acceptance criteria","Evidence location"
(Do NOT author Data owner / Named SOR / Approver / Named process owner — auto-filled.)
(B) steps — 6-12 atomic actions to DO the task. Each: title (imperative, names the action AND its system/app), actor (MUST be the task owner or a participant from the seed), sop (3-6 lines, LAST starts "Done when "), verify (2-4 lines, LAST starts "Pass when "). Lines ≤130 chars, no semicolons. Derive from description + specificChecklist + testing; ground in the task's real apps.
verifier: the test-side approver — the owner, unless a participant is the natural approver (a Lead/Manager/Reviewer); never invent a role not on the task.

SHAPE: {"taskId":"<id>","verifier":"<role on task>","generic":{…all 11 EXACT key strings…},"steps":[{"n":1,"title":"…","actor":"<role on task>","sop":["…","Done when …"],"verify":["…","Pass when …"]}]}

OUTPUT: write {"area":"<AREA>","tasks":[…<N>…]} to <abs path>\backend\scripts\output\workplan-<SLUG>.json. Re-read it: valid JSON, exactly <N> objects, each with the 11 EXACT generic key strings + >=6 steps, every actor/verifier a role on that task. Return a short summary only.
```

> The generic key strings must be **verbatim** (the loader matches by exact text). If an author emits camelCase/short keys, fix before loading:
>
> ```bash
> node scripts/enrich/remap-generic-keys.mjs scripts/output/workplan-<slug>.json   # positional → canonical
> ```

### 4c. Load

```bash
for SLUG in <all slugs> ; do npx tsx --env-file=.env scripts/enrich/load-workplan.ts scripts/output/workplan-$SLUG.json; done   # background; slow
```

`load-workplan` reports `genKeys customIns customDel links+ skipped`. **`skipped` must be ~0.** A large `skipped` with low `genKeys` (≈4×tasks) means the generic keys weren't canonical → run the remap (§4b) and re-load. Verify with **§7b**: expect **15 generic defined + ~6–14 custom steps per task, `zero_text = 0`.**

Commit `workplan-*.json`. Push.

---

## 5. Cleanup — remove empty non-default templates

Drops the all-blank "Enter value / Select or add…" template blocks (Methodology/model validation, Implementation/change evidence, …) that have no values, keeping the two defaults and any non-default that DOES have values:

```bash
npx tsx --env-file=.env scripts/enrich/remove-empty-templates.ts --domain "Core Business"            # dry-run
npx tsx --env-file=.env scripts/enrich/remove-empty-templates.ts --domain "Core Business" --apply     # backed up
```

---

## 6. Pitfalls (all learned the hard way — avoid them)

1. **Fan-out.** Large-area agents love to spawn their own subagents and write colliding `wp-batch-*/wp-part-*` fragments that never merge. The **no-fanout** line in the prompt prevents it. If it happens anyway, salvage: `node scripts/enrich/merge-batches.mjs <slug> "<Area>" <dir-of-fragments> <prefix>`.
2. **camelCase generic keys.** Authors drift to `testPopulation` etc. The loader matches by exact key text → mass `skipped`. Fix with `remap-generic-keys.mjs` (positional remap) BEFORE loading.
3. **Loader is slow.** Sequential per-task writes. Always run loads in the **background**, per-VS, and expect 10–15 min each. Don't foreground-block.
4. **`dump-catalog` uses the FIRST positional arg as the area** and `--domain`/`--std-depts` as flags. Quote area names (they contain `&`, `/`, spaces).
5. **Chain API is deliverable-scoped** — `/inspector/:id/chain` only returns a task if it hangs off a deliverable. Verify with the **SQL in §7**, not the chain endpoint.
6. **Role reconcile deletes** existing `NodeRole` not in the authored set (desired-state). Correct for auto-generated bloat; if a domain has human-validated `NodeRole.validationStatus='CONFIRMED'`, preserve those first.
7. **Agents drop generator scripts** into `backend/scripts/` (`gen-*.mjs`, `build-*.js`). Sweep before commit: `git status --porcelain backend/scripts/ | grep -iE '\\.(mjs|cjs|py|js)$'` and delete the strays (keep only `scripts/enrich/*`).
8. **Every commit runs husky** (prettier + eslint + typecheck). Never `--no-verify`. `scripts/**` is lint-exempt but typecheck still covers `.ts`.
9. **Link arrays come back in the wrong shape.** Authors emit `regs` (sometimes `apps`) as bare id strings instead of `{regId, rel}` / `{appId, use}`. `load-enrichment` reads `.regId` off a string, gets `undefined`, and SKIPs the row — the load looks clean while quietly dropping links. Always run `node scripts/enrich/normalize-part.mjs <slug> <vs-catalog-slug>` before `build-and-load`, and treat any `SKIP reg undefined` in a dry-run as this bug, not as bad data.
10. **A killed agent has often already written its file.** An agent that dies to a session/spend limit during its self-validation step still leaves a complete, valid part file. Check `tasks.length` against the seed before re-running it — two Corporate Functions areas were fully authored despite reporting failure.
11. **Same-named L3 areas across value streams.** Corporate Functions has "Operational Resilience" under both Corporate Operations and Risk, Compliance & Audit. `dump-domain.ts` disambiguates the second one's slug with the value stream; do not assume `slug(area)` is unique.
12. **Double-numbered step lines.** `load-workplan` already numbers every non-final `sop`/`verify` line, so authored lines must be UNNUMBERED. If the QUALITY BAR example in the Phase-B prompt shows numbered lines, agents copy that style and the Work tab renders `1) 1) Open the JE approval queue`. Keep the example unnumbered, and run `node scripts/enrich/strip-step-numbering.mjs scripts/output/workplan-<slug>.json` before every load — it is idempotent, so it costs nothing on clean files.

---

## 6a. Facts for Corporate Functions

- Domain L1 node: `displayValue = 'Corporate Functions'` — **3,878 tasks across 47 L3 areas / 6 value streams** (Finance & Investments 10 areas/1,032 tasks · Human Resources & Talent 9/858 · Legal & Corporate Governance 9/744 · Risk, Compliance & Audit 12/837 · Program Management Office 5/401 · Corporate Operations 2/106).
- `--std-depts`: `Finance & Accounting, Compliance & Risk Management, Human Resources, Legal & Governance, PMO & Agile Delivery, Operations & Customer Service, Data & Analytics, Information Security`.
- The domain catalog is ~465KB (797 standards, 1767 regs) — too big for an authoring agent to read alongside its area file. Run `node scripts/enrich/split-catalog.mjs` after the dump and point each agent at `enrich-catalog-<vs-slug>.json` instead.
- Baseline before enrichment: 4.52 roles / 3.76 apps (both bloated and cross-domain — GL close tasks carried Guidewire ClaimCenter), 6.18 checklist, 0.9 custom steps, and `zero_text` on **all** 3,878 tasks.

---

## 7. Verification queries (run against the feature Neon branch)

Domain areas + counts:

```sql
SELECT vs."displayValue" vs, l3."displayValue" area,
 (SELECT count(*) FROM "ProcessNodeClosure" c JOIN "ProcessNode" t ON t.id=c."descendantId"
   JOIN "ProcessLevelType" tl ON tl.id=t."processLevelTypeId" AND tl."levelNumber"=5 WHERE c."ancestorId"=l3.id) tasks
FROM "ProcessNode" vs JOIN "ProcessLevelType" vl ON vl.id=vs."processLevelTypeId" AND vl."levelNumber"=2
JOIN "ProcessNode" l3 ON l3."parentId"=vs.id
WHERE vs."parentId" = (SELECT id FROM "ProcessNode" WHERE "displayValue"='Core Business' AND "processLevelTypeId" IN (SELECT id FROM "ProcessLevelType" WHERE "levelNumber"=1))
ORDER BY vs."displayValue", l3."sortOrder";
```

**§7a — Phase A depth per VS** (swap the domain id):

```sql
WITH vs AS (SELECT v.id, v."displayValue" n FROM "ProcessNode" v WHERE v."parentId"='540fdf27-7c07-4d72-ae95-de26e9e05276'),
tasks AS (SELECT vs.n vs, t.id tid FROM vs JOIN "ProcessNodeClosure" c ON c."ancestorId"=vs.id JOIN "ProcessNode" t ON t.id=c."descendantId" AND t."isTask"=true)
SELECT vs, count(*) tasks,
 round(avg((SELECT count(*) FROM "NodeRole" x WHERE x."processNodeId"=tid)),2) roles,
 round(avg((SELECT count(*) FROM "NodeAppUsage" x WHERE x."processNodeId"=tid)),2) apps,
 round(avg((SELECT count(*) FROM "NodeStandard" x WHERE x."processNodeId"=tid)),2) std,
 count(*) FILTER (WHERE (SELECT count(*) FROM "NodeRole" x WHERE x."processNodeId"=tid AND x.role_='Owner')=0) no_owner
FROM tasks GROUP BY vs ORDER BY vs;
```

**§7b — Phase B (Work tab) completeness per VS:**

```sql
WITH vs AS (SELECT v.id, v."displayValue" n FROM "ProcessNode" v WHERE v."parentId"='540fdf27-7c07-4d72-ae95-de26e9e05276'),
tasks AS (SELECT vs.n vs, t.id tid FROM vs JOIN "ProcessNodeClosure" c ON c."ancestorId"=vs.id JOIN "ProcessNode" t ON t.id=c."descendantId" AND t."isTask"=true)
SELECT vs, count(*) tasks,
 round(avg((SELECT count(*) FROM "NodeTemplateAnswer" x WHERE x."processNodeId"=tid AND x."templateKeyId" IS NOT NULL AND (x.value IS NOT NULL OR x."roleId" IS NOT NULL OR x."applicationId" IS NOT NULL))),1) generic_defined,
 round(avg((SELECT count(*) FROM "NodeTemplateAnswer" x WHERE x."processNodeId"=tid AND x."templateKeyId" IS NULL)),1) custom_steps,
 count(*) FILTER (WHERE (SELECT count(*) FROM "NodeTemplateAnswer" x WHERE x."processNodeId"=tid AND x."templateKeyId" IS NOT NULL AND x.value IS NOT NULL)=0) zero_text
FROM tasks GROUP BY vs ORDER BY vs;
```

Target: `generic_defined = 15.0`, `zero_text = 0`.

---

## 8. Scripts (all in `backend/scripts/enrich/`)

| Script                                                        | Purpose                                                         |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| `dump-catalog.ts "<area>" --domain "<D>" [--std-depts "a,b"]` | controlled-vocab catalog + area task list                       |
| `build-and-load.ts [--dry-run] <slug…>`                       | Phase A: merge parts + coverage-check + idempotent load         |
| `merge-parts.ts <area> <slug> <part…>`                        | merge per-sub-process Phase-A parts (if you split authoring)    |
| `dump-workplan-seed.ts <slug>`                                | Phase B authoring seed                                          |
| `load-workplan.ts <workplan-*.json> [--dry-run]`              | Phase B: fill NodeTemplateAnswer (generic + custom steps)       |
| `remap-generic-keys.mjs <workplan-*.json>`                    | fix non-canonical generic keys (positional → canonical)         |
| `normalize-part.mjs <slug> [<vs-catalog-slug>]`               | Phase A: coerce string regs/apps to objects, drop unknown ids   |
| `strip-step-numbering.mjs <workplan-*.json>`                  | Phase B: remove author-emitted "1) " so the loader numbers once |
| `split-catalog.mjs`                                           | cut the domain catalog into per-value-stream catalogs           |
| `merge-batches.mjs <slug> "<Area>" <dir> <prefix>`            | salvage fanned-out fragments                                    |
| `remove-empty-templates.ts --domain "<D>" [--apply]`          | drop empty non-default template blocks                          |

Order: **§1 setup → §2 dump → §3 Phase A (author→load→verify→commit) → §4 Phase B (seed→author→load→verify→commit) → §5 cleanup → §7 final verify → mark PR ready.**
