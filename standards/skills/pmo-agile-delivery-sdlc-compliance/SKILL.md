---
name: pmo-agile-delivery-sdlc-compliance
description: >
  Enforce and evidence the PMO & Agile Delivery standards area (22 standards owned by the PMO
  Director / RTE) across the software delivery lifecycle — requirements, design, development, and
  testing — for how delivery work itself is initiated, planned, governed, and closed. Use this
  skill whenever work involves portfolio intake and prioritization, project charters and planning,
  status and gate reviews, sprint cadence and scrum ceremonies, definition of ready/done, velocity
  and capacity planning, PI planning and ART sync (SAFe), RAID logs and issue management, change
  control, vendor/SOW management, or project closure — even if the user does not say "PMO standard"
  or "delivery process." Also use when building tooling that supports delivery (intake forms,
  status dashboards, RAID trackers), and whenever the goal is evidence that an initiative passed
  its gates. When unsure whether work item governance applies, run the scope gate rather than
  skipping it.
---

# PMO & Delivery Standards Across the SDLC — Governing the Work That Builds the Work

## What this skill does

The PMO & Agile Delivery area defines **22 standards** across Portfolio, Project, Agile, SAFe,
Resource, Risk, Change, Vendor, and Closure. Unlike the domain areas, these standards govern **the
delivery process itself** — so this skill maps them onto the SDLC phases of any initiative: intake
and chartering at Requirements, planning and ways-of-working at Design, execution discipline at
Development, and gate/closure discipline at Testing. It also governs tooling built **for** delivery
(intake, status, RAID trackers). Each gate names the **evidence** a portfolio review or audit will
ask for.

The source standards live in the app's Standards area (**Data Admin → Standards → PMO & Agile
Delivery**), each with category, Build/Run phase, and responsible role (PMO Director, Project
Manager, Scrum Master, Product Owner, RTE).

## Operating principle (read once, apply always)

> **Work without a charter, a definition of done, and a RAID log is unmanaged risk in motion.**
> *Project Charter* (sponsor approval, scope, success criteria), *Definition of Done* (code
> complete, tested, documented, reviewed, deployable, accepted), and *Risk Management* (RAID log
> with mitigation plans) are the minimum harness. The PMO standards exist so that "how is it
> going?" has an evidenced answer, not an optimistic one.

The delivery artifacts themselves — charter, plan, status reports, RAID log, gate sign-offs — are
the compliance record.

## STEP 0 — Scope gate (always run first)

1. **Is this new work entering the portfolio?** → *Intake Process* (business case, value
   assessment, capacity validation) and the *Prioritization Framework* (weighted scoring, strategic
   alignment, ROI) apply before anything is scheduled.
2. **Project-shaped or product-team-shaped?** Project → Project + Risk + Change + Closure
   categories. Agile team → Agile category (sprints, ceremonies, DoR/DoD). Scaled (multiple teams,
   quarterly planning) → SAFe category (*PI Planning*, *ART Sync*, *Inspect & Adapt*).
3. **Vendors involved?** → *Vendor Management* (SOW/contract, milestone tracking, performance
   monitoring, invoicing) applies.

- Small in-team maintenance work: record that it is below the intake threshold and apply only the
  Agile-category standards.

## The four phase gates

Each gate lists mandatory checks (named standards in italics) and the evidence each leaves behind.

### 1. Requirements (initiate)
- Pass intake: business case with value assessment; scored via the *Prioritization Framework*;
  capacity validated against the *Capacity Planning* forecast.
- Produce the *Project Charter*: sponsor approval, scope definition, success criteria, assumptions
  and constraints.
- Stories meet *Definition of Ready* before sprint planning: acceptance criteria, dependencies
  identified, sized, no blockers.
- **Evidence:** approved business case + priority score, signed charter, DoR-compliant backlog.

### 2. Design (plan)
- *Project Planning*: WBS or backlog, schedule/roadmap, resource plan, risk register, communication
  plan.
- Establish ways of working: *Sprint Cadence* (2-week sprints, consistent days, sprint goals),
  *Scrum Ceremonies* (planning, standup, review, retro), team *Definition of Done*.
- Scaled: *PI Planning* (objectives, dependencies, confidence vote) and dependency mapping.
- Open the RAID log (*Risk Management*: probability/impact, mitigation plans; *Issue Management*:
  ownership, target dates, escalation path).
- **Evidence:** plan artifacts, published DoD, PI objectives/board, initialized RAID log.

### 3. Development (execute)
- *Status Reporting*: weekly, RAG status, milestones, risks/issues, decisions needed — no silent
  ambers.
- *Velocity Tracking* feeding capacity planning; *Time Tracking* weekly at project/task level.
- Scope changes through *Change Control*: change request, impact assessment, approval authority,
  baseline updates — never absorbed silently.
- Scaled: weekly *ART Sync* for impediments and cross-team dependencies.
- Vendor milestones and performance tracked per *Vendor Management*.
- **Evidence:** status-report trail, velocity/actuals data, approved change requests, sync notes.

### 4. Testing (gate & close)
- *Gate Reviews*: phase-gate criteria met, deliverable checklist complete, approval workflow
  executed, lessons learned captured.
- Done means *Definition of Done* — including documented and deployable — verified, not asserted.
- *Project Closure*: deliverable acceptance, lessons learned, knowledge transfer, resource release.
- Scaled: *Inspect & Adapt* — PI retrospective, problem-solving workshop, improvement backlog.
- **Evidence:** gate sign-offs, acceptance records, lessons-learned doc, closure checklist.

## Run / operate handoff (not build gates)
*Portfolio Reviews* (monthly health indicators, escalation triggers, replanning), quarterly
*Capacity Planning*, ongoing prioritization re-scoring, and vendor governance cadence. These are
PMO-operated; initiatives feed them the data above.

## How to use this skill in practice
- **Starting any initiative:** run STEP 0 and the Requirements gate before committing capacity.
- **Reviewing delivery health:** check the Development-gate evidence trail (status, RAID, change
  log) — gaps there predict surprises later.
- **Building delivery tooling:** treat each standard's artifact (charter, RAID item, change
  request, gate checklist) as the data model; enforce required fields and approval routing.

## Boundaries
Process guidance, not a substitute for the PMO. Prioritization decisions, gate approvals, charter
sign-off, and replanning calls belong to the PMO Director / sponsors / RTE. Engineering-quality
gates (coverage, CI/CD) live in the engineering-development skill; this skill governs how the work
is run, evidenced, and closed.
