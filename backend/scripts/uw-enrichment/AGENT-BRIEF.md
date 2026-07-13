# Underwriting task enrichment — agent brief

You are enriching L5 tasks of the **Underwriting value stream** of a large multi-line insurer
(life, annuities, P&C personal + commercial, health/Medicare Supplement, assumed reinsurance,
specialty programs: flood WYO, crop, mortgage insurance). Your output must match the detail
level of the Software Engineering & Delivery exemplar
(`C:\Users\xando\Code\transform-platform\backend\scripts\sed-enrichment\dec-01.json` — read the
first ~150 lines for style; do NOT copy its content, it is a different domain).

## Inputs (read all)

- `C:\Users\xando\Code\transform-platform\backend\scripts\uw-enrichment\catalogs.json` —
  roles / applications / standards / regulations you may reference by id. IDs must be exact.
- `C:\Users\xando\Code\transform-platform\backend\scripts\uw-enrichment\tasks-NN.json` —
  your chunk (NN given in your prompt). Each task: id, name, description, l3/l4 path,
  current roles (with relation Owner/Participant), current apps, assigned work templates with
  their generic keys (`{id, key, guidance, valueKind}`), and item-specific `customKeys`
  (`{answerId, key, kind}`).

## Output

Write `C:\Users\xando\Code\transform-platform\backend\scripts\uw-enrichment\dec-NN.json`
(same NN) — JSON: `{ "tasks": [ <one decision object per task, ALL tasks in your chunk> ] }`.

Decision object shape:

```json
{
  "id": "<task id>",
  "owner": { "action": "keep" } | { "action": "replace", "name": "<exact role name>" },
  "removeRoleNames": ["<current role name to remove>", ...],
  "addParticipants": ["<exact role name>", ...],
  "removeAppNames": ["<current app name to remove>", ...],
  "addApps": [{ "name": "<exact app name>", "usageType": "performed" | "memorialized" }],
  "answers": [
    { "templateKeyId": "<key id from task.templates>", "value": "<rich text>" },
    { "templateKeyId": "<APPLICATION-kind key id>", "applicationId": "<catalog app id>" },
    { "templateKeyId": "<APPLICATION-kind key id>", "newApplication": "<name if not in catalog>" },
    { "templateKeyId": "<ROLE-kind key id>", "roleId": "<catalog role id>" },
    { "answerId": "<from task.customKeys>", "value": "<rich text>" }
  ],
  "standards": [
    { "standardId": "<catalog standard id>",
      "checklist": [{ "step": "<imperative step>", "value": "<concrete implementation detail>" }],
      "testing":   [{ "step": "<imperative step>", "value": "<concrete verification detail>" }] }
  ],
  "regulations": [
    { "regId": "<catalog regulation id>",
      "checklist": [{ "step": "...", "value": "..." }],
      "testing":   [{ "step": "...", "value": "..." }] }
  ]
}
```

## Rules

**Roles — the core correction.** Current data is bloated (some tasks carry 23 roles). End state
per task: **exactly 1 Owner + 1–2 Participants (2–3 roles total)**. Think like an insurance
operating-model designer:

- Owner = the role that actually PERFORMS the task day-to-day (e.g. `Underwriter`,
  `Senior Underwriter`, `Underwriting Assistant`, `Actuarial Analyst`, `Underwriting Quality
Analyst`, `Treaty Underwriter`). Not a manager unless the task is genuinely managerial.
- One Participant is usually the APPROVER / reviewer (e.g. `Senior Underwriter`, `Chief
Underwriter`, `Underwriting Manager`, `Chief Underwriting Officer` for authority-level tasks).
- A second Participant only if a second discipline genuinely contributes (e.g. `Medical
Director` on impaired-risk life cases, `Actuary` on rate adequacy, `Reinsurance Analyst` on
  facultative cessions).
- Remove every other current role by exact name via `removeRoleNames` (executives, unrelated
  functions, duplicates). Never remove the role you keep as Owner unless replacing.
- Prefer catalog roles (exact `displayValue` spelling). Invent a new role name ONLY if no
  catalog role fits (it will be created).

**Apps.** Keep/end with 2–4 apps that are actually used: policy admin / underwriting workbench /
rating engine / document management / data providers (MIB, MVR, LexisNexis-style) / GRC / BI.
Remove generic-irrelevant current apps by exact name. `performed` = work happens in it,
`memorialized` = output/evidence recorded in it.

**Answers — the detail bar.** Answer EVERY generic key of EVERY assigned template, plus every
custom key. Match the SED exemplar's specificity:

- TEXT keys: 1–3 sentences, concrete and task-specific — name the system/report/artifact, the
  population and period, numeric thresholds/SLAs (e.g. "within 2 business days", "sample 25
  files per quarter", "authority matrix v3.2"), the pass/fail criteria, where evidence lands
  (folder/record naming), who signs off. Ground in real underwriting practice for this task's
  line of business (infer from task name + l3/l4).
- APPLICATION keys (`valueKind: "APPLICATION"`): set `applicationId` from catalog, or
  `newApplication` with a realistic name.
- ROLE keys (`valueKind: "ROLE"`): set `roleId` from catalog. Data owner ≈ the Owner role;
  sign-off ≈ the approver Participant.
- Use `guidance` on the key if present to understand what it asks.

**Standards.** Tie 1–3 catalog standards that this task genuinely implements — prefer the
`Underwriting` department (authority levels, referral triggers, documentation SLAs, screening
before binding, filed-rate adherence, appetite documentation…); use Actuarial / Compliance &
Risk / Data & Analytics / Operations / Legal ones when they fit better. For each: 2–3 checklist
steps (how the task implements the standard) + 2–3 testing steps (how conformance is verified),
each with a concrete `value`.

**Regulations.** 0–2 per task, ONLY where genuinely applicable:

- FCRA / FCRA (Regulation V): tasks ordering or acting on consumer reports, credit-based
  insurance scores, adverse action, MVRs.
- GINA: life/health medical underwriting using genetic information boundaries.
- EU AI Act / NAIC AI Model Bulletin / Colorado SB 21-169: model-driven or algorithmic
  underwriting, ECDIS governance, predictive scoring tasks.
- Medicare Supplement: guaranteed-issue / open-enrollment underwriting rules.
- ACA / PHSA: health rating-factor and preexisting-condition constraints.
- OFAC Sanctions / BSA-AML: insured screening before binding.
- NFIP (WYO), Federal Crop Insurance, PMIERs, TRIA/TRIPRA: those specialty lines only.
- Privacy (GLBA / HIPAA / NAIC 670/672 / NAIC 668 / NYDFS 500): tasks handling consumer
  financial/health data at scale.
  Skip regulations entirely for purely internal tasks (training, benchmarking, reporting) unless
  one clearly binds. Same evidence shape as standards.

**Consistency.** Tasks in your chunk share an L3/L4 area — keep owners, systems, and naming
consistent across them (same PAS name, same workbench, same folder conventions).

**Validity.** Every `templateKeyId`/`answerId`/`roleId`/`applicationId`/`standardId`/`regId`
must be copied exactly from your inputs. Do not invent ids. Names in
`removeRoleNames`/`removeAppNames` must exactly match a current role/app name on that task.
JSON must parse. No trailing commas. Every task in the chunk must appear exactly once.
