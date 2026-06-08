-- Regulatory-compliance traceability on StandardItem: link each standard to the
-- SDLC agent skill that enforces it, plus the SDLC gates, regulatory citation,
-- and the value streams it applies to. Additive + idempotent (the columns may
-- already exist on branches where they were added out-of-band).
ALTER TABLE "StandardItem" ADD COLUMN IF NOT EXISTS "agentSkill" TEXT;
ALTER TABLE "StandardItem" ADD COLUMN IF NOT EXISTS "sdlcGates" TEXT;
ALTER TABLE "StandardItem" ADD COLUMN IF NOT EXISTS "regCitation" TEXT;
ALTER TABLE "StandardItem" ADD COLUMN IF NOT EXISTS "appliesToValueStreams" TEXT;
