# Development Phase — NYDFS Part 500 Gate

**Purpose:** implement the designed controls and instrument them so they produce the artifacts that
back the §500.17(b) certification.

## Checklist

### A. Secure development (§500.8) + vulnerability hygiene (§500.5)
- [ ] Build to the secure-development standards; no critical/high findings merged.
- [ ] SAST, SCA (dependency scanning), and secret scanning run pre-merge and block on critical/high
      (aligns with existing SAST/SCA standards).
- **Evidence:** scan reports attached to the PR; remediation notes for findings.

### B. Access controls & MFA (§500.7, §500.12)
- [ ] Enforce least privilege in code/config; privileged operations gated and minimized.
- [ ] MFA enforced on every access path; service accounts that prohibit interactive login handled per design.
- [ ] Leaver flow removes/disables access promptly.
- **Evidence:** access-control implementation + MFA enforcement references.

### C. Encryption (§500.15)
- [ ] Encryption in transit (TLS) and at rest implemented to industry standards; secrets/keys pulled
      from the approved vault — never in code or config.
- **Evidence:** encryption implementation + secret-scan clean result.

### D. Audit trail (§500.6) — the evidence engine
- [ ] Emit immutable, time-stamped audit records for access to and changes/deletions of NPI, and for
      events relevant to detecting material cybersecurity events.
- [ ] Configure retention to meet 5-year (financial reconstruction) and 3-year (event detection) minima.
- **Evidence:** sample audit-log entries (referencing ids, not raw NPI) + retention config.

### E. Monitoring & malicious-code (§500.14)
- [ ] Implement monitoring hooks for authorized-user activity; integrate web/email malicious-code
      filtering where the system is exposed.
- [ ] Class A: ensure events feed EDR and the centralized logging/SIEM solution.
- **Evidence:** monitoring/logging integration references.

### F. Secure disposal (§500.13(b))
- [ ] Implement the disposal/purge routine for NPI past its retention; make it observable.
- **Evidence:** disposal-routine code + a dry-run log.

### G. Asset inventory (§500.13(a))
- [ ] On deploy, the system and its components register/update in the asset inventory automatically where possible.
- **Evidence:** inventory entry created/updated.

## Code-review gate
- [ ] PR template includes Part 500 criteria; reviewer confirms least privilege, MFA, encryption,
      audit logging, and no secrets in code before approval.
- **Evidence:** PR approval explicitly citing the Part 500 criteria.

## Exit criteria
Complete when each designed control has corresponding code that emits audit evidence, scans are clean,
secrets are vaulted, and PRs were approved against the Part 500 criteria — all linked from the
Compliance Record.
