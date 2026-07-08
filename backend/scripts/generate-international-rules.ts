// generate-international-rules.ts — add machine-readable agent rules for the
// International lens (Federal already covered elsewhere; states via
// generate-sources-and-rules.ts). Rules are DERIVED FROM REAL DATA: for each
// international regulator we group its active requirements by the named regime
// and emit one checkable ComplianceRule per (jurisdiction × regime), so nothing
// is fabricated — every rule maps to obligations already in the catalog.
// Idempotent (upsert by unique [companyId, ruleCode]).
//
// Run (cwd = backend): npx tsx --env-file=.env scripts/generate-international-rules.ts
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true } });
  if (!company) throw new Error('no company');
  const { id: companyId, tenantId } = company;

  const jurs = await prisma.jurisdiction.findMany({
    where: { companyId, regulatorType: 'INTERNATIONAL' },
    select: { id: true, code: true, name: true, regulatorName: true },
  });

  const rows: {
    tenantId: string;
    companyId: string;
    jurisdictionId: string;
    ruleCode: string;
    category: string;
    description: string;
    ruleJson: object;
    origin: string;
    active: boolean;
  }[] = [];

  for (const j of jurs) {
    const reqs = await prisma.regulatoryRequirement.findMany({
      where: { companyId, status: 'ACTIVE', jurisdictionId: j.id },
      select: { regime: true, category: true, frequency: true },
    });
    // Group the jurisdiction's requirements by their named regime.
    const byRegime = new Map<string, { categories: Map<string, number>; count: number }>();
    for (const r of reqs) {
      const regime = r.regime?.trim() || `${j.name} — general obligations`;
      const g = byRegime.get(regime) ?? { categories: new Map(), count: 0 };
      g.count += 1;
      g.categories.set(r.category, (g.categories.get(r.category) ?? 0) + 1);
      byRegime.set(regime, g);
    }
    for (const [regime, g] of byRegime) {
      const categories = [...g.categories.entries()].sort((a, b) => b[1] - a[1]);
      const primary = categories[0]?.[0] ?? 'OTHER';
      rows.push({
        tenantId,
        companyId,
        jurisdictionId: j.id,
        ruleCode: `${j.code}-${slug(regime)}`,
        category: primary,
        description: `${j.name}: verify the ${g.count} obligation${
          g.count === 1 ? '' : 's'
        } under ${regime} are satisfied and current filings are in place.`,
        ruleJson: {
          jurisdiction: j.code,
          regulator: j.regulatorName,
          regime,
          type: 'regime_compliance',
          requirementCount: g.count,
          categories: categories.map(([c]) => c),
        },
        origin: 'TEMPLATE_DERIVED',
        active: true,
      });
    }
  }

  const existing = new Set(
    (
      await prisma.complianceRule.findMany({ where: { companyId }, select: { ruleCode: true } })
    ).map((r) => r.ruleCode),
  );
  const toCreate = rows.filter((r) => !existing.has(r.ruleCode));
  for (let i = 0; i < toCreate.length; i += 1000) {
    await prisma.complianceRule.createMany({
      data: toCreate.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  const intlTotal = await prisma.complianceRule.count({
    where: { companyId, active: true, jurisdiction: { regulatorType: 'INTERNATIONAL' } },
  });
  console.log(
    `international regulators: ${jurs.length} · agent rules +${toCreate.length} (intl total ${intlTotal})`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
