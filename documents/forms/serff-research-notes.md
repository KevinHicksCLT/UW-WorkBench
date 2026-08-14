# SERFF-Informed Research Notes — Forms Library Authorship (SCRUM-229)

These notes record the public, general-knowledge conventions used to author the
**synthetic** variant families around the nine client manuscript forms so the
seeded library reads like a real filed form library. They inform authorship
only. **No live SERFF scraping, no paid data, and no real carrier content was
acquired** — consistent with the Forms module's standing out-of-scope position
on external data acquisition. Every synthetic form is fictional; form numbers
live in the anchor's own invented numbering space and no real carrier names are
used.

Sources are the publicly documented, widely known conventions of the NAIC
System for Electronic Rate and Form Filing (SERFF), ISO/ISO-style commercial
form numbering, and standard state amendatory-endorsement practice. Where a
specific figure would require a live lookup (e.g. a particular state's exact
windstorm sublimit rule), the synthetic value is plainly illustrative.

## 1. SERFF filing lifecycle & statuses

SERFF is the NAIC's electronic conduit between filers (carriers) and state
insurance departments for rate, rule and **form** filings. A form filing moves
through a lifecycle whose externally visible states map cleanly onto the four
tokens the module already models on `PolicyForm.filingStatus`:

| Module token | Real-world analog |
|---|---|
| `Draft` | Filing assembled by the carrier, not yet submitted to the state. |
| `Filed` | Submitted / "Filed" and under department review (a.k.a. pending / open). |
| `Approved` | Dispositioned "Approved" (or deemed filed in a file-and-use state). |
| `Withdrawn` | Withdrawn by the filer or superseded by a later edition. |

Modeling notes applied to the synthetic data:

- **Countrywide core editions** are authored as `Approved` (they anchor the
  family). **Regional/program editions** that introduce a limit or notice change
  are `Filed` (under review). **Newest program experiments** are `Draft`.
  **Prior generations** that a newer edition supersedes are `Withdrawn` but are
  intentionally kept in the library as retire candidates.
- Filing status is independent of the clause content — a `Filed` edition can
  carry the same wording as an `Approved` one, which is exactly the
  rationalization problem the module surfaces.

## 2. Form number + edition-date conventions

ISO-style commercial forms use a **line/prefix + number + edition date** grammar
(e.g. `CG 20 10 04 13` = Commercial General Liability, form 20 10, April 2013).
Conventions carried into the synthetic authorship:

- **Prefix = line of business.** The manuscripts already use line-specific
  prefixes (`AL`, `CAN`, `CAR`, `CPP`, `CYB`, `DO`, `EL`, `OCIP`, `PE`); variants
  keep the family prefix.
- **Number identifies the form; edition date identifies the revision.** In this
  schema `formNumber` is unique per company, so a *superseded edition kept in the
  library* is authored as a **distinct form number** in the same family (e.g.
  `CYB 1008` superseded by `CYB 1009`, `CPP 1012` superseded by `CPP 1016`,
  `AL 1019` superseded by `AL 1022`) rather than a second edition of the same
  number. Its `editionDate` is earlier and its status is `Withdrawn`.
- **Edition date = `MM DD YYYY`** (matching the manuscripts' `08 10 2026`), or
  `MM YYYY` where the source omits the day (`CAR 1220`, `PE 1221`). Variant
  edition dates form a plausible forward sequence (2024 superseded → 2026 anchor
  → 2027 program editions).

## 3. Countrywide vs. state-specific structure

Real filed libraries are organized as a **countrywide base** plus
**state-specific amendatory endorsements** that modify the base only where a
particular jurisdiction requires it. This is the backbone of the synthetic
family structure:

- Each family has a **countrywide** member (`states = null`) and one or more
  **state cohort** members whose `states` postal-code set matches the variant
  story:
  - `CYB 1106 (CA)` — a CCPA-flavored notification condition and a raised
    aggregate limit.
  - `CPP 1114 (FL)` — a reduced windstorm catastrophe sublimit (coastal wind).
  - `CAN` cohorts split by legal-market maturity (`CO/OR` mature, `CA` its own
    edition, `NY/NJ` emerging, `MI` microbusiness).
  - `CAR 1316 (FL/TX/LA)` — a Gulf named-storm transit deductible.
  - `OCIP 1113 (CA)` / `PE 1316 (NY/CA)` — jurisdiction-specific period/run-off.
- **State amendatory pattern:** a state edition changes exactly the provision the
  jurisdiction drives (a limit, a notice period, an added exclusion) and leaves
  the rest identical — which is why most clauses across a family are byte-for-byte
  equal and only one or two diverge.

## 4. Amendatory / endorsement drafting patterns

- **Endorsements state what they modify** ("This endorsement modifies insurance
  provided under the Cyber Liability Coverage Form") and use **lettered sections
  (A., B., C.)**. Coverage **forms** use ALL-CAPS section headings (`COVERED
  PROPERTY`, `CATASTROPHE SUBLIMITS`, `EXCLUSIONS`). Both patterns are preserved
  from the manuscripts and reused verbatim by the synthetic variants.
- **Defined terms** are capitalized (Insured, Company, Cyber Event, Independent
  Director, Change in Control) and used consistently across a family.
- **Schedules** (`Schedule A`, `Schedule B`, schedule of covered parties /
  aircraft / portfolio companies) are referenced from the body and back the
  field-plane extraction.

## 5. How this grounds the controlled-divergence recipe

The rationalization problem only exists when the *same provision* is drafted
slightly differently across a filed library. The synthetic recipe reproduces the
real-world causes of that drift:

| Real cause | Synthetic op |
|---|---|
| Editorial rewording between editions with no coverage change | `reword` (semantically equivalent — cluster fodder) |
| A state/program driving a different limit or notice period | `limit` (materially divergent — findings fodder) |
| A newer edition adding an exclusion, or a program omitting a clause | `add` / `drop` (outlier / missing-clause) |
| A prior generation left active in the library | `Withdrawn` superseded edition (retire candidate) |

Divergence is applied to **one or two clauses per variant**, leaving clause order
and the remaining wording intact — so lexical clustering produces at least one
high-similarity cluster and at least one flagged outlier per family, exactly as a
real filed library would when run through the module.

## 6. Explicitly out of scope

- No connection to the live SERFF Filing Access system, no scraping, no download
  of any real filing, and no use of any carrier's proprietary form text.
- Real dollar figures, sublimits and notice periods are illustrative, not filed
  values. They are internally consistent within the synthetic library so the
  module's findings and dispositions demonstrate correctly.
