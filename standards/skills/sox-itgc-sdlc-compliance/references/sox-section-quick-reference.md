# SOX Section / COSO / ITGC Quick Reference

One line per item. Full obligations in `sox-reference.md`. Binding text is the U.S. Code and
SEC/PCAOB rules; this is engineering shorthand, not legal interpretation.

## Statutory sections (the certification & records spine — mostly Run)
- **§302** — CEO/CFO quarterly/annual certification: reviewed the report, no material misstatement,
  responsible for and evaluated disclosure controls + ICFR, disclosed deficiencies. → ELC-302-01.
- **§404(a)** — Management's annual assessment of ICFR effectiveness. → ELC-404-01.
- **§404(b)** — External auditor attests to management's ICFR assessment (PCAOB AS 2201).
- **§409** — Real-time disclosure of material changes on a rapid and current basis (Form 8-K).
- **§802** — Records retention; criminal penalties for altering/destroying records (17 CFR 210.2-06 =
  7 years for audit/review records). → RET-802-01.
- **§103** — PCAOB sets audit-documentation retention standards (auditing-standards side of §802).
- **§906** — Separate CEO/CFO criminal certification that the report fairly presents the financials.

## COSO 2013 framework (the assessment lens)
- **5 components** — Control Environment · Risk Assessment · Control Activities · Information &
  Communication · Monitoring Activities.
- **17 principles** — the points-of-focus under the five components.
- **Principle 11** — selects and develops **general control activities over technology** = the ITGC
  hook (Access, Change, Operations). Cited by every ITGC control.
- **Principle 13** — uses **relevant, quality information** = the hook for automated application
  controls. Cited by APP-01 and APP-02.

## ITGC domains (the engineering surface)
- **Access** — only authorized, role-appropriate, segregated, monitored access.
  - **AC-01** Access provisioning approved before grant.
  - **AC-02** Periodic user access recertification (quarterly).
  - **AC-03** Privileged access logged in SIEM and independently reviewed.
  - **AC-04** Segregation of duties enforced on financial roles (conflicts mitigated).
  - **AC-05** Timely deprovisioning of terminated users (within SLA).
- **Change** — only authorized, independently-reviewed changes reach production.
  - **CM-01** Changes approved before promotion to production.
  - **CM-02** Developers cannot approve or deploy their own changes.
  - **CM-03** Emergency changes follow retroactive governance (post-implementation review).
- **Operations** — financial data processed completely, on schedule, and recoverable.
  - **OP-01** Financially-relevant batch jobs monitored; failures alerted and resolved.
  - **OP-02** Backups succeed and restores are periodically tested.

## Automated application controls (embedded in the application logic)
- **APP-01** Automated premium-to-GL posting is complete and accurate (independent recalculation,
  $0 unexplained variance).
- **APP-02** System interfaces reconcile on record counts and control totals (nothing lost,
  duplicated, or altered in transit).

## Entity-level & records controls (Run / program handoff)
- **ELC-302-01** Quarterly sub-certifications support the §302 certification.
- **ELC-404-01** ICFR control matrix complete, key controls owned and tested, deficiencies remediated.
- **RET-802-01** Financial-records retention (≥ 7 years), legal holds enforced, no premature deletion.

## PCAOB AS 2201 deficiency hierarchy (the auditor's / management's judgement)
- **Control deficiency** → **Significant deficiency** → **Material weakness** (ICFR not effective).
  Severity classification is **not** an engineering call.
