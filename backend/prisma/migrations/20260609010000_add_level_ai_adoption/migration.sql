-- defect-fixes_01 / task #6 (D3/D7/U2/A1) — AI-adoption on canonical value streams.
--
-- Telemetry's AI-adoption levels lived only in frontend code (lib/aiAdoption.ts),
-- keyed to the legacy 29-stream list. This companion table moves them into the DB,
-- keyed to the canonical value-stream Level node (levelNumber = 3), so they are
-- admin-editable and Telemetry can render from the same model as Value Streams/Home.
-- One row per value-stream Level node; the four columns are the AI autonomy modes.
-- Values: not_used | pilot | emerging | scaling | embedded.
--
-- Applied to the dev branch via raw SQL (`prisma db execute`) — branch migration
-- history is out of sync with the repo (no migrate dev/deploy). Promote to prod the
-- same way after review.

CREATE TABLE "LevelAiAdoption" (
  "id"           TEXT NOT NULL,
  "levelId"      TEXT NOT NULL,
  "aiAssist"     TEXT NOT NULL DEFAULT 'not_used',
  "aiAugment"    TEXT NOT NULL DEFAULT 'not_used',
  "aiWorkflow"   TEXT NOT NULL DEFAULT 'not_used',
  "aiAutonomous" TEXT NOT NULL DEFAULT 'not_used',
  "useCases"     JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LevelAiAdoption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LevelAiAdoption_levelId_key" ON "LevelAiAdoption"("levelId");

ALTER TABLE "LevelAiAdoption"
  ADD CONSTRAINT "LevelAiAdoption_levelId_fkey"
  FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;
