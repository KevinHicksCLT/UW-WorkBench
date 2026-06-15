# SOX Reference — Obligations Behind the Controls

The Sarbanes-Oxley Act of 2002 (Public Law 107-204) restored confidence in financial reporting after
the Enron/WorldCom failures. For an engineering team at an SEC-registered insurance carrier, SOX is
not an IT regulation — it is a **financial-reporting and ICFR regime** whose integrity depends on the
**IT general controls** and **automated application controls** that protect the systems feeding the
financial statements. This file summarizes the sections, frameworks, and standards the
`sox-itgc-sdlc-compliance` controls map to. It is engineering guidance, not legal interpretation;
binding text is the U.S. Code and SEC/PCAOB rules.

A one-line-per-item cheat sheet is in `sox-section-quick-reference.md`.

---

## The statutory sections that drive engineering work

### §302 — Corporate responsibility for financial reports (15 U.S.C. §7241; SEC Rule 13a-14)
The CEO and CFO must personally certify each quarterly and annual report: that they reviewed it; that
it contains no material misstatement or omission; that the financial statements fairly present the
financial condition; and crucially, that they are **responsible for establishing and maintaining
disclosure controls and procedures and internal control over financial reporting**, have **evaluated
their effectiveness**, and have disclosed any deficiencies and any fraud to the auditors and audit
committee. In practice the officers rely on a cascade of **quarterly sub-certifications** from
process and control owners. Engineering relevance: the ITGC and application-control run results are
part of the support a sub-certifier (and ultimately the CEO/CFO) relies on. **Control: ELC-302-01.**

### §404 — Management assessment of internal controls (15 U.S.C. §7262)
- **§404(a):** management must annually **assess and report on the effectiveness of ICFR**.
- **§404(b):** the company's external auditor must **attest to** management's assessment (under PCAOB
  AS 2201; smaller reporting companies may be exempt from the auditor attestation but not from the
  management assessment).
ICFR effectiveness is documented in a **control matrix** of key controls, each with an owner and
periodic testing, and a deficiency log with remediation. The IT general controls and automated
application controls in `controls/` are rows in that matrix. **Control: ELC-404-01.**

### §409 — Real-time issuer disclosures (15 U.S.C. §7266)
Issuers must disclose material changes in financial condition or operations on a **rapid and current
basis** (operationalized through Form 8-K). Engineering relevance: financial systems and their
monitoring must surface material events quickly enough to support timely disclosure; the operations
and reconciliation controls (OP-01, APP-02) help ensure the underlying data is complete and current.

