# Data Correctness Plan — ABC Insurance Operating-Model Master

**Goal:** turn the master sheet into data you can *trust* — every task answers the six questions at the right level, with no executive-on-a-task nonsense and no confident-but-wrong fills. Then load it.

**Grounded in:** the working-session transcript (six questions, "step is the task", roles = the doers, "find the gaps → research → fill", "organized = trustworthy", readable markdown before load).

---

## 0. What actually went wrong (so we don't repeat it)

| Root cause | Effect you saw | Fix |
|---|---|---|
| Associations filled at **value-stream grain** (`RoleValueStream` = every role in the stream) | Chief Underwriting Officer, Chief Actuary on a single atomic task | Associate at the **task** level — roles are the **doers** |
| **Unvetted synthetic spine** — 8,355 AI-decomposed L5 (11.8× the vetted 710; 0 name overlap) | Tasks the agent "couldn't figure out" | Validate every task against the rubric; keep only what passes |
| **Coarse back-fill** instead of leaving gaps | Corruption looked like content | **Blank + yellow beats a confident wrong value** |

The Bridge-sourced rebuild (v4) already fixed cause #1 — roles are doers ("Claims Intake Representative", not the CUO).

---

## 1. Principles (the non-negotiables)

1. **L5 step = atomic task = the unit of correctness.** Everything is judged per task.
2. **Roles are the people doing the work** — a participant and a lead — never division executives.
3. **The six questions define a complete task.** A task is correct only when all six are answered at its own level.
4. **Blank + yellow > a wrong value.** A cell is either traceable to a vetted source (tagged) or empty and flagged. No coarse dumping. *This is the single rule v3 broke.*
5. **One source of truth per cell**, with provenance.
6. **Readable form for human sanity-check before any DB load.**
7. Standards / regulations = **task groups**; a checklist = a **codified test** tied to the task + role; an application = the **system of record** (where work is performed or memorialized).

---

## 2. The correctness rubric — the six questions, per task

| # | Question | Column(s) | Pass rule |
|---|---|---|---|
| Q1 | **Who** participates + **who leads** | Roles (Participants) + Owner/Lead | Roles are doers at this task — **not** Executive/Leadership level |
| Q2 | **What** is produced (done = ?) | Deliverables | An artifact this task produces |
| Q3 | **How** the work flows | Task name + How/description | Concrete and atomic |
| Q4 | **Where** it happens | Application / System of Record | Where work is performed or memorialized |
| Q5 | **Controls** / evidence | Standards · Regulations · Checklist | Standards/regs = task groups; checklist = codified test tied to role |
| Q6 | **How well** | Metrics (capacity/wait later) | Measurable |

**Auto-checkable sanity rules (the corruption detectors):**

- **R1 — no execs on tasks.** Flag any task whose Participant/Owner role has `roleLevel ∈ {Executive, Leadership}` (checked against the role catalog). *This alone catches the v3 nonsense.*
- **R2** every task has ≥1 participant **and** a named lead, else gap.
- **R3** every task has ≥1 deliverable, else gap.
- **R4** the application is a real catalog entry (system of record), not free text.
- **R5** controls present where the task is governed, else gap.
- **R6** every non-empty cell traces to a vetted source (provenance tag), else it is downgraded to blank+yellow.
- **R7** one lead, many participants; Role↔Deliverable is many-to-many (owner vs contributor).

---

## 3. Resolving "710 too small vs 8,355 wrong" — reconcile, don't choose

Neither number is the target. The target is **"as many tasks as the work actually has, each passing the rubric."**

- **Bridge 710 = the gold standard for grain and quality** (vetted, answers the six questions). Use it as the **skeleton** and the quality bar.
- **8,355 = an unvetted candidate superset.** Mine it, but **each task must earn inclusion** by passing the rubric — it is not trusted by default.

**Reconciliation method:**
1. **Coverage map.** For every value stream (L1→L4): count vetted tasks (Bridge) vs synthetic (8,355). This shows precisely **where 710 is genuinely thin** (e.g., Life / Annuity / Retirement / Disability) and **where 8,355 is bloated noise**.
2. **Thin streams →** expand by targeted research to the right number of *real* tasks (six-questions each).
3. **The 8,355 →** dedupe / merge / validate against Bridge + the rubric; keep passers, drop synthetic noise.
4. **Final task count is emergent and justified per task** — somewhere between 710 and 8,355, and defensible line-by-line. That is the answer to your doubt, produced by data instead of a guess.

---

## 4. Pipeline (phased, each with a verify)

| Phase | Do | Verify |
|---|---|---|
| **A. Lock model + rubric** | Master columns = the six questions + QA columns | Columns map 1:1 to Q1–Q6 |
| **B. Hydrate from vetted research** | Pull tasks/roles/deliverables/etc. from Bridge by *meaning*; tag provenance per cell | Every filled cell has a source tag |
| **C. Run sanity rules** | Compute six-questions completeness + R1–R7 per task; gaps → blank+yellow | 0 exec-on-task (R1); QA status on every row |
| **D. Coverage + reconciliation** | The §3 coverage map; decide per stream | Per-stream vetted/synthetic/gap counts produced |
| **E. Gap-fill research** | Fill the all-yellow columns (per-task Applications/SoR, Checklists, Regulations) and thin streams | Tracked gap list shrinks; new cells pass the rubric |
| **F. Human review** | Readable sheet/markdown; spot-check 10 streams against the six questions | "Organized = trustworthy" bar met |
| **G. Load** | Write to the DB | Only after QA passes; rollback point tagged first |

---

## 5. The "is it correct?" scorecard

- **Per task:** completeness 0–6 (questions answered) + violation count.
- **Per stream:** % of tasks at 6/6, count of R1 (exec) violations, count of gaps.
- **Master is loadable when:** 0 R1 violations, and ≥ target % of tasks at 6/6 (you set the bar), with all remaining gaps explicitly yellow (not fabricated).

This makes "correct" a number you can watch climb, not a feeling.

---

## 6. What currently fills vs what is a known gap (today, on the Bridge base)

| Bridge supplies (vetted) | All-yellow gaps (need §3 / §4-E) |
|---|---|
| Owner/Lead, Participants, Deliverables, Metrics, Standards (by domain), External | **Applications/SoR**, **Checklists**, **Regulations**, **Automatability**, and thin value streams |

---

## 7. Immediate next steps (once you say go)

1. **Build the six-questions QA harness** on the master — computes completeness + runs R1–R7 (incl. exec detection via the role catalog), adds a per-task QA status + a gap list tab. *Makes correctness visible before we fill anything.*
2. **Produce the coverage / reconciliation report** (§3) — per stream: vetted vs synthetic vs gap. **This answers the 710-vs-8,355 question with data.**
3. From there, drive gap-fill research stream-by-stream until the scorecard hits the bar.

*No DB writes until Phase G, and a rollback point is tagged first.*
