// Bundled pack loading — reads the repo's packs/ directory (the crowdsourced
// library; community packs arrive by PR) and validates every file against the
// pack schema, so a malformed pack can never reach applyPack.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packSchema, type Pack } from './packs.js';
import { logger } from './logger.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = process.env.PACKS_DIR ?? path.resolve(HERE, '../../../packs');

let cache: Pack[] | null = null;

export async function loadBundledPacks(): Promise<Pack[]> {
  if (cache) return cache;
  const packs: Pack[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.json') && entry.name !== 'pack.schema.json') {
        try {
          packs.push(packSchema.parse(JSON.parse(await readFile(full, 'utf8'))));
        } catch (e) {
          logger.warn({ file: full, err: (e as Error).message }, 'skipping invalid pack');
        }
      }
    }
  };
  await walk(PACKS_DIR);
  cache = packs;
  return packs;
}
