-- Task.source — distinguishes how a task entered the work tracker. Additive only.
-- 'process' = derived from an L5 process step (the original tasks); 'role' =
-- derived from a role responsibility (RoleTask) distributed onto a deliverable.
-- Existing rows default to 'process', preserving their meaning. No table dropped.

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'process';
