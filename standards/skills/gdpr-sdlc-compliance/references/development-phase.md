# Development Phase — GDPR Gate

**Purpose:** implement the designed controls *and instrument them so they emit proof*. Code that
protects privacy but leaves no audit trail still fails the accountability test (Art. 5(2)).

## Checklist

### A. Minimisation in code (Art. 5)
- [ ] Persist only the fields with a documented purpose; drop the rest at the boundary.
- [ ] **No personal data in logs, URLs/query strings, error messages, or analytics by default**
      (aligns with the existing "no sensitive data in URLs" API standard).
- [ ] Non-production environments use masked, tokenised, or synthetic data — never raw production PII.
- **Evidence:** code references + secret/PII-scan results.

### B. Data-subject-rights endpoints
- [ ] Implement DSAR/access (Art. 15): assemble a subject's data + processing metadata.
- [ ] Implement erasure (Art. 17): delete across primary stores, caches, logs, indexes, and call
      processor deletion APIs; record what was deleted and when.
- [ ] Implement portability (Art. 20): structured machine-readable export.
- [ ] Implement rectification/restriction/objection (16/18/21) as enforceable flags honoured by all
      consumers (including batch and streaming jobs).
- **Evidence:** code mapped to each right + the audit log entries the operations emit.

### C. Consent (Art. 7)
- [ ] Store consent records with subject id, purpose, timestamp, and notice version.
- [ ] Withdrawal path is implemented and stops downstream processing for that purpose.
- **Evidence:** consent store schema + withdrawal-propagation code.

### D. Security implementation (Art. 32)
- [ ] Encryption in transit and at rest as designed; pseudonymisation implemented where specified.
- [ ] Secrets pulled from the approved vault; SAST/SCA clean of critical/high findings before merge
      (aligns with existing SAST/SCA standards).
- **Evidence:** SAST/SCA/secret-scan reports attached to the PR.

### E. Audit logging (the evidence engine)
- [ ] Every read of, export of, and deletion of personal data emits an immutable, time-stamped log
      with actor, subject, purpose, and basis where applicable.
- [ ] Access to special-category data (Art. 9) is logged with elevated detail.
- **Evidence:** sample log lines demonstrating the above (with personal data itself excluded/hashed).
- **Anti-pattern:** logging the personal data *into* the audit log — log references/ids, not payloads.

### F. Automated decisions (Art. 22) — if triggered
- [ ] Implement the human-review route so a subject's request reaches a person with authority to change the outcome.
- [ ] Persist the model/rule **version and inputs/logic** per decision to support explanation and contest.
- **Evidence:** decision-record store + human-review handler code.

### G. Retention (Art. 5(1)(e))
- [ ] Implement the scheduled deletion/anonymisation job per the design; make it observable.
- **Evidence:** job code + a dry-run/log showing it selects the right records.

## Code-review gate
- [ ] PR template includes privacy criteria; reviewer confirms minimisation, no-PII-in-logs, rights
      hooks, and audit logging before approval.
- **Evidence:** PR approval that explicitly cites the privacy criteria (not a bare "LGTM").

## Exit criteria
Development gate is complete when each designed control has corresponding code, the code emits audit
evidence, scans are clean, and PRs were approved against privacy criteria — all linked from the
Compliance Record.
