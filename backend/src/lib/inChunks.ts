/**
 * Postgres caps a prepared statement at 32,767 bind variables and Prisma sends one
 * bind per element of an `{ in: [...] }` list, so a batched read over a large id
 * list dies with:
 *
 *   Assertion violation on the database: `too many bind variables in prepared
 *   statement, expected maximum of 32767, received 32769`
 *
 * Prisma silently splits a *simple* id-list query, but not one that also carries a
 * relation filter or extra scalar conditions — those go over the wire whole. The
 * graph resolvers routinely batch 40k+ ProcessNode ids (ABC Insurance has ~42k
 * role-linked nodes), so every batched read whose id list is unbounded runs
 * through here: the query is issued once per slice and the rows concatenated.
 *
 * Chunks run sequentially — the connection pool is shared with in-flight requests
 * and a 9-way parallel fan-out on a pooled Neon branch is how you starve it.
 */

/** Well under 32,767 so a chunked query has room for its other bind variables. */
export const ID_CHUNK = 5_000;

export async function inChunks<T>(
  ids: string[],
  run: (chunk: string[]) => Promise<T[]>,
  size = ID_CHUNK,
): Promise<T[]> {
  if (ids.length <= size) return run(ids);
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(...(await run(ids.slice(i, i + size))));
  }
  return out;
}
