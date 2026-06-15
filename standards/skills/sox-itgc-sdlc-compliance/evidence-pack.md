# Compliance Evidence Pack — SOX

**Client:** Meridian Insurance Group  •  **Cycle:** 2026-Q2  •  **Generated:** 2026-06-30T02:00:00Z  •  **By:** Cascade Control Framework

> The single artifact to hand an auditor or regulator first. It answers: *"Show me each control is real, was applied this cycle, and is still working — with the evidence behind it."*

## Attestation summary

| Controls | Passed | Warning | Failed | Automation coverage | Evidence coverage | Open issues |
|---|---|---|---|---|---|---|
| 15 | 12 | 2 | 1 | 87% | 98% | 3 |

## ✅ SOX-APP-01 — Automated premium-to-GL posting is complete and accurate

- **Family / framework:** Application-Control — SOX
- **Citation:** SOX 404; COSO Principle 13 (relevant information); Automated Application Control
- **Objective:** Premium amounts calculated in the policy administration system post to the general ledger completely and accurately, so that recorded premium revenue is supported by an independent recalculation with no unexplained variance.
- **Owner:** Financial Systems Analyst (approver: Controller)
- **Frequency / type:** Quarterly · Preventive / Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | Independent recalculation matches posted amounts. | 100 | gte | 100 | Pass |
  | No unexplained posting variance. | 0 | lte | 0 | Pass |

  **Evidence**

  - calc_config_export: `sharepoint://controls/sox/application-controls/SOX-APP-01/calc_config_export` (immutable)
  - recalculation_workpaper: `sharepoint://controls/sox/application-controls/SOX-APP-01/recalculation_workpaper` (immutable)
  - variance_report: `sharepoint://controls/sox/application-controls/SOX-APP-01/variance_report` (immutable)
  - Source systems: Policy Admin System [API], General Ledger [SQL]
  - Retention: 7 years

## ✅ SOX-APP-02 — System interfaces reconcile on control totals

- **Family / framework:** Application-Control — SOX
- **Citation:** SOX 404; COSO Principle 13 (relevant information); Automated Application Control
- **Objective:** Data transmitted across in-scope system interfaces is reconciled on record counts and control totals between the sending and receiving systems, so that no financially-significant records are lost, duplicated, or altered in transit.
- **Owner:** Financial Systems Analyst (approver: Controller)
- **Frequency / type:** Monthly · Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | No unreconciled records across in-scope interfaces. | 0 | eq | 0 | Pass |
  | Interface control totals tie out. | 0 | lte | 0 | Pass |

  **Evidence**

  - interface_control_totals: `sharepoint://controls/sox/application-controls/SOX-APP-02/interface_control_totals` (immutable)
  - reconciliation_report: `sharepoint://controls/sox/application-controls/SOX-APP-02/reconciliation_report` (immutable)
  - exception_resolution_log: `sharepoint://controls/sox/application-controls/SOX-APP-02/exception_resolution_log` (immutable)
  - Source systems: Integration Bus [API], General Ledger [SQL]
  - Retention: 7 years

## ✅ SOX-ELC-302-01 — Quarterly sub-certifications support the §302 certification

- **Family / framework:** Entity-Level — SOX
- **Citation:** SOX 302; SEC Rule 13a-14; Disclosure Controls and Procedures
- **Objective:** All required sub-certifiers complete and sign their quarterly sub-certifications on time, providing the documented basis on which the CEO and CFO rely to make the §302 disclosure certification.
- **Owner:** Controller (approver: CFO)
- **Frequency / type:** Quarterly · Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | All required sub-certifications received. | 100 | gte | 100 | Pass |
  | No overdue sub-certifications. | 0 | eq | 0 | Pass |

  **Evidence**

  - subcertification_questionnaire: `sharepoint://controls/sox/entity-level/302/SOX-ELC-302-01/subcertification_questionnaire` (immutable)
  - signed_subcertifications: `sharepoint://controls/sox/entity-level/302/SOX-ELC-302-01/signed_subcertifications` (immutable)
  - disclosure_committee_minutes: `sharepoint://controls/sox/entity-level/302/SOX-ELC-302-01/disclosure_committee_minutes` (immutable)
  - Source systems: Sub-certification Workflow (ServiceNow) [API], Signed Certifications (SharePoint) [SharePoint]
  - Retention: 7 years

