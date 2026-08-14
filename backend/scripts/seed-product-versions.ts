/**
 * seed-product-versions.ts — add v2 (and v3) GENERATIONS to flagship products
 * so the Product Model page's version filter demonstrates real change history.
 *
 * A generation is a complete edition of a product: the countrywide core plus
 * every state with an own policy form. A carrier only files a new version when
 * something changed, so each new generation clones the previous one and then
 * applies that product's delta — new endorsements, rating variables, pricing
 * levers, underwriting rules and the filing obligation the refresh triggers.
 * The superseded generation's versions move to "Runoff" (still on the books,
 * no new business) — inside the status vocabulary schema.prisma documents.
 *
 * Destructive and idempotent: deletes every node stamped
 * attributes.generationSeed=true (closure rows cascade), restores the prior
 * generation's status, then re-creates. Re-running converges.
 *
 * Run from backend/:  npx tsx --env-file=.env scripts/seed-product-versions.ts
 */
import { createHash } from 'node:crypto';
import { prisma } from '../src/db/prisma.js';

interface Element {
  element: string;
  format: string;
  livesIn: string;
  description: string;
}

/** Per-component element additions one generation introduces. */
type Delta = Record<string, Element[]>;

const FORMS = 'Forms';

/** Flagship products that plausibly iterated, with their generation deltas. */
const PLANS: { product: string; generations: { version: string; delta: Delta }[] }[] = [
  {
    product: 'Renters — HO-4',
    generations: [
      {
        version: 'v2',
        delta: {
          [FORMS]: [
            {
              element: 'Water Backup and Sump Discharge Endorsement',
              format: 'Endorsement',
              livesIn: 'Policy Forms Library',
              description:
                'Optional endorsement adding named-peril cover for water that backs up through sewers or drains or overflows from a sump — the most-requested HO-4 gap.',
            },
            {
              element: 'Home-Sharing Host Activities Endorsement',
              format: 'Endorsement',
              livesIn: 'Policy Forms Library',
              description:
                'Buys back limited liability and contents cover while the residence premises is rented to home-sharing guests booked through a platform.',
            },
          ],
          Rating: [
            {
              element: 'Insurance Score Tier — 2024 refresh',
              format: 'Rating variable',
              livesIn: 'Rating engine',
              description:
                'Recalibrated credit-based insurance score tiers replacing the launch model; adds two super-preferred tiers at the top of the distribution.',
            },
          ],
          Pricing: [
            {
              element: 'Paperless / e-Policy Discount',
              format: 'Discount',
              livesIn: 'Rating engine',
              description:
                'Flat discount for electronic policy delivery and paperless billing enrollment at new business.',
            },
          ],
          Filings: [
            {
              element: 'v2 multistate form and rate filing',
              format: 'Filing',
              livesIn: 'SERFF',
              description:
                'Countrywide refresh filing introducing the water backup and home-sharing endorsements and the recalibrated insurance score model.',
            },
          ],
        },
      },
    ],
  },
  {
    product: 'Condominium — HO-6',
    generations: [
      {
        version: 'v2',
        delta: {
          [FORMS]: [
            {
              element: 'Loss Assessment Coverage Increase Endorsement',
              format: 'Endorsement',
              livesIn: 'Policy Forms Library',
              description:
                'Raises the loss assessment sublimit for association-levied assessments after a covered common-element loss — responds to rising association deductibles.',
            },
          ],
          'Underwriting Rules': [
            {
              element: 'Association Master Deductible Guardrail',
              format: 'Referral rule',
              livesIn: 'Underwriting workbench',
              description:
                'Refers risks where the association master policy deductible exceeds the unit-owner dwelling limit — the assessment exposure the v2 endorsement prices.',
            },
          ],
          Filings: [
            {
              element: 'v2 loss assessment refresh filing',
              format: 'Filing',
              livesIn: 'SERFF',
              description:
                'Form and rule filing for the raised loss assessment options and the master-deductible referral rule.',
            },
          ],
        },
      },
    ],
  },
  {
    product: 'Personal Umbrella',
    generations: [
      {
        version: 'v2',
        delta: {
          [FORMS]: [
            {
              element: 'Recreational Vehicle Liability Following Form Endorsement',
              format: 'Endorsement',
              livesIn: 'Policy Forms Library',
              description:
                'Extends the umbrella over scheduled ATV, golf cart and personal watercraft liability where an underlying policy exists.',
            },
          ],
          'Underwriting Rules': [
            {
              element: 'Underlying Auto Limit Attachment Check',
              format: 'Eligibility rule',
              livesIn: 'Underwriting workbench',
              description:
                'Automated verification that underlying auto limits meet the raised v2 attachment point before bind.',
            },
          ],
          Filings: [
            {
              element: 'v2 attachment point rule filing',
              format: 'Filing',
              livesIn: 'SERFF',
              description:
                'Rule filing raising required underlying auto limits and adding the following-form recreational vehicle endorsement.',
            },
          ],
        },
      },
    ],
  },
  {
    product: 'Small Business Cyber',
    generations: [
      {
        version: 'v2',
        delta: {
          [FORMS]: [
            {
              element: 'Ransomware Event Sublimit Endorsement',
              format: 'Endorsement',
              livesIn: 'Policy Forms Library',
              description:
                'Introduces a ransomware-specific sublimit and coinsurance with an MFA attestation condition — the market-wide post-2023 correction.',
            },
            {
              element: 'Widespread Event Aggregation Clause',
              format: 'Clause',
              livesIn: 'Policy Forms Library',
              description:
                'Aggregates related claims arising from one widespread software-supply-chain event into a single occurrence and limit.',
            },
          ],
          Rating: [
            {
              element: 'MFA / EDR Control Credit Matrix',
              format: 'Rating variable',
              livesIn: 'Rating engine',
              description:
                'Security-control rating matrix crediting multi-factor authentication, endpoint detection and offline backups.',
            },
          ],
          Filings: [
            {
              element: 'v2 ransomware response filing',
              format: 'Filing',
              livesIn: 'SERFF',
              description:
                'Countrywide filing for the ransomware sublimit endorsement and control-based rating matrix.',
            },
          ],
        },
      },
      {
        version: 'v3',
        delta: {
          [FORMS]: [
            {
              element: 'AI Incident Response Expense Coverage',
              format: 'Coverage',
              livesIn: 'Policy Forms Library',
              description:
                'First-party expense cover for incidents caused by deployed generative-AI tooling, including model rollback and notification costs.',
            },
          ],
          'Underwriting Rules': [
            {
              element: 'Continuous Control Monitoring Eligibility',
              format: 'Eligibility rule',
              livesIn: 'Underwriting workbench',
              description:
                'Replaces point-in-time application questions with an external-scan eligibility gate refreshed at each renewal.',
            },
          ],
          Filings: [
            {
              element: 'v3 AI incident coverage filing',
              format: 'Filing',
              livesIn: 'SERFF',
              description:
                'Filing introducing AI incident response expense coverage and scan-based eligibility.',
            },
          ],
        },
      },
    ],
  },
  {
    product: 'Commercial Cyber',
    generations: [
      {
        version: 'v2',
        delta: {
          [FORMS]: [
            {
              element: 'Systemic Event Co-Participation Endorsement',
              format: 'Endorsement',
              livesIn: 'Policy Forms Library',
              description:
                'Adds insured co-participation above a threshold for losses arising from a single systemic cloud-provider outage.',
            },
          ],
          Rating: [
            {
              element: 'Cloud Concentration Factor',
              format: 'Rating variable',
              livesIn: 'Rating engine',
              description:
                'Debits accounts whose revenue depends on a single hyperscaler region without failover.',
            },
          ],
          Filings: [
            {
              element: 'v2 systemic risk filing',
              format: 'Filing',
              livesIn: 'SERFF',
              description:
                'Filing for the systemic event endorsement and cloud concentration rating factor.',
            },
          ],
        },
      },
    ],
  },
  {
    product: 'Businessowners Policy',
    generations: [
      {
        version: 'v2',
        delta: {
          [FORMS]: [
            {
              element: 'Cyber Incident Expense Endorsement (BOP)',
              format: 'Endorsement',
              livesIn: 'Policy Forms Library',
              description:
                'Packages first-party cyber incident expense cover into the BOP at a fixed sublimit — closes the small-commercial cyber gap without a standalone policy.',
            },
            {
              element: 'Equipment Breakdown Enhancement Endorsement',
              format: 'Endorsement',
              livesIn: 'Policy Forms Library',
              description:
                'Folds equipment breakdown (mechanical, electrical, pressure systems) into the property section, replacing the external reinsured wrap.',
            },
          ],
          Pricing: [
            {
              element: 'Multi-Location Schedule Credit',
              format: 'Credit',
              livesIn: 'Rating engine',
              description:
                'Schedule credit for accounts insuring three or more locations on one BOP.',
            },
          ],
          Filings: [
            {
              element: 'v2 BOP modernization filing',
              format: 'Filing',
              livesIn: 'SERFF',
              description:
                'Countrywide form and rate filing packaging cyber incident expense and equipment breakdown into the base BOP.',
            },
          ],
        },
      },
    ],
  },
  {
    product: 'Pet',
    generations: [
      {
        version: 'v2',
        delta: {
          [FORMS]: [
            {
              element: 'Preventive Care Wellness Rider',
              format: 'Rider',
              livesIn: 'Policy Forms Library',
              description:
                'Optional flat-benefit wellness rider covering vaccinations, dental cleaning and annual exams outside the deductible.',
            },
          ],
          Pricing: [
            {
              element: 'Multi-Pet Household Discount',
              format: 'Discount',
              livesIn: 'Rating engine',
              description:
                'Per-pet discount for households insuring two or more pets on one policy.',
            },
          ],
          Filings: [
            {
              element: 'v2 wellness rider filing',
              format: 'Filing',
              livesIn: 'SERFF',
              description: 'Filing adding the preventive care rider and multi-pet discount.',
            },
          ],
        },
      },
    ],
  },
  {
    product: 'Private Flood',
    generations: [
      {
        version: 'v2',
        delta: {
          [FORMS]: [
            {
              element: 'Basement Contents Buy-Back Endorsement',
              format: 'Endorsement',
              livesIn: 'Policy Forms Library',
              description:
                'Buys back contents cover in below-grade spaces the base form excludes — the top NFIP-parity complaint.',
            },
          ],
          Rating: [
            {
              element: 'Graduated Elevation Certificate Credit',
              format: 'Rating variable',
              livesIn: 'Rating engine',
              description:
                'Continuous first-floor-height credit replacing the binary elevation certificate credit.',
            },
          ],
          Filings: [
            {
              element: 'v2 elevation rating filing',
              format: 'Filing',
              livesIn: 'SERFF',
              description:
                'Filing for graduated elevation rating and the basement contents buy-back endorsement.',
            },
          ],
        },
      },
    ],
  },
  {
    product: 'Telematics Programme',
    generations: [
      {
        version: 'v2',
        delta: {
          Rating: [
            {
              element: 'Distracted Driving (Phone Handling) Score',
              format: 'Rating variable',
              livesIn: 'Telematics platform',
              description:
                'Adds phone-handling events to the driving score alongside braking, acceleration and mileage.',
            },
          ],
          Pricing: [
            {
              element: 'Continuous Monitoring Renewal Discount',
              format: 'Discount',
              livesIn: 'Rating engine',
              description:
                'Replaces the one-term trial discount with a continuously earned renewal discount tied to the trailing score.',
            },
          ],
          Filings: [
            {
              element: 'v2 scoring model filing',
              format: 'Filing',
              livesIn: 'SERFF',
              description:
                'Rule filing for the phone-handling score component and renewal discount.',
            },
          ],
        },
      },
      {
        version: 'v3',
        delta: {
          Rating: [
            {
              element: 'Connected-Car OEM Data Feed',
              format: 'Rating variable',
              livesIn: 'Telematics platform',
              description:
                'Accepts embedded OEM telematics feeds as a scoring source, removing the mobile-app requirement for participating makes.',
            },
          ],
          'Underwriting Rules': [
            {
              element: 'Data Consent Verification Gate',
              format: 'Eligibility rule',
              livesIn: 'Underwriting workbench',
              description:
                'Bind-time verification of the insured’s OEM data-sharing consent state before the feed rates.',
            },
          ],
          Filings: [
            {
              element: 'v3 OEM data source filing',
              format: 'Filing',
              livesIn: 'SERFF',
              description:
                'Rule filing admitting OEM embedded feeds as an approved scoring source.',
            },
          ],
        },
      },
    ],
  },
];

