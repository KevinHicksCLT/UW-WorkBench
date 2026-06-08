# Testing Phase — NYDFS Part 500 Gate

**Purpose:** prove the build-time controls work — including negative cases — and satisfy §500.5's
explicit vulnerability-management testing. Test results mapped to sections are the most
auditor-legible evidence behind the certification.

## Test families (map each test to a Part 500 section)

### A. Vulnerability management (§500.5)
- [ ] **Penetration testing from inside and outside** system boundaries by a qualified party (Class A:
      external expert), at least annually and after material changes.
- [ ] **Automated scans + manual review** of systems not covered by scans; confirm findings are reported.
- [ ] Confirm **timely, risk-prioritized remediation** (track time-to-remediate by severity).
- **Evidence:** pen-test report, scan reports, remediation log.

### B. Access & MFA (§500.7, §500.12)
- [ ] MFA required on every access path; verify it cannot be bypassed.
- [ ] Least privilege enforced; privileged accounts limited and segregated; remote-control protocols disabled.
- [ ] Leaver test: terminated access is promptly removed.
- **Evidence:** access/MFA test results.

### C. Encryption (§500.15)
- [ ] Verify encryption in transit (TLS config) and at rest; verify keys/secrets are vaulted, not embedded.
- **Evidence:** encryption verification results.

### D. Audit trail (§500.6)
- [ ] Verify required events are captured, immutable, and time-stamped; verify retention meets 5-year/3-year minima.
- [ ] Negative test: NPI is **not** written into the audit log payload (ids/references only).
- **Evidence:** audit-trail test results.

### E. Monitoring & malicious-code (§500.14)
- [ ] Verify authorized-user-activity monitoring detects unauthorized access/tampering.
- [ ] Verify web/email malicious-code filtering blocks test content; Class A: EDR/SIEM alerts fire.
- **Evidence:** monitoring test results.

### F. Disposal & backups (§500.13(b), §500.16(d)(2))
- [ ] Aged-data test: NPI past retention is securely disposed of.
- [ ] **Backup-restore test**: critical data and systems restore within the defined objective.
- **Evidence:** disposal test + restore-test record.

### G. Incident response hook (§500.17(a))
- [ ] Simulated unauthorized access triggers detection/alerting that feeds the **72-hour** notification process.
- **Evidence:** incident-simulation test + alert evidence.

## Coverage & traceability
- [ ] Maintain a **traceability matrix**: requirement → design → code → test → result. An auditor (or
      the CISO before signing the certification) should be able to pick any Part 500 section and walk
      it to a passing test.
- [ ] Part 500 security tests run in CI and **block release** on failure.
- **Evidence:** traceability matrix + CI gate configuration.

## Exit criteria
Complete when every applicable test family has mapped, passing, timestamped results; the traceability
matrix is complete; pen-test/scan reports are stored; and security tests are wired into CI as
release-blocking. This package is the evidence the executive and CISO rely on when they sign.
