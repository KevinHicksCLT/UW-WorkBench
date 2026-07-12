import type { ReactNode } from 'react';
import { Select } from '../../components/ui';

// Variant lens for the value-streams map — Market › Segment › LOB ›
// Cross-cutting. The process spine is GENERIC: every axis defaults to
// "Generic …" (the shared model), and a non-generic pick is a *lens* over
// that one spine, never a copy of it (see
// documents/value-streams/LOB-Variant-Design-Plan.md, rules R1–R5).
//
// The option catalogs are a UI-only pilot taxonomy sourced from
// "New Business Process Flow Differences.docx" (Market/Segment) and the
// LineOfBusiness.group vocabulary already in the DB (LOB). When the
// ProcessVariant/NodeVariant tables land, these lists move behind an API
// and the selection starts filtering the resolved flow.

/** Sentinel meaning "no lens on this axis — show the generic model". */
export const LENS_GENERIC = 'GENERIC';

/** One axis of the variant lens. */
export type LensDimension = {
  /** Stable key; also the URL search param carrying a non-generic pick. */
  key: 'market' | 'segment' | 'lob' | 'cross';
  /** Human name of the axis (shown in the generic option + aria-label). */
  label: string;
  /** Non-generic values, in display order. */
  options: string[];
};

/** The four lens axes, in the order they cascade left → right. */
export const LENS_DIMENSIONS: LensDimension[] = [
  {
    key: 'market',
    label: 'Market',
    options: ['US Commercial', "UK / Lloyd's", 'Continental Europe', 'Multinational Program'],
  },
  {
    key: 'segment',
    label: 'Segment',
    options: [
      'Personal Lines',
      'Small Commercial',
      'Middle Market',
      'Large Commercial',
      'Specialty',
    ],
  },
  {
    key: 'lob',
    label: 'LOB',
    // LineOfBusiness.group vocabulary (the family roll-up already seeded in
    // the DB for regulations) — kept in its natural P&C → life → other order.
    options: [
      'Property',
      'Liability',
      'Commercial Auto',
      'Personal Auto',
      "Workers' Compensation",
      'Marine & Aviation',
      'Financial & Credit',
      'Medical & Health',
      'Individual Life',
      'Group Life',
      'Individual Annuities',
      'Group Annuities',
      'Reinsurance',
      'Alternative Risk',
      'Specialty & Other',
      'Title',
    ],
  },
  {
    key: 'cross',
    label: 'Cross-cutting',
    options: ['Regulatory Compliance', 'Data Privacy', 'Tax', 'Reinsurance', 'Delegated Authority'],
  },
];

/** Current pick per axis; `LENS_GENERIC` = generic model on that axis. */
export type LensSelection = Record<LensDimension['key'], string>;

/** All-generic selection — the default state of the map. */
export const GENERIC_LENS: LensSelection = {
  market: LENS_GENERIC,
  segment: LENS_GENERIC,
  lob: LENS_GENERIC,
  cross: LENS_GENERIC,
};

/** Read the lens from URL search params (absent/unknown param → generic). */
export function lensFromParams(params: URLSearchParams): LensSelection {
  const lens: LensSelection = { ...GENERIC_LENS };
  for (const d of LENS_DIMENSIONS) {
    const v = params.get(d.key);
    if (v && d.options.includes(v)) lens[d.key] = v;
  }
  return lens;
}

function FunnelIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

/**
 * The lens bar itself — funnel icon + one compact select per axis, separated
 * by `›`. Every select's first option is the generic one and the bar starts
 * all-generic; picks combine across axes (union lens, R5).
 */
export function VariantLensBar({
  lens,
  onChange,
  trailing,
}: {
  lens: LensSelection;
  onChange: (dimension: LensDimension['key'], value: string) => void;
  /** Optional slot after the selects (e.g. a "no variant data yet" chip). */
  trailing?: ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-[#eaeaea] bg-white/90 backdrop-blur pl-3 pr-1.5 py-1 shadow-sm">
      <span className="text-[#0070f3]">
        <FunnelIcon />
      </span>
      {LENS_DIMENSIONS.map((d, i) => {
        const generic = lens[d.key] === LENS_GENERIC;
        return (
          <span key={d.key} className="inline-flex items-center gap-1.5">
            {i > 0 && <span className="text-[#d4d4d4] text-xs select-none">›</span>}
            <Select
              aria-label={d.label}
              title={d.label}
              value={lens[d.key]}
              onChange={(e) => onChange(d.key, e.target.value)}
              className={
                'inline-block w-auto rounded-full border-transparent px-2 py-1 text-xs cursor-pointer hover:border-[#eaeaea] ' +
                (generic ? 'text-[#a3a3a3]' : 'font-medium')
              }
            >
              <option value={LENS_GENERIC}>
                Generic {d.key === 'lob' ? d.label : d.label.toLowerCase()}
              </option>
              {d.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </span>
        );
      })}
      {trailing}
    </div>
  );
}
