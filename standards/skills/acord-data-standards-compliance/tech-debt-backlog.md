# Technical-Debt Backlog — ACORD

Generated 2026-06-30T02:00:00Z by the Cascade Control Framework from 12 controls.
**6 debt items** — Critical: 1, High: 2, Medium: 2, Low: 1.

Each item is a concrete, ownable unit of work that, once closed, raises automation or evidence coverage and moves a control from "asserted" to "continuously evidenced".

## Failed Control (3)

| ID | Control | Severity | Description | Recommended action |
|---|---|---|---|---|
| TD-ACORD-FORM-02-1 | ACORD-FORM-02 | Critical | Control failed: No superseded ACORD form versions remain in use.. | Open remediation issue, fix root cause, capture evidence, and retest. |
| TD-ACORD-DICT-01-2 | ACORD-DICT-01 | Medium | Control raised a warning. | Investigate the warning threshold breach before it escalates. |
| TD-ACORD-PC-03-1 | ACORD-PC-03 | Medium | Control raised a warning. | Investigate the warning threshold breach before it escalates. |

## Missing Source (1)

| ID | Control | Severity | Description | Recommended action |
|---|---|---|---|---|
| TD-ACORD-API-02-1 | ACORD-API-02 | High | Source "Schema Registry" (Schema Registry) is not reachable via API. | Stand up the API connector for Schema Registry so this control can be evidenced automatically. |

## Stale Downstream (1)

| ID | Control | Severity | Description | Recommended action |
|---|---|---|---|---|
| TD-ACORD-FORM-02-2 | ACORD-FORM-02 | High | Downstream artifact "filing-2026-forms" is Blocked. | Revalidate the control and refresh the downstream linkage. |

## Manual Control (1)

| ID | Control | Severity | Description | Recommended action |
|---|---|---|---|---|
| TD-ACORD-DICT-01-1 | ACORD-DICT-01 | Low | Control is partially automated (automation_level=Partial). | Close the manual gap so the full assertion set runs automatically. |
