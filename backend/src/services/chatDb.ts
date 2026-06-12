import pg from 'pg';

// ─── Read-only database access for the AI assistant ────────────────────────
// A DEDICATED Postgres connection, separate from Prisma, that uses the
// `chatbot_ro` role (DATABASE_URL_RO) against the SAME database that feeds the
// app (the `public` Prisma schema on the production branch). The role has
// SELECT-only grants, with the "User" table (password hashes) and
// _prisma_migrations explicitly revoked — so the assistant can never read
// credentials and can never write anything. Setup: scripts/chatbot-ro-setup.sql.
//
// Defense-in-depth, in order of strength:
//   1. The `chatbot_ro` role simply lacks INSERT/UPDATE/DELETE/DDL grants.
//   2. Every query runs inside a `READ ONLY` transaction (writes error out).
//   3. A per-statement `statement_timeout` kills runaway queries.
//   4. The tool entrypoint additionally rejects anything but a single SELECT.

const { Pool } = pg;

const SCHEMA = process.env.CHATBOT_SCHEMA ?? 'public';
if (!/^[a-z_][a-z0-9_]*$/.test(SCHEMA)) {
  throw new Error(`Invalid CHATBOT_SCHEMA: ${SCHEMA}`);
}
const STATEMENT_TIMEOUT_MS = 8000;
const MAX_ROWS = 500; // rows returned to the model per query

export type SqlResult = { columns: string[]; rows: unknown[][]; rowCount: number; truncated: boolean };

let pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!process.env.DATABASE_URL_RO) {
    throw Object.assign(new Error('Assistant is not configured (DATABASE_URL_RO missing)'), { status: 503 });
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL_RO,
      ssl: { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

// Run trusted/internal SQL (schema introspection) — no SELECT validation, higher
// row cap. Still confined to the read-only role + READ ONLY transaction.
async function exec(sql: string, maxRows: number): Promise<SqlResult> {
  const client = await getPool().connect();
  try {
    await client.query('START TRANSACTION READ ONLY');
    await client.query(`SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT_MS}'`);
    await client.query(`SET LOCAL search_path = ${SCHEMA}`);
    const res = await client.query({ text: sql, rowMode: 'array' });
    const columns = res.fields.map((f) => f.name);
    const truncated = res.rows.length > maxRows;
    const rows = (truncated ? res.rows.slice(0, maxRows) : res.rows) as unknown[][];
    return { columns, rows, rowCount: res.rows.length, truncated };
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

// Reject anything that isn't a single read-only statement. The READ ONLY
// transaction and the role's missing grants are the real enforcement; this just
// fails fast with a clear message and blocks multi-statement injection.
const FORBIDDEN = /\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|merge|copy)\b/i;

export function assertSelectOnly(sql: string): string {
  const stmt = sql.trim().replace(/;+\s*$/, '');
  if (!stmt) throw new Error('Empty query.');
  if (stmt.includes(';')) throw new Error('Only a single statement is allowed (no semicolons).');
  if (!/^(select|with)\b/i.test(stmt)) throw new Error('Only SELECT / WITH queries are allowed.');
  if (FORBIDDEN.test(stmt)) throw new Error('Only read-only SELECT queries are allowed.');
  return stmt;
}

// The assistant's tool entrypoint: validate, then run with the standard row cap.
export function runReadOnlySql(sql: string): Promise<SqlResult> {
  return exec(assertSelectOnly(sql), MAX_ROWS);
}

// Internal: used by schema introspection only (our own SQL, larger cap).
export function introspect(sql: string): Promise<SqlResult> {
  return exec(sql, 5000);
}

export { SCHEMA };
