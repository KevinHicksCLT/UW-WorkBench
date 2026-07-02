# Work Library — Plan (v3 — SIGNED OFF 2026-07-01, P0–P3 BUILT)

> Status: schema (10 tables + `kind` col), erd_v5.mmd, seed (14 templates / 58 keys),
> backfill (35,744 task assignments, 9,178 task-specific test keys, 1,010 standards,
> 683 regs), `/work-library` API, Work Library page + nav, Inspector Checklist/Testing
> plan tabs, chain ✓/✗ + deliverable roll-up, Work drill sidebar, Standards drawer +
> Regulations "Plan" column links — all live on branch `atomic-processes`, verified in
> browser. Values intentionally blank (decision 6). Remaining: legacy
> Checklist/TestingTemplate retirement + value fill after template confirmation.

Branch: `atomic-processes` (git + Neon ep-shiny-math). Status: **design only — no code yet**.

## What it is

A library of reusable **checklist templates** and **testing templates** whose keys get per-work-item
values at the atomic level (L5 task ProcessNodes, leaf Standards, Regulations). Dual purpose:
human verification AND agent-executable work instructions. Filled plan = enough context (where /
who / evidence / thresholds) for an agent to carry out and test the work autonomously.

## Decisions (user, 2026-07-01)

1. **Composable modules** — checklist patterns = Core evidence base + 5 add-on modules, chosen in
   a multi-select **dropdown**; testing pattern = single-select **dropdown** of the 8 patterns.
2. **Deliverables are a roll-up, not a subject** — a deliverable's status = derived completion
   (verified/total) across its tasks' checklist + testing rows. No deliverable plan tables.
3. **Start fresh in DB** — existing `Checklist`/`ChecklistItem`/`NodeChecklist`/`TestingTemplate`
   data is not migrated ("not remotely close"). New tables only; legacy tables/UI retired.
4. Derived/auto-fill keys — **parked**; values start blank while plan is still being worked
   through. Superseded in part by decision 8 (entity-backed combobox values).
5. **Template editing is ADMIN-only.** Per-task value filling open to users.
6. **Data fill happens after templates are built and confirmed** — seed structure + assignments
   first, values later.
7. **Standards + regulations live at task level ONLY** (revised during build) —
   NodeStandard/NodeRegulation rows attach to task nodes exclusively; value streams and
   L2/L3 containers ROLL UP from task rows (lib/govRollup.ts). No inheritance, no
   exclusion overrides: add = junction row on the task, remove = delete it. Reflects
   automatically in Standards tab VS chips, Regulations tab links, Inspector Governance,
   Roles, skill packs. Started from ZERO associations (wipe-task-standards-regs.ts;
   original VS-grain backup in scripts/backups/) — ties are made deliberately per task
   in the Work Library. Each tied standard/reg carries multi-step checklist + testing
   evidence lists on the task.
8. **Values are entity-backed comboboxes** — every value cell is a combobox over the existing
   DB entity the key asks for (SOR key → Applications list, owner/approver keys → Roles,
   evidence artifact → Deliverables; free text where no entity fits). Picking associates the
   existing row by FK; "add new" creates the row in its owning table (it appears in the
   Applications tab etc.) and then links it. No orphan strings.

## Matrix behavior (user-specified, v3)

- **No ✓/✗ inside the Work Library matrix** — defined/undefined marks appear only where plans
  are *surfaced* (value-streams sidebar, work drill-down, tab chips).
- One continuous numbered list per block. **Generic keys** (from the selected pattern) render
  numbered + grayed, not editable; user can **remove** any generic step for this item but cannot
  add generics. **Specific keys** are user-editable text, freely added/removed. Both live in the
  same list.
- Hard visual division between the four blocks: **Checklist | Testing | Standards tied to this
  task | Regulations tied to this task**.
- Left sidebar (Tasks/Standards/Regs picker + search) stays.
- Pattern dropdowns render closed (no inline module checklist).

## Source material (decoded from ABC-Insurance-Operating-Model-MERGED-DUPFLAGGED.xlsx)

- Base **Core evidence checklist** (7 keys: scope/population, named SOR + data owner, required
  fields valid, control totals reconcile, evidence retained w/ timestamp, exceptions logged,
  approver sign-off) + 5 add-on modules (1–3 keys each): **Methodology/model validation**,
  **Source traceability / workflow status**, **Regulatory / retention evidence**,
  **Implementation / change evidence**, **Approval authority / communication**.
- **8 test patterns** (col J "How"); each ends "Missing information to complete before
  automation: …" — that list is the template's keys (named process owner, test population,
  pass/fail thresholds, exception handling path, regulatory citation, …).
- Already in DB: every task's `ProcessNode.attributes` carries `how`, `checklistPattern`,
  `checklistDifferences` → assignments backfill from DB. 11,116 atomic tasks on this branch.

## Data model (erd_v5-compliant; update erd_v5.mmd same commit)

