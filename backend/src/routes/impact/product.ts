// Impact walker for product-element subjects (the Products lens). The product
// spine is a self-contained hierarchy (no FKs into the process graph), so the
// walk covers: which versions under the LOB carry the component/element, which
// estate applications its `livesIn` source locations name-match (the only
// bridge to systems of record), prior sign-off decisions in the same
// component, and same-named components in other lines of business.
import { prisma } from '../../db/prisma.js';
import {
  buildReport,
  classOf,
  grade,
  pushCapped,
  type ChangeType,
  type Impact,
  type ImpactRecommendation,
  type ImpactReport,
} from './types.js';

const ITEM_CAP = 10;

/** Knock-on rework areas per model component (impact-analysis steps 3 & 7) —
 *  what to re-verify downstream when an element in this component changes.
 *  Matched loosely against the component name; the last entry is the default. */
const KNOCK_ON: [RegExp, string[]][] = [
  [/coverage/i, ['Forms & filings', 'Rating', 'Underwriting rules', 'Policy admin config']],
  [/underwriting|rule/i, ['Underwriting workbench', 'Rating', 'Regression test packs']],
  [/form|document/i, ['Compliance filings', 'Document generation', 'Regression test packs']],
  [/rating|price|premium/i, ['Rating engine', 'Actuarial models', 'Regression test packs']],
  [/limit|deductible/i, ['Rating', 'Forms & filings', 'Policy admin config']],
  [/eligibility|appetite/i, ['Underwriting rules', 'Distribution / portal screens']],
  [/./, ['Product configuration', 'Regression test packs']],
];

export interface ProductSubject {
  lobId: string;
  component: string;
  elementName?: string;
  componentNodeIds?: string[];
}