/** Deterministic node id — stable across re-runs so links stay diffable. */
function nodeId(path: string): string {
  return 'pvg_' + createHash('sha1').update(path).digest('hex').slice(0, 20);
}

function versionToken(name: string): string {
  return name.split(/[\s—–]+/).filter(Boolean)[0] ?? name;
}

async function main(): Promise<void> {
  const company = await prisma.company.findFirst({ where: { name: 'ABC Insurance' } });
  if (!company) throw new Error('Company "ABC Insurance" not found');
  const companyId = company.id;

  // ── Reset: remove previous seed output, restore superseded statuses. ──────
  const seeded = await prisma.productNode.findMany({
    where: { companyId, attributes: { path: ['generationSeed'], equals: true } },
    select: { id: true, productLevelType: { select: { levelNumber: true } } },
  });
  const l5First = [...seeded].sort(
    (a, b) => b.productLevelType.levelNumber - a.productLevelType.levelNumber,
  );
  for (const n of l5First) await prisma.productNode.delete({ where: { id: n.id } });
  await prisma.productNode.updateMany({
    where: {
      companyId,
      status: 'Runoff',
      attributes: { path: ['supersededBySeed'], equals: true },
    },
    data: { status: 'Active' },
  });
  // updateMany can't edit Json — clear the marker row-by-row.
  const marked = await prisma.productNode.findMany({
    where: { companyId, attributes: { path: ['supersededBySeed'], equals: true } },
    select: { id: true, attributes: true, status: true },
  });
  for (const m of marked) {
    const { supersededBySeed: _drop, ...rest } = (m.attributes ?? {}) as Record<string, unknown>;
    await prisma.productNode.update({
      where: { id: m.id },
      data: { status: 'Active', attributes: rest as object },
    });
  }
  console.log(`reset: removed ${seeded.length} seeded nodes, restored ${marked.length} statuses`);

  // ── Seed each plan. ───────────────────────────────────────────────────────
  for (const plan of PLANS) {
    const product = await prisma.productNode.findFirst({
      where: {
        companyId,
        displayValue: plan.product,
        productLevelType: { levelNumber: 3 },
      },
      select: { id: true, code: true },
    });
    if (!product) {
      console.warn(`SKIP — product not found: ${plan.product}`);
      continue;
    }
    // Ancestor chain (segment, lob) for closure rows, nearest last.
    const ancEdges = await prisma.productNodeClosure.findMany({
      where: { descendantId: product.id, depth: { gt: 0 } },
      orderBy: { depth: 'desc' },
      select: { ancestorId: true, depth: true },
    });
    const productAncestors = ancEdges.map((e) => e.ancestorId);

    // The base generation = the current latest (highest vN token).
    const l4 = await prisma.productNode.findMany({
      where: { companyId, parentId: product.id },
      orderBy: { sortOrder: 'asc' },
    });
    const genNo = (t: string) => Number(/^v(\d+)$/.exec(t)?.[1] ?? 0);
    let baseToken = l4.reduce(
      (best, v) => {
        const t = versionToken(v.displayValue);
        return genNo(t) > genNo(best) ? t : best;
      },
      versionToken(l4[0]?.displayValue ?? 'v1'),
    );

    for (const gen of plan.generations) {
      const baseVersions = l4.filter((v) => versionToken(v.displayValue) === baseToken);
      const components = await prisma.productNode.findMany({
        where: { companyId, parentId: { in: baseVersions.map((v) => v.id) } },
        orderBy: { sortOrder: 'asc' },
      });

      let sortOrder = Math.max(...l4.map((v) => v.sortOrder), 0) + 1;
      for (const base of baseVersions) {
        const newName = base.displayValue.replace(versionToken(base.displayValue), gen.version);
        const baseAttrs = (base.attributes ?? {}) as Record<string, unknown>;
        const verId = nodeId(`ver:${product.code}/${newName}`);
        await prisma.productNode.create({
          data: {
            id: verId,
            companyId,
            productLevelTypeId: base.productLevelTypeId,
            parentId: product.id,
            dbValue: newName,
            displayValue: newName,
            description: base.description,
            status: 'Active',
            sortOrder: sortOrder++,
            code: base.code,
            attributes: { ...baseAttrs, version: gen.version, generationSeed: true },
          },
        });
        const verAncestors = [...productAncestors, product.id];
        await prisma.productNodeClosure.createMany({
          data: [
            { ancestorId: verId, descendantId: verId, depth: 0 },
            ...verAncestors.map((anc, i) => ({
              ancestorId: anc,
              descendantId: verId,
              depth: verAncestors.length - i,
            })),
          ],
        });

        // Components: clone, then apply the generation's delta ON THE
        // COUNTRYWIDE version (a state form only carries its deviating
        // components — its clone rides along unchanged).
        const isCountrywide = !/US-[A-Z]{2}\b/.test(base.displayValue);
        const kids = components.filter((c) => c.parentId === base.id);
        for (const kid of kids) {
          const kidAttrs = (kid.attributes ?? {}) as Record<string, unknown>;
          const elements = Array.isArray(kidAttrs.elements) ? (kidAttrs.elements as Element[]) : [];
          const adds = isCountrywide ? (gen.delta[kid.displayValue] ?? []) : [];
          const compId = nodeId(`comp:${product.code}/${newName}/${kid.displayValue}`);
          await prisma.productNode.create({
            data: {
              id: compId,
              companyId,
              productLevelTypeId: kid.productLevelTypeId,
              parentId: verId,
              dbValue: kid.dbValue,
              displayValue: kid.displayValue,
              description: kid.description,
              status: kid.status,
              sortOrder: kid.sortOrder,
              code: kid.code,
              attributes: {
                ...kidAttrs,
                elements: [...elements, ...adds],
                generationSeed: true,
              },
            },
          });
          const compAncestors = [...productAncestors, product.id, verId];
          await prisma.productNodeClosure.createMany({
            data: [
              { ancestorId: compId, descendantId: compId, depth: 0 },
              ...compAncestors.map((anc, i) => ({
                ancestorId: anc,
                descendantId: compId,
                depth: compAncestors.length - i,
              })),
            ],
          });
        }

        // The superseded edition moves to Runoff (marker makes reset exact).
        await prisma.productNode.update({
          where: { id: base.id },
          data: { status: 'Runoff', attributes: { ...baseAttrs, supersededBySeed: true } },
        });
      }
      console.log(
        `${plan.product}: seeded ${gen.version} (${baseVersions.length} versions) from ${baseToken}`,
      );

      // Next generation in this plan builds on the one just written.
      const created = await prisma.productNode.findMany({
        where: { companyId, parentId: product.id },
        orderBy: { sortOrder: 'asc' },
      });
      l4.length = 0;
      l4.push(...created);
      baseToken = gen.version;
    }
  }

  // Verify: generation counts per seeded product.
  for (const plan of PLANS) {
    const product = await prisma.productNode.findFirst({
      where: { companyId, displayValue: plan.product, productLevelType: { levelNumber: 3 } },
      select: { id: true },
    });
    if (!product) continue;
    const versions = await prisma.productNode.findMany({
      where: { companyId, parentId: product.id },
      select: { displayValue: true, status: true },
    });
    const byToken = new Map<string, number>();
    for (const v of versions)
      byToken.set(
        versionToken(v.displayValue),
        (byToken.get(versionToken(v.displayValue)) ?? 0) + 1,
      );
    console.log(
      `  ${plan.product}: ${[...byToken.entries()].map(([t, n]) => `${t}×${n}`).join(' ')}`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
