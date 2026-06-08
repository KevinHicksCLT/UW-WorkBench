# Design Phase — CCPA/CPRA Gate

**Purpose:** bake privacy into the architecture and complete the **written risk assessment** before
high-risk processing. California's opt-out + limit-use + honor-the-signal model has specific design
consequences.

## Checklist

### A. Minimization & purpose limitation by design (§1798.100(c))
- [ ] Persist only fields reasonably necessary and proportionate to the disclosed purposes.
- [ ] Default to the least data exposure; no incompatible secondary use without notice.
- **Evidence:** privacy design-decision records.

### B. Rights machinery (design how each right executes)
- [ ] **Know/Access (§.110/.115):** locate and assemble a consumer's PI (categories + specific pieces).
- [ ] **Delete (§.105):** deletion across stores, caches, logs, backups, **and direct service
      providers/contractors to delete**; record exceptions invoked.
- [ ] **Correct (§.106):** correction workflow.
- [ ] **Opt-Out of Sale/Sharing (§.120/.135):** an enforceable opt-out state that stops sale and
      cross-context-behavioral-advertising sharing across all consumers of the data.
- [ ] **Limit SPI (§.121):** restrict SPI to necessary uses on request.
- **Evidence:** rights design notes per right, incl. service-provider deletion approach.

### C. Opt-out preference signals / GPC (11 CCR §7025)
- [ ] Detect Global Privacy Control at the platform layer and treat it as a valid opt-out of sale/sharing.
- **Evidence:** GPC-handling design.
- **Anti-pattern:** honoring only a click on a web banner while ignoring the browser signal.

### D. Reasonable security (§1798.100(e), §1798.150)
- [ ] Encryption in transit/at rest, access controls, and the controls needed to avoid the breach
      private right of action for nonencrypted/nonredacted PI.
- **Evidence:** security design section.

### E. Retention & deletion (§1798.100(a)(3))
- [ ] Design scheduled deletion/anonymisation per category.
- **Evidence:** retention-job design.

### F. Service providers / contractors / third parties (§1798.100(d), §1798.140)
- [ ] Identify recipients; mark which transfers are "sale"/"sharing"; confirm required contract terms
      and deletion flow-down.
- **Evidence:** data-flow + sale/share map; processor list with contract status.

### G. ADMT (2025 regs) — if triggered
- [ ] Design pre-use **notice**, **opt-out**, **access** to meaningful information about the logic and
      outcome, and an **appeal / human-review** path that can change the decision.
- [ ] Capture the model/rule **version and inputs** per significant decision for access and appeal.
- [ ] Crosswalk to GDPR Art. 22 and the EU AI Act where applicable.
- **Evidence:** ADMT design record + crosswalk note.

### H. Risk assessment (2025 regs) — complete before build
- [ ] Document purposes, benefits, reasonably foreseeable risks, safeguards, collection process,
      retention, number of consumers impacted, and disclosures.
- [ ] Privacy Officer signs off; note that documentation is submitted to the CPPA from 1 Apr 2028.
- **Evidence:** completed, signed risk assessment in the Compliance Record.

## Exit criteria
Complete when the record holds: privacy design-decision records, rights machinery design (incl.
service-provider deletion), GPC-handling design, security design, retention-job design, sale/share +
processor map, ADMT design (if applicable), and the **completed risk assessment**.
