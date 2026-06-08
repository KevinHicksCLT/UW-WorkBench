# Audit Evidence Map — NYDFS Part 500

The artifact to hand an examiner — and the one the executive and CISO should review **before signing
the §500.17(b) Certification of Material Compliance**. It crosswalks each obligation to the standard,
the SDLC gate (or Run owner), the evidence it leaves, the **retention**, and the live telemetry signal.

## How to read it
- **Section** — the obligation. **Standard** — the Transformation Bridge id (`../app-integration/nydfs-500-standards.json`).
- **Gate/Owner** — where it is enforced (SDLC phase) or who owns it (Run).
- **Evidence artifact** — the stored proof. **Retention** — minimum keep period (§500.17(b) sets a 5-year floor for certification support).
- **Telemetry signal** — the ongoing metric for the app's Telemetry tab.

| Section | Standard | Gate/Owner | Evidence artifact | Retention | Telemetry signal |
|---|---|---|---|---|---|
| 500.2 program | nydfs-001 | Run / CISO | Program doc; Class A independent-audit report | 5y | program review currency |
| 500.3 policy | nydfs-002 | Run / CISO | Policy set + annual approval record | 5y | days since policy approval |
| 500.4 governance | nydfs-003 | Run / CISO + Board | CISO annual report; board minutes | 5y | report on time (y/n) |
| 500.5 vuln mgmt | nydfs-004 | Test/Run | Pen-test report; scan reports; remediation log | 5y | mean time to remediate by severity |
| 500.6 audit trail | nydfs-005 | Design/Dev/Test | Audit-trail config; sample logs | 5y / 3y | % NPI access events logged |
| 500.7 access | nydfs-006 | Design/Dev/Test | Access model; annual access-review record | 5y | % accounts reviewed on schedule |
| 500.8 app security | nydfs-007 | All build gates | Secure-dev standards; annual CISO review | 5y | % builds against current standards |
| 500.9 risk assessment | nydfs-008 | Run / CISO+CRO | Documented risk assessment | 5y | days since last update (≤ 365) |
| 500.10 personnel | nydfs-009 | Run / CISO | Staffing/training records | 5y | training completion rate |
| 500.11 third party | nydfs-010 | Design/Run | TPSP policy; due-diligence + reassessment records | 5y | % TPSPs reassessed on schedule |
| 500.12 MFA | nydfs-011 | Design/Dev/Test | MFA config; compensating-control approvals | 5y | MFA coverage of access paths |
| 500.13(a) asset inventory | nydfs-012 | Design/Run | Asset inventory with required attributes | 5y | % systems inventoried + validated |
| 500.13(b) disposal | nydfs-013 | Design/Dev/Test | Disposal policy + job logs | 5y | % NPI disposed at end of retention |
| 500.14 monitoring/training | nydfs-014, nydfs-015 | Design/Dev/Run | Monitoring config; Class A EDR/SIEM; training records | 5y | EDR/SIEM coverage; training completion |
| 500.15 encryption | nydfs-016 | Design/Dev/Test | Encryption policy + config; CISO approvals | 5y | encryption coverage in transit/at rest |
| 500.16 IR/BCDR | nydfs-017, nydfs-018 | Design/Test/Run | IR + BCDR plans; annual test + restore-test records | 5y | days since last IR/BCDR + restore test |
| 500.17(a) 72h notice | nydfs-019 | Run / CISO | Notification runbook; any filed notices | 5y | notice readiness (tabletop pass) |
| 500.17(c) extortion notice | nydfs-020 | Run / CISO+GC | Ransomware-payment runbook; OFAC diligence | 5y | runbook test recency |
| 500.17(b) certification | nydfs-021 | Run / Exec+CISO | Signed certification or acknowledgment; support records | 5y | evidence-completeness before April 15 |
| 500.1(k) NPI classification | nydfs-022 | Req/Design | NPI classification per system | 5y | % systems with NPI classification |

> **The audit principle in one line:** the certification is the signature; the evidence is the spine
> that keeps the signature upright. Build the evidence as a by-product of delivery, not a scramble in Q1.

---

## Part 500 Compliance Record — template

```
# NYDFS Part 500 Compliance Record — <system/feature name>
Owner (CISO): <name>          Delivery lead: <name>
Status: <Req | Design | Dev | Test | Live>     Last updated: <date>

## Scope determination (STEP 0)
- Covered Entity? <yes/no — basis>
- NPI handled? <categories: business / identifiers / health>
- Class A? <yes/no — extras: independent audit, PAM, EDR+SIEM, external pen test>
- Limited exemption (§500.19(a))? <yes/no>

## Requirements gate
- NPI classification: <link>
- Access/retention requirements: <link>
- Planned asset-inventory entry: <link>
- Secure-dev acceptance criteria: <link>
- Third-party flag: <link>     Incident-relevance note: <link>

## Design gate
- Secure-design record (§500.8): <link>
- Access & privileged-account model (§500.7): <link>
- MFA design (§500.12): <link>
- Encryption + key mgmt (§500.15): <link>
- Audit-trail design + retention (§500.6): <link>
- Monitoring/malicious-code design (§500.14): <link>
- Disposal design (§500.13(b)): <link>
- Asset-inventory record (§500.13(a)): <link>
- IR/BCDR hooks + backup design (§500.16): <link>
- Third-party record (§500.11): <link>
- Class A: PAM / EDR / SIEM design (if applicable): <link>

## Development gate
- Control → code map: <link>
- Audit-log samples + retention config (§500.6): <link>
- SAST/SCA/secret-scan results (§500.5): <link>
- PR approvals citing Part 500 criteria: <link>

## Testing gate
- Pen-test + scan reports + remediation log (§500.5): <link>
- MFA / access / encryption test results: <link>
- Audit-trail capture + negative (no-NPI-in-log) tests: <link>
- Disposal test + backup-restore test (§500.16(d)(2)): <link>
- Incident-simulation feeding 72h process (§500.17(a)): <link>
- Traceability matrix + CI gate config: <link>

## Run / operate handoff
- Asset-inventory upkeep owner: <name>
- Risk-assessment cadence (§500.9): <interval>
- 72h / extortion notification runbooks (§500.17): <link>
- Certification evidence feed (§500.17(b)): <link>
- Telemetry signals wired: <list>

## Sign-offs
- CISO: <name/date>     ISO/Security Architect: <name/date>     Delivery lead: <name/date>
```

## Wiring into Transformation Bridge
- The **Standards** area holds the 22 Part 500 standards (the *what*).
- This record + crosswalk are the *evidence layer*. Attach the record to the relevant **Initiative /
  Deliverable** and surface the telemetry signals on the **Telemetry** tab so the §500.17(b)
  certification is backed by a live dashboard, not a year-end document hunt.