## ⚠️ SOX-ELC-404-01 — ICFR control matrix is complete and key controls are tested

- **Family / framework:** Entity-Level — SOX
- **Citation:** SOX 404; PCAOB AS 2201; COSO 2013 Framework
- **Objective:** The ICFR control matrix is complete with a named owner for every key control, all key controls are tested within the assessment cycle, and identified deficiencies are remediated, supporting management's §404 assessment of internal control over financial reporting.
- **Owner:** SOX Program Manager (approver: CFO)
- **Frequency / type:** Quarterly · Detective · automation: Partial
- **Run status:** Warning

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | Every key control has a named owner. | 0 | eq | 0 | Pass |
  | All key controls tested this cycle. | 96 | gte | 100 | Warn |
  | No unremediated deficiencies. | 2 | eq | 0 | Warn |

  **Evidence**

  - control_matrix: `sharepoint://controls/sox/entity-level/404/SOX-ELC-404-01/control_matrix` (immutable)
  - test_workpapers: `sharepoint://controls/sox/entity-level/404/SOX-ELC-404-01/test_workpapers` (immutable)
  - deficiency_log: `sharepoint://controls/sox/entity-level/404/SOX-ELC-404-01/deficiency_log` (immutable)
  - Source systems: GRC Control Matrix (SharePoint) [SharePoint], Test Workpapers (Confluence) [Confluence]
  - Retention: 7 years

  **Open issue ISS-SOX-ELC-404-01-2026-Q2** (Medium) — Observed 96 violates gte 100; Observed 2 violates eq 0
  - Downstream impact: No downstream artifacts blocked.

## ✅ SOX-ITGC-AC-01 — Access provisioning is approved before grant

- **Family / framework:** ITGC-Access — SOX
- **Citation:** SOX 404; COSO Principle 11 (technology general controls); ITGC-Access-Provisioning
- **Objective:** Every grant of access to a financially-significant application is authorized by an appropriate approver before the access is provisioned, so that only properly authorized users can transact.
- **Owner:** IT Security Manager (approver: CISO)
- **Frequency / type:** Quarterly · Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | No in-scope grants without a prior approval. | 0 | eq | 0 | Pass |
  | All in-scope grants are approval-backed. | 100 | gte | 100 | Pass |

  **Evidence**

  - grant_event_population: `sharepoint://controls/sox/itgc-access/SOX-ITGC-AC-01/grant_event_population` (immutable)
  - approval_ticket_export: `sharepoint://controls/sox/itgc-access/SOX-ITGC-AC-01/approval_ticket_export` (immutable)
  - reconciliation_exception_log: `sharepoint://controls/sox/itgc-access/SOX-ITGC-AC-01/reconciliation_exception_log` (immutable)
  - Source systems: Identity Governance (Entra ID) [API], Access Request Tickets (ServiceNow) [API]
  - Retention: 7 years

## ✅ SOX-ITGC-AC-02 — Periodic user access recertification

- **Family / framework:** ITGC-Access — SOX
- **Citation:** SOX 404; COSO Principle 11 (technology general controls); ITGC-Access-Recertification
- **Objective:** On a quarterly basis, application owners review and formally recertify all user access to financially-significant systems so that access remains commensurate with current job responsibilities.
- **Owner:** IT Security Manager (approver: Application Owner)
- **Frequency / type:** Quarterly · Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | All in-scope access reviews completed. | 100 | gte | 100 | Pass |
  | No overdue recertifications. | 0 | eq | 0 | Pass |

  **Evidence**

  - recertification_campaign_export: `sharepoint://controls/sox/itgc-access/SOX-ITGC-AC-02/recertification_campaign_export` (immutable)
  - reviewer_signoff: `sharepoint://controls/sox/itgc-access/SOX-ITGC-AC-02/reviewer_signoff` (immutable)
  - revocation_log: `sharepoint://controls/sox/itgc-access/SOX-ITGC-AC-02/revocation_log` (immutable)
  - Source systems: Identity Governance (Entra ID) [API], Recertification Sign-off Library (SharePoint) [SharePoint]
  - Retention: 7 years

