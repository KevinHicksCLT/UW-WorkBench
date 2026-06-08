# Design Phase — GDPR Gate

**Purpose:** embed privacy into the architecture (Art. 25) and **complete the DPIA before build**.
Design is where data-protection-by-design becomes concrete: data flows, boundaries, encryption,
rights machinery, retention jobs.

## Checklist

### A. Data-flow & boundary model
- [ ] Produce a data-flow diagram: collection → stores → processing → sharing → deletion.
- [ ] Mark trust boundaries and every point where data leaves a system or the EEA.
- [ ] Identify all recipients: internal systems, processors, sub-processors, third parties.
- **Evidence:** data-flow diagram stored in the Compliance Record.

### B. Data protection by design & by default (Art. 25)
- [ ] Default settings are the most privacy-protective (opt-in not opt-out; least data shown).
- [ ] Apply **pseudonymisation** where the function allows (separate identifiers from payload).
- [ ] Define access model: least privilege, role-based, special-category data gated and logged.
- **Evidence:** privacy design-decision records (decision, GDPR article, rationale, approver).

### C. Security architecture (Art. 32)
- [ ] Encryption in transit (TLS) and at rest (e.g., AES-256 / DB TDE) per the Encryption standards.
- [ ] Key/secret management via approved vault; no secrets in code or config.
- [ ] Resilience, backup, and **restore** capability defined (Art. 32 requires availability/restore).
- [ ] Define how the *effectiveness* of these measures will be regularly tested (links to Testing).
- **Evidence:** security design section referencing the relevant controls.

### D. Rights machinery (design how the rights actually execute)
- [ ] **Access/DSAR (Art. 15):** how data for one subject is located across all stores and assembled.
- [ ] **Erasure (Art. 17 + 19):** deletion design that reaches primary stores, **backups**, caches,
      logs, search indexes, analytics, and **processors**; and propagates to recipients.
- [ ] **Portability (Art. 20):** export of subject-provided data in a structured machine-readable format.
- [ ] **Rectification/restriction/objection (16/18/21):** enforceable flags honoured by batch/stream jobs.
- **Evidence:** rights design notes per right, including the backup/processor erasure approach.
- **Anti-pattern:** "soft delete only" with no plan for backups; treating erasure as a single DB row update.

### E. Consent & transparency (Art. 7, 12–14)
- [ ] Design consent capture with timestamp + notice version; design easy withdrawal.
- [ ] Design where/when the Art. 13/14 notice is served and how the served version is recorded.
- **Evidence:** consent/notice design record.

### F. Retention & deletion (Art. 5(1)(e))
- [ ] Design the scheduled job that deletes/anonymises at end of retention, per category.
- **Evidence:** retention-job design.

### G. International transfers (Ch. V, Art. 44–49)
- [ ] For each EEA egress point, record the transfer mechanism (adequacy / SCCs / BCRs) and, for
      SCCs, the transfer impact assessment and any supplementary measures (post-Schrems II).
- **Evidence:** transfer mechanism record per egress point.

### H. DPIA completion (Art. 35/36)
- [ ] Complete the DPIA opened in Requirements: describe processing, assess necessity &
      proportionality, assess risks to subjects, define mitigations, record residual risk.
- [ ] If residual risk remains **high** → prior consultation with the supervisory authority (Art. 36).
- [ ] DPO signs off the DPIA before build starts.
- **Evidence:** signed DPIA in the Compliance Record.

### I. Automated decisions (Art. 22) — if triggered
- [ ] Design a human-in-the-loop review path that is *meaningful*, not rubber-stamp.
- [ ] Design capture of the **model/rule version and the logic** used for each automated decision so
      it can be explained and contested; design the contest workflow.
- [ ] Crosswalk to EU AI Act high-risk obligations where applicable (insurance pricing/underwriting
      and life/health risk assessment are flagged high-risk under the AI Act).
- **Evidence:** Art. 22 design record + AI Act crosswalk note.

## Processors (Art. 28)
- [ ] List processors/sub-processors; confirm a compliant DPA exists or is required before go-live.
- **Evidence:** processor list with DPA status.

## Exit criteria
Design gate is complete when the Compliance Record holds: data-flow diagram, privacy design-decision
records, security design, rights machinery design (incl. backup/processor erasure), consent/notice
design, retention-job design, transfer records, the **signed DPIA**, processor/DPA list, and (if
applicable) the Art. 22 design + AI Act crosswalk.
