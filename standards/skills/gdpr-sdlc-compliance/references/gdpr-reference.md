# GDPR — Source Reference (Regulation (EU) 2016/679)

**Instrument:** Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 ("General Data Protection Regulation").
**Repeals:** Directive 95/46/EC.
**Published:** OJ L 119, 4.5.2016, pp. 1–88 (corrigendum OJ L 127, 23.5.2018).
**Applicable since:** 25 May 2018.
**Structure:** 11 Chapters · 99 Articles · 173 Recitals.
**Authoritative text:** EUR-Lex CELEX 32016R0679 — https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng

> This file is an *operational extraction*, not the legal text. Article obligations are paraphrased into engineering-actionable language with article references for traceability. The binding text is the Official Journal version on EUR-Lex. Legal/DPO sign-off governs interpretation — this document is engineering guidance, not legal advice.

---

## Chapter map (full)

| Chapter | Articles | Subject |
|---|---|---|
| 1 | 1–4 | General provisions (subject-matter, material & territorial scope, definitions) |
| 2 | 5–11 | Principles (lawfulness, special categories) |
| 3 | 12–23 | Rights of the data subject |
| 4 | 24–43 | Controller and processor (incl. DP by design, DPIA, breach, DPO) |
| 5 | 44–50 | Transfers to third countries / international organisations |
| 6 | 51–59 | Independent supervisory authorities |
| 7 | 60–76 | Cooperation and consistency |
| 8 | 77–84 | Remedies, liability and penalties |
| 9 | 85–91 | Specific processing situations (incl. employment) |
| 10 | 92–93 | Delegated and implementing acts |
| 11 | 94–99 | Final provisions |

---

## Scope gates that decide whether GDPR applies at all

- **Material scope (Art. 2):** Applies to processing of *personal data* wholly or partly by automated means, and to non-automated processing in a filing system.
- **Territorial scope (Art. 3):** Applies where (a) processing occurs in the context of an EU **establishment**, regardless of where processing happens; or (b) a controller/processor *not* established in the EU offers goods/services to, or **monitors the behaviour of**, data subjects in the EU.
- **Definitions (Art. 4):** *personal data*, *processing*, *controller*, *processor*, *pseudonymisation*, *consent*, *personal data breach*, *profiling*, etc. Pseudonymised data is still personal data; truly anonymised data is out of scope.

> Engineering implication: the **first gate in the SDLC skill** is "does this system process personal data of EU data subjects under Art. 2/3?" If no, GDPR does not apply and a different regime governs (see README blind-spots). If unsure, treat as in-scope and escalate to DPO.

---

## SDLC-relevant articles — operational obligations

### Chapter 2 — Principles

- **Art. 5 — Principles.** Lawfulness/fairness/transparency; purpose limitation; data minimisation; accuracy; storage limitation; integrity & confidentiality; and **accountability** (5(2): the controller must be able to *demonstrate* compliance). The accountability principle is why audit evidence is mandatory, not optional.
- **Art. 6 — Lawful basis.** Processing is lawful only on one of six grounds: consent; contract; legal obligation; vital interests; public task; legitimate interests (balancing test required). The basis must be chosen and documented *before* collection and cannot be swapped casually.
- **Art. 7 — Consent conditions.** Demonstrable, freely given, specific, informed, unambiguous; withdrawal as easy as giving; no bundling/conditionality where avoidable.
- **Art. 9 — Special categories.** Health, genetic, biometric-for-ID, racial/ethnic, political, religious, trade-union, sex-life/orientation data are prohibited unless an Art. 9(2) condition applies (e.g., explicit consent, insurance/social-security law, substantial public interest). **Directly relevant to insurance: medical/claims data.**
- **Art. 10 — Criminal-offence data.** Processed only under official authority or authorised by law.
- **Art. 11 — Processing not requiring identification.** Don't re-identify just to comply.

### Chapter 3 — Data subject rights (all have engineering surface area)

