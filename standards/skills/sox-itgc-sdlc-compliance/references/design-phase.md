# Design Phase — SOX Gate

**Purpose:** bake the IT general controls and automated application controls into the architecture so
they are **preventive where possible and testable always**. Design is where segregation of duties,
approval gates, reconciliation points, and retention enforcement become concrete — and where the
evidence each control will leave is decided.

## Checklist

### A. Access & identity architecture (ITGC Access)
- [ ] Define a **least-privilege, role-based** access model for the financially-significant system.
- [ ] Design the **approval-before-grant** path so every provisioning event references an approved
      request dated on or before the grant (AC-01).
- [ ] Design the **segregation-of-duties ruleset** into the role set: identify conflicting duty pairs
      (e.g., initiate vs. approve a financial transaction) and ensure the roles cannot co-exist on one
      user without a documented mitigation (AC-04).
- [ ] Design **privileged accounts** to be inventoried, time-bound/elevated-on-demand, and **logged to
      the SIEM** so they can be independently reviewed (AC-03).
- [ ] Design **joiner-mover-leaver** handling so termination triggers revocation within SLA (AC-05) and
      so the population is reviewable each quarter (AC-02).
- **Evidence:** SoD-aware role model, access-approval design, privileged-access/logging design.

### B. Change-management architecture (ITGC Change)
- [ ] Design **branch protection** and a deployment pipeline that **requires approval before promotion**
      to production (CM-01) and **prevents an author from approving or deploying their own change**
      (CM-02).
- [ ] Design the **emergency-change** path: expedited deploy is allowed, but it must create the
      records that enable a post-implementation review and retroactive approval (CM-03).
- **Evidence:** change-governance design + branch-protection configuration intent.

### C. Operations architecture (ITGC Operations)
- [ ] Design **monitoring and alerting** for every financially-relevant batch job so failures raise an
      alert that routes to an incident with a resolution path (OP-01).
- [ ] Design **backups** for the financially-significant data and a **periodic restore test** with a
      documented result (OP-02).
- **Evidence:** operations monitoring + backup/restore design.

### D. Automated application controls (the heart of accuracy)
- [ ] Design the **automated premium-to-GL posting** so the posted amount can be **independently
      recalculated** from policy-administration source data and the calculation/posting configuration
      is exportable for re-performance (APP-01).
- [ ] Design every financially-significant **interface** to carry **record counts and control totals**
      that the receiving system records, enabling a tie-out to zero variance (APP-02).
- [ ] Decide where reconciliation outputs and variance reports are written and retained.
- **Evidence:** application-control design notes (recalculation approach, control-total tie-out
  design, evidence destinations).

### E. Records retention & legal hold (§802)
- [ ] Design the records repository to **enforce the 7-year minimum** retention on in-scope financial
      records, support **legal holds** that suspend disposition, and emit a **deletion-audit trail** so
      premature deletion is detectable (RET-802-01).
- **Evidence:** retention/legal-hold/deletion-audit design.

### F. Evidence & traceability design
- [ ] For each in-scope control, confirm **where** its required evidence artifacts will be stored
      (the control's `required_evidence.evidence_repository`) and that artifacts will be
      **timestamped, sign-off-able, and retained 7 years**.
- [ ] Design control activity to emit the **machine-checkable signals** the control's assertions need
      (e.g., grant events vs. approvals, merge author vs. approver, source vs. GL control totals).
- **Evidence:** control-to-evidence mapping in the SOX Control Record.

## Insurance-specific prompts
- The **premium-to-GL** posting design is the single highest-value control surface — design it for
  independent recalculation from day one, not as an afterthought.
- Integration-bus interfaces between policy admin, billing, claims, and the GL are the classic
  control-total tie-out surface (APP-02) — design the totals in, both sides.

## Controls in scope at this gate
**AC-01, AC-03, AC-04, AC-05, CM-01, CM-02, CM-03, OP-01, OP-02, APP-01, APP-02, RET-802-01.**

## Exit criteria
Design gate is complete when the SOX Control Record holds: the SoD-aware access model, the
change-governance/branch-protection design, the operations monitoring + backup/restore design, the
application-control (recalculation + control-total) design, the retention/legal-hold/deletion-audit
design, and a control-to-evidence mapping for every in-scope control. Anything missing blocks build.
