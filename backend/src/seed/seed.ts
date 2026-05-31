import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addMonths, startOfMonth } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  if (process.env.SEED_FORCE !== '1') {
    const existing = await prisma.user.count().catch(() => 0);
    if (existing > 0) {
      console.log(`Seed skipped — ${existing} users already in DB. Set SEED_FORCE=1 to overwrite.`);
      return;
    }
  }

  console.log('Seeding demo tenant...');

  // Wipe in dependency-safe order
  await prisma.metricValue.deleteMany();
  await prisma.benefitLine.deleteMany();
  await prisma.costLine.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.raidItem.deleteMany();
  await prisma.initiativeObjective.deleteMany();
  await prisma.initiativeKpi.deleteMany();
  await prisma.kpi.deleteMany();
  await prisma.strategicObjective.deleteMany();
  await prisma.initiative.deleteMany();
  await prisma.workstream.deleteMany();
  await prisma.program.deleteMany();
  await prisma.businessRule.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditEntry.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: { name: 'Acme Industries', slug: 'acme' },
  });

  const passwordHash = await bcrypt.hash('demo1234', 10);
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'demo@cascade.io',
      name: 'Dana Chen',
      password: passwordHash,
      role: 'ADMIN',
    },
  });

  const sponsor = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'sponsor@cascade.io',
      name: 'Marcus Reed',
      password: passwordHash,
      role: 'MANAGER',
    },
  });

  const owner1 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'priya@cascade.io',
      name: 'Priya Patel',
      password: passwordHash,
      role: 'MEMBER',
    },
  });

  const owner2 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'jamal@cascade.io',
      name: 'Jamal Rivera',
      password: passwordHash,
      role: 'MEMBER',
    },
  });

  // ── Strategic Objectives ──
  const objGrowth = await prisma.strategicObjective.create({
    data: {
      tenantId: tenant.id,
      name: 'Accelerate Profitable Growth',
      description: 'Grow revenue 20% YoY while expanding gross margin',
      ownerName: 'CEO Office',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    },
  });
  const objCost = await prisma.strategicObjective.create({
    data: {
      tenantId: tenant.id,
      name: 'Drive Cost Transformation',
      description: 'Remove $50M of run-rate cost across operations',
      ownerName: 'CFO Office',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    },
  });
  const objCustomer = await prisma.strategicObjective.create({
    data: {
      tenantId: tenant.id,
      name: 'Improve Customer Experience',
      description: 'Lift NPS from 42 to 60 and reduce churn 30%',
      ownerName: 'Chief Customer Officer',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    },
  });

  // ── KPIs ──
  await prisma.kpi.createMany({
    data: [
      {
        tenantId: tenant.id, objectiveId: objGrowth.id, name: 'Annual Revenue ($M)',
        unit: 'CURRENCY', direction: 'MAX', weight: 1.0,
        startingValue: 850, targetValue: 1020, currentValue: 920, achievement: 0.41,
      },
      {
        tenantId: tenant.id, objectiveId: objGrowth.id, name: 'Gross Margin %',
        unit: 'PERCENT', direction: 'MAX', weight: 0.8,
        startingValue: 38, targetValue: 44, currentValue: 41, achievement: 0.5,
      },
      {
        tenantId: tenant.id, objectiveId: objCost.id, name: 'Run-rate Savings ($M)',
        unit: 'CURRENCY', direction: 'MAX', weight: 1.0,
        startingValue: 0, targetValue: 50, currentValue: 22, achievement: 0.44,
      },
      {
        tenantId: tenant.id, objectiveId: objCost.id, name: 'COGS % of Revenue',
        unit: 'PERCENT', direction: 'MIN', weight: 0.7,
        startingValue: 62, targetValue: 56, currentValue: 59, achievement: 0.5,
      },
      {
        tenantId: tenant.id, objectiveId: objCustomer.id, name: 'Net Promoter Score',
        unit: 'NUMBER', direction: 'MAX', weight: 1.0,
        startingValue: 42, targetValue: 60, currentValue: 51, achievement: 0.5,
      },
      {
        tenantId: tenant.id, objectiveId: objCustomer.id, name: 'Annual Churn %',
        unit: 'PERCENT', direction: 'MIN', weight: 0.6,
        startingValue: 14, targetValue: 9.8, currentValue: 12.1, achievement: 0.45,
      },
    ],
  });

  // ── Programs ──
  const programDigital = await prisma.program.create({
    data: {
      tenantId: tenant.id,
      name: 'Digital Operations Transformation',
      description: 'Modernize core platforms, digitize the supply chain, transform finance ops',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-06-30'),
      status: 'ON_TRACK',
      statusNote: 'Tracking ahead of plan; supply-chain workstream behind by 1 quarter',
    },
  });

  const programIntegration = await prisma.program.create({
    data: {
      tenantId: tenant.id,
      name: 'Northwind M&A Integration',
      description: 'Day-100 integration of Northwind acquisition; capture $80M cost & revenue synergies',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2027-03-01'),
      status: 'AT_RISK',
      statusNote: 'IT integration slipping; revenue synergy capture below target',
    },
  });

  // ── Workstreams ──
  const wsFinance = await prisma.workstream.create({
    data: { programId: programDigital.id, name: 'Finance Transformation', status: 'ON_TRACK' },
  });
  const wsSupplyChain = await prisma.workstream.create({
    data: { programId: programDigital.id, name: 'Supply Chain Digitization', status: 'AT_RISK' },
  });
  const wsCustomer = await prisma.workstream.create({
    data: { programId: programDigital.id, name: 'Customer Experience', status: 'ON_TRACK' },
  });

  const wsIT = await prisma.workstream.create({
    data: { programId: programIntegration.id, name: 'IT & Systems Integration', status: 'AT_RISK' },
  });
  const wsCost = await prisma.workstream.create({
    data: { programId: programIntegration.id, name: 'Cost Synergies', status: 'ON_TRACK' },
  });
  const wsRevenue = await prisma.workstream.create({
    data: { programId: programIntegration.id, name: 'Revenue Synergies', status: 'OFF_TRACK' },
  });

  // ── Initiatives + benefits + costs ──
  const initiativesData = [
    {
      ws: wsFinance, name: 'Close Cycle Automation',
      description: 'Automate journal entries and reconciliations to compress monthly close from 8 days to 3.',
      stage: 'EXECUTE', status: 'ON_TRACK',
      benefit: 4_500_000, cost: 1_200_000, monthsAhead: 12,
      objective: objCost, impact: 'HIGH',
    },
    {
      ws: wsFinance, name: 'AP Touchless Invoicing',
      description: 'OCR + RPA to process 80% of invoices without human touch.',
      stage: 'REALIZE', status: 'ON_TRACK',
      benefit: 2_800_000, cost: 700_000, monthsAhead: 8,
      objective: objCost, impact: 'MEDIUM',
    },
    {
      ws: wsSupplyChain, name: 'Demand Forecasting AI',
      description: 'Replace statistical forecasts with ML model; reduce stockouts and excess inventory.',
      stage: 'EXECUTE', status: 'AT_RISK',
      benefit: 12_000_000, cost: 3_500_000, monthsAhead: 18,
      objective: objCost, impact: 'HIGH',
    },
    {
      ws: wsSupplyChain, name: 'Logistics Network Redesign',
      description: 'Consolidate 9 DCs into 6; reroute lanes for lower miles per shipment.',
      stage: 'PLAN', status: 'AT_RISK',
      benefit: 18_000_000, cost: 6_200_000, monthsAhead: 24,
      objective: objCost, impact: 'HIGH',
    },
    {
      ws: wsCustomer, name: 'Self-Service Portal Relaunch',
      description: 'Modernize customer portal; reduce inbound contacts 25%.',
      stage: 'EXECUTE', status: 'ON_TRACK',
      benefit: 3_200_000, cost: 1_400_000, monthsAhead: 10,
      objective: objCustomer, impact: 'HIGH',
    },
    {
      ws: wsCustomer, name: 'Voice-of-Customer Analytics',
      description: 'Sentiment analysis on support tickets and reviews to drive product improvements.',
      stage: 'IDEA', status: 'ON_TRACK',
      benefit: 1_800_000, cost: 450_000, monthsAhead: 6,
      objective: objCustomer, impact: 'MEDIUM',
    },
    {
      ws: wsIT, name: 'ERP Consolidation',
      description: 'Migrate Northwind onto Acme ERP within 9 months.',
      stage: 'EXECUTE', status: 'AT_RISK',
      benefit: 6_000_000, cost: 4_800_000, monthsAhead: 12,
      objective: objCost, impact: 'HIGH',
    },
    {
      ws: wsIT, name: 'Identity & Access Unification',
      description: 'Single SSO across both companies.',
      stage: 'PLAN', status: 'OFF_TRACK',
      benefit: 900_000, cost: 600_000, monthsAhead: 6,
      objective: objCost, impact: 'LOW',
    },
    {
      ws: wsCost, name: 'Procurement Synergies',
      description: 'Renegotiate top 50 contracts using combined volume.',
      stage: 'REALIZE', status: 'ON_TRACK',
      benefit: 22_000_000, cost: 800_000, monthsAhead: 9,
      objective: objCost, impact: 'HIGH',
    },
    {
      ws: wsCost, name: 'Real Estate Footprint',
      description: 'Consolidate office and warehouse footprint.',
      stage: 'EXECUTE', status: 'ON_TRACK',
      benefit: 8_500_000, cost: 1_100_000, monthsAhead: 18,
      objective: objCost, impact: 'MEDIUM',
    },
    {
      ws: wsRevenue, name: 'Cross-sell Acme into Northwind Base',
      description: 'Sell Acme premium tier into Northwind installed base.',
      stage: 'PLAN', status: 'OFF_TRACK',
      benefit: 28_000_000, cost: 2_600_000, monthsAhead: 18,
      objective: objGrowth, impact: 'HIGH',
    },
    {
      ws: wsRevenue, name: 'Bundle Pricing Refresh',
      description: 'Combined catalog with bundle SKUs and incentive plan refresh.',
      stage: 'IDEA', status: 'AT_RISK',
      benefit: 9_500_000, cost: 700_000, monthsAhead: 12,
      objective: objGrowth, impact: 'MEDIUM',
    },
  ];

  const startMonth = startOfMonth(new Date('2026-01-01'));
  const impactScore: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

  for (const [idx, spec] of initiativesData.entries()) {
    const owner = idx % 2 === 0 ? owner1 : owner2;

    const init = await prisma.initiative.create({
      data: {
        workstreamId: spec.ws.id,
        name: spec.name,
        description: spec.description,
        stage: spec.stage,
        state: spec.stage === 'COMPLETE' ? 'DONE' : (['EXECUTE', 'REALIZE'].includes(spec.stage) ? 'ACTIVE' : 'PLANNING'),
        status: spec.status,
        startDate: addMonths(startMonth, idx % 4),
        dueDate: addMonths(startMonth, (idx % 4) + spec.monthsAhead),
        ownerId: owner.id,
        sponsorId: sponsor.id,
      },
    });

    // Objective alignment
    await prisma.initiativeObjective.create({
      data: {
        initiativeId: init.id,
        objectiveId: spec.objective.id,
        impact: spec.impact,
      },
    });

    // Build benefit and cost lines with monthly time-phased values
    const benefit = await prisma.benefitLine.create({
      data: {
        initiativeId: init.id,
        name: 'Run-rate benefits',
        category: 'Cost Savings',
        startDate: init.startDate,
        endDate: init.dueDate,
      },
    });
    const cost = await prisma.costLine.create({
      data: {
        initiativeId: init.id,
        name: 'Implementation cost',
        category: 'OPEX',
        startDate: init.startDate,
        endDate: init.dueDate,
      },
    });

    // Spread benefits and costs across months. Costs front-loaded; benefits back-loaded.
    const months = spec.monthsAhead;
    const benefitDatasets: [string, number][] = [['ACTUAL', 0.6], ['TARGET', 1.0], ['FORECAST', 0.95]];
    const costDatasets: [string, number][] = [['ACTUAL', 0.7], ['TARGET', 1.0], ['FORECAST', 1.05]];

    const benefitValues: { benefitLineId: string; dataset: string; periodStart: Date; amount: number }[] = [];
    const costValues: { costLineId: string; dataset: string; periodStart: Date; amount: number }[] = [];
    for (let m = 0; m < months; m++) {
      const period = addMonths(init.startDate, m);
      // Cost ramps down (front-loaded)
      const costShape = (1 - m / months) * 1.5;
      // Benefit ramps up (back-loaded)
      const benShape = (m / months) * 1.7;
      const monthCost = (spec.cost / months) * costShape;
      const monthBenefit = (spec.benefit / months) * benShape;

      for (const [ds, factor] of benefitDatasets) {
        benefitValues.push({
          benefitLineId: benefit.id, dataset: ds, periodStart: period,
          amount: Math.round(monthBenefit * factor),
        });
      }
      for (const [ds, factor] of costDatasets) {
        costValues.push({
          costLineId: cost.id, dataset: ds, periodStart: period,
          amount: Math.round(monthCost * factor),
        });
      }
    }
    await prisma.metricValue.createMany({ data: benefitValues });
    await prisma.metricValue.createMany({ data: costValues });

    // Compute denormalized totals
    const totalBenefit = benefitValues.filter(v => v.dataset === 'ACTUAL').reduce((a, v) => a + v.amount, 0);
    const totalCost = costValues.filter(v => v.dataset === 'ACTUAL').reduce((a, v) => a + v.amount, 0);
    const valueScore = impactScore[spec.impact];
    await prisma.initiative.update({
      where: { id: init.id },
      data: {
        cumulativeBenefit: totalBenefit,
        cumulativeCost: totalCost,
        cumulativeNetBenefit: totalBenefit - totalCost,
        valueScore,
      },
    });

    // Milestones
    const stagesForMilestones = ['Charter Approved', 'Plan Complete', 'Build Complete', 'Go-Live', 'Benefits Realized'];
    for (let i = 0; i < 3; i++) {
      await prisma.milestone.create({
        data: {
          initiativeId: init.id,
          name: stagesForMilestones[i],
          dueDate: addMonths(init.startDate, Math.floor((i + 1) * months / 4)),
          isGate: i % 2 === 0,
          status: i === 0 ? 'DONE' : (i === 1 && spec.stage !== 'IDEA' ? 'DONE' : 'PENDING'),
          completedAt: i === 0 || (i === 1 && spec.stage !== 'IDEA') ? addMonths(init.startDate, i + 1) : null,
        },
      });
    }

    // RAID items — one risk per initiative (more for at-risk ones)
    const riskCount = spec.status === 'OFF_TRACK' ? 3 : (spec.status === 'AT_RISK' ? 2 : 1);
    for (let r = 0; r < riskCount; r++) {
      const probability = (spec.status === 'OFF_TRACK' ? 4 : 3) + (r % 2);
      const impact = (spec.status === 'OFF_TRACK' ? 4 : 3) + ((r + 1) % 2);
      await prisma.raidItem.create({
        data: {
          initiativeId: init.id,
          type: r === 0 ? 'RISK' : (r === 1 ? 'ISSUE' : 'DECISION'),
          title: r === 0
            ? `Resource availability constrains ${spec.name}`
            : (r === 1 ? `Vendor commitment slipped on ${spec.name}` : `Pricing model decision needed`),
          description: 'Auto-generated demo item',
          probability, impact,
          severity: probability * impact,
          mitigation: 'Escalate to Steering Committee at next biweekly review',
          status: 'OPEN',
          ownerId: owner.id,
          dueDate: addMonths(new Date(), 1),
        },
      });
    }
  }

  // ── Business rule: Auto-notify sponsor when initiative goes OFF_TRACK ──
  await prisma.businessRule.create({
    data: {
      tenantId: tenant.id,
      name: 'Notify sponsor on Off Track',
      entityType: 'Initiative',
      trigger: 'ON_FIELD_CHANGE',
      fieldName: 'status',
      fieldValue: 'OFF_TRACK',
      action: 'NOTIFY',
      actionConfig: JSON.stringify({
        recipientField: 'sponsorId',
        subject: 'Initiative is OFF TRACK: {!name}',
        body: 'Initiative {!name} has been flagged OFF TRACK. Review status and confirm escalation path.',
        link: '/initiatives/{!id}',
      }),
    },
  });

  // ── Resources ──
  await prisma.resource.createMany({
    data: [
      { tenantId: tenant.id, name: 'Program Manager', role: 'PMO',     hourlyRate: 175, capacity: 40 },
      { tenantId: tenant.id, name: 'Solution Architect', role: 'Tech', hourlyRate: 220, capacity: 40 },
      { tenantId: tenant.id, name: 'Business Analyst', role: 'BA',     hourlyRate: 110, capacity: 40 },
      { tenantId: tenant.id, name: 'Change Lead', role: 'OCM',         hourlyRate: 150, capacity: 32 },
    ],
  });

  console.log('✅ Seeded successfully.');
  console.log('   Login: demo@cascade.io / demo1234');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().then(() => process.exit(1));
  });
