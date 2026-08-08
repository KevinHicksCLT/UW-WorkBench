/**
 * Self-service company provisioning — the democratization path. One call takes
 * a company name + admin identity and stands up a complete underwriting
 * operation: tenant, company, org units, a Roles-catalog escalation chain
 * (Underwriter → Senior Underwriter → Chief Underwriting Officer), a PAS
 * bind target, the underwriting value stream, and (optionally) a starter
 * content pack — so a brand-new carrier or MGA is triaging in minutes.
 */
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { applyPack, type Pack, type PackApplyResult } from '../lib/packs.js';

export type ProvisionInput = {
  companyName: string;
  adminEmail: string;
  adminName: string;
  password: string;
  starterPack?: Pack;
};

export type ProvisionResult = {
  tenantId: string;
  companyId: string;
  userId: string;
  roles: { underwriter: string; senior: string; cuo: string };
  packResult: PackApplyResult | null;
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'company';

export async function provisionCompany(prisma: PrismaClient, input: ProvisionInput): Promise<ProvisionResult> {
  const baseSlug = slugify(input.companyName);
  let slug = baseSlug;
  for (let i = 2; await prisma.tenant.findFirst({ where: { slug } }); i++) slug = `${baseSlug}-${i}`;

  const tenant = await prisma.tenant.create({ data: { name: input.companyName, slug } });
  const company = await prisma.company.create({
    data: { tenantId: tenant.id, name: input.companyName, slug },
  });

  const uwOps = await prisma.orgUnit.create({ data: { companyId: company.id, displayValue: 'Underwriting', sortOrder: 0 } });

  // Roles catalog with a real escalation chain — referrals derive from this,
  // and authority grants bind to it (ADR-03).
  const cuo = await prisma.role.create({ data: { companyId: company.id, displayValue: 'Chief Underwriting Officer', orgUnitId: uwOps.id } });
  const senior = await prisma.role.create({ data: { companyId: company.id, displayValue: 'Senior Underwriter', orgUnitId: uwOps.id, managerRoleId: cuo.id } });
  const underwriter = await prisma.role.create({ data: { companyId: company.id, displayValue: 'Underwriter', orgUnitId: uwOps.id, managerRoleId: senior.id } });
  await prisma.role.create({ data: { companyId: company.id, displayValue: 'Compliance Officer', orgUnitId: uwOps.id, managerRoleId: cuo.id } });

  await prisma.processNode.create({ data: { companyId: company.id, displayValue: 'Underwrite Risk (Submission to Bind)' } });
  await prisma.application.create({ data: { companyId: company.id, name: 'Policy Administration System', kind: 'SystemOfRecord' } });

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: input.adminEmail.toLowerCase(),
      name: input.adminName,
      password: await bcrypt.hash(input.password, 10),
      role: 'ADMIN',
      operatingRoleId: cuo.id, // founders start in the CUO seat
    },
  });

  let packResult: PackApplyResult | null = null;
  if (input.starterPack) {
    packResult = await applyPack(prisma, { tenantId: tenant.id, companyId: company.id, actor: user.email }, input.starterPack);
  }

  await prisma.uwGovernanceEvent.create({
    data: {
      tenantId: tenant.id,
      companyId: company.id,
      eventType: 'AgentControl',
      actorKind: 'SYSTEM',
      actorId: 'provisioning-service',
      payloadHash: 'genesis',
      payload: { provisioned: input.companyName, starterPack: input.starterPack ? `${input.starterPack.slug}@${input.starterPack.version}` : null },
      correlationId: company.id,
    },
  });

  return {
    tenantId: tenant.id,
    companyId: company.id,
    userId: user.id,
    roles: { underwriter: underwriter.id, senior: senior.id, cuo: cuo.id },
    packResult,
  };
}
