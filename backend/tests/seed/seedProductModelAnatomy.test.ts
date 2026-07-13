// Anatomy catalog shape: 11 components × 3 scopes with research-backed depth,
// stable kebab-case SKOS slugs, and valid MISPLACED redirects.
import { describe, expect, it } from 'vitest';
import { PRODUCT_COMPONENTS } from '../../src/seed/seedWorkspaceVocabulary.js';
import {
  buildAnatomyRows,
  COMPONENT_SLUGS,
  slugify,
} from '../../src/seed/seedProductModelAnatomy.js';

const rows = buildAnatomyRows();

describe('buildAnatomyRows', () => {
  it('covers every component × scope cell with at least 8 rows', () => {
    for (const component of PRODUCT_COMPONENTS) {
      for (const scope of ['COMMON', 'SEGMENT', 'GEOGRAPHY'] as const) {
        const cell = rows.filter((r) => r.component === component && r.scope === scope);
        expect(cell.length, `${component} / ${scope}`).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('uses only the three scopes and three views', () => {
    expect(new Set(rows.map((r) => r.scope))).toEqual(new Set(['COMMON', 'SEGMENT', 'GEOGRAPHY']));
    expect(new Set(rows.map((r) => r.view))).toEqual(
      new Set(['COMPONENT', 'BEHAVIOR', 'MISPLACED']),
    );
  });

  it('slugs are unique, kebab-case, and prefixed with the component slug', () => {
    const slugs = rows.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const r of rows) {
      expect(r.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(r.slug.startsWith(`${COMPONENT_SLUGS[r.component]}-`)).toBe(true);
    }
  });

  it('every component has MISPLACED rows pointing at a valid other component', () => {
    for (const component of PRODUCT_COMPONENTS) {
      const misplaced = rows.filter((r) => r.component === component && r.view === 'MISPLACED');
      expect(misplaced.length, component).toBeGreaterThanOrEqual(1);
      for (const m of misplaced) {
        expect(m.recommendedComponent, m.slug).toBeTruthy();
        expect(PRODUCT_COMPONENTS).toContain(m.recommendedComponent);
        expect(m.recommendedComponent).not.toBe(component);
      }
    }
  });

  it('every component has BEHAVIOR rows and every row has a real description', () => {
    for (const component of PRODUCT_COMPONENTS) {
      expect(
        rows.filter((r) => r.component === component && r.view === 'BEHAVIOR').length,
        component,
      ).toBeGreaterThanOrEqual(1);
    }
    for (const r of rows) expect(r.description.length, r.slug).toBeGreaterThan(20);
  });

  it('slugify produces stable kebab-case ids', () => {
    expect(slugify("Lloyd's line size & order %")).toBe('lloyd-s-line-size-and-order');
    expect(slugify('Hired & non-owned auto (CA 20 01)')).toBe('hired-and-non-owned-auto-ca-20-01');
    expect(slugify('FATCA/CRS reporting')).toBe('fatca-crs-reporting');
  });
});
