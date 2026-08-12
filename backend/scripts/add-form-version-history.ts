// One-off: give the forms most likely to carry edition history (the big base
// coverage forms + a few workhorse endorsements) a v2 and v3 with realistic
// wording AND coverage deltas, so the Workspace Forms lens has same-form
// version comparisons to show. Idempotent: a form that already has more than
// one version is skipped. Run from backend/:
//   npx tsx --env-file=.env scripts/add-form-version-history.ts
import { prisma } from '../src/db/prisma.js';
import { segmentClauses, meanSegConfidence } from '../src/lib/forms/segmentation.js';
import { clauseTextHash } from '../src/lib/forms/similarity.js';

/** Each edition applies wording swaps and appends a new coverage clause, so
 *  every version pair shows divergent wording AND a coverage difference. */
const EDITIONS: { swaps: [RegExp, string][]; appendix: string }[] = [
  {
    // v2 — wording modernization + a deductible/limit change + new exclusion.
    swaps: [
      [/We will pay/g, 'We shall pay'],
      [/\$500\b/g, '$1,000'],
      [/sixty days/gi, 'ninety days'],
      [/written notice/gi, 'advance written notice'],
      [/as soon as practicable/gi, 'promptly, and in any event within 30 days'],
    ],
    appendix:
      'VIRTUAL OPERATIONS EXCLUSION.\nWe do not cover loss, cost or expense arising out of the rendering of services by means of unmanned or autonomous systems unless scheduled by endorsement.',
  },
  {
    // v3 — a coverage extension + notice-period and territory changes.
    swaps: [
      [/We shall pay/g, 'We will pay'],
      [/ninety days/gi, 'one hundred twenty days'],
      [/United States of America\b/g, 'United States of America, its territories and possessions,'],
      [/\$1,000\b/g, '$2,500'],
    ],
    appendix:
      'EXTENDED REPORTING AND CYBER INCIDENT EXPENSE COVERAGE.\nWe will pay up to $25,000 per policy period for reasonable and necessary expenses you incur to respond to a cyber incident affecting covered operations, subject to the terms shown in the Declarations. This coverage is excess over any other valid and collectible insurance.',
  },
];

async function main(): Promise<void> {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!company) throw new Error('No company found');
  const admin = await prisma.user.findFirst({
    where: { tenantId: company.tenantId, role: 'SITE_ADMIN' },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw new Error('No admin user found');

  // The forms that revise most in the real world: the base coverage forms
  // (largest documents) plus the most-attached endorsements.
  const forms = await prisma.policyForm.findMany({
    where: { companyId: company.id },
    select: {
      id: true,
      formNumber: true,
      title: true,
      versions: {
        orderBy: { versionNo: 'desc' },
        select: { id: true, versionNo: true, sourceText: true },
      },
    },
  });
  const single = forms.filter((f) => f.versions.length === 1 && f.versions[0].sourceText);
  const withSize = single.map((f) => ({ f, size: f.versions[0].sourceText.length }));
  withSize.sort((x, y) => y.size - x.size);
  const explicit = new Set(['ASSIC-CG-0001', 'ASSIC-WC-0001', 'ASSIC-CG-2037']);
  const targets = [
    ...withSize.filter((w) => explicit.has(w.f.formNumber)),
    ...withSize.filter((w) => !explicit.has(w.f.formNumber)).slice(0, 9),
  ].slice(0, 12);

  for (const { f } of targets) {
    let text = f.versions[0].sourceText;
    let versionNo = f.versions[0].versionNo;
    for (const edition of EDITIONS) {
      for (const [from, to] of edition.swaps) text = text.replace(from, to);
      // Keep the customary closing line last when the form has one.
      const closer = 'All other provisions of this policy apply.';
      text = text.endsWith(closer)
        ? `${text.slice(0, -closer.length).trimEnd()}\n${edition.appendix}\n${closer}`
        : `${text.trimEnd()}\n${edition.appendix}`;
      versionNo += 1;
      const segmented = segmentClauses(text);
      await prisma.policyFormVersion.create({
        data: {
          tenantId: company.tenantId,
          companyId: company.id,
          formId: f.id,
          versionNo,
          status: 'ready',
          sourceText: text,
          segConfidence: meanSegConfidence(segmented),
          createdById: admin.id,
          clauses: {
            create: segmented.map((c) => ({
              tenantId: company.tenantId,
              companyId: company.id,
              ordinal: c.ordinal,
              level: c.level,
              heading: c.heading,
              text: c.text,
              charStart: c.charStart,
              charEnd: c.charEnd,
              textHash: clauseTextHash(c.text),
              segConfidence: c.segConfidence,
            })),
          },
        },
      });
    }
    console.log(`${f.formNumber} — ${f.title}: now v1..v${versionNo}`);
  }
  console.log(`Done: ${targets.length} forms given v2 + v3 history.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
