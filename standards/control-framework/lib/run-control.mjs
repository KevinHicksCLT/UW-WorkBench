// run-control.mjs — execute one control against a fixture (or, in production, against
// data pulled through the source connectors) and produce a run record that conforms to
// control-run.schema.json.
//
// The control's validation.assertions are declarative: { metric, operator, value, severity }.
// We read each metric from the fixture's metrics map, evaluate the operator, and roll the
// results up into a run_status. A failing run also opens a remediation issue and blocks any
// downstream artifact — mirroring the Actuarial failed-run example.

/** Evaluate one declarative comparison. Returns boolean = "assertion satisfied". */
export function compare(actual, operator, value) {
  switch (operator) {
    case 'eq': return actual === value;
    case 'ne': return actual !== value;
    case 'gt': return actual > value;
    case 'gte': return actual >= value;
    case 'lt': return actual < value;
    case 'lte': return actual <= value;
    case 'between': return Array.isArray(value) && actual >= value[0] && actual <= value[1];
    case 'in': return Array.isArray(value) && value.includes(actual);
    case 'exists': return actual !== undefined && actual !== null;
    case 'matches': return typeof actual === 'string' && new RegExp(value).test(actual);
    default: throw new Error(`Unknown operator: ${operator}`);
  }
}

const opSymbol = {
  eq: '=', ne: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=',
  between: 'between', in: 'in', exists: 'exists', matches: 'matches',
};

/**
 * Run a control against a fixture.
 * @param {object} control - parsed control definition
 * @param {object|null} fixture - synthetic/real run inputs
 * @param {object} [opts] - { now?: ISO string, executor?: {...}, cycle?: string }
 * @returns {object} run record (control-run.schema.json)
 */
