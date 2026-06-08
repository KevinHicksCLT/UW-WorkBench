# CCPA / CPRA — Source Reference

**Instrument:** California Consumer Privacy Act of 2018 (CCPA), Cal. Civ. Code §§ 1798.100–1798.199,
as amended by the **California Privacy Rights Act of 2020 (CPRA)**, plus the California Privacy
Protection Agency (CPPA) implementing regulations at 11 CCR § 7000 et seq.
**CCPA operative:** 1 January 2020. **CPRA amendments operative:** 1 January 2023 (enforcement from
1 July 2023; the employee/HR and B2B exemptions **expired** 1 January 2023, so those records are now
in scope).
**2025 CPPA regulations (ADMT, risk assessments, cybersecurity audits):** approved by the Office of
Administrative Law on 23 September 2025; **effective 1 January 2026**, with phased compliance dates
below. The same rulemaking **clarified when insurance companies must comply with the CCPA**.
**Regulator:** California Privacy Protection Agency (CPPA) + California Attorney General.
**Authoritative text:** https://cppa.ca.gov/regulations/ and https://oag.ca.gov/privacy/ccpa

> Operational extraction, not legal text. Obligations are paraphrased into engineering-actionable
> language with statute/reg citations. Privacy Officer / Legal own interpretation — engineering
> guidance, not legal advice.

---

## Who it applies to (scope gates)

- **Business (§1798.140(d)):** a for-profit entity doing business in California that determines the
  purposes/means of processing and meets **any one** threshold: (1) > **$25M** gross annual revenue
  (prior calendar year); (2) annually buys, sells, or shares the PI of **100,000+** consumers or
  households; or (3) derives **50%+** of annual revenue from selling or sharing PI.
- **Personal Information / PI (§1798.140(v)):** information that identifies, relates to, or could
  reasonably be linked with a consumer or household. Broader than GDPR's "personal data" in some
  respects (household-level).
- **Sensitive Personal Information / SPI (§1798.140(ae)):** SSN, driver's licence/state ID/passport;
  financial account + access credentials; precise geolocation; racial/ethnic origin, religious/
  philosophical beliefs, union membership; contents of mail/email/texts not directed to the business;
  genetic data; biometric data for unique ID; **health**; sex life / sexual orientation.
- **Roles:** *business*, *service provider*, *contractor*, *third party* — each with distinct
  contractual obligations (§1798.100(d), §1798.140).

> **Insurance interplay (critical — see README):** the CCPA exempts PI collected/processed/disclosed
> pursuant to the **federal Gramm-Leach-Bliley Act (GLBA)** and the California Financial Information
> Privacy Act (§1798.145(e)). This exemption is **information-level, not entity-level** — an insurer
> still has CCPA obligations for PI outside GLBA scope (website visitors, prospects, marketing, and —
> since the 2023 sunset — employees, applicants, and B2B contacts). The 2025 rulemaking further
> clarified insurer obligations. Do **not** assume the whole carrier is exempt.

---

## Consumer rights (the engineering surface)

- **Right to Know / Access (§1798.100, .110, .115):** categories and **specific pieces** of PI;
  sources; purposes; third parties. Look-back ≥ 12 months (and beyond, for data collected on/after
  1 Jan 2022, unless impossible or disproportionate).
- **Right to Delete (§1798.105):** delete PI and **direct service providers/contractors to delete**.
- **Right to Correct (§1798.106):** correct inaccurate PI (CPRA-new).
- **Right to Opt-Out of Sale/Sharing (§1798.120, §1798.135):** "Do Not Sell or Share My Personal
  Information." **"Sharing"** specifically means disclosure for **cross-context behavioral
  advertising** (CPRA-new concept).
- **Right to Limit Use/Disclosure of SPI (§1798.121):** "Limit the Use of My Sensitive Personal
  Information" to what's necessary to provide the service (CPRA-new).
- **Opt-Out Preference Signals / GPC (11 CCR §7025):** businesses must treat a **Global Privacy
  Control** signal as a valid opt-out of sale/sharing.
- **Right to Non-Discrimination (§1798.125):** no penalising consumers for exercising rights; rules
  for financial incentives.
- **Rights re: ADMT (2025 regs):** pre-use **notice**, **opt-out**, **access**, and **appeal** when
  ADMT is used for a **"significant decision"** about a consumer (compliance by **1 Jan 2027**).
- **Minors (§1798.120(c)):** opt-**in** required to sell/share PI of consumers under 16 (13–15 by the
  consumer; under 13 by a parent).

### Request mechanics (§1798.130; 11 CCR §7020–7022)
At least two designated methods; verify the requester; **acknowledge within 10 business days**;
**respond within 45 calendar days**, extendable once by 45 (90 total) with notice.

---

## Business obligations

- **Notice at Collection (§1798.100(a)):** at or before collection — categories of PI/SPI, purposes,
  retention periods, and whether sold/shared.
- **Privacy Policy (§1798.130, §1798.135):** comprehensive, updated at least every **12 months**.
- **Data Minimization & Purpose Limitation (§1798.100(c)):** collection/use/retention **reasonably
  necessary and proportionate** to the disclosed purposes.
- **Storage Limitation (§1798.100(a)(3)):** disclose and enforce retention per category; no indefinite retention.
- **Reasonable Security (§1798.100(e)):** implement reasonable security procedures appropriate to the
  PI. **Private right of action (§1798.150):** consumers may sue for breaches of nonencrypted/
  nonredacted PI caused by failure to maintain reasonable security — statutory damages **$100–$750
  per consumer per incident** (the only private right of action under the CCPA).
- **Service-provider/contractor/third-party contracts (§1798.100(d), §1798.140):** required terms
  limiting use to specified purposes, prohibiting sale, requiring deletion/flow-down, and allowing
  compliance verification.

### 2025 CPPA regulations (new operational obligations)
- **Risk Assessments:** a **written risk assessment before high-risk processing** — selling/sharing
  PI, processing SPI, using ADMT for significant decisions, training ADMT, or automated processing to
  infer sensitive traits. Must document purposes, benefits, foreseeable risks, safeguards, collection
  process, retention, consumers impacted, and disclosures. **Comply from 1 Jan 2026; submit
  documentation to the CPPA by 1 April 2028** (for 2026–2027 assessments), annually thereafter.
- **ADMT:** for ADMT that **substantially replaces human decision-making** in a significant decision
  — pre-use notice, opt-out, access, and appeal. **Comply by 1 Jan 2027.**
- **Cybersecurity Audits:** businesses meeting thresholds must complete an **annual independent
  cybersecurity audit** and submit a **certification to the CPPA** on a revenue-phased schedule:
  **> $100M → first certification by 1 April 2028** (covering 2027); $50–100M → 1 April 2029;
  < $50M → 1 April 2030; annual thereafter.

---

## Enforcement
- Civil penalties up to **$2,500 per violation** / **$7,500 per intentional violation or violation
  involving minors' PI** (§1798.155). CPRA **removed the 30-day cure period** as a matter of right.
  Enforced by the CPPA and the California AG; plus the §1798.150 breach private right of action.

---

## Sources
- CPPA regulations hub: https://cppa.ca.gov/regulations/
- CPPA 2025 final rulemaking (ADMT, risk assessments, cyber audits, insurance): https://cppa.ca.gov/regulations/ccpa_updates.html
- California AG CCPA: https://oag.ca.gov/privacy/ccpa
