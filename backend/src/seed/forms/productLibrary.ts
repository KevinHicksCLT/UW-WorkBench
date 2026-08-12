// ── Product form-family generator (SCRUM-229 forms single-source-of-truth) ──
// Reads the product spine (L3 products → L4 version nodes) and emits the
// synthetic form family every product's register renders: base paper +
// declarations + endorsements countrywide, one state amendatory endorsement
// per state a product files its own version in. Every emitted form is a
// PolicyForm library row; FormProductNode links wire them to the L4 version
// nodes the workspace / product-model surfaces resolve forms from. Content is
// specimen-grade synthetic wording (chassis*.ts) — no real carrier text.
import type { PrismaClient } from '@prisma/client';
import { STATE_NAMES } from '../../lib/resolvers/productBoard.js';
import type { FormChassis } from './chassisTypes.js';
import { PERSONAL_CHASSIS } from './chassisPersonal.js';
import { COMMERCIAL_CHASSIS } from './chassisCommercial.js';
import { SPECIALTY_CHASSIS } from './chassisSpecialty.js';
import {
  buildGenericProvisions,
  CHASSIS_BY_PRODUCT,
  MANUSCRIPT_FAMILY_PRODUCT,
  PAPER_BY_PRODUCT,
  PREFIX_BY_PRODUCT,
  PROVISION_FLAVOR,
  STATE_PROVISIONS,
} from './productFormCatalog.js';

const CHASSIS: Record<string, FormChassis> = {
  ...PERSONAL_CHASSIS,
  ...COMMERCIAL_CHASSIS,
  ...SPECIALTY_CHASSIS,
};

export type ProductFormRole = 'baseForm' | 'declarations' | 'endorsement' | 'stateAmendatory';

export type ProductFormDef = {
  formNumber: string;
  title: string;
  lob: string;
  states: string[] | null;
  editionDate: string;
  filingStatus: string;
  provenance: string;
  sourceText: string;
};

export type ProductFormLink = {
  formNumber: string;
  productNodeId: string;
  role_: ProductFormRole;
};

export type ProductLibrary = {
  defs: ProductFormDef[]; // new forms to ingest (deduped by formNumber)
  links: ProductFormLink[]; // formNumber → L4 version node links (all forms)
  formsNodeIds: string[]; // L5 "Forms" nodes whose element payloads must go
};

const LETTERS = 'ABCDEFGHIJ';

const upper = (s: string) => s.toUpperCase();

function joinNumber(prefix: string, tail: string): string {
  return prefix.includes('-') ? `${prefix}-${tail}` : `${prefix} ${tail}`;
}

function baseSourceText(chassis: FormChassis, title: string, productName: string): string {
  const out: string[] = [upper(title)];
  out.push('AGREEMENT');
  out.push(
    `We will provide the insurance described in this ${chassis.documentKind === 'policy' ? 'policy' : chassis.documentKind === 'binder' ? 'binder' : chassis.documentKind === 'treaty-wording' ? 'agreement' : 'coverage form'} for the ${productName} program in return for the premium and compliance with all applicable provisions.`,
  );
  out.push('DEFINITIONS');
  for (const d of chassis.definitions) {
    // Chassis texts may already open with "Term means …" — never double it.
    const body = d.text.replace(
      new RegExp(`^${d.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+means\\s+`, 'i'),
      '',
    );
    out.push(`"${d.term}" means ${body}`);
  }
  out.push(
    chassis.documentKind === 'treaty-wording' ? 'REINSURING AGREEMENTS' : 'INSURING AGREEMENTS',
  );
  for (const ia of chassis.insuringAgreements) {
    out.push(upper(ia.name));
    out.push(ia.text);
  }
  out.push('LIMITS OF LIABILITY');
  out.push(chassis.limitsNote);
  out.push('EXCLUSIONS');
  out.push('This insurance does not apply to:');
  chassis.exclusions.forEach((ex, i) => {
    out.push(`${i + 1}. ${ex.name} - ${ex.text}`);
  });
  out.push('CONDITIONS');
  chassis.conditions.forEach((c, i) => {
    out.push(`${LETTERS[i] ?? 'Z'}. ${c.name}. ${c.text}`);
  });
  return out.join('\n');
}

