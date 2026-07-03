// Zod contract for the committed role-profile enrichment file
// (backend/data/seed/role-profiles.json) and the per-batch research outputs it
// is merged from (documents/role-research/batches/batch-NN.json). Shared by
// scripts/merge-role-profiles.ts, seed/seedRoleProfiles.ts, and tests so the
// research → merge → seed pipeline can never drift apart silently.
import { z } from 'zod';

export const ROLE_LEVELS = [
  'Executive',
  'Senior Leadership',
  'Manager',
  'Individual Contributor',
] as const;

export const roleProfileSourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  supports: z.string().min(1), // description|family|level (free-form pipe list)
});

export const classificationFlagSchema = z.object({
  scope: z.enum(['NodeRole', 'RoleDeliverable']),
  item: z.string().min(1),
  current: z.string().min(1),
  proposed: z.string().min(1),
  rationale: z.string().min(1),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const roleProfileSchema = z.object({
  roleName: z.string().min(1),
  description: z.string().min(40), // 3–5 sentences; a floor keeps stubs out
  roleFamily: z.string().min(1),
  roleLevel: z.enum(ROLE_LEVELS),
  sources: z.array(roleProfileSourceSchema).min(1),
  proposedOrgUnit: z
    .object({
      division: z.string().min(1),
      department: z.string().nullable().optional(),
      rationale: z.string().min(1),
    })
    .nullable()
    .optional(),
  classificationFlags: z.array(classificationFlagSchema).max(5).default([]),
  confidence: z.enum(['high', 'medium', 'low']),
  notes: z.string().optional(),
});
export type RoleProfile = z.infer<typeof roleProfileSchema>;

export const roleProfileBatchSchema = z.object({
  batch: z.number().int().min(1),
  profiles: z.array(roleProfileSchema).min(1),
});
export type RoleProfileBatch = z.infer<typeof roleProfileBatchSchema>;

export const roleProfilesFileSchema = z.object({
  version: z.number().int(),
  generatedAt: z.string(),
  profiles: z.array(roleProfileSchema),
});
export type RoleProfilesFile = z.infer<typeof roleProfilesFileSchema>;
