---
name: db-data-model
description: How to associate data in the DB the right way — single source of truth, zero duplicated data, and when (rarely) a new table is justified. Use whenever adding/linking entities, wiring a relationship, deciding between a column and a junction, denormalizing a name, or proposing a schema change. Enforces the erd_v5 generic typed-graph model and keeps documents/value-streams/Master Documentation/erd_v5.mmd in sync with backend/prisma/schema.prisma.
---

# DB Data Model — association, single source of truth, new tables

The schema is a **generic typed-graph** (erd_v5). Two recursive spines —
**OrgUnit** (org tree) and **ProcessNode** (value-stream tree) — plus **Role**,
and everything else hangs off them by **FK**. The whole point of the rebuild was
to kill duplicated names and the three overlapping legacy spines. Don't reintroduce
either.

**Canonical files:**
- Schema: `backend/prisma/schema.prisma`
- ERD (must match schema 1:1): `documents/value-streams/Master Documentation/erd_v5.mmd`
- Resolvers (read-time joins, no denormalization): `backend/src/lib/resolvers/*`
- Closures (subtree/rollup): `backend/src/lib/closure.ts`

## Hard rule: ERD and schema move together

**Every schema change updates `erd_v5.mmd` in the SAME commit.** Entity block,
relationship line, and a `style …` line (color by group). If you touched a model
and didn't touch the ERD, the change is not done. Verify after: model count in
schema == entity count in ERD (minus `Tenant`/`User`, which are auth infra and
intentionally excluded from the domain ERD).

## Single source of truth (no duplicated data)

A fact lives in **exactly one column on one row**. Everything else reaches it by
**FK join**, never by copying.

- **A name/label lives once.** `dbValue` = system name, `displayValue` = the
  editable label, on the owning row (`OrgUnit`, `ProcessNode`, `Role`,
  `Company`…). Relabeling once via `displayValue` (or a `Terminology` row) must
  propagate everywhere through joins. **Never** add a `roleName`, `valueStreamName`,
  `divisionName`, `ownerRole` text column — that's the duplication the rebuild
  deleted. If you need a name in a response, join to it.
- **A link is a relationship, not text.** "This task is owned by that role" is a
  `NodeRole` row (FK→ProcessNode, FK→Role), not a string field and not read-time
  text matching. The old `roleMatch.ts` name-matching was the bug; real FK
  junctions replaced it.
- **Denormalized numbers are derived caches only.** `PortfolioInitiative.cumulative*`
  / `valueScore`, and the `*Closure` tables, are recomputed from source rows
  (rollup service / closure rebuild). They are allowed *because* a service owns
  recomputing them. Never hand-edit them; never treat them as the source.
- **Scope by FK, not by copied keys.** Tenant/company scope comes from the
  relation (`req.tenantId`, `companyId`) — walk the relation up to the owner,
  e.g. `where: { workstream: { program: { tenantId } } }`. Return **404** on a
  cross-tenant miss, not 403.

## How to associate data (decision order)

Before adding anything, find where the fact already lives. Then pick the
**lowest** option that fits:

1. **It's an attribute of one existing row** → add/set a **column** on that row.
   (e.g. `ProcessNode.automatability`, `Application.criticality`.)
2. **It's a 1:1 satellite** of a row → reuse the row, or a `@unique` 1:1 table
   only if the data is genuinely optional/large (pattern: `NodeAiAdoption`,
   `processNodeId @unique`).
3. **It's a parent/child of the same type** → it's a tree edge: set `parentId`
   (self-relation) on the existing spine (`OrgUnit`, `ProcessNode`, `Standard`,
   `Role.managerRoleId`). **Do not make a new table for a new level** — add an
   `OrgLevelType`/`ProcessLevelType` row instead (that's how "Department" was
   added: a level type, not a table).
4. **It's a many-to-many link between two existing entities** → a **junction
   table** (see convention below). This is the default for any cross-entity
   association. The ERD's red tables are all of these.
5. **Only if none of the above** → a genuinely new entity (see next section).

