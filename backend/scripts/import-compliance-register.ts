/**
 * SCRUM-46 v2 — import the determination-ready compliance register.
 *
 * Reads documents/regulations/Regulation-Compliance-Determination-Ready.xlsx
 * and seeds the three-level register:
 *   L1 ComplianceRegulation  (538, REG-###)
 *   L2 ComplianceItem        (4,089, REG-###-C##)
 *   L3 RegulatoryRequirement (existing rows — linked via complianceRegulationId,
 *      23,664 binding + 264 informational; 23,928 total)
 *   plus 51 ComplianceJurisdictionVariant rows.
 *
 * The workbook is the frozen v2 baseline; after this one-time import the app
 * is the system of record (sign-offs, promotions, edits). Idempotent: reruns
 * wipe and rebuild the register for the company (sign-off history included —
 * rerun only to re-baseline).
 *
 * Ends with a reconciliation report that must match the workbook Summary
 * exactly (538 / 4,089 / 23,928 / 23,664 / 264 / 51) — exits 1 on any drift.
 *
 * Run: npx tsx --env-file=.env scripts/import-compliance-register.ts
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { prisma } from '../src/db/prisma.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSX = require('xlsx') as typeof import('xlsx');

const WB = path.resolve(
  '..',
  'documents',
  'regulations',
  'Regulation-Compliance-Determination-Ready.xlsx',
);

type SheetRow = Record<string, string | number>;
const s = (v: string | number | undefined) => String(v ?? '').trim();
const n = (v: string | number | undefined) => Number(v ?? 0) || 0;
const yes = (v: string | number | undefined) => s(v) === 'Yes';

const GROUNDING: Record<string, string> = {
  'Item-level keyword match': 'ITEM',
  'Regulation-level (all rows of parent regulation)': 'REGULATION',
};
const FREQ_ALIGN: Record<string, string> = {
  Match: 'MATCH',
  'Review — differs from template': 'REVIEW',
  'No signal in source text': 'NO_SIGNAL',
};
const DETERMINATION: Record<string, string> = {
  'Grounded — pending counsel confirmation': 'GROUNDED',
  'Grounded (non-official sources) — verify source then confirm': 'GROUNDED_NON_OFFICIAL',
  'Partially grounded — regulation-level only; counsel to map item to specific rows': 'PARTIAL',
};

function mapToken(map: Record<string, string>, raw: string, fallback: string, field: string) {
  const t = map[raw];
  if (!t) {
    console.warn(`  ! unmapped ${field}: "${raw}" → ${fallback}`);
    return fallback;
  }
  return t;
}

async function main() {
  const wb = XLSX.readFile(WB);
  const sheet = (name: string) =>
    XLSX.utils.sheet_to_json<SheetRow>(wb.Sheets[name], { defval: '' });
  const l1 = sheet('Regulations (L1)');
  const l2 = sheet('Compliance Items (L2)');
  const l3 = sheet('Requirements Flagged (L3)');
  const variants = sheet('Jurisdiction Variants');
  console.log(
    `workbook: L1=${l1.length} L2=${l2.length} L3=${l3.length} variants=${variants.length}`,
  );

  const company = await prisma.company.findFirst({
    select: { id: true, tenantId: true, name: true },
  });
  if (!company) throw new Error('No company row found');
  const scope = { tenantId: company.tenantId, companyId: company.id };
  console.log(`company: ${company.name} (${company.id})`);

  // ── wipe + rebuild (cascade takes items, junctions, variants, events) ──
  await prisma.complianceRegulation.deleteMany({ where: { companyId: company.id } });
  await prisma.regulatoryRequirement.updateMany({
    where: { companyId: company.id, complianceRequired: { not: null } },
    data: { complianceRegulationId: null, complianceRequired: null, notRequiredReason: null },
  });

  // ── L1 regulations ──
  await prisma.complianceRegulation.createMany({
    data: l1.map((r) => ({
      ...scope,
      regCode: s(r['Regulation ID']),
      name: s(r['Regulation / Program']),
      category: s(r['Category']),
      lineOfBusiness: s(r['Line of Business']) || 'ALL',
      jurisdictionScope: s(r['Jurisdiction Scope']),
      productImpact: yes(r['Product Impact']),
      processImpact: yes(r['Process Impact']),
      systemImpact: yes(r['System Impact']),
      ownerTeam: s(r['Owner']),
      frequency: s(r['Frequency']),
      dueDate: s(r['Due Date / Effective Date']) || 'Not Yet Determined',
      evidenceRequired: s(r['Evidence Required']),
      auditStatus: s(r['Audit Status']) || 'Not started',
      representativeRequirement: s(r['Representative Requirement (verbatim)']),
      sampleCitations: s(r['Sample Citations']),
    })),
  });
  const regRows = await prisma.complianceRegulation.findMany({
    where: { companyId: company.id },
    select: { id: true, regCode: true },
  });
  const regIdByCode = new Map(regRows.map((r) => [r.regCode, r.id]));
  console.log(`L1 inserted: ${regRows.length}`);

  // ── L2 compliance items ──
  await prisma.complianceItem.createMany({
    data: l2.map((r) => {
      const regId = regIdByCode.get(s(r['Regulation ID']));
      if (!regId)
        throw new Error(
          `L2 ${s(r['Compliance Item ID'])}: unknown regulation ${s(r['Regulation ID'])}`,
        );
      const reviewer = s(r['Reviewer']);
      const notes = s(r['Review Notes']);
      return {
        ...scope,
        itemCode: s(r['Compliance Item ID']),
        regulationId: regId,
        name: s(r['Compliance Item (what must be done)']),
        ownerTeam: s(r['Owner']),
        frequency: s(r['Frequency']),
        evidence: s(r['Evidence']),
        jurisdictionScope: s(r['Jurisdiction Scope']),
        auditStatus: s(r['Audit Status']) || 'Not started',
        supportingReqRows: n(r['Supporting Req Rows']),
        groundingBasis: mapToken(
          GROUNDING,
          s(r['Grounding Basis']),
          'REGULATION',
          'groundingBasis',
        ),
        officialSourceRows: n(r['Official-Source Rows']),
        jurisdictionsCovered: n(r['Jurisdictions Covered']),
        representativeRequirement: s(r['Representative Requirement (verbatim)']),
        repJurisdiction: s(r['Rep. Jurisdiction']),
        supportingCitations: s(r['Supporting Citations (top 3)']),
        frequencyDerived: s(r['Frequency (Derived from Source Text)']),
        frequencyAlignment: mapToken(
          FREQ_ALIGN,
          s(r['Frequency Alignment']),
          'NO_SIGNAL',
          'frequencyAlignment',
        ),
        deadlineSignals: s(r['Deadline Signals (extracted)']),
        determinationStatus: mapToken(
          DETERMINATION,
          s(r['Determination Status']),
          'NOT_GROUNDED',
          'determinationStatus',
        ),
        confidence: s(r['Confidence']).toUpperCase(),
        signOff: 'PENDING',
        reviewer: reviewer && reviewer !== 'Not Yet Assigned' ? reviewer : null,
        reviewNotes: notes && notes !== 'Not Yet Determined' ? notes : null,
      };
    }),
  });
  const itemCount = await prisma.complianceItem.count({ where: { companyId: company.id } });
  console.log(`L2 inserted: ${itemCount}`);

  // ── L3 linkage — match each workbook row to a distinct RegulatoryRequirement ──
  const dbRows = await prisma.regulatoryRequirement.findMany({
    where: { companyId: company.id },
    select: {
      id: true,
      title: true,
      citation: true,
      category: true,
      lineOfBusiness: true,
      jurisdiction: { select: { name: true } },
    },
  });
  const keyOf = (jur: string, title: string) => `${jur.toLowerCase()}||${title.toLowerCase()}`;
  const dbByKey = new Map<string, typeof dbRows>();
  for (const r of dbRows) {
    const k = keyOf(r.jurisdiction.name.trim(), r.title.trim());
    (dbByKey.get(k) ?? dbByKey.set(k, []).get(k)!).push(r);
  }

  const assigned = new Set<string>();
  // requirement ids per regCode (binding) + per-row informational updates
  const bindingByReg = new Map<string, string[]>();
  const informational: Array<{ id: string; regCode: string; reason: string }> = [];
  let unmatched = 0;
  for (const row of l3) {
    const cands = dbByKey.get(keyOf(s(row['Jurisdiction']), s(row['Requirement Title'])));
    let match = cands?.find(
      (c) =>
        !assigned.has(c.id) &&
        (c.citation ?? '') === s(row['Citation']) &&
        c.lineOfBusiness === s(row['Line of Business']) &&
        c.category === s(row['Category']),
    );
    match ??= cands?.find((c) => !assigned.has(c.id));
    if (!match) {
      unmatched++;
      console.warn(
        `  ! unmatched L3 row: ${s(row['Jurisdiction'])} :: ${s(row['Requirement Title'])}`,
      );
      continue;
    }
    assigned.add(match.id);
    if (yes(row['Compliance Required'])) {
      const regCode = s(row['Regulation ID']);
      (bindingByReg.get(regCode) ?? bindingByReg.set(regCode, []).get(regCode)!).push(match.id);
    } else {
      informational.push({
        id: match.id,
        regCode: s(row['Regulation ID']),
        reason: s(row['Not-Required Reason']),
      });
    }
  }
  if (unmatched > 0)
    throw new Error(`${unmatched} L3 rows failed to match — aborting before writes`);

  for (const [regCode, ids] of bindingByReg) {
    const regId = regIdByCode.get(regCode);
    if (!regId) throw new Error(`L3 binding rows reference unknown regulation ${regCode}`);
    for (let i = 0; i < ids.length; i += 5000) {
      await prisma.regulatoryRequirement.updateMany({
        where: { id: { in: ids.slice(i, i + 5000) } },
        data: { complianceRegulationId: regId, complianceRequired: true },
      });
    }
  }
  // informational rows carry no regulation link (workbook Regulation ID = "—")
  const reasons = new Map<string, string[]>();
  for (const r of informational)
    (reasons.get(r.reason) ?? reasons.set(r.reason, []).get(r.reason)!).push(r.id);
  for (const [reason, ids] of reasons) {
    await prisma.regulatoryRequirement.updateMany({
      where: { id: { in: ids } },
      data: { complianceRequired: false, notRequiredReason: reason || null },
    });
  }

  // ── jurisdiction variants ──
  await prisma.complianceJurisdictionVariant.createMany({
    data: variants.map((r) => {
      const regId = regIdByCode.get(s(r['Regulation ID']));
      if (!regId) throw new Error(`variant references unknown regulation ${s(r['Regulation ID'])}`);
      return {
        companyId: company.id,
        regulationId: regId,
        jurisdiction: s(r['Jurisdiction']),
        deadlineVariant: s(r['Deadline Variant']),
        requirementTitle: s(r['Requirement Title']),
        citation: s(r['Citation']),
      };
    }),
  });

  // ── reconciliation (must match workbook Summary exactly) ──
  const [regs, items, binding, info, varCount] = await Promise.all([
    prisma.complianceRegulation.count({ where: { companyId: company.id } }),
    prisma.complianceItem.count({ where: { companyId: company.id } }),
    prisma.regulatoryRequirement.count({
      where: { companyId: company.id, complianceRequired: true },
    }),
    prisma.regulatoryRequirement.count({
      where: { companyId: company.id, complianceRequired: false },
    }),
    prisma.complianceJurisdictionVariant.count({ where: { companyId: company.id } }),
  ]);
  const report = {
    regs,
    items,
    binding,
    informational: info,
    total: binding + info,
    variants: varCount,
  };
  const expected = {
    regs: 538,
    items: 4089,
    binding: 23664,
    informational: 264,
    total: 23928,
    variants: 51,
  };
  console.log('reconciliation:', JSON.stringify(report));
  const drift = Object.entries(expected).filter(([k, v]) => report[k as keyof typeof report] !== v);
  if (drift.length) {
    console.error('DRIFT vs workbook Summary:', drift, 'expected:', expected);
    process.exit(1);
  }

  // per-regulation child counts vs workbook columns
  let countMismatch = 0;
  const itemCounts = await prisma.complianceItem.groupBy({
    by: ['regulationId'],
    where: { companyId: company.id },
    _count: true,
  });
  const reqCounts = await prisma.regulatoryRequirement.groupBy({
    by: ['complianceRegulationId'],
    where: { companyId: company.id, complianceRegulationId: { not: null } },
    _count: true,
  });
  const itemsByRegId = new Map(itemCounts.map((r) => [r.regulationId, r._count]));
  const reqsByRegId = new Map(reqCounts.map((r) => [r.complianceRegulationId, r._count]));
  for (const r of l1) {
    const regId = regIdByCode.get(s(r['Regulation ID']))!;
    if ((itemsByRegId.get(regId) ?? 0) !== n(r['Compliance Items'])) countMismatch++;
    if ((reqsByRegId.get(regId) ?? 0) !== n(r['Requirement Rows'])) countMismatch++;
  }
  if (countMismatch) {
    console.error(`${countMismatch} per-regulation child-count mismatches vs workbook L1 columns`);
    process.exit(1);
  }
  console.log(
    '✔ all counts reconcile with the workbook Summary (538 / 4,089 / 23,928 / 23,664 / 264 / 51)',
  );
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
