// trust.ts — the shared τ-routing contract (ADR-004/FORMS-LLR-012) and the
// working-set mode law (FORMS-HLR-008). These constants are invariants: a
// change that shifts τ or the 7/8 mode boundary must fail here first.
import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE_TAU,
  defaultMode,
  effectiveMode,
  routeFindingStatus,
  routeMappingStatus,
} from '../../../src/lib/forms/trust.js';

describe('confidence routing (τ)', () => {
  it('routes findings below τ to needs-human, at/above τ to new', () => {
    expect(routeFindingStatus(0.69)).toBe('needs-human');
    expect(routeFindingStatus(CONFIDENCE_TAU)).toBe('new');
    expect(routeFindingStatus(0.95)).toBe('new');
  });

  it('routes mappings with the identical threshold (one trust model)', () => {
    expect(routeMappingStatus(0.69)).toBe('needs-human');
    expect(routeMappingStatus(0.7)).toBe('suggested');
  });

  it('never auto-accepts: routed statuses are review states only', () => {
    expect(routeFindingStatus(1)).toBe('new'); // not 'accepted'
    expect(routeMappingStatus(1)).toBe('suggested'); // not 'confirmed'
  });
});

describe('working-set mode selection', () => {
  it('defaults ≤7 to reading and ≥8 to portfolio', () => {
    expect(defaultMode(1)).toBe('reading');
    expect(defaultMode(7)).toBe('reading');
    expect(defaultMode(8)).toBe('portfolio');
    expect(defaultMode(50)).toBe('portfolio');
  });

  it('honors an explicit override in either direction', () => {
    expect(effectiveMode(50, 'reading')).toBe('reading');
    expect(effectiveMode(2, 'portfolio')).toBe('portfolio');
  });

  it('falls back to the size default when override is null or junk', () => {
    expect(effectiveMode(3, null)).toBe('reading');
    expect(effectiveMode(9, 'bogus')).toBe('portfolio');
  });
});
