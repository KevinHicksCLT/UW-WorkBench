# Transformation Bridge — NYDFS Part 500 Integration Notes

## What this delivers (Goal #1)

`nydfs-500-standards.json` and `nydfs-500-standards.csv` contain **22 standards** packaged as a new
category — **"NYDFS 23 NYCRR 500 (Cybersecurity)"** — under the existing **Cybersecurity & ISO**
standards area, owned by **CISO / ISO Security Architect**. The fields mirror the Standards UI so the
rows load alongside the current set.

## Field mapping (UI label → data field)

| Transformation Bridge UI | Data field |
|---|---|
| Standards area | `area` ("Cybersecurity & ISO") |
| Category header | `category` ("NYDFS 23 NYCRR 500 (Cybersecurity)") |
| Standard title | `standard` |
| "WHAT IT MEANS" | `whatItMeans` |
| Build / Run / Build/Run chip | `phase` |
| "RESPONSIBLE ROLE" | `responsibleRole` |
| "APPLIES TO VALUE STREAMS" tags | `appliesToValueStreams` |
| *(extension)* | `nydfsSections`, `classAOnly`, `sdlcGates` |

## How to load
1. **Confirm the real import schema** (likely under Data Admin) and rename fields if they differ.
2. Use the **CSV** for bulk import or the **JSON** for a structured payload — they are generated from
   the same source.
3. Drop the extension columns (`nydfsSections`, `classAOnly`, `sdlcGates`) if the importer rejects
   unknown fields; keep them in this project for traceability.
4. After load, Cybersecurity & ISO rises from 48 → 70 standards, and from 10 → 11 categories. (If you
   load this **and** the GDPR pack, it becomes 91 standards across 12 categories — see the
   cross-regime note below.)

## Decisions to validate

- **Class A determination is the first thing to confirm.** All 22 standards ship with
  `classAOnly: false` because the Class A *extras* (independent audit §500.2(c), PAM §500.7(c),
  EDR + SIEM §500.14(b), external-expert pen testing §500.5) are folded into the relevant standards'
  text rather than split into separate rows. **If Meridian is a Class A company** (≥ $20M NY revenue
  in each of the last two FYs, plus > 2,000 employees or > $1B revenue across affiliates — at
  Meridian's apparent scale this is likely), those extras are mandatory. Decide whether to (a) keep
  them inline as written, or (b) split them into separate `classAOnly: true` rows so the platform can
  show/hide them by entity tier.
- **Roles.** The data uses CISO-centric roles plus existing app roles (ISO Architect, Application
  Security Lead, Vendor Security). §500.17(b) certification is owned jointly by the **highest-ranking
  executive and the CISO** — make sure your role taxonomy can represent a dual-sign-off owner.
- **Phase semantics.** Most Part 500 obligations are **Run** (a standing program), with a build-time
  subset (500.5, 500.6, 500.7, 500.8, 500.12, 500.13, 500.14, 500.15, 500.16) that the SDLC skill
  enforces. This is the opposite weighting from GDPR and is called out in the README.
- **Telemetry.** Suggested signals per standard are in the SDLC skill's `audit-evidence-map.md`
  (e.g., % systems in asset inventory, MFA coverage, mean-time-to-remediate vulnerabilities,
  72-hour-notice readiness, days-to-certification-evidence-complete).

## Cross-regime note (GDPR + Part 500)
Several controls overlap with the GDPR pack (encryption, access, retention/disposal, third-party,
breach/incident). The regimes **diverge** in intent: Part 500 is security/NPI-centric with no
data-subject rights, DPIA, or lawful basis; GDPR is rights-centric. If you load both, consider a
shared "control library" with regime tags so a single implemented control (e.g., encryption at rest)
can satisfy *and evidence* both §500.15 and GDPR Art. 32 without duplicate work — while keeping the
two **certifications/audits** separate, because the triggers and evidence differ.

## Relationship to the SDLC skill (Goal #2)
Each standard's `sdlcGates` field names the SDLC phases that enforce it, and the skill defines the
evidence each gate must produce — the evidence that ultimately backs the §500.17(b) Certification of
Material Compliance.
