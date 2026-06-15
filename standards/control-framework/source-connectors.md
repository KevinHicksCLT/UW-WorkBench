# Source-System Connector Catalog

This catalog answers the question that turns a control from *documented* into *continuously
evidenced*: **"Where does the data live in this client's ecosystem, and how does an agent reach it
to gather the evidence?"** Each control's `required_data_sources[].connector_ref` points at one of
these entries (machine-readable mirror in [`lib/source-connectors.mjs`](lib/source-connectors.mjs)).

`access_method` values match `control.schema.json`: **SQL · API · MCP · Git · SharePoint ·
Confluence · Cowork · EDI · SFTP · File · Manual Upload · BI Extract · Other**.

## How an agent uses a connector

1. **Discover** — read the control's `required_data_sources`; for each, resolve `connector_ref`.
2. **Bind** — connect via `access_method` (an MCP server, a REST API, a SQL FQN, a Git repo, a
   SharePoint/Confluence URL). Prefer a dedicated MCP where one exists; fall back to API/SQL.
3. **Acquire** — pull the population/sample into a dataset snapshot (id + checksum + timestamp).
4. **Evaluate** — run the control's assertions (`lib/run-control.mjs`).
5. **Evidence** — store the immutable artifacts the control requires, linked to the run.
6. **Surface debt** — if a source is unreachable or manual, the framework emits a technical-debt item.

## Enterprise connectors

| `connector_ref` | System | Access | Preferred MCP | Evidence it yields |
|---|---|---|---|---|
| `iam.entra` | Microsoft Entra ID | API | Microsoft Graph | access exports, sign-in logs, PIM activations, access reviews |
| `iam.okta` | Okta | API | Okta | user/app assignments, system log, certification campaigns |
| `iam.ad` | Active Directory | SQL | — | group membership, privileged-group deltas |
| `itsm.servicenow` | ServiceNow | API | ServiceNow | change records, approvals, CAB minutes, incidents |
| `itsm.jira` | Jira | MCP | Atlassian | change/issue tickets, approval transitions, releases |
| `itsm.linear` | Linear | MCP | Linear | remediation/issue records, owner & due-date fields, status transitions, SLA timers |
| `scm.github` | GitHub | Git | GitHub | PR approvals, branch protection, merges, CODEOWNERS, CI logs |
| `cicd.pipeline` | CI/CD pipeline | API | — | build/deploy logs, gate results, artifact provenance |
| `gl.erp` | General Ledger / ERP | SQL | — | journal entries, reconciliations, posting logs, control totals |
| `erp.api` | ERP API | API | — | automated postings, automated-control configuration |
| `policy.admin` | Policy Admin System | API | — | policy transactions, rating outputs, message samples |
| `claims.system` | Claims System | SQL | — | claim transactions, reserve changes, payments |
| `esb.integration` | Integration / ESB | API | — | message logs, transformation maps, dead-letter queues |
| `schema.registry` | Schema Registry | API | — | registered XSD/JSON schemas, versions, compatibility checks |
| `apigw.gateway` | API Gateway | API | — | API specs, conformance results, traffic samples |
| `docs.sharepoint` | SharePoint | SharePoint | SharePoint | policies, signed certifications, workpapers, data dictionaries |
| `docs.confluence` | Confluence | Confluence | Atlassian | standards pages, mapping specs, runbooks, design docs |
| `docs.cowork` | Cowork workspace | Cowork | — | authored artifacts, human sign-offs, review threads |
| `siem.logging` | SIEM / central logging | API | Datadog | audit trails, privileged-access alerts, monitoring signals |

## Insurance regulator connectors (from the 50-state regulator reference)

These are the shared NAIC / regulator systems insurers integrate with. They are the authoritative
source for *filing and licensing* evidence and are referenced by insurance-specific controls.

| `connector_ref` | System | Access | Evidence it yields |
|---|---|---|---|
| `reg.serff` | NAIC SERFF (rate/form filing) | API / web services | filing status, receipts, disposition records |
| `reg.nipr` | NAIC NIPR (producer licensing) | API / batch | producer licensing & appointment status |
| `reg.sbs` | NAIC State Based Systems (30+ states) | API | licensing, regulatory actions, consumer services |
| `reg.mcas` | NAIC MCAS via iSite+ | SFTP / data-filing | market-conduct annual statement submissions |
| `reg.edi.iaiabc` | IAIABC EDI (FROI/SROI workers-comp) | EDI (XML/flat-file, SFTP) | claim-event acknowledgements |

State-specific portals (e.g. Florida **IRFS/REFS**, Georgia **GEICS**, Texas **TexasSure**,
California **WCIS**) follow the same pattern: a control names the portal as a `Regulator Portal`
source with the appropriate `access_method` (often `EDI`, `SFTP`, or `API`), and the agent binds to
it to pull filing/verification evidence. The full per-state catalog lives in the source document
*"State-by-State Summary of U.S. Insurance Regulators, Standards & Notices, and System Integrations."*

## Adding a connector

Add an entry to `lib/source-connectors.mjs` (`connector_ref → { label, access_method, mcp, evidence }`)
and a row here. Controls then reference it by `connector_ref`. When a connector is absent for a
client, leave `source_availability[source_name] = false` in the fixture — the framework will raise a
**Missing Source** technical-debt item rather than silently passing.
