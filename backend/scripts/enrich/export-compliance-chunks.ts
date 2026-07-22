/**
 * Export the compliance register into per-chunk authoring inputs for the plan
 * rollout: one file per regulation (large regulations sliced into ≤8-item
 * chunks) plus a shared reference catalog of legal Role / Application names and
 * the exact generic template keys a pack may answer.
 *
 *   npx tsx --env-file=.env scripts/enrich/export-compliance-chunks.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../src/db/prisma.js';

const OUT = path.resolve(process.cwd(), 'scripts/output/compliance-chunks');
const CHUNK_SIZE = 8;

async function main() {
  await mkdir(OUT, { recursive: true });

  const [roles, apps, templates] = await Promise.all([
    prisma.role.findMany({ select: { displayValue: true }, orderBy: { displayValue: 'asc' } }),
    prisma.application.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
    prisma.workTemplate.findMany({
      where: {
        name: { in: ['Regulation compliance checklist', 'Regulation verification testing'] },
      },
      include: { keys: { orderBy: { sortOrder: 'asc' } } },
    }),
  ]);
  await writeFile(
    path.join(OUT, '_refs.json'),
    JSON.stringify(
      {
        roles: roles.map((r) => r.displayValue),
        applications: apps.map((a) => a.name),
        templates: templates.map((t) => ({
          name: t.name,
          kind: t.kind,
          keys: t.keys.map((k) => ({ key: k.key, valueKind: k.valueKind })),
        })),
      },
      null,
      2,
    ),
  );

  const regs = await prisma.complianceRegulation.findMany({
    orderBy: { regCode: 'asc' },
    include: { items: { orderBy: { itemCode: 'asc' } } },
  });

  const chunks: { id: string; regCode: string; items: number }[] = [];
  for (const reg of regs) {
    for (let i = 0; i < reg.items.length; i += CHUNK_SIZE) {
      const slice = reg.items.slice(i, i + CHUNK_SIZE);
      const part = Math.floor(i / CHUNK_SIZE) + 1;
      const id = reg.items.length > CHUNK_SIZE ? `${reg.regCode}-p${part}` : reg.regCode;
      await writeFile(
        path.join(OUT, `${id}.json`),
        JSON.stringify(
          {
            chunkId: id,
            regulation: {
              regCode: reg.regCode,
              name: reg.name,
              category: reg.category,
              lineOfBusiness: reg.lineOfBusiness,
              jurisdictionScope: reg.jurisdictionScope,
              ownerTeam: reg.ownerTeam,
              frequency: reg.frequency,
              evidenceRequired: reg.evidenceRequired,
              representativeRequirement: reg.representativeRequirement,
              sampleCitations: reg.sampleCitations,
            },
            items: slice.map((it) => ({
              itemCode: it.itemCode,
              name: it.name,
              ownerTeam: it.ownerTeam,
              frequency: it.frequency,
              evidence: it.evidence,
              jurisdictionScope: it.jurisdictionScope,
              representativeRequirement: it.representativeRequirement,
              repJurisdiction: it.repJurisdiction,
              supportingCitations: it.supportingCitations,
              frequencyDerived: it.frequencyDerived,
              deadlineSignals: it.deadlineSignals,
            })),
          },
          null,
          2,
        ),
      );
      chunks.push({ id, regCode: reg.regCode, items: slice.length });
    }
  }

  await writeFile(path.join(OUT, '_index.json'), JSON.stringify(chunks, null, 2));
  console.log(
    `chunks=${chunks.length} items=${chunks.reduce((n, c) => n + c.items, 0)} roles=${roles.length} apps=${apps.length}`,
  );
}

main().finally(() => prisma.$disconnect());
