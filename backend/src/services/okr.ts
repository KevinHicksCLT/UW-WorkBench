import { prisma } from '../db/prisma.js';

/**
 * Recompute KPI achievement based on currentValue, startingValue, target, and direction.
 */
export async function recomputeKpi(kpiId: string) {
  const kpi = await prisma.kpi.findUnique({ where: { id: kpiId } });
  if (!kpi) return null;

  const range = kpi.targetValue - kpi.startingValue;
  let achievement = 0;
  if (range !== 0) {
    if (kpi.direction === 'MAX') {
      achievement = (kpi.currentValue - kpi.startingValue) / range;
    } else {
      // MIN — lower is better; invert
      achievement = (kpi.startingValue - kpi.currentValue) / -range;
    }
  } else if (kpi.currentValue >= kpi.targetValue) {
    achievement = 1;
  }
  achievement = Math.max(0, Math.min(1, achievement));

  return prisma.kpi.update({
    where: { id: kpiId },
    data: { achievement },
  });
}

/**
 * Recompute objective achievement as the weighted average of its KPIs' achievements.
 * Then propagate up the parent chain.
 */
export async function recomputeObjective(objectiveId: string) {
  const obj = await prisma.strategicObjective.findUnique({
    where: { id: objectiveId },
    include: { kpis: true, children: true },
  });
  if (!obj) return null;

  // Recompute each KPI first
  for (const k of obj.kpis) {
    await recomputeKpi(k.id);
  }
  const fresh = await prisma.kpi.findMany({ where: { objectiveId } });

  // Weighted average of KPI achievement
  let kpiSum = 0;
  let weightSum = 0;
  for (const k of fresh) {
    kpiSum += k.achievement * k.weight;
    weightSum += k.weight;
  }
  const kpiAchievement = weightSum > 0 ? kpiSum / weightSum : 0;

  // If this objective has children, also fold their achievement into the score
  let childAchievement: number | null = null;
  if (obj.children.length > 0) {
    let cs = 0;
    for (const c of obj.children) {
      const recomputed = await recomputeObjective(c.id);
      cs += recomputed?.achievement ?? 0;
    }
    childAchievement = cs / obj.children.length;
  }

  // Composite: 50/50 if both, otherwise whichever exists
  let achievement = kpiAchievement;
  if (childAchievement !== null && fresh.length > 0) {
    achievement = (kpiAchievement + childAchievement) / 2;
  } else if (childAchievement !== null) {
    achievement = childAchievement;
  }

  return prisma.strategicObjective.update({
    where: { id: objectiveId },
    data: { achievement },
  });
}
