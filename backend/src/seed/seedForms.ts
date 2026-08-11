// ── Forms Rationalization library seed (FORMS-RATION + SCRUM-229) ──
// Populates the Forms module with a real library:
//   • the nine client manuscript forms (backend/data/forms/manuscripts.json) as
//     anchors, ingested VERBATIM through the segmentClauses + clauseTextHash
//     pipeline the API uses;
//   • SERFF-informed synthetic variant families around each anchor with the
//     controlled-divergence recipe (backend/src/seed/forms/families.ts);
//   • the original six GL demo endorsements, kept alongside.
// It then wires every module surface: working sets (per-family reading sets, an
// all-lines portfolio set, a mode-override spotlight, the GL set), cluster runs,
// citation-backed findings, sample dispositions with event history, preferred
// wordings, the field plane (dictionary + extracted fields + τ-routed mappings)
// and the six-dimension graph links (FormProcessNode / FormApplication).
// Idempotent: every row is replaced wholesale per company.
import type { PrismaClient } from '@prisma/client';
import { segmentClauses, meanSegConfidence } from '../lib/forms/segmentation.js';
import { clauseTextHash } from '../lib/forms/similarity.js';
import { suggestMapping, type MappingCandidate } from '../lib/forms/fieldMapping.js';
import {
  routeMappingStatus,
  routeFindingStatus,
  QUARANTINE_THRESHOLD,
} from '../lib/forms/trust.js';
import type { FindingCitation } from '../routes/forms/helpers.js';
import { buildFamilies, type BuiltForm } from './forms/generate.js';
import { GL_FORMS } from './forms/glDemo.js';
import { DICTIONARY, FIELDS, type FieldSpec } from './forms/fieldPlane.js';
import { runClusterRun, type CreatedCluster } from './forms/clusterRun.js';
import { loadSpecimens } from './forms/specimens.js';
import { buildProductLibrary } from './forms/productLibrary.js';
import { invalidateSpine } from '../lib/resolvers/productBoard.js';

type Ctx = { tenantId: string; companyId: string };

const DEFAULT_THETA = 0.55;

type IngestForm = {
  formNumber: string;
  title: string;
  lob: string;
  states: string[] | null;
  editionDate: string;
  filingStatus: string;
  provenance: string;
  sourceText: string;
  sourceUri?: string;
  fields: FieldSpec[];
};

