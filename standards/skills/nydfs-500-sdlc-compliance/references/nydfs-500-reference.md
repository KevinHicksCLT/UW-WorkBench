# NYDFS 23 NYCRR Part 500 — Source Reference (Second Amendment)

**Instrument:** 23 NYCRR Part 500 — *Cybersecurity Requirements for Financial Services Companies*,
New York State Department of Financial Services (NYDFS).
**Original effective:** 1 March 2017.
**Second Amendment adopted:** 1 November 2023, with staggered transition periods.
**Fully in force:** the final tranche (full MFA under §500.12 and asset inventory under §500.13(a))
took effect **1 November 2025** — so as of today every provision below applies.
**Authoritative text:** https://www.dfs.ny.gov/industry_guidance/cybersecurity (Part 500 + amendment text).

> This file is an *operational extraction*, not the legal text. Section obligations are paraphrased
> into engineering-actionable language with section references for traceability. The binding text is
> the version published by NYDFS. CISO/Legal sign-off governs interpretation — this is engineering
> guidance, not legal advice.

---

## Who it applies to (scope gates)

- **Covered Entity (§500.1(e)):** any person operating under (or required to operate under) a
  license, registration, charter, certificate, permit, accreditation or similar authorization under
  the NY **Banking Law, Insurance Law, or Financial Services Law** — regardless of other regulators.
  A licensed/authorized insurer doing business in NY is a Covered Entity even if headquartered
  elsewhere.
- **Nonpublic Information / NPI (§500.1(k)):** (1) business information whose compromise would
  materially harm the entity; (2) personal data where an identifier combines with SSN, driver's
  licence, financial account/card number, security/access code, or biometric record; and (3) health
  information (except age/gender) derived from a provider or individual.
- **Class A company (§500.1(d)):** ≥ $20M gross annual revenue (each of last 2 FYs) from the entity's
  and its NY affiliates' operations, **and** either > 2,000 employees (avg last 2 FYs, incl.
  affiliates) **or** > $1B gross annual revenue (each of last 2 FYs, incl. affiliates). Class A
  triggers extra controls (independent audit, PAM, EDR + centralized logging, external pen testing).
- **Limited exemption (§500.19(a)):** < 20 employees, **or** < $7.5M NY-business gross revenue (last
  3 FYs), **or** < $15M year-end total assets — exempts a defined subset of sections (NOT all).

---

## Section map (as amended)

| Section | Title (amended) | Build / Run |
|---|---|---|
| 500.1 | Definitions | — |
| 500.2 | Cybersecurity Program (+ Class A independent audits) | Run |
| 500.3 | Cybersecurity Policy (annual senior approval) | Run |
| 500.4 | **Cybersecurity Governance** (CISO + senior governing body oversight) | Run |
| 500.5 | **Vulnerability Management** (pen test + scans + remediation) | Build/Run |
| 500.6 | Audit Trail | Build/Run |
| 500.7 | **Access Privileges and Management** (incl. privileged accounts) | Build/Run |
| 500.8 | Application Security (secure SDLC) | Build |
| 500.9 | Risk Assessment (≥ annual) | Run |
| 500.10 | Cybersecurity Personnel and Intelligence | Run |
| 500.11 | Third-Party Service Provider Security | Run |
| 500.12 | Multi-Factor Authentication (all access) | Build/Run |
| 500.13 | **Asset Management and Data Retention** (inventory + disposal) | Build/Run |
| 500.14 | **Monitoring and Training** (+ malicious-code, Class A EDR/SIEM) | Build/Run |
| 500.15 | Encryption of Nonpublic Information | Build/Run |
| 500.16 | **Incident Response and Business Continuity Management** | Build/Run |
| 500.17 | Notices to Superintendent (72h, ransomware, certification) | Run |
| 500.18–500.24 | Confidentiality, exemptions, enforcement, effective dates, severability | — |

---

## Section obligations — operational view

### Program & governance
- **§500.2 — Cybersecurity Program.** Maintain a risk-based program performing six core functions:
  identify, protect, detect, respond, recover, and **fulfil regulatory reporting**. **Class A** must
  design and conduct **independent audits** of the program.
- **§500.3 — Cybersecurity Policy.** Written policy/policies approved **at least annually** by a
  senior officer or the senior governing body, covering (among others) data governance/classification/
  **retention**, **asset inventory & end-of-life**, access incl. **remote access**, BCDR, network
  security & monitoring, **security awareness & training**, **application security & development/QA**,
  vendor management, risk assessment, incident response **& notification**, and **vulnerability
  management**.
- **§500.4 — Cybersecurity Governance.** Designate a **CISO**; CISO reports **in writing at least
  annually** to the senior governing body and **timely** on material issues (significant events,
  significant program changes); the **senior governing body must exercise oversight** (sufficient
  understanding, require management to maintain the program, review reports, confirm resources).
