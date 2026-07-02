// aiAdoption — autonomy-spectrum vocabulary + the count-first role-utilization
// and stable-jitter efficiency derivations (pure).
import { describe, expect, it } from 'vitest';
import { efficiencyGain, HEAT, MODES, rolesUsing } from '../../src/lib/aiAdoption';

describe('vocabulary', () => {
  it('defines the four autonomy modes in escalating order', () => {
    expect(MODES.map((m) => m.key)).toEqual(['assistant', 'augmented', 'workflow', 'agent']);
    for (const m of MODES) {
      expect(m.label).toBeTruthy();
      expect(m.short).toBeTruthy();
      expect(m.desc).toBeTruthy();
    }
  });

  it('defines five adoption heat stops from grey to embedded green', () => {
    expect(HEAT).toHaveLength(5);
    expect(HEAT[0].name).toBe('Not used');
    expect(HEAT[4]).toMatchObject({ name: 'Embedded', bg: '#16a34a', fg: '#ffffff' });
  });
});

describe('rolesUsing', () => {
  it('returns zero for unadopted levels or empty role sets', () => {
    expect(rolesUsing(0, 50)).toEqual({ count: 0, pct: 0 });
    expect(rolesUsing(-1, 50)).toEqual({ count: 0, pct: 0 });
    expect(rolesUsing(3, 0)).toEqual({ count: 0, pct: 0 });
  });

  it('is count-first: pct is derived from the rounded count so they never contradict', () => {
    const { count, pct } = rolesUsing(2, 20); // share 0.35 → 7 roles
    expect(count).toBe(7);
    expect(pct).toBe(35);
  });

  it('floors at one role and caps at the role count', () => {
    expect(rolesUsing(1, 1)).toEqual({ count: 1, pct: 100 }); // min 1 even at a 12% share
    expect(rolesUsing(4, 1)).toEqual({ count: 1, pct: 100 });
    expect(rolesUsing(4, 10).count).toBeLessThanOrEqual(10);
  });

  it('with N=1 only 0% or 100% are possible (coarse but honest)', () => {
    expect([0, 100]).toContain(rolesUsing(0, 1).pct);
    expect([0, 100]).toContain(rolesUsing(3, 1).pct);
  });
});

describe('efficiencyGain', () => {
  it('returns 0 when not adopted', () => {
    expect(efficiencyGain('Claims', 'agent', 0)).toBe(0);
  });

  it('is deterministic for the same (stream, mode, level)', () => {
    const a = efficiencyGain('Claims', 'workflow', 3);
    const b = efficiencyGain('Claims', 'workflow', 3);
    expect(a).toBe(b);
  });

  it('stays within base + 0..5 jitter for its level', () => {
    for (const level of [1, 2, 3, 4]) {
      const base = [0, 9, 14, 21, 29][level];
      const v = efficiencyGain('Underwriting', 'assistant', level);
      expect(v).toBeGreaterThanOrEqual(base);
      expect(v).toBeLessThanOrEqual(base + 5);
    }
  });

  it('varies by stream/mode key (jitter is keyed)', () => {
    const values = new Set(
      ['Claims', 'Underwriting', 'Billing', 'Actuarial', 'Finance'].map((s) => efficiencyGain(s, 'agent', 2)),
    );
    expect(values.size).toBeGreaterThan(1);
  });
});
