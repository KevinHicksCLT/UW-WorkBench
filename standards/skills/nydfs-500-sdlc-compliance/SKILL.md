---
name: nydfs-500-sdlc-compliance
description: >
  Enforce and evidence NYDFS 23 NYCRR Part 500 (the New York Department of Financial Services
  Cybersecurity Regulation) across the software delivery lifecycle — requirements, design,
  development, and testing — for any system built by or for a Covered Entity that handles Nonpublic
  Information (NPI). Use this skill whenever delivery work touches NPI, access control, MFA,
  encryption, audit trails/logging, vulnerability management, penetration testing, secure
  development, asset inventory, data disposal, backups, or incident response — even if the user does
  not say "NYDFS" or "Part 500." Also use when writing user stories, architecture/design docs, APIs,
  or test plans for financial-services systems, and whenever the goal is to produce evidence that
  backs the annual Certification of Material Compliance (§500.17(b)). When unsure whether a system is
  in scope, run the scope gate in this skill rather than skipping it.
---

# NYDFS Part 500 Across the SDLC — Build-Time Controls and Certification Evidence

## What this skill does — and its honest boundary

Part 500 is **mostly an operational, program-level regulation**: governance, a written program and
policies, risk assessment, third-party management, incident notification, BCDR, and an annual
certification. Only a **subset is enforceable at build time** in the SDLC — but it is a substantial
subset, and it is exactly where engineering can either create or destroy the evidence that backs the
certification.

This skill enforces the **build-time sections** as SDLC gates and routes the rest to a **Run
handoff**:

| Enforced as SDLC gates (build-time) | Routed to Run / program (not a build gate) |
|---|---|
| 500.5 Vulnerability mgmt · 500.6 Audit trail · 500.7 Access · 500.8 App security · 500.12 MFA · 500.13 Asset inventory & disposal · 500.14 Monitoring/malicious-code · 500.15 Encryption · 500.16 IR/BCDR hooks | 500.2 Program · 500.3 Policy · 500.4 Governance · 500.9 Risk assessment · 500.10 Personnel · 500.11 Third-party · 500.17 Notices & certification |

> **Do not let "we have an SDLC skill" stand in for "we comply with Part 500."** The full obligation
> lives in the app's standards set (`../app-integration/`). This skill secures the engineering slice
> and feeds the evidence engine.

Source obligations are in `references/nydfs-500-reference.md`; a one-line-per-section cheat sheet is in
`references/nydfs-500-section-quick-reference.md`.

## Operating principle (read once, apply always)

> **A certification is only as strong as the evidence behind the signature.**
> §500.17(b) now requires the **highest-ranking executive *and* the CISO** to personally sign an
> annual Certification of Material Compliance — backed by *data and documentation sufficient to
> demonstrate* it, **retained 5 years**. Every build-time control must therefore leave a stored,
> retrievable artifact. A control with no artifact weakens that signature.

Maintain one **Part 500 Compliance Record** per system/feature (a living doc or ticket-linked
record). The four gates write into it. Template + the section→evidence→retention crosswalk are in
`references/audit-evidence-map.md`.

## STEP 0 — Scope gate (always run first)

