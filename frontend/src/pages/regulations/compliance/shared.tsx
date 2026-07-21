/**
 * Compliance register (SCRUM-46 v2) — shared types, label maps and badge
 * components for the three-level register UI (regulation → compliance item →
 * requirement rows). Enum tokens mirror backend/prisma ComplianceItem comments.
 */
import { StatusPill } from '../../../components/ui';
import type { PillTone } from '../../../components/ui';

export type ComplianceSummary = {
  regulations: number;
  items: number;
  requirementRows: { total: number; binding: number; informational: number };
  signOff: { pending: number; confirmed: number; rejected: number; needsResearch: number };
  confidence: { high: number; medium: number; low: number };
  grounding: { item: number; regulation: number };
  variants: { total: number; promoted: number };
};

export type RegulationRow = {
  id: string;
  regCode: string;
  name: string;
  category: string;
  lineOfBusiness: string;
  jurisdictionScope: string;
  ownerTeam: string;
  frequency: string;
  productImpact: boolean;
  processImpact: boolean;
  systemImpact: boolean;
  evidenceRequired: string;
  dueDate: string;
  representativeRequirement: string;
  lens: 'state' | 'federal' | 'international';
  itemCount: number;
  confirmedCount: number;
  requirementRowCount: number;
  variantCount: number;
};

export const LENS_LABEL: Record<string, string> = {
  state: 'State',
  federal: 'Federal',
  international: 'International',
};

// sessionStorage key for the register's active lens tab — also written by the
// Regulations landing page so its Compliance tile deep-links into the lens the
// user was looking at.
export const COMPLIANCE_LENS_KEY = 'regulations.compliance.lens';

export type ItemRow = {
  id: string;
  itemCode: string;
  name: string;
  ownerTeam: string;
  frequency: string;
  evidence: string;
  jurisdictionScope: string;
  supportingReqRows: number;
  groundingBasis: string;
  officialSourceRows: number;
  frequencyAlignment: string;
  determinationStatus: string;
  confidence: string;
  signOff: string;
  reviewer: string | null;
  regulation?: { id: string; regCode: string; name: string; category: string };
};

export type VariantRow = {
  id: string;
  jurisdiction: string;
  deadlineVariant: string;
  requirementTitle: string;
  citation: string;
  promotedItem: { id: string; itemCode: string; signOff: string } | null;
};

export type SourceRow = {
  id: string;
  title: string;
  citation: string | null;
  citationUrl: string | null;
  jurisdiction: { name: string; code: string };
};

export type ItemDetail = ItemRow & {
  jurisdictionsCovered: number;
  representativeRequirement: string;
  repJurisdiction: string;
  supportingCitations: string;
  frequencyDerived: string;
  deadlineSignals: string;
  auditStatus: string;
  reviewNotes: string | null;
  regulation: {
    id: string;
    regCode: string;
    name: string;
    category: string;
    jurisdictionScope: string;
    representativeRequirement: string;
  };
  selectedRequirements: SourceRow[];
  signOffEvents: {
    id: string;
    action: string;
    reviewer: string;
    note: string | null;
    createdAt: string;
  }[];
  sourceRowCount: number;
  sourceRows: SourceRow[];
};

export const FREQ_ALIGN_LABEL: Record<string, string> = {
  MATCH: 'Match',
  REVIEW: 'Review — differs from template',
  NO_SIGNAL: 'No signal in source text',
};

export const SIGN_OFF_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
  NEEDS_RESEARCH: 'Needs research',
};

const CONFIDENCE_TONE: Record<string, PillTone> = { HIGH: 'green', MEDIUM: 'amber', LOW: 'red' };
const SIGN_OFF_TONE: Record<string, PillTone> = {
  PENDING: 'slate',
  CONFIRMED: 'green',
  REJECTED: 'red',
  NEEDS_RESEARCH: 'amber',
};

/** Confidence badge — High/Medium/Low mapped onto pill tones. */
export function ConfidenceBadge({ confidence }: { confidence: string }) {
  return (
    <StatusPill tone={CONFIDENCE_TONE[confidence] ?? 'slate'}>
      {confidence.charAt(0) + confidence.slice(1).toLowerCase()}
    </StatusPill>
  );
}

/** Sign-off status badge. */
export function SignOffBadge({ signOff }: { signOff: string }) {
  return (
    <StatusPill tone={SIGN_OFF_TONE[signOff] ?? 'slate'}>
      {SIGN_OFF_LABEL[signOff] ?? signOff}
    </StatusPill>
  );
}
