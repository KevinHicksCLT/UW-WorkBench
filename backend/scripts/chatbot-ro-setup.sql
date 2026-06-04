-- ───────────────────────────────────────────────────────────────────────────
-- Read-only Postgres role for the AI Assistant (/chat).
--
-- Run this ONCE against the CapgeminiTransformationBridge Neon database
-- (as neondb_owner — e.g. in the Neon SQL Editor or `psql`).
--
-- The password below is already generated and already matches DATABASE_URL_RO
-- in backend/.env, so you can run this file as-is. (This file is gitignored-
-- sensitive — don't commit it with the password; rotate later if needed.)
--
-- This role can ONLY run SELECT against the operating_model schema. It has no
-- write privileges anywhere and no access to the `public` schema (where the
-- User table / password hashes live).
-- ───────────────────────────────────────────────────────────────────────────

CREATE ROLE chatbot_ro WITH LOGIN PASSWORD 'rd3IqTz1z2c5GwK5Sz1Iq4Wf'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

-- Allow it to connect to the database.
GRANT CONNECT ON DATABASE neondb TO chatbot_ro;

-- Grant read-only access to the operating_model schema (current + future tables).
GRANT USAGE ON SCHEMA operating_model TO chatbot_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA operating_model TO chatbot_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA operating_model
  GRANT SELECT ON TABLES TO chatbot_ro;

-- Wall it off from `public` (Prisma app schema, incl. User password hashes).
REVOKE ALL ON SCHEMA public FROM chatbot_ro;

-- ── Verify (optional) ──────────────────────────────────────────────────────
--   SELECT count(*) FROM operating_model.role;          -- should succeed
--   SELECT count(*) FROM public."User";                 -- should FAIL (no access)
--   INSERT INTO operating_model.role(canonical_name) VALUES ('x');  -- should FAIL
