# Operating-Model Data Model — Working Session Review

**Source:** `MicrosoftTeams-video (1).mp4` (~85.5 min) + in-chat comments + diagram screenshots
**Artifact under review:** `ERD_branch_v1` (`documents/value-streams/ERD/ERD_branch_v1.html` / `ERD_branch.erd.mmd`)
**Date of review doc:** 2026-06-22
**Prepared by:** Claude (Cowork) — no code changes were made; this is analysis only.

> **Transcript caveat.** The audio was transcribed locally with a small offline model (Vosk small-EN) because higher-quality services weren't reachable from this environment. The verbatim transcript (`transcript_clean.txt`) is rough — names, numbers, and exact wording are unreliable. Everything below is my *interpretation* of the discussion, cross-checked against the actual ERD files in the repo (`ERD_branch.erd.mmd`, `ERD_prod.mmd`, `ERD_branch.flow.mmd`) and the chat notes/images you supplied. Where I'm inferring, I say so. Please correct anything that doesn't match your memory of the call.

**Participants (inferred, not named reliably in audio):** two voices —
- **Sponsor / domain lead** — drives requirements, deep enterprise/org experience (references leading teams like integration, submissions, rating; charge-backs; being "overhead" in a matrix org). Owns the "what" and "why."
- **Builder / engineer** — produced the refined diagram, is implementing the data model and the app. Owns the "how."

---

## 1. Summary

The session was a screen-shared walkthrough of the **refined operating-model ERD (`ERD_branch_v1`)** — the cleaned-up target that collapses the model down to two spines plus connection tables, with **Initiative and Metric parked**.

The two spines confirmed on the call:

- **Value-stream spine (5 levels):** `Company → L1 Segment (ValueStreamDomain) → L2 Division (ValueStream) → L3 Process → L4 Sub-Process → L5 Step (= Task)`.
- **Org spine:** `Company → Division → Department → Role`.

The bulk of the conversation was about **where the model is still too rigid**, and it converged on one dominant theme: **almost everything needs to be configurable at *arbitrary levels*, by an admin, through the app, without code.** Specifically:

1. **Org levels must be generic and extensible.** Stop hard-coding `Company/Division/Department`. Rename to generic **"org levels"** (level 1..N) with **relabelable display names**, so a customer can have 4 levels or 6+, and can **insert a new level** (e.g., "Team" between Department and Role) at runtime.
2. **Roles attach at *different* levels**, not only at the bottom. A role can sit at multiple org levels; this needs a flexible association, not a single fixed foreign key.
3. **Managers / reporting are not yet modeled** — flagged as a gap to solve "sooner rather than later."
4. **Connections (deliverables, regulations, standards, applications, checklists) must attach at the *right* — and potentially *multiple* — levels**, not pinned to a fixed L3/L4/L5. The current pinning (Deliverable→L3, Reg→L3, Standard→L4, App→L5) is too coarse.
5. **A regulation needs to connect to the *applications* and *evidence/tests* it governs** — "knowing GDPR applies" is useless without "which apps, which tests, how do I prove it to an auditor."
6. **Task is the atomic unit of work**; deliverables are produced by tasks; **standards and regulations behave as "task groups."** Tasks (and deliverables, maybe roles) are the **units evaluated for agent automation vs. augmentation**.
7. **People and capacity were deliberately removed for now but must return** — the whole point of knowing who does what is to measure **available vs. consumed capacity, priorities, and wait time** (your chat note). This is Phase 2 but should be designed for now.
8. **The data-admin experience is a first-class requirement:** add/edit/relabel anything from the screen; **drag-and-drop** to move nodes, with **automatic inheritance** of everything beneath a moved node; distinguish admin config from end-user preferences.

The agreed near-term path: **lock the data model on a branch, hydrate it from the existing analysis, find and fill gaps, keep the work safe/rollback-able, and produce readable (markdown) output to sanity-check before demoing** a buttoned-up, fictional "ABC Insurance" example.

---

## 2. Notes (detailed, by theme)

