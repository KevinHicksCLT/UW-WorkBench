-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;

-- Backfill the structured components from the existing display name: the first
-- whitespace-delimited token becomes firstName, the remainder lastName. Rows
-- with a single-token name get a null lastName (the app falls back to name).
UPDATE "User"
SET
  "firstName" = NULLIF(split_part(btrim("name"), ' ', 1), ''),
  "lastName"  = NULLIF(
    btrim(substring(btrim("name") FROM position(' ' IN btrim("name")) + 1)),
    ''
  )
WHERE position(' ' IN btrim("name")) > 0;

-- Single-token names: firstName only.
UPDATE "User"
SET "firstName" = NULLIF(btrim("name"), '')
WHERE position(' ' IN btrim("name")) = 0;
