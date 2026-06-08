# Requirements Phase — CCPA/CPRA Gate

**Purpose:** decide what California personal information the system handles, **which of it is GLBA-exempt
vs in-scope**, and the rights and notices that follow — before design. For an insurer, the GLBA map
is the master switch.

## Checklist

### A. PI / SPI inventory + GLBA-exemption map (§1798.140(v),(ae); §1798.145(e))
- [ ] List every data element the system will collect/derive/receive for California consumers.
- [ ] Classify each as PI and flag **sensitive PI** (SSN/IDs, financial credentials, precise
      geolocation, health, biometric, sexual orientation, etc.).
- [ ] For each data flow, determine whether it is **collected/processed under GLBA** (exempt) or
      **outside GLBA** (in scope) — remember the exemption is information-level, not entity-level.
      In-scope categories typically include web visitors, prospects, marketing, and (since the 2023
      sunset) employees, applicants, and B2B contacts.
- **Evidence:** PI/SPI inventory with a GLBA exempt/in-scope column.
- **Anti-pattern:** declaring the whole carrier GLBA-exempt and applying nothing.

### B. Notice at collection (§1798.100(a))
- [ ] Define, for the in-scope data, the categories collected, purposes, retention, and whether sold/shared.
- **Evidence:** notice-at-collection content requirement.

### C. Consumer-rights acceptance criteria
- [ ] Write testable acceptance criteria for: know/access (§.110/.115), delete (§.105), correct
      (§.106), opt-out of sale/sharing (§.120), limit SPI (§.121), non-discrimination (§.125).
- [ ] Note request mechanics: ≥ 2 methods, verification, ack ≤ 10 business days, respond ≤ 45 days.
- **Evidence:** rights acceptance criteria on the stories.

### D. Data minimization & purpose limitation (§1798.100(c))
- [ ] Challenge each field: reasonably necessary and proportionate to a disclosed purpose? Remove the rest.
- **Evidence:** minimization decision log.

### E. Retention (§1798.100(a)(3))
- [ ] Define a retention period per category and the deletion trigger.
- **Evidence:** retention schedule entry.

### F. ADMT screening (2025 regs)
- [ ] Does the system use automated decision-making that **substantially replaces human judgement**
      in a significant decision (underwriting, pricing, claims, eligibility)? If yes → ADMT notice/
      opt-out/access/appeal requirements **and** a mandatory risk assessment; capture the human-review
      requirement now.
- **Evidence:** ADMT screening result.

### G. Risk-assessment screening (2025 regs)
- [ ] Will the system sell/share PI, process SPI, use/train ADMT for significant decisions, or infer
      sensitive traits? If yes → open a **written risk assessment** to complete in Design before processing.
- **Evidence:** risk-assessment screening result (with rationale if negative).

## Insurance-specific prompts
- Automated/assisted **underwriting & pricing** → ADMT + risk assessment + crosswalk to GDPR Art. 22.
- **Claims** health data → SPI; limit-use and heightened security from the start.
- Marketing/website/prospect data → almost always **non-GLBA → in scope**; do not exempt by reflex.

## Exit criteria
Complete when the Compliance Record holds: PI/SPI inventory **with GLBA map**, notice content, rights
acceptance criteria, minimization log, retention schedule, ADMT screening, and risk-assessment
screening result.