### 2.1 The refined diagram & what's parked
- The diagram is a deliberate simplification — "a lot of unnecessary" detail removed. `Initiative` and `Metric` are **parked** (confirmed in `ERD_branch.erd.mmd`: both carry `PARKED` notes). Focus is the **process/work structure**, not initiatives/metrics, for now.
- Connection-table migration status (from `ERD_branch.flow.mmd`): `StepDeliverable`, `StepAppUsage`, `RequirementValueStream`, `RoleValueStream` = **WIPED → rebuild**; `Checklist↔Step` and `Standard↔L4` = **NEW**; `ChecklistItem.roleId` = **intact**. Value-stream row remap in progress (e.g., L3 0→135, L4 868→867, L5 ~8,355).

### 2.2 Configurable org levels (biggest single requirement)
- Don't lock to `Company/Division/Department`. Call them **org levels** ("org level 1 / 2 / 3…") so the count varies by customer. The sponsor noted being **~6 levels deep** in a real org.
- Need to **add a new level** (example given: insert **"Team"** between Department and Role). When you do, the connection from the new level to its neighbours is **many-to-one to the level you're inserting against**, and roles need to be re-pointable to it.
- Must be doable **through the application, without coding** — an admin action, not a migration.
- A node sometimes needs a **composite key** (e.g., *org level + org name*) rather than a single surrogate id.
- **FK correction spotted on the call:** in the org spine the lowest node's parent key looked wrong on the diagram — they expected `Role`/lowest level to carry `departmentId`, but the diagram showed it tied at the division level. Keys need an audit pass. (In `ERD_branch.erd.mmd`, `Role.divisionId` is the FK; prod `ERD_prod.mmd` actually has both `Role.divisionId` *and* `Role.departmentId`.)

> **Relevant prior art in the repo:** the **production** model (`ERD_prod.mmd`) already contains a generic `Level` table (levelNumber, parentId tree, 896 rows) **and** a generic `Node` / `NodeType` / `NodeLink` graph (2,674 nodes, 10 node types, 3,308 links). That is essentially the configurable-level capability being asked for. The branch refinement traded it for explicit fixed tables (clearer, but rigid). This is the central architectural decision — see §4 and §5.

### 2.3 Roles at multiple levels + managers
- A role is **not always at the bottom**. People can attach roles at **different org levels**. Real example: a matrix org where the person sat at one level, peers were in different orgs, and many people reported up.
- Current `Role → Department` (one-to-many) is "fine" as a default, **but** the model must also allow a role to associate at other levels → needs a **role↔org-unit association** (many-to-many) rather than only a fixed FK.
- **Managers / reporting are missing** ("one thing we don't have contemplated… is managers"). Need role-to-role manager relationships and **org levels that inherit from their parent level** (org level 5 is a child of org level 4).

### 2.4 Connections must attach at the right (and multiple) levels
The recurring complaint: connections are pinned too high/rigidly. Same pattern as roles — let them associate at the appropriate, and sometimes multiple, levels:
- **Deliverable** — currently tied to L3; should attach at different levels (example debated: an "alpha release" deliverable — is L3 the right level?).
- **Regulation** — currently L3. Needs: *one regulation → many value-stream nodes* **and** *→ many applications*. The sponsor was emphatic: "GDPR applies" is not actionable; you need **which applications it touches, what tests to run, on which apps, and how to prove it to a regulator/auditor** (evidence).
- **Standard** — attaches in many places; behaves like a **task group**.
- **Application / system of record** — used at the task level but should **roll up**; tie to **charge-back** logic (apps cost money; cost is allocated across businesses by usage — "$10M doled out, not everyone pays the same").
- **Checklist** — `ChecklistItem` vs `Checklist↔Step`: the *item* is its own table; *Checklist↔Step* is the **join** between an L5 step (task) and its checklist items; items are also tied to a **role**. Mental model: checklist = a **codified unit test** for a task.

### 2.5 Tasks, deliverables, standards/regs as "task groups," and automation
- **L5 Step = Task = the atomic unit.** Keep tasks atomic (avoid exploding rows / excessive joins that hurt performance). Deliverables are a separate thing **produced by** tasks.
- **Standards and Regulations are "task groups"** — underneath them sit tasks/rules.
- Tasks should associate to a **value-stream node (lowest meaningful level)** and **not** live at the role level — though a role/person obviously has to *perform* them.
- **Automation/augmentation is the payoff:** model tasks atomically so you can identify "if we automate ~80% of the tasks that create this deliverable, deliverable creation gets markedly faster." **Tasks and deliverables (and possibly roles) are the units evaluated for automate-vs-augment.** (Repo confirms intent: branch `feature/agent-automatability` exists.)
- **Teaching an agent** a task = a **testing/verification template**: a form/directions such as "go to *this* SharePoint site → *this* folder → look for *this* file → check presence/absence of *X*." This needs to be captured in the model.

