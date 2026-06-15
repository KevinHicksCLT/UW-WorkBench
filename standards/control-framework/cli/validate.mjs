#!/usr/bin/env node
// validate.mjs <pack> — validate every control definition in a pack against control.schema.json.
// Exit 1 if any control is invalid. Usage: node cli/validate.mjs sox
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePack, loadControls } from '../lib/load-controls.mjs';
import { validate } from '../lib/schema-validate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(resolve(HERE, '../schemas/control.schema.json'), 'utf8'));

const slug = process.argv[2];
if (!slug) { console.error('usage: node cli/validate.mjs <pack>'); process.exit(2); }

const pack = resolvePack(slug);
const controls = loadControls(pack);
let bad = 0;

console.log(`Validating ${controls.length} controls in pack "${pack.slug}" against control.schema.json\n`);
for (const { file, control } of controls) {
  const { valid, errors } = validate(control, schema);
  if (valid) {
    console.log(`  PASS  ${control.control_id}  ${control.control_name}`);
  } else {
    bad++;
    console.log(`  FAIL  ${control.control_id}  (${file})`);
    for (const e of errors) console.log(`          - ${e}`);
  }
}
console.log(`\n${controls.length - bad}/${controls.length} valid.`);
process.exit(bad ? 1 : 0);
