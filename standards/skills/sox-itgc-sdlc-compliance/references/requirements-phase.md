# Requirements Phase — SOX Gate

**Purpose:** decide *whether* the system is financially significant, *which financial-statement
assertions* it touches, and *which ITGC and application controls* it must satisfy — before a line of
design exists. The most expensive SOX failures are scoping failures: a feeder to the GL that was
never recognized as in-scope, an automated posting with no testable control, or records with no
retention plan.

## Checklist

### A. Financial-significance determination
- [ ] Confirm the STEP 0 result: is the system an SEC-registrant system that is **financially
      significant** or **feeds ICFR**? Meridian's standing in-scope set is **General Ledger, Policy
      Admin, Claims, Billing**, plus the integration bus and batch jobs feeding the GL.
- [ ] If it touches premium, claims, reserves, reinsurance, billing, or any GL posting → in scope.
- [ ] Record the determination (rationale + date). A "not significant" call must still note any
      other regime (NYDFS, GDPR) that applies.
- **Evidence:** financial-significance memo in the SOX Control Record.

### B. Financial-statement assertion map
- [ ] For each financial flow the system supports, state the **assertions** at risk: completeness,
      accuracy, validity/existence, cut-off, and **restricted access**.
- [ ] Note where an **automated application control** (calculation, posting, interface) carries an
      assertion — these become APP-01 / APP-02 scope.
- **Evidence:** assertion map (flow → assertion → control id).

### C. Access-control requirements (ITGC Access)
- [ ] Capture who needs access and at what privilege; require **approval before grant** (AC-01) and a
      **deprovisioning SLA** for leavers (AC-05) as acceptance criteria.
- [ ] Flag any role pairing that would create a **segregation-of-duties conflict** on financial roles
      (AC-04) — record the conflicting duties so the design can prevent or mitigate them.
- [ ] Note that access will be subject to **quarterly recertification** (AC-02) and that any
      privileged access will be **logged and independently reviewed** (AC-03).
- **Evidence:** access requirements + SoD conflict list captured as testable acceptance criteria.

### D. Change-governance requirements (ITGC Change)
- [ ] Require that production changes are **approved before promotion** (CM-01) and that **authors
      cannot approve or deploy their own changes** (CM-02).
- [ ] Define the **emergency-change** path: it may bypass pre-approval but must have a
      post-implementation review and retroactive approval (CM-03).
- **Evidence:** change-governance acceptance criteria.

### E. Operations requirements (ITGC Operations)
- [ ] Identify **financially-relevant batch jobs** the system runs; require monitoring, alerting on
      failure, and failure resolution (OP-01).
- [ ] Require that the system is **backed up** and that **restores are periodically tested** (OP-02).
- **Evidence:** list of financially-relevant jobs + backup/restore requirement.

### F. Automated application control requirements
- [ ] For each automated calculation or posting (e.g., **premium-to-GL**), require that it be
      **independently recalculable** with no unexplained variance (APP-01).
- [ ] For each financially-significant **interface**, require **record-count and control-total
      reconciliation** between sender and receiver (APP-02).
- **Evidence:** application-control requirements with the recalculation/tie-out expectation.

### G. Records-retention requirements (§802)
- [ ] Identify the financial records the system will hold and require an enforced retention policy
      meeting the **7-year** statutory minimum, **legal-hold** support, and a **deletion-audit trail**
      (RET-802-01).
- **Evidence:** retention requirement + record categories in the SOX Control Record.

## Insurance-specific prompts
- **Premium** revenue postings and **claims** disbursements are high-risk completeness/accuracy
  surfaces → APP-01 and the interface tie-out (APP-02) almost always apply.
- **Reserving and reinsurance** feeds into the GL → confirm whether the system is a feeder even if it
  is "actuarial," not "finance."
- Quarter-end and year-end **batch close** jobs are the classic OP-01 surface.

## Controls in scope at this gate
Scoping inputs to **AC-01, AC-04, AC-05, CM-01, CM-02, CM-03, OP-01, OP-02, APP-01, APP-02,
RET-802-01,** and the matrix row in **ELC-404-01.**

## Exit criteria
Requirements gate is complete when the SOX Control Record contains: the financial-significance memo,
the assertion map, access/change/operations/application-control acceptance criteria, the SoD conflict
list, and the retention requirement — and each in-scope `controls/` id is bound to the system.
Anything missing blocks design sign-off.