### 2.6 Systems of record
- A system of record is often a **combination** (e.g., SharePoint + an Excel file + screenshots), i.e., "where work is performed and/or memorialized." Discussed the fuzzy line between **applications vs. services vs. systems of record** — model needs an Application/System entity flexible enough to express "this is where it's memorialized," without forcing every micro-tool to be catalogued.

### 2.7 Capacity, priorities & wait time (your chat note, and §74–80 of the call)
- **Why model who-does-what:** to understand **available vs. consumed capacity** and **priorities**. If someone you depend on is at capacity, you either get their priorities changed or accept that your work is late.
- **This historically "gets away from people" because it's tracked loosely.** Use **telemetry** to make it real — example: committed 30 hrs, delivered 60 story-points-worth, but has 40 hrs of meetings over two weeks → no capacity. "Hope is not a strategy."
- For **value streams**, explicitly **measure wait time and compare it to similar scenarios** (your note). Tie to enterprise change: what to automate, how cycle time changes, how (e.g.) legal decides attorney headcount, pipeline/throughput visibility, and **systems-of-record gating**.
- Measures to capture (from your "carrying cost" image): **Effort** (hrs), **Duration** (elapsed), **Capacity** (available hrs), **SLAs** (days), **Carrying Cost** ($/day of delay).

### 2.8 Data-admin UX & labeling (mostly app-layer, with schema hooks)
- **Admin can add/edit anything from the screen** — a button to create/edit/relabel nodes; an audit log of changes.
- **Drag-and-drop** to reorder/move nodes (the iOS-home-screen analogy). **Moving a node must automatically carry everything connected beneath it** (inherit relationships). Acknowledged as hard but high value.
- **Relabel display names** without touching structure. Reason: merged/acquired companies and regions **call the same thing by different names**; you relabel for **holistic, apples-to-apples reporting**. Implies a **display-name vs. system-name** split and a per-company **terminology/label** map.
- Separate **admin config** from **end-user preferences** (e.g., a user reordering their own columns is a saved preference, not a structural change).
- **Views ≠ storage:** the DB structure and the on-screen presentation don't have to match; use **views** that join multiple tables for composite screens. (Connection tables are associative entities / "virtual" tables.)

### 2.9 Demo & process expectations
- Salvage existing work; **keep an experimental branch**; don't break what works; be able to **roll back to the last good state**.
- Output must be **readable (markdown)** so it can be reviewed and "hydrated."
- Demo will use a fictional **"ABC Insurance"** example, **buttoned-up and organized** ("organized = trustworthy"). The six-questions framework (below) drives how each value stream is defined.
- Housekeeping: may need to **upgrade the plan/branch limits**; spend approved ("these are investments").

### 2.10 The "six questions every value stream must answer" (your image — the definition checklist)
1. **Who** does the work and owns which decisions? → Roles, ownership.
2. **What** is produced — and what does "done" mean? → Deliverables, acceptance.
3. **How** does work flow: steps, variants, exceptions? → Tasks, process nodes.
4. **Where** does it happen: systems, data, channels? → Applications / systems of record.
5. **What** controls, compliance, evidence? → Standards, regulations, tests.
6. **How well**: metrics, throughput/time, quality? → Capacity, wait time, SLAs.

These six map almost one-to-one onto the entities in the proposed model (§4).

---

## 3. Action items

