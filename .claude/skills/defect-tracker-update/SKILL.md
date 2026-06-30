---
name: defect-tracker-update
description: Work and close items from the Transformation Bridge Defect Tracker spreadsheet (documents/Transformation-Bridge-Defect-Tracker.xlsx). Use whenever fixing, implementing, or closing a defect/enhancement identified by an ID like VS-01, T-05, E-02, A-03, DQ-01. Enforces verifying acceptance criteria before marking Complete and always updating the tracker row's status AND its state colour.
---

# Defect Tracker Update

Mandatory workflow for every item worked from the defect tracker. The tracker is the
source of truth for review — a fix that is not recorded there is not done.

**File:** `documents/Transformation-Bridge-Defect-Tracker.xlsx`
**Sheet:** `Defect Tracker` — header on row 4, data from row 5. Items keyed by ID
(`VS-`, `T-`, `E-`, `A-`, `DQ-` …). Companion sheet `Value Stream Analysis` has its
own per-stream rows.

## Columns that matter

| Col | Field | Notes |
|---|---|---|
| A | ID | lookup key |
| C | **Agent Status** | the automation work state — dropdown: Not Started / In Progress / Blocked / Complete |
| D | **Review Status** | human review state — Pending Review / Approved / Rejected / Needs Changes. Default Pending Review. **Do NOT set this to Approved yourself** — that's the human reviewer's call. |
| E | Pending Review Comments | put your resolution note + AC-verification evidence here |
| F | Priority | High / Medium / Low |
| K | Detail & Acceptance Criteria | **read this first — the AC is the definition of done** |

## The rule (every defect, no exceptions)

1. **Read the row** — find the item by ID. Read col K (Detail & Acceptance Criteria) and col J (Defect/Enhancement). The AC is what you must satisfy, not your own idea of done.
2. **Mark In Progress** when you start (optional but preferred):
   `python .claude/skills/defect-tracker-update/update_defect.py --id <ID> --status "In Progress"`
3. **Do the work.**
4. **Verify the AC is met** — actually check each acceptance criterion against the real app/DB/code. If any criterion is unmet, the item is **not** Complete. If blocked, set `--status Blocked` and explain in `--comment`.
5. **Update the tracker** — set Agent Status to Complete and record a resolution note (state explicitly which AC items you verified and how):
   `python .claude/skills/defect-tracker-update/update_defect.py --id <ID> --status Complete --comment "RESOLVED — <what changed>. AC verified: <criterion-by-criterion evidence>."`
6. Leave Review Status as **Pending Review** for the human. Only touch col D if the human asks you to (e.g. record Rejected / Needs Changes).

## Why the helper script (do not hand-edit colours)

State colours come from **conditional formatting** that only covers `C5:C55` and
`D5:D55`, but the status dropdowns run to row 105. So on any row past 55, just typing
the value leaves the cell **uncoloured** — that's the "update the colour" requirement.
`update_defect.py` writes the value AND stamps the matching fill explicitly, so the
colour is correct on every row. It also preserves the dropdowns and conditional
formatting on save.

Colour map (must match — the script enforces it):

| Agent Status | fill | | Review Status | fill |
|---|---|---|---|---|
| Not Started | `FCE4D6` peach | | Pending Review | `FFEB9C` yellow |
| In Progress | `FFEB9C` yellow | | Approved | `C6EFCE` green |
| Blocked | `FFC7CE` red | | Rejected | `FFC7CE` red |
| Complete | `C6EFCE` green | | Needs Changes | `FCE4D6` peach |

## Helper commands

```bash
# from repo root
python .claude/skills/defect-tracker-update/update_defect.py --list                 # all IDs + status
python .claude/skills/defect-tracker-update/update_defect.py --id VS-01 --status Complete --comment "..."
python .claude/skills/defect-tracker-update/update_defect.py --id T-05 --status "In Progress"
python .claude/skills/defect-tracker-update/update_defect.py --id E-02 --status Blocked --comment "blocked by ..."
```

The xlsx must be **closed in Excel** before running, or the save fails (file lock).
Requires `openpyxl` (already available in this environment).

## Checklist before you say a defect is done

- [ ] Read AC (col K) and addressed every criterion
- [ ] Verified AC against the real app/DB/code — not assumed
- [ ] Agent Status = Complete (or Blocked, with reason) via the helper script
- [ ] State cell is the right colour (helper does this — confirm green for Complete)
- [ ] Resolution + AC evidence written to Pending Review Comments (col E)
- [ ] Review Status left as Pending Review for the human
