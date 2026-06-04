import { introspect, SCHEMA } from './chatDb.js';

// Builds a compact, text description of the operating_model schema (tables,
// columns, types, foreign keys, row counts) for the assistant's system prompt.
// Introspected LIVE from the database and cached briefly, so it stays correct as
// the operating-model rework reshapes the schema — nothing is hard-coded here.

let cache: { text: string; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getSchemaSummary(): Promise<string> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.text;

  const [cols, fks, counts] = await Promise.all([
    introspect(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = '${SCHEMA}'
      ORDER BY table_name, ordinal_position
    `),
    introspect(`
      SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = '${SCHEMA}'
    `),
    introspect(`
      SELECT c.relname AS table_name, c.reltuples::bigint AS est_rows
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = '${SCHEMA}' AND c.relkind = 'r'
    `),
  ]);

  // Group columns and FKs by table.
  const tables = new Map<string, string[]>();
  for (const [table, column, type] of cols.rows as [string, string, string][]) {
    if (!tables.has(table)) tables.set(table, []);
    tables.get(table)!.push(`${column} ${type}`);
  }
  const fkByTable = new Map<string, string[]>();
  for (const [table, column, refTable, refCol] of fks.rows as [string, string, string, string][]) {
    if (!fkByTable.has(table)) fkByTable.set(table, []);
    fkByTable.get(table)!.push(`${column} -> ${refTable}.${refCol}`);
  }
  const rowCount = new Map<string, number>();
  for (const [table, est] of counts.rows as [string, number][]) rowCount.set(table, Number(est));

  const lines: string[] = [];
  for (const [table, columns] of [...tables.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const n = rowCount.get(table);
    const approx = n != null && n >= 0 ? ` (~${n} rows)` : '';
    lines.push(`${table}${approx}: ${columns.join(', ')}`);
    const tfks = fkByTable.get(table);
    if (tfks?.length) lines.push(`    FK: ${tfks.join('; ')}`);
  }

  const text = lines.join('\n');
  cache = { text, at: Date.now() };
  return text;
}
