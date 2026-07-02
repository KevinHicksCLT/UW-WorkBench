// orgCounts — must stay a thin re-export of the canonical resolver so every
// residual importer resolves to the ONE count function (and its shared memo).
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/db/prisma.js', () => ({ prisma: {} }));

import * as orgCounts from '../../src/lib/orgCounts.js';
import * as resolver from '../../src/lib/resolvers/structureCounts.js';

describe('orgCounts re-export', () => {
  it('re-exports the exact canonical functions (same identity, shared memo)', () => {
    expect(orgCounts.structureCounts).toBe(resolver.structureCounts);
    expect(orgCounts.invalidateStructureCounts).toBe(resolver.invalidateStructureCounts);
  });
});
