# CCPA / CPRA Compliance Project — Meridian Insurance Group

California's consumer privacy regime — the **CCPA as amended by the CPRA**, plus the **2025 CPPA
regulations** on automated decision-making, risk assessments, and cybersecurity audits (effective
1 Jan 2026) — extracted, structured, and turned into two things you can use:

1. **App integration** — 22 CCPA/CPRA standards formatted for the Transformation Bridge Standards area.
2. **SDLC agent skill** — markdown that enforces privacy-by-design across requirements, design,
   development, and testing, and produces the evidence behind the CPPA risk assessments and the annual
   cybersecurity-audit certification.

> "CCA" read as **CCPA/CPRA** — California's flagship privacy law and the natural California analog to
> the GDPR and NYDFS packs. If you actually meant a different California instrument (e.g., the
> Insurance Information and Privacy Protection Act, Ins. Code §791), say the word and I'll redo it.

## Contents

```
ccpa-cpra-compliance-meridian/
├── README.md                          ← you are here
├── source/
│   └── ccpa-cpra-reference.md         ← extracted regime: scope, rights, obligations, 2025 regs
├── app-integration/                   ← GOAL #1
│   ├── ccpa-cpra-standards.json
│   ├── ccpa-cpra-standards.csv
│   └── INTEGRATION-NOTES.md
└── sdlc-ccpa-skill/                   ← GOAL #2 (an installable agent skill)
    ├── SKILL.md
    └── references/
        ├── requirements-phase.md
        ├── design-phase.md
        ├── development-phase.md
        ├── testing-phase.md
        ├── audit-evidence-map.md
        └── ccpa-cpra-quick-reference.md
```

Same structure as the GDPR and NYDFS packs — the three sit side by side.

## Goal #1 — Integrate into Transformation Bridge
Load `app-integration/ccpa-cpra-standards.csv` (or `.json`) as a new **Data Privacy (CCPA/CPRA)**
category under **Cybersecurity & ISO**. Read `INTEGRATION-NOTES.md` first — confirm the import schema
and, above all, the **GLBA-exemption mapping**.

## Goal #2 — Use as an SDLC agent skill
`sdlc-ccpa-skill/` follows the Anthropic Skill format. It triggers when delivery work touches
California PI/SPI, consumer rights, opt-out/GPC signals, ADMT, minimization, retention, reasonable
security, or service-provider sharing, and walks the agent through **scope gate → requirements →
design → development → testing**, writing evidence into a per-feature **CCPA Compliance Record**. The
`audit-evidence-map.md` ties every control to a citation, an evidence artifact, and a telemetry signal.

---

## Devil's advocate — read before you bank on this (you asked me to flag blind spots)

1. **The GLBA exemption is the whole ballgame for an insurer — and it's a trap in both directions.**
   The CCPA exempts PI collected/processed/disclosed under GLBA (§1798.145(e)), so much of Meridian's
   *customer* PI may be exempt. But the exemption is **information-level, not entity-level**:
   non-GLBA PI — website visitors, prospects, marketing data, and (since the employee/HR and B2B
   exemptions **sunset on 1 Jan 2023**) employees, applicants, and B2B contacts — is fully in scope.
   Over-claim the exemption and you under-build; ignore it and you over-build. Notably, the **2025
   CPPA rulemaking specifically clarified when insurers must comply** — so this is freshly contested
   ground. Map data flows to GLBA-covered vs not before anything else (it's standard `ccpa-001`).

2. **California is no longer "just notices and opt-outs."** The 2025 regs add a **risk-assessment**
   regime (a DPIA analog), **ADMT** rules (a GDPR-Art.-22 analog), and an **annual independent
   cybersecurity audit with CPPA certification** (a NYDFS-500.17 analog). California has quietly
   converged toward GDPR + NYDFS. Treating CCPA as a cookie-banner exercise badly understates it now.
   Live dates: risk assessments **now**; ADMT by **1 Jan 2027**; cyber-audit certification from
   **1 Apr 2028** for the > $100M cohort (likely Meridian).

3. **ADMT is the highest-risk, highest-overlap surface.** Automated underwriting/pricing/claims that
   "substantially replace human decision-making" trigger ADMT notice/opt-out/access/appeal **and** a
   mandatory risk assessment — and overlap GDPR Art. 22 and the EU AI Act. This is the area most
   likely to be under-built and most likely to draw enforcement. Get actuarial/data science in the room.

4. **The opt-out model inverts GDPR's instincts.** GDPR leans opt-in/consent; California leans
   **opt-out + honor-the-signal (GPC)**. A team porting GDPR patterns may wrongly require consent
   where California requires a working opt-out, or — worse — ignore the **Global Privacy Control**
   browser signal, which is itself a violation. The skill calls this out explicitly.

5. **CCPA ≠ all of California, and California ≠ all of the US.** California also has the Insurance
   Information and Privacy Protection Act for insurers specifically, and there's active legislative
   effort to expand insurer privacy rules. Beyond California, ~20 states now have comprehensive
   privacy laws with their own quirks. The smart move is a **shared control library with regime tags**
   (see below), not 50 bespoke skills.

> Power phrase for the C-suite: **"In California, silence isn't consent — a missed opt-out is a
> violation."** It captures why the GPC signal and the opt-out plumbing, not the privacy banner, are
> the real engineering deliverable.

## The three packs together (GDPR + NYDFS + CCPA/CPRA)
You now have parallel packs for three regimes. They overlap on encryption, access, deletion,
retention, third-party, and automated decisions — but diverge on model (consent vs certification vs
opt-out), triggers, deadlines, and evidence format. **Recommended next step:** a single
**control-library crosswalk** that maps each shared control to GDPR articles, NYDFS sections, and CCPA
citations, so you *implement once and evidence to all three*, while keeping the filings/certifications
separate. Say the word and I'll build it.

---

## Sources
- CPPA regulations: https://cppa.ca.gov/regulations/
- CPPA 2025 rulemaking (ADMT, risk assessments, cyber audits, insurer scope): https://cppa.ca.gov/regulations/ccpa_updates.html
- California AG CCPA: https://oag.ca.gov/privacy/ccpa
