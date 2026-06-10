-- operating-model rework P1 — unified node graph (see docs/operating-model-architecture.md).
-- Additive: NodeType (taxonomy) + Node (one row per structural concept) + NodeLink (edges).
-- Built alongside the legacy tables; backfilled and adopted in later phases.
-- Applied to the dev branch via raw SQL (broken migration history — no migrate dev/deploy).

CREATE TABLE "NodeType" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "dimension"   TEXT NOT NULL DEFAULT 'STRUCTURE',
  "key"         TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "pluralLabel" TEXT NOT NULL,
  "level"       INTEGER NOT NULL,
  "parentKeys"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "icon"        TEXT,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NodeType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NodeType_tenantId_key_key" ON "NodeType"("tenantId", "key");

CREATE TABLE "Node" (
  "id"          TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  "typeKey"     TEXT NOT NULL,
  "parentId"    TEXT,
  "name"        TEXT NOT NULL,
  "code"        TEXT,
  "description" TEXT,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "provenance"  TEXT NOT NULL DEFAULT 'illustrative',
  "attributes"  JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Node_companyId_typeKey_idx" ON "Node"("companyId", "typeKey");
CREATE INDEX "Node_parentId_idx" ON "Node"("parentId");
ALTER TABLE "Node" ADD CONSTRAINT "Node_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Node" ADD CONSTRAINT "Node_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NodeLink" (
  "id"           TEXT NOT NULL,
  "companyId"    TEXT NOT NULL,
  "fromId"       TEXT NOT NULL,
  "toId"         TEXT NOT NULL,
  "relationType" TEXT NOT NULL,
  "attributes"   JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NodeLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NodeLink_fromId_toId_relationType_key" ON "NodeLink"("fromId", "toId", "relationType");
CREATE INDEX "NodeLink_toId_relationType_idx" ON "NodeLink"("toId", "relationType");
CREATE INDEX "NodeLink_companyId_relationType_idx" ON "NodeLink"("companyId", "relationType");
ALTER TABLE "NodeLink" ADD CONSTRAINT "NodeLink_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NodeLink" ADD CONSTRAINT "NodeLink_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
