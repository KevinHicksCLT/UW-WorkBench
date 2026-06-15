# Audit Evidence Map — SOX ITGC, Application & Entity-Level Controls

The artifact to hand the external auditor (PCAOB **AS 2201** fieldwork) and the one the §302
sub-certifiers and the §404 assessment team should review **before each quarterly certification
cycle closes**. It crosswalks every control to its SOX/COSO citation, the SDLC gate (or Run owner)
that enforces it, the evidence it leaves, the **retention**, and the live telemetry signal.

## How to read it
- **Control** — the id in `../controls/<id>.control.json`. **Citation** — the control's
  `regulatory_mapping.citation`. **Gate/Owner** — the control's `sdlc_gates` (SDLC) or the Run owner
  (`control_owner.primary_role`).
- **Evidence artifact(s)** — the control's `required_evidence.artifacts` (the stored proof).
  **Retention** — `required_evidence.retention_period` (7 years across the pack; §802 / 17 CFR
  210.2-06).
- **Telemetry signal** — the ongoing metric for the app's Telemetry tab, derived from the control's
  pass assertions.

| Control | Citation | Gate / Owner | Evidence artifact(s) | Retention | Telemetry signal |
|---|---|---|---|---|---|
| SOX-ITGC-AC-01 | SOX 404 · COSO P11 · ITGC-Access-Provisioning | Design/Dev/Run · IT Security Manager | grant_event_population; approval_ticket_export; reconciliation_exception_log | 7y | unapproved grants (target 0); approval coverage % |
| SOX-ITGC-AC-02 | SOX 404 · COSO P11 · ITGC-Access-Recertification | Run · IT Security Manager | recertification_campaign_export; reviewer_signoff; revocation_log | 7y | recertifications completed %; overdue count |
| SOX-ITGC-AC-03 | SOX 404 · COSO P11 · ITGC-Access-Privileged | Run · IT Security Manager | pam_account_inventory; privileged_activity_log; review_signoff | 7y | unreviewed privileged accounts (0); privileged actions logged % |
| SOX-ITGC-AC-04 | SOX 404 · COSO P11 · ITGC-Access-SoD | Design/Run · IT Security Manager | sod_ruleset; conflict_report; mitigation_log | 7y | unmitigated SoD conflicts (0); total conflicts vs. tolerance |
| SOX-ITGC-AC-05 | SOX 404 · COSO P11 · ITGC-Access-Deprovisioning | Run · Access Administrator | termination_feed_export; revocation_evidence; exception_log | 7y | leaver revocation-within-SLA %; open leaver accounts (0) |
| SOX-ITGC-CM-01 | SOX 404 · COSO P11 · ITGC-Change | Dev/Test/Run · Release Manager | change_ticket_export; pr_approval_log; cab_minutes | 7y | changes without approval (0); approval coverage % |
| SOX-ITGC-CM-02 | SOX 404 · COSO P11 · ITGC-Change-SoD | Dev/Test/Run · Release Manager | branch_protection_config; merge_approver_log; deploy_actor_log | 7y | self-approved merges (0); self-deploys (0) |
| SOX-ITGC-CM-03 | SOX 404 · COSO P11 · ITGC-Change-Emergency | Dev/Run · Release Manager | emergency_change_log; retro_approval; post_implementation_review | 7y | emergency changes without post-review (0); retro-approved % |
| SOX-ITGC-OP-01 | SOX 404 · COSO P11 · ITGC-Operations | Run · IT Operations Manager | job_schedule_export; failure_alert_log; resolution_tickets | 7y | unresolved job failures (0); failure-alerting % |
| SOX-ITGC-OP-02 | SOX 404 · COSO P11 · ITGC-Operations-Backup | Run · IT Operations Manager | backup_job_log; restore_test_record | 7y | backup success %; restore test performed this cycle |
| SOX-APP-01 | SOX 404 · COSO P13 · Automated Application Control | Design/Dev/Test/Run · Financial Systems Analyst | calc_config_export; recalculation_workpaper; variance_report | 7y | recalculation match %; unexplained posting variance ($0) |
| SOX-APP-02 | SOX 404 · COSO P13 · Automated Application Control | Design/Dev/Test/Run · Financial Systems Analyst | interface_control_totals; reconciliation_report; exception_resolution_log | 7y | unreconciled interface records (0); control-total variance ($0) |
| SOX-ELC-302-01 | SOX 302 · SEC Rule 13a-14 · Disclosure Controls | Run · Controller (approval CFO) | subcertification_questionnaire; signed_subcertifications; disclosure_committee_minutes | 7y | sub-certifications received %; overdue count |
| SOX-ELC-404-01 | SOX 404 · PCAOB AS 2201 · COSO 2013 | Run · SOX Program Manager (approval CFO) | control_matrix; test_workpapers; deficiency_log | 7y | key controls without owner (0); key controls tested %; unremediated deficiencies |
| SOX-RET-802-01 | SOX 802 · SOX 103 · 17 CFR 210.2-06 | Design/Run · Records Manager (approval GC) | retention_policy; legal_hold_register; deletion_audit_log | 7y | retention policy applied %; premature deletions (0); retention period ≥ 7y |