## ❌ SOX-ITGC-AC-03 — Privileged access is logged and independently reviewed

- **Family / framework:** ITGC-Access — SOX
- **Citation:** SOX 404; COSO Principle 11 (technology general controls); ITGC-Access-Privileged
- **Objective:** All privileged accounts on financially-significant systems are inventoried, their actions are captured in the SIEM, and each account is independently reviewed each quarter so that elevated access cannot be misused without detection.
- **Owner:** IT Security Manager (approver: CISO)
- **Frequency / type:** Quarterly · Detective · automation: Full
- **Run status:** Failed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | Every privileged account was reviewed. | 3 | eq | 0 | Fail |
  | 100% privileged review coverage. | 83 | gte | 100 | Fail |
  | All privileged actions captured in the SIEM. | 100 | gte | 100 | Pass |

  **Evidence**

  - pam_account_inventory: `sharepoint://controls/sox/itgc-access/SOX-ITGC-AC-03/pam_account_inventory` (immutable)
  - privileged_activity_log: `sharepoint://controls/sox/itgc-access/SOX-ITGC-AC-03/privileged_activity_log` (immutable)
  - review_signoff: `sharepoint://controls/sox/itgc-access/SOX-ITGC-AC-03/review_signoff` (immutable)
  - Source systems: Privileged Identity (Entra ID PIM) [API], SIEM Privileged Activity (Sentinel) [API]
  - Retention: 7 years

  **Open issue ISS-SOX-ITGC-AC-03-2026-Q2** (High) — Observed 3 violates eq 0; Observed 83 violates gte 100
  - Downstream impact: Blocks: icfr-2026Q2-ac03

## ✅ SOX-ITGC-AC-04 — Segregation of duties enforced on financial roles

- **Family / framework:** ITGC-Access — SOX
- **Citation:** SOX 404; COSO Principle 11 (technology general controls); ITGC-Access-SoD
- **Objective:** Conflicting financial duties are prevented or mitigated by enforcing a segregation-of-duties ruleset across role assignments so that no single user can both initiate and conceal an erroneous or fraudulent transaction.
- **Owner:** IT Security Manager (approver: Controller)
- **Frequency / type:** Quarterly · Preventive / Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | No unmitigated SoD conflicts. | 0 | eq | 0 | Pass |
  | Total SoD conflicts within tolerance. | 2 | lte | 5 | Pass |

  **Evidence**

  - sod_ruleset: `sharepoint://controls/sox/itgc-access/SOX-ITGC-AC-04/sod_ruleset` (immutable)
  - conflict_report: `sharepoint://controls/sox/itgc-access/SOX-ITGC-AC-04/conflict_report` (immutable)
  - mitigation_log: `sharepoint://controls/sox/itgc-access/SOX-ITGC-AC-04/mitigation_log` (immutable)
  - Source systems: Okta Role Assignments [API], General Ledger Roles [SQL]
  - Retention: 7 years

## ✅ SOX-ITGC-AC-05 — Timely deprovisioning of terminated users

- **Family / framework:** ITGC-Access — SOX
- **Citation:** SOX 404; COSO Principle 11 (technology general controls); ITGC-Access-Deprovisioning
- **Objective:** Access for terminated personnel is revoked from financially-significant systems within the defined service-level agreement so that no former employee retains the ability to transact.
- **Owner:** Access Administrator (approver: IT Security Manager)
- **Frequency / type:** Quarterly · Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | All leavers de-provisioned within SLA. | 100 | gte | 100 | Pass |
  | No active accounts for terminated staff. | 0 | eq | 0 | Pass |

  **Evidence**

  - termination_feed_export: `sharepoint://controls/sox/itgc-access/SOX-ITGC-AC-05/termination_feed_export` (immutable)
  - revocation_evidence: `sharepoint://controls/sox/itgc-access/SOX-ITGC-AC-05/revocation_evidence` (immutable)
  - exception_log: `sharepoint://controls/sox/itgc-access/SOX-ITGC-AC-05/exception_log` (immutable)
  - Source systems: Identity Governance (Entra ID) [API], HR Termination Feed (ServiceNow) [API]
  - Retention: 7 years

