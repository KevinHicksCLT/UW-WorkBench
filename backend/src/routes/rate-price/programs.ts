/**
 * Rate programs + filing packets (CAP-15, LLR-14.1). A packet generates from a
 * program and its implementing PUBLISHED version, binds to compliance-register
 * items (the satisfies edge), and refuses generation while any bound item is
 * unresolved — every offender listed (RATE-T-012). Filing submission is a
 * declared review point on the governance spine.
 */
import type { NextFunction, Request, Response, Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { activeCompanyId, emitGovernanceEvent, nextRpRef, specOf } from './helpers.js';

export function registerProgramRoutes(router: Router): void {
  router.get('/programs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const programs = await prisma.rpRateProgram.findMany({
        where: { tenantId: req.tenantId, companyId },
        orderBy: { ref: 'asc' },
        include: {
          modelLinks: {
            include: { model: { select: { id: true, ref: true, name: true, lifecycle: true } } },
          },
          filingPackets: {
            orderBy: { createdAt: 'desc' },
            include: {
              complianceLinks: {
                include: { complianceItem: { select: { id: true, itemCode: true, name: true } } },
              },
            },
          },
        },
      });
      res.json(programs);
    } catch (e) {
      next(e);
    }
  });

  const createProgramSchema = z.object({
    product: z.string().min(1),
    lob: z.string().min(1),
    jurisdiction: z.string().min(2).max(2),
    effectiveDate: z.string().datetime().optional(),
    modelIds: z.array(z.string().min(1)).min(1), // implemented-by — enumerated
  });
  router.post('/programs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = createProgramSchema.parse(req.body);
      const models = await prisma.rpRatingModel.findMany({
        where: { id: { in: data.modelIds }, tenantId: req.tenantId, companyId },
        select: { id: true },
      });
      const missing = data.modelIds.filter((id) => !models.some((m) => m.id === id));
      if (missing.length) {
        return res.status(409).json({ error: 'Unresolved model refs', missingModelIds: missing });
      }
      const ref = await nextRpRef(companyId, 'program', 'RP');
      const program = await prisma.rpRateProgram.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          ref,
          product: data.product,
          lob: data.lob,
          jurisdiction: data.jurisdiction.toUpperCase(),
          effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
          modelLinks: {
            create: data.modelIds.map((modelId) => ({ companyId, modelId })),
          },
        },
        include: { modelLinks: true },
      });
      res.status(201).json(program);
    } catch (e) {
      next(e);
    }
  });

  // Generate a SERFF-ready packet from the program + implementing version.
  const packetSchema = z.object({
    modelVersionId: z.string().min(1),
    complianceItemIds: z.array(z.string().min(1)).min(1), // bound checklist — required (RATE-T-012)
  });
  router.post(
    '/programs/:id/filing-packets',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const program = await prisma.rpRateProgram.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId, companyId },
          include: { modelLinks: { select: { modelId: true } } },
        });
        if (!program) return res.status(404).json({ error: 'Not found' });
        const data = packetSchema.parse(req.body);
        const version = await prisma.rpModelVersion.findFirst({
          where: { id: data.modelVersionId, tenantId: req.tenantId, companyId },
          include: { model: { select: { id: true, ref: true, name: true } } },
        });
        if (!version) return res.status(404).json({ error: 'Not found' });
        if (version.status !== 'published') {
          return res.status(409).json({
            error: 'Filing packets generate from published versions only',
            invariant: 'INV-01',
          });
        }
        if (!program.modelLinks.some((l) => l.modelId === version.model.id)) {
          return res.status(409).json({
            error: `Version belongs to ${version.model.ref}, which does not implement program ${program.ref}`,
          });
        }
        // Bound compliance items must ALL resolve — refuse otherwise, listing
        // every offender (RATE-T-012 / pack-apply convention).
        const items = await prisma.complianceItem.findMany({
          where: { id: { in: data.complianceItemIds }, companyId },
          select: { id: true, itemCode: true, name: true },
        });
        const unresolved = data.complianceItemIds.filter((id) => !items.some((i) => i.id === id));
        if (unresolved.length) {
          return res.status(409).json({
            error: 'Filing packet refused: unresolved bound compliance items',
            unresolvedComplianceItemIds: unresolved,
          });
        }
        const spec = specOf(version.spec);
        const sections = [
          {
            name: 'Rate-change summary + factor deltas',
            status: 'generated',
            detail: `${spec.factors.length} factors from ${version.model.ref} v${version.semver}`,
          },
          { name: 'Impact exhibits (disruption, by territory)', status: 'generated' },
          {
            name: 'Model documentation refs',
            status: 'linked',
            detail: `bundle ${version.bundleHash.slice(0, 12)}… (provenance: ${version.provenance})`,
          },
          ...items.map((i) => ({
            name: `Jurisdiction checklist — ${i.itemCode}`,
            status: 'bound',
            boundComplianceRef: i.itemCode,
          })),
        ];
        const packet = await prisma.rpFilingPacket.create({
          data: {
            tenantId: req.tenantId,
            companyId,
            programId: program.id,
            modelVersionId: version.id,
            sections: sections as unknown as Prisma.InputJsonValue,
            complianceLinks: {
              create: items.map((i) => ({ companyId, complianceItemId: i.id })),
            },
          },
          include: { complianceLinks: true },
        });
        await emitGovernanceEvent({
          tenantId: req.tenantId,
          companyId,
          eventType: 'RpFilingPacketGenerated',
          actorKind: 'HUMAN',
          actorId: req.user.email,
          payload: { programRef: program.ref, modelRef: version.model.ref, semver: version.semver },
          correlationId: program.id,
        });
        res.status(201).json(packet);
      } catch (e) {
        next(e);
      }
    },
  );

  // Submit — declared review point (filing-submit). The packet export carries
  // its governance-trace excerpt for the examiner.
  router.post(
    '/filing-packets/:id/submit',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const packet = await prisma.rpFilingPacket.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId, companyId },
          include: { program: { select: { id: true, ref: true, jurisdiction: true } } },
        });
        if (!packet) return res.status(404).json({ error: 'Not found' });
        if (packet.status !== 'draft') {
          return res.status(409).json({ error: `Packet is ${packet.status} — only drafts submit` });
        }
        const serffTrackingNo = `SERFF-${packet.program.jurisdiction}-${packet.id.slice(-6).toUpperCase()}`;
        const submitted = await prisma.rpFilingPacket.update({
          where: { id: packet.id },
          data: {
            status: 'submitted',
            serffTrackingNo,
            submittedBy: req.user.email,
            submittedAt: new Date(),
          },
        });
        await prisma.rpRateProgram.update({
          where: { id: packet.program.id },
          data: { filingStatus: 'filed' },
        });
        await emitGovernanceEvent({
          tenantId: req.tenantId,
          companyId,
          eventType: 'RpFilingSubmitted',
          actorKind: 'HUMAN',
          actorId: req.user.email,
          payload: { programRef: packet.program.ref, serffTrackingNo },
          correlationId: packet.program.id,
        });
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'RpFilingPacket',
          entityId: packet.id,
          action: 'RP_FILING_SUBMITTED',
          diff: { serffTrackingNo },
        });
        res.json(submitted);
      } catch (e) {
        next(e);
      }
    },
  );
}