export async function seedForms(p: PrismaClient, ctx: Ctx): Promise<void> {
  const { tenantId, companyId } = ctx;
  // Wholesale replace (cascades take versions/clauses/fields/clusters/findings/
  // dispositions/mappings/links).
  await p.formWorkingSet.deleteMany({ where: { companyId } });
  await p.policyForm.deleteMany({ where: { companyId } });
  await p.fieldDefinition.deleteMany({ where: { companyId } });

  // Owner role: forms live with product development when present.
  const ownerRole = await p.role.findFirst({
    where: { companyId, displayValue: { contains: 'Product', mode: 'insensitive' } },
    select: { id: true },
  });

  const families = buildFamilies();

  // ── 1. Ingest every form (GL demo + manuscript anchors + synthetic variants) ──
  const glForms: IngestForm[] = GL_FORMS.map((f) => ({
    formNumber: f.formNumber,
    title: f.title,
    lob: f.lob,
    states: f.states,
    editionDate: f.editionDate,
    filingStatus: f.filingStatus,
    provenance: f.provenance ?? 'client',
    sourceText: f.clauses.join('\n'),
    fields: FIELDS[f.formNumber] ?? [],
  }));
  const manuscriptForms: IngestForm[] = families.flatMap((fam) =>
    fam.forms.map((f: BuiltForm) => ({
      formNumber: f.formNumber,
      title: f.title,
      lob: f.lob,
      states: f.states,
      editionDate: f.editionDate,
      filingStatus: f.filingStatus,
      provenance: f.provenance,
      sourceText: f.sourceText,
      fields: FIELDS[f.formNumber] ?? [],
    })),
  );
  // The eleven uploaded specimen examples ingest VERBATIM (fictional carriers).
  const specimenForms: IngestForm[] = loadSpecimens().map((s) => ({
    formNumber: s.formNumber,
    title: s.title,
    lob: s.lob,
    states: s.states,
    editionDate: s.editionDate,
    filingStatus: s.filingStatus,
    provenance: s.provenance,
    sourceText: s.sourceText,
    sourceUri: `documents/forms/form_examples/${s.sourceFile}`,
    fields: FIELDS[s.formNumber] ?? [],
  }));
  const allForms = [...glForms, ...manuscriptForms, ...specimenForms];

  const versionIdByForm: Record<string, string> = {};
  const formIdByForm: Record<string, string> = {};
  const allVersionIds: string[] = [];
  const ingest = async (def: IngestForm): Promise<void> => {
    const segmented = segmentClauses(def.sourceText);
    const segConfidence = meanSegConfidence(segmented);
    const form = await p.policyForm.create({
      data: {
        tenantId,
        companyId,
        formNumber: def.formNumber,
        title: def.title,
        lob: def.lob,
        states: def.states ?? undefined,
        editionDate: def.editionDate,
        filingStatus: def.filingStatus,
        provenance: def.provenance,
        ownerRoleId: ownerRole?.id,
        versions: {
          create: {
            tenantId,
            companyId,
            versionNo: 1,
            status: segConfidence < QUARANTINE_THRESHOLD ? 'quarantined' : 'ready',
            sourceText: def.sourceText,
            sourceUri: def.sourceUri,
            segConfidence,
            clauses: {
              create: segmented.map((c) => ({
                tenantId,
                companyId,
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
            fields: {
              create: def.fields.map((f) => ({
                tenantId,
                companyId,
                sourceName: f.sourceName,
                label: f.label,
                page: 1,
                widgetType: f.widgetType ?? 'text',
                options: f.options ?? undefined,
                selectMode: f.options ? 'single' : undefined,
                required: f.required ?? false,
                instance: 1,
              })),
            },
          },
        },
      },
      include: { versions: { select: { id: true } } },
    });
    versionIdByForm[def.formNumber] = form.versions[0].id;
    formIdByForm[def.formNumber] = form.id;
    allVersionIds.push(form.versions[0].id);
  };
  for (const def of allForms) await ingest(def);

  // ── 1b. Product form families: the per-product base/dec/endorsement/state-
  // amendatory papers every product-spine surface renders, plus the junction
  // links that make the library THE source of truth for product forms. ──
  const manuscriptStates = new Map<string, string[] | null>(
    families.flatMap((fam) => fam.forms.map((f) => [f.formNumber, f.states] as const)),
  );
  const productLib = await buildProductLibrary(
    p,
    companyId,
    new Set(Object.keys(formIdByForm)),
    manuscriptStates,
  );
  for (const def of productLib.defs) await ingest({ ...def, fields: [] });
  const productLinkRows = productLib.links
    .filter((l) => formIdByForm[l.formNumber])
    .map((l) => ({
      companyId,
      formId: formIdByForm[l.formNumber],
      productNodeId: l.productNodeId,
      role_: l.role_,
    }));
  if (productLinkRows.length) {
    await p.formProductNode.createMany({ data: productLinkRows, skipDuplicates: true });
  }
  // Retire the legacy attribute-borne form lists: the L5 "Forms" nodes keep
  // their place in the model structure but carry no elements — the library
  // (via FormProductNode) is the single source the resolvers read.
  for (const nodeId of productLib.formsNodeIds) {
    const node = await p.productNode.findUnique({
      where: { id: nodeId },
      select: { attributes: true },
    });
    const attrs = (node?.attributes as Record<string, unknown> | null) ?? {};
    delete attrs.elements;
    await p.productNode.update({
      where: { id: nodeId },
      data: { attributes: { ...attrs, formsSource: 'policyFormLibrary' } },
    });
  }
  invalidateSpine(companyId);

  // ── 2. Working sets ──
  const createSet = async (
    name: string,
    description: string,
    formNumbers: string[],
    modeOverride?: 'reading' | 'portfolio',
  ) => {
    return p.formWorkingSet.create({
      data: {
        tenantId,
        companyId,
        name,
        description,
        modeOverride,
        clusterThreshold: DEFAULT_THETA,
        members: {
          create: formNumbers
            .filter((fn) => versionIdByForm[fn])
            .map((fn) => ({ companyId, formVersionId: versionIdByForm[fn] })),
        },
      },
    });
  };

  // GL demo set (client-owned only, iso-flagged excluded) — unchanged behavior.
  const glSet = await createSet(
    'GL endorsement rationalization',
    'Additional-insured, primary-and-noncontributory and cancellation wording variants across the regional GL programs.',
    GL_FORMS.filter((f) => f.provenance !== 'iso-flagged').map((f) => f.formNumber),
  );

  // One reading-mode set per manuscript family.
  const familySetIdByKey: Record<string, string> = {};
  for (const fam of families) {
    const set = await createSet(
      `${fam.anchor.title} family`,
      `${fam.anchor.lob} — ${fam.anchor.formNumber} and its SERFF-informed variant editions; controlled clause divergence for rationalization.`,
      fam.forms.map((f) => f.formNumber),
    );
    familySetIdByKey[fam.family.key] = set.id;
  }

  // Portfolio-mode set: all nine manuscript anchors (8+ ⇒ portfolio default).
  const portfolioSet = await createSet(
    'All Manuscript Lines',
    'Every manuscript line anchor in one portfolio-scale set — triage the library across LOBs.',
    families.map((fam) => fam.anchor.formNumber),
  );

  // Mode-override spotlight: a small cross-line set forced to portfolio mode so
  // the override-wins path is exercised (FORMS-HLR-008).
  const spotlightSet = await createSet(
    'Catastrophe & limits spotlight',
    'Cross-line set of property/marine/energy anchors and their limit-divergent editions; pinned to portfolio mode via modeOverride.',
    ['CPP 1016', 'CPP 1114', 'CAR 1220', 'CAR 1316', 'EL 1018', 'EL 1113'],
    'portfolio',
  );

  // ── 3. Cluster runs (production-identical pipeline) ──
  const clustersBySet: Record<string, CreatedCluster[]> = {};
  clustersBySet[glSet.id] = await runClusterRun(p, ctx, glSet.id, DEFAULT_THETA);
  for (const fam of families) {
    const setId = familySetIdByKey[fam.family.key];
    clustersBySet[setId] = await runClusterRun(p, ctx, setId, DEFAULT_THETA);
  }
  clustersBySet[portfolioSet.id] = await runClusterRun(p, ctx, portfolioSet.id, DEFAULT_THETA);
  clustersBySet[spotlightSet.id] = await runClusterRun(p, ctx, spotlightSet.id, DEFAULT_THETA);

  // ── 4. Explicit citation-backed findings (materially-divergent, missing-clause) ──
  const clauseByFormHeading = await loadClauseIndex(p, allVersionIds, versionIdByForm);
  for (const fam of families) {
    const setId = familySetIdByKey[fam.family.key];
    for (const marker of fam.markers) {
      if (marker.kind === 'materially-divergent') {
        const anchorClause = clauseByFormHeading.get(
          key(marker.anchorFormNumber, marker.clauseHeading),
        );
        const variantClause = clauseByFormHeading.get(key(marker.formNumber, marker.clauseHeading));
        if (!anchorClause || !variantClause) continue;
        await p.formFinding.create({
          data: {
            tenantId,
            companyId,
            workingSetId: setId,
            formVersionId: versionIdByForm[marker.formNumber],
            subjectKind: 'clausePair',
            claim: `Materially divergent: "${marker.clauseHeading}" in ${marker.formNumber} changes a limit / notice term versus anchor ${marker.anchorFormNumber} — the wording is close but the economic term differs, so it cannot be standardized without a decision.`,
            citations: [citation(anchorClause), citation(variantClause)],
            confidence: marker.confidence,
            status: routeFindingStatus(marker.confidence),
            agentSkill: 'divergence-check-v1',
            traceRef: `divergence:${marker.familyKey}:${marker.formNumber}`,
          },
        });
      } else {
        const anchorClause = clauseByFormHeading.get(
          key(marker.anchorFormNumber, marker.clauseHeading),
        );
        if (!anchorClause) continue;
        await p.formFinding.create({
          data: {
            tenantId,
            companyId,
            workingSetId: setId,
            formVersionId: versionIdByForm[marker.formNumber],
            subjectKind: 'form',
            claim: `Missing clause: ${marker.formNumber} omits the "${marker.clauseHeading}" provision that ${marker.presentIn.length} sibling edition(s) carry — confirm the omission is intentional before rationalizing.`,
            citations: [citation(anchorClause)],
            confidence: marker.confidence,
            status: routeFindingStatus(marker.confidence),
            agentSkill: 'coverage-gap-v1',
            traceRef: `missing:${marker.familyKey}:${marker.formNumber}`,
          },
        });
      }
    }
  }

  // ── 5. Sample dispositions with append-only event history ──
  await seedDispositions(p, ctx, {
    ownerRoleId: ownerRole?.id,
    formIdByForm,
    clustersBySet,
    familySetIdByKey,
  });

  // ── 6. Preferred wordings on a few resolved clusters ──
  await seedPreferredWordings(p, ctx, { clustersBySet, familySetIdByKey });

  // ── 7. Field plane: dictionary + τ-routed mapping suggestions ──
  await seedFieldPlane(p, ctx, allVersionIds);

  // ── 8. Six-dimension graph links (connected-additions rule: no orphans) ──
  await seedGraphLinks(p, ctx, { families, formIdByForm });
}

// ── helpers ──────────────────────────────────────────────────────────────

const key = (formNumber: string, heading: string) => `${formNumber}::${heading}`;

type IndexedClause = {
  id: string;
  formVersionId: string;
  charStart: number;
  charEnd: number;
  text: string;
};

function citation(c: IndexedClause): FindingCitation {
  return {
    formVersionId: c.formVersionId,
    clauseId: c.id,
    charStart: c.charStart,
    charEnd: c.charEnd,
    quote: c.text,
  };
}

async function loadClauseIndex(
  p: PrismaClient,
  versionIds: string[],
  versionIdByForm: Record<string, string>,
): Promise<Map<string, IndexedClause>> {
  const formByVersion = new Map(Object.entries(versionIdByForm).map(([fn, vid]) => [vid, fn]));
  const clauses = await p.formClause.findMany({
    where: { formVersionId: { in: versionIds } },
    select: {
      id: true,
      formVersionId: true,
      heading: true,
      text: true,
      charStart: true,
      charEnd: true,
    },
  });
  const map = new Map<string, IndexedClause>();
  for (const c of clauses) {
    const fn = formByVersion.get(c.formVersionId);
    if (!fn || !c.heading) continue;
    map.set(key(fn, c.heading), {
      id: c.id,
      formVersionId: c.formVersionId,
      charStart: c.charStart,
      charEnd: c.charEnd,
      text: c.text,
    });
  }
  return map;
}

async function seedDispositions(
  p: PrismaClient,
  ctx: Ctx,
  args: {
    ownerRoleId?: string;
    formIdByForm: Record<string, string>;
    clustersBySet: Record<string, CreatedCluster[]>;
    familySetIdByKey: Record<string, string>;
  },
): Promise<void> {
  const { tenantId, companyId } = ctx;
  const { ownerRoleId, formIdByForm, clustersBySet, familySetIdByKey } = args;

  // Append-only history helper.
  const withEvents = (events: { event: string; note?: string }[]) => ({
    create: events.map((e) => ({
      companyId,
      event: e.event,
      actorKind: 'agent',
      actorId: 'forms-seed',
      note: e.note,
    })),
  });

  // (a) RETIRE — approved & executed: the superseded CYB 1008 edition.
  if (formIdByForm['CYB 1008']) {
    await p.formDisposition.create({
      data: {
        tenantId,
        companyId,
        subjectKind: 'form',
        formId: formIdByForm['CYB 1008'],
        type: 'retire',
        ownerRoleId,
        rationale:
          'CYB 1008 is superseded by CYB 1009 (higher aggregate limit); retire the prior edition.',
        status: 'executed',
        events: withEvents([
          { event: 'proposed', note: 'Superseded edition still active in the library.' },
          { event: 'approved', note: 'Product committee approved retirement.' },
          { event: 'executed', note: 'Withdrawn from active use; kept for audit history.' },
        ]),
      },
    });
  }

  // (b) MERGE — proposed, with target: DO 1108 (core) into DO 1011 (anchor).
  if (formIdByForm['DO 1108'] && formIdByForm['DO 1011']) {
    await p.formDisposition.create({
      data: {
        tenantId,
        companyId,
        subjectKind: 'form',
        formId: formIdByForm['DO 1108'],
        type: 'merge',
        targetFormId: formIdByForm['DO 1011'],
        ownerRoleId,
        rationale:
          'DO 1108 differs from DO 1011 only in equivalent wording; propose merging into the anchor.',
        status: 'proposed',
        events: withEvents([
          { event: 'proposed', note: 'Near-duplicate coverage clause; merge candidate.' },
        ]),
      },
    });
  }

  // (c) REDRAFT — proposed, on a divergent cluster in the CYB family set.
  const cybClusters = clustersBySet[familySetIdByKey['CYB']] ?? [];
  const redraftCluster =
    cybClusters.find((c) => c.label.toLowerCase().includes('exclusion')) ??
    cybClusters
      .filter((c) => c.memberClauseIds.length > 1)
      .sort((a, b) => b.divergenceScore - a.divergenceScore)[0];
  if (redraftCluster) {
    await p.formDisposition.create({
      data: {
        tenantId,
        companyId,
        subjectKind: 'cluster',
        clusterId: redraftCluster.id,
        type: 'redraft',
        ownerRoleId,
        rationale: `Cluster "${redraftCluster.label}" diverges across editions; redraft one standard wording.`,
        status: 'proposed',
        events: withEvents([
          { event: 'proposed', note: 'Divergent exclusion wording flagged for a single redraft.' },
        ]),
      },
    });
  }

  // (d) KEEP — proposed, on the CPP 1016 anchor (system of record).
  if (formIdByForm['CPP 1016']) {
    await p.formDisposition.create({
      data: {
        tenantId,
        companyId,
        subjectKind: 'form',
        formId: formIdByForm['CPP 1016'],
        type: 'keep',
        ownerRoleId,
        rationale:
          'CPP 1016 is the countrywide system-of-record program form; keep as the family anchor.',
        status: 'proposed',
        events: withEvents([{ event: 'proposed', note: 'Anchor edition; keep.' }]),
      },
    });
  }
}

async function seedPreferredWordings(
  p: PrismaClient,
  ctx: Ctx,
  args: {
    clustersBySet: Record<string, CreatedCluster[]>;
    familySetIdByKey: Record<string, string>;
  },
): Promise<void> {
  const { tenantId, companyId } = ctx;
  const { clustersBySet, familySetIdByKey } = args;
  // One resolved cluster per ~3 families: pick the highest-divergence multi-member
  // cluster in three family sets and adopt its representative as the standard.
  const chosenKeys = ['CAN', 'CPP', 'PE'];
  for (const famKey of chosenKeys) {
    const setId = familySetIdByKey[famKey];
    const clusters = (clustersBySet[setId] ?? [])
      .filter((c) => c.memberClauseIds.length > 1 && c.representativeClauseId)
      .sort((a, b) => b.divergenceScore - a.divergenceScore);
    const target = clusters[0];
    if (!target || !target.representativeClauseId) continue;
    const rep = await p.formClause.findUnique({
      where: { id: target.representativeClauseId },
      select: { id: true, text: true },
    });
    if (!rep) continue;
    await p.preferredWording.upsert({
      where: { clusterId: target.id },
      create: {
        tenantId,
        companyId,
        clusterId: target.id,
        sourceClauseId: rep.id,
        clauseText: rep.text,
        status: 'active',
      },
      update: { sourceClauseId: rep.id, clauseText: rep.text, status: 'active' },
    });
  }
}

async function seedGraphLinks(
  p: PrismaClient,
  ctx: Ctx,
  args: { families: ReturnType<typeof buildFamilies>; formIdByForm: Record<string, string> },
): Promise<void> {
  const { companyId } = ctx;
  const { families, formIdByForm } = args;

  // GL demo wiring (Underwriting + Product & Delivery; policy-admin + UW apps).
  const glValueStreams = ['Underwriting', 'Product & Delivery'];
  const glApps: { name: string; role_: 'implementedBy' | 'feedsApplication' }[] = [
    { name: 'Policy Administration Platform', role_: 'implementedBy' },
    { name: 'Underwriting Platform', role_: 'feedsApplication' },
  ];

  // Resolve every referenced L2 value stream + application id in one pass.
  const vsNames = new Set<string>(glValueStreams);
  const appNames = new Set<string>(glApps.map((a) => a.name));
  for (const fam of families) {
    fam.family.valueStreams.forEach((v) => vsNames.add(v));
    fam.family.applications.forEach((a) => appNames.add(a.name));
  }
  const [nodes, apps, formTask] = await Promise.all([
    p.processNode.findMany({
      where: {
        companyId,
        displayValue: { in: [...vsNames] },
        processLevelType: { levelNumber: 2 },
      },
      select: { id: true, displayValue: true },
    }),
    p.application.findMany({
      where: { companyId, name: { in: [...appNames] } },
      select: { id: true, name: true },
    }),
    p.processNode.findFirst({
      where: {
        companyId,
        isTask: true,
        displayValue: { contains: 'form versions', mode: 'insensitive' },
      },
      select: { id: true },
    }),
  ]);
  const nodeByName = new Map(nodes.map((n) => [n.displayValue, n.id]));
  const appByName = new Map(apps.map((a) => [a.name, a.id]));

  const processRows: { companyId: string; formId: string; processNodeId: string; role_: string }[] =
    [];
  const appRows: { companyId: string; formId: string; applicationId: string; role_: string }[] = [];

  const wire = (
    formNumber: string,
    valueStreams: string[],
    applications: { name: string; role_: 'implementedBy' | 'feedsApplication' }[],
  ) => {
    const formId = formIdByForm[formNumber];
    if (!formId) return;
    for (const vs of valueStreams) {
      const nodeId = nodeByName.get(vs);
      if (nodeId)
        processRows.push({ companyId, formId, processNodeId: nodeId, role_: 'servesValueStream' });
    }
    // Change-impact hop: forms impact the "apply state-specific form versions" task.
    if (formTask)
      processRows.push({ companyId, formId, processNodeId: formTask.id, role_: 'impactsTask' });
    for (const a of applications) {
      const appId = appByName.get(a.name);
      if (appId) appRows.push({ companyId, formId, applicationId: appId, role_: a.role_ });
    }
  };

  for (const f of GL_FORMS) wire(f.formNumber, glValueStreams, glApps);
  for (const fam of families) {
    for (const f of fam.forms) wire(f.formNumber, fam.family.valueStreams, fam.family.applications);
  }

  if (processRows.length)
    await p.formProcessNode.createMany({ data: processRows, skipDuplicates: true });
  if (appRows.length) await p.formApplication.createMany({ data: appRows, skipDuplicates: true });
}

async function seedFieldPlane(p: PrismaClient, ctx: Ctx, versionIds: string[]): Promise<void> {
  const { tenantId, companyId } = ctx;
  const defIdByKey: Record<string, string> = {};
  for (const d of DICTIONARY) {
    const row = await p.fieldDefinition.create({
      data: {
        tenantId,
        companyId,
        key: d.key,
        dataSetType: d.dataSetType,
        dataType: d.dataType ?? 'string',
        acordRef: d.acordRef,
        stability: d.stability ?? 'stable',
        compositionParts: d.compositionParts ?? undefined,
        compositionFormat: d.compositionFormat,
      },
    });
    defIdByKey[d.key] = row.id;
  }
  const candidates: MappingCandidate[] = DICTIONARY.map((d) => ({
    id: defIdByKey[d.key],
    key: d.key,
    stability: d.stability ?? 'stable',
    optionValues: [],
  }));
  const fields = await p.formField.findMany({
    where: { formVersionId: { in: versionIds } },
    select: { id: true, sourceName: true, label: true, options: true },
  });
  for (const field of fields) {
    const optionLabels = Array.isArray(field.options)
      ? (field.options as { label?: string }[]).map((o) => o.label ?? '').filter(Boolean)
      : [];
    const suggestion = suggestMapping(
      { sourceName: field.sourceName, label: field.label, optionLabels },
      candidates,
    );
    if (!suggestion) continue;
    await p.fieldMapping.create({
      data: {
        tenantId,
        companyId,
        formFieldId: field.id,
        fieldDefinitionId: suggestion.fieldDefinitionId,
        confidence: suggestion.confidence,
        nameSim: suggestion.nameSim,
        labelSim: suggestion.labelSim,
        optionOverlap: suggestion.optionOverlap,
        status: routeMappingStatus(suggestion.confidence),
      },
    });
  }
}
