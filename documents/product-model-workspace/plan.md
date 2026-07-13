# Product Model Workspace — Design & Build Plan

Branch `Product-Model-Workspace` - extends the Workspace module (today's `RationalizationWorkspace`, menu key `workspace`, path `/portfolio`) with a fourth structure a user can work on - alongside Applications, Value Streams, and Roles - for normalizing legacy product models into a canonical/north-star product model, with segment and geography extensions where differences are required. Mirrors the App Rationalization pattern documented in `documents/workspace-renovation/renovation-plan.md`: legacy sources render as columns, a target taxonomy renders as boxes, and findings are classified and migrated between them.

## 1. Concept mapping (App Rationalization -> Product Model Rationalization)

| App Rationalization (existing) | Product Model Rationalization (new) |
|---|---|
| `RationalizationApp` - a legacy application | `LegacyProductModel` - a legacy product model owned by a carrier, MGA, or source system |
| `layer` - UI, Integration, Business Service, Data, Infrastructure | `component` - Party & Roles, Product Hierarchy, Coverage & Perils, Limits & Deductibles, Rating & Pricing, Forms & Wordings, Eligibility & UW Rules, Exposures & Schedules, Reinsurance & Layering, Regulatory & Filings, Distribution |
| `capdan` - Common / Different / Relocate / Eliminate | `scope` - Common / Segment / Geography / Eliminate |
| `RationalizationMicroservice` - greenfield target service | `CanonicalProductModel` - the north-star product definition |
| `AnatomyCategory` - per-layer reference catalog | `ProductModelAnatomyCategory` - per-component reference catalog (the sub-category/value library) |
| Inspection modes: Applications / Value Streams / Roles | Inspection modes: Legacy Product Models / Segment / Geography |

The board mechanics stay the same (columns per legacy source, boxes per target category, cards for findings, in-box expand/collapse from WR-10); only the taxonomy and the classification dimensions change.

## 2. Model components (the 11 target boxes)

Party & Roles, Product Hierarchy, Coverage & Perils, Limits & Deductibles, Rating & Pricing, Forms & Wordings, Eligibility & UW Rules, Exposures & Schedules, Reinsurance & Layering, Regulatory & Filings, Distribution - grouping the 19 named components (Party, Roles, Product Hierarchy, Coverages, Perils, Limits, Deductibles, Rating, Pricing, Forms, Wordings, Eligibility, Underwriting Rules, Exposures, Schedules, Reinsurance, Layering, Regulatory, Filings, Distribution) into the same paired structure used on the reference slide.

## 3. Reference catalog seed (ProductModelAnatomyCategory)

Seed data for the per-component, per-scope sub-category library - the equivalent of the WR-06 anatomy catalog. Representative (non-exhaustive) rows:

| Component | Common canonical core | Segment-specific | Geography / market-driven |
|---|---|---|---|
| Party & Roles | Insured, applicant, beneficiary, producer of record, payer, loss payee | Named/additional insureds (SMB), affiliate schedules (Large Commercial), coverholder/TPA (Lloyd's) | Legal entity types, KYC/tax identifiers, locally defined role terms |
| Product Hierarchy | LOB > Product > Plan > Coverage Part > Coverage | Personal (Auto/Home), SMB (BOP/Package), Large Commercial (monoline/towers), Lloyd's (Class of Business) | Solvency II lines, London market risk codes, local industry classification |
| Coverage & Perils | Insuring agreement, standard exclusions, endorsement library | Packaged perils, BOP bundles, manuscript covers, class-specific covers | Regional cat perils, terrorism pools, sanctions exclusions |
| Limits & Deductibles | Per-occurrence/aggregate limits, sub-limits, deductible/retention | Fixed tiers, layered towers, SIRs, Lloyd's line size/order % | Statutory minimum limits, currency conversions |
| Rating & Pricing | Base rate, rating factors, experience modification | Table/class rating, exposure/experience rating, actuarial + PMD | Rate filing regime, premium tax, FX |
| Forms & Wordings | Declarations, insuring agreement, conditions, definitions | State ISO forms, manuscript wordings, MRC slip/LMA clauses | Mandatory local clauses, bilingual requirements |
| Eligibility & UW Rules | Risk appetite statement, referral triggers | Rules engine, class appetite, referral/manual, binding authority | Admitted/non-admitted rules, sanctions screening, local licensing |
| Exposures & Schedules | Exposure base, schedule of locations/items | Vehicle/dwelling, premises/BI, statement of values, multi-territory | Currency of values, local building codes, flood/seismic zones |
| Reinsurance & Layering | Treaty (quota share, surplus, XoL), facultative RI | Back-end cat treaty, layered excess towers, facilities/lineslips | Collateral/trust rules for non-admitted reinsurers, cross-border RI tax |
| Regulatory & Filings | Rate/form filings, statutory reserving | State filings, surplus lines tax, CDR/bordereaux | Solvency II/IFRS 17, premium tax regimes, FATCA/CRS |
| Distribution | Producer hierarchy, commission structures | Direct/aggregator, agent/digital, broker-led, coverholder | Producer licensing, EU passporting, bancassurance |

Full sub-category detail lives in the accompanying research summary (chat history, 2026-07-11) and should be transcribed into the `ProductModelAnatomyCategory` seed script rather than re-typed here.

## 4. Data model additions (`backend/prisma/schema.prisma`)

New models, parallel to the `RationalizationWorkspace` family, added under a new `// --- PRODUCT MODEL RATIONALIZATION ---` section:

```
model ProductModelWorkspace {
  id            String   @id @default(cuid())
  tenantId      String
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  name          String
  description   String?
  northstar     String?  // e.g. "Commercial P&C North Star"
  status        String   @default("In Progress") // Proposed | In Progress | Migrating | Complete
  illustrative  Boolean  @default(true)
  layout        Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  legacyModels  LegacyProductModel[]
  components    ProductModelComponent[]
  findings      ProductModelFinding[]
  canonicals    CanonicalProductModel[]
  @@unique([tenantId, companyId, name])
  @@index([companyId])
}

model LegacyProductModel {
  id            String   @id @default(cuid())
  tenantId      String
  companyId     String
  workspaceId   String
  workspace     ProductModelWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  name          String   // e.g. "Guidewire PC - Commercial Auto (East)"
  description   String?
  sourceSystem  String?  // policy admin / rating system
  segment       String?  // Personal Lines | SMB | Large Commercial | Specialty/Lloyd's
  geography     String?  // originating region/country/market
  disposition   String   @default("Refactor") // Retain | Refactor | Replace | Retire
  position      Int      @default(0)
  illustrative  Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  findings      ProductModelFinding[]
  @@index([companyId])
  @@index([workspaceId])
}

model ProductModelComponent {
  id                String   @id @default(cuid())
  tenantId          String
  companyId         String
  workspaceId       String
  workspace         ProductModelWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  component         String   // Party & Roles | Product Hierarchy | Coverage & Perils | ...
  name              String
  principle         String?
  pattern           String?
  sourceStandard    String?  // ACORD, ISO, etc.
  canonicalId       String?
  canonical         CanonicalProductModel? @relation(fields: [canonicalId], references: [id], onDelete: SetNull)
  migrationStatus   String   @default("Identified")
  illustrative      Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  findings          ProductModelFinding[]
  @@index([companyId])
  @@index([workspaceId])
}

// Reference catalog for the anatomy taxonomy - per component x scope, the
// sub-categories/values that belong there (see section 3 above).
model ProductModelAnatomyCategory {
  id                  String   @id @default(cuid())
  tenantId            String
  companyId           String
  company             Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  component           String
  scope               String   // COMMON | SEGMENT | GEOGRAPHY
  name                String
  description         String
  applicableSegment   String?  // set when scope = SEGMENT
  applicableGeography String?  // set when scope = GEOGRAPHY
  sortOrder           Int      @default(0)
  @@unique([companyId, component, scope, name])
  @@index([companyId, component])
}

model ProductModelFinding {
  id                String   @id @default(cuid())
  tenantId          String
  companyId         String
  workspaceId       String
  workspace         ProductModelWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  legacyModelId     String
  legacyModel       LegacyProductModel @relation(fields: [legacyModelId], references: [id], onDelete: Cascade)
  component         String
  name              String
  category          String?  // matches ProductModelAnatomyCategory.name when known
  scope             String   @default("Common") // Common | Segment | Geography | Eliminate
  segmentValue      String?  // set when scope = Segment
  geographyValue    String?  // set when scope = Geography
  plainSummary      String?
  targetComponentId String?
  targetComponent   ProductModelComponent? @relation(fields: [targetComponentId], references: [id], onDelete: SetNull)
  treatment         String   @default("Retain") // Retain | Eliminate
  migrationStatus   String   @default("Identified")
  rationale         String?
  effort            String?
  complexity        String?
  notes             String?
  illustrative      Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  @@index([companyId])
  @@index([workspaceId])
  @@index([legacyModelId])
  @@index([targetComponentId])
}

model CanonicalProductModel {
  id            String   @id @default(cuid())
  tenantId      String
  companyId     String
  workspaceId   String
  workspace     ProductModelWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  name          String   // e.g. "Canonical Commercial Auto Product"
  description   String?
  status        String   @default("Planned") // Planned | Building | Live
  ownerRoleId   String?
  ownerRole     Role?    @relation("CanonicalProductModelOwner", fields: [ownerRoleId], references: [id], onDelete: SetNull)
  position      Int      @default(0)
  illustrative  Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  components    ProductModelComponent[]
  @@index([companyId])
  @@index([workspaceId])
}
```

One migration covers all six models plus the `Role` and `Company` back-relations.

## 5. Navigation (`shared/src/menuRegistry.ts`)

Add a top-level key so Product Models get their own master-data page (mirroring `applications`), in addition to appearing as a workspace type on `/portfolio`:

```
{ key: 'product-models', label: 'Product Models', path: '/product-models' },
```

## 6. UI / board behavior

`/portfolio` (the Workspace module) gains a domain switch above today's tri-mode selector: Application Rationalization vs. Product Model Rationalization. Under Product Model Rationalization, the inspection-mode selector becomes Legacy Product Models / Segment / Geography, the same pivot mechanic as WR-01, joined on `LegacyProductModel.segment` and `.geography` instead of `valueStreamNodeId` or owner-role. Boxes are the 11 model components, and card color follows `scope` (Common = blue, Segment = tan/orange, Geography = grey), matching the legend on the reference slide. The in-box expand/collapse pattern from WR-10 reveals the matched `ProductModelAnatomyCategory` sub-categories under each finding. A new `/product-models` master list, mirroring `/applications`, holds `LegacyProductModel` records outside of any one workspace so they can be reused across workspaces.

## 7. Phase plan

| Item | Description | Phase |
|---|---|---|
| PM-01 | Schema migration: the six models above plus `Role` / `Company` back-relations | P0 |
| PM-02 | Seed `ProductModelAnatomyCategory` from the research catalog (section 3, expanded) | P0 |
| PM-03 | `/product-models` master list page and CRUD API (mirrors `/applications`) | P0 |
| PM-04 | Domain switch on `/portfolio` (Application vs. Product Model Rationalization) | P1 |
| PM-05 | Legacy Product Models / Segment / Geography inspection modes (pivot logic) | P1 |
| PM-06 | Board rendering: 11 component boxes, scope-based card coloring, in-box expand | P1 |
| PM-07 | Findings CRUD (create, reclassify scope, assign segment/geography value, link to canonical component) | P1 |
| PM-08 | Canonical Product Model records, component linkage, status rollup | P2 |
| PM-09 | Semantic search and duplicate detection across legacy product models (reuses the WR-12/13 pgvector work once it ships) | P2 |

## 8. Sequencing & dependencies

PM-01/02/03 are pure additive schema, seed, and a new CRUD page, with no dependency on the App Rationalization refactor. PM-04/05/06/07 depend on the tri-mode lens groundwork already shipped for WR-01, since the mode-switch component is reused rather than rebuilt. PM-08 depends on PM-01. PM-09 depends on the WR-12 embedding pipeline landing first, since it is shared infrastructure rather than duplicated.
