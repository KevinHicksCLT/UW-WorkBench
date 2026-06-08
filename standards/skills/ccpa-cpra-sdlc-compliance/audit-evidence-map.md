# Audit Evidence Map — CCPA/CPRA

The artifact to hand a CPPA examiner or the cybersecurity auditor — and the basis for each risk
assessment. It crosswalks each obligation to the standard, the SDLC gate (or Run owner), the evidence
it leaves, and the live telemetry signal.

## How to read it
- **Citation** — the obligation. **Standard** — the Transformation Bridge id (`../app-integration/ccpa-cpra-standards.json`).
- **Gate/Owner** — enforcing SDLC phase or Run owner. **Evidence artifact** — the stored proof.
- **Telemetry signal** — ongoing metric for the app's Telemetry tab.

| Citation | Standard | Gate/Owner | Evidence artifact | Telemetry signal |
|---|---|---|---|---|
| 1798.140(d)/145(e) GLBA scope | ccpa-001 | Req / Privacy+GC | PI inventory with GLBA exempt/in-scope map | % data flows with GLBA determination |
| 1798.140(v)/(ae) classification | ccpa-002 | Req/Design | PI/SPI classification | % systems with PI/SPI classification |
| 1798.100(a) notice | ccpa-003 | Req/Design | Notice-at-collection content + served record | % collection points with current notice |
| 1798.130/135 privacy policy | ccpa-004 | Run / Privacy | Policy + 12-month update record | days since policy update (≤ 365) |
| 1798.110/115 access | ccpa-005 | Design/Dev/Test | DSAR tests + fulfilment logs | access-request median time (≤ 45 days) |
| 1798.105 delete | ccpa-006 | Design/Dev/Test | Deletion test incl. service-provider reach | deletion completeness rate |
| 1798.106 correct | ccpa-007 | Design/Dev/Test | Correction test results | correction closure time |
| 1798.120/135 opt-out sale/share | ccpa-008 | Design/Dev/Test | Opt-out tests | opt-out honor rate |
| 11 CCR 7025 GPC | ccpa-009 | Design/Dev/Test | GPC detection test | % GPC signals honored |
| 1798.121 limit SPI | ccpa-010 | Design/Dev/Test | SPI limit-use tests | SPI limit honor rate |
| ADMT regs / 1798.185 | ccpa-011 | All | ADMT notice; opt-out/appeal tests; decision-logic store | % ADMT decisions with opt-out + appeal reachable |
| 1798.125 non-discrimination | ccpa-012 | Design/Test | Non-discrimination test; incentive disclosures | incentive-disclosure currency |
| 1798.130 / 7020-7022 requests | ccpa-013 | Design/Dev/Test | Request-workflow tests (ack ≤ 10 bd) | ack within 10 business days rate |
| 1798.100(c) minimization | ccpa-014 | Req/Design | Minimization log | % features with minimization log |
| 1798.100(a)(3) retention | ccpa-015 | Design/Dev/Test | Retention schedule + job logs | % records deleted at end of retention |
| 1798.100(e)/150 security | ccpa-016 | Design/Dev/Test/Run | Encryption config; SAST/SCA; access controls | encryption coverage; critical-finding count |
| 1798.140(ae)/121 SPI handling | ccpa-017 | All | SPI safeguards + limit-use enforcement | % SPI flows with safeguards |
| 1798.100(d)/140 SP contracts | ccpa-018 | Design/Run | Service-provider contracts; sale/share map | % SPs with compliant contract |
| risk-assessment regs | ccpa-019 | Req/Design | Written risk assessments (submit CPPA from 2028-04-01) | % high-risk processing with assessment |
| cybersecurity-audit regs | ccpa-020 | Test/Run | Annual independent audit + CPPA certification | audit currency; days to next certification |
| 1798.120(c) minors | ccpa-021 | Design/Dev/Test | Opt-in flow tests for under-16 | opt-in capture rate (minors) |
| 11 CCR 7101 recordkeeping | ccpa-022 | Dev/Run | Request records retained 24 months | request-record completeness |

> **The audit principle in one line:** in California you must be able to *show the work* — the risk
> assessment documents the decision, the evidence proves the control, and the cybersecurity audit
> attests the program. Build all three as by-products of delivery.

---

## CCPA Compliance Record — template

```
# CCPA/CPRA Compliance Record — <feature/system name>
Owner (Privacy Officer): <name>     Delivery lead: <name>
Status: <Req | Design | Dev | Test | Live>     Last updated: <date>

## Scope determination (STEP 0)
- Business threshold met? <which>
- California PI in scope? <categories>   GLBA-exempt flows: <list>   In-scope flows: <list>
- Sensitive PI? <which>
- ADMT for a significant decision? <yes/no>
- Risk-assessment trigger? <which: sale/share, SPI, ADMT, training, inference>

## Requirements gate
- PI/SPI inventory + GLBA map: <link>
- Notice-at-collection content: <link>
- Rights acceptance criteria: <link>
- Minimization log: <link>     Retention schedule: <link>
- ADMT screening: <link>       Risk-assessment screening: <link>

## Design gate
- Privacy design-decision records: <link>
- Rights machinery (incl. service-provider deletion): <link>
- GPC-handling design: <link>
- Reasonable-security design (§1798.150 exposure): <link>
- Sale/share + service-provider map + contracts: <link>
- ADMT design (notice/opt-out/access/appeal) + AI Act crosswalk: <link>
- Completed risk assessment: <link>

## Development gate
- Control -> code map: <link>
- Audit-log samples (incl. opt-out state changes): <link>
- GPC + opt-out propagation tests: <link>
- SAST/SCA/secret-scan results: <link>
- PR approvals citing CCPA criteria: <link>

## Testing gate
- Rights tests + timing results: <link>
- GPC test: <link>     Deletion-reaches-SP test: <link>
- Leak/minimization scan: <link>     SPI limit-use test: <link>
- ADMT opt-out/appeal tests: <link>
- Traceability matrix + CI gate config: <link>

## Run / operate
- Privacy-policy 12-month refresh owner: <name>
- Consumer-request handling + 24-month recordkeeping: <link>
- Service-provider reassessment: <link>
- Risk-assessment submission to CPPA (from 2028-04-01): <link>
- Cybersecurity-audit certification (phased): <link>
- Telemetry signals wired: <list>

## Sign-offs
- Privacy Officer: <name/date>   ISO/Security Architect: <name/date>   Delivery lead: <name/date>
```

## Wiring into Transformation Bridge
- The **Standards** area holds the 22 CCPA/CPRA standards (the *what*).
- This record + crosswalk are the *evidence layer*. Attach the record to the relevant **Initiative /
  Deliverable**; surface the telemetry signals and the **compliance-date countdowns** (ADMT 2027, CPPA
  risk-assessment submission 2028, cyber-audit certification 2028+) on the **Telemetry** tab.
