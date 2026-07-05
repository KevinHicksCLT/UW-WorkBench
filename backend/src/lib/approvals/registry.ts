// Apply registry — intercept-and-replay's second half. Each governed decision
// key registers ONE apply function (the same code path the direct, ungoverned
// mutation uses), invoked by the engine when a request reaches final approval.
// Registration happens once at boot via lib/approvals/applyHandlers.ts.

export type ApplyContext = {
  tenantId: string;
  entityId: string | null;
  /** The zod-validated body captured at hold time. */
  payload: unknown;
  requestedByEmail: string;
  approvedByEmail: string;
};

export type ApplyHandler = (ctx: ApplyContext) => Promise<void>;

const handlers = new Map<string, ApplyHandler>();

export function registerApplyHandler(decisionKey: string, handler: ApplyHandler): void {
  handlers.set(decisionKey, handler);
}

export function getApplyHandler(decisionKey: string): ApplyHandler | undefined {
  return handlers.get(decisionKey);
}
