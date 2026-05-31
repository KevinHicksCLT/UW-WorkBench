import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';

/**
 * Sum metric values for a given line item + dataset.
 * Defaults to ACTUAL if dataset not specified.
 */
async function sumMetricValues({
  benefitLineId,
  costLineId,
  dataset = 'ACTUAL',
}: {
  benefitLineId?: string;
  costLineId?: string;
  dataset?: string;
}) {
  const where: Prisma.MetricValueWhereInput = { dataset };
  if (benefitLineId) where.benefitLineId = benefitLineId;
  if (costLineId) where.costLineId = costLineId;

  const result = await prisma.metricValue.aggregate({
    where,
    _sum: { amount: true },
  });
  return result._sum.amount || 0;
}

/**
 * Recompute initiative-level cumulative figures.
 * Strategy: for cumulative we use ACTUAL where present, fall back to FORECAST,
 * and use TARGET as the planned value for variance display.
 */
export async function recomputeInitiative(initiativeId: string) {
  const initiative = await prisma.initiative.findUnique({
    where: { id: initiativeId },
    include: {
      benefits: { include: { values: true } },
      costs: { include: { values: true } },
      objectiveLinks: true,
    },
  });
  if (!initiative) return null;

  const today = new Date();

  // Sum benefits (Actual + Forecast for periods after today)
  let cumulativeBenefit = 0;
  for (const b of initiative.benefits) {
    for (const v of b.values) {
      if (v.dataset === 'ACTUAL' || (v.dataset === 'FORECAST' && v.periodStart > today)) {
        cumulativeBenefit += v.amount;
      }
    }
  }

  let cumulativeCost = 0;
  for (const c of initiative.costs) {
    for (const v of c.values) {
      if (v.dataset === 'ACTUAL' || (v.dataset === 'FORECAST' && v.periodStart > today)) {
        cumulativeCost += v.amount;
      }
    }
  }

  // Value score: weighted sum of objective alignment (LOW=1, MED=2, HIGH=3)
  const impactWeight: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
  const valueScore = initiative.objectiveLinks.reduce(
    (acc, link) => acc + (impactWeight[link.impact] || 0),
    0
  );

  const updated = await prisma.initiative.update({
    where: { id: initiativeId },
    data: {
      cumulativeBenefit,
      cumulativeCost,
      cumulativeNetBenefit: cumulativeBenefit - cumulativeCost,
      valueScore,
    },
  });
  return updated;
}

/**
 * Roll up all initiatives in a workstream by recomputing each.
 */
export async function recomputeWorkstream(workstreamId: string) {
  const initiatives = await prisma.initiative.findMany({
    where: { workstreamId },
    select: { id: true },
  });
  for (const init of initiatives) {
    await recomputeInitiative(init.id);
  }
}

/**
 * Aggregate for a program: produce on-the-fly summary (no denormalization at program level
 * to keep the model simple — read-time aggregation is fine for MVP scale).
 */
export async function summarizeProgram(programId: string) {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      workstreams: {
        include: {
          initiatives: true,
        },
      },
    },
  });
  if (!program) return null;

  const initiatives = program.workstreams.flatMap((w) => w.initiatives);
  const totalBenefit = initiatives.reduce((a, i) => a + i.cumulativeBenefit, 0);
  const totalCost = initiatives.reduce((a, i) => a + i.cumulativeCost, 0);
  const netBenefit = totalBenefit - totalCost;

  const stageDist = initiatives.reduce<Record<string, number>>((acc, i) => {
    acc[i.stage] = (acc[i.stage] || 0) + 1;
    return acc;
  }, {});

  const statusDist = initiatives.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  return {
    programId: program.id,
    name: program.name,
    initiativeCount: initiatives.length,
    totalBenefit,
    totalCost,
    netBenefit,
    stageDistribution: stageDist,
    statusDistribution: statusDist,
  };
}
