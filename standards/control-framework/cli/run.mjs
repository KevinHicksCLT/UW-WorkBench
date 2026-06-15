#!/usr/bin/env node
// run.mjs <pack> — run every control against its fixtures and write the unified registry to
// <pack>/registry.json. Usage: node cli/run.mjs sox
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePack } from '../lib/load-controls.mjs';
import { buildRegistry } from '../lib/build-registry.mjs';
import { validate } from '../lib/schema-validate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// Fixed clock so committed registries stay reproducible (auditability). Override with TZ-free ISO via $NOW.
const NOW = process.env.NOW || '2026-06-30T02:00:00Z';
const CYCLE = process.env.CYCLE || '2026-Q2';

const slug = process.argv[2];
if (!slug) { console.error('usage: node cli/run.mjs <pack>'); process.exit(2); }

const pack = resolvePack(slug);
const registry = buildRegistry(pack, { now: NOW, cycle: CYCLE, client: process.env.CLIENT || 'Meridian Insurance Group' });

// Validate the registry against its schema before writing.
const schema = JSON.parse(readFileSync(resolve(HERE, '../schemas/unified-registry.schema.json'), 'utf8'));
const { valid, errors } = validate(registry, schema);
if (!valid) { console.error('Generated registry failed schema validation:'); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }

const out = join(pack.path, 'registry.json');
writeFileSync(out, JSON.stringify(registry, null, 2) + '\n');

const s = registry.summary;
console.log(`Ran ${s.total_controls} controls for "${pack.slug}":`);
console.log(`  passed=${s.passed} warned=${s.warned} failed=${s.failed}`);
console.log(`  automation coverage=${s.automation_coverage_pct}%  evidence coverage=${s.evidence_coverage_pct}%`);
console.log(`  open issues=${s.open_issues}  technical-debt items=${s.technical_debt_items}`);
console.log(`Wrote ${out}`);
