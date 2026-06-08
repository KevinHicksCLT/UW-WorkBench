# Development Phase — CCPA/CPRA Gate

**Purpose:** implement the designed controls and instrument them so they emit evidence for risk
assessments and the cybersecurity audit.

## Checklist

### A. Minimization & no-leak (§1798.100(c))
- [ ] Persist only purpose-justified fields; **no PI in logs, URLs/query strings, errors, or analytics** by default.
- [ ] Non-production environments use masked/synthetic data.
- **Evidence:** code references + PI-leak scan results.

### B. Consumer-rights endpoints
- [ ] Implement know/access, delete, correct, opt-out of sale/sharing, and limit-SPI.
- [ ] Deletion calls service-provider/contractor deletion APIs and records the result.
- [ ] Opt-out state is durable and read by every consumer of the data (batch and streaming).
- **Evidence:** code mapped to each right + the audit-log entries operations emit.

### C. Opt-out preference signals / GPC (§7025)
- [ ] Detect the Global Privacy Control signal and apply the opt-out automatically; persist it.
- **Evidence:** GPC-handling code + test.

### D. Sensitive PI limit-use (§1798.121)
- [ ] Enforce SPI use restrictions in code; block secondary uses not permitted under a limit request.
- **Evidence:** SPI limit-use enforcement code.

### E. Reasonable security (§1798.100(e))
- [ ] Encryption in transit/at rest; secrets vaulted; SAST/SCA/secret-scan clean before merge.
- **Evidence:** scan reports attached to the PR.

### F. Audit logging (the evidence engine)
- [ ] Emit immutable, time-stamped logs for PI access, export, deletion, correction, and **opt-out
      state changes** (actor, consumer reference, action). Log references/ids, not PI payloads.
- **Evidence:** sample log lines.

### G. ADMT (2025 regs) — if triggered
- [ ] Implement the opt-out and **appeal/human-review** route so a person can change the outcome.
- [ ] Persist the model/rule version and inputs per significant decision for access and appeal.
- **Evidence:** decision-record store + human-review handler code.

### H. Retention & deletion (§1798.100(a)(3))
- [ ] Implement the scheduled deletion/anonymisation job per design; make it observable.
- **Evidence:** job code + dry-run log.

## Code-review gate
- [ ] PR template includes CCPA criteria; reviewer confirms minimization, no-PI-in-logs, rights hooks,
      GPC handling, and audit logging before approval.
- **Evidence:** PR approval explicitly citing the CCPA criteria.

## Exit criteria
Complete when each designed control has code that emits audit evidence, scans are clean, GPC and
opt-out propagation work, and PRs were approved against the CCPA criteria — all linked from the record.
