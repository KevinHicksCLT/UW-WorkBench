import { prisma } from '../db/prisma.js';

// Initiative-tracker rollups. recomputeInitiative() refreshes the denormalized
// cumulativeBenefit/Cost/NetBenefit on a PortfolioInitiative from its time-phased
// MetricValue rows (ACTUAL, plus FORECAST for future periods). summarizeProgram()
// aggregates read-time across a program's initiatives. Mirrors Cascade's rollup
// service, minus the OKR value-score (objectives are out of scope here).

export async function recomputeInitiative(initiativeId: string) {
  const initiative = await prisma.portfolioInitiative.findUnique({
    where: { id: initiativeId },
    include: {
      benefits: { include: { values: true } },
      costs: { include: { values: true } },
    },
  });
  if (!initiative) return null;

  const today = new Date();
  const accumulate = (lines: { values: { dataset: string; periodStart: Date; amount: number }[] }[]) => {
    let total = 0;
    for (const line of lines) {
      for (const v of line.values) {
        if (v.dataset === 'ACTUAL' || (v.dataset === 'FORECAST' && v.periodStart > today)) {
          total += v.amount;
        }
      }
    }
    return total;
  };

  const cumulativeBenefit = accumulate(initiative.benefits);
  const cumulativeCost = accumulate(initiative.costs);

  return prisma.portfolioInitiative.update({
    where: { id: initiativeId },
    data: {
      cumulativeBenefit,
      cumulativeCost,
      cumulativeNetBenefit: cumulativeBenefit - cumulativeCost,
    },
  });
}

export async function summarizeProgram(programId: string) {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: { workstreams: { include: { initiatives: true } } },
  });
  if (!program) return null;

  const initiatives = program.workstreams.flatMap((w) => w.initiatives);
  const totalBenefit = initiatives.reduce((a, i) => a + i.cumulativeBenefit, 0);
  const totalCost = initiatives.reduce((a, i) => a + i.cumulativeCost, 0);

  const tally = (key: 'stage' | 'status') =>
    initiatives.reduce<Record<string, number>>((acc, i) => {
      acc[i[key]] = (acc[i[key]] || 0) + 1;
      return acc;
    }, {});

  return {
    programId: program.id,
    name: program.name,
    initiativeCount: initiatives.length,
    totalBenefit,
    totalCost,
    netBenefit: totalBenefit - totalCost,
    stageDistribution: tally('stage'),
    statusDistribution: tally('status'),
  };
}
