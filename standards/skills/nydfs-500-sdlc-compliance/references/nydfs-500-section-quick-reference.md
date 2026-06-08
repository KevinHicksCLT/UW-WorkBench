# NYDFS Part 500 Section Quick Reference (as amended)

One line per section. Full obligations in `../../source/nydfs-500-reference.md`; authoritative text at
https://www.dfs.ny.gov/industry_guidance/cybersecurity.

## Definitions & scope
- **500.1** — Definitions: Covered Entity, **NPI**, **Class A company**, CISO, **Cybersecurity incident**, Privileged account, Senior governing body, TPSP.

## Program & governance (mostly Run)
- **500.2** — Cybersecurity program (6 core functions); Class A independent audits.
- **500.3** — Written policy approved ≥ annually by senior officer/senior governing body.
- **500.4** — Cybersecurity governance: CISO + annual report + senior-governing-body oversight.
- **500.9** — Risk assessment, reviewed/updated ≥ annually and on material change.
- **500.10** — Qualified personnel + training + threat intelligence.
- **500.11** — Third-party service provider security policy + periodic reassessment.

## Build-time controls (the SDLC surface)
- **500.5** — Vulnerability management: pen test (inside+outside) ≥ annually; scans + manual review; timely risk-based remediation.
- **500.6** — Audit trail: financial reconstruction (5y) + event detection (3y).
- **500.7** — Access privileges & management: least privilege; limit privileged accounts; annual review; prompt termination; password policy; Class A PAM.
- **500.8** — Application security: secure-development procedures; evaluate external apps; CISO review ≥ annually.
- **500.12** — MFA for any individual accessing any information system; CISO compensating controls reviewed ≥ annually.
- **500.13** — (a) Asset inventory (owner/location/classification/support-expiry/RTO); (b) secure disposal of NPI.
- **500.14** — Monitoring of users; malicious-code protection (web/email filtering); annual training incl. social engineering; Class A EDR + SIEM.
- **500.15** — Written encryption policy (industry standard) in transit + at rest; CISO compensating controls reviewed ≥ annually.
- **500.16** — Incident response + BCDR; protected backups; annual test of plans + restore.

## Notices & accountability (Run — the audit hooks)
- **500.17(a)** — Notify superintendent ≤ 72h of a cybersecurity incident (incl. at affiliates/TPSP).
- **500.17(b)** — By April 15: Certification of Material Compliance **or** Acknowledgment of noncompliance; signed by highest-ranking executive **and** CISO; 5-year records.
- **500.17(c)** — Extortion payment: notice within 24h; written explanation incl. OFAC diligence within 30 days.

## Exemptions & enforcement
- **500.19** — Limited exemption (< 20 employees / < $7.5M NY revenue / < $15M assets) — partial, not total.
- **500.20** — Enforcement by the superintendent; NIST CSF alignment may be considered.
- **500.22** — Transitional periods (Second Amendment fully phased in by 1 Nov 2025).

## Class A extras (if §500.1(d) applies)
Independent program audit (500.2(c)) · PAM + password blocking (500.7(c)) · EDR + centralized logging/SIEM (500.14(b)) · external-expert pen testing (500.5).
