// build-registry.mjs — run every control in a pack against its fixtures, assemble the
// unified registry (definitions + runs + issues + evidence index + technical-debt + summary).
// This is the object the demo emits and that an auditor or regulator could be handed.

import { loadControls, loadFixture } from './load-controls.mjs';
import { runControl } from './run-control.mjs';

const DEBT_SEVERITY = { Critical: 4, High: 3, Medium: 2, Low: 1 };

/** Derive the technical-debt backlog from a control + its run. */
function deriveTechDebt(control, run, fixture) {
  const cid = control.control_id;
  const debt = [];
  const push = (category, severity, description, recommended_action, extra = {}) =>
    debt.push({ debt_id: `TD-${cid}-${debt.length + 1}`, control_id: cid, category, severity, description, recommended_action, ...extra });

  // Missing / manual sources.
  for (const s of control.required_data_sources || []) {
    const available = fixture?.source_availability?.[s.source_name] ?? true;
    if (!available)
      push('Missing Source', 'High', `Source "${s.source_name}" (${s.system_type}) is not reachable via ${s.access_method}.`,
        `Stand up the ${s.access_method} connector for ${s.source_name} so this control can be evidenced automatically.`,
        { source_system: s.source_name, access_method: s.access_method });
    if (s.access_method === 'Manual Upload')
      push('Manual Control', 'Medium', `Source "${s.source_name}" is fed by manual upload.`,
        `Replace manual upload of ${s.source_name} with an API/MCP/SQL feed.`, { source_system: s.source_name, access_method: s.access_method });
  }

  // Manual / partial automation.
  if (control.validation.automation_level === 'Manual')
    push('Manual Control', 'Medium', `Control is fully manual (automation_level=Manual).`,
      'Define machine-checkable assertions and a connector so this control can run unattended.');
  else if (control.validation.automation_level === 'Partial')
    push('Manual Control', 'Low', `Control is partially automated (automation_level=Partial).`,
      'Close the manual gap so the full assertion set runs automatically.');

  // Failed / warning runs.
  if (run.run_status === 'Failed')
    push('Failed Control', 'Critical', `Control failed: ${run.threshold_comparison.filter((t) => t.status === 'Fail').map((t) => t.test_name).join('; ')}.`,
      'Open remediation issue, fix root cause, capture evidence, and retest.');
  else if (run.run_status === 'Warning')
    push('Failed Control', 'Medium', `Control raised a warning.`, 'Investigate the warning threshold breach before it escalates.');

  // Missing evidence.
  for (const ev of run.evidence_links)
    if (ev.present === false)
      push('Missing Evidence', 'High', `Required evidence "${ev.artifact_type}" was not captured.`,
        `Wire ${ev.repository} so "${ev.artifact_type}" is stored immutably with the run.`);

  // Stale / blocked downstream.
  for (const d of run.downstream_artifacts || [])
    if (d.link_status === 'Stale' || d.link_status === 'Blocked')
      push('Stale Downstream', d.link_status === 'Blocked' ? 'High' : 'Medium',
        `Downstream artifact "${d.artifact_id}" is ${d.link_status}.`, 'Revalidate the control and refresh the downstream linkage.');

  // No test script wired.
  if (!control.validation.test_script)
    push('No Test', 'Medium', 'Control has no test_script reference.', 'Author a node:test harness and link it via validation.test_script.');

  // Unmapped citation.
  if (!control.regulatory_mapping?.citation?.length)
    push('Unmapped Citation', 'Low', 'Control is not mapped to a regulatory citation.', 'Add the framework section/clause to regulatory_mapping.citation.');

  return debt;
}

/** Build the full unified registry for a pack. */
export function buildRegistry(pack, opts = {}) {
  const now = opts.now || new Date().toISOString();
  const controls = loadControls(pack).map((c) => c.control);
  const runs = [];
  const issues = [];
  const evidence_index = [];
  const technical_debt = [];

  for (const control of controls) {
    const fixture = loadFixture(pack, control.control_id);
    const run = runControl(control, fixture, { now, cycle: opts.cycle || fixture?.assessment_cycle });
    runs.push(run);

    if (run.remediation_workflow)
      issues.push({
        issue_id: run.remediation_workflow.issue_id,
        control_id: control.control_id,
        run_id: run.run_id,
        status: run.remediation_workflow.issue_status,
        severity: run.remediation_workflow.severity,
        owner: run.remediation_workflow.owner,
        summary: run.remediation_workflow.root_cause,
        blocks_downstream_artifact_ids: (run.downstream_artifacts || []).filter((d) => d.link_status === 'Blocked').map((d) => d.artifact_id),
      });

    for (const ev of run.evidence_links)
      evidence_index.push({ artifact_id: ev.artifact_id, control_id: control.control_id, run_id: run.run_id, artifact_type: ev.artifact_type, repository: ev.repository, uri: ev.uri, present: ev.present });

    technical_debt.push(...deriveTechDebt(control, run, fixture));
  }

  technical_debt.sort((a, b) => DEBT_SEVERITY[b.severity] - DEBT_SEVERITY[a.severity]);

  const passed = runs.filter((r) => r.run_status === 'Passed').length;
  const warned = runs.filter((r) => r.run_status === 'Warning').length;
  const failed = runs.filter((r) => r.run_status === 'Failed').length;
  const not_run = runs.filter((r) => r.run_status === 'Not Run').length;
  const autoFull = controls.filter((c) => c.validation.automation_level === 'Full').length;
  const evTotal = evidence_index.length;
  const evPresent = evidence_index.filter((e) => e.present !== false).length;

  return {
    registry_id: `reg-${pack.slug}-${opts.cycle || 'latest'}`,
    framework: pack.framework || pack.name,
    client: opts.client || 'demo-client',
    generated_at: now,
    generated_by: 'Cascade Control Framework',
    control_definitions: controls.map((c) => ({
      control_id: c.control_id, control_name: c.control_name, control_family: c.control_family,
      version: c.version || '1.0.0', status: c.status || 'Active', automation_level: c.validation.automation_level,
    })),
    control_runs: runs,
    issues,
    evidence_index,
    technical_debt,
    summary: {
      total_controls: controls.length,
      passed, warned, failed, not_run,
      automation_coverage_pct: controls.length ? Math.round((autoFull / controls.length) * 100) : 0,
      evidence_coverage_pct: evTotal ? Math.round((evPresent / evTotal) * 100) : 100,
      open_issues: issues.length,
      technical_debt_items: technical_debt.length,
    },
  };
}
