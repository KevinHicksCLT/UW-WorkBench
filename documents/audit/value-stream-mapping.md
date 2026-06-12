# Value-stream 29→21 mapping worksheet

> **DECIDED 2026-06-09** (user delegated the call): Section-B renames as suggested;
> Section-C extras mapped to their tentative targets; **Enterprise Strategy & Portfolio
> Management promoted to a NEW canonical value stream** (under Product, Delivery & PMO) —
> its 42 roles/32 I/O/12 metrics were too substantial to fold into a wrong stream.
> Canonical set is now **22**. Applied in `backend/scripts/vs-mapping.ts`; results:
> I/O 835/835 attached, role participations 404/404 resolved.

Keep the **21 canonical** value streams; map each legacy stream's connections onto one.
Fill the `→ canonical` column (or write `NEW` to promote a legacy stream to its own
canonical value stream, or `DROP` to discard — connections then logged, not lost).
Counts = connections currently on that legacy stream (roles / apps / I-O / metrics).

## The 21 canonical value streams (valid targets)
Actuarial & Reserving · Billing, Collections & Receivables · Capital & Treasury Management ·
Claims Intake-to-Settlement · Customer Service & Experience · Cybersecurity, Identity & Resilience ·
Data & Analytics · Delegated Authority Management · Distribution Management · Enterprise Risk Management ·
Financial Planning & Reporting · Human Capital Management · Investment Management · Legal & Compliance ·
Policy Administration & Servicing · Product Design & Management · Reinsurance Management ·
Risk & Compliance Management · Submission-to-Bind · Technology Delivery & Change · Vendor & Third-Party Management

## A. Already match (no action) — 6
Billing, Collections & Receivables · Claims Intake-to-Settlement · Cybersecurity, Identity & Resilience ·
Delegated Authority Management · Policy Administration & Servicing · Technology Delivery & Change

## B. Likely renames (confirm or change) — 14
| Legacy stream | roles/apps/io/metrics | → canonical (suggested) |
|---|---|---|
| Actuarial Pricing, Reserving & Capital Modeling | 9/5/32/12 | Actuarial & Reserving |
| Submission-to-Bind / Underwriting | 17/4/32/12 | Submission-to-Bind |
| Distribution & Channel Management | 15/4/32/7 | Distribution Management |
| Data, Analytics & AI Management | 19/3/32/9 | Data & Analytics |
| Investment & Asset Management | 3/3/31/6 | Investment Management |
| Legal, Governance & Privacy Management | 12/1/32/5 | Legal & Compliance |
| Product & Proposition Management | 12/1/32/6 | Product Design & Management |
| Reinsurance & Retrocession Management | 7/4/32/7 | Reinsurance Management |
| Talent & Workforce Management | 6/1/32/8 | Human Capital Management |
| Third-Party & Vendor Management | 3/0/32/5 | Vendor & Third-Party Management |
| Customer Service, Complaints & Experience | 16/2/32/7 | Customer Service & Experience |
| Technology Strategy, Architecture & Delivery | 26/1/32/6 | Technology Delivery & Change |
| Finance, Treasury & Capital Management | 19/3/32/12 | Capital & Treasury Management |
| Risk, Compliance & Regulatory Management | 25/3/34/9 | Risk & Compliance Management |

## C. Extras — your call (map / NEW / DROP) — 9
| Legacy stream | roles/apps/io/metrics | → canonical (my tentative) | YOUR CALL |
|---|---|---|---|
| Claims Recoveries & Subrogation | 3/2/34/9 | Claims Intake-to-Settlement | |
| Service Operations, Incident & Production Support | 17/2/32/6 | Technology Delivery & Change | |
| MLOps / ML Lifecycle Management | 19/0/0/7 | Data & Analytics | |
| AIOps & Intelligent Operations | 29/0/0/8 | Technology Delivery & Change ? | |
| FinOps / Cloud Financial Management | 27/0/0/9 | Financial Planning & Reporting ? | |
| Audit & Assurance | 2/2/31/6 | Enterprise Risk Management ? | |
| Change Management & Adoption | 5/0/32/5 | Human Capital Management ? | |
| Marketing, Growth & Customer Insights | 7/2/32/6 | Distribution Management ? | |
| Enterprise Strategy & Portfolio Management | 42/0/32/12 | (no clear canonical — NEW?) | |

## Notes
- 2 canonical streams have no obvious legacy source: **Financial Planning & Reporting**,
  **Enterprise Risk Management** — candidates for some Section C extras.
- Once you confirm B + fill C, I apply exactly your mapping: re-link every connection to
  the canonical node, then resume the repoint (P5/P6) with no screen regression.
