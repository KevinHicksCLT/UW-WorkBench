---
name: enterprise-solution-architecture-sdlc-compliance
description: >
  Enforce and evidence the Enterprise & Solution Architecture standards area (55 standards owned by
  the CTO / Enterprise Architect) across the software delivery lifecycle — requirements, design,
  development, and testing — for any new system, major change, integration, or technology selection.
  Use this skill whenever delivery work involves choosing a language, database, cloud platform,
  messaging or integration technology; designing APIs, microservices, events, or data pipelines;
  cloud landing zones, IaC, HA/DR; or anything that should pass through the Architecture Review
  Board — even if the user does not say "architecture standard" or "ARB." Also use when writing
  solution designs, ADRs, API specs, NFRs, or C4 diagrams, and whenever the goal is evidence that a
  design followed the approved patterns and stack. When unsure whether a change is
  architecturally significant, run the scope gate rather than skipping it.
---

# Architecture Standards Across the SDLC — Approved Patterns, Governed Decisions

## What this skill does

The Enterprise & Solution Architecture area defines **55 standards** across Architecture Principles,
Technology Stack, Architecture Patterns, API Standards, Cloud Architecture, Data Architecture,
Architecture Governance, and Documentation. Almost all are **Build-phase** — this is the most
SDLC-native standards area. This skill turns them into **SDLC gates** and names the **evidence
artifact** each gate must leave (ADR, ARB decision-log entry, solution design, fitness-function run),
so a design decision can always be traced to an approved standard or an approved deviation.

The source standards live in the app's Standards area (**Data Admin → Standards → Enterprise &
Solution Architecture**), each with category, Build/Run phase, and responsible role (Enterprise,
Solution, Data, or Cloud Architect).

## Operating principle (read once, apply always)

> **Reuse before buy before build — and write the decision down.** Every significant choice needs an
> *Architecture Decision Record*; every deviation from the *Reference Architecture Library* needs
> justification and approval. An undocumented decision is a future incident with no author.

Maintain one **Architecture Compliance Record** per initiative (typically the solution design doc +
its ADRs). The four gates write into it.

## STEP 0 — Scope gate (always run first)

1. **Major initiative?** New system, new integration, new technology, or cross-domain change →
   *Architecture Review Board (ARB)* approval required (meets weekly; decision log maintained).
2. **New technology?** Check the approved lists first: *Approved Languages* (Java 17+, Python 3.10+,
   TypeScript/Node 18+, C# .NET 6+), *Approved Databases*, *Approved Cloud Platforms* (Azure primary,
   AWS secondary), *Approved Messaging* (Service Bus, Kafka; RabbitMQ deprecated; no new TIBCO),
   *Approved Integration*, *Approved Observability*, *Container Platforms*, *CI/CD Tooling*.
   Anything off-list needs an ARB exception before design proceeds.
3. **Touches enterprise data domains?** (Customer, Policy, Claim, Product) → *Master Data
   Management* and the Data Architecture standards apply.
4. **Small, in-pattern change?** Record that determination and skip to lightweight review
   (*Technical Design Review* only).

- If unsure → treat as significant and put it in front of the ARB.

## The four phase gates

Each gate lists mandatory checks (named standards in italics) and the evidence each leaves behind.

### 1. Requirements
- Confirm *Business-Aligned Technology*: state which business capability/outcome the work supports.
- Apply *Reuse Before Buy Before Build*: document the reuse/buy scan before proposing a build.
- Capture *Non-Functional Requirements* explicitly: performance, scalability, availability,
  security, compliance — these drive HA/DR and API performance gates later.
- **Evidence:** capability mapping, reuse/buy analysis, documented NFRs.

### 2. Design
- Produce the *Solution Design Review* document (standard template) **before development starts**;
  diagram per *Architecture Diagram Standards* (C4 — Context, Container, Component; version
  controlled); *Sequence Diagrams* for complex flows.
- Choose patterns from the approved set and record each in an *Architecture Decision Record*:
  *Microservices Criteria*, *Event-Driven Architecture*, *Domain-Driven Design*, *CQRS Pattern*,
  *Backend-for-Frontend (BFF)*, *Strangler Fig Migration*, *Saga Pattern*, *Sidecar/Service Mesh*.
- API design per *API Design Guidelines*, *API Versioning* (URI versioning; 12-month deprecation),
  *API Security* (OAuth 2.0 + OIDC, rate limiting, no PII in URLs), *API Error Handling* (RFC 7807).
- Cloud design per *Landing Zone Standards*, *Network Architecture* (hub-spoke, private endpoints,
  no public IPs except load balancers), *High Availability* (multi-AZ for production, documented
  RPO/RTO), *Disaster Recovery* strategy, *Resource Naming Convention* + required tags.
- Data design per *Data Modeling Standards*, *Master Data Management*, *Data Lineage*, *Data
  Catalog*, *ETL/ELT Standards*, *Analytics Architecture* (medallion Bronze/Silver/Gold).
- Pass *Technical Design Review* (peer review with security/performance/operability checklist).
- **Evidence:** approved solution design, ADRs (status tracked), ARB decision-log entry, C4 diagrams.

### 3. Development
- Implement on the approved stack only; *Infrastructure as Code* (Terraform preferred, no manual
  changes, GitOps, drift detection).
- Generate *API Documentation* (OpenAPI 3.0, auto-generated, published to the developer portal) and
  *API Contracts* (consumer-driven; contract tests in CI/CD).
- Encode *Architecture Fitness Functions*: automated compliance tests in CI/CD; failures block
  deployment.
- Log new debt in the *Technical Debt Register* rather than silently absorbing it.
- **Evidence:** IaC repo, published OpenAPI spec, fitness-function results, debt-register entries.

### 4. Testing
- Verify NFRs: *API Performance* (P95 < 200 ms, pagination, caching, compression), HA failover
  behaves per the documented RPO/RTO, contract tests pass for every consumer.
- Verify error responses follow RFC 7807 with no stack traces in production.
- Confirm *Runbook Requirements*: operational runbook exists **before go-live**.
- **Evidence:** performance test results vs. NFRs, failover/DR test record, contract-test results, published runbook.

## Run / operate handoff (not build gates)
*Cost Management* (tagging, monthly rightsizing, reserved instances), *Disaster Recovery* quarterly
testing, *Technical Debt Register* grooming (20% capacity reserved), *Architecture Repository*
upkeep, ADR status maintenance, and quarterly runbook review. Each needs a named owner.

## How to use this skill in practice
- **Reviewing/authoring a design:** run the Design gate checklist; every pattern/stack choice either
  matches an approved standard or carries an ADR + ARB exception.
- **New initiative kickoff:** run STEP 0, then walk all four gates.
- **Audit/ARB prep:** confirm the solution design, ADRs, and fitness-function runs exist and are
  current in the Architecture Compliance Record.

## Boundaries
Engineering guidance, not a substitute for the ARB. Stack exceptions, pattern deviations, and
buy-vs-build calls are Enterprise Architect / ARB judgement. This skill enforces design-time
compliance and produces evidence; it does not approve deviations itself.
