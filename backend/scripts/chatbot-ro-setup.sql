-- ───────────────────────────────────────────────────────────────────────────
-- Read-only Postgres role for the AI Assistant (/chat).
--
-- Run this ONCE per Neon branch you want the assistant to read, against the
-- Enterprise-AI-Transformation database (as neondb_owner — e.g. in the Neon
-- SQL Editor or `psql`). Already applied to the `production` branch
-- (br-curly-poetry / ep-rough-bar) on 2026-06-12.
--
-- Replace <PASSWORD> with the password from DATABASE_URL_RO in backend/.env
-- (do NOT commit the real password).
--
-- The role can ONLY run SELECT against the `public` schema (the same Prisma
-- schema that feeds the app), with two exceptions explicitly revoked:
--   * "User"             — password hashes
--   * _prisma_migrations — migration bookkeeping
-- It has no write privileges anywhere. The app adds further guards: every
-- assistant query runs in a READ ONLY transaction with a statement timeout,
-- and only single SELECT/WITH statements are accepted (see chatDb.ts).
-- ───────────────────────────────────────────────────────────────────────────

CREATE ROLE chatbot_ro WITH LOGIN PASSWORD '<PASSWORD>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

-- Allow it to connect to the database.
GRANT CONNECT ON DATABASE neondb TO chatbot_ro;

-- Read-only access to the app schema (current + future tables)…
GRANT USAGE ON SCHEMA public TO chatbot_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO chatbot_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO chatbot_ro;

-- …except credentials and migration internals.
REVOKE ALL ON TABLE public."User" FROM chatbot_ro;
REVOKE ALL ON TABLE public._prisma_migrations FROM chatbot_ro;

-- ── Verify (optional) ──────────────────────────────────────────────────────
--   SELECT count(*) FROM public."Role";                 -- should succeed
--   SELECT count(*) FROM public."User";                 -- should FAIL (no access)
--   INSERT INTO public."Role"(id, name) VALUES ('x','x'); -- should FAIL
