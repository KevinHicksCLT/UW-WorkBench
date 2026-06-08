# GDPR Compliance Project — Meridian Insurance Group

GDPR (Regulation (EU) 2016/679) extracted, structured, and turned into two things you can use:

1. **App integration** — 21 GDPR standards formatted for the Transformation Bridge Standards area.
2. **SDLC agent skill** — markdown that drives GDPR-by-design and produces audit evidence across
   requirements, design, development, and testing.

## Contents

```
gdpr-compliance-meridian/
├── README.md                         ← you are here
├── source/
│   └── gdpr-reference.md             ← extracted regulation: structure + SDLC-relevant obligations
├── app-integration/                  ← GOAL #1
│   ├── gdpr-standards.json           ← 21 standards mapped to the Standards schema
│   ├── gdpr-standards.csv            ← same data, for bulk import
│   └── INTEGRATION-NOTES.md          ← field mapping, load steps, assumptions
└── sdlc-gdpr-skill/                  ← GOAL #2 (an installable agent skill)
    ├── SKILL.md                      ← scope gate + four phase gates + evidence principle
    └── references/
        ├── requirements-phase.md
        ├── design-phase.md
        ├── development-phase.md
        ├── testing-phase.md
        ├── audit-evidence-map.md     ← the crosswalk + Compliance Record template (the audit spine)
        └── gdpr-article-quick-reference.md
```

## Goal #1 — Integrate into Transformation Bridge
Load `app-integration/gdpr-standards.csv` (or `.json`) as a new **Data Privacy (GDPR)** category
under **Cybersecurity & ISO**. Read `INTEGRATION-NOTES.md` first — the field names are inferred from
the screenshots and must be checked against the real import schema (likely under Data Admin).

## Goal #2 — Use as an SDLC agent skill
`sdlc-gdpr-skill/` follows the Anthropic Skill format (a `SKILL.md` with name/description frontmatter
plus `references/`). Drop it into your agent's skills directory. It triggers whenever delivery work
touches personal data and walks the agent through: **scope gate → requirements → design → development
→ testing**, writing evidence into a per-feature **GDPR Compliance Record** at each step. The
`audit-evidence-map.md` is what makes it audit-grade: every control maps to an article, an evidence
artifact, and a telemetry signal.

The two goals connect: each standard's `sdlcGates` field names the phases that enforce it, and the
skill defines the evidence each phase must produce — closing the loop from "we have a standard" to
"we can prove it to a regulator."

---

## Devil's advocate — read before you bank on this (you asked me to flag blind spots)

1. **Does GDPR even apply to Meridian?** If Meridian is a US commercial carrier with no EU
   establishment and it neither offers services to nor monitors EU data subjects, **GDPR may not
   apply at all** (Art. 3). Your real, near-certain exposure is the **US patchwork**: ~20 state laws
   (CCPA/CPRA and successors), **GLBA**, **NYDFS 23 NYCRR 500**, **NAIC** model laws, and **HIPAA**
   (already in your scope). Risk: a GDPR-only artifact creates a *false sense of coverage*.
   *Mitigation:* the skill's STEP 0 forces a regime-applicability check and tells the agent not to
   read "GDPR N/A" as "no privacy obligations." Consider re-framing the skill as **privacy-by-design
   with GDPR as the strictest baseline**, then mapping the same controls to the US regimes — most
   transfer 1:1 (minimisation, DSARs, retention, breach), which is a stronger and more defensible play.

2. **A skill is not evidence.** An agent skill enforces *process*; an audit wants *artifacts* plus
   proof the process was actually followed. The weakest link here is the **evidence/telemetry layer**
   in the app. Standards rows alone won't survive an audit — the Compliance Record + live Telemetry
   signals will. Budget for that, not just the content load.

3. **Automated underwriting/claims is your highest-risk surface.** Art. 22 + the EU AI Act treat
   automated insurance pricing and risk assessment as high-risk. If Meridian uses ML in
   underwriting/claims, this is where fines and reputational damage concentrate — and it's the area
   most likely to be hand-waved in a generic privacy rollout. The skill flags it loudly; make sure
   the actuarial and data-science teams are in the room, not just engineering.

4. **This is engineering guidance, not legal advice.** Lawful-basis selection, DPIA sign-off, Art. 22
   lawfulness, and transfer mechanisms (post-Schrems II) need DPO/Legal judgement. I've paraphrased
   the regulation into operational controls; the binding text is the EUR-Lex version, and your DPO
   owns interpretation.

5. **Static guidance rots.** GDPR's letter is stable, but its *application* moves via EDPB guidance
   and case law (Schrems II reshaped transfers; AI Act now overlays Art. 22). Without a named owner
   and a review cadence, this artifact is accurate today and misleading in 18 months. Assign the DPO
   as owner and set a review interval.

> Power phrase for the C-suite framing of this work: **"A standard you can't evidence is an opinion;
> a control you can't trace is a liability."** That's the line between a privacy *policy* and a
> privacy *posture that survives audit*.

---

## Sources
- Regulation (EU) 2016/679 (authoritative): https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- Article-by-article navigation: https://gdpr-info.eu/
