/**
 * Insights (FORMS-INSIGHT): portfolio dashboard rollups — library coverage,
 * disposition progress, trust-model health (needs-human backlog), and field
 * plane adoption. All derived on read from source rows.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { activeCompanyId } from './helpers.js';

export function registerInsightRoutes(router: Router): void {
  router.get('/insights', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const where = { tenantId: req.tenantId, companyId };
      const [
        formCount,
        versionCount,
        clauseCount,
        quarantinedCount,
        workingSetCount,
        clusterCount,
        findingsByStatus,
        dispositionsByStatus,
        dispositionsByType,
        preferredWordingCount,
        definitionCount,
        fieldCount,
        mappingsByStatus,
        formsWithDisposition,
      ] = await Promise.all([
        prisma.policyForm.count({ where }),
        prisma.policyFormVersion.count({ where }),
        prisma.formClause.count({ where }),
        prisma.policyFormVersion.count({ where: { ...where, status: 'quarantined' } }),
        prisma.formWorkingSet.count({ where }),
        prisma.clauseCluster.count({ where }),
        prisma.formFinding.groupBy({ by: ['status'], where, _count: { id: true } }),
        prisma.formDisposition.groupBy({ by: ['status'], where, _count: { id: true } }),
        prisma.formDisposition.groupBy({ by: ['type'], where, _count: { id: true } }),
        prisma.preferredWording.count({ where }),
        prisma.fieldDefinition.count({ where }),
        prisma.formField.count({ where }),
        prisma.fieldMapping.groupBy({ by: ['status'], where, _count: { id: true } }),
        prisma.policyForm.count({ where: { ...where, dispositions: { some: {} } } }),
      ]);
      const toRecord = (rows: { _count: { id: number } }[], key: 'status' | 'type') =>
        Object.fromEntries(
          (rows as ({ status?: string; type?: string } & { _count: { id: number } })[]).map((r) => [
            r[key] ?? 'unknown',
            r._count.id,
          ]),
        );
      res.json({
        library: {
          forms: formCount,
          versions: versionCount,
          clauses: clauseCount,
          quarantinedVersions: quarantinedCount,
        },
        rationalization: {
          workingSets: workingSetCount,
          clusters: clusterCount,
          findingsByStatus: toRecord(findingsByStatus, 'status'),
          dispositionsByStatus: toRecord(dispositionsByStatus, 'status'),
          dispositionsByType: toRecord(dispositionsByType, 'type'),
          preferredWordings: preferredWordingCount,
          dispositionCoverage: formCount === 0 ? 0 : formsWithDisposition / formCount,
        },
        fieldPlane: {
          definitions: definitionCount,
          extractedFields: fieldCount,
          mappingsByStatus: toRecord(mappingsByStatus, 'status'),
        },
      });
    } catch (e) {
      next(e);
    }
  });
}
