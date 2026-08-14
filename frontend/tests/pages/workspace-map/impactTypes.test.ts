import { describe, expect, it } from 'vitest';
import {
  changeLabel,
  isDestructive,
  lensForKind,
} from '../../../src/pages/workspace-map/impact/types';

describe('changeLabel', () => {
  it('uses the curated label for the legacy rationalization verbs', () => {
    expect(changeLabel('RETIRE')).toBe('Retire');
    expect(changeLabel('CONSOLIDATE')).toBe('Consolidate');
  });

  it('title-cases an unknown per-lens taxonomy token', () => {
    expect(changeLabel('CONVERT_TO_STRUCTURED_DATA')).toBe('Convert to structured data');
    expect(changeLabel('ADD_AI_AGENT')).toBe('Add ai agent');
    expect(changeLabel('RESCHEDULE')).toBe('Reschedule');
  });
});

describe('isDestructive', () => {
  it('flags the legacy destructive verbs without a report class', () => {
    expect(isDestructive('RETIRE')).toBe(true);
    expect(isDestructive('MERGE')).toBe(false);
  });

  it('defers to the report changeClass when one is given', () => {
    // A new-taxonomy token the legacy set never knew about — the class decides.
    expect(isDestructive('ELIMINATE_DOCUMENT', 'destructive')).toBe(true);
    expect(isDestructive('CONVERT_TO_STRUCTURED_DATA', 'restructure')).toBe(false);
    expect(isDestructive('ADD_AI_AGENT', 'additive')).toBe(false);
  });
});

describe('lensForKind', () => {
  it('maps each subject kind to its picker lens', () => {
    expect(lensForKind('process-nodes')).toBe('value-stream');
    expect(lensForKind('role')).toBe('role');
    expect(lensForKind('deliverable')).toBe('deliverable');
    expect(lensForKind('plan')).toBe('plan');
    expect(lensForKind('product-element')).toBe('product');
  });

  it('falls back to the application (legacy) lens for unknown kinds', () => {
    expect(lensForKind('application')).toBe('application');
    expect(lensForKind('something-else')).toBe('application');
  });
});
