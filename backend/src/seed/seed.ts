// erd_v5 seed orchestrator (Phase 4).
//
// 1. Upsert the strata tenant + admin user (kevin.hicks@capgemini.com / demo1234).
// 2. seedMaster — wipes + recreates the company and loads the MASTER spine
//    (ProcessNode tree 3/17/135/867/3811, OrgUnit, 257 Role, 65 Application,
//    Deliverable/Checklist/TestingTemplate + junctions + closures). seedMaster
//    creates the Company itself, so it runs FIRST.
// 3. Build resolveSpineRefs once → shared FK resolver for every peripheral.
// 4. Re-pointed peripherals, each writing real FK ids (misses counted + logged):
//    real-app TCO enrichment → deep levels (initiatives/KPIs/AI-adoption/analysis)
//    → external parties → telemetry → scenarios → rationalization → portfolio →
//    regulations.
//
// Idempotent: seedMaster deletes the company (FK-cascades through every child)
// and rebuilds; the peripherals each delete-then-recreate their own rows.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedMaster } from './seedMaster.js';
import { homeRoles } from './homeRoles.js';
import { seedOrgFromDevelop } from './seedOrgFromDevelop.js';
import { resolveSpineRefs } from './resolveSpineRefs.js';
import { seedRealApplications, seedDeepLevels, seedExternalParties } from './illustrative.js';
import { seedRationalization } from './rationalization.js';
import { seedPortfolio } from './portfolio.js';
import { seedRegulations } from './seedRegulations.js';
import { seedFederalRegs } from './seedFederalRegs.js';
import { seedStandards } from './seedStandards.js';
import { seedPermissions } from './seedPermissions.js';
import { seedApprovalPolicies } from './seedApprovalPolicies.js';
import { seedAnatomyCatalog } from './seedAnatomyCatalog.js';
import { seedWorkspaceVocabulary } from './seedWorkspaceVocabulary.js';
import { seedProductModelAnatomy } from './seedProductModelAnatomy.js';
import { seedProductModel } from './productModel.js';
import { seedRoleProfiles } from './seedRoleProfiles.js';
import { seedUwWorkbench } from './seedUwWorkbench.js';
import { decomposeSingleChild } from '../../scripts/decompose-single-child.js';

const prisma = new PrismaClient();
const here = dirname(fileURLToPath(import.meta.url));
const MASTER = resolve(here, '../../data/seed/master_v5.json');
const SPINE = resolve(here, '../../data/seed/spine.json');
const TELEMETRY = resolve(here, '../../data/telemetry-catalog.json');

// ── Telemetry signals (system-of-record catalog) ──
async function seedTelemetry(p: PrismaClient, ctx: { tenantId: string; companyId: string }) {
  await p.telemetrySignal.deleteMany({ where: { companyId: ctx.companyId } });
  const catalog: {
    name: string;
    origin: string | null;
    source: string | null;
    category: string | null;
    dataType: string | null;
    queryType: string | null;
    description: string | null;
  }[] = JSON.parse(readFileSync(TELEMETRY, 'utf8'));
  let sort = 100;
  const rows = catalog.map((m) => ({
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    kind: 'system',
    name: m.name,
    description: m.description,
    source: m.source,
    category: m.category,
    unit: m.dataType,
    frequency: null,
    direction: 'up',
    origin: m.origin,
    queryType: m.queryType,
    isLive: false,
    sortOrder: sort++,
  }));
  await p.telemetrySignal.createMany({ data: rows });
  console.log(`   + ${rows.length} telemetry signals`);
}

// ── Scenario inputs (change-impact economics) ──
async function seedScenarios(
  p: PrismaClient,
  ctx: { tenantId: string; companyId: string; refs: Awaited<ReturnType<typeof resolveSpineRefs>> },
) {
  await p.scenario.deleteMany({ where: { companyId: ctx.companyId } });
  const spine = JSON.parse(readFileSync(SPINE, 'utf8')) as {
    scenarios: {
      name: string;
      changeType: string | null;
      impactScope: string | null;
      divisionName: string | null;
      valueStreamName: string | null;
      application: string | null;
      roleImpact: string | null;
      oneTimeCost: number | null;
      annualBenefit: number | null;
      annualAddedCost: number | null;
      annualNetImpact: number | null;
      confidence: string | null;
    }[];
  };
  const rows = spine.scenarios.map((s) => ({
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    name: s.name,
    changeType: s.changeType,
    impactScope: s.impactScope,
    orgUnitId: ctx.refs.orgUnitByName(s.divisionName),
    processNodeId: ctx.refs.nodeByName(s.valueStreamName),
    application: s.application,
    roleImpact: s.roleImpact,
    oneTimeCost: s.oneTimeCost,
    annualBenefit: s.annualBenefit,
    annualAddedCost: s.annualAddedCost,
    annualNetImpact: s.annualNetImpact,
    confidence: s.confidence,
  }));
  await p.scenario.createMany({ data: rows });
  console.log(`   + ${rows.length} scenarios`);
}

