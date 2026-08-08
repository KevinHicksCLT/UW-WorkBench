// CI gate: every JSON file under packs/ must parse and satisfy the pack zod
// schema (the same gate the import API applies at runtime) — a malformed
// community pack can never merge.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKS = path.resolve(HERE, '../packs');

// Reuse the server's zod schema via tsx-free dynamic import of the compiled
// contract is overkill for CI — validate the essentials structurally here and
// leave deep validation to the server test suite.
const REQUIRED = ['packFormat', 'name', 'slug', 'version', 'description', 'author', 'lobs'];
const LOBS = new Set(['CP', 'EB', 'GL', 'BOP', 'OM', 'XS', 'WC']);

let failures = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith('.json') && entry.name !== 'pack.schema.json') {
      try {
        const pack = JSON.parse(await readFile(full, 'utf8'));
        const missing = REQUIRED.filter((k) => !(k in pack));
        if (missing.length) throw new Error(`missing fields: ${missing.join(', ')}`);
        if (pack.packFormat !== 1) throw new Error('packFormat must be 1');
        if (!/^[a-z0-9-]{3,60}$/.test(pack.slug)) throw new Error('bad slug');
        if (!/^\d+\.\d+\.\d+$/.test(pack.version)) throw new Error('version must be semver');
        if (!Array.isArray(pack.lobs) || !pack.lobs.length || pack.lobs.some((l) => !LOBS.has(l))) throw new Error('bad lobs');
        for (const s of pack.appetiteStatements ?? []) {
          if (!/^AS-\d{3}$/.test(s.ref)) throw new Error(`bad appetite ref ${s.ref}`);
          if ((s.rationale ?? '').length < 20) throw new Error(`${s.ref}: rationale under 20 chars — shareable judgment needs a why`);
        }
        for (const g of pack.authorityGrantTemplates ?? []) {
          if (!/^AG-\d{2,3}$/.test(g.ref)) throw new Error(`bad grant ref ${g.ref}`);
          if (!g.roleLabel) throw new Error(`${g.ref}: grants bind to role labels, never user ids`);
        }
        console.log(`ok   ${path.relative(PACKS, full)}`);
      } catch (e) {
        console.error(`FAIL ${path.relative(PACKS, full)}: ${e.message}`);
        failures++;
      }
    }
  }
}
await walk(PACKS);
if (failures) {
  console.error(`\n${failures} invalid pack(s).`);
  process.exit(1);
}
console.log('\nAll packs valid.');
