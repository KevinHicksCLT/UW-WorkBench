#!/usr/bin/env node
// report.mjs <pack> — the full "rabbit hole" in one command: validate every control, run them
// against fixtures, then emit the registry, the technical-debt backlog, and the auditor evidence
// pack. Usage: node cli/report.mjs sox
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const slug = process.argv[2];
if (!slug) { console.error('usage: node cli/report.mjs <pack>'); process.exit(2); }

const steps = [
  ['validate', 'Validate control definitions against the schema'],
  ['run', 'Run controls against fixtures → registry.json'],
  ['tech-debt', 'Derive technical-debt backlog'],
  ['evidence-pack', 'Assemble auditor evidence pack'],
];

let failed = 0;
for (const [cmd, label] of steps) {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(process.execPath, [resolve(HERE, `${cmd}.mjs`), slug], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) { failed = r.status; if (cmd === 'validate') break; }
}
process.exit(failed);
