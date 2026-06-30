// linkNames — generic batched id → display-string resolver. Turns FK ids
// (valueStreamNodeId, orgUnitId, ownerRoleId, applicationId …) into the display
// strings the frontend wants, so routes no longer store denormalized name copies.
// Generalizes the ad-hoc id→name Maps the portfolio/work/regulations routes built.
//
// ProcessNode / OrgUnit / Role expose the editable `displayValue`; catalog
// entities (Application) expose a canonical `name`.
import type { PrismaClient } from '@prisma/client';

export type LinkModel = 'processNode' | 'orgUnit' | 'role' | 'application';

/** Map<id, name> for the given ids in `model`. Missing/null ids are skipped. */
export async function linkNames(
  prisma: PrismaClient,
  ids: (string | null | undefined)[],
  model: LinkModel,
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, string>();
  if (!unique.length) return out;

  // Narrow per-delegate selects keep Prisma's typing intact; each branch yields
  // [id, name] pairs that fill the shared Map.
  let pairs: [string, string | null][];
  switch (model) {
    case 'processNode': {
      const rows = await prisma.processNode.findMany({ where: { id: { in: unique } }, select: { id: true, displayValue: true } });
      pairs = rows.map((r) => [r.id, r.displayValue]);
      break;
    }
    case 'orgUnit': {
      const rows = await prisma.orgUnit.findMany({ where: { id: { in: unique } }, select: { id: true, displayValue: true } });
      pairs = rows.map((r) => [r.id, r.displayValue]);
      break;
    }
    case 'role': {
      const rows = await prisma.role.findMany({ where: { id: { in: unique } }, select: { id: true, displayValue: true } });
      pairs = rows.map((r) => [r.id, r.displayValue]);
      break;
    }
    case 'application': {
      const rows = await prisma.application.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
      pairs = rows.map((r) => [r.id, r.name]);
      break;
    }
  }
  for (const [id, name] of pairs) if (name != null) out.set(id, name);
  return out;
}