- **§500.9 — Risk Assessment.** Documented, periodic; **reviewed and updated at least annually** and
  whenever a business/technology change materially changes cyber risk.
- **§500.10 — Personnel & Intelligence.** Qualified staff, training, current threat knowledge.

### Build-time controls (the SDLC surface)
- **§500.5 — Vulnerability Management.** Written policies that ensure: **penetration testing from
  inside and outside** system boundaries by a qualified party **at least annually**; **automated
  scans + manual review** at a risk-based frequency and **after material system changes**; a process
  to learn of new vulnerabilities; and **timely, risk-prioritized remediation**.
- **§500.6 — Audit Trail.** Systems to reconstruct material financial transactions (**retain ≥ 5
  years**) and audit trails to detect/respond to material cybersecurity events (**retain ≥ 3 years**).
- **§500.7 — Access Privileges & Management.** Least privilege; **limit number and scope of
  privileged accounts** and use them only when required; **review all access ≥ annually** and remove/
  disable unnecessary; **disable remote-control protocols**; **promptly terminate access on
  departure**; **password policy meeting industry standards**. **Class A:** privileged-access
  management solution + automated blocking of commonly used passwords.
- **§500.8 — Application Security.** Written **secure-development** procedures/standards for in-house
  applications, and procedures to evaluate/assess/test the security of **externally developed**
  applications; **reviewed at least annually** by the CISO or qualified designee.
- **§500.12 — Multi-Factor Authentication.** MFA for **any individual accessing any information
  system** (limited-exemption entities: at least remote access, remote third-party apps exposing NPI,
  and privileged accounts). CISO may approve equivalent/stronger compensating controls, **reviewed at
  least annually**.
- **§500.13 — Asset Management & Data Retention.** (a) Written policies to produce/maintain a
  complete, accurate **asset inventory** tracking owner, location, classification/sensitivity,
  support-expiration date, and recovery-time objectives, plus update frequency. (b) Policies for
  **secure periodic disposal** of NPI no longer needed (unless retention is legally required or
  targeted disposal is infeasible).
- **§500.14 — Monitoring & Training.** Monitor authorized-user activity to detect unauthorized
  access/use/tampering; **protect against malicious code** including web-traffic and email filtering;
  **annual security-awareness training including social engineering**. **Class A:** endpoint
  detection & response (EDR) + a centralized logging / security-event-alerting (SIEM) solution.
- **§500.15 — Encryption of NPI.** **Written encryption policy meeting industry standards** for NPI
  in transit over external networks and at rest; where at-rest encryption is infeasible, CISO-approved
  compensating controls **reviewed at least annually**.
- **§500.16 — Incident Response & BCDR.** Written **incident response** plan(s) (addressing goals,
  internal processes, roles/authority, communications, remediation, documentation, **recovery from
  backups**, and a **root-cause analysis**); written **business continuity & disaster recovery**
  plan(s); **maintain protected backups**; distribute plans; train responders; **test IR + BCDR plans
  and backup-restore at least annually**.

### Notifications & accountability (the audit hooks)
- **§500.11 — Third-Party Service Providers.** Written TPSP policies: identification/risk assessment,
  minimum required practices, due diligence, and **periodic reassessment**; contractual guidelines on
  the provider's MFA, encryption, and breach-notice obligations.
- **§500.17(a) — 72-hour notice.** Notify the superintendent **no later than 72 hours** after
  determining a **cybersecurity incident** has occurred — including incidents at affiliates or
  third-party service providers — with a continuing duty to update.
- **§500.17(c) — Extortion / ransomware payment.** Notify within **24 hours** of an extortion
  payment, and within **30 days** provide a written explanation including alternatives considered and
  **OFAC** compliance diligence.
- **§500.17(b) — Annual Certification.** By **April 15**, submit **either** a Certification of
  **Material Compliance** (based on data/documentation sufficient to demonstrate it) **or** a written
  **Acknowledgment of noncompliance** identifying gaps and a remediation timeline — **signed by the
  highest-ranking executive and the CISO**. Retain supporting records **5 years**.

### Enforcement
- **§500.20 — Enforcement.** Enforced by the superintendent; in assessing penalties NYDFS may
  consider alignment with recognized frameworks (e.g., **NIST CSF**). NYDFS has actively pursued
  enforcement actions and consent orders against Covered Entities.

---

## Sources
- NYDFS Cybersecurity Resource Center / Part 500: https://www.dfs.ny.gov/industry_guidance/cybersecurity
- Original Part 500 text (pre-amendment): https://www.dfs.ny.gov/system/files/documents/2023/03/23NYCRR500_0.pdf
- Second Amendment text (operative redline): https://www.dfs.ny.gov/system/files/documents/2023/10/rf_fs_2amend23NYCRR500_text_20231101.pdf
