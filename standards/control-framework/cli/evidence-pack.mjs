#!/usr/bin/env node
// evidence-pack.mjs <pack> — assemble the auditor/regulator-facing evidence pack (Markdown)
// from the unified registry. This is the artifact you hand an examiner: every control, its
// citation, its run status, the immutable evidence behind it, and any open issue.
// Writes <pack>/evidence-pack.md. Usage: node cli/evidence-pack.mjs sox
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePack, loadControls } from '../lib/load-controls.mjs';
import { buildRegistry } from '../lib/build-registry.mjs';

const NOW = process.env.NOW || '2026-06-30T02:00:00Z';
const CYCLE = process.env.CYCLE || '2026-Q2';

const slug = process.argv[2];
if (!slug) { console.error('usage: node cli/evidence-pack.mjs <pack>'); process.exit(2); }

const pack = resolvePack(slug);
const registry = buildRegistry(pack, { now: NOW, cycle: CYCLE, client: process.env.CLIENT || 'Meridian Insurance Group' });
const byId = Object.fromEntries(loadControls(pack).map(({ control }) => [control.control_id, control]));
const runById = Object.fromEntries(registry.control_runs.map((r) => [r.control_reference.control_id, r]));

const mark = { Passed: '✅', Warning: '⚠️', Failed: '❌', 'Not Run': '⬜', Error: '🛑' };
const s = registry.summary;
const L = [];
L.push(`# Compliance Evidence Pack — ${registry.framework}`);
L.push('');
L.push(`**Client:** ${registry.client}  •  **Cycle:** ${CYCLE}  •  **Generated:** ${NOW}  •  **By:** ${registry.generated_by}`);
L.push('');
L.push('> The single artifact to hand an auditor or regulator first. It answers: *"Show me each control is real, was applied this cycle, and is still working — with the evidence behind it."*');
L.push('');
L.push('## Attestation summary');
L.push('');
L.push(`| Controls | Passed | Warning | Failed | Automation coverage | Evidence coverage | Open issues |`);
L.push(`|---|---|---|---|---|---|---|`);
L.push(`| ${s.total_controls} | ${s.passed} | ${s.warned} | ${s.failed} | ${s.automation_coverage_pct}% | ${s.evidence_coverage_pct}% | ${s.open_issues} |`);
L.push('');

for (const def of registry.control_definitions) {
  const c = byId[def.control_id];
  const r = runById[def.control_id];
  L.push(`## ${mark[r.run_status]} ${def.control_id} — ${def.control_name}`);
  L.push('');
  L.push(`- **Family / framework:** ${def.control_family} — ${c.framework}`);
  L.push(`- **Citation:** ${(c.regulatory_mapping?.citation || []).join('; ') || '(unmapped)'}`);
  L.push(`- **Objective:** ${c.control_objective}`);
  L.push(`- **Owner:** ${c.control_owner?.primary_role}${c.control_owner?.approval_role ? ` (approver: ${c.control_owner.approval_role})` : ''}`);
  L.push(`- **Frequency / type:** ${c.control_frequency} · ${c.test_type} · automation: ${c.validation.automation_level}`);
  L.push(`- **Run status:** ${r.run_status}`);
  L.push('');
  L.push('  **Assertions tested**');
  L.push('');
  L.push('  | Test | Actual | Operator | Threshold | Result |');
  L.push('  |---|---|---|---|---|');
  for (const t of r.threshold_comparison)
    L.push(`  | ${t.test_name} | ${JSON.stringify(t.actual_value)} | ${t.threshold_operator} | ${JSON.stringify(t.threshold_value)} | ${t.status} |`);
  L.push('');
  L.push('  **Evidence**');
  L.push('');
  for (const ev of r.evidence_links)
    L.push(`  - ${ev.present === false ? '⚠️ MISSING — ' : ''}${ev.artifact_type}: \`${ev.uri}\`${ev.immutable ? ' (immutable)' : ''}`);
  L.push(`  - Source systems: ${(c.required_data_sources || []).map((d) => `${d.source_name} [${d.access_method}]`).join(', ')}`);
  L.push(`  - Retention: ${c.required_evidence?.retention_period}`);
  if (r.remediation_workflow) {
    L.push('');
    L.push(`  **Open issue ${r.remediation_workflow.issue_id}** (${r.remediation_workflow.severity}) — ${r.remediation_workflow.root_cause}`);
    L.push(`  - Downstream impact: ${r.remediation_workflow.downstream_impact_assessment}`);
  }
  L.push('');
}

writeFileSync(join(pack.path, 'evidence-pack.md'), L.join('\n'));
console.log(`Wrote ${join(pack.path, 'evidence-pack.md')}`);