```prisma
model WorkTemplate {        // the reusable template (entity)
  id, companyId, kind String // CHECKLIST | TEST
  name, description?, isDefault Boolean, sortOrder Int
}
model WorkTemplateKey {     // one question/step — key text lives HERE once
  id, templateId (Cascade), key String, guidance String?,
  valueKind String @default("TEXT") // TEXT | APPLICATION | ROLE | DELIVERABLE — drives the value combobox source
  sortOrder Int
}

// Assignment junctions (which templates a work item uses) — @@unique(subjectId, templateId)
model NodeWorkTemplate       { processNodeId, templateId }
model StandardWorkTemplate   { standardId,    templateId }
model RegulationWorkTemplate { regId,         templateId }

// Answers — keyed (subjectId, templateKeyId), INDEPENDENT of assignment so switching the
// pattern dropdown keeps saved values; reselecting restores them.
model NodeTemplateAnswer {
  processNodeId, templateKeyId? (null = custom step), customKey String?,
  value String?,                       // free text (valueKind TEXT) — used only when no FK set
  applicationId?, roleId?, deliverableId?,  // entity-backed values (decision 8) — FK, never name text
  suppressed Boolean @default(false), sortOrder Int
  @@unique([processNodeId, templateKeyId])
}
model StandardTemplateAnswer   { same shape on standardId }
model RegulationTemplateAnswer { same shape on regId }

// Decision 7 (+signoff amendment) — per-task checklist + testing STEP LISTS for an inherited
// standard/regulation. Multi-row: user can add/remove/edit steps freely per kind. Applicability
// itself stays DERIVED (NodeStandard/NodeRegulation on L2/L3 ancestors — no applicability rows).
model NodeStandardEvidence   { processNodeId, standardId, kind String /* CHECKLIST | TEST */, step String, value String?, applicationId?/roleId?/deliverableId?, sortOrder Int }
model NodeRegulationEvidence { processNodeId, regId,      kind String /* CHECKLIST | TEST */, step String, value String?, applicationId?/roleId?/deliverableId?, sortOrder Int }
```

- Custom steps = answer rows with `templateKeyId = null` + own `customKey`.
- Removing a generic step for one item = `suppressed = true` (key text never duplicated).
- Derived keys (pending #4): `DERIVED_OWNER` / `DERIVED_APP` keys resolve value at read from
  `NodeRole` (Owner) / `NodeAppUsage`; manual answer = override only.
- Deliverable roll-up: computed at read (verified/total across the deliverable's tasks via
  NodeDeliverable), same resolver pattern as structureCounts — nothing stored.
- Migration via **additive raw SQL** (schema drift makes `db push` dangerous); schema.prisma +
  erd_v5.mmd kept in sync.

## Seeding / backfill

1. Seed 6 CHECKLIST + 8 TEST templates (`isDefault = true`) with keys from workbook/attributes.
2. Backfill `NodeWorkTemplate` for all tasks from `attributes.checklistPattern` (split " + ",
   strip "(partial)", all get Core evidence) + `attributes.how` → TEST template.
3. Standards/Regulations as subjects: start with Core evidence + a default test pattern; admins
   adjust. Their existing `testProcedure`/`evidence` columns surface alongside (not duplicated).
4. Values stay empty until templates confirmed (decision 6).

## API (new router `backend/src/routes/work-library.ts`, mounted at root `/work-library`)

- `GET  /work-library/templates` — templates + keys
- `POST/PATCH/DELETE /work-library/templates(...)/keys` — ADMIN
- `GET  /work-library/subjects?type=task|standard|regulation&q=` — search/drill atomic items
- `GET  /work-library/plan/:type/:id` — sections: checklist keys, testing keys, applied
  standards rows, applied regulations rows; each row `{ key, value, defined, derived,
  suppressed, custom }`
- `PUT  /work-library/plan/:type/:id/templates` — save dropdown selections
- `PUT  /work-library/plan/:type/:id/answers` — upsert values / suppress / custom steps /
  standard-reg evidence
- Batch completeness endpoint (grouped counts, no per-row fan-out) for chips + deliverable roll-ups.

## UI

1. **Work Library page** (`/work-library`, nav link): left sidebar picker (Tasks/Standards/Regs
   + search); two closed pattern **dropdowns**; four divided blocks (Checklist / Testing /
   Standards tied / Regulations tied), each a numbered matrix — grayed generic keys (remove
   only), editable specific keys (add/remove), **entity-backed combobox value cells** with
   "add new → writes to owning table". No ✓/✗ here.
   **Templates tab** (separate place, ADMIN-only): left list of all checklist + testing
   templates; add/delete/rename templates; per-template key editor — rename keys inline, add
   key, remove key, set value type (free text / Application / Role / Deliverable). Shows
   usage count; edits propagate to every plan using the pattern (key text lives once on
   WorkTemplateKey — single source of truth).
2. **Inspector Testing tab** — plan view (meter, ✓/✗ rows, standards/regs applied counts) +
   "Edit in Work library" deep link. Checklist tab same treatment.
3. **Work drill-down chain** — deliverable header gets roll-up chip + bar (verified/total across
   tasks); task cards show Checklist / Testing / Standards / Regulations sections, defined →
   green ✓ + value, undefined → red ✗ + key.
4. **Standards / Regulations / Tasks tabs + Work sidebar** — completeness chips linking in.
5. Legacy `TestingTemplateModal`, `/explorer/testing-templates`, checklist CRUD in Inspector
   retired when parity reached.

## Phases

- **P0** Schema + ERD + additive SQL migration (10 new tables).
- **P1** Seed 14 templates; backfill task assignments from attributes; default assignments for
  standards/regs.
- **P2** Work Library page + API (matrix, dropdowns w/ value persistence, custom steps,
  standards/regs sections, ADMIN template editor).
- **P3** Surfacing: Inspector tabs, chain sections + deliverable roll-up, tab chips.
- **P4** Value fill (after template confirmation) + legacy retirement.

## Remaining before build

- Decision 4 (derived keys) — confirm or reject.
