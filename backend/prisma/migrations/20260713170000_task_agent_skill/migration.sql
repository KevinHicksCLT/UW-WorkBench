-- Task agent-skill pack pointer. The pack content itself lives in SkillFile
-- rows (skill = "task-<nodeId>"); these two columns record that a task has a
-- generated pack and when it was last (re)generated.
ALTER TABLE "ProcessNode" ADD COLUMN IF NOT EXISTS "agentSkill" TEXT;
ALTER TABLE "ProcessNode" ADD COLUMN IF NOT EXISTS "agentSkillGeneratedAt" TIMESTAMP(3);
