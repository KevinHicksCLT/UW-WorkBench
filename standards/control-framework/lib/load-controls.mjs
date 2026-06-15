// load-controls.mjs — pack resolution + loaders for control definitions and fixtures.
//
// A "pack" is a standard/regulation folder under standards/skills/<dir>/ that contains
// a pack.json manifest, a controls/ dir of *.control.json files, and a fixtures/ dir of
// *.fixture.json files. Packs are discovered by scanning for pack.json so new standards
// drop in with no code change.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const STANDARDS_ROOT = resolve(HERE, '../..'); // standards/
export const SKILLS_ROOT = join(STANDARDS_ROOT, 'skills');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** All packs that expose a pack.json manifest. */
export function discoverPacks() {
  if (!existsSync(SKILLS_ROOT)) return [];
  const packs = [];
  for (const dir of readdirSync(SKILLS_ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const manifestPath = join(SKILLS_ROOT, dir.name, 'pack.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = readJson(manifestPath);
    packs.push({ ...manifest, dir: dir.name, path: join(SKILLS_ROOT, dir.name) });
  }
  return packs;
}

/** Resolve a pack by slug, manifest name, or directory name. */
export function resolvePack(idOrSlug) {
  const packs = discoverPacks();
  const hit = packs.find(
    (p) => p.slug === idOrSlug || p.dir === idOrSlug || p.name === idOrSlug
  );
  if (!hit) {
    const known = packs.map((p) => p.slug).join(', ') || '(none)';
    throw new Error(`Unknown pack "${idOrSlug}". Known packs: ${known}`);
  }
  return hit;
}

/** Load every control definition in a pack, sorted by control_id. */
export function loadControls(pack) {
  const dir = join(pack.path, 'controls');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.control.json'))
    .map((f) => ({ file: join(dir, f), control: readJson(join(dir, f)) }))
    .sort((a, b) => a.control.control_id.localeCompare(b.control.control_id));
}

/** Load the fixture (synthetic client data) for one control, or null if absent. */
export function loadFixture(pack, controlId) {
  const p = join(pack.path, 'fixtures', `${controlId}.fixture.json`);
  return existsSync(p) ? readJson(p) : null;
}

export { readJson };