| # | Action | Owner (inferred) | Notes / acceptance |
|---|--------|------------------|--------------------|
| A1 | Take a pass at the refined model on the working branch; correct the data model and get it into the app | Builder | Sanity-check before moving anything; be able to explain "why it's this way" |
| A2 | Rename `Company/Division/Department` → generic **Org Levels** (1..N) with relabelable display names | Builder | Must support add-a-level and N levels per customer |
| A3 | Make **Role attach at multiple org levels** (role↔org-unit association), keep a primary | Builder | Default one-to-one still allowed |
| A4 | Add **manager / reporting** relationships and **parent-level inheritance** | Builder | Flagged "sooner rather than later" |
| A5 | Make connections (**Deliverable, Regulation, Standard, Application, Checklist**) attach at **any/multiple levels**, not fixed L3/L4/L5 | Builder | Mirror the role-at-levels pattern |
| A6 | Add **Regulation → Application** link + **evidence/test** capture | Builder | "Which apps does this reg touch + how do I prove it" |
| A7 | Add **charge-back** model for applications (cost allocation by org/value stream/usage) | Builder | Apps cost money; allocate by usage |
| A8 | Confirm **Task = L5 step** as atomic unit; model **Standards/Regs as task groups** | Builder | Keep tasks atomic for performance |
| A9 | Add **automatability** attributes to Task & Deliverable (manual / augmented / automated) | Builder | Aligns with `feature/agent-automatability` |
| A10 | Add a **testing/verification template** (system, location, file, presence/absence check) for agent teaching | Builder | "Teach an agent to do the task" |
| A11 | **Audit all FKs/keys** (esp. Role→Department vs Division; support composite keys) | Builder | Issue spotted live on the diagram |
| A12 | Design (not yet build) **People + Capacity + Wait-time** module | Builder + Sponsor | Effort/Duration/Capacity/SLA/Carrying-Cost + handoff wait time |
| A13 | Spec the **data-admin UX**: add/edit/relabel from screen, drag-drop move with inheritance, admin-vs-preference split | Builder + Sponsor | iOS-home-screen analogy |
| A14 | Add **display-name vs system-name** split + per-company **terminology/label** map | Builder | For merged/acquired naming → holistic reporting |
| A15 | Define **read views** for composite screens (flattened L1–L5 sheet; role→deliverables→tasks) | Builder | Views ≠ storage |
| A16 | **Hydrate** the locked model from existing analysis; **find gaps**; loop research to fill | Builder | Then add work/deliverables/checklists |
| A17 | Keep an **experimental branch**, protect working state, ensure **rollback** | Builder | Don't break what works; never touch master |
| A18 | Prep a **clean "ABC Insurance" demo** organized around the six questions | Builder + Sponsor | "Organized = trustworthy" |
| A19 | Confirm **plan/limit upgrade** (billing) | Sponsor | Approved in principle |

> **Decision needed from you (see §4/§5):** fixed L1–L5 value-stream tables **vs.** one recursive `ProcessNode` table (and likewise, explicit org tables vs. a generic `OrgUnit` tree). My recommendation is the recursive/generic approach — it's the only one that cleanly satisfies "add levels at runtime, without code." I left both in the change list so you can choose.

---

## 4. Target data-model architecture (proposed)

This design satisfies the requirements in §2. The guiding principle from the call: **generic, level-typed spines + associative connections that can bind at any level**, with display/labeling handled as data, not schema.

### 4.1 Spines (generic + level-typed)

**Organization (replaces fixed Company/Division/Department/Role chain):**
- `OrgLevelType(id, companyId, levelNumber, code, displayName)` — ordered, **relabelable** levels (1=Division, 2=Department, 3=Team…); add a level = insert a row, no migration.
- `OrgUnit(id, companyId, orgLevelTypeId, parentId→OrgUnit, name, displayName)` — **adjacency-list tree**, arbitrary depth.
- `Role(id, companyId, orgUnitId, managerRoleId→Role, name, displayName)` — primary placement + **manager self-reference**.
- `RoleOrgAssignment(id, roleId, orgUnitId, isPrimary)` — role at **multiple** levels (M:N).

**Value stream (recommended: same generic pattern):**
- `ProcessLevelType(id, companyId, levelNumber, code=L1..L5, displayName)`.
- `ProcessNode(id, companyId, processLevelTypeId, parentId→ProcessNode, name, displayName, isTask)` — L1…L5 in one **recursive** table; the lowest level (`isTask=true`) **is the Task**.

*(Alternative kept for your decision: retain explicit `L1_Segment…L5_Step` tables as in `ERD_branch_v1`. Clearer joins, but cannot add/insert levels without code — directly conflicts with A2/A5.)*

### 4.2 Work & control entities
- `Deliverable(id, companyId, title, automatability)` — produced by tasks.
- `Checklist(id, companyId, name)` → `ChecklistItem(id, checklistId, roleId, text)` — checklist = codified test.
- `TestingTemplate(id, taskNodeId|deliverableId, system, location, checkType=presence|absence, expected)` — agent-teaching/verification.
- `Standard(id, companyId, name)` and `RegulatoryReq(id, companyId, name)` — both behave as **task groups**.
- `Application(id, companyId, name, kind=SystemOfRecord|Tool|Service, chargebackModel)` — systems of record can be composite.