export function runControl(control, fixture, opts = {}) {
  const now = opts.now || new Date().toISOString();
  const cycle = opts.cycle || fixture?.assessment_cycle || 'AD-HOC';
  const metrics = fixture?.metrics || {};
  const cid = control.control_id;

  // 1. Evaluate every assertion.
  const comparisons = control.validation.assertions.map((a, i) => {
    const actual = metrics[a.metric];
    const missing = actual === undefined || actual === null;
    const satisfied = missing ? false : compare(actual, a.operator, a.value);
    const status = satisfied ? 'Pass' : a.severity === 'warn' ? 'Warn' : 'Fail';
    return {
      test_name: a.description || `${a.metric} ${opSymbol[a.operator]} ${JSON.stringify(a.value)}`,
      metric_name: a.metric,
      actual_value: missing ? null : actual,
      threshold_operator: a.operator,
      threshold_value: a.value,
      severity: a.severity,
      status,
      rationale: missing
        ? `Metric "${a.metric}" not available from source data (data gap)`
        : satisfied
          ? 'Within tolerance'
          : `Observed ${JSON.stringify(actual)} violates ${a.operator} ${JSON.stringify(a.value)}`,
      _missing: missing,
    };
  });

  // 2. Roll up the run status.
  const anyFail = comparisons.some((c) => c.status === 'Fail');
  const anyWarn = comparisons.some((c) => c.status === 'Warn');
  const run_status = anyFail ? 'Failed' : anyWarn ? 'Warning' : 'Passed';

  // 3. Dataset snapshots (which sources were reachable).
  const dataset_snapshots = (control.required_data_sources || []).map((s, i) => {
    const available = fixture?.source_availability?.[s.source_name] ?? true;
    return {
      source_name: s.source_name,
      snapshot_id: `snap-${cid}-${cycle}-${i + 1}`,
      access_method: s.access_method,
      location_uri: s.location_uri || '',
      extract_timestamp: now,
      available,
    };
  });

  // 4. Evidence links (which required artifacts were captured).
  const evidence_links = (control.required_evidence?.artifacts || []).map((art, i) => {
    const present = fixture?.evidence_present?.[art] ?? true;
    return {
      artifact_type: art,
      artifact_id: `${cid}-${cycle}-ev${i + 1}`,
      artifact_name: art.replace(/_/g, ' '),
      repository: control.required_evidence?.evidence_repository || 'evidence-store',
      uri: `${control.required_evidence?.evidence_repository || 'evidence-store'}/${cid}/${art}`,
      created_at: now,
      immutable: true,
      present,
    };
  });

  // 5. Downstream artifacts (blocked when the control fails).
  const downstream_artifacts = (fixture?.downstream || []).map((d) => ({
    artifact_type: d.artifact_type,
    artifact_id: d.artifact_id,
    artifact_name: d.artifact_name || d.artifact_id,
    target_system: d.target_system || '',
    link_status: run_status === 'Failed' && (d.expected_link || 'Linked') === 'Linked' ? 'Blocked' : (d.expected_link || 'Linked'),
    staleness_check_result: d.staleness_check_result || 'Current',
  }));

  // 6. Audit trail.
  const event_log = [
    { event_time: now, event_type: 'RUN_STARTED', actor: opts.executor?.name_or_service_id || 'control-runner', description: `Run started for ${cid}` },
    {
      event_time: now,
      event_type: run_status === 'Passed' ? 'RUN_PASSED' : run_status === 'Warning' ? 'RUN_WARNING' : 'RUN_FAILED',
      actor: opts.executor?.name_or_service_id || 'control-runner',
      description: `Run ${run_status.toLowerCase()} (${comparisons.filter((c) => c.status !== 'Pass').length} of ${comparisons.length} assertions not passing)`,
    },
  ];

  const issueId = `ISS-${cid}-${cycle}`;
  let remediation_workflow;
  if (run_status !== 'Passed') {
    const failed = comparisons.filter((c) => c.status !== 'Pass');
    remediation_workflow = {
      remediation_required: true,
      issue_id: issueId,
      issue_status: 'Open',
      severity: run_status === 'Failed' ? 'High' : 'Medium',
      owner: control.control_owner?.primary_role || 'Control Owner',
      opened_at: now,
      target_due_date: '',
      root_cause: failed.map((f) => f.rationale).join('; '),
      corrective_actions: control.pass_fail_logic?.exception_handling || control.workflow?.actions_on_fail || ['Investigate and remediate.'],
      downstream_impact_assessment:
        downstream_artifacts.some((d) => d.link_status === 'Blocked')
          ? `Blocks: ${downstream_artifacts.filter((d) => d.link_status === 'Blocked').map((d) => d.artifact_id).join(', ')}`
          : 'No downstream artifacts blocked.',
      retest_required: true,
      retest_run_id: '',
    };
    event_log.push({ event_time: now, event_type: 'ISSUE_OPENED', actor: 'control-runner', description: `Issue opened for ${cid}`, linked_artifact_id: issueId });
  }

  const run = {
    run_id: `run-${cid}-${cycle}`,
    control_reference: {
      control_id: cid,
      control_name: control.control_name,
      control_version: control.version || '1.0.0',
      framework: control.framework,
      control_family: control.control_family,
      execution_mode: control.execution_mode,
    },
    run_status,
    execution: {
      started_at: now,
      completed_at: now,
      duration_seconds: 0,
      executor_identity: opts.executor || { executor_type: 'AI Agent', name_or_service_id: 'transform-control-runner', orchestrator: 'Cascade Control Framework', model_or_tool_version: 'run-control-v1' },
      environment: { environment_name: 'Demo', tenant_or_workspace: fixture?.client || 'demo-client' },
    },
    input_context: {
      assessment_cycle: cycle,
      as_of_date: fixture?.as_of_date || '',
      scope_note: control.control_objective,
      dataset_snapshots,
    },
    calculated_metrics: Object.entries(metrics).map(([k, v]) => ({ metric_name: k, metric_value: v })),
    threshold_comparison: comparisons.map(({ _missing, ...rest }) => rest),
    evidence_links,
    approval: {
      approval_required: !!control.audit?.independent_review_required,
      approver: {
        approver_role: control.control_owner?.approval_role || control.control_owner?.primary_role || 'Approver',
        approval_status: run_status === 'Passed' ? 'Approved' : 'Pending',
      },
      override: { override_applied: false },
    },
    downstream_artifacts,
    audit_trail: {
      event_log,
      immutable_log_reference: `ledger://controls/${control.framework}/${cid}/${cycle}`,
    },
    notes: run_status === 'Passed' ? 'Control passed; evidence captured.' : 'Remediate before relying on dependent artifacts.',
  };
  if (remediation_workflow) run.remediation_workflow = remediation_workflow;
  return run;
}
