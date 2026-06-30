# L5 Process Delta — new-data-model DB vs `v7_062226` workbook

**Date:** 2026-06-29
**DB:** Neon `new-data-model` (`ep-wandering-water`), company *ABC Insurance*
**Workbook:** `ABC-Insurance-Operating-Model-v7_062226.xlsx` → sheet `L5 Process List`
**Detail spreadsheet:** [`L5-Delta_DB-vs-v7sheet.xlsx`](L5-Delta_DB-vs-v7sheet.xlsx)

## Headline

| | DB (new-data-model) | Workbook v7 |
|---|---|---|
| **L5 count** | **3,787** | **8,355** |
| L4 sub-processes | 865 | 867 |
| L3 processes | 134 | 135 |
| L2 divisions | 17 | 17 |
| avg L5 per L4 | ~4.4 | ~9.6 |

## The key finding — they are NOT the same L5 set reworded once

The two share **almost the same L1–L4 skeleton** (~856 common L4 sub-processes), but the
**L5 leaves were authored independently**:

- L5 steps matching by **exact text** (within the same L4): **2 of 8,355**.
- The wording is *semantically parallel but textually disjoint*. Example — same L4
  "Technology Strategy & Roadmap Planning":
  - DB: *"Sequence initiatives into a multi-year technology roadmap"*
  - Sheet: *"Define multi-year technology roadmap aligned to business objectives"*

So this is **not** a clean "N rows are missing, append them" delta. It is two parallel
authorings of the same process tree, the workbook one being ~2× deeper.

## What "missing" means

| Bucket | Count |
|---|---|
| Workbook L5 not in DB (by text) | 8,353 |
| &nbsp;&nbsp;…under an L4 that **exists** in DB (extra depth on known sub-processes) | 8,259 |
| &nbsp;&nbsp;…under a **new** L4 (10 sub-processes the DB lacks) | 94 |
| DB L5 not in workbook | 3,785 |
| L4 sub-processes only in sheet | 10 |
| L4 sub-processes only in DB | 8 |

## Decision

Because text overlap is ~0, you have three real options — not a simple merge:

1. **Keep 3,787 (DB as-is).** The DB L5 set is the curated "grounded 3,811-task" rebuild
   (per project history). Tighter, already wired to roles/deliverables/apps.
2. **Replace with ~8,355 (adopt workbook).** Richer (≈2× depth), but you re-author every
   L5 leaf and must **re-wire** all L5→role/deliverable/app/checklist junctions (the
   workbook leaves have no DB IDs). Heavy migration.
3. **Straight append → ~12,140 L5.** Do **not** do this blindly: because the two leaf sets
   cover the same L4s with different words, you get massive *conceptual* duplication
   (every common L4 ends up with both its ~4 DB steps and its ~10 workbook steps). Only
   viable after a **semantic dedup** pass per L4.

**Recommendation:** if the goal is depth, option 2 (replace per-L4 with the workbook leaves)
is cleaner than appending, but budget for re-wiring junctions. If junction wiring matters
more than leaf count, keep the DB set. See the **By-L4 comparison** tab to decide per
sub-process where the extra workbook depth is actually worth adopting.

## Spreadsheet tabs

- **Summary** — the numbers above.
- **By-L4 comparison** — all 875 L4s with DB vs sheet L5 counts + delta (the actionable view).
- **Sheet L5 missing from DB** — full 8,353-row list, with L1–L4 path.
- **DB L5 not in workbook** — full 3,785-row list.
- **Structure deltas** — the 10 sheet-only / 8 DB-only L4s and L3 differences.
