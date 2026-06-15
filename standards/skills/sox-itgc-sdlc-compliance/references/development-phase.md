# Development Phase — SOX Gate

**Purpose:** implement the designed controls *and instrument them so they emit auditable proof*. A
control that works but leaves no timestamped, retrievable record still fails SOX — the external
auditor under AS 2201 will ask to re-perform or inspect it, and the §302/§404 support depends on it.

## Checklist

### A. Access provisioning in code (ITGC Access)
- [ ] Implement provisioning so every grant to an in-scope system **records the approving ticket** and
      the approval timestamp precedes the grant (AC-01).
- [ ] Ensure provisioning/deprovisioning events write to the IAM audit feed so leaver revocations and
      the recertification population are reconstructable (AC-02, AC-05).
- [ ] Route privileged-account activity to the **SIEM** so it can be independently reviewed (AC-03).
- **Evidence:** provisioning code + the grant/approval log entries it emits.

### B. Change controls in the pipeline (ITGC Change)
- [ ] Enforce **branch protection** on protected branches so a merge requires an approval from
      **someone other than the author** (CM-02).
- [ ] Wire the pipeline so a production deployment requires a recorded **approval before promotion**
      (CM-01) and the **deploying actor is never the change author** (CM-02).
- [ ] Implement the **emergency-change** workflow so an expedited deploy creates the change record,
      and trigger the **post-implementation review** and retroactive approval (CM-03).
- **Evidence:** branch-protection config, merge-approver log, deployment-actor log, emergency-change
  records — all linked from the PR/change record.

### C. Automated application controls in code
- [ ] Implement the **premium-to-GL posting** to the agreed configuration and emit the data needed to
      **independently recalculate** posted amounts (source transactions + calculation config export)
      with a reconciliation/variance output (APP-01).
- [ ] Implement interface transmission so both sender and receiver capture **record counts and control
      totals**, and emit the reconciliation report (APP-02).
- **Evidence:** posting/interface code mapped to APP-01/APP-02, recalculation workpaper inputs,
  control-total logs.

### D. Operations instrumentation (ITGC Operations)
- [ ] Implement job monitoring so financially-relevant batch failures **raise an alert** and open an
      incident (OP-01).
- [ ] Ensure backup jobs log success/failure to the monitored feed (OP-02).
- **Evidence:** alerting hooks + job/backup log output.

### E. Records-retention enforcement (§802)
- [ ] Apply the retention policy binding to in-scope repositories, wire **legal-hold** enforcement,
      and ensure deletion events are logged to the **deletion audit** (RET-802-01).
- **Evidence:** retention configuration + deletion-audit log output.

### F. Audit logging (the evidence engine)
- [ ] Every access grant, change approval, deployment, automated posting, interface run, and deletion
      emits an **immutable, timestamped** record to the evidence repository named in the control.
- [ ] Logs reference ids, not sensitive payloads; they must be sufficient to **reconstruct and
      re-perform** the control.
- **Evidence:** sample log lines demonstrating reconstructability.
- **Anti-pattern:** a control that is enforced only by convention with no emitted record — for audit
  purposes it did not run.

## Code-review gate
- [ ] PR template includes SOX criteria; the reviewer (not the author) confirms approval-before-grant,
      no self-approval/self-deploy, reconciliation outputs, and audit logging before approval.
- **Evidence:** PR approval that explicitly cites the SOX control ids (not a bare "LGTM"), recorded by
  a reviewer who is not the author (this *is* CM-02 in action).

## Controls in scope at this gate
**AC-01, AC-02, AC-03, AC-05, CM-01, CM-02, CM-03, OP-01, OP-02, APP-01, APP-02, RET-802-01.**

## Exit criteria
Development gate is complete when each designed control has corresponding code, the code emits
timestamped audit evidence to the right repository, branch protection enforces author/approver
independence, and PRs were approved against SOX criteria by a non-author — all linked from the SOX
Control Record.
