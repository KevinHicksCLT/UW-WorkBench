# Security Policy

## Reporting

Please report suspected vulnerabilities privately via GitHub Security Advisories
("Report a vulnerability" on the repo's Security tab). Do not open public issues for
security reports. You can expect an acknowledgment within a week.

## Model

- **Tenancy** is enforced in the service layer: every query is scoped to the JWT's tenant;
  cross-tenant lookups return 404. Database-level RLS is a roadmap item (defense in depth).
- **Governance spine** (`UwGovernanceEvent`) is append-only by construction — the service
  compiles no update/delete path. Treat any PR adding one as a vulnerability.
- **Agent surface**: MCP callers authenticate with the same JWT as humans; every call is
  audited; mutations are proposal-only. There is deliberately no unaudited agent path.
- **Secrets**: `JWT_SECRET` must be set in any real deployment (the dev default refuses to be
  a secret). Never commit `.env`.

## Scope notes for researchers

The demo seed credentials (`demo@uw-workbench.dev`) are intentionally public. Findings about
the simulated integrations (extraction, screening, PAS) are still welcome when they affect
the contract gates rather than the simulation itself.
