# Testing Phase — GDPR Gate

**Purpose:** prove each control works — including the **negative** cases — and satisfy Art. 32's
explicit requirement for a process to *regularly test the effectiveness* of measures. Tests are the
most auditor-legible evidence you have: each one should map to an article and pass with a timestamp.

## Test families (map each test to a GDPR article)

### A. Data-subject rights (functional + timing)
- [ ] **Access/DSAR (Art. 15):** request returns the subject's data + metadata; assert completeness.
- [ ] **Rectification (Art. 16):** correction applies and propagates.
- [ ] **Erasure (Art. 17 + 19):** after deletion, assert the subject is **absent from primary
      stores, caches, logs, search indexes, analytics, and processors**, and recipients were notified.
- [ ] **Portability (Art. 20):** export is structured, machine-readable, and complete for provided data.
- [ ] **Restriction/objection (Art. 18/21):** flagged records are excluded from active processing,
      including batch/stream jobs; marketing objection produces a hard stop.
- [ ] **Timing (Art. 12):** assert the fulfilment path can meet the one-month expectation.
- **Evidence:** test cases + pass results with timestamps in the Compliance Record.

### B. Minimisation & leakage (negative tests)
- [ ] Assert **no personal data appears in logs, URLs, error responses, or analytics events**.
- [ ] Assert non-prod datasets contain no raw production PII (masking/synthetic verified).
- [ ] Assert only purpose-justified fields are persisted (unexpected fields are rejected/dropped).
- **Evidence:** leak-scan report + failing-then-fixed examples.

### C. Consent lifecycle (Art. 7)
- [ ] Grant → processing proceeds; withdraw → downstream processing for that purpose stops.
- [ ] Consent record carries timestamp + notice version.
- **Evidence:** consent lifecycle test results.

### D. Security effectiveness (Art. 32)
- [ ] Encryption at rest/in transit verified; pseudonymisation verified where designed.
- [ ] Access controls: special-category data unreachable without the elevated role; access is logged.
- [ ] Restore test: backup restore succeeds within the defined objective.
- **Evidence:** security test results, incl. a restore-test record.

### E. Retention & deletion (Art. 5(1)(e))
- [ ] Time-travel/aged-data test: records past retention are deleted/anonymised by the job.
- **Evidence:** retention-job test output.

### F. International transfers (Ch. V)
- [ ] Assert data only egresses to destinations with a recorded transfer mechanism; others are blocked.
- **Evidence:** transfer-control test results.

### G. Automated decisions (Art. 22) — if triggered
- [ ] Human-review route is reachable and a reviewer can change the outcome.
- [ ] Each decision stores the logic/version used; a contested decision follows the defined workflow.
- **Evidence:** Art. 22 test results.

### H. Breach detection (Art. 33)
- [ ] Simulated unauthorised access triggers detection/alerting that feeds the 72-hour notification process.
- **Evidence:** breach-simulation test + alert evidence.

## Coverage & traceability
- [ ] Maintain a **traceability matrix**: requirement → design decision → code → test → result. An
      auditor should be able to pick any GDPR article and walk it to a passing test.
- [ ] Privacy tests run in CI and **block release** on failure (treat like critical security gates).
- **Evidence:** traceability matrix + CI gate configuration.

## Exit criteria
Testing gate is complete when every applicable test family has mapped, passing, timestamped results;
the traceability matrix is complete; and privacy tests are wired into CI as release-blocking. This
matrix is the artifact you hand an auditor first.
