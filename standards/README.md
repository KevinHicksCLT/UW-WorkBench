# Regulatory-compliance standards & SDLC agent skills

Three regulatory packs, each a self-contained SDLC agent skill plus the standards
dataset it governs. Loaded into the operating model as categories under the
**Cybersecurity & ISO** Standards area, with every standard wired to its skill via
`StandardItem.agentSkill` (editable in **Data Admin → Standards**).

| Skill folder | `agentSkill` | Standards category | # | Owner |
|---|---|---|---|---|
| `skills/gdpr-sdlc-compliance/` | `gdpr-sdlc-compliance` | Data Privacy (GDPR) | 21 | DPO / ISO Security Architect |
| `skills/ccpa-cpra-sdlc-compliance/` | `ccpa-cpra-sdlc-compliance` | Data Privacy (CCPA/CPRA) | 22 | Privacy Officer / ISO Security Architect |
| `skills/nydfs-500-sdlc-compliance/` | `nydfs-500-sdlc-compliance` | NYDFS 23 NYCRR 500 (Cybersecurity) | 22 | CISO / ISO Security Architect |

Each skill folder contains `SKILL.md`, the four SDLC phase guides
(`requirements/design/development/testing-phase.md`), `audit-evidence-map.md`,
`references/`, and `data/<reg>-standards.{json,csv}`.

## Load / reload into the database

```bash
npm run load:standards -w cascade-backend
```

Idempotent: it reloads the three regulatory categories under Cybersecurity & ISO
and recomputes the area's item count. Each standard maps to the Standards UI
fields (name, "WHAT IT MEANS", Build/Run, responsible role) plus the traceability
fields `agentSkill`, `sdlcGates`, `regCitation`, and `appliesToValueStreams`.
