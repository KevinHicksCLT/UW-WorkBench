// Demo-workspace plan integrity: every cross-reference in the authored data
// (normalization entries, target components, anatomy slugs, canonical models)
// must resolve — the seed would otherwise write dangling FKs.
import { describe, expect, it } from 'vitest';
import { buildProductModelPlan } from '../../src/seed/productModel.js';
import { buildAnatomyRows } from '../../src/seed/seedProductModelAnatomy.js';
import { PRODUCT_COMPONENTS } from '../../src/seed/seedWorkspaceVocabulary.js';

const plan = buildProductModelPlan();

describe('buildProductModelPlan', () => {
  it('builds 4 legacy models and 4 canonical models', () => {
    expect(plan.legacyModels).toHaveLength(4);
    expect(plan.canonicals).toHaveLength(4);
  });

  it('every finding references an existing legacy model and a valid component token', () => {
    const legacyIds = new Set(plan.legacyModels.map((l) => l.id));
    for (const f of plan.findings) {
      expect(legacyIds.has(f.legacyModelId), f.id).toBe(true);
      expect(PRODUCT_COMPONENTS).toContain(f.def.cmp);
    }
  });

  it('normalizationEntryId and targetComponentId always resolve', () => {
    const entryIds = new Set(plan.entries.map((e) => e.id));
    const componentIds = new Set(plan.components.map((c) => c.id));
    for (const f of plan.findings) {
      if (f.normalizationEntryId !== null) {
        expect(entryIds.has(f.normalizationEntryId), f.id).toBe(true);
      }
      if (f.targetComponentId !== null) {
        expect(componentIds.has(f.targetComponentId), f.id).toBe(true);
      }
    }
    for (const e of plan.entries) {
      expect(e.componentId === null || componentIds.has(e.componentId), e.key).toBe(true);
    }
  });

  it('every referenced anatomy slug exists in the anatomy catalog', () => {
    const catalogSlugs = new Set(buildAnatomyRows().map((r) => r.slug));
    for (const f of plan.findings) {
      if (f.anatomySlug !== null) {
        expect(catalogSlugs.has(f.anatomySlug), `${f.id}: ${f.anatomySlug}`).toBe(true);
      }
    }
  });

  it('normalization notations are unique and cover AUTO / REVIEW / HELD', () => {
    const notations = plan.entries.map((e) => e.notation);
    expect(new Set(notations).size).toBe(notations.length);
    for (const n of notations) expect(n).toMatch(/^N-\d+$/);
    const statuses = new Set(plan.entries.map((e) => e.matchStatus));
    expect(statuses).toEqual(new Set(['AUTO', 'REVIEW', 'HELD']));
    // Every non-AUTO card explains its difference; HELD cards carry a proposal.
    for (const e of plan.entries) {
      if (e.matchStatus !== 'AUTO') expect(e.differenceNote, e.key).toBeTruthy();
      if (e.matchStatus === 'HELD') expect(e.proposedResolution, e.key).toBeTruthy();
    }
  });

  it('scoped findings carry their scope value and dead/why examples exist', () => {
    for (const f of plan.findings) {
      if (f.def.scope === 'Segment') expect(f.def.seg, f.id).toBeTruthy();
      if (f.def.scope === 'Geography') expect(f.def.geo, f.id).toBeTruthy();
    }
    expect(plan.findings.some((f) => f.def.dead === true)).toBe(true);
    const whys = plan.findings.filter((f) => f.def.why);
    expect(whys.length).toBeGreaterThanOrEqual(3);
    for (const f of whys) expect(f.def.why?.lands, f.id).toBeTruthy();
  });

  it('components fold into existing canonical models across all workspace rows', () => {
    const canonicalKeys = new Set(plan.canonicals.map((c) => c.key));
    for (const c of plan.components) {
      expect(canonicalKeys.has(c.canonicalKey), c.id).toBe(true);
      expect(PRODUCT_COMPONENTS).toContain(c.component);
    }
    // Every finding's row has a matching component in its landing canonical.
    const componentKeys = new Set(plan.components.map((c) => `${c.canonicalKey}:${c.component}`));
    for (const f of plan.findings) {
      if (f.targetComponentId !== null) continue; // explicit target already checked
      expect(f.targetComponentId).toBeNull();
    }
    expect(componentKeys.size).toBe(plan.components.length);
  });
});
