#!/usr/bin/env node
// tech-debt.mjs <pack> — emit the technical-debt backlog the framework surfaced, as JSON + Markdown.
// Writes <pack>/tech-debt-backlog.json and .md. Usage: node cli/tech-debt.mjs sox
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePack } from '../lib/load-controls.mjs';
import { buildRegistry } from '../lib/build-registry.mjs';

const NOW = process.env.NOW || '2026-06-30T02:00:00Z';
const CYCLE = process.env.CYCLE || '2026-Q2';

const slug = process.argv[2];
if (!slug) { console.error('usage: node cli/tech-debt.mjs <pack>'); process.exit(2); }

const pack = resolvePack(slug);
const registry = buildRegistry(pack, { now: NOW, cycle: CYCLE });
const debt = registry.technical_debt;

writeFileSync(join(pack.path, 'tech-debt-backlog.json'), JSON.stringify(debt, null, 2) + '\n');

const byCat = {};
for (const d of debt) (byCat[d.category] ||= []).push(d);

const lines = [];
lines.push(`# Technical-Debt Backlog — ${registry.framework}`);
lines.push('');
lines.push(`Generated ${NOW} by the Cascade Control Framework from ${registry.summary.total_controls} controls.`);
lines.push(`**${debt.length} debt items** — Critical: ${debt.filter((d) => d.severity === 'Critical').length}, High: ${debt.filter((d) => d.severity === 'High').length}, Medium: ${debt.filter((d) => d.severity === 'Medium').length}, Low: ${debt.filter((d) => d.severity === 'Low').length}.`);
lines.push('');
lines.push('Each item is a concrete, ownable unit of work that, once closed, raises automation or evidence coverage and moves a control from "asserted" to "continuously evidenced".');
lines.push('');
for (const cat of Object.keys(byCat)) {
  lines.push(`## ${cat} (${byCat[cat].length})`);
  lines.push('');
  lines.push('| ID | Control | Severity | Description | Recommended action |');
  lines.push('|---|---|---|---|---|');
  for (const d of byCat[cat])
    lines.push(`| ${d.debt_id} | ${d.control_id} | ${d.severity} | ${d.description} | ${d.recommended_action} |`);
  lines.push('');
}
writeFileSync(join(pack.path, 'tech-debt-backlog.md'), lines.join('\n'));

console.log(`Technical debt for "${pack.slug}": ${debt.length} items`);
console.log(`Wrote ${join(pack.path, 'tech-debt-backlog.md')} and .json`);