async function main() {
  const m = JSON.parse(readFileSync(MASTER, 'utf8')) as {
    company: { dbValue: string; displayValue: string };
  };

  // ── Tenant + admin user (preserved across reseeds) ──
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'strata' },
    update: {},
    create: { name: 'Strata Demo', slug: 'strata' },
  });
  await prisma.user.upsert({
    where: { email: 'kevin.hicks@capgemini.com' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'kevin.hicks@capgemini.com',
      name: 'Kevin Hicks',
      password: await bcrypt.hash('demo1234', 10),
      role: 'SITE_ADMIN',
    },
  });

  // ── Greenfield single-company rebuild: drop + recreate the company graph ──
  await prisma.company.deleteMany({ where: { tenantId: tenant.id } });
  const company = await prisma.company.create({
    // Slug is seed-time configuration (charter Task 1): override per company
    // via SEED_COMPANY_SLUG; default preserves the demo company.
    data: {
      tenantId: tenant.id,
      name: m.company.displayValue,
      slug: process.env.SEED_COMPANY_SLUG ?? 'abc-insurance',
      dbValue: m.company.dbValue,
      displayValue: m.company.displayValue,
    },
  });
  const ctx = { tenantId: tenant.id, companyId: company.id };

  // ── 1. MASTER spine ──
  console.log('▶ seedMaster …');
  await seedMaster(prisma, ctx);

  // ── 1b. Role-homing backfill — needs NodeRole junctions + closures ──
  // homeRoles homes the 257 master roles to their modal L2 division. It runs FIRST
  // so seedOrgFromDevelop can use that division home as a fallback for any role
  // develop's explicit role→department assignment doesn't cover.
  console.log('▶ homeRoles …');
  await homeRoles(prisma, { companyId: company.id });

  // ── 1b-2. Department tier + role parity (develop → new generic OrgUnit tree) ──
  // Adds OrgLevelType L3 "Department" + an Executive Office L2 division, creates the
  // 99 develop departments as OrgUnit L3, brings the roster to 299 (42 imported),
  // homes EVERY role to its department (superseding the modal-division homing above),
  // and wires domain-clear imported roles to the value-stream spine. Idempotent.
  console.log('▶ seedOrgFromDevelop …');
  await seedOrgFromDevelop(prisma, { companyId: company.id });

  // ── 1b-3. Role profiles — research-sourced descriptions/family/level + homes
  // for roles still un-homed after develop import (soft-skips if the merged
  // role-profiles.json hasn't been generated yet). ──
  console.log('▶ seedRoleProfiles …');
  await seedRoleProfiles(prisma, { companyId: company.id });

  // ── 1c. Eliminate single-child L3/L4 parents (3 splits, +3 L4 → 4836) ──
  // Folded in so a single `npm run db:seed` reproduces the clean tree. Idempotent
  // (skips parents that already have ≥2 children). Runs BEFORE resolveSpineRefs so
  // the new L4 nodes are in the resolver. Deterministic split (no AI dependency in
  // the seed path) — the standalone script can still use Claude.
  console.log('▶ decomposeSingleChild …');
  await decomposeSingleChild(prisma, company.id, { noAi: true });

  // ── 2. Shared FK resolver ──
  const refs = await resolveSpineRefs(prisma, company.id);

  // ── 3. Peripherals (each re-pointed via refs) ──
  const tally: Record<string, number> = {};
  const run = async (label: string, fn: () => Promise<unknown>) => {
    console.log(`▶ ${label} …`);
    refs.resetMisses();
    await fn();
    tally[label] = refs.reportMisses(label);
  };

  await run('realApplications', () => seedRealApplications(prisma, { ...ctx, refs }));
  await run('deepLevels', () => seedDeepLevels(prisma, { ...ctx, refs }));
  await run('externalParties', () => seedExternalParties(prisma, { ...ctx, refs }));
  await run('telemetry', () => seedTelemetry(prisma, ctx));
  await run('scenarios', () => seedScenarios(prisma, { ...ctx, refs }));
  await run('rationalization', () => seedRationalization(prisma, { ...ctx, refs }));
  await run('anatomyCatalog', () => seedAnatomyCatalog(prisma, ctx));
  // Product Model Workspace (PM-02): vocabulary → anatomy → demo workspace
  // (the demo workspace links findings to anatomy rows by slug, so order matters).
  await run('workspaceVocabulary', () => seedWorkspaceVocabulary(prisma, ctx));
  await run('productModelAnatomy', () => seedProductModelAnatomy(prisma, ctx));
  await run('productModel', () => seedProductModel(prisma, { ...ctx, refs }));
  await run('portfolio', () => seedPortfolio(prisma, { ...ctx, refs }));
  await run('uwWorkbench', () => seedUwWorkbench(prisma, ctx));
  await run('regulations', () => seedRegulations(prisma, { ...ctx, refs }));
  await run('federalRegs', () => seedFederalRegs(prisma, { ...ctx, refs }));
  await run('standards', () => seedStandards(prisma, { ...ctx, refs }));
  // Runs AFTER the org spine exists: demo users + kevin are homed to L1 OrgUnits.
  await run('permissions', () => seedPermissions(prisma, ctx));
  await run('approvalPolicies', () => seedApprovalPolicies(prisma, { tenantId: ctx.tenantId }));

  // ── 4. Verify peripheral tables are non-empty + master counts intact ──
  const c = company.id;
  const counts = {
    processNode: await prisma.processNode.count({ where: { companyId: c } }),
    role: await prisma.role.count({ where: { companyId: c } }),
    application: await prisma.application.count({ where: { companyId: c } }),
    program: await prisma.program.count({ where: { companyId: c } }),
    workstream: await prisma.workstream.count({ where: { companyId: c } }),
    portfolioInitiative: await prisma.portfolioInitiative.count({ where: { companyId: c } }),
    benefitLine: await prisma.benefitLine.count({ where: { initiative: { companyId: c } } }),
    raidItem: await prisma.raidItem.count({ where: { initiative: { companyId: c } } }),
    initiativeResource: await prisma.initiativeResource.count({
      where: { initiative: { companyId: c } },
    }),
    strategicObjective: await prisma.strategicObjective.count({ where: { companyId: c } }),
    riskScoringBand: await prisma.riskScoringBand.count({ where: { companyId: c } }),
    jurisdiction: await prisma.jurisdiction.count({ where: { companyId: c } }),
    regulatoryRequirement: await prisma.regulatoryRequirement.count({ where: { companyId: c } }),
    nodeRegulation: await prisma.nodeRegulation.count({ where: { companyId: c } }),
    standard: await prisma.standard.count({ where: { companyId: c } }),
    rationalizationWorkspace: await prisma.rationalizationWorkspace.count({
      where: { companyId: c },
    }),
    normalizationEntry: await prisma.normalizationEntry.count({ where: { companyId: c } }),
    workspaceVocabulary: await prisma.workspaceVocabulary.count({ where: { companyId: c } }),
    productModelAnatomyCategory: await prisma.productModelAnatomyCategory.count({
      where: { companyId: c },
    }),
    productModelWorkspace: await prisma.productModelWorkspace.count({ where: { companyId: c } }),
    productModelFinding: await prisma.productModelFinding.count({ where: { companyId: c } }),
    scenario: await prisma.scenario.count({ where: { companyId: c } }),
    telemetrySignal: await prisma.telemetrySignal.count({ where: { companyId: c } }),
    nodeAiAdoption: await prisma.nodeAiAdoption.count({ where: { processNode: { companyId: c } } }),
    externalParty: await prisma.externalParty.count({ where: { companyId: c } }),
    externalInteraction: await prisma.externalInteraction.count({
      where: { externalParty: { companyId: c } },
    }),
    metric: await prisma.metric.count({ where: { companyId: c } }),
    initiative: await prisma.initiative.count({ where: { companyId: c } }),
    analysisStatus: await prisma.analysisStatus.count({ where: { companyId: c } }),
  };

  console.log('\n── Peripheral verification ──');
  const mustBePositive = Object.entries(counts).filter(
    ([k]) => !['processNode', 'role', 'application'].includes(k),
  );
  // Role roster is now at develop/prod parity (257 master + 42 imported = 299).
  let allOk = counts.processNode === 4836 && counts.role === 299;
  for (const [k, v] of Object.entries(counts)) {
    const positive = mustBePositive.find(([mk]) => mk === k);
    const mark = positive ? (v > 0 ? 'OK' : 'XX') : '  ';
    if (positive && v === 0) allOk = false;
    console.log(`${mark}  ${k.padEnd(26)} ${String(v).padStart(7)}`);
  }
  console.log(
    `${counts.processNode === 4836 ? 'OK' : 'XX'}  ProcessNode == 4836 (master 4833 + 3 decomposed L4)`,
  );

  console.log('\n── Unresolved FK references per seeder ──');
  for (const [k, v] of Object.entries(tally)) console.log(`   ${k.padEnd(20)} ${v}`);

  console.log(
    allOk
      ? '\n✅ Seed complete — all peripheral tables populated.'
      : '\n⚠ Some peripheral tables are empty — see XX above.',
  );
  console.log('   Login: kevin.hicks@capgemini.com / demo1234');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().then(() => process.exit(1));
  });
