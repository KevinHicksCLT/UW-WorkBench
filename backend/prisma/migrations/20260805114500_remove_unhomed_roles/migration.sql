-- Data migration (no schema change): remove the two unhomed Role rows that make
-- the Organization views render a synthetic "Unassigned" segment and a
-- "Direct to division" bucket.
--
-- Neither bucket is a real OrgUnit. /explorer/org-table invents an "Unassigned"
-- segment for roles with a NULL orgUnitId, and the org map renders a
-- "Direct to division" pseudo-team for roles homed on an L2 division instead of
-- an L3 department — so both are symptoms of role rows that were never given a
-- proper home. ABC Insurance had one of each, both hand-created typo duplicates:
--
--   cmsf456qs03xuv8cghh5wvsdg  "Underwriting Assiststant"  no org unit, 1 Owner link
--   cmrj9zpdy0001l404hbfbhi1n  "Operation Manager"         on the Finance & Investments division, no links
--
-- This ships as a migration rather than a one-off script because a script only
-- ever cleans the one branch it is pointed at: develop, production and every
-- CI-created preview branch each carried their own copy of these rows. Running
-- through `prisma migrate deploy` is what makes every environment converge.
--
-- Every statement is id-scoped and guarded, so it is a no-op wherever the rows
-- were already removed (or never existed, as on production for the newer row).

-- 1. Re-point the typo role's node links onto the correctly-spelled
--    "Underwriting Assistant" (cmqsck0rr03y3mbk80pomhqxg) so the tasks it owns
--    keep an owner. (processNodeId, roleId, role_) is unique, so a link the
--    target already holds is skipped here and dropped as a duplicate in step 2.
UPDATE "NodeRole" nr
SET "roleId" = 'cmqsck0rr03y3mbk80pomhqxg'
WHERE nr."roleId" = 'cmsf456qs03xuv8cghh5wvsdg'
  AND EXISTS (SELECT 1 FROM "Role" t WHERE t.id = 'cmqsck0rr03y3mbk80pomhqxg')
  AND NOT EXISTS (
    SELECT 1
    FROM "NodeRole" x
    WHERE x."processNodeId" = nr."processNodeId"
      AND x."roleId" = 'cmqsck0rr03y3mbk80pomhqxg'
      AND x."role_" = nr."role_"
  );

-- 2. Anything still on the typo role is a duplicate of a link the target already
--    had. Only drop it once the target is known to exist — otherwise the owner
--    link would be lost and step 3's guard leaves the role in place instead.
DELETE FROM "NodeRole" nr
WHERE nr."roleId" = 'cmsf456qs03xuv8cghh5wvsdg'
  AND EXISTS (SELECT 1 FROM "Role" t WHERE t.id = 'cmqsck0rr03y3mbk80pomhqxg');

-- 3. Delete both strays, but only while they carry nothing. If either has since
--    picked up associations this migration cannot move, it is left alone rather
--    than silently dropping them.
DELETE FROM "Role" r
WHERE r.id IN ('cmsf456qs03xuv8cghh5wvsdg', 'cmrj9zpdy0001l404hbfbhi1n')
  AND NOT EXISTS (SELECT 1 FROM "NodeRole" x WHERE x."roleId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "NodeRole" x WHERE x."reassignedToRoleId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "RoleOrgAssignment" x WHERE x."roleId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "RoleDeliverable" x WHERE x."roleId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "RoleStandard" x WHERE x."roleId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "RoleRegulation" x WHERE x."roleId" = r.id);
