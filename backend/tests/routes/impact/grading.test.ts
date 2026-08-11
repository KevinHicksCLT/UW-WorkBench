// The change-impact grading machinery (Change Impact v2, Workstream A) —
// class-based severity shift, per-change-type blast-radius emphasis, and the
// report builder that applies emphasis centrally. Pure functions, no DB.
import { describe, expect, it } from 'vitest';
import {
  buildReport,
  classOf,
  grade,
  weigh,
  type Impact,
  type ImpactSeverity,
} from '../../../src/routes/impact/types.js';
import {
  CHANGE_TYPES_BY_LENS,
  classOf as taxonomyClassOf,
  emphasisOf,
} from '../../../src/routes/impact/taxonomy.js';

const impact = (over: Partial<Impact>): Impact => ({
  severity: 'HIGH',
  domain: 'operational',
  category: 'roles',
  entityType: 'Role',
  entityId: 'r1',
  entityName: 'Underwriter',
  description: 'x',
  ...over,
});

describe('grade — class shift', () => {
  it('destructive keeps the base severity', () => {
    expect(grade('BREAKING', 'destructive')).toBe('BREAKING');
    expect(grade('HIGH', 'destructive')).toBe('HIGH');
  });
  it('restructure steps down one rung', () => {
    expect(grade('BREAKING', 'restructure')).toBe('HIGH');
    expect(grade('MEDIUM', 'restructure')).toBe('LOW');
  });
  it('additive and adopt step down two rungs, floored at LOW', () => {
    expect(grade('BREAKING', 'additive')).toBe('MEDIUM');
    expect(grade('BREAKING', 'adopt')).toBe('MEDIUM');
    expect(grade('MEDIUM', 'additive')).toBe('LOW');
  });
});

describe('classOf — taxonomy-driven', () => {
  it('maps legacy rationalization verbs', () => {
    expect(classOf('RETIRE')).toBe('destructive');
    expect(classOf('CONSOLIDATE')).toBe('restructure');
    expect(classOf('ADOPT')).toBe('adopt');
  });
  it('maps new per-lens tokens', () => {
    expect(classOf('ADD_PROCESS_STEP')).toBe('additive');
    expect(classOf('CHANGE_SLA')).toBe('restructure');
    expect(classOf('ELIMINATE_ROLE')).toBe('destructive');
  });
});

describe('weigh — blast-radius emphasis', () => {
  it('bumps emphasized domains one rung harder than the class alone', () => {
    // CHANGE_SLA is restructure and emphasizes operational.
    expect(grade('HIGH', classOf('CHANGE_SLA'))).toBe('MEDIUM'); // class only
    expect(weigh('HIGH', 'CHANGE_SLA', 'operational')).toBe('HIGH'); // + emphasis
  });
  it('leaves non-emphasized domains at the class-graded severity', () => {
    expect(weigh('HIGH', 'CHANGE_SLA', 'compliance')).toBe('MEDIUM');
  });
  it('is a no-op for legacy verbs (empty emphasis) — back-compat', () => {
    for (const domain of [
      'operational',
      'technology',
      'data',
      'compliance',
      'product',
      'testing',
    ] as const) {
      expect(weigh('BREAKING', 'RETIRE', domain)).toBe(grade('BREAKING', 'destructive'));
    }
  });
});

describe('buildReport — applies emphasis, then sorts and tallies', () => {
  it('reshapes domain severities per change type (acceptance #1)', () => {
    const impacts = [
      impact({ severity: grade('HIGH', classOf('CHANGE_SLA')), domain: 'operational' }),
    ];
    const report = buildReport(
      { kind: 'process-nodes', id: 'n1', name: 'Intake', context: null },
      'CHANGE_SLA',
      impacts,
    );
    // Operational is emphasized → the single line is bumped back to HIGH.
    expect(report.impacts[0].severity).toBe('HIGH');
    expect(report.summary.high).toBe(1);
    expect(report.summary.medium).toBe(0);
  });
  it('never bumps informational scope lines', () => {
    const impacts = [impact({ severity: 'LOW', category: 'scope', domain: 'operational' })];
    const report = buildReport(
      { kind: 'process-nodes', id: 'n1', name: 'x', context: null },
      'CHANGE_SLA',
      impacts,
    );
    expect(report.impacts[0].severity).toBe('LOW');
  });
  it('legacy verbs produce identical severities (back-compat)', () => {
    const base: ImpactSeverity = grade('BREAKING', 'destructive');
    const impacts = [impact({ severity: base, domain: 'technology', category: 'applications' })];
    const report = buildReport(
      { kind: 'application', id: 'a1', name: 'Guidewire', context: null },
      'RETIRE',
      impacts,
    );
    expect(report.impacts[0].severity).toBe(base);
  });
});

describe('per-lens taxonomies', () => {
  it('offers 15 change types for value-stream, role and deliverable lenses', () => {
    expect(CHANGE_TYPES_BY_LENS['value-stream']).toHaveLength(15);
    expect(CHANGE_TYPES_BY_LENS.role).toHaveLength(15);
    expect(CHANGE_TYPES_BY_LENS.deliverable).toHaveLength(15);
  });
  it('offers the SPM change verbs for the plan lens', () => {
    const tokens = CHANGE_TYPES_BY_LENS.plan.map((c) => c.token);
    expect(tokens).toContain('RESCHEDULE');
    expect(tokens).toContain('DEFUND');
    expect(tokens).toContain('CANCEL');
  });
  it('every taxonomy entry carries a class and an emphasis list', () => {
    for (const list of Object.values(CHANGE_TYPES_BY_LENS)) {
      for (const c of list) {
        expect(taxonomyClassOf(c.token)).toBe(c.changeClass);
        expect(Array.isArray(emphasisOf(c.token))).toBe(true);
      }
    }
  });
});
