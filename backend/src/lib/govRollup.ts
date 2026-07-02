import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';

// Governance rollups — standards/regulations live ONLY on task ProcessNodes
// (single source of truth at the atomic grain). Every higher-level view
// (value stream, L2/L3 container, Standards/Regulations tabs, skill packs)
// derives from the task links through the closure. Nothing is stored upward.

export type VsRef = { id: string; name: string; domain: string | null };

// Distinct L2 value streams (with their L1 domain) whose tasks apply each standard.
export async function vsForStandards(standardIds: string[]): Promise<Map<string, VsRef[]>> {
  const map = new Map<string, VsRef[]>();
  if (!standardIds.length) return map;
  const rows = await prisma.$queryRaw<{ eid: string; id: string; name: string; domain: string | null }[]>(Prisma.sql`
    SELECT ns."standardId" AS eid, vs.id, vs."displayValue" AS name, dom."displayValue" AS domain
    FROM public."NodeStandard" ns
    JOIN public."ProcessNodeClosure" c ON c."descendantId" = ns."processNodeId"
    JOIN public."ProcessNode" vs ON vs.id = c."ancestorId"
    JOIN public."ProcessLevelType" plt ON plt.id = vs."processLevelTypeId" AND plt."levelNumber" = 2
    LEFT JOIN public."ProcessNode" dom ON dom.id = vs."parentId"
    WHERE ns."standardId" IN (${Prisma.join(standardIds)}) AND NOT ns.excluded
    GROUP BY 1, 2, 3, 4
    ORDER BY 3`);
  for (const r of rows) {
    (map.get(r.eid) ?? map.set(r.eid, []).get(r.eid)!).push({ id: r.id, name: r.name, domain: r.domain });
  }
  return map;
}

export async function vsForRegulations(regIds: string[]): Promise<Map<string, VsRef[]>> {
  const map = new Map<string, VsRef[]>();
  if (!regIds.length) return map;
  const rows = await prisma.$queryRaw<{ eid: string; id: string; name: string; domain: string | null }[]>(Prisma.sql`
    SELECT nr."regId" AS eid, vs.id, vs."displayValue" AS name, dom."displayValue" AS domain
    FROM public."NodeRegulation" nr
    JOIN public."ProcessNodeClosure" c ON c."descendantId" = nr."processNodeId"
    JOIN public."ProcessNode" vs ON vs.id = c."ancestorId"
    JOIN public."ProcessLevelType" plt ON plt.id = vs."processLevelTypeId" AND plt."levelNumber" = 2
    LEFT JOIN public."ProcessNode" dom ON dom.id = vs."parentId"
    WHERE nr."regId" IN (${Prisma.join(regIds)}) AND NOT nr.excluded
    GROUP BY 1, 2, 3, 4
    ORDER BY 3`);
  for (const r of rows) {
    (map.get(r.eid) ?? map.set(r.eid, []).get(r.eid)!).push({ id: r.id, name: r.name, domain: r.domain });
  }
  return map;
}

// Distinct standards applied by tasks anywhere under a subtree root (incl. self).
export async function subtreeStandards(rootId: string): Promise<{ standardId: string; name: string }[]> {
  return prisma.$queryRaw<{ standardId: string; name: string }[]>(Prisma.sql`
    SELECT DISTINCT ns."standardId" AS "standardId", s.name
    FROM public."ProcessNodeClosure" c
    JOIN public."NodeStandard" ns ON ns."processNodeId" = c."descendantId" AND NOT ns.excluded
    JOIN public."Standard" s ON s.id = ns."standardId"
    WHERE c."ancestorId" = ${rootId}
    ORDER BY s.name`);
}

export async function subtreeRegulations(rootId: string): Promise<{ regId: string; title: string }[]> {
  return prisma.$queryRaw<{ regId: string; title: string }[]>(Prisma.sql`
    SELECT DISTINCT nr."regId" AS "regId", r.title
    FROM public."ProcessNodeClosure" c
    JOIN public."NodeRegulation" nr ON nr."processNodeId" = c."descendantId" AND NOT nr.excluded
    JOIN public."RegulatoryRequirement" r ON r.id = nr."regId"
    WHERE c."ancestorId" = ${rootId}
    ORDER BY r.title`);
}