function elementsOf(attributes: unknown): { element: string; livesIn: string | null }[] {
  if (!attributes || typeof attributes !== 'object') return [];
  const els = (attributes as Record<string, unknown>).elements;
  if (!Array.isArray(els)) return [];
  return els.flatMap((e) => {
    if (!e || typeof e !== 'object') return [];
    const r = e as Record<string, unknown>;
    if (typeof r.element !== 'string') return [];
    return [{ element: r.element, livesIn: typeof r.livesIn === 'string' ? r.livesIn : null }];
  });
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export async function assessProduct(
  companyId: string,
  subject: ProductSubject,
  changeType: ChangeType,
  label?: string,
): Promise<ImpactReport | null> {
  const cls = classOf(changeType);
  const lob = await prisma.productNode.findFirst({
    where: { id: subject.lobId, companyId },
    select: { id: true, displayValue: true },
  });
  if (!lob) return null;

  const down = await prisma.productNodeClosure.findMany({
    where: { ancestorId: lob.id },
    select: { descendantId: true },
  });
  const nodes = await prisma.productNode.findMany({
    where: { id: { in: down.map((d) => d.descendantId) }, companyId },
    select: {
      id: true,
      displayValue: true,
      parentId: true,
      status: true,
      attributes: true,
      productLevelType: { select: { levelNumber: true } },
    },
  });
  const versions = nodes.filter((n) => n.productLevelType.levelNumber === 4);
  const versionById = new Map(versions.map((v) => [v.id, v]));
  const wantedIds = new Set(subject.componentNodeIds ?? []);
  const compName = norm(subject.component);
  const comps = nodes.filter(
    (n) =>
      n.productLevelType.levelNumber === 5 &&
      (wantedIds.has(n.id) || norm(n.displayValue) === compName),
  );

  const impacts: Impact[] = [];

  // Which versions carry the component (or, when an element is named, carry
  // that element inside the component)?
  const wantedElement = subject.elementName ? norm(subject.elementName) : null;
  const carriers = new Map<string, { versionName: string; status: string | null }>();
  const livesIn = new Set<string>();
  for (const c of comps) {
    const els = elementsOf(c.attributes);
    const relevant = wantedElement
      ? els.filter((e) => {
          const n = norm(e.element);
          return n === wantedElement || n.includes(wantedElement) || wantedElement.includes(n);
        })
      : els;
    if (wantedElement && !relevant.length) continue;
    const version = c.parentId ? versionById.get(c.parentId) : undefined;
    if (version)
      carriers.set(version.id, { versionName: version.displayValue, status: version.status });
    for (const e of relevant) if (e.livesIn) livesIn.add(e.livesIn);
  }
  const live = [...carriers.values()].filter((c) => c.status === 'Active' || c.status === 'Bound');
  if (carriers.size) {
    const names = [...carriers.values()].map((c) => c.versionName);
    impacts.push({
      severity: grade('HIGH', cls),
      category: 'products',
      entityType: 'ProductNode',
      entityId: null,
      entityName: `${carriers.size} of ${versions.length} version${versions.length === 1 ? '' : 's'} carry this`,
      description: `${names.slice(0, 8).join(', ')}${names.length > 8 ? '…' : ''} — each realigns under this decision.`,
      count: carriers.size,
    });
    // Business-value footprint (impact-analysis step 4): how much of the
    // portfolio the element actually reaches — distinct product offerings and
    // live vs draft spread — so a $250K outlier and a $200M standard read
    // differently before the decision is made.
    const productById = new Map(
      nodes.filter((n) => n.productLevelType.levelNumber === 3).map((n) => [n.id, n.displayValue]),
    );
    const productNames = new Set<string>();
    for (const id of carriers.keys()) {
      const parent = versionById.get(id)?.parentId;
      const name = parent ? productById.get(parent) : undefined;
      if (name) productNames.add(name);
    }
    if (productNames.size) {
      impacts.push({
        severity: grade('MEDIUM', cls),
        category: 'products',
        entityType: 'ProductNode',
        entityId: null,
        entityName: `Footprint — ${productNames.size} product offering${productNames.size === 1 ? '' : 's'}, ${live.length} live version${live.length === 1 ? '' : 's'}`,
        description: `${[...productNames].slice(0, 6).join(', ')}${productNames.size > 6 ? '…' : ''} — the business value at stake before rationalizing.`,
        count: productNames.size,
      });
    }
    if (live.length && cls === 'destructive') {
      impacts.push({
        severity: 'BREAKING',
        category: 'products',
        entityType: 'ProductNode',
        entityId: null,
        entityName: `${live.length} live version${live.length === 1 ? '' : 's'} (Active/Bound)`,
        description: 'In-force business carries this element — retiring it changes bound policies.',
        count: live.length,
      });
    }
  }

  // livesIn prose is the only trace to systems of record — name-match it
  // against the estate application catalog.
  if (livesIn.size) {
    const apps = await prisma.application.findMany({
      where: { companyId },
      select: { id: true, name: true, kind: true },
    });
    const texts = [...livesIn].map((t) => ({ raw: t, n: norm(t) }));
    const matched = new Map<string, { name: string; kind: string; where: string }>();
    for (const a of apps) {
      const an = norm(a.name);
      if (!an) continue;
      const hit = texts.find((t) => t.n.includes(an));
      if (hit) matched.set(a.id, { name: a.name, kind: a.kind, where: hit.raw });
    }
    pushCapped(
      impacts,
      [...matched.entries()],
      ITEM_CAP,
      ([id, m]) => ({
        severity: grade(m.kind === 'SystemOfRecord' ? 'BREAKING' : 'HIGH', cls),
        category: 'applications',
        entityType: 'Application',
        entityId: id,
        entityName: m.name,
        description: `Holds this element today (${m.where}) — its data model and screens change.`,
      }),
      (rest) => ({
        severity: grade('HIGH', cls),
        category: 'applications',
        entityType: 'Application',
        entityId: null,
        entityName: `${rest.length} more source systems`,
        description: 'Also hold this element.',
        count: rest.length,
      }),
    );
    const matchedTexts = new Set([...matched.values()].map((m) => m.where));
    const unmatched = [...livesIn].filter((t) => !matchedTexts.has(t));
    if (unmatched.length) {
      impacts.push({
        severity: grade('MEDIUM', cls),
        category: 'applications',
        entityType: 'SourceLocation',
        entityId: null,
        entityName: `${unmatched.length} source location${unmatched.length === 1 ? '' : 's'} outside the catalog`,
        description: `${unmatched.slice(0, 4).join(' · ')}${unmatched.length > 4 ? '…' : ''}`,
        count: unmatched.length,
      });
    }
  }

  // Prior sign-offs in the same component — the decision landscape this one
  // lands into.
  const priorDecisions = await prisma.productNormalizationDecision.count({
    where: { companyId, lobNodeId: lob.id, component: subject.component },
  });
  if (priorDecisions) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      category: 'products',
      entityType: 'ProductNormalizationDecision',
      entityId: null,
      entityName: `${priorDecisions} prior decision${priorDecisions === 1 ? '' : 's'} in ${subject.component}`,
      description: 'Recorded sign-offs in this component — keep the normalization consistent.',
      count: priorDecisions,
    });
  }

  // Same-named component in other lines of business.
  const compIds = comps.map((c) => c.id);
  const crossLob = await prisma.productNode.count({
    where: {
      companyId,
      productLevelType: { levelNumber: 5 },
      displayValue: { equals: subject.component, mode: 'insensitive' },
      ...(compIds.length ? { id: { notIn: compIds } } : {}),
    },
  });
  if (crossLob) {
    impacts.push({
      severity: 'LOW',
      category: 'products',
      entityType: 'ProductNode',
      entityId: null,
      entityName: `${crossLob} same-named component${crossLob === 1 ? '' : 's'} in other lines`,
      description: 'Other LOBs model this component too — a divergent decision splits the model.',
      count: crossLob,
    });
  }

  // Knock-on rework areas (impact-analysis steps 3 & 7): the downstream
  // artifacts a change in this component always touches — filings, rating,
  // rules, test packs — surfaced as one line so the sequel work is priced in.
  const areas = KNOCK_ON.find(([re]) => re.test(subject.component))?.[1] ?? [];
  if (areas.length && carriers.size) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      category: 'knock-on',
      entityType: 'ReworkArea',
      entityId: null,
      entityName: areas.join(' · '),
      description: `A ${subject.component} change re-opens these areas in every carrying version — verify each before the decision lands.`,
      count: areas.length,
    });
  }

  impacts.push({
    severity: 'LOW',
    category: 'scope',
    entityType: 'ProductNode',
    entityId: lob.id,
    entityName: label ?? `${subject.component} · ${lob.displayValue}`,
    description: `${versions.length} version${versions.length === 1 ? '' : 's'} under ${lob.displayValue}, ${comps.length} carrying the ${subject.component} component.`,
  });

  // Rationalization steer (impact-analysis steps 5–6): every outlier resolves
  // to Retain / Standardize / Retire — derived from footprint + live status,
  // advisory only.
  let recommendation: ImpactRecommendation | undefined;
  if (carriers.size) {
    if (carriers.size === versions.length && versions.length > 1) {
      recommendation = {
        option: 'STANDARDIZE',
        reason: 'Carried by every compared version — fold it into the canonical model.',
      };
    } else if (carriers.size === 1 && live.length === 0) {
      recommendation = {
        option: 'RETIRE',
        reason:
          'Outlier in a single version with no live (Active/Bound) business — retire unless a recorded reason (regulatory, market, segment) says otherwise.',
      };
    } else if (carriers.size === 1) {
      recommendation = {
        option: 'RETAIN',
        reason:
          'Single-version outlier with in-force business — record why it exists (regulatory / market / legacy) before standardizing it away.',
      };
    } else {
      recommendation = {
        option: 'STANDARDIZE',
        reason: `Minor variation — ${carriers.size} of ${versions.length} versions carry it; align the rest to the enterprise standard.`,
      };
    }
  }

  return buildReport(
    {
      kind: 'product-element',
      id: lob.id,
      name: label ?? subject.elementName ?? subject.component,
      context: `${subject.component} · ${lob.displayValue}`,
    },
    changeType,
    impacts,
    recommendation,
  );
}
