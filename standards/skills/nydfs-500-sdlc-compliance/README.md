# NYDFS 23 NYCRR Part 500 Compliance Project — Meridian Insurance Group

The NYDFS Cybersecurity Regulation (23 NYCRR Part 500, as amended by the Second Amendment — fully in
force since 1 Nov 2025) extracted, structured, and turned into two things you can use:

1. **App integration** — 22 Part 500 standards formatted for the Transformation Bridge Standards area.
2. **SDLC agent skill** — markdown that enforces the build-time subset of Part 500 across
   requirements, design, development, and testing, and produces the evidence behind the annual
   Certification of Material Compliance.

## Contents

```
nydfs-500-compliance-meridian/
├── README.md                          ← you are here
├── source/
│   └── nydfs-500-reference.md         ← extracted regulation: scope, section map, obligations
├── app-integration/                   ← GOAL #1
│   ├── nydfs-500-standards.json       ← 22 standards mapped to the Standards schema
│   ├── nydfs-500-standards.csv        ← same data, for bulk import
│   └── INTEGRATION-NOTES.md           ← field mapping, Class A note, load steps
└── sdlc-nydfs-skill/                  ← GOAL #2 (an installable agent skill)
    ├── SKILL.md                       ← scope gate + four phase gates + Run handoff
    └── references/
        ├── requirements-phase.md
        ├── design-phase.md
        ├── development-phase.md
        ├── testing-phase.md
        ├── audit-evidence-map.md      ← crosswalk + Compliance Record template (certification spine)
        └── nydfs-500-section-quick-reference.md
```

Same structure as the GDPR pack, so the two sit side by side.

## Goal #1 — Integrate into Transformation Bridge
Load `app-integration/nydfs-500-standards.csv` (or `.json`) as a new **NYDFS 23 NYCRR 500
(Cybersecurity)** category under **Cybersecurity & ISO**. Read `INTEGRATION-NOTES.md` first — confirm
the import schema and, critically, the **Class A determination**.

## Goal #2 — Use as an SDLC agent skill
`sdlc-nydfs-skill/` follows the Anthropic Skill format. It triggers when delivery work touches NPI,
access, MFA, encryption, audit trails, vulnerability management, secure development, asset inventory,
disposal, or incident response, and walks the agent through **scope gate → requirements → design →
development → testing**, writing evidence into a per-system **Part 500 Compliance Record**. The
`audit-evidence-map.md` ties every control to a section, an evidence artifact, a 5-year retention, and
a telemetry signal.

---

## Devil's advocate — read before you bank on this (you asked me to flag blind spots)

1. **Part 500 is mostly an operational program, not an SDLC.** The honest split: the SDLC skill
   covers the build-time sections (500.5, 500.6, 500.7, 500.8, 500.12, 500.13, 500.14, 500.15, 500.16)
   — call it ~40% of the obligation by section count and the part engineering owns. **Governance,
   risk assessment, third-party management, incident notification, and the certification are
   program-level** and live in the standards set, not the skill. Risk: "we shipped the SDLC skill" is
   mistaken for "we comply with Part 500." The README and SKILL.md both say this out loud; keep saying it.

2. **Confirm Class A first — it changes the build.** At Meridian's apparent scale (a multi-LOB
   carrier with a full C-suite), Class A status (§500.1(d)) is likely, which makes **independent
   audits, a PAM solution, EDR + centralized logging/SIEM, and external-expert pen testing**
   mandatory rather than optional. Scoping as non-Class-A and being wrong is an audit finding waiting
   to happen.

3. **The certification now has personal teeth.** Since the Second Amendment, §500.17(b) requires the
   **highest-ranking executive *and* the CISO to personally sign** an annual Certification of
   Material Compliance — or file an acknowledgment of noncompliance with a remediation plan, backed
   by 5 years of evidence. NYDFS has actively brought enforcement actions and consent orders. The
   entire value of the evidence layer is making that dual signature defensible. If the evidence isn't
   captured as a by-product of delivery, you're reconstructing it under deadline pressure every Q1.

4. **GDPR and Part 500 overlap but do not substitute.** Encryption, access, retention/disposal,
   third-party, and breach controls overlap — but Part 500 is **security/NPI-centric** (no
   data-subject rights, no DPIA, no lawful basis), while GDPR is **rights-centric**. Build a shared
   *control library* with regime tags so one implemented control (e.g., encryption at rest) evidences
   **both** §500.15 and GDPR Art. 32 — but keep the two **certifications/audits separate**, because
   the triggers and evidence differ (72h to the NYDFS superintendent vs 72h to an EU supervisory
   authority; a signed material-compliance certification vs a RoPA). I built the two packs as
   parallel, deliberately, so each maps cleanly to its own examiner.

5. **Part 500 ≠ all of your NY/US obligations.** It's cybersecurity. New York also has the **SHIELD
   Act**, and insurers face **Insurance Regulation 187** (best-interest), NAIC model laws, GLBA, and
   the growing state-privacy patchwork. Treating Part 500 as total coverage is the same trap as
   treating GDPR that way.

> Power phrase for the C-suite: **"A certification is only as strong as the evidence behind the
> signature."** In New York, that signature is now the CISO's *and* the CEO's — which is exactly why
> the evidence layer, not the policy binder, is the real deliverable.

---

## Sources
- NYDFS Cybersecurity Resource Center / Part 500: https://www.dfs.ny.gov/industry_guidance/cybersecurity
- Second Amendment text: https://www.dfs.ny.gov/system/files/documents/2023/10/rf_fs_2amend23NYCRR500_text_20231101.pdf
