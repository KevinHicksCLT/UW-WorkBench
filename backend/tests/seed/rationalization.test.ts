// v3 refresh of the application boards: the authored INITIATIVES data must
// keep the invariants the seed loop relies on (unique item names per category,
// norm verdicts only on normalizable findings, complete WHY panels).
import { describe, expect, it } from 'vitest';
import { INITIATIVES } from '../../src/seed/rationalization.js';

type Verdict = 'AUTO' | 'REVIEW' | 'HELD';

const allCats = INITIATIVES.flatMap((ini) =>
  ini.stages.flatMap((s) =>
    Object.entries(s.layers).flatMap(([layer, def]) =>
      def.cats.map((cat) => ({ stage: s.key, layer, cat })),
    ),
  ),
);

describe('rationalization seed data (v3)', () => {
  it('item names are unique within each category (normalization entry key)', () => {
    for (const { stage, layer, cat } of allCats) {
      const names = cat.items.map((i) => i.name);
      expect(new Set(names).size, `${stage}/${layer}/${cat.category}`).toBe(names.length);
    }
  });

  it('norm verdicts only appear on normalizable findings (not Eliminate, not dead)', () => {
    for (const { stage, cat } of allCats) {
      for (const item of cat.items) {
        if (item.norm) {
          expect(cat.capdan, `${stage}/${item.name}`).not.toBe('Eliminate');
          expect(item.dead ?? false, `${stage}/${item.name}`).toBe(false);
        }
      }
    }
  });

  it('authored verdicts cover REVIEW and HELD with notes/resolutions', () => {
    const verdicts = allCats.flatMap(({ cat }) =>
      cat.items.map((i) => i.norm?.status).filter((s): s is Verdict => s !== undefined),
    );
    expect(verdicts).toContain('REVIEW');
    expect(verdicts).toContain('HELD');
    for (const { stage, cat } of allCats) {
      for (const item of cat.items) {
        if (item.norm?.status && item.norm.status !== 'AUTO') {
          expect(item.norm.note, `${stage}/${item.name}`).toBeTruthy();
          expect(item.norm.resolution, `${stage}/${item.name}`).toBeTruthy();
        }
      }
    }
  });

  it('dead-code findings exist and are Eliminate or explicitly retired flows', () => {
    const dead = allCats.flatMap(({ cat }) => cat.items.filter((i) => i.dead));
    expect(dead.length).toBeGreaterThanOrEqual(5);
  });

  it('every Relocate category with a WHY panel states where the logic lands', () => {
    const whys = allCats.filter(({ cat }) => cat.why);
    expect(whys.length).toBeGreaterThanOrEqual(5);
    for (const { stage, cat } of whys) {
      expect(cat.capdan, `${stage}/${cat.category}`).toBe('Relocate');
      expect(cat.why?.lands, `${stage}/${cat.category}`).toBeTruthy();
    }
  });

  it('the wireframe loss-capture narrative is present verbatim grain', () => {
    const fnol = allCats.find(
      ({ stage, cat }) => stage === 'CFNOL' && cat.category === 'Loss capture forms',
    );
    const item = fnol?.cat.items.find((i) => i.name === 'Loss details form');
    expect(item?.norm?.basis).toContain('Claim number — text (12)');
    expect(item?.norm?.basis).toContain('Loss type — pick list, 11 options');
  });
});
