// productMandates.ts — the ACTUAL mandate behind a state-required form or
// coverage, with its regulatory source. The board's state layer only said
// *that* a row was state-mandated; the review drill (the lowest level) must
// say *what* the state mandates and *where that obligation comes from*.
//
// Two real sources, joined here:
//   • the element's own description (the spine's researched mandate text —
//     "Michigan requires its own policy form … PIP medical choice levels
//     require their own form and rate structure");
//   • the RegulatoryRequirement register (24k rows): the state's
//     PRODUCT_FILING / Policy Form Filing obligation carries the citation,
//     the regulator and its portal URL. Matched per state, preferring a
//     title that names the row's product line.

import { prisma } from '../../db/prisma.js';
import { classifyForm, STATE_NAMES } from './productForms.js';
import type { ReviewRow } from './productBoard.js';

export interface StateMandate {
  state: string;
  stateName: string;
  /** What the state actually mandates — the element's researched description,
   *  falling back to the register's requirement text. */
  mandate: string;
  citation: string | null;
  citationUrl: string | null;
  regulator: string | null;
}

const regSelect = {
  title: true,
  requirement: true,
  citation: true,
  citationUrl: true,
  jurisdiction: { select: { code: true, name: true, regulatorName: true } },
} as const;

const lobTokensOf = (lobName: string): string[] =>
  lobName
    .split('/')
    .map((t) => t.trim())
    .filter((t) => t.length > 3);

/** Row key → mandate, for every review row the form classifier reads as a
 *  state-required variation. One batched register query per drill — never
 *  per-row fan-out. */
export async function resolveStateMandates(
  companyId: string,
  rows: ReviewRow[],
): Promise<Record<string, StateMandate>> {
  const classified = rows
    .map((r) => {
      const rep = Object.values(r.group.perVersion)[0] ?? null;
      return { r, rep, cls: classifyForm(r.group.name, rep, false) };
    })
    .filter((x) => x.cls.state !== null);
  if (classified.length === 0) return {};

  const states = [...new Set(classified.map((x) => x.cls.state as string))];
  const tokens = [...new Set(classified.flatMap((x) => lobTokensOf(x.r.lobName)))];
  const baseWhere = {
    companyId,
    category: 'PRODUCT_FILING',
    regime: 'Policy Form Filing',
    status: 'ACTIVE',
    jurisdiction: { code: { in: states } },
  };
  const [matched, fallback] = await Promise.all([
    tokens.length
      ? prisma.regulatoryRequirement.findMany({
          where: {
            ...baseWhere,
            OR: tokens.map((t) => ({ title: { contains: t, mode: 'insensitive' as const } })),
          },
          select: regSelect,
          take: 300,
        })
      : Promise.resolve([]),
    // One representative form-filing obligation per state — the citation and
    // regulator are per-state, so this is the source when no line-name match.
    prisma.regulatoryRequirement.findMany({
      where: baseWhere,
      distinct: ['jurisdictionId'],
      select: regSelect,
    }),
  ]);
  const fallbackByState = new Map(fallback.map((f) => [f.jurisdiction.code, f]));

  const out: Record<string, StateMandate> = {};
  for (const { r, rep, cls } of classified) {
    const state = cls.state as string;
    const lobTokens = lobTokensOf(r.lobName).map((t) => t.toLowerCase());
    const reg =
      matched.find(
        (m) =>
          m.jurisdiction.code === state && lobTokens.some((t) => m.title.toLowerCase().includes(t)),
      ) ??
      fallbackByState.get(state) ??
      null;
    const stateName = STATE_NAMES[state] ?? reg?.jurisdiction.name ?? state;
    const mandate =
      rep?.description?.trim() ||
      reg?.requirement ||
      `${stateName} requires this form for the product line.`;
    out[`${r.lobId}:${r.group.key}`] = {
      state,
      stateName,
      mandate,
      citation: reg?.citation ?? null,
      citationUrl: reg?.citationUrl ?? null,
      regulator: reg?.jurisdiction.regulatorName ?? null,
    };
  }
  return out;
}