1. **Covered Entity?** Is the system built by/for an entity licensed or authorized under NY Banking,
   Insurance, or Financial Services Law? (A NY-authorized insurer qualifies even if HQ'd elsewhere.)
2. **NPI? (§500.1(k))** Does the system store, process, or transmit Nonpublic Information — material
   business information, personal identifiers combined with SSN/licence/financial/security codes/
   biometrics, or health information?
3. **Class A? (§500.1(d))** Is the entity Class A (≥ $20M NY revenue + > 2,000 employees or > $1B
   revenue across affiliates)? If yes, the **Class A extras** apply: independent program audit,
   privileged-access-management solution, EDR + centralized logging/SIEM, external-expert pen testing.
4. **Limited exemption? (§500.19(a))** Only if < 20 employees / < $7.5M NY revenue / < $15M assets —
   exempts a *subset* of sections, not all. Rare for a real carrier.

- If **not a Covered Entity or no NPI** → record the determination (with rationale + date) and stop.
- If **in scope** → walk the four gates; apply Class A extras where flagged.
- If **unsure** → treat as in-scope and escalate to the CISO.

## The four phase gates

Each gate lists the **mandatory checks** and the **evidence** each must leave behind. Open the
matching reference for the full checklist and insurance examples. A phase is not "done" until its
evidence exists in the Part 500 Compliance Record.

### 1. Requirements → `references/requirements-phase.md`
- Identify and classify all **NPI** the system will handle (§500.1(k)); this scopes every other control.
- Capture access needs (who/what, least privilege), retention/disposal needs, and whether the system
  enters the **asset inventory** (§500.13(a)).
- Note applicable risks for the risk assessment (§500.9) and any **third-party** involvement (§500.11).
- Capture the secure-development requirement (§500.8) as acceptance criteria.
- **Evidence:** NPI classification, access/retention requirements, asset-inventory entry intent, secure-dev acceptance criteria.

### 2. Design → `references/design-phase.md`
- Secure design per the written secure-development standards (§500.8).
- **Access & privileged accounts** (§500.7): least privilege, limited/segregated privileged accounts,
  remote-control protocols disabled, joiner/mover/leaver handling.
- **MFA** (§500.12) for all access paths; **encryption** in transit and at rest (§500.15).
- **Audit-trail** design (§500.6) and **monitoring / malicious-code** controls (§500.14).
- **Secure disposal** design (§500.13(b)); **backup & recovery** touchpoints feeding IR/BCDR (§500.16).
- Register the system in the **asset inventory** with owner/location/classification/support-expiry/RTO.
- Class A: PAM, EDR + SIEM reflected in the design.
- **Evidence:** design records mapping each control to its section, asset-inventory record, transfer-to-Run notes.

### 3. Development → `references/development-phase.md`
- Implement per the secure-development standards (§500.8); SAST/SCA/secret-scan clean before merge (§500.5).
- Implement access controls & MFA (§500.7, §500.12), encryption (§500.15), and **audit trails** that
  capture access to NPI with the required retention (§500.6).
- Implement malicious-code / monitoring hooks (§500.14) and secure-disposal routines (§500.13(b)).
- **Evidence:** control→code map, audit-log samples, scan results, PR approvals citing the controls.

### 4. Testing → `references/testing-phase.md`
- **Penetration testing from inside and outside** boundaries and **automated scans + manual review**;
  verify **timely, risk-prioritized remediation** (§500.5).
- Verify MFA on every access path, encryption in transit/at rest, least-privilege enforcement, and
  that **audit trails actually capture** the required events for the required retention.
- Verify secure disposal removes NPI; verify **backup-restore** works (§500.16(d)(2)).
- Exercise the **incident-response** runbook hook (detection → the 72-hour notification process, §500.17(a)).
- Class A: confirm EDR/SIEM signals fire.
- **Evidence:** tests mapped to sections, pass results with timestamps, pen-test/scan reports, restore-test record.

## Run / operate handoff (not a build gate, but you must hand these off)
Program (§500.2), policy approval (§500.3), governance & CISO reporting (§500.4), risk-assessment
cadence (§500.9), personnel/training (§500.10, §500.14(a)(3)), third-party reassessment (§500.11),
**72-hour incident notice** (§500.17(a)), **24h/30-day extortion-payment notice** (§500.17(c)), and
the **April 15 Certification of Material Compliance** (§500.17(b)). Each needs a named owner and a
telemetry signal — see `references/audit-evidence-map.md`.

## How to use this skill in practice
- **Reviewing/authoring an artifact:** load the matching phase reference, run its checklist, write
  missing items + evidence pointers into the Part 500 Compliance Record.
- **New system kickoff:** run STEP 0, walk all four gates, build the record as you go.
- **Certification prep:** open `references/audit-evidence-map.md`; confirm every build-time control
  has a stored, in-date, 5-year-retained artifact and a live telemetry signal before the executive
  and CISO sign.

## Boundaries
Engineering guidance, not legal advice. The Class A determination, certification language, breach
materiality calls, and §500.17 notification decisions are CISO/Legal judgement. This skill enforces
the build-time controls and produces evidence; it does not replace the program-level obligations.