function declarationsSourceText(title: string, chassis: FormChassis, productName: string): string {
  const out: string[] = [upper(title)];
  out.push(
    `These Declarations, together with the ${productName} policy form and attached endorsements, complete the contract of insurance.`,
  );
  out.push('SCHEDULE');
  chassis.decItems.forEach((item, i) => {
    out.push(`${i + 1}. ${item}`);
  });
  out.push('FORMS AND ENDORSEMENTS');
  out.push(
    'The forms and endorsements attached at issue are listed on the schedule of forms; each applies only as shown.',
  );
  return out.join('\n');
}

function endorsementSourceText(title: string, baseTitle: string, body: string): string {
  const out: string[] = [upper(title)];
  out.push('THIS ENDORSEMENT CHANGES THE POLICY. PLEASE READ IT CAREFULLY.');
  out.push(`This endorsement modifies insurance provided under the ${baseTitle}.`);
  out.push(body.trim());
  out.push('All other provisions of this policy apply.');
  return out.join('\n');
}

function amendatorySourceText(
  stateCode: string,
  baseTitle: string,
  flavor: 'property' | 'auto' | 'wc' | 'liability' | 'generic',
): string {
  const stateName = STATE_NAMES[stateCode] ?? stateCode;
  const authored = STATE_PROVISIONS[stateCode]?.[flavor] ?? STATE_PROVISIONS[stateCode]?.generic;
  const provisions = authored ?? buildGenericProvisions(stateCode, stateName);
  const out: string[] = [`SPECIAL PROVISIONS - ${upper(stateName)}`];
  out.push('THIS ENDORSEMENT CHANGES THE POLICY. PLEASE READ IT CAREFULLY.');
  out.push(`This endorsement modifies insurance provided under the ${baseTitle}.`);
  provisions.forEach((p, i) => {
    out.push(`${LETTERS[i] ?? 'Z'}. ${p}`);
  });
  out.push('All other provisions of this policy apply.');
  return out.join('\n');
}

type SpineProduct = {
  code: string;
  name: string;
  lobName: string;
  versionNodes: { id: string; states: string[]; kind: string }[];
  formsNodeIds: string[];
};

