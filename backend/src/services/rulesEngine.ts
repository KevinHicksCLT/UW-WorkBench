import type { BusinessRule, User } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { sendNotification } from './notifications.js';
import { logAudit } from './audit.js';

type RuleEvent = {
  tenantId: string;
  entityType: string;
  trigger: string;
  fieldName?: string;
  fieldValue?: string;
  entity: any;
  actor: User;
};

/**
 * Look up rules matching the trigger and fire each in sequence.
 * Action types supported in MVP:
 *   - SET_VALUE   : { field, value }                update entity.field = value
 *   - NOTIFY      : { recipientField, subject, body, link }
 *                   (recipientField = "ownerId" | "sponsorId" | static userId)
 *   - RUN_RULE    : { ruleId }                      chain to another rule
 */
export async function runRulesForEntity({
  tenantId,
  entityType,
  trigger,
  fieldName,
  fieldValue,
  entity,
  actor,
}: RuleEvent) {
  const rules = await prisma.businessRule.findMany({
    where: {
      tenantId,
      entityType,
      trigger,
      enabled: true,
      ...(fieldName ? { fieldName } : {}),
    },
  });

  for (const rule of rules) {
    // For ON_FIELD_CHANGE rules, match the value if specified
    if (rule.trigger === 'ON_FIELD_CHANGE' && rule.fieldValue && rule.fieldValue !== String(fieldValue)) {
      continue;
    }

    let cfg: any;
    try {
      cfg = JSON.parse(rule.actionConfig || '{}');
    } catch {
      console.warn(`Rule ${rule.id} has invalid actionConfig`);
      continue;
    }

    try {
      await executeAction({ rule, cfg, entity, actor, tenantId });
      await logAudit({
        tenantId,
        actorEmail: 'system',
        entityType: 'BusinessRule',
        entityId: rule.id,
        action: 'EXECUTED',
        diff: { entityType, entityId: entity.id, action: rule.action },
      });
    } catch (err) {
      console.error(`Rule ${rule.id} failed:`, (err as Error).message);
    }
  }
}

async function executeAction({
  rule,
  cfg,
  entity,
  actor,
  tenantId,
}: {
  rule: BusinessRule;
  cfg: any;
  entity: any;
  actor: User;
  tenantId: string;
}) {
  switch (rule.action) {
    case 'SET_VALUE': {
      if (!cfg.field) throw new Error('SET_VALUE requires field');
      const model = modelForEntityType(rule.entityType);
      await model.update({
        where: { id: entity.id },
        data: { [cfg.field]: cfg.value },
      });
      break;
    }
    case 'NOTIFY': {
      const userId = resolveRecipient(cfg, entity);
      if (!userId) return;
      const subject = interpolate(cfg.subject || 'Update', entity);
      const body = interpolate(cfg.body || '', entity);
      await sendNotification({ tenantId, userId, subject, body, link: cfg.link });
      break;
    }
    case 'RUN_RULE': {
      if (!cfg.ruleId) return;
      const next = await prisma.businessRule.findUnique({ where: { id: cfg.ruleId } });
      if (next) {
        await executeAction({ rule: next, cfg: JSON.parse(next.actionConfig || '{}'), entity, actor, tenantId });
      }
      break;
    }
    default:
      console.warn(`Unknown rule action: ${rule.action}`);
  }
}

function resolveRecipient(cfg: any, entity: any): string | null {
  if (cfg.userId) return cfg.userId;
  if (cfg.recipientField && entity[cfg.recipientField]) return entity[cfg.recipientField];
  return null;
}

// "{!name}" → entity.name
function interpolate(template: string, entity: any): string {
  return String(template).replace(/\{!([\w]+)\}/g, (_, key) => entity[key] ?? '');
}

// Dynamic dispatch across Prisma model delegates — typed as `any` because the
// caller chooses the model at runtime from a rule's entityType.
function modelForEntityType(entityType: string): any {
  switch (entityType) {
    case 'Initiative': return prisma.initiative;
    case 'RaidItem':   return prisma.raidItem;
    case 'Program':    return prisma.program;
    case 'Workstream': return prisma.workstream;
    default: throw new Error(`Unsupported entity type: ${entityType}`);
  }
}