## ✅ SOX-ITGC-CM-01 — Changes are approved before promotion to production

- **Family / framework:** ITGC-Change — SOX
- **Citation:** SOX 404; COSO Principle 11 (technology general controls); ITGC-Change
- **Objective:** Every change promoted to a financially-significant production system is formally approved before deployment, so that only authorized, reviewed changes affect the financial reporting environment.
- **Owner:** Release Manager (approver: Change Advisory Board)
- **Frequency / type:** Quarterly · Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | Every production change had a prior approval. | 0 | eq | 0 | Pass |
  | 100% change-approval coverage. | 100 | gte | 100 | Pass |

  **Evidence**

  - change_ticket_export: `sharepoint://controls/sox/itgc-change/SOX-ITGC-CM-01/change_ticket_export` (immutable)
  - pr_approval_log: `sharepoint://controls/sox/itgc-change/SOX-ITGC-CM-01/pr_approval_log` (immutable)
  - cab_minutes: `sharepoint://controls/sox/itgc-change/SOX-ITGC-CM-01/cab_minutes` (immutable)
  - Source systems: Change Tickets (Jira) [MCP], Source Control (GitHub) [Git]
  - Retention: 7 years

## ✅ SOX-ITGC-CM-02 — Developers cannot approve or deploy their own changes

- **Family / framework:** ITGC-Change — SOX
- **Citation:** SOX 404; COSO Principle 11 (technology general controls); ITGC-Change-SoD
- **Objective:** No individual can both author and approve, or both author and deploy, a change to a financially-significant production system, enforcing segregation of duties across the change lifecycle.
- **Owner:** Release Manager (approver: Engineering Director)
- **Frequency / type:** Quarterly · Preventive / Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | No self-approved merges to protected branches. | 0 | eq | 0 | Pass |
  | No author-deployed production releases. | 0 | eq | 0 | Pass |

  **Evidence**

  - branch_protection_config: `sharepoint://controls/sox/itgc-change/SOX-ITGC-CM-02/branch_protection_config` (immutable)
  - merge_approver_log: `sharepoint://controls/sox/itgc-change/SOX-ITGC-CM-02/merge_approver_log` (immutable)
  - deploy_actor_log: `sharepoint://controls/sox/itgc-change/SOX-ITGC-CM-02/deploy_actor_log` (immutable)
  - Source systems: Source Control (GitHub) [Git], Deployment Pipeline [API]
  - Retention: 7 years

## ⚠️ SOX-ITGC-CM-03 — Emergency changes follow retroactive governance

- **Family / framework:** ITGC-Change — SOX
- **Citation:** SOX 404; COSO Principle 11 (technology general controls); ITGC-Change-Emergency
- **Objective:** Every emergency change to a financially-significant system is logged, retroactively approved, and subject to a post-implementation review, so that expedited changes remain governed even when normal pre-approval is bypassed.
- **Owner:** Release Manager (approver: Change Advisory Board)
- **Frequency / type:** Quarterly · Detective · automation: Full
- **Run status:** Warning

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | Every emergency change had a post-implementation review. | 0 | eq | 0 | Pass |
  | All emergency changes retroactively approved. | 83 | gte | 100 | Warn |

  **Evidence**

  - emergency_change_log: `sharepoint://controls/sox/itgc-change/SOX-ITGC-CM-03/emergency_change_log` (immutable)
  - retro_approval: `sharepoint://controls/sox/itgc-change/SOX-ITGC-CM-03/retro_approval` (immutable)
  - post_implementation_review: `sharepoint://controls/sox/itgc-change/SOX-ITGC-CM-03/post_implementation_review` (immutable)
  - Source systems: Change Tickets (ServiceNow) [API]
  - Retention: 7 years

  **Open issue ISS-SOX-ITGC-CM-03-2026-Q2** (Medium) — Observed 83 violates gte 100
  - Downstream impact: No downstream artifacts blocked.

