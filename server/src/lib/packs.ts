/**
 * Content packs — the crowdsourced commodity. A pack is a versioned, portable
 * JSON bundle of underwriting content (appetite statements, guideline rules,
 * authority grant templates, enrichment sources) that any company can export,
 * share, and import. Grant templates name a role by LABEL and resolve against
 * the importing company's Roles catalog at apply time (authority stays
 * data-bound to roles, never user ids — ADR-03).
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';

const LOBS = ['CP', 'EB', 'GL', 'BOP', 'OM', 'XS', 'WC'] as const;

export const packSchema = z.object({
  packFormat: z.literal(1),
  name: z.string().min(3).max(80),
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(10).max(500),
  author: z.string().min(1).max(120),
  license: z.string().default('Apache-2.0'),
  lobs: z.array(z.enum(LOBS)).min(1),
  appetiteStatements: z
    .array(
      z.object({
        ref: z.string().regex(/^AS-\d{3}$/),
        stance: z.enum(['TARGET', 'ACCEPTABLE', 'REFER', 'DECLINE']),
        lob: z.enum(LOBS),
        segment: z.string().optional(),
        naicsCodes: z.string().regex(/^\d{4,6}(,\s*\d{4,6})*$/).optional(),
        geographies: z.string().max(200).optional(),
        tivMax: z.number().positive().optional(),
        capacityLimit: z.number().positive().optional(),
        rationale: z.string().min(20),
      }),
    )
    .default([]),
  guidelineRules: z
    .array(
      z.object({
        ref: z.string().regex(/^GR-\d{4}$/),
        name: z.string().min(3),
        kind: z.enum(['DECISION_TABLE', 'EXPRESSION']).default('DECISION_TABLE'),
        definition: z.object({ rows: z.array(z.record(z.unknown())).min(1) }),
        inputsSchema: z.record(z.string()).optional(),
      }),
    )
    .default([]),
  authorityGrantTemplates: z
    .array(
      z.object({
        ref: z.string().regex(/^AG-\d{2,3}$/),
        roleLabel: z.string().min(2), // resolved against the importing company's Roles catalog
        premiumMax: z.number().positive(),
        tivMax: z.number().positive(),
        lineSize: z.number().positive().optional(),
        lobs: z.string().min(2),
        territories: z.string().min(1),
        delegable: z.boolean().default(false),
      }),
    )
    .default([]),
  enrichmentSources: z
    .array(
      z.object({
        name: z.string().min(2),
        kind: z.enum(['HAZARD', 'FIRMOGRAPHIC', 'GEOCODE', 'CAT_MODEL', 'LOSS_HISTORY', 'SANCTIONS']),
        costClass: z.enum(['FREE', 'LOW', 'MEDIUM', 'HIGH']).default('LOW'),
        ttlHours: z.number().int().positive().default(720),
        jurisdictions: z.string().optional(),
      }),
    )
    .default([]),
});

export type Pack = z.infer<typeof packSchema>;

export type PackApplyResult = {
  appetiteStatements: number;
  guidelineRules: number;
  authorityGrants: number;
  enrichmentSources: number;
  unresolvedRoles: string[];
};

// Apply a pack to a company. Idempotent per artifact ref: an existing ACTIVE
// artifact with the same ref is superseded and re-published as version+1 —
// imports follow the same never-mutate versioning discipline as the UI (INV-3).
export async function applyPack(
  prisma: PrismaClient,
  ctx: { tenantId: string; companyId: string; actor: string },
  pack: Pack,
): Promise<PackApplyResult> {
  const { tenantId, companyId } = ctx;
  const result: PackApplyResult = { appetiteStatements: 0, guidelineRules: 0, authorityGrants: 0, enrichmentSources: 0, unresolvedRoles: [] };

  const nextVersion = async (table: 'appetite' | 'rule' | 'grant', ref: string): Promise<number> => {
    if (table === 'appetite') {
      const prior = await prisma.uwAppetiteStatement.findFirst({ where: { companyId, ref }, orderBy: { version: 'desc' } });
      if (prior) await prisma.uwAppetiteStatement.updateMany({ where: { companyId, ref, status: 'ACTIVE' }, data: { status: 'SUPERSEDED' } });
      return (prior?.version ?? 0) + 1;
    }
    if (table === 'rule') {
      const prior = await prisma.uwGuidelineRule.findFirst({ where: { companyId, ref }, orderBy: { version: 'desc' } });
      if (prior) await prisma.uwGuidelineRule.updateMany({ where: { companyId, ref, status: 'ACTIVE' }, data: { status: 'SUPERSEDED' } });
      return (prior?.version ?? 0) + 1;
    }
    const prior = await prisma.uwAuthorityGrant.findFirst({ where: { companyId, ref }, orderBy: { version: 'desc' } });
    if (prior) await prisma.uwAuthorityGrant.updateMany({ where: { companyId, ref, status: 'ACTIVE' }, data: { status: 'SUPERSEDED' } });
    return (prior?.version ?? 0) + 1;
  };

  for (const s of pack.appetiteStatements) {
    const version = await nextVersion('appetite', s.ref);
    await prisma.uwAppetiteStatement.create({
      data: {
        tenantId, companyId, ref: s.ref, version, stance: s.stance, lob: s.lob, segment: s.segment,
        naicsCodes: s.naicsCodes, geographies: s.geographies, tivMax: s.tivMax, capacityLimit: s.capacityLimit,
        effectiveFrom: new Date(), rationale: s.rationale, status: 'ACTIVE', publishedBy: `pack:${pack.slug}@${pack.version}`,
      },
    });
    result.appetiteStatements++;
  }

  for (const r of pack.guidelineRules) {
    const version = await nextVersion('rule', r.ref);
    await prisma.uwGuidelineRule.create({
      data: {
        tenantId, companyId, ref: r.ref, version, name: r.name, kind: r.kind,
        definition: r.definition as Prisma.InputJsonValue,
        inputsSchema: r.inputsSchema as Prisma.InputJsonValue | undefined,
        status: 'ACTIVE',
      },
    });
    result.guidelineRules++;
  }

  for (const g of pack.authorityGrantTemplates) {
    const role = await prisma.role.findFirst({
      where: { companyId, displayValue: { contains: g.roleLabel, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!role) {
      result.unresolvedRoles.push(g.roleLabel);
      continue; // never invent a role — authority binds to the real catalog (ADR-03)
    }
    const version = await nextVersion('grant', g.ref);
    await prisma.uwAuthorityGrant.create({
      data: {
        tenantId, companyId, ref: g.ref, version, roleId: role.id, premiumMax: g.premiumMax, tivMax: g.tivMax,
        lineSize: g.lineSize, lobs: g.lobs, territories: g.territories, delegable: g.delegable,
        bordereauxAttached: false, status: 'ACTIVE',
      },
    });
    result.authorityGrants++;
  }

  for (const src of pack.enrichmentSources) {
    await prisma.uwEnrichmentSource.upsert({
      where: { companyId_name: { companyId, name: src.name } },
      update: { kind: src.kind, costClass: src.costClass, ttlHours: src.ttlHours, jurisdictions: src.jurisdictions ?? null },
      create: { tenantId, companyId, name: src.name, kind: src.kind, costClass: src.costClass, ttlHours: src.ttlHours, jurisdictions: src.jurisdictions ?? null },
    });
    result.enrichmentSources++;
  }

  return result;
}

// Export a company's ACTIVE underwriting estate as a shareable pack.
export async function exportPack(
  prisma: PrismaClient,
  companyId: string,
  meta: { name: string; slug: string; version: string; description: string; author: string },
): Promise<Pack> {
  const [statements, rules, grants, sources] = await Promise.all([
    prisma.uwAppetiteStatement.findMany({ where: { companyId, status: 'ACTIVE' } }),
    prisma.uwGuidelineRule.findMany({ where: { companyId, status: 'ACTIVE' } }),
    prisma.uwAuthorityGrant.findMany({ where: { companyId, status: 'ACTIVE' }, include: { role: { select: { displayValue: true } } } }),
    prisma.uwEnrichmentSource.findMany({ where: { companyId, active: true } }),
  ]);
  const lobs = [...new Set(statements.map((s) => s.lob))];
  return packSchema.parse({
    packFormat: 1,
    ...meta,
    license: 'Apache-2.0',
    lobs: lobs.length ? lobs : ['CP'],
    appetiteStatements: statements.map((s) => ({
      ref: s.ref, stance: s.stance, lob: s.lob, segment: s.segment ?? undefined,
      naicsCodes: s.naicsCodes ?? undefined, geographies: s.geographies ?? undefined,
      tivMax: s.tivMax ?? undefined, capacityLimit: s.capacityLimit ?? undefined, rationale: s.rationale,
    })),
    guidelineRules: rules.map((r) => ({
      ref: r.ref, name: r.name, kind: r.kind,
      definition: r.definition as { rows: Record<string, unknown>[] },
      inputsSchema: (r.inputsSchema ?? undefined) as Record<string, string> | undefined,
    })),
    authorityGrantTemplates: grants.map((g) => ({
      ref: g.ref, roleLabel: g.role.displayValue, premiumMax: g.premiumMax, tivMax: g.tivMax,
      lineSize: g.lineSize ?? undefined, lobs: g.lobs, territories: g.territories, delegable: g.delegable,
    })),
    enrichmentSources: sources.map((s) => ({
      name: s.name, kind: s.kind, costClass: s.costClass, ttlHours: s.ttlHours, jurisdictions: s.jurisdictions ?? undefined,
    })),
  });
}
