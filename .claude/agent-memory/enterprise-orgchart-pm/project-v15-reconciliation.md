---
name: project-v15-reconciliation
description: v15 spreadsheet reconciliation results — what changed vs v12/v13, what was fixed, and what remains open
metadata:
  type: project
---

## v12/v13 → v15 reconciliation (completed 2026-06-01)

**What changed:**
1. **Domain taxonomy:** v15 has 13 raw VS domains in Sub-Value Streams sheet. The transform collapses them to 6 consolidated domains (CLEAN_DOMAIN map in transform-workbook.ts). The 6 consolidated domains are: Core Insurance, Distribution & Customer, Technology & Data, Finance & Actuarial, Risk Compliance & Audit, Corporate & Enterprise.
2. **Categories:** Expanded from 19 → 40 in v15 (21 new categories for BA/PO/Data Engineering roles including Discovery & Business Understanding, Requirements Elicitation, Architecture Strategy & Alignment, etc.).
3. **higherCategory field added to Division:** New field "Core Business" | "IT" | "Corporate Function" derived from Org Chart View 2. This is the CEO-facing top-level grouping. Seeds from HIGHER_CAT map in seed.ts.
4. **Process step VS name reconciliation:** The E2E Process Flows sheet uses abbreviated VS names that differ from canonical names. Fixed via PROCESS_VS_MAP in transform-workbook.ts. This fixed 256 process steps linking correctly (was 120 before fix).
5. **Checklist items:** 3337 → 4743 (spine now seeds ALL items from Items sheet, not a subset).
6. **Role tasks:** Stable at 4743.

**What stayed the same:**
- 14 divisions, 26 value streams, 104 sub-value streams, 243 KPIs, 835 I/O items, 27 external interactions
- 159 org-chart roles + 84 extended = 244 total
- Company name: Meridian Insurance Group

**Ambiguities surfaced (not silently picked):**
1. 4 roles have null higherCategory in Org Chart View 2 (data omissions): Product Filing Specialist, Competitive Intelligence Analyst, Coverage Analyst → inferred IT; Subrogation / Litigation Specialist → inferred Core Business. Not stored — omitted roles fall through to null.
2. Cloud Architect, Enterprise Architect, Solution Architect: have individual sheets but NOT in org chart. Auto-added from Value Streams participation with no division/checklist. This is correct per data.
3. Domain taxonomy consolidation: 13 raw → 6 cleaned (judgment call inherited from v13 transform). Document this to revisit if CEO wants 13-domain view.

**Why:** CEO org-chart app was seeded from v12/v13; v15 is the new authoritative source. Reconciliation needed to match data exactly.

**How to apply:** When updating the workbook (v16+), run `npx tsx backend/scripts/transform-workbook.ts <workbook>.xlsx`, verify counts match, then `SEED_FORCE=1 npm run db:seed -w cascade-backend`.