- **Art. 12 — Transparency & modalities.** Concise, intelligible, plain language; respond to requests within **one month** (extendable by two for complexity); generally free of charge.
- **Art. 13 / 14 — Information at collection.** What to tell subjects when data is collected from them (13) or obtained elsewhere (14): identity, purposes, legal basis, recipients, retention, rights, transfers, automated decision-making.
- **Art. 15 — Right of access (DSAR).** Confirm processing and provide a copy of the data plus metadata.
- **Art. 16 — Rectification.** Correct inaccurate data without undue delay.
- **Art. 17 — Erasure ("right to be forgotten").** Delete on specified grounds; **Art. 19** requires propagating erasure/rectification to recipients.
- **Art. 18 — Restriction.** Mark and stop active processing in defined situations.
- **Art. 20 — Portability.** Provide the subject's *provided* data in a structured, commonly used, machine-readable format; transmit to another controller where feasible.
- **Art. 21 — Objection.** Honour objections, including an absolute opt-out from direct-marketing processing.
- **Art. 22 — Automated decision-making & profiling.** A subject has the right not to be subject to a decision based **solely** on automated processing (incl. profiling) producing legal or similarly significant effects, unless necessary for a contract, authorised by law, or based on explicit consent — and even then with safeguards: human intervention, the right to express a view, and to contest. **Directly relevant to automated underwriting, pricing, and claims triage.**

### Chapter 4 — Controller & processor

- **Art. 24 — Controller responsibility.** Implement and review appropriate technical/organisational measures; be able to demonstrate them.
- **Art. 25 — Data protection by design & by default.** Build privacy in from inception (pseudonymisation, minimisation) and default to the most protective settings. **The architectural anchor of the SDLC skill.**
- **Art. 26 — Joint controllers.** Allocate responsibilities transparently.
- **Art. 28 / 29 — Processors.** A processor may act only on documented instructions under a contract (DPA) imposing the Art. 28(3) obligations; sub-processors require authorisation.
- **Art. 30 — Records of processing activities (RoPA).** Maintain a written/electronic inventory of processing activities and their attributes.
- **Art. 32 — Security of processing.** Risk-appropriate measures incl. pseudonymisation & encryption; confidentiality, integrity, availability, resilience; ability to restore; and a process for regularly **testing** the effectiveness of measures.
- **Art. 33 — Breach notification to authority.** Without undue delay and where feasible within **72 hours** of becoming aware, unless unlikely to risk rights/freedoms; document all breaches.
- **Art. 34 — Breach communication to subjects.** Without undue delay where the breach is likely to result in **high risk**.
- **Art. 35 — DPIA.** Required where processing is likely high risk (esp. systematic/extensive profiling with significant effects, large-scale special-category data, large-scale public monitoring). Must describe processing, assess necessity/proportionality, assess risks, and define mitigations.
- **Art. 36 — Prior consultation.** Consult the supervisory authority before processing where a DPIA shows high residual risk.
- **Art. 37–39 — Data Protection Officer.** Designate where required; ensure independence, resourcing, and involvement in all data-protection matters; defined tasks incl. advising, monitoring, and being the authority/subject contact point.

### Chapter 5 — International transfers

- **Art. 44–49 — Transfers.** Transfers outside the EEA require a lawful transfer mechanism: an **adequacy** decision (45), **appropriate safeguards** such as Standard Contractual Clauses or Binding Corporate Rules (46–47), or specific **derogations** (49). Post–*Schrems II*, SCC-based transfers require a transfer impact assessment and may need supplementary measures.

### Chapter 8 — Why this matters (enforcement)

- **Art. 83 — Administrative fines.** Two tiers: up to **€10m or 2%** of total worldwide annual turnover (e.g., Art. 8, 25, 28, 30–39 breaches), and up to **€20m or 4%** (e.g., Art. 5, 6, 7, 9 principles; data-subject rights; transfers). Whichever is higher.
- **Art. 82 — Compensation.** Data subjects can claim material/non-material damages.

---

## Recitals worth citing in design rationale

- **Recital 39** — minimisation & transparency intent.
- **Recital 47** — legitimate-interest balancing (relevant to fraud prevention in insurance).
- **Recital 71** — automated decision-making safeguards (logic explanation, contestability).
- **Recital 78** — data protection by design/default expectations for producers and controllers.
- **Recital 83** — security risk assessment underpinning Art. 32.

---

## Sources

- EUR-Lex, Regulation (EU) 2016/679 (authoritative): https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- EUR-Lex consolidated text (documentation tool): https://eur-lex.europa.eu/eli/reg/2016/679/2016-05-04/eng
- gdpr-info.eu (article-by-article navigation, links each article to recitals): https://gdpr-info.eu/
