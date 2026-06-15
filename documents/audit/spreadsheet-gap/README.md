# Spreadsheet & Document Gap Analysis (2026-06-09)

This folder is the **single, self-contained defect list** from comparing the live app to the **spreadsheet source of truth** (`IT_Roles_Analytics_v16.xlsx` + `standards_extended/`) and the **Shibumi blueprint**.

> ⚠️ **Kept SEPARATE from yesterday's application-defect backlog** (`../02_backlog.md` / `../review-board.html`, 43 findings), which another agent is already implementing. Do not merge or double-implement. Overlapping symptoms (health roll-up, stale roll-ups) are cross-noted here but should be fixed in only one backlog.

## Files
- **`gap-review-board.html`** — open in a browser. Accept/Decline/Defer each finding, filter by area/severity/status, then **Build accepted backlog** to export markdown for a coding agent. Decisions persist in your browser.
- **`gap_backlog.md`** — the full story backlog (Evidence → Why → Fix → Approach → Acceptance). 32 actionable + 1 resolved.
- **`gap_evidence.md`** — the proof base: source-of-truth counts, live app numbers, the standards reconciliation, and the Initiatives-vs-Shibumi walkthrough.

## Headline
- **33 findings:** 12 High, 15 Medium, 5 Low, +1 Resolved.
- **Standards = NOT a defect (S7):** app 408 / Cyber 113 = workbook 343/48 **+** `standards_extended` (GDPR 21 + CCPA 22 + NYDFS 22 = 65). Reconciles exactly — do not "fix" it.
- **Value streams inverted:** vs the source, **Telemetry's 29 is correct**; the **Value Streams tab's 21 is the wrong/incomplete one** (S1/S2/X3).
- **Biggest divergences:** roles 240 vs 159 (S4), people 717/743 vs 159 FTE with offshore/contingent splits absent from source (S5), process taxonomy 43/256 vs 131/711 (S3), generic task templates vs 4,743 source role-tasks (DT1).
- **Initiatives vs Shibumi:** missing Strategic Alignment, Charter, Initiative KPIs, Resources; no Scenario module, EPMO roll-up, Gantt, or Presentations/PDF (I1–I14).
