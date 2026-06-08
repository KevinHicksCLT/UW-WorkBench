# Audit Evidence Map

This is the artifact an auditor should be handed first. It answers the only question that matters in
an audit: **"Show me that this control is real, was applied, and is still working."** It crosswalks
each GDPR obligation to the standard, the SDLC gate that enforces it, the evidence it leaves, and the
live telemetry signal that proves it is still operating.

## How to read it
- **Article** — the obligation.
- **Standard** — the Transformation Bridge standard id (`../app-integration/gdpr-standards.json`).
- **Gate** — where in the SDLC the control is enforced.
- **Evidence artifact** — the stored proof (what you show the auditor).
- **Telemetry signal** — the ongoing metric (what the app's Telemetry tab should track).

| Article | Standard | Gate | Evidence artifact | Telemetry signal |
|---|---|---|---|---|
| 5 principles | gdpr-005, gdpr-021 | Req/Design | Minimisation log; accountability index | % features with completed minimisation log |
| 5(2) accountability | gdpr-021 | All | Complete GDPR Compliance Record | % features with a complete record |
| 6 lawful basis | gdpr-001 | Req | Lawful-basis register entry | % processing activities with a recorded basis |
| 7 consent | gdpr-003 | Design/Dev/Test | Consent store + withdrawal test | consent withdrawal success rate |
| 9 special category | gdpr-002 | All | Art. 9(2) condition record; access logs | % special-category access events logged |
| 12–14 transparency | gdpr-004 | Req/Design | Notice requirement + served-version record | % subjects served current notice version |
| 15 access (DSAR) | gdpr-008 | Design/Dev/Test | DSAR test results + fulfilment logs | DSAR median fulfilment time (target ≤ 1 month) |
| 16 rectification | gdpr-007 | Design/Dev/Test | Rectification test results | rectification request closure time |
| 17 + 19 erasure | gdpr-009 | Design/Dev/Test | Erasure test proving backup/processor reach | erasure completeness rate; median erasure time |
| 18/21 restriction/objection | gdpr-011 | Design/Dev/Test | Flag-enforcement tests | objection/restriction honour rate |
| 20 portability | gdpr-010 | Design/Dev/Test | Export format test | portability request success rate |
| 22 automated decisions | gdpr-012 | All | Art. 22 design record; decision logic store; human-review tests | % automated decisions with logged logic + reachable human review |
| 24 controller responsibility | gdpr-021 | All | Control review records | control review currency |
| 25 by design/default | gdpr-013 | Req/Design/Dev | Privacy design-decision records | % designs with privacy decision records |
| 28 processors | gdpr-018 | Design/Run | Processor list + DPA status | % processors with current DPA |
| 30 RoPA | gdpr-015 | Design/Run | Records of processing activities | RoPA last-updated date |
| 32 security | gdpr-016 | Design/Dev/Test/Run | Encryption config; SAST/SCA; restore test | encryption coverage; restore-test recency |
| 33/34 breach | gdpr-017 | Design/Test/Run | Breach-simulation test; breach register | mean time to detect; notification within 72h |
| 35/36 DPIA | gdpr-014 | Req/Design | Signed DPIA; prior-consultation record | % high-risk features with signed DPIA |
| 37–39 DPO | gdpr-020 | Run | DPO designation + involvement records | DPO sign-off coverage |
| 44–49 transfers | gdpr-019 | Design/Run | Transfer mechanism + TIA per egress point | % egress points with valid mechanism |
| 5(1)(e) retention | gdpr-006 | Design/Dev/Test | Retention-job test output | % records auto-deleted at end of retention |

> **The audit principle in one line:** a green telemetry signal without a stored evidence artifact is
> a claim; a stored artifact without a live signal is history. Auditors want both — proof it was
> built right *and* proof it still runs.

---

## GDPR Compliance Record — template

Keep one per feature/system. This is the spine all four gates write into.

```
# GDPR Compliance Record — <feature/system name>
Owner (DPO): <name>           Delivery lead: <name>
Status: <Req | Design | Dev | Test | Live>     Last updated: <date>

## Scope determination (STEP 0)
- Personal data processed? <yes/no — categories>
- Special category (Art. 9)? <yes/no — which>
- Territorial scope (Art. 3)? <basis>
- Art. 22 automated decisions? <yes/no>
- DPIA required? <yes/no — link>
- Other regimes in play? <CCPA/CPRA, GLBA, NYDFS, HIPAA, AI Act, ...>

## Requirements gate
- Data inventory: <link>
- Lawful-basis register: <link>
- Minimisation log: <link>
- Rights acceptance criteria: <link>
- Notice + retention requirements: <link>
- DPIA screening result: <link>

## Design gate
- Data-flow diagram: <link>
- Privacy design-decision records: <link>
- Security design (Art. 32): <link>
- Rights machinery design (incl. backup/processor erasure): <link>
- Consent/notice design: <link>
- Retention-job design: <link>
- Transfer mechanism records: <link>
- Signed DPIA: <link>     Prior consultation (if any): <link>
- Processor/DPA list: <link>
- Art. 22 design + AI Act crosswalk (if applicable): <link>

## Development gate
- Control → code map: <link>
- Audit-log samples: <link>
- SAST/SCA/secret-scan results: <link>
- PR approvals citing privacy criteria: <link>

## Testing gate
- Test cases mapped to articles + results: <link>
- Leak/minimisation scan: <link>
- Erasure-reaches-backups/processors test: <link>
- Traceability matrix (req→design→code→test→result): <link>
- CI release-gate config: <link>

## Run / operate
- RoPA entry: <link>           Owner: <name>
- Breach process + register: <link>
- DPA lifecycle: <link>
- Re-test cadence for Art. 32 measures: <interval>
- Telemetry signals wired: <list>

## Sign-offs
- DPO: <name/date>     ISO/Security Architect: <name/date>     Delivery lead: <name/date>
```

## Wiring this into Transformation Bridge
- The **Standards** area holds the 21 GDPR standards (the *what*).
- This record + the crosswalk are the *evidence layer* (the *proof*). If the platform supports it,
  attach the record to the relevant **Initiative / Deliverable** and surface the telemetry signals
  on the **Telemetry** tab so "GDPR coverage" is a live dashboard, not a binder pulled out at audit time.