### 4.3 Connections (associative entities — bind at ANY level)
- `NodeDeliverable(processNodeId, deliverableId)` — replaces `StepDeliverable`, level-flexible.
- `RoleDeliverable(roleId, deliverableId, role=Owner|Contributor)` — M:N owner/contributor.
- `NodeRegulation(processNodeId, regId)` — replaces `RequirementValueStream`.
- `RegulationApplication(regId, applicationId, evidenceRef)` — **NEW**: reg → apps + evidence.
- `NodeStandard(processNodeId, standardId)` — replaces `Standard_L4`.
- `NodeAppUsage(processNodeId, applicationId, usageType)` — replaces `StepAppUsage`.
- `NodeChecklist(processNodeId, checklistItemId)` — replaces `Checklist_Step` (+ `ChecklistItem.roleId` intact).
- `AppChargeback(applicationId, orgUnitId|processNodeId, allocationPct, cost, period)` — **NEW**: cost allocation.

### 4.4 People & capacity (Phase 2 — design now, build later)
- `Person(id, companyId, name)`, `RolePerson(roleId, personId, allocationPct)`.
- `Capacity(personId|roleId, period, availableHours, consumedHours)`.
- `WorkItem(id, taskNodeId, roleId, effortHours, durationDays, slaDays, carryingCost, status)`.
- `Handoff(id, fromRoleId, toRoleId, workItemId, requestedAt, startedAt, completedAt, waitTime)` — **wait-time measurement & comparison**.

### 4.5 Cross-cutting
- `Terminology(companyId, entity, key, displayName)` — per-company relabeling.
- `AuditEntry` (existing) — admin change log.
- **Parked:** `Initiative`, `Metric`.
- **Derived (view, not stored):** `Role ⇢ ValueStream` from the work a role does.

A rendered entity-relationship diagram of this proposal is provided alongside this document as **`ERD_target_v2.mmd`** (open with any Mermaid viewer, same as the existing ERD HTML files).

---

## 5. Changes to address vs. `ERD_branch_v1`

Concrete deltas from the current branch ERD (`ERD_branch.erd.mmd`). **C** = change, **N** = new, **F** = fix, **D** = decision.

1. **(D/C) Generalize the org spine.** Replace fixed `Company→Division→Department→Role` with `OrgLevelType` + `OrgUnit` (recursive) + `Role`. *Why:* A2 — add/rename levels at runtime. (Prod already proved this with `Level` + `Node/NodeType/NodeLink`.)
2. **(C) Role at multiple levels.** Replace sole `Role.divisionId` with `Role.orgUnitId` (primary) + `RoleOrgAssignment` (M:N). *Why:* A3.
3. **(N) Manager / reporting + level inheritance.** Add `Role.managerRoleId` and parent-level inheritance on `OrgUnit`. *Why:* A4 — explicitly missing today.
4. **(D/C) Generalize the value-stream spine** to `ProcessNode` (recursive, level-typed) — or consciously keep L1–L5 fixed. *Why:* A5; "number of levels may change."
5. **(C) Level-flexible connections.** Re-point `StepDeliverable`/`RequirementValueStream`/`Standard_L4`/`StepAppUsage` from fixed L3/L4/L5 to `ProcessNode` (any level): `NodeDeliverable`, `NodeRegulation`, `NodeStandard`, `NodeAppUsage`. *Why:* A5.
6. **(N) `RegulationApplication`** (reg → apps + evidence/test). *Why:* A6 — the GDPR "which apps + how to prove" point.
7. **(N) `AppChargeback`** (cost allocation by org/value stream/usage). *Why:* A7.
8. **(C) `RoleDeliverable`** confirmed M:N with `Owner|Contributor`; deliverable also bindable at any node level (not L3-only). *Why:* §2.4.
9. **(N) Automatability** fields on `Task`(`ProcessNode`) and `Deliverable`. *Why:* A9 / `feature/agent-automatability`.
10. **(N) `TestingTemplate`** for verification/agent-teaching. *Why:* A10.
11. **(C) Checklist grouping:** add `Checklist` parent over `ChecklistItem`; keep `NodeChecklist` join + `ChecklistItem.roleId`. *Why:* §2.4.
12. **(N, Phase 2) People + Capacity + Handoff/Wait-time** module. *Why:* A12 + your chat note.
13. **(N) `Terminology`/label map** + `displayName` vs `name` everywhere. *Why:* A14.
14. **(F) Key audit:** Role→**Department** (lowest level), support **composite keys** (level+name). *Why:* A11 — issue seen live.
15. **(C) Keep `Initiative`/`Metric` parked** (no change) — confirm they stay out of v1.
16. **(N) Read views** (flattened L1–L5 sheet; composite role/deliverable/task screen). *Why:* A15; views ≠ storage.

