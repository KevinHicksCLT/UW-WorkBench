// Structured audit logging. The UW governance spine (UwGovernanceEvent) is the
// durable audit substrate; this logger adds an operator-facing pino line so
// every write is greppable in the process logs too.
import { logger } from '../lib/logger.js';

type AuditInput = {
  tenantId: string;
  actorEmail: string;
  entityType: string;
  entityId: string;
  action: string;
  diff?: Record<string, unknown>;
};

export function logAudit(input: AuditInput): void {
  logger.info({ audit: input }, `audit:${input.action}`);
}