### §802 — Criminal penalties for altering documents / records retention (18 U.S.C. §1519, §1520)
Knowingly altering, destroying, or falsifying records to impede an investigation is a felony.
Audit and review workpapers must be retained (the SEC rule, **17 CFR 210.2-06**, sets **7 years** for
audit/review records). For the company's own financial records, this drives an **enforced retention
policy meeting the statutory minimum, legal holds that suspend disposition, and a deletion-audit
trail to detect premature deletion**. **Control: RET-802-01.** (Note: the controls also cite **§103**,
which directs the PCAOB to set audit-documentation retention standards — the auditing-standards
counterpart to §802's records obligation.)

### §906 — Criminal certification by corporate officers (18 U.S.C. §1350)
A separate CEO/CFO certification that the periodic report fully complies with the Exchange Act and
fairly presents the financial condition — carrying **criminal penalties** for a knowing or willful
false certification. It raises the personal stakes behind the same control-and-evidence chain that
§302 and §404 establish.

---

## COSO 2013 — the control framework SOX assessments use

The SEC and PCAOB recognize the **COSO Internal Control – Integrated Framework (2013)** as the
suitable framework for evaluating ICFR. It has **5 components** and **17 principles**:

1. **Control Environment** (Principles 1–5) — integrity/ethics, board oversight, structure and
   authority, competence, accountability.
2. **Risk Assessment** (Principles 6–9) — objectives, risk identification, fraud risk, change.
3. **Control Activities** (Principles 10–12) — selecting control activities, **technology general
   controls (Principle 11)**, deploying through policy.
4. **Information & Communication** (Principles 13–15) — **relevant, quality information (Principle
   13)**, internal and external communication.
5. **Monitoring Activities** (Principles 16–17) — ongoing/separate evaluations, communicating
   deficiencies.

Two principles anchor this skill:
- **Principle 11 — "selects and develops general control activities over technology."** This is the
  COSO hook for **IT general controls**: access, change, and operations. Every ITGC control in
  `controls/` cites Principle 11.
- **Principle 13 — relevant information.** The **automated application controls** (premium-to-GL
  posting accuracy, interface control-total reconciliation) cite Principle 13 because they ensure the
  information flowing into the financial statements is complete and accurate.

---

## ITGC taxonomy — the three IT general control domains

IT general controls give assurance that the financial applications operate reliably and that the
**automated application controls** within them can be relied upon. The three domains:

- **Access (Logical Access Management).** Only authorized users have access, commensurate with their
  role, with conflicting duties segregated and elevated access monitored.
  Controls: **AC-01** (provisioning approved before grant), **AC-02** (periodic recertification),
  **AC-03** (privileged access logged and independently reviewed), **AC-04** (segregation of duties on
  financial roles), **AC-05** (timely deprovisioning of leavers).
- **Change Management.** Only authorized, reviewed changes reach financially-significant production,
  with duties segregated across the change lifecycle and emergency changes governed retroactively.
  Controls: **CM-01** (changes approved before promotion), **CM-02** (no self-approval / self-deploy),
  **CM-03** (emergency changes follow retroactive governance).
- **Operations (Computer Operations).** Financial data is processed completely and on schedule, and
  is recoverable.
  Controls: **OP-01** (financially-relevant batch jobs monitored and failures resolved),
  **OP-02** (backups succeed and restores are periodically tested).

## Automated application controls

Controls **embedded in the financial application logic** rather than in the surrounding IT
environment — e.g., automated calculations, validations, postings, and interface reconciliations.
They can be relied on for ICFR **only if the supporting ITGCs are effective** (which is why access,
change, and operations controls underpin them).
Controls: **APP-01** (automated premium-to-GL posting is complete and accurate, evidenced by
independent recalculation with $0 unexplained variance), **APP-02** (system interfaces reconcile on
record counts and control totals so nothing is lost, duplicated, or altered in transit).

---

## PCAOB AS 2201 — the audit of ICFR

**Auditing Standard No. 2201, *An Audit of Internal Control Over Financial Reporting That Is
Integrated with an Audit of Financial Statements*** governs how the external auditor tests ICFR under
§404(b). It uses a **top-down, risk-based** approach: start at the financial-statement and
entity-level controls, focus on significant accounts and disclosures and their relevant assertions,
and test the controls — including **ITGCs and automated application controls** — that address those
assertions. It defines the deficiency hierarchy the auditor (and management) apply:

- **Control deficiency** — a control does not allow management or employees to prevent or detect
  misstatements on a timely basis.
- **Significant deficiency** — important enough to merit attention by those responsible for oversight.
- **Material weakness** — a reasonable possibility that a material misstatement will not be prevented
  or detected on a timely basis; a material weakness means ICFR is **not effective**.

Engineering relevance: AS 2201 is why the controls in `controls/` must be **reproducible,
independently reviewable, and evidenced** — the auditor will re-perform or inspect them. Deficiency
**severity classification is the auditor's and management's judgement, not engineering's.**

---

## How the obligations map to the control library (summary)

| Obligation | Controls |
|---|---|
| §404 / COSO Principle 11 — ITGC Access | AC-01, AC-02, AC-03, AC-04, AC-05 |
| §404 / COSO Principle 11 — ITGC Change | CM-01, CM-02, CM-03 |
| §404 / COSO Principle 11 — ITGC Operations | OP-01, OP-02 |
| §404 / COSO Principle 13 — Automated application controls | APP-01, APP-02 |
| §302 / SEC Rule 13a-14 — disclosure sub-certifications | ELC-302-01 |
| §404 / AS 2201 / COSO 2013 — ICFR assessment & matrix testing | ELC-404-01 |
| §802 / §103 / 17 CFR 210.2-06 — records retention & legal holds | RET-802-01 |

## Sources
- Sarbanes-Oxley Act of 2002, Public Law 107-204 (codified across 15 U.S.C. and 18 U.S.C.).
- SEC Rule 13a-14 (§302 certifications); 17 CFR 210.2-06 (retention of audit/review records, 7 years).
- COSO, *Internal Control – Integrated Framework* (2013).
- PCAOB Auditing Standard No. 2201 (formerly AS No. 5).