---

## 6. Plan to build the data model & next steps

A phased plan with explicit verification at each step (no code is changed by this document; this is the recommended build sequence for the working branch — **never on master**).

### Phase 0 — Decide & lock scope (before building)
1. **Confirm the two decisions (D):** recursive `OrgUnit`/`ProcessNode` vs. fixed tables. → *verify:* sign-off recorded in this doc.
2. **Confirm parked set** (Initiative/Metric out) and **Phase-2 set** (People/Capacity designed-not-built). → *verify:* explicit yes/no.
3. **Confirm branch + rollback** strategy; tag last-good state. → *verify:* branch created off the current ERD branch, master untouched.

### Phase 1 — Core spines
4. Build `OrgLevelType`+`OrgUnit`+`Role`(+`RoleOrgAssignment`,`managerRoleId`). → *verify:* seed a 4-level and a 6-level company; add a "Team" level **via data only**.
5. Build `ProcessNode`(+level types) **or** keep L1–L5. → *verify:* round-trip the existing L1–L5 rows; counts match `ERD_branch.flow.mmd` (L3 135, L4 867, L5 ~8,355).
6. **Key/FK audit.** → *verify:* every FK resolves; Role resolves to lowest org level; composite-key cases enumerated.

### Phase 2 — Work, control & connections
7. `Deliverable`, `Checklist`/`ChecklistItem`, `Standard`, `RegulatoryReq`, `Application`. → *verify:* each renders in the data-admin grid.
8. Rebuild connections as level-flexible (`Node*` joins) + `RoleDeliverable` + `RegulationApplication` + `NodeChecklist`. → *verify:* attach the same deliverable at two different levels; attach one regulation to N value streams **and** N apps.
9. Add **automatability** + `TestingTemplate`. → *verify:* mark a task automated and a deliverable augmented; capture one verification template end-to-end.

### Phase 3 — Hydrate & gap-fill
10. Load the model from the existing analysis (company → L5). → *verify:* row counts reconcile to source; spot-check 10 value streams against the six questions.
11. **Find gaps** (where data doesn't map / known issues) → loop research to fill. → *verify:* a tracked gap list that shrinks.

### Phase 4 — Admin UX & views
12. Data-admin: add/edit/relabel from screen; **drag-drop move with inheritance**; admin-vs-preference split. → *verify:* move a mid-level node; confirm all descendants/connections follow; relabel a level and see reporting update without structural change.
13. Build read **views** for composite screens. → *verify:* flattened L1–L5 export matches the tree.

### Phase 5 — Charge-back & (later) capacity
14. `AppChargeback`. → *verify:* allocate one app's cost across two businesses by usage; totals reconcile.
15. **Phase-2 build:** People + Capacity + `Handoff`/wait-time. → *verify:* compute available-vs-consumed for one role; measure wait time on one handoff and compare two similar handoffs.

### Phase 6 — Demo
16. Assemble the **"ABC Insurance"** walkthrough organized by the six questions; markdown output for review. → *verify:* a dry run; "organized = trustworthy" bar met; rollback rehearsed.

---

## 7. Open questions to confirm with the team
- **Fixed vs. recursive levels** for org **and** value stream (the one real fork). Recommendation: recursive/generic.
- Is **Task** literally the L5 `ProcessNode` (`isTask`), or a separate `Task` table linked to it? (Prod has a separate `Task` table of 5,795 rows under `Deliverable`.)
- Should **charge-back** allocate at the **org-unit** or the **value-stream/process** level (or both)?
- For **capacity/wait-time**, what is the source of telemetry (story points, calendar/meeting load, ticket timestamps)? Needed to make A12 real.
- Confirm **People** returns in Phase 2 and not v1.

---

*Supporting files delivered with this report:* `ERD_target_v2.mmd` (proposed target ERD), `transcript_clean.txt` (rough verbatim transcript with timestamps).