## ✅ SOX-ITGC-OP-01 — Financially-relevant batch jobs are monitored and failures resolved

- **Family / framework:** ITGC-Operations — SOX
- **Citation:** SOX 404; COSO Principle 11 (technology general controls); ITGC-Operations
- **Objective:** Financially-relevant batch jobs are monitored, their failures raise alerts, and every failure is resolved, so that financial data is processed completely and accurately on schedule.
- **Owner:** IT Operations Manager (approver: Controller)
- **Frequency / type:** Quarterly · Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | No unresolved failures of financially-relevant jobs. | 0 | eq | 0 | Pass |
  | All job failures raise an alert. | 100 | gte | 100 | Pass |

  **Evidence**

  - job_schedule_export: `sharepoint://controls/sox/itgc-operations/SOX-ITGC-OP-01/job_schedule_export` (immutable)
  - failure_alert_log: `sharepoint://controls/sox/itgc-operations/SOX-ITGC-OP-01/failure_alert_log` (immutable)
  - resolution_tickets: `sharepoint://controls/sox/itgc-operations/SOX-ITGC-OP-01/resolution_tickets` (immutable)
  - Source systems: Job Scheduler Logs (SIEM) [API], Incident Tickets (ServiceNow) [API]
  - Retention: 7 years

## ✅ SOX-ITGC-OP-02 — Backups succeed and restores are periodically tested

- **Family / framework:** ITGC-Operations — SOX
- **Citation:** SOX 404; COSO Principle 11 (technology general controls); ITGC-Operations-Backup
- **Objective:** Backups of financially-significant systems succeed on schedule and restores are periodically tested, so that financial data can be recovered intact in the event of loss or corruption.
- **Owner:** IT Operations Manager (approver: CISO)
- **Frequency / type:** Quarterly · Detective · automation: Partial
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | All in-scope backups succeeded. | 100 | gte | 100 | Pass |
  | A restore test was performed this cycle. | 1 | eq | 1 | Pass |

  **Evidence**

  - backup_job_log: `sharepoint://controls/sox/itgc-operations/SOX-ITGC-OP-02/backup_job_log` (immutable)
  - ⚠️ MISSING — restore_test_record: `sharepoint://controls/sox/itgc-operations/SOX-ITGC-OP-02/restore_test_record` (immutable)
  - Source systems: Backup Job Logs (SIEM) [API], Restore Test Records (SharePoint) [SharePoint]
  - Retention: 7 years

## ✅ SOX-RET-802-01 — Financial records retention and legal holds are enforced

- **Family / framework:** Records-Retention — SOX
- **Citation:** SOX 802; SOX 103; 17 CFR 210.2-06
- **Objective:** In-scope financial records are retained under an enforced retention policy that meets the statutory minimum, legal holds are applied where required, and no records are prematurely deleted, satisfying the §802 records-retention requirements.
- **Owner:** Records Manager (approver: General Counsel)
- **Frequency / type:** Annual · Preventive / Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | Retention policy applied to all in-scope repositories. | 100 | gte | 100 | Pass |
  | No premature deletions of in-scope records. | 0 | eq | 0 | Pass |
  | Retention period meets the 7-year minimum. | 7 | gte | 7 | Pass |

  **Evidence**

  - retention_policy: `sharepoint://controls/sox/records-retention/SOX-RET-802-01/retention_policy` (immutable)
  - legal_hold_register: `sharepoint://controls/sox/records-retention/SOX-RET-802-01/legal_hold_register` (immutable)
  - deletion_audit_log: `sharepoint://controls/sox/records-retention/SOX-RET-802-01/deletion_audit_log` (immutable)
  - Source systems: Records Repository (SharePoint) [SharePoint], Deletion Audit (SIEM) [API]
  - Retention: 7 years
