# Requirements Phase — NYDFS Part 500 Gate

**Purpose:** establish *what Nonpublic Information (NPI)* the system handles and the security
obligations that flow from it, before design. Under Part 500, NPI classification is the master switch
— it scopes encryption, access, audit trails, retention, and monitoring.

## Checklist

### A. NPI classification (§500.1(k)) — the master switch
- [ ] List every data element the system will store, process, or transmit.
- [ ] Classify each against the three NPI categories: (1) material **business** information;
      (2) personal **identifiers** combined with SSN, driver's licence/non-driver ID, financial
      account/card number, security/access code, or biometric record; (3) **health** information
      (except age/gender) from a provider or individual — common in insurance claims/underwriting.
- [ ] Mark which controls each NPI element triggers (encryption, access limits, audit trail, disposal).
- **Evidence:** NPI classification table in the Part 500 Compliance Record.

### B. Access requirements (§500.7)
- [ ] Define who/what needs access and at what privilege; identify any **privileged** access required.
- [ ] Capture least-privilege and joiner/mover/leaver expectations as acceptance criteria.
- **Evidence:** access-requirements entry.

### C. Asset inventory intent (§500.13(a))
- [ ] Confirm the system will be registered in the asset inventory with owner, location,
      classification, support-expiration date, and recovery-time objective (RTO).
- **Evidence:** planned asset-inventory record.

### D. Retention & disposal (§500.13(b))
- [ ] Define what NPI must be securely disposed of when no longer needed, and the trigger; note any
      legal retention overrides.
- **Evidence:** retention/disposal requirement.

### E. Secure development requirement (§500.8)
- [ ] Reference the organisation's written secure-development standards as binding acceptance criteria.
- [ ] For any **externally developed** components, capture the requirement to evaluate/assess/test their security.
- **Evidence:** secure-dev acceptance criteria on the stories.

### F. Risk & third parties (§500.9, §500.11)
- [ ] Flag risks for inclusion in the next risk-assessment update.
- [ ] Identify any third-party service provider that will touch NPI → triggers §500.11 due diligence
      and contractual MFA/encryption/breach-notice guidelines.
- **Evidence:** risk note + third-party flag.

### G. Incident & notification implications (§500.17)
- [ ] Note whether the system's compromise could be a reportable **cybersecurity incident** (72-hour
      clock) so detection and the notification path are designed in, not bolted on.
- **Evidence:** incident-relevance note.

## Insurance-specific prompts
- Claims/underwriting systems almost always handle **health NPI** and **financial identifiers** →
  full encryption, tight access, and audit trails from the start.
- Systems exposed to brokers/agents or third-party platforms → §500.11 due-diligence and §500.12 MFA
  for remote third-party access to NPI.

## Exit criteria
Complete when the Compliance Record holds: NPI classification, access/retention requirements, planned
asset-inventory entry, secure-dev acceptance criteria, third-party flag, and incident-relevance note.
