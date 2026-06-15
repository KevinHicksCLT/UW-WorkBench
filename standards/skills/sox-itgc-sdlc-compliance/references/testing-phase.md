# Testing Phase — SOX Gate

**Purpose:** prove each control operates — including the **negative** cases — and that its
**assertions pass** against real or fixture data. Tests are the most auditor-legible evidence you
have: each should map to a control id and pass with a timestamp, and each control's
`validation.assertions` should evaluate cleanly. This is the artifact you hand the external auditor
(AS 2201) and the §302 sub-certifier first.

## Test families (map each test to a control id)

### A. Access controls (ITGC Access)
- [ ] **AC-01:** every in-scope grant traces to a prior approval — assert `unapproved_grant_count = 0`
      and `approval_coverage_pct ≥ 100`; include a negative test (an unapproved grant is flagged).
- [ ] **AC-02:** the quarterly recertification population is 100% completed with **0 overdue** and a
      signed reviewer attestation exists.
- [ ] **AC-03:** every privileged account was independently reviewed (`unreviewed_privileged_accounts
      = 0`) and privileged actions are captured in the SIEM.
- [ ] **AC-04:** the SoD ruleset flags conflicts; assert `sod_conflicts_unmitigated = 0` and total
      conflicts within tolerance, each conflict tracing to an approved mitigation.
- [ ] **AC-05:** all leavers revoked within SLA (`leaver_access_revoked_within_sla_pct ≥ 100`) and
      **0 open leaver accounts**; negative test: a terminated user still active is flagged.
- **Evidence:** access test cases + passing assertion results with timestamps.

### B. Change controls (ITGC Change)
- [ ] **CM-01:** every production change traces to a prior approval (`changes_without_approval = 0`).
- [ ] **CM-02:** no self-approved merges and **no author-deployed releases** — assert
      `self_approved_merges = 0` and `self_deploys = 0`; negative test: a self-approval is rejected by
      branch protection.
- [ ] **CM-03:** every emergency change has a post-implementation review
      (`emergency_changes_without_postreview = 0`) and retroactive-approval coverage is tracked.
- **Evidence:** change test results + branch-protection enforcement evidence.

### C. Operations controls (ITGC Operations)
- [ ] **OP-01:** no unresolved financially-relevant job failures (`failed_jobs_unresolved = 0`) and
      failure alerting is verified; negative test: an injected job failure raises an alert and an
      incident.
- [ ] **OP-02:** all in-scope backups succeeded (`backup_success_rate_pct ≥ 100`) and a **restore test
      was performed and documented this cycle** (`restore_test_performed = 1`).
- **Evidence:** job/backup test results + the restore-test record.

### D. Automated application controls
- [ ] **APP-01:** independently recalculate posted premium amounts and reconcile to the GL — assert
      `recalculation_match_pct ≥ 100` and `posting_variance_amount ≤ 0` (no unexplained variance);
      negative test: an injected config defect produces a detectable variance.
- [ ] **APP-02:** reconcile interface record counts and control totals — assert
      `unreconciled_interface_records = 0` and `control_total_variance ≤ 0`; negative test: a dropped
      record is detected by the tie-out.
- **Evidence:** recalculation workpaper, variance report, interface reconciliation report.

### E. Records retention (§802)
- [ ] **RET-802-01:** retention policy applied to 100% of in-scope repositories, configured period
      `≥ 7 years`, and **0 premature deletions**; negative test: an attempted deletion of a held
      record is blocked and logged.
- **Evidence:** retention-config test + deletion-audit assertion results.

## Running the controls and wiring CI
- [ ] Execute each control's `validation.test_script` (`tests/<CONTROL_ID>.test.mjs`) and confirm the
      run record is schema-valid and the rolled-up status matches the fixture's `expected_status`.
- [ ] Run the whole pack: `node --test "standards/skills/sox-itgc-sdlc-compliance/tests/*.test.mjs"`,
      and the full report: `node standards/control-framework/cli/report.mjs sox`.
- [ ] Wire control runs into CI so a **failing SOX control blocks release** of a financially-significant
      system (treat like a critical gate).
- **Evidence:** passing test output, the generated `registry.json` / `evidence-pack.md`, and the CI
  gate configuration.

## Coverage & traceability
- [ ] Maintain a **traceability matrix**: requirement → design decision → code → test → control run →
      stored evidence. An auditor should be able to pick any control id (or any §302/§404 assertion)
      and walk it to a passing, timestamped run.
- **Evidence:** traceability matrix in the SOX Control Record.

## Controls in scope at this gate
**AC-01, AC-02, AC-03, AC-04, AC-05, CM-01, CM-02, CM-03, OP-01, OP-02, APP-01, APP-02, RET-802-01.**

## Exit criteria
Testing gate is complete when every in-scope control has mapped, passing, timestamped assertion
results; the negative cases are exercised; the traceability matrix is complete; the framework report
runs clean; and SOX control runs are wired into CI as release-blocking. This matrix and the
evidence pack are what management and the external auditor see first.
