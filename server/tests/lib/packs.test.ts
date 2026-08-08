import { describe, expect, it } from 'vitest';
import { loadBundledPacks } from '../../src/lib/packStore.js';
import { packSchema } from '../../src/lib/packs.js';

describe('content packs (the crowdsourced commodity)', () => {
  it('every bundled pack parses against the pack schema', async () => {
    const packs = await loadBundledPacks();
    expect(packs.length).toBeGreaterThanOrEqual(2);
    for (const p of packs) expect(() => packSchema.parse(p)).not.toThrow();
  });

  it('the commercial property starter carries a full authority ladder bound to role labels', async () => {
    const packs = await loadBundledPacks();
    const starter = packs.find((p) => p.slug === 'commercial-property-starter');
    expect(starter).toBeDefined();
    const labels = starter?.authorityGrantTemplates.map((g) => g.roleLabel) ?? [];
    expect(labels).toEqual(expect.arrayContaining(['Underwriter', 'Senior Underwriter', 'Chief Underwriting Officer']));
    // Authority travels as role labels, never as user identities.
    for (const g of starter?.authorityGrantTemplates ?? []) {
      expect(g.roleLabel).not.toMatch(/@/);
      expect(g.premiumMax).toBeGreaterThan(0);
    }
  });

  it('rejects a pack whose appetite lacks rationale (judgment needs a why)', () => {
    const bad = {
      packFormat: 1,
      name: 'Bad Pack',
      slug: 'bad-pack',
      version: '1.0.0',
      description: 'A pack that should fail validation.',
      author: 'test',
      lobs: ['CP'],
      appetiteStatements: [{ ref: 'AS-001', stance: 'TARGET', lob: 'CP', rationale: 'too short' }],
    };
    expect(() => packSchema.parse(bad)).toThrow();
  });
});
