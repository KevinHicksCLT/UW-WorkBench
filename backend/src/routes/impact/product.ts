// Impact walker for product-element subjects (the Products lens). The product
// spine is a self-contained hierarchy (no FKs into the process graph), so the
// walk covers: which versions under the LOB carry the component/element, which
// estate applications its `livesIn` source locations name-match (the only
// bridge to systems of record), prior sign-off decisions in the same
// component, and same-named components in other lines of business.
import { prisma } from '../../db/prisma.js';
import {
  buildHeatmap,
  loadDecisions,
  loadSpine,
  parseStates,
  scopeLobs,
} from '../../lib/resolvers/productBoard.js';
import { deriveStakeholders } from './stakeholders.js';
import {
  buildReport,
  classOf,
  grade,
  pushCapped,
  type ChangeType,
  type DecisionScore,
  type GoalProgress,
  type Impact,
  type ImpactReport,
} from './types.js';

const ITEM_CAP = 10;

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
  const carriers = new Map<
    string,
    { versionName: string; status: string | null; attributes: unknown }
  >();
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
      carriers.set(version.id, {
        versionName: version.displayValue,
        status: version.status,
        attributes: version.attributes,
      });
    for (const e of relevant) if (e.livesIn) livesIn.add(e.livesIn);
  }
  const live = [...carriers.values()].filter((c) => c.status === 'Active' || c.status === 'Bound');
  if (carriers.size) {
    const names = [...carriers.values()].map((c) => c.versionName);
    impacts.push({
      severity: grade('HIGH', cls),
      domain: 'product',
      category: 'products',
      entityType: 'ProductNode',
      entityId: null,
      entityName: `Included in ${carriers.size} of ${versions.length} product version${versions.length === 1 ? '' : 's'}`,
      description: `${names.slice(0, 8).join(', ')}${names.length > 8 ? '…' : ''} — each of these products includes this item today and will need to be updated if you proceed.`,
      count: carriers.size,
    });
    if (live.length && cls === 'destructive') {
      impacts.push({
        severity: 'BREAKING',
        domain: 'product',
        category: 'products',
        entityType: 'ProductNode',
        entityId: null,
        entityName: `${live.length} version${live.length === 1 ? '' : 's'} with policies in force today`,
        description:
          'Customers hold active policies on these versions. Removing this item changes what those customers bought — it cannot simply be switched off.',
        count: live.length,
      });
    }

    // States the carrying versions are written in — the geographic footprint
    // of the change, and (for a destructive/restructuring change) the filing
    // obligation that follows from it.
    const states = [
      ...new Set(
        [...carriers.entries()].flatMap(([, c]) => parseStates(c.attributes, c.versionName)),
      ),
    ].sort();
    if (states.length) {
      impacts.push({
        severity: grade('HIGH', cls),
        domain: 'product',
        category: 'products',
        entityType: 'ProductNode',
        entityId: null,
        entityName: `Sold in ${states.length} state${states.length === 1 ? '' : 's'}`,
        description: `This item is filed and in use in ${states.slice(0, 12).join(', ')}${states.length > 12 ? '…' : ''}. The change applies in every one of these states.`,
        count: states.length,
      });
      if (cls !== 'adopt') {
        impacts.push({
          severity: grade('HIGH', cls),
          domain: 'compliance',
          category: 'compliance',
          entityType: 'ProductNode',
          entityId: null,
          entityName: `Regulatory filings needed in ${states.length} state${states.length === 1 ? '' : 's'}`,
          description:
            'This item is part of a filed product. Each state needs an amended form filing, updated rates or rules where they apply, and notice to the regulator before the change can take effect.',
          count: states.length,
        });
      }
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
        domain: 'technology',
        category: 'applications',
        entityType: 'Application',
        entityId: id,
        entityName: m.name,
        description: `This system holds the item today (${m.where}). Its screens, rules and stored data need to be updated to match the decision.`,
      }),
      (rest) => ({
        severity: grade('HIGH', cls),
        domain: 'technology',
        category: 'applications',
        entityType: 'Application',
        entityId: null,
        entityName: `${rest.length} more systems hold this item`,
        description: 'Each also needs its configuration reviewed against this decision.',
        count: rest.length,
      }),
    );
    // Systems of record among the matches are a DATA impact too — the element
    // lives in their data model and flows into the warehouse and analytics.
    const sorCount = [...matched.values()].filter((m) => m.kind === 'SystemOfRecord').length;
    if (sorCount) {
      impacts.push({
        severity: grade('HIGH', cls),
        domain: 'data',
        category: 'applications',
        entityType: 'Application',
        entityId: null,
        entityName: `${sorCount} system${sorCount === 1 ? '' : 's'} of record hold this item`,
        description:
          'Reports, data feeds and analytics read this item from these systems. Downstream extracts and dashboards built on it will need re-mapping.',
        count: sorCount,
      });
    }
    const matchedTexts = new Set([...matched.values()].map((m) => m.where));
    const unmatched = [...livesIn].filter((t) => !matchedTexts.has(t));
    if (unmatched.length) {
      impacts.push({
        severity: grade('MEDIUM', cls),
        domain: 'data',
        category: 'applications',
        entityType: 'SourceLocation',
        entityId: null,
        entityName: `${unmatched.length} other place${unmatched.length === 1 ? '' : 's'} this item lives today`,
        description: `Not matched to the application catalog — check these by hand: ${unmatched.slice(0, 4).join(' · ')}${unmatched.length > 4 ? '…' : ''}`,
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
      domain: 'product',
      category: 'products',
      entityType: 'ProductNormalizationDecision',
      entityId: null,
      entityName: `${priorDecisions} decision${priorDecisions === 1 ? '' : 's'} already made in ${subject.component}`,
      description:
        'Your team has already signed off decisions in this area. Check this one follows the same direction so the target model stays consistent.',
      count: priorDecisions,
    });
  }

  // Cross-LOB overlap — scoped to what is actually being decided. With a
  // named element, count the OTHER LOBs carrying that same element (a state
  // endorsement decided in one line rarely exists elsewhere — the count must
  // say so, not repeat the component-wide figure on every report).
  let crossLob = 0;
  if (wantedElement) {
    const spine = await loadSpine(companyId);
    for (const l of spine.lobs) {
      if (l.id === lob.id) continue;
      const carries = l.versions.some((v) => {
        const comp = v.components.get(subject.component);
        return (
          !!comp &&
          comp.elements.some((e) => {
            const n = norm(e.element);
            return n === wantedElement || n.includes(wantedElement) || wantedElement.includes(n);
          })
        );
      });
      if (carries) crossLob += 1;
    }
    if (crossLob) {
      impacts.push({
        severity: 'LOW',
        domain: 'product',
        category: 'products',
        entityType: 'ProductNode',
        entityId: null,
        entityName: `${crossLob} other line${crossLob === 1 ? '' : 's'} of business carr${crossLob === 1 ? 'ies' : 'y'} this element too`,
        description:
          'The same element appears in other lines of business. Deciding differently here would create two standards for the same thing.',
        count: crossLob,
      });
    }
  } else {
    const compIds = comps.map((c) => c.id);
    crossLob = await prisma.productNode.count({
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
        domain: 'product',
        category: 'products',
        entityType: 'ProductNode',
        entityId: null,
        entityName: `${crossLob} other line${crossLob === 1 ? '' : 's'} of business model${crossLob === 1 ? 's' : ''} this too`,
        description:
          'The same component exists in other lines of business. Deciding differently here would create two standards for the same thing.',
        count: crossLob,
      });
    }
  }

  impacts.push({
    severity: 'LOW',
    domain: 'product',
    category: 'scope',
    entityType: 'ProductNode',
    entityId: lob.id,
    entityName: label ?? `${subject.component} · ${lob.displayValue}`,
    description: subject.elementName
      ? `Scope of this check: “${subject.elementName}” in the ${subject.component} component — carried by ${carriers.size} of ${versions.length} product version${versions.length === 1 ? '' : 's'} under ${lob.displayValue}.`
      : `Scope of this check: ${versions.length} product version${versions.length === 1 ? '' : 's'} under ${lob.displayValue}, ${comps.length} with a ${subject.component} component.`,
  });

  const stakeholders = deriveStakeholders(impacts, { changeType, lens: 'product' });
  return buildReport(
    {
      kind: 'product-element',
      id: lob.id,
      name: label ?? subject.elementName ?? subject.component,
      context: `${subject.component} · ${lob.displayValue}`,
    },
    changeType,
    impacts,
    {
      stakeholders,
      score: scoreDecision(impacts, carriers.size, versions.length, live.length),
      goal: await goalProgress(companyId, lob.id, lob.displayValue),
    },
  );
}

