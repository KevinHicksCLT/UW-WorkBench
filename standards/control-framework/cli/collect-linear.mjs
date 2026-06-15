#!/usr/bin/env node
// collect-linear.mjs <pack> <controlId> [rawFile] — bind a remediation-governance control to the
// LIVE Linear source. The agent first captures `list_issues` output from the Linear MCP into
// live/<controlId>.linear-raw.json (immutable evidence); this CLI derives the metrics + live
// fixture from it. Usage:
//   node cli/collect-linear.mjs sox SOX-ELC-404-02
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePack } from '../lib/load-controls.mjs';
import { deriveMetrics } from '../lib/collectors/linear-remediation.mjs';

const slug = process.argv[2];
const controlId = process.argv[3];
if (!slug || !controlId) { console.error('usage: node cli/collect-linear.mjs <pack> <controlId> [rawFile]'); process.exit(2); }

const pack = resolvePack(slug);
const liveDir = join(pack.path, 'live');
mkdirSync(liveDir, { recursive: true });
const rawPath = process.argv[4] || join(liveDir, `${controlId}.linear-raw.json`);
const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
const now = new Date().toISOString();

const { metrics, evidence, open_records } = deriveMetrics(raw.issues, { now });

// 1. Immutable evidence snapshot.
const snapshot = {
  control_id: controlId,
  collected_at: now,
  provenance: {
    source: 'Linear (MCP)',
    workspace: raw.workspace || null,
    team: raw.team || null,
    query: raw.query || 'list_issues',
    captured_at: raw.captured_at || now,
    method: 'Linear MCP list_issues → deriveMetrics (open items: owner / priority / due-date / overdue)',
  },
  metrics,
  evidence,
};
writeFileSync(join(liveDir, `${controlId}.snapshot.json`), JSON.stringify(snapshot, null, 2) + '\n');

// 2. Live fixture for the runner.
const fixture = {
  control_id: controlId,
  assessment_cycle: process.env.CYCLE || 'LIVE',
  as_of_date: now.slice(0, 10),
  client: raw.workspace || 'Linear workspace',
  live: true,
  provenance: { source: 'Linear (MCP)', head_sha: raw.captured_at || now, ...snapshot.provenance },
  source_availability: { 'Remediation Tracker (Linear)': true },
  metrics,
  evidence_present: { remediation_register_export: true, owner_assignment_log: metrics.items_without_owner === 0, due_date_report: metrics.items_without_due_date === 0 },
  downstream: [{ artifact_type: '404 Assessment', artifact_id: `assess-live-${controlId}`, target_system: 'GRC', expected_link: 'Linked' }],
};
writeFileSync(join(pack.path, 'fixtures', `${controlId}.live.fixture.json`), JSON.stringify(fixture, null, 2) + '\n');

console.log(`Bound ${controlId} to LIVE Linear source (${raw.team || raw.workspace || 'workspace'})`);
console.log(`  ${metrics.remediation_items_total} open items · ${metrics.items_without_owner} without owner · ${metrics.items_without_due_date} without due date · ${metrics.overdue_items} overdue`);
console.log(`Wrote ${join(liveDir, controlId + '.snapshot.json')} and the live fixture`);
