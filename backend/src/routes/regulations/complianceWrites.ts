/**
 * Compliance register writes (SCRUM-46 v2) — the sign-off workflow that turns
 * determination-READY items into legal determinations, plus item edits and
 * jurisdiction-variant promotion. Every action appends a ComplianceSignOffEvent
 * (the append-only trail that makes a determination defensible in an audit).
 * Rules:
 *   - REJECT requires a note.
 *   - CONFIRM of a regulation-level (LOW) item requires selecting the specific
 *     supporting L3 rows, which upgrades groundingBasis → ITEM.
 *   - Editing a CONFIRMED item resets it to PENDING.
 * Write authz comes from the router-level requirePermission('regulations').
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit, computeDiff } from '../../services/audit.js';
import { activeCompanyId } from './helpers.js';

const signOffSchema = z.object({
  action: z.enum(['CONFIRM', 'REJECT', 'NEEDS_RESEARCH']),
  note: z.string().optional(),
  supportingRequirementIds: z.array(z.string()).optional(),
});

const ACTION_TO_STATUS: Record<string, string> = {
  CONFIRM: 'CONFIRMED',
  REJECT: 'REJECTED',
  NEEDS_RESEARCH: 'NEEDS_RESEARCH',
};

const editSchema = z.object({
  name: z.string().min(1).optional(),
  ownerTeam: z.string().min(1).optional(),
  frequency: z.string().min(1).optional(),
  evidence: z.string().min(1).optional(),
  jurisdictionScope: z.string().min(1).optional(),
  auditStatus: z.string().min(1).optional(),
  reviewNotes: z.string().nullable().optional(),
});
const EDITABLE = [
  'name',
  'ownerTeam',
  'frequency',
  'evidence',
  'jurisdictionScope',
  'auditStatus',
  'reviewNotes',
];

/** Registers the compliance-register mutation routes on the shared regulations router. */
export function registerComplianceWriteRoutes(router: Router): void {
  router.post(
    '/compliance-register/items/:id/sign-off',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const body = signOffSchema.parse(req.body);
        const item = await prisma.complianceItem.findFirst({
          where: { id: req.params.id, companyId },
          select: {
            id: true,
            itemCode: true,
            regulationId: true,
            groundingBasis: true,
            signOff: true,
          },
        });
        if (!item) return res.status(404).json({ error: 'Compliance item not found' });
        if (body.action === 'REJECT' && !body.note?.trim())
          return res.status(400).json({ error: 'Rejection requires a note' });

        const selected = body.supportingRequirementIds ?? [];
        if (
          body.action === 'CONFIRM' &&
          item.groundingBasis === 'REGULATION' &&
          selected.length === 0
        )
          return res.status(400).json({
            error:
              'Confirming a regulation-level item requires selecting its specific supporting requirement rows',
          });
        if (selected.length > 0) {
          // Selected rows must be real L3 rows of THIS item's parent regulation.
          const valid = await prisma.regulatoryRequirement.count({
            where: { id: { in: selected }, companyId, complianceRegulationId: item.regulationId },
          });
          if (valid !== selected.length)
            return res
              .status(400)
              .json({ error: 'One or more selected rows do not belong to this regulation' });
        }

        const reviewer = req.user.email;
        const upgradeGrounding = body.action === 'CONFIRM' && selected.length > 0;
        const [updated] = await prisma.$transaction([
          prisma.complianceItem.update({
            where: { id: item.id },
            data: {
              signOff: ACTION_TO_STATUS[body.action],
              reviewer,
              ...(body.note?.trim() ? { reviewNotes: body.note.trim() } : {}),
              ...(upgradeGrounding ? { groundingBasis: 'ITEM' } : {}),
            },
          }),
          ...(selected.length > 0
            ? [
                prisma.complianceItemRequirement.createMany({
                  data: selected.map((requirementId) => ({
                    companyId,
                    complianceItemId: item.id,
                    requirementId,
                  })),
                  skipDuplicates: true,
                }),
              ]
            : []),
          prisma.complianceSignOffEvent.create({
            data: {
              companyId,
              complianceItemId: item.id,
              action: body.action,
              reviewer,
              note: body.note?.trim() || null,
            },
          }),
        ]);
        await logAudit({
          tenantId: req.tenantId,
          actorEmail: reviewer,
          entityType: 'ComplianceItem',
          entityId: item.id,
          action: `SIGN_OFF_${body.action}`,
          diff: { from: item.signOff, to: ACTION_TO_STATUS[body.action] },
        });
        res.json(updated);
      } catch (e) {
        next(e);
      }
    },
  );

  // Bulk sign-off for identical template task families in the review queue.
  // CONFIRM is refused for regulation-level items (those need row selection).
  router.post(
    '/compliance-register/items/bulk-sign-off',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const body = z
          .object({
            itemIds: z.array(z.string()).min(1).max(500),
            action: z.enum(['CONFIRM', 'NEEDS_RESEARCH']),
            note: z.string().optional(),
          })
          .parse(req.body);
        const items = await prisma.complianceItem.findMany({
          where: { id: { in: body.itemIds }, companyId },
          select: { id: true, groundingBasis: true },
        });
        const eligible =
          body.action === 'CONFIRM' ? items.filter((i) => i.groundingBasis === 'ITEM') : items;
        const skipped = items.length - eligible.length;
        const reviewer = req.user.email;
        if (eligible.length > 0) {
          await prisma.$transaction([
            prisma.complianceItem.updateMany({
              where: { id: { in: eligible.map((i) => i.id) } },
              data: {
                signOff: ACTION_TO_STATUS[body.action],
                reviewer,
                ...(body.note?.trim() ? { reviewNotes: body.note.trim() } : {}),
              },
            }),
            prisma.complianceSignOffEvent.createMany({
              data: eligible.map((i) => ({
                companyId,
                complianceItemId: i.id,
                action: body.action,
                reviewer,
                note: body.note?.trim() || null,
              })),
            }),
          ]);
        }
        await logAudit({
          tenantId: req.tenantId,
          actorEmail: reviewer,
          entityType: 'ComplianceItem',
          entityId: 'bulk',
          action: `BULK_SIGN_OFF_${body.action}`,
          diff: { updated: eligible.length, skipped },
        });
        res.json({
          updated: eligible.length,
          skipped,
          notFound: body.itemIds.length - items.length,
        });
      } catch (e) {
        next(e);
      }
    },
  );

  // Edit an item's task fields. Editing a CONFIRMED item resets it to PENDING —
  // the determination no longer matches what was confirmed.
  router.patch(
    '/compliance-register/items/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const body = editSchema.parse(req.body);
        const before = await prisma.complianceItem.findFirst({
          where: { id: req.params.id, companyId },
        });
        if (!before) return res.status(404).json({ error: 'Compliance item not found' });
        const resetConfirmed = before.signOff === 'CONFIRMED';
        const reviewer = req.user.email;
        const [updated] = await prisma.$transaction([
          prisma.complianceItem.update({
            where: { id: before.id },
            data: { ...body, ...(resetConfirmed ? { signOff: 'PENDING' } : {}) },
          }),
          ...(resetConfirmed
            ? [
                prisma.complianceSignOffEvent.create({
                  data: {
                    companyId,
                    complianceItemId: before.id,
                    action: 'RESET',
                    reviewer,
                    note: 'Confirmed item edited — sign-off reset to pending',
                  },
                }),
              ]
            : []),
        ]);
        await logAudit({
          tenantId: req.tenantId,
          actorEmail: reviewer,
          entityType: 'ComplianceItem',
          entityId: before.id,
          action: 'UPDATE',
          diff: computeDiff(
            before as unknown as Record<string, unknown>,
            updated as unknown as Record<string, unknown>,
            [...EDITABLE, 'signOff'],
          ),
        });
        res.json(updated);
      } catch (e) {
        next(e);
      }
    },
  );

  // Promote a jurisdiction-specific deadline variant into a bespoke L2 item.
  // The new item enters the queue as PENDING, grounded in the variant's citation.
  router.post(
    '/compliance-register/variants/:id/promote',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const variant = await prisma.complianceJurisdictionVariant.findFirst({
          where: { id: req.params.id, companyId },
          include: { regulation: true },
        });
        if (!variant) return res.status(404).json({ error: 'Variant not found' });
        if (variant.promotedItemId)
          return res
            .status(409)
            .json({ error: 'Variant already promoted', itemId: variant.promotedItemId });

        const reg = variant.regulation;
        // Next free item code in the regulation's REG-###-C## sequence.
        const siblings = await prisma.complianceItem.findMany({
          where: { companyId, regulationId: reg.id },
          select: { itemCode: true },
        });
        const maxSeq = siblings.reduce((max, s) => {
          const m = /-C(\d+)$/.exec(s.itemCode);
          return m ? Math.max(max, Number(m[1])) : max;
        }, 0);
        const itemCode = `${reg.regCode}-C${String(maxSeq + 1).padStart(2, '0')}`;

        const reviewer = req.user.email;
        const item = await prisma.$transaction(async (tx) => {
          const created = await tx.complianceItem.create({
            data: {
              tenantId: req.tenantId,
              companyId,
              itemCode,
              regulationId: reg.id,
              name: `${variant.requirementTitle} — ${variant.jurisdiction} (${variant.deadlineVariant})`,
              ownerTeam: reg.ownerTeam,
              frequency: reg.frequency,
              evidence: reg.evidenceRequired,
              jurisdictionScope: variant.jurisdiction,
              auditStatus: 'Not started',
              supportingReqRows: 0,
              groundingBasis: 'ITEM',
              officialSourceRows: 0,
              jurisdictionsCovered: 1,
              representativeRequirement: variant.requirementTitle,
              repJurisdiction: variant.jurisdiction,
              supportingCitations: `${variant.jurisdiction}: ${variant.citation}`,
              frequencyDerived: variant.deadlineVariant,
              frequencyAlignment: 'NO_SIGNAL',
              deadlineSignals: variant.deadlineVariant,
              determinationStatus: 'GROUNDED',
              confidence: 'MEDIUM',
              signOff: 'PENDING',
            },
          });
          await tx.complianceJurisdictionVariant.update({
            where: { id: variant.id },
            data: { promotedItemId: created.id },
          });
          await tx.complianceSignOffEvent.create({
            data: {
              companyId,
              complianceItemId: created.id,
              action: 'PROMOTE',
              reviewer,
              note: `Promoted from ${variant.jurisdiction} variant "${variant.deadlineVariant}" (${variant.citation})`,
            },
          });
          return created;
        });
        await logAudit({
          tenantId: req.tenantId,
          actorEmail: reviewer,
          entityType: 'ComplianceItem',
          entityId: item.id,
          action: 'PROMOTE_VARIANT',
          diff: { variantId: variant.id, itemCode },
        });
        res.status(201).json(item);
      } catch (e) {
        next(e);
      }
    },
  );
}
