---
name: cybersecurity-iso-sdlc-compliance
description: >
  Enforce and evidence the Cybersecurity & ISO standards area (48 standards owned by the CISO / ISO
  Security Architect) across the software delivery lifecycle — requirements, design, development, and
  testing — for any system that touches the enterprise network, identities, data, or cloud estate.
  Use this skill whenever delivery work involves threat modeling, zero trust, encryption at rest or
  in transit, key/certificate management, RBAC/PAM/MFA, SAST/DAST/SCA scanning, container or API
  security, secrets management, security logging and SIEM integration, data classification and
  PII/PHI handling, vulnerability and patch SLAs, or hardening/segmentation — even if the user does
  not say "security standard" or "ISO." Also use when writing user stories, designs, APIs, or test
  plans for any production system, and whenever the goal is evidence for the Security Controls
  Matrix (NIST CSF / ISO 27001) attestation. When unsure whether a system is security-relevant, run
  the scope gate rather than skipping it.
---

# Cybersecurity & ISO Standards Across the SDLC — Secure-by-Design and Control Evidence

## What this skill does

The Cybersecurity & ISO area defines **48 standards** across Security Architecture, Encryption,
Identity & Access, Application Security, Vulnerability Management, Security Operations, Incident
Response, Data Protection, Compliance, and Infrastructure. A large subset is **enforceable at build
time** — this skill turns that subset into **SDLC gates** and, for each gate, names the **evidence
artifact** to produce, so every control maps back to the **Security Controls Matrix** (NIST CSF or
ISO 27001) and survives the annual control attestation.

The source standards live in the app's Standards area (**Data Admin → Standards → Cybersecurity &
ISO**), each with its category, Build/Run phase, and responsible role. The regulatory packs (GDPR,
CCPA/CPRA, NYDFS 500) are separate categories under this same area with their own skills — invoke
those in addition when their scope gates trigger.

## Operating principle (read once, apply always)

> **Assume breach; verify explicitly; leave an artifact.** The *Zero Trust Architecture Model* and
> *Defense in Depth Strategy* mean no control stands alone and no access is trusted by default. And
> the *Security Controls Matrix* means a control that leaves no stored evidence does not exist at
> attestation time.

Maintain one **Security Compliance Record** per system/feature. The four gates write into it.

## STEP 0 — Scope gate (always run first)

1. **Does the system touch enterprise data, identities, or network paths?** Almost always yes —
   only fully isolated throwaway prototypes are out of scope, and even those must not hold real data.
2. **Classify the data (Data Classification standard):** Public, Internal, Confidential, or
   Restricted. Restricted/Confidential triggers the *PII/PHI Handling*, *Data Masking/Tokenization*,
   and encryption standards.
3. **New trust boundaries?** Any new data flow across a network, vendor, or privilege boundary
   triggers *Data Flow & Trust Boundaries* documentation and *Threat Modeling (STRIDE)*.
4. **Third party involved?** Triggers the *Vendor Security Assessment* before engagement.

- If genuinely out of scope → record the determination and date, and stop.
- If unsure → treat as in-scope and escalate to the ISO Security Architect.

## The four phase gates

Each gate lists mandatory checks (named standards in italics) and the evidence each leaves behind.
A phase isn't "done" until its evidence exists in the Security Compliance Record.

### 1. Requirements
- Complete *Data Classification* for every data element; identify PII/PHI fields (*PII/PHI Handling*).
- Capture access requirements as roles, not people (*Role-Based Access Control (RBAC)*); flag any
  privileged or service-account access (*Privileged Access Management*, *Service Account Management*).
- Record retention and minimization needs (*Data Retention & Minimization*).
- State the security acceptance criteria from *Secure SDLC Requirements* (gates at design, code,
  test, deploy; a security champion named for the squad).
- **Evidence:** data-classification sheet, role/access matrix, retention requirements, named security champion.