### Junction table convention (copy an existing one exactly)

Mirror `NodeDeliverable` / `NodeRole` / `NodeAppUsage`:

```prisma
model NodeDeliverable {
  id            String      @id @default(cuid())   // surrogate PK
  companyId     String                              // scope (not a relation here)
  processNodeId String
  processNode   ProcessNode @relation(fields: [processNodeId], references: [id], onDelete: Cascade)
  deliverableId String
  deliverable   Deliverable @relation(fields: [deliverableId], references: [id], onDelete: Cascade)
  // discriminator, if the link is typed:  role_ String  // "Owner|Participant"

  @@unique([processNodeId, deliverableId])          // natural key = no dup links
  @@index([processNodeId])
  @@index([deliverableId])
  @@index([companyId, processNodeId])
}
```

Rules baked in above — match all of them:
- **Surrogate `id` PK + `@@unique` on the natural key** (the FK pair, plus the
  discriminator if typed). The unique key is what makes duplicate associations
  impossible at the DB level.
- `onDelete: Cascade` on both FK sides so a deleted parent takes its links.
- Index every FK and the `companyId`-scoped lookup.
- **Discriminator column is named `role_`** (trailing underscore) when `role`
  is taken by the Prisma relation — see `NodeRole.role_`, `RoleDeliverable.role_`.
- Junctions bind at **any level** of the spine (a deliverable can link to an L2
  or an L5 ProcessNode). Don't make level-specific tables (`StepDeliverable`,
  `Standard_L4` were exactly that mistake and got generalized).

### Closures are derived, never authored

`OrgUnitClosure` / `ProcessNodeClosure` (composite `@@id([ancestorId, descendantId])`,
`depth`) are maintained by `lib/closure.ts` on insert/move/delete. Use them for
fast subtree / rollup reads. Never insert closure rows by hand — call the closure
helpers; `rebuildClosure` repairs.

## When to create a NEW table (rarely)

Default answer is **no** — reuse a spine, a column, a level type, or a junction.
A new table is justified **only** when ALL of these hold:

- It's a **first-class entity with its own lifecycle and identity** (created,
  updated, deleted on its own), not an attribute, link, level, or derived cache.
- Its data **does not already exist** on any current row (you searched and it's
  genuinely new — no name/field you could join to instead).
- It **cannot** be a self-relation tree edge or a junction between two existing
  entities.
- Adding it introduces **zero duplicated data** — no name/label/number it stores
  is already owned by another row.

If you're adding it just to "denormalize for speed," stop — use a resolver
(`lib/resolvers/*`) or a closure-backed read instead. If you're adding it to hold
a new hierarchy level, stop — add a `*LevelType` row. If it holds a link, it's a
junction, not a new entity.

### New table checklist (when justified)
- [ ] `id String @id @default(cuid())` PK; `companyId String` scope column.
- [ ] FK relations with explicit `onDelete` (`Cascade` for owned children,
      `SetNull` for optional cross-links — see `PortfolioInitiative` FKs).
- [ ] Index every FK + each `@@index([companyId, …])` you query on.
- [ ] No text column duplicating another row's name — FK to it instead.
- [ ] Enum-ish fields are plain `String` with the allowed tokens in a `//` comment
      (no Prisma enums — match existing style).
- [ ] **erd_v5.mmd updated in the same change**: entity block + relationship +
      `style` line (color group: red=junction · blue=value-stream · orange=org ·
      green=work · purple=other · teal=portfolio/telemetry · yellow=regulations ·
      brown=rationalization).
- [ ] Migration: `npx prisma migrate dev --name <change>` (needs `DIRECT_URL`),
      then reseed.

## Quick self-check before any schema edit

1. Does this fact already live somewhere? → join, don't copy.
2. Is it an attribute / a level / a link / a real entity? → column / level-type /
   junction / (last resort) new table.
3. Did I avoid every name-duplicating text column?
4. Did I update `erd_v5.mmd` in the same change?
5. Counts line up: schema models == ERD entities (+Tenant/User)?
