// ── Seed-time cluster run (SCRUM-229) ──
// A faithful re-use of the POST /working-sets/:id/cluster pipeline
// (routes/forms/workingSets.ts) so seeded clusters, divergence scores, outlier
// flags and recommendation findings are byte-for-byte what the API produces.
// Kept as its own module so the orchestrator stays small.
import type { PrismaClient } from '@prisma/client';
import { clusterClauses, type ClusterableClause } from '../../lib/forms/clustering.js';
import { routeFindingStatus } from '../../lib/forms/trust.js';
import type { FindingCitation } from '../../routes/forms/helpers.js';

type Ctx = { tenantId: string; companyId: string };

export type CreatedCluster = {
  id: string;
  label: string;
  representativeClauseId: string | null;
  memberClauseIds: string[];
  memberVersionIds: string[];
  divergenceScore: number;
};

/**
 * Run the lexical cluster pipeline over one working set and persist clusters,
 * members and τ-routed recommendation/outlier findings. Idempotent: clears the
 * set's clusters and its undecided findings first.
 */
export async function runClusterRun(
  p: PrismaClient,
  ctx: Ctx,
  workingSetId: string,
  theta: number,
): Promise<CreatedCluster[]> {
  const { tenantId, companyId } = ctx;
  const members = await p.formWorkingSetMember.findMany({
    where: { workingSetId },
    select: { formVersionId: true },
  });
  const versionIds = members.map((m) => m.formVersionId);
  const clauses = await p.formClause.findMany({
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
  const results = clusterClauses(clusterable, theta);
  const clauseById = new Map(clauses.map((c) => [c.id, c]));

  await p.clauseCluster.deleteMany({ where: { workingSetId } });
  await p.formFinding.deleteMany({
    where: { workingSetId, status: { in: ['new', 'needs-human'] } },
  });

  const created: CreatedCluster[] = [];
  for (const r of results) {
    const cluster = await p.clauseCluster.create({
      data: {
        tenantId,
        companyId,
        workingSetId,
        label: r.label,
        representativeClauseId: r.representativeId,
        divergenceScore: r.divergenceScore,
        members: {
          create: r.memberIds.map((clauseId) => ({
            companyId,
            clauseId,
            similarity: r.similarities[clauseId],
            outlier: r.outlierIds.includes(clauseId),
          })),
        },
      },
    });
    created.push({
      id: cluster.id,
      label: r.label,
      representativeClauseId: r.representativeId,
      memberClauseIds: r.memberIds,
      memberVersionIds: [
        ...new Set(r.memberIds.map((id) => clauseById.get(id)?.formVersionId ?? '')),
      ].filter(Boolean),
      divergenceScore: r.divergenceScore,
    });

    if (r.memberIds.length < 2) continue;
    const formCount = new Set(r.memberIds.map((id) => clauseById.get(id)?.formVersionId)).size;
    const meanSim = r.memberIds.reduce((s, id) => s + r.similarities[id], 0) / r.memberIds.length;
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
    await p.formFinding.create({
      data: {
        tenantId,
        companyId,
        workingSetId,
        clusterId: cluster.id,
        subjectKind: 'cluster',
        claim: `${r.memberIds.length} clauses across ${formCount} form version(s) express the same provision ("${r.label}") and are candidates for standardization; max divergence ${(r.divergenceScore * 100).toFixed(1)}%.`,
        citations,
        confidence,
        status: routeFindingStatus(confidence),
        agentSkill: 'lexical-cluster-v1',
        traceRef: `cluster-run:${workingSetId}:${cluster.id}`,
      },
    });
    for (const outlierId of r.outlierIds) {
      const c = clauseById.get(outlierId);
      if (!c) continue;
      const sim = r.similarities[outlierId];
      await p.formFinding.create({
        data: {
          tenantId,
          companyId,
          workingSetId,
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
          traceRef: `cluster-run:${workingSetId}:${cluster.id}:outlier`,
        },
      });
    }
  }
  await p.formWorkingSet.update({
    where: { id: workingSetId },
    data: { clusterStatus: 'done', clusteredAt: new Date() },
  });
  return created;
}
