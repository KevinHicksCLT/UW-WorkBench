/**
 * Working sets + clustering (FORMS-INTEL / FORMS-COMPARE): a named scope of
 * form versions, the lexical cluster run, the Portfolio-mode matrix, and the
 * Reading-mode clause-aligned comparison. Cluster recommendations persist as
 * FormFindings only (ADR-004) — nothing auto-approves.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import {
  clusterClauses,
  deriveCellState,
  type ClusterableClause,
  type CellState,
} from '../../lib/forms/clustering.js';
import { clauseSimilarity } from '../../lib/forms/similarity.js';
import { effectiveMode, routeFindingStatus } from '../../lib/forms/trust.js';
import { activeCompanyId, ownWorkingSet, type FindingCitation } from './helpers.js';

const setCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  formVersionIds: z.array(z.string()).min(1),
});

const setPatchSchema = z.object({
  modeOverride: z.enum(['reading', 'portfolio']).nullable().optional(),
  clusterThreshold: z.number().min(0.1).max(1).optional(),
});

const memberInclude = {
  members: {
    select: {
      id: true,
      formVersion: {
        select: {
          id: true,
          versionNo: true,
          status: true,
          form: { select: { id: true, formNumber: true, title: true, lob: true } },
        },
      },
    },
  },
} as const;

export function registerWorkingSetRoutes(router: Router): void {
  router.get('/working-sets', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const sets = await prisma.formWorkingSet.findMany({
        where: { tenantId: req.tenantId, companyId },
        include: {
          _count: { select: { members: true, clusters: true, findings: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(sets.map((s) => ({ ...s, mode: effectiveMode(s._count.members, s.modeOverride) })));
    } catch (e) {
      next(e);
    }
  });

  router.post('/working-sets', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const data = setCreateSchema.parse(req.body);
      const versions = await prisma.policyFormVersion.findMany({
        where: { id: { in: data.formVersionIds }, tenantId: req.tenantId },
        select: { id: true },
      });
      if (versions.length !== data.formVersionIds.length) {
        return res.status(404).json({ error: 'Form version not found' });
      }
      const set = await prisma.formWorkingSet.create({
        data: {
          tenantId: req.tenantId,
          companyId,
          name: data.name,
          description: data.description,
          members: {
            create: data.formVersionIds.map((formVersionId) => ({ companyId, formVersionId })),
          },
        },
        include: { _count: { select: { members: true } } },
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'FormWorkingSet',
        entityId: set.id,
        action: 'WORKING_SET_CREATED',
        diff: { name: data.name, members: data.formVersionIds.length },
      });
      res.status(201).json({ ...set, mode: effectiveMode(set._count.members, set.modeOverride) });
    } catch (e) {
      next(e);
    }
  });

  router.patch('/working-sets/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const set = await ownWorkingSet(req.params.id, req.tenantId);
      if (!set) return res.status(404).json({ error: 'Not found' });
      const data = setPatchSchema.parse(req.body);
      const updated = await prisma.formWorkingSet.update({
        where: { id: set.id },
        data: {
          modeOverride: data.modeOverride === undefined ? undefined : data.modeOverride,
          clusterThreshold: data.clusterThreshold,
        },
        include: { _count: { select: { members: true } } },
      });
      res.json({ ...updated, mode: effectiveMode(updated._count.members, updated.modeOverride) });
    } catch (e) {
      next(e);
    }
  });

  // Cluster run (F2): fetch every clause across member versions, cluster at
  // the set's θ, and persist clusters + members + recommendation findings in
  // one transaction. Deterministic lexical v1 — synchronous, no queue needed.
  router.post(
    '/working-sets/:id/cluster',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const set = await ownWorkingSet(req.params.id, req.tenantId);
        if (!set) return res.status(404).json({ error: 'Not found' });
        const members = await prisma.formWorkingSetMember.findMany({
          where: { workingSetId: set.id },
          select: { formVersionId: true },
        });
        const versionIds = members.map((m) => m.formVersionId);
        const clauses = await prisma.formClause.findMany({
          where: { formVersionId: { in: versionIds } },
          select: {
            id: true,
            formVersionId: true,
            text: true,
            textHash: true,
            heading: true,
            charStart: true,
            charEnd: true,
          },
        });
        const clusterable: ClusterableClause[] = clauses;
        const results = clusterClauses(clusterable, set.clusterThreshold);
        const clauseById = new Map(clauses.map((c) => [c.id, c]));

        await prisma.$transaction(async (tx) => {
          await tx.clauseCluster.deleteMany({ where: { workingSetId: set.id } });
          await tx.formFinding.deleteMany({
            where: { workingSetId: set.id, status: { in: ['new', 'needs-human'] } },
          });
          for (const r of results) {
            const cluster = await tx.clauseCluster.create({
              data: {
                tenantId: req.tenantId,
                companyId: set.companyId,
                workingSetId: set.id,
                label: r.label,
                representativeClauseId: r.representativeId,
                divergenceScore: r.divergenceScore,
                members: {
                  create: r.memberIds.map((clauseId) => ({
                    companyId: set.companyId,
                    clauseId,
                    similarity: r.similarities[clauseId],
                    outlier: r.outlierIds.includes(clauseId),
                  })),
                },
              },
            });
            if (r.memberIds.length < 2) continue;
            // Recommendation finding for the multi-member cluster (τ-routed).
            const formCount = new Set(r.memberIds.map((id) => clauseById.get(id)?.formVersionId))
              .size;
            const meanSim =
              r.memberIds.reduce((sum, id) => sum + r.similarities[id], 0) / r.memberIds.length;
            const confidence = Number(meanSim.toFixed(4));
            const citations: FindingCitation[] = r.memberIds.map((id) => {
              const c = clauseById.get(id);
              return {
                formVersionId: c?.formVersionId ?? '',
                clauseId: id,
                charStart: c?.charStart ?? 0,
                charEnd: c?.charEnd ?? 0,
                quote: c?.text ?? '',
              };
            });
            await tx.formFinding.create({
              data: {
                tenantId: req.tenantId,
                companyId: set.companyId,
                workingSetId: set.id,
                clusterId: cluster.id,
                subjectKind: 'cluster',
                claim: `${r.memberIds.length} clauses across ${formCount} form version(s) express the same provision ("${r.label}") and are candidates for standardization; max divergence ${(r.divergenceScore * 100).toFixed(1)}%.`,
                citations,
                confidence,
                status: routeFindingStatus(confidence),
                agentSkill: 'lexical-cluster-v1',
                traceRef: `cluster-run:${set.id}:${cluster.id}`,
              },
            });
            // Outlier findings: low similarity ⇒ low confidence the member
            // belongs ⇒ needs-human via the same τ route.
            for (const outlierId of r.outlierIds) {
              const c = clauseById.get(outlierId);
              if (!c) continue;
              const sim = r.similarities[outlierId];
              await tx.formFinding.create({
                data: {
                  tenantId: req.tenantId,
                  companyId: set.companyId,
                  workingSetId: set.id,
                  clusterId: cluster.id,
                  subjectKind: 'cluster',
                  claim: `Outlier: this clause groups with "${r.label}" at only ${(sim * 100).toFixed(0)}% similarity — verify it belongs before any standardization.`,
                  citations: [
                    {
                      formVersionId: c.formVersionId,
                      clauseId: outlierId,
                      charStart: c.charStart,
                      charEnd: c.charEnd,
                      quote: c.text,
                    },
                  ] satisfies FindingCitation[],
                  confidence: Number(sim.toFixed(4)),
                  status: routeFindingStatus(sim),
                  agentSkill: 'lexical-cluster-v1',
                  traceRef: `cluster-run:${set.id}:${cluster.id}:outlier`,
                },
              });
            }
          }
          await tx.formWorkingSet.update({
            where: { id: set.id },
            data: { clusterStatus: 'done', clusteredAt: new Date() },
          });
        });
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'FormWorkingSet',
          entityId: set.id,
          action: 'CLUSTER_RUN_COMPLETED',
          diff: { clusters: results.length, theta: set.clusterThreshold },
        });
        res.json({ ok: true, clusters: results.length });
      } catch (e) {
        next(e);
      }
    },
  );

  // Portfolio-mode matrix: rows = clusters, cols = member versions, cell
  // states per FORMS-LLR-006 (derived, never stored).
  router.get(
    '/working-sets/:id/matrix',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const set = await ownWorkingSet(req.params.id, req.tenantId);
        if (!set) return res.status(404).json({ error: 'Not found' });
        const [members, clusters] = await Promise.all([
          prisma.formWorkingSetMember.findMany({
            where: { workingSetId: set.id },
            select: {
              formVersion: {
                select: {
                  id: true,
                  versionNo: true,
                  form: { select: { id: true, formNumber: true, title: true } },
                },
              },
            },
          }),
          prisma.clauseCluster.findMany({
            where: { workingSetId: set.id },
            select: {
              id: true,
              label: true,
              divergenceScore: true,
              representativeClause: { select: { id: true, textHash: true, text: true } },
              members: {
                select: {
                  similarity: true,
                  outlier: true,
                  clause: { select: { id: true, formVersionId: true, textHash: true } },
                },
              },
              _count: { select: { findings: true } },
              preferredWording: { select: { id: true } },
              dispositions: { select: { id: true, type: true, status: true } },
            },
            orderBy: { divergenceScore: 'desc' },
          }),
        ]);
        const columns = members.map((m) => m.formVersion);
        const rows = clusters.map((cl) => {
          const cells: Record<
            string,
            { state: CellState; similarity: number; outlier: boolean; clauseId: string | null }
          > = {};
          for (const col of columns) {
            const inVersion = cl.members.filter((m) => m.clause.formVersionId === col.id);
            const best = inVersion.reduce<(typeof inVersion)[number] | null>(
              (acc, m) => (acc === null || m.similarity > acc.similarity ? m : acc),
              null,
            );
            cells[col.id] = {
              state: deriveCellState({
                hasClause: best !== null,
                hashEqualToRep:
                  best !== null &&
                  cl.representativeClause !== null &&
                  best.clause.textHash === cl.representativeClause.textHash,
                similarity: best?.similarity ?? 0,
                clusterSize: cl.members.length,
                theta: set.clusterThreshold,
              }),
              similarity: best?.similarity ?? 0,
              outlier: best?.outlier ?? false,
              clauseId: best?.clause.id ?? null,
            };
          }
          return {
            clusterId: cl.id,
            label: cl.label,
            divergenceScore: cl.divergenceScore,
            representativeText: cl.representativeClause?.text ?? null,
            memberCount: cl.members.length,
            findingCount: cl._count.findings,
            hasPreferredWording: cl.preferredWording !== null,
            dispositions: cl.dispositions,
            cells,
          };
        });
        res.json({
          workingSet: {
            id: set.id,
            name: set.name,
            clusterThreshold: set.clusterThreshold,
            clusterStatus: set.clusterStatus,
            clusteredAt: set.clusteredAt,
            modeOverride: set.modeOverride,
            mode: effectiveMode(columns.length, set.modeOverride),
          },
          columns,
          rows,
        });
      } catch (e) {
        next(e);
      }
    },
  );

  // Reading-mode comparison (F3 drill-down): clause-aligned pairing of two
  // member versions — aligned by shared cluster, then by ordinal; pairs
  // classify as identical | near | divergent, unpaired as unique.
  router.get(
    '/working-sets/:id/compare',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const set = await ownWorkingSet(req.params.id, req.tenantId);
        if (!set) return res.status(404).json({ error: 'Not found' });
        const a = typeof req.query.a === 'string' ? req.query.a : '';
        const b = typeof req.query.b === 'string' ? req.query.b : '';
        if (!a || !b) return res.status(400).json({ error: 'Query params a and b are required' });
        const membership = await prisma.formWorkingSetMember.findMany({
          where: { workingSetId: set.id, formVersionId: { in: [a, b] } },
          select: { formVersionId: true },
        });
        if (new Set(membership.map((m) => m.formVersionId)).size !== 2) {
          return res.status(404).json({ error: 'Not found' });
        }
        const clauses = await prisma.formClause.findMany({
          where: { formVersionId: { in: [a, b] } },
          orderBy: { ordinal: 'asc' },
          select: {
            id: true,
            formVersionId: true,
            ordinal: true,
            heading: true,
            text: true,
            textHash: true,
            clusterMembers: {
              where: { cluster: { workingSetId: set.id } },
              select: { clusterId: true },
            },
          },
        });
        const clausesA = clauses.filter((c) => c.formVersionId === a);
        const clausesB = clauses.filter((c) => c.formVersionId === b);
        const clusterOf = (c: (typeof clauses)[number]) => c.clusterMembers[0]?.clusterId ?? null;
        const byClusterB = new Map<string, (typeof clauses)[number][]>();
        for (const c of clausesB) {
          const k = clusterOf(c);
          if (!k) continue;
          const list = byClusterB.get(k) ?? [];
          list.push(c);
          byClusterB.set(k, list);
        }
        const pairedB = new Set<string>();
        const rows = clausesA.map((ca) => {
          const k = clusterOf(ca);
          const candidates = (k ? (byClusterB.get(k) ?? []) : []).filter((c) => !pairedB.has(c.id));
          const match = candidates[0] ?? null;
          if (match) pairedB.add(match.id);
          let status: 'identical' | 'near' | 'divergent' | 'unique' = 'unique';
          let similarity = 0;
          if (match) {
            similarity = ca.textHash === match.textHash ? 1 : clauseSimilarity(ca.text, match.text);
            status = similarity === 1 ? 'identical' : similarity >= 0.95 ? 'near' : 'divergent';
          }
          return {
            a: { id: ca.id, ordinal: ca.ordinal, heading: ca.heading, text: ca.text },
            b: match
              ? { id: match.id, ordinal: match.ordinal, heading: match.heading, text: match.text }
              : null,
            status,
            similarity: Number(similarity.toFixed(4)),
          };
        });
        for (const cb of clausesB) {
          if (!pairedB.has(cb.id)) {
            rows.push({
              a: null as never,
              b: { id: cb.id, ordinal: cb.ordinal, heading: cb.heading, text: cb.text },
              status: 'unique',
              similarity: 0,
            });
          }
        }
        res.json({ rows });
      } catch (e) {
        next(e);
      }
    },
  );

  router.get('/working-sets/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const set = await prisma.formWorkingSet.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        include: {
          ...memberInclude,
          _count: { select: { clusters: true, findings: true } },
        },
      });
      if (!set) return res.status(404).json({ error: 'Not found' });
      const findingCounts = await prisma.formFinding.groupBy({
        by: ['status'],
        where: { workingSetId: set.id },
        _count: { id: true },
      });
      res.json({
        ...set,
        mode: effectiveMode(set.members.length, set.modeOverride),
        findingsByStatus: Object.fromEntries(findingCounts.map((f) => [f.status, f._count.id])),
      });
    } catch (e) {
      next(e);
    }
  });
}
