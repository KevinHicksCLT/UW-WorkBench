# Design Phase — NYDFS Part 500 Gate

**Purpose:** translate the NPI classification into concrete security architecture: access, MFA,
encryption, audit trails, monitoring, disposal, and backup/recovery — and register the system in the
asset inventory.

## Checklist

### A. Secure design (§500.8)
- [ ] Design against the organisation's written secure-development standards; record deviations and approvals.
- [ ] For externally developed components, define how their security will be evaluated/assessed/tested
      within Meridian's environment.
- **Evidence:** secure-design record referencing the standards.

### B. Access & privileged accounts (§500.7)
- [ ] Least-privilege role model; access to NPI limited to job necessity.
- [ ] **Limit the number and scope of privileged accounts**; privileged use only when required.
- [ ] Disable or securely configure protocols that permit remote control of devices.
- [ ] Design joiner/mover/leaver flows so access is reviewed (≥ annually) and **promptly terminated on departure**.
- [ ] Password policy meeting industry standards where passwords are used.
- [ ] **Class A:** privileged-access-management (PAM) solution; automated blocking of commonly used passwords.
- **Evidence:** access-control design + privileged-account model.

### C. MFA (§500.12)
- [ ] MFA on **every** access path to information systems (not just remote); document any CISO-approved
      compensating control and its annual-review plan.
- **Evidence:** MFA design record.

### D. Encryption (§500.15)
- [ ] Encryption in transit over external networks and at rest, meeting industry standards (e.g.,
      TLS; AES-256 / database TDE).
- [ ] Where at-rest encryption is infeasible, define CISO-approved compensating controls + annual review.
- **Evidence:** encryption design + key-management approach.

### E. Audit trail (§500.6)
- [ ] Design audit trails that (a) reconstruct material financial transactions and (b) detect/respond
      to material cybersecurity events; design storage to meet the **5-year / 3-year** retention.
- **Evidence:** audit-trail design with retention.

### F. Monitoring & malicious-code (§500.14)
- [ ] Design monitoring of authorized-user activity to detect unauthorized access/use/tampering.
- [ ] Design malicious-code protections incl. web-traffic and email filtering.
- [ ] **Class A:** endpoint detection & response (EDR) + centralized logging / SIEM.
- **Evidence:** monitoring design.

### G. Data disposal (§500.13(b))
- [ ] Design secure, periodic disposal of NPI no longer needed (incl. backups/derived copies).
- **Evidence:** disposal design.

### H. Asset inventory (§500.13(a))
- [ ] Register the system with owner, location, classification/sensitivity, support-expiration date,
      and recovery-time objective; set the update/validation cadence.
- **Evidence:** asset-inventory record.

### I. IR / BCDR hooks (§500.16)
- [ ] Define how the system surfaces detection signals into the incident-response process and the
      72-hour notification path; define backup frequency, offsite/protected storage, and restore approach.
- **Evidence:** IR/BCDR design hooks + backup design.

### J. Third parties (§500.11)
- [ ] For TPSPs touching NPI, confirm due-diligence status and contractual MFA/encryption/breach-notice terms.
- **Evidence:** third-party record.

## Exit criteria
Complete when the Compliance Record holds: secure-design record, access & privileged-account model,
MFA design, encryption + key-management, audit-trail design with retention, monitoring design,
disposal design, **asset-inventory record**, IR/BCDR hooks + backup design, and third-party record
(plus Class A PAM/EDR/SIEM where applicable).