> **The audit principle in one line:** the certification is the signature; the controls are the
> spine; the evidence keeps the spine upright. Build the evidence as a by-product of delivery, run the
> controls every cycle, and the §302/§404 certifications and the AS 2201 attestation rest on a live
> dashboard rather than a quarter-end document hunt.

---

## SOX Control Record — template

Maintain one per financially-significant system/feature. The four gates write into it; the framework
runs the bound controls into it.

```
# SOX Control Record — <system/feature name>
Control owner (IT): <name>     SOX program contact: <name>     Delivery lead: <name>
Status: <Req | Design | Dev | Test | Live>     Cycle: <e.g., 2026-Q2>     Last updated: <date>

## Scope determination (STEP 0)
- SEC registrant / SOX-equivalent? <yes/no — basis>
- Financially significant / ICFR feeder? <yes/no — which assertions>
- In-scope systems touched: <GL / Policy Admin / Claims / Billing / Integration Bus / batch>
- Bound controls: <AC-.., CM-.., OP-.., APP-.., RET-802-01, ELC-404-01 row>

## Requirements gate
- Financial-significance memo: <link>
- Assertion map (flow → assertion → control): <link>
- Access / change / operations / app-control acceptance criteria: <link>
- SoD conflict list (AC-04): <link>     Retention requirement (§802): <link>

## Design gate
- SoD-aware role & access-approval model (AC-01, AC-03, AC-04, AC-05): <link>
- Change-governance / branch-protection design (CM-01, CM-02, CM-03): <link>
- Operations monitoring + backup/restore design (OP-01, OP-02): <link>
- Application-control design — recalculation + control totals (APP-01, APP-02): <link>
- Retention / legal-hold / deletion-audit design (RET-802-01): <link>
- Control-to-evidence mapping: <link>

## Development gate
- Control → code map: <link>
- Branch-protection config + merge/deploy actor logs (CM-02): <link>
- Provisioning/approval logs (AC-01): <link>
- Recalculation + interface control-total outputs (APP-01, APP-02): <link>
- Retention config + deletion-audit output (RET-802-01): <link>
- PR approvals by a non-author citing SOX criteria: <link>

## Testing gate
- Passing assertion results per control (with timestamps): <link>
- Negative-case results (unapproved grant, self-approval, dropped record, held-record deletion): <link>
- Restore-test record (OP-02): <link>
- Traceability matrix + CI gate config: <link>
- Generated registry.json / evidence-pack.md: <link>

## Run / program handoff
- Quarterly recertification owner (AC-02): <name>     Privileged-review owner (AC-03): <name>
- §302 sub-certification feed (ELC-302-01): <link>
- §404 control-matrix row + key-control testing (ELC-404-01): <link>
- §802 retention upkeep owner (RET-802-01): <name>
- External-auditor (AS 2201) evidence-pack feed: <link>
- Telemetry signals wired: <list>

## Sign-offs
- IT control owner: <name/date>   Financial Systems Analyst: <name/date>
- SOX Program Manager / Controller: <name/date>   Delivery lead: <name/date>
```

## Wiring into Transformation Bridge
- The **Standards** area holds the 15 SOX standards (the *what*) under **Finance & Accounting →
  Sarbanes-Oxley (ITGC & ICFR)**.
- This record + crosswalk are the *evidence layer*. The deeper, machine-testable definitions live in
  `../controls/` and are run by the **Cascade Control Framework** (`../../../control-framework/`),
  which emits `registry.json`, `evidence-pack.md`, and `tech-debt-backlog.md`.
- Attach the record to the relevant **Initiative / Deliverable** and surface the telemetry signals on
  the **Telemetry** tab so the §302/§404 certification cycle is backed by a live dashboard.
