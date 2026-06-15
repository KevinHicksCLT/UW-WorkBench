# Technical-Debt Backlog — SOX

Generated 2026-06-30T02:00:00Z by the Cascade Control Framework from 15 controls.
**7 debt items** — Critical: 1, High: 2, Medium: 2, Low: 2.

Each item is a concrete, ownable unit of work that, once closed, raises automation or evidence coverage and moves a control from "asserted" to "continuously evidenced".

## Failed Control (3)

| ID | Control | Severity | Description | Recommended action |
|---|---|---|---|---|
| TD-SOX-ITGC-AC-03-1 | SOX-ITGC-AC-03 | Critical | Control failed: Every privileged account was reviewed.; 100% privileged review coverage.. | Open remediation issue, fix root cause, capture evidence, and retest. |
| TD-SOX-ELC-404-01-2 | SOX-ELC-404-01 | Medium | Control raised a warning. | Investigate the warning threshold breach before it escalates. |
| TD-SOX-ITGC-CM-03-1 | SOX-ITGC-CM-03 | Medium | Control raised a warning. | Investigate the warning threshold breach before it escalates. |

## Stale Downstream (1)

| ID | Control | Severity | Description | Recommended action |
|---|---|---|---|---|
| TD-SOX-ITGC-AC-03-2 | SOX-ITGC-AC-03 | High | Downstream artifact "icfr-2026Q2-ac03" is Blocked. | Revalidate the control and refresh the downstream linkage. |

## Missing Evidence (1)

| ID | Control | Severity | Description | Recommended action |
|---|---|---|---|---|
| TD-SOX-ITGC-OP-02-2 | SOX-ITGC-OP-02 | High | Required evidence "restore_test_record" was not captured. | Wire sharepoint://controls/sox/itgc-operations so "restore_test_record" is stored immutably with the run. |

## Manual Control (2)

| ID | Control | Severity | Description | Recommended action |
|---|---|---|---|---|
| TD-SOX-ELC-404-01-1 | SOX-ELC-404-01 | Low | Control is partially automated (automation_level=Partial). | Close the manual gap so the full assertion set runs automatically. |
| TD-SOX-ITGC-OP-02-1 | SOX-ITGC-OP-02 | Low | Control is partially automated (automation_level=Partial). | Close the manual gap so the full assertion set runs automatically. |
