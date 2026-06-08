# Requirements Phase — GDPR Gate

**Purpose:** decide *what* personal data the system needs, *why*, on *what lawful basis*, and
*whose rights* it must serve — before a line of design exists. Most expensive privacy failures are
requirements failures (collecting data with no basis, no purpose, or no plan to delete it).

## Checklist

### A. Personal-data inventory
- [ ] List every data element the feature will collect, derive, or receive.
- [ ] For each, mark: identifies a person? (direct/indirect/pseudonymised), source, purpose.
- [ ] Flag **special-category data** (Art. 9): health, biometric, genetic, etc. In insurance this
      includes medical evidence, disability, and health questionnaires in underwriting and claims.
- [ ] Flag criminal-offence data (Art. 10) — e.g., fraud-investigation records.
- **Evidence:** data inventory table in the GDPR Compliance Record.

### B. Lawful basis per purpose (Art. 6)
- [ ] State each distinct **purpose** of processing.
- [ ] Assign one Art. 6 basis per purpose: consent / contract / legal obligation / vital interests /
      public task / legitimate interests.
- [ ] If **legitimate interests**, attach a Legitimate Interests Assessment (purpose, necessity,
      balancing against subject rights). Fraud prevention often relies on this (Recital 47).
- [ ] If **special-category data**, additionally identify the Art. 9(2) condition (e.g., explicit
      consent; insurance/social-security obligation; substantial public interest).
- **Evidence:** lawful-basis register entry (purpose → basis → rationale → approver).
- **Anti-pattern:** "we'll figure out the basis later" / using consent as a catch-all when the real
  basis is contract or legal obligation.

### C. Data-minimisation & purpose limitation (Art. 5)
- [ ] Challenge every field: is it *necessary* for the stated purpose? Remove "nice to have" data.
- [ ] Confirm no re-use for an incompatible secondary purpose without a new basis/notice.
- **Evidence:** minimisation decision log (fields considered and rejected, with reasons).

### D. Data-subject-rights requirements
- [ ] Write acceptance criteria for: access/DSAR (Art. 15), rectification (16), erasure (17),
      restriction (18), portability (20), objection (21).
- [ ] Note the one-month response expectation (Art. 12) as a non-functional requirement.
- **Evidence:** rights requirements captured as testable acceptance criteria on the stories.

### E. Transparency & retention
- [ ] Identify what privacy notice (Art. 13/14) the subject must see and when.
- [ ] Define a retention period per data category and the trigger for deletion/anonymisation (Art. 5(1)(e)).
- **Evidence:** notice requirement + retention schedule entry.

### F. DPIA screening (Art. 35)
- [ ] Run the screening questions: large-scale special-category data? systematic monitoring?
      **solely automated decisions with significant effect (Art. 22)?** new tech? vulnerable subjects?
- [ ] If any "yes" → raise a DPIA and assign the DPO; the DPIA must complete in the Design phase
      *before build*.
- **Evidence:** DPIA screening result (with the "no DPIA needed" rationale if negative).

## Insurance-specific prompts
- Automated or assisted **underwriting/pricing** → almost always Art. 22 + DPIA territory; capture
  the requirement for human review and logic explanation now.
- **Claims** routinely involve Art. 9 health data → heightened basis and safeguards from the start.
- Third-party data (credit, telematics, medical reports) → record the source and the Art. 14 notice
  obligation (data not obtained from the subject).

## Exit criteria
Requirements gate is complete when the Compliance Record contains: data inventory, lawful-basis
register entries, minimisation log, rights acceptance criteria, notice + retention requirements, and
a DPIA screening result. Anything missing blocks design sign-off.