### 2. Design
- Run *Threat Modeling (STRIDE)* — mandatory **before design approval**; document data flows and
  trust boundaries.
- Apply the *Security Reference Architecture* patterns (VPC/subnets/security groups, on-prem, hybrid)
  and *Network Segmentation* (documented firewall rules, DMZ, microsegmentation for sensitive workloads).
- Design encryption: *Encryption at Rest Standard* (AES-256, TDE for sensitive stores), *Encryption
  in Transit Standard* (TLS 1.2+, 1.3 preferred), *Key Management Standard* (approved KMS/HSM, no
  hardcoded secrets, rotation).
- Design identity: RBAC roles, *Multi-Factor Authentication* on external/privileged/sensitive paths,
  *Break-Glass Procedures* where applicable.
- Design *Security Event Logging* (authn, authz, data access, config changes) feeding *SIEM
  Integration* (log shipping within 5 min).
- **Evidence:** approved STRIDE model, data-flow/trust-boundary diagram, encryption + key-management design, logging design.

### 3. Development
- *SAST (Static Analysis)* passes before merge — critical/high findings block deployment; *SCA
  (Dependency Scanning)* shows no critical CVEs; *Secrets Management* — no secrets in code, approved
  vault only.
- *Container Security*: approved base images, image scanning, no root containers. *API Security
  Standards*: OAuth 2.0/OIDC, rate limiting, input validation, no sensitive data in URLs.
- Apply *OS Hardening Guidelines* / *Database Hardening* (CIS benchmarks, TDE, restricted network
  access, audit logging) via IaC.
- *Data Masking/Tokenization*: production data masked in non-prod.
- **Evidence:** clean SAST/SCA/secret-scan reports, image-scan results, hardening baseline applied, PR approvals citing the controls.

### 4. Testing
- *DAST (Dynamic Analysis)* pre-production with OWASP Top 10 coverage; schedule into the
  *Penetration Testing* cadence (annual third-party; quarterly internal for critical systems).
- Verify MFA on every access path, least-privilege enforcement, and that security events actually
  land in the SIEM within the 5-minute SLA (*SIEM Integration*, *Security Event Logging*).
- Verify encryption in transit/at rest and key rotation; verify masking holds in non-prod.
- Confirm *Log Retention* configuration (90 days hot / 1 year warm / 7 years archive).
- Any deviation goes through the *Security Exception Process* (risk acceptance, compensating
  controls, CISO approval) — never silent.
- **Evidence:** DAST report, MFA/access test results, SIEM ingestion proof, retention config, signed exceptions.

## Run / operate handoff (not build gates)
*Vulnerability Scanning Cadence* (weekly prod), *Patch Management SLA* (Critical 72h / High 7d /
Medium 30d / Low 90d), *Remediation Tracking*, *Alert Thresholds & Tuning*, *Security Playbooks*,
*IR Plan & Escalation* + *Tabletop Exercises*, *Access Request & Provisioning SLA*, *Certificate
Management* (annual rotation), *Cloud Security Posture* (CSPM, quarterly IAM review), *Risk
Register*, and annual *Security Controls Matrix* attestation. Each needs a named owner and a
telemetry signal before go-live.

## How to use this skill in practice
- **Reviewing/authoring an artifact:** run the matching phase gate's checklist; write missing items
  + evidence pointers into the Security Compliance Record.
- **New system kickoff:** run STEP 0, then walk all four gates; invoke the GDPR/CCPA/NYDFS skills
  where their scope gates trigger.
- **Attestation prep:** confirm every build-time control has stored, in-date evidence mapped to the
  Security Controls Matrix.

## Boundaries
Engineering guidance, not a substitute for the security program. Risk acceptance, exception
approval, vendor-risk decisions, and incident-severity calls belong to the CISO / ISO Security
Architect. This skill enforces build-time controls and produces evidence; it does not replace the
SOC, the IR program, or the vulnerability-management operation.
