-- Rework follow-up: finish the storage migration the user flagged.
-- (1) AI-adoption moves to a NODE-keyed table (NodeAiAdoption) so nothing
--     user-editable lives on the legacy Level table anymore; rows copied from
--     LevelAiAdoption through Node.code (= legacy Level id). The promoted ESPM
--     stream becomes storable too.
-- (2) Clean the junk edit stranded in the legacy Level table ("Core Business
--     !!!!!!!!") — the table is no longer rendered or editable, but the data
--     should be clean regardless.

CREATE TABLE "NodeAiAdoption" (
  "id"           TEXT NOT NULL,
  "nodeId"       TEXT NOT NULL,
  "aiAssist"     TEXT NOT NULL DEFAULT 'not_used',
  "aiAugment"    TEXT NOT NULL DEFAULT 'not_used',
  "aiWorkflow"   TEXT NOT NULL DEFAULT 'not_used',
  "aiAutonomous" TEXT NOT NULL DEFAULT 'not_used',
  "useCases"     JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NodeAiAdoption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NodeAiAdoption_nodeId_key" ON "NodeAiAdoption"("nodeId");
ALTER TABLE "NodeAiAdoption"
  ADD CONSTRAINT "NodeAiAdoption_nodeId_fkey"
  FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy existing adoption onto the canonical value_stream nodes.
INSERT INTO "NodeAiAdoption" ("id", "nodeId", "aiAssist", "aiAugment", "aiWorkflow", "aiAutonomous", "useCases")
SELECT 'naia_' || substr(md5(random()::text || n.id), 1, 20), n.id,
       a."aiAssist", a."aiAugment", a."aiWorkflow", a."aiAutonomous", a."useCases"
FROM "LevelAiAdoption" a
JOIN "Node" n ON n."code" = a."levelId" AND n."typeKey" = 'value_stream'
ON CONFLICT ("nodeId") DO NOTHING;

-- Clean the stranded test edit in the (retired) legacy Level table.
UPDATE "Level" SET "name" = 'Core Business'
WHERE "name" LIKE 'Core Business %!%';