async function loadProducts(p: PrismaClient, companyId: string): Promise<SpineProduct[]> {
  const levels = await p.productLevelType.findMany({
    where: { companyId },
    select: { id: true, levelNumber: true },
  });
  const levelOf = new Map(levels.map((l) => [l.id, l.levelNumber]));
  const nodes = await p.productNode.findMany({
    where: { companyId },
    select: {
      id: true,
      parentId: true,
      displayValue: true,
      code: true,
      attributes: true,
      productLevelTypeId: true,
    },
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const byParent = new Map<string | null, typeof nodes>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }
  const products: SpineProduct[] = [];
  for (const n of nodes) {
    if (levelOf.get(n.productLevelTypeId) !== 3 || !n.code) continue;
    const lob = n.parentId ? byId.get(n.parentId) : undefined;
    const versionNodes: SpineProduct['versionNodes'] = [];
    const formsNodeIds: string[] = [];
    for (const v of byParent.get(n.id) ?? []) {
      if (levelOf.get(v.productLevelTypeId) !== 4) continue;
      const attrs = v.attributes as { states?: unknown; kind?: unknown } | null;
      const states = Array.isArray(attrs?.states)
        ? attrs.states.filter((s): s is string => typeof s === 'string')
        : [];
      versionNodes.push({
        id: v.id,
        states,
        kind: typeof attrs?.kind === 'string' ? attrs.kind : 'countrywide',
      });
      for (const c of byParent.get(v.id) ?? []) {
        if (c.displayValue === 'Forms') formsNodeIds.push(c.id);
      }
    }
    products.push({
      code: n.code,
      name: n.displayValue,
      lobName: lob?.displayValue ?? n.displayValue,
      versionNodes,
      formsNodeIds,
    });
  }
  return products;
}

/** Manuscript family key of a form number ("CYB 1009" → CYB). */
const familyKeyOf = (formNumber: string) => formNumber.split(/[\s-]/)[0];

export async function buildProductLibrary(
  p: PrismaClient,
  companyId: string,
  existingFormNumbers: ReadonlySet<string>,
  manuscriptStates: ReadonlyMap<string, string[] | null>,
): Promise<ProductLibrary> {
  const products = await loadProducts(p, companyId);
  const defs = new Map<string, ProductFormDef>();
  const links: ProductFormLink[] = [];
  const formsNodeIds: string[] = [];

  const addDef = (def: ProductFormDef) => {
    if (!existingFormNumbers.has(def.formNumber) && !defs.has(def.formNumber)) {
      defs.set(def.formNumber, def);
    }
  };
  const linkAll = (formNumber: string, nodeIds: string[], role_: ProductFormRole) => {
    for (const productNodeId of nodeIds) links.push({ formNumber, productNodeId, role_ });
  };

  for (const product of products) {
    const chassisKey = CHASSIS_BY_PRODUCT[product.code];
    const chassis = chassisKey ? CHASSIS[chassisKey] : undefined;
    const prefix = PREFIX_BY_PRODUCT[product.code];
    if (!chassis || !prefix || product.versionNodes.length === 0) continue;
    formsNodeIds.push(...product.formsNodeIds);

    const paper = PAPER_BY_PRODUCT[product.code] ?? {};
    const allNodeIds = product.versionNodes.map((v) => v.id);
    const flavor = PROVISION_FLAVOR[chassisKey] ?? 'generic';
    // Prose references drop the lineage/marker suffix ("Homeowners — HM
    // lineage" reads as the "Homeowners program" inside form text).
    const programName = product.name.split(' — ')[0];

    // ── Base paper ──
    const baseSuffix =
      chassis.documentKind === 'binder'
        ? product.name.endsWith('Binder')
          ? 'Wording'
          : 'Binder Wording'
        : chassis.documentKind === 'treaty-wording'
          ? /Treaty|Facultative/.test(product.name)
            ? 'Wording'
            : 'Treaty Wording'
          : product.name.endsWith('Policy')
            ? 'Form'
            : 'Policy';
    const generatedBaseTitle = `${product.name} ${baseSuffix}`;
    let baseTitle = generatedBaseTitle;
    if (paper.base?.length) {
      // Overridden papers: lineage numbers get generated lineage text; specimen
      // and manuscript numbers already exist in the library and only link.
      paper.base.forEach((formNumber, i) => {
        if (!existingFormNumbers.has(formNumber)) {
          const title = lineageTitle(formNumber, product.name, i);
          addDef({
            formNumber,
            title,
            lob: product.lobName,
            states: null,
            editionDate: '10 20',
            filingStatus: 'Approved',
            provenance: formNumber.startsWith('HO 00') ? 'iso-flagged' : 'client',
            sourceText: baseSourceText(chassis, title, programName),
          });
        }
        linkAll(formNumber, allNodeIds, 'baseForm');
      });
      baseTitle = lineageTitle(paper.base[0], product.name, 0);
    } else {
      const formNumber = joinNumber(prefix, '1001');
      addDef({
        formNumber,
        title: generatedBaseTitle,
        lob: product.lobName,
        states: null,
        editionDate: '01 25',
        filingStatus: 'Approved',
        provenance: 'client',
        sourceText: baseSourceText(chassis, generatedBaseTitle, programName),
      });
      linkAll(formNumber, allNodeIds, 'baseForm');
    }

    // ── Declarations ──
    if (paper.declarations?.length) {
      for (const formNumber of paper.declarations) {
        if (!existingFormNumbers.has(formNumber)) {
          const title = `${baseTitle} Declarations`;
          addDef({
            formNumber,
            title,
            lob: product.lobName,
            states: null,
            editionDate: '10 20',
            filingStatus: 'Approved',
            provenance: 'client',
            sourceText: declarationsSourceText(title, chassis, programName),
          });
        }
        linkAll(formNumber, allNodeIds, 'declarations');
      }
    } else if (!paper.suppressGenerated && chassis.documentKind === 'policy') {
      const formNumber = joinNumber(prefix, '1001D');
      const title = `${baseTitle} Declarations`;
      addDef({
        formNumber,
        title,
        lob: product.lobName,
        states: null,
        editionDate: '01 25',
        filingStatus: 'Approved',
        provenance: 'client',
        sourceText: declarationsSourceText(title, chassis, programName),
      });
      linkAll(formNumber, allNodeIds, 'declarations');
    }

    // ── Endorsements ──
    for (const formNumber of paper.endorsements ?? []) {
      if (!existingFormNumbers.has(formNumber)) {
        const title = lineageEndorsementTitle(formNumber, product.name);
        addDef({
          formNumber,
          title,
          lob: product.lobName,
          states: null,
          editionDate: '06 25',
          filingStatus: 'Approved',
          provenance: 'client',
          sourceText: endorsementSourceText(
            title,
            baseTitle,
            'A. The coverage provided by this endorsement is shown in the Schedule and applies in addition to the coverage of the policy form.\nB. The limit shown in the Schedule for this endorsement is the most we will pay for all loss under it in any one policy period.',
          ),
        });
      }
      linkAll(formNumber, allNodeIds, 'endorsement');
    }
    if (!paper.suppressGenerated) {
      chassis.endorsements.forEach((e, i) => {
        const formNumber = joinNumber(prefix, e.suffixNo);
        addDef({
          formNumber,
          title: e.title,
          lob: product.lobName,
          states: null,
          editionDate: '06 25',
          filingStatus: i === 0 ? 'Approved' : 'Filed',
          provenance: 'client',
          sourceText: endorsementSourceText(e.title, baseTitle, e.body),
        });
        linkAll(formNumber, allNodeIds, 'endorsement');
      });
    }

    // ── State amendatories: one form per state the product files its own
    // version in, linked to every version node covering that state. ──
    const nodesByState = new Map<string, string[]>();
    for (const v of product.versionNodes) {
      if (v.kind !== 'state-form') continue;
      for (const st of v.states) {
        const list = nodesByState.get(st) ?? [];
        list.push(v.id);
        nodesByState.set(st, list);
      }
    }
    const stateCodes = [...nodesByState.keys()].sort();
    stateCodes.forEach((st) => {
      const formNumber = amendatoryNumber(product.code, prefix, st);
      const stateName = STATE_NAMES[st] ?? st;
      addDef({
        formNumber,
        title: `Special Provisions — ${stateName}`,
        lob: product.lobName,
        states: [st],
        editionDate: '05 26',
        filingStatus: 'Approved',
        provenance: 'client',
        sourceText: amendatorySourceText(st, baseTitle, flavor),
      });
      linkAll(formNumber, nodesByState.get(st) ?? [], 'stateAmendatory');
    });
  }

  // ── Manuscript families surface on their product's register ──
  const productByCode = new Map(products.map((pr) => [pr.code, pr]));
  for (const [formNumber, states] of manuscriptStates) {
    const productCode = MANUSCRIPT_FAMILY_PRODUCT[familyKeyOf(formNumber)];
    const product = productCode ? productByCode.get(productCode) : undefined;
    if (!product) continue;
    const role: ProductFormRole = states && states.length ? 'stateAmendatory' : 'endorsement';
    linkAll(
      formNumber,
      product.versionNodes.map((v) => v.id),
      role,
    );
  }

  return { defs: [...defs.values()], links, formsNodeIds };
}

/** Titles for the homeowners lineage papers (mirrors the uploaded HM / HOM /
 *  ISO documents' identity — synthetic wording). */
function lineageTitle(formNumber: string, productName: string, index: number): string {
  switch (formNumber) {
    case 'HM 8003':
      return 'Homeowners Policy';
    case 'HOM 7030':
      return 'Homeowners Policy';
    case 'HOM 7050':
      return 'Premier Homeowners Policy';
    case 'HO 00 03':
      return 'Homeowners 3 — Special Form';
    case 'HO 00 05':
      return 'Homeowners 5 — Comprehensive Form';
    default:
      return index === 0 ? `${productName} Policy` : `${productName} Policy — Alternate Paper`;
  }
}

function lineageEndorsementTitle(formNumber: string, productName: string): string {
  if (formNumber === 'HM 8004') return 'Water Backup and Sump Discharge or Overflow';
  return `${productName} Scheduled Endorsement`;
}

/** Amendatory numbering: lineage papers mirror the uploaded state-edition
 *  grammar (HM 8100PA, HOM 7030PAEP); everything else uses the 3100-series. */
function amendatoryNumber(productCode: string, prefix: string, st: string): string {
  if (productCode === 'PL-HO-HM') return `HM 8100${st}`;
  if (productCode === 'PL-HO-HOM') return `HOM 7030${st}EP`;
  return joinNumber(prefix, `3100${st}`);
}
