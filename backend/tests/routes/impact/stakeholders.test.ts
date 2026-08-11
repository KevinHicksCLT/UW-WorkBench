// Stakeholder auto-derivation (Change Impact v2, Workstream C) — reviewers are
// derived from the graph inputs and the report's own domains, deduped, never
// free-text. Pure function, no DB.
import { describe, expect, it } from 'vitest';
import { deriveStakeholders } from '../../../src/routes/impact/stakeholders.js';
import type { Impact } from '../../../src/routes/impact/types.js';

const line = (over: Partial<Impact>): Impact => ({
  severity: 'HIGH',
  domain: 'operational',
  category: 'roles',
  entityType: 'Role',
  entityId: null,
  entityName: 'x',
  description: 'x',
  ...over,
});

describe('deriveStakeholders', () => {
  it('turns owner roles into Process Owner reviewers', () => {
    const out = deriveStakeholders([line({})], {
      changeType: 'REMOVE_PROCESS_STEP',
      lens: 'value-stream',
      ownerRoles: [{ id: 'r1', name: 'Underwriter' }],
    });
    const owner = out.find((s) => s.kind === 'Process Owner');
    expect(owner?.name).toBe('Underwriter');
    expect(owner?.entityId).toBe('r1');
  });

  it('adds Risk & Compliance only when a compliance impact is present', () => {
    const withCompliance = deriveStakeholders([line({ domain: 'compliance' })], {
      changeType: 'REMOVE_APPROVAL',
      lens: 'value-stream',
    });
    expect(withCompliance.some((s) => s.kind === 'Risk & Compliance')).toBe(true);

    const without = deriveStakeholders([line({ domain: 'operational' })], {
      changeType: 'ADD_PROCESS_STEP',
      lens: 'value-stream',
    });
    expect(without.some((s) => s.kind === 'Risk & Compliance')).toBe(false);
  });

  it('adds Technology when an application/technology impact is present', () => {
    const out = deriveStakeholders([line({ domain: 'technology', category: 'applications' })], {
      changeType: 'AUTOMATE_ACTIVITY',
      lens: 'value-stream',
    });
    expect(out.some((s) => s.kind === 'Technology')).toBe(true);
  });

  it('adds Business Architect for structural VS/role/plan changes only', () => {
    const structural = deriveStakeholders([line({})], {
      changeType: 'CONSOLIDATE_VALUE_STREAMS',
      lens: 'value-stream',
    });
    expect(structural.some((s) => s.kind === 'Business Architect')).toBe(true);

    const additive = deriveStakeholders([line({})], {
      changeType: 'ADD_PROCESS_STEP', // additive → not structural
      lens: 'value-stream',
    });
    expect(additive.some((s) => s.kind === 'Business Architect')).toBe(false);

    const product = deriveStakeholders([line({ domain: 'compliance' })], {
      changeType: 'RETIRE',
      lens: 'product', // architect never added for product/application lenses
    });
    expect(product.some((s) => s.kind === 'Business Architect')).toBe(false);
  });

  it('dedupes repeated owner roles and functions', () => {
    const out = deriveStakeholders(
      [line({ domain: 'compliance' }), line({ domain: 'compliance' })],
      {
        changeType: 'ELIMINATE_ROLE',
        lens: 'role',
        ownerRoles: [
          { id: 'r1', name: 'Adjuster' },
          { id: 'r1', name: 'Adjuster' },
        ],
      },
    );
    expect(out.filter((s) => s.kind === 'Process Owner')).toHaveLength(1);
    expect(out.filter((s) => s.kind === 'Risk & Compliance')).toHaveLength(1);
  });
});
