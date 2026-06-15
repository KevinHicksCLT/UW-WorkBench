// linear-remediation.mjs — LIVE source collector for remediation/issue-governance controls
// (e.g. SOX-ELC-404-02 "control-deficiency remediation items are tracked with owner, priority,
// and due date"). Binds to Linear via the Linear MCP.
//
// Separation of concerns: the AGENT performs the MCP acquisition (list_issues) and captures the
// raw result as immutable evidence. The deterministic transform below — deriveMetrics() — is a
// PURE function so it is unit-testable with no MCP/network. cli/collect-linear.mjs glues them:
// read the captured raw issues → derive metrics → write the live fixture.

const OPEN = (i) => !['completed', 'canceled'].includes(i.statusType);

/** Normalize a Linear MCP issue into the compact evidence record we retain. */
export function normalize(issue) {
  return {
    id: issue.id,
    title: issue.title,
    url: issue.url,
    status: issue.status,
    statusType: issue.statusType,
    priority: issue.priority?.value ?? 0,
    dueDate: issue.dueDate ?? null,
    assignee: issue.assignee ?? issue.assigneeId ?? null,
    createdAt: issue.createdAt,
  };
}

/** Derive remediation-governance metrics from a list of (raw or normalized) Linear issues. */
export function deriveMetrics(issues, { now = new Date().toISOString() } = {}) {
  const norm = issues.map((i) => (i.priority && typeof i.priority === 'object' ? normalize(i) : i));
  const open = norm.filter(OPEN);
  const today = now.slice(0, 10);
  const metrics = {
    remediation_items_total: open.length,
    items_without_owner: open.filter((i) => !i.assignee).length,
    items_without_priority: open.filter((i) => !i.priority).length,
    items_without_due_date: open.filter((i) => !i.dueDate).length,
    overdue_items: open.filter((i) => i.dueDate && i.dueDate < today).length,
  };
  const evidence = open.map((i) => ({ id: i.id, title: i.title, url: i.url, owner: i.assignee || '(unassigned)', dueDate: i.dueDate || '(none)', priority: i.priority }));
  return { metrics, evidence, open_records: open };
}
