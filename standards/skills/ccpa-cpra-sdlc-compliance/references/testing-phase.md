# Testing Phase — CCPA/CPRA Gate

**Purpose:** prove each control works — including negative cases — and that the evidence exists for
the risk assessment and the cybersecurity audit. Each test maps to a citation and passes with a timestamp.

## Test families (map each test to a CCPA citation)

### A. Consumer rights (functional + timing)
- [ ] **Know/Access (§.110/.115):** returns categories + specific pieces; assert completeness.
- [ ] **Delete (§.105):** consumer absent from stores, caches, logs, backups; **service-provider
      deletion invoked**; exceptions logged.
- [ ] **Correct (§.106):** correction applies and propagates.
- [ ] **Opt-Out of Sale/Sharing (§.120):** opt-out stops sale and cross-context-behavioral-advertising sharing.
- [ ] **Limit SPI (§.121):** SPI restricted to necessary uses after a limit request.
- [ ] **Timing (§1798.130):** acknowledge ≤ 10 business days; respond ≤ 45 days (extendable by 45).
- **Evidence:** test cases + timestamped pass results.

### B. Opt-out preference signals / GPC (§7025)
- [ ] A Global Privacy Control signal is detected and automatically opts the consumer out of sale/sharing; state persists.
- **Evidence:** GPC test result.

### C. Minimization & leakage (negative tests)
- [ ] No PI in logs, URLs, error responses, or analytics; non-prod data masked/synthetic.
- [ ] Only purpose-justified fields persisted.
- **Evidence:** leak-scan report.

### D. Non-discrimination (§1798.125)
- [ ] Exercising a right does not degrade service beyond what's permitted; any financial incentive is disclosed and value-justified.
- **Evidence:** non-discrimination test result.

### E. Reasonable security (§1798.100(e), §1798.150)
- [ ] Encryption in transit/at rest verified; access controls verified; PI is encrypted/redacted to
      reduce breach-private-right-of-action exposure.
- **Evidence:** security test results.

### F. Retention & deletion (§1798.100(a)(3))
- [ ] Aged-data test: PI past retention is deleted/anonymised by the job.
- **Evidence:** retention-job test output.

### G. ADMT (2025 regs) — if triggered
- [ ] Opt-out and **appeal/human-review** are reachable and can change the outcome; decision logic is stored and retrievable for access requests.
- **Evidence:** ADMT test results.

### H. Breach readiness (informs §1798.150 + cyber audit)
- [ ] Simulated unauthorised access triggers detection/alerting and the incident-response process.
- **Evidence:** breach-simulation test.

## Coverage & traceability
- [ ] Maintain a **traceability matrix**: requirement → design → code → test → result. An examiner (or
      the cybersecurity auditor) should be able to pick any citation and walk it to a passing test.
- [ ] Privacy tests run in CI and **block release** on failure.
- **Evidence:** traceability matrix + CI gate config.

## Exit criteria
Complete when every applicable test family has mapped, passing, timestamped results; the traceability
matrix is complete; and privacy tests are release-blocking in CI. This package feeds the risk
assessment and the annual cybersecurity-audit certification.
