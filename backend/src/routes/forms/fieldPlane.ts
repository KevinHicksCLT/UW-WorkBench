/**
 * Field plane (FORMS-FIELD, v0.2 of the spec): the canonical field
 * dictionary, extracted-field browsing, τ-routed mapping suggestions with
 * per-signal audit scores, one-at-a-time mapping decisions, and the derived
 * "same question, N phrasings" divergence report (FORMS-HLR-018–021).
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { suggestMapping, type MappingCandidate } from '../../lib/forms/fieldMapping.js';
import { routeMappingStatus } from '../../lib/forms/trust.js';
import { activeCompanyId } from './helpers.js';

const KEY_GRAMMAR = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){1,3}$/;

const definitionCreateSchema = z.object({
  key: z.string().regex(KEY_GRAMMAR, 'Key must follow role.entity.attribute grammar'),
  dataSetType: z.enum([
    'Insured',
    'Policy',
    'Producer',
    'Carrier',
    'Coverage',
    'Location',
    'Vehicle',
    'Loss',
    'Payment',
    'Identification',
    'Signature',
    'Nav',
    'UserDefined',
  ]),
  dataType: z.enum(['string', 'number', 'date', 'boolean', 'choice', 'signature']).optional(),
  acordRef: z.string().optional(),
  scope: z.enum(['global', 'tenant', 'form']).optional(),
  stability: z.enum(['stable', 'do-not-map']).optional(),
  compositionParts: z.array(z.string()).optional(),
  compositionFormat: z.string().optional(),
});

const suggestSchema = z
  .object({
    workingSetId: z.string().optional(),
    formVersionId: z.string().optional(),
  })
  .refine((d) => !!d.workingSetId || !!d.formVersionId, {
    message: 'workingSetId or formVersionId is required',
  });

const mappingDecideSchema = z.object({ decision: z.enum(['confirmed', 'rejected']) });

export function registerFieldPlaneRoutes(router: Router): void {
  router.get('/field-dictionary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const definitions = await prisma.fieldDefinition.findMany({
        where: { tenantId: req.tenantId, companyId },
        include: { _count: { select: { mappings: true } } },
        orderBy: { key: 'asc' },
      });
      res.json(definitions);
    } catch (e) {
      next(e);
    }
  });

  router.post('/field-dictionary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = definitionCreateSchema.parse(req.body);
      // Calculated fields must compose existing keys (INV-F2 groundwork).
      if (data.compositionParts && data.compositionParts.length > 0) {
        const parts = await prisma.fieldDefinition.findMany({
          where: { tenantId: req.tenantId, companyId, key: { in: data.compositionParts } },
          select: { key: true },
        });
        if (parts.length !== data.compositionParts.length) {
          return res.status(422).json({ error: 'Composition parts must reference existing keys' });
        }
      }
      const definition = await prisma.fieldDefinition.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          key: data.key,
          dataSetType: data.dataSetType,
          dataType: data.dataType ?? 'string',
          acordRef: data.acordRef,
          scope: data.scope ?? 'tenant',
          stability: data.stability ?? 'stable',
          compositionParts: data.compositionParts ?? undefined,
          compositionFormat: data.compositionFormat,
        },
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'FieldDefinition',
        entityId: definition.id,
        action: 'FIELD_DEFINITION_CREATED',
        diff: { key: data.key },
      });
      res.status(201).json(definition);
    } catch (e) {
      next(e);
    }
  });

  router.get('/field-mappings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const mappings = await prisma.fieldMapping.findMany({
        where: { tenantId: req.tenantId, companyId, status },
        include: {
          formField: {
            select: {
              id: true,
              sourceName: true,
              label: true,
              widgetType: true,
              formVersion: {
                select: {
                  id: true,
                  versionNo: true,
                  form: { select: { id: true, formNumber: true, title: true } },
                },
              },
            },
          },
          fieldDefinition: { select: { id: true, key: true, dataSetType: true, stability: true } },
        },
        orderBy: [{ status: 'asc' }, { confidence: 'asc' }],
        take: 500,
      });
      res.json(mappings);
    } catch (e) {
      next(e);
    }
  });

  // Batch suggestion run (F6): every unmapped field in scope gets its best
  // dictionary candidate, τ-routed. do-not-map keys are never candidates
  // (INV-F1 — enforced in lib/forms/fieldMapping).
  router.post(
    '/field-mappings/suggest',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = await activeCompanyId(req, res);
        if (!companyId) return;
        const data = suggestSchema.parse(req.body);
        let versionIds: string[] = [];
        if (data.workingSetId) {
          const set = await prisma.formWorkingSet.findFirst({
            where: { id: data.workingSetId, tenantId: req.tenantId },
            select: { members: { select: { formVersionId: true } } },
          });
          if (!set) return res.status(404).json({ error: 'Not found' });
          versionIds = set.members.map((m) => m.formVersionId);
        } else {
          const version = await prisma.policyFormVersion.findFirst({
            where: { id: data.formVersionId as string, tenantId: req.tenantId },
            select: { id: true },
          });
          if (!version) return res.status(404).json({ error: 'Not found' });
          versionIds = [version.id];
        }
        const [fields, definitions] = await Promise.all([
          prisma.formField.findMany({
            where: { formVersionId: { in: versionIds } },
            select: {
              id: true,
              sourceName: true,
              label: true,
              options: true,
              mappings: { select: { status: true } },
            },
          }),
          prisma.fieldDefinition.findMany({
            where: { tenantId: req.tenantId, companyId },
            select: { id: true, key: true, stability: true, dataType: true },
          }),
        ]);
        const candidates: MappingCandidate[] = definitions.map((d) => ({
          id: d.id,
          key: d.key,
          stability: d.stability,
          optionValues: [],
        }));
        let created = 0;
        let needsHuman = 0;
        for (const field of fields) {
          // Skip fields with a confirmed mapping — decided is decided.
          if (field.mappings.some((m) => m.status === 'confirmed')) continue;
          const optionLabels = Array.isArray(field.options)
            ? (field.options as { label?: string }[])
                .map((o) => o.label ?? '')
                .filter((l) => l.length > 0)
            : [];
          const suggestion = suggestMapping(
            { sourceName: field.sourceName, label: field.label, optionLabels },
            candidates,
          );
          if (!suggestion) continue;
          const status = routeMappingStatus(suggestion.confidence);
          await prisma.fieldMapping.upsert({
            where: {
              formFieldId_fieldDefinitionId: {
                formFieldId: field.id,
                fieldDefinitionId: suggestion.fieldDefinitionId,
              },
            },
            create: {
              tenantId: req.tenantId,
              companyId,
              formFieldId: field.id,
              fieldDefinitionId: suggestion.fieldDefinitionId,
              confidence: suggestion.confidence,
              nameSim: suggestion.nameSim,
              labelSim: suggestion.labelSim,
              optionOverlap: suggestion.optionOverlap,
              status,
            },
            update: {
              confidence: suggestion.confidence,
              nameSim: suggestion.nameSim,
              labelSim: suggestion.labelSim,
              optionOverlap: suggestion.optionOverlap,
              // A rejected suggestion stays rejected; refresh scores only.
            },
          });
          created++;
          if (status === 'needs-human') needsHuman++;
        }
        res.json({ ok: true, suggested: created, needsHuman });
      } catch (e) {
        next(e);
      }
    },
  );

  // One-at-a-time mapping decision (INV-F3: reviewer + timestamp persisted).
  router.post(
    '/field-mappings/:id/decide',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const mapping = await prisma.fieldMapping.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId },
        });
        if (!mapping) return res.status(404).json({ error: 'Not found' });
        if (mapping.status === 'confirmed' || mapping.status === 'rejected') {
          return res.status(409).json({ error: 'Mapping already decided' });
        }
        const { decision } = mappingDecideSchema.parse(req.body);
        const updated = await prisma.fieldMapping.update({
          where: { id: mapping.id },
          data: { status: decision, reviewerId: req.user.id, decidedAt: new Date() },
        });
        res.json(updated);
      } catch (e) {
        next(e);
      }
    },
  );

  // Derived divergence report (FORMS-HLR-020): fields mapped to the same
  // definition but asked differently across ≥2 forms. Computed on read —
  // never stored (db-data-model: derive, don't denormalize).
  router.get('/field-divergence', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const mappings = await prisma.fieldMapping.findMany({
        where: { tenantId: req.tenantId, companyId, status: { in: ['suggested', 'confirmed'] } },
        select: {
          fieldDefinition: { select: { id: true, key: true, dataSetType: true } },
          formField: {
            select: {
              id: true,
              sourceName: true,
              label: true,
              widgetType: true,
              required: true,
              formatRule: true,
              formVersion: {
                select: { id: true, form: { select: { id: true, formNumber: true } } },
              },
            },
          },
        },
      });
      const byDefinition = new Map<string, typeof mappings>();
      for (const m of mappings) {
        const list = byDefinition.get(m.fieldDefinition.id) ?? [];
        list.push(m);
        byDefinition.set(m.fieldDefinition.id, list);
      }
      const groups = [];
      for (const list of byDefinition.values()) {
        const formIds = new Set(list.map((m) => m.formField.formVersion.form.id));
        if (formIds.size < 2) continue;
        const kinds: string[] = [];
        const distinct = (vals: (string | null | boolean)[]) => new Set(vals.map(String)).size > 1;
        if (distinct(list.map((m) => m.formField.label ?? m.formField.sourceName)))
          kinds.push('label');
        if (distinct(list.map((m) => m.formField.widgetType))) kinds.push('widgetType');
        if (distinct(list.map((m) => m.formField.formatRule))) kinds.push('format');
        if (distinct(list.map((m) => m.formField.required))) kinds.push('requiredness');
        if (kinds.length === 0) continue;
        groups.push({
          fieldDefinition: list[0].fieldDefinition,
          divergenceKinds: kinds,
          members: list.map((m) => ({
            formFieldId: m.formField.id,
            sourceName: m.formField.sourceName,
            label: m.formField.label,
            widgetType: m.formField.widgetType,
            required: m.formField.required,
            form: m.formField.formVersion.form,
          })),
        });
      }
      groups.sort((a, b) => b.members.length - a.members.length);
      res.json(groups);
    } catch (e) {
      next(e);
    }
  });

  // Extracted fields for one version (specific path — before library /:id).
  router.get('/versions/:id/fields', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const version = await prisma.policyFormVersion.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        select: { id: true },
      });
      if (!version) return res.status(404).json({ error: 'Not found' });
      const fields = await prisma.formField.findMany({
        where: { formVersionId: version.id },
        include: {
          mappings: {
            select: {
              id: true,
              status: true,
              confidence: true,
              fieldDefinition: { select: { id: true, key: true, stability: true } },
            },
          },
        },
        orderBy: [{ page: 'asc' }, { sourceName: 'asc' }],
      });
      res.json(fields);
    } catch (e) {
      next(e);
    }
  });
}