/** The quantified decision aid: how confidently the evidence points at one of
 *  the board's three actions. Carriage is the primary signal (the same >50%
 *  rule the heat map uses), in-force exposure vetoes Retire, and the report's
 *  own severity mix tempers confidence. */
function scoreDecision(
  impacts: Impact[],
  carrierCount: number,
  versionCount: number,
  liveCount: number,
): DecisionScore {
  const carriage = versionCount ? carrierCount / versionCount : 0;
  const pctCarried = Math.round(carriage * 100);
  const breaking = impacts.filter((i) => i.severity === 'BREAKING').length;
  const high = impacts.filter((i) => i.severity === 'HIGH').length;
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

  let recommendation: DecisionScore['recommendation'];
  let value: number;
  let headline: string;
  if (carriage * 2 > 1) {
    recommendation = 'STANDARDIZE';
    value = clamp(55 + carriage * 40 - breaking * 8 - high * 2, 35, 98);
    headline =
      carriage === 1
        ? 'Every product in scope already carries this — fold it into the consolidated multi-state policy.'
        : 'Most products already carry this — standardize it into the consolidated multi-state policy.';
  } else if (liveCount === 0) {
    recommendation = 'RETIRE';
    value = clamp(55 + (1 - carriage * 2) * 35 - breaking * 8 - high * 2, 35, 95);
    headline =
      'Under half the products carry this and no in-force policies depend on it — a strong candidate to drop from the target model.';
  } else {
    recommendation = 'RETAIN';
    value = clamp(45 + liveCount * 6 + breaking * 4, 40, 90);
    headline =
      'Under half the products carry this, but live policies depend on it — keep it as a product-specific variant until the in-force business runs off.';
  }
  return {
    value,
    recommendation,
    headline,
    factors: [
      {
        label: 'Adoption',
        detail: `Carried by ${carrierCount} of ${versionCount} product version${versionCount === 1 ? '' : 's'} (${pctCarried}%).`,
      },
      {
        label: 'In-force business',
        detail: liveCount
          ? `${liveCount} live version${liveCount === 1 ? '' : 's'} (Active/Bound) carry it today.`
          : 'No live versions depend on it.',
      },
      {
        label: 'Change risk',
        detail:
          breaking + high > 0
            ? `${breaking} critical and ${high} high impact${breaking + high === 1 ? '' : 's'} found in this assessment.`
            : 'No critical or high impacts found in this assessment.',
      },
    ],
  };
}

/** Where the LOB stands against the normalization end goal, so every decision
 *  panel shows the target the decision moves toward. Decisions are persisted —
 *  the figure survives leaving and returning across workflows. */
async function goalProgress(
  companyId: string,
  lobId: string,
  lobName: string,
): Promise<GoalProgress | undefined> {
  try {
    const [spine, decisions] = await Promise.all([loadSpine(companyId), loadDecisions(companyId)]);
    const lob = spine.lobs.find((l) => l.id === lobId);
    if (!lob) return undefined;
    // Same default scope as the board: each product's latest generation only.
    const scoped = scopeLobs([lob], {
      segments: [],
      lobIds: [],
      offerings: [],
      states: [],
      versionTokens: [],
      versionIds: [],
    });
    const heat = buildHeatmap(scoped, decisions);
    return {
      label: 'One consolidated multi-state policy per line of business',
      lobName,
      decided: heat.totals.decided,
      need: heat.totals.need,
      pct: heat.totals.pct,
    };
  } catch {
    // The goal strip is enrichment — never fail the assessment over it.
    return undefined;
  }
}
