/**
 * Shared helpers for the Rate-Price (/rate-price) API — the module rides the
 * UW governance spine (one append-only choke point for humans, copilots, and
 * agents — ADR-001), so active-company resolution and event emission are
 * re-exported from the UW helpers rather than re-implemented.
 */
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import type { RatingSpec } from '../../lib/rate-price/types.js';

export { activeCompanyId, emitGovernanceEvent } from '../uw/helpers.js';

// Zod grammar for the canonical rating spec — validates both authored model
// versions and extracted legacy definitions before anything persists.
const confidence = z.enum(['high', 'medium', 'low']).optional();

export const specFactorSchema = z.discriminatedUnion('kind', [
  z.object({
    name: z.string().min(1),
    kind: z.literal('base_rate'),
    rate: z.number(),
    exposureInput: z.string().min(1),
    per: z.number().positive().optional(),
    confidence,
  }),
  z.object({
    name: z.string().min(1),
    kind: z.literal('table'),
    input: z.string().min(1),
    rows: z.array(z.object({ match: z.union([z.string(), z.number()]), factor: z.number() })),
    defaultFactor: z.number().optional(),
    confidence,
  }),
  z.object({
    name: z.string().min(1),
    kind: z.literal('formula'),
    input: z.string().min(1),
    slope: z.number(),
    intercept: z.number(),
    min: z.number().optional(),
    max: z.number().optional(),
    confidence,
  }),
  z.object({
    name: z.string().min(1),
    kind: z.literal('flag'),
    input: z.string().min(1),
    factor: z.number(),
    confidence,
  }),
]);

export const ratingSpecSchema = z.object({
  inputs: z.array(
    z.object({
      name: z.string().min(1),
      type: z.enum(['number', 'string', 'boolean']),
      domain: z.string().optional(),
    }),
  ),
  factors: z.array(specFactorSchema).min(1),
  minPremium: z.number().nonnegative().optional(),
  rounding: z.enum(['none', 'nearest_1', 'nearest_10']).optional(),
  unextracted: z.array(z.object({ ref: z.string(), reason: z.string() })).optional(),
});

/** Stored Json → typed spec. Persisted specs were schema-validated on write. */
export function specOf(json: unknown): RatingSpec {
  return json as RatingSpec;
}

export const MODEL_REF_RE = /^M-[A-Z]{2}-\d{2}$/;

/** Next sequential human ref for a Rate-Price entity, e.g. LR-007 → LR-008. */
export async function nextRpRef(
  companyId: string,
  model: 'program' | 'legacyRater' | 'wave',
  prefix: string,
): Promise<string> {
  const last =
    model === 'program'
      ? await prisma.rpRateProgram.findFirst({
          where: { companyId },
          orderBy: { ref: 'desc' },
          select: { ref: true },
        })
      : model === 'legacyRater'
        ? await prisma.rpLegacyRater.findFirst({
            where: { companyId },
            orderBy: { ref: 'desc' },
            select: { ref: true },
          })
        : await prisma.rpMigrationWave.findFirst({
            where: { companyId },
            orderBy: { ref: 'desc' },
            select: { ref: true },
          });
  const n = last ? parseInt(last.ref.replace(/^\D+/, ''), 10) + 1 : 1;
  return `${prefix}-${String(n).padStart(model === 'wave' ? 2 : 3, '0')}`;
}
