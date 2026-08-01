import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { Card, Chip, ErrorMessage, LoadingState, StatusPill } from '../../components/ui';
import { TocView, type TocRow } from '../../components/TocView';
import { statusTone } from './node-detail-model';

// The Product Models TOC's product page — the model read the way the
// rationalization document reads it, presented as ONE MORE TOC LEVEL: six
// cards (Forms · Rating · Pricing · Underwriting Rules · Filings · Lifecycle
// Behavior), each clicking through to its own page. The open section lives in
// the URL (?section=…) so the browser back button pops out of it, exactly like
// every other drill in the app.
//
// Versions and jurisdictions are FILTERS, never levels: section pages show
// the countrywide (core) model, and on Forms / Filings a jurisdiction select
// overlays the components a state's own form actually deviates on, clearly
// marked as that state's additions. Data: one
// GET /product-spine/product/:id/model fetch (server-derived).

interface ModelElement {
  element: string;
  description: string | null;
  livesIn: string | null;
  format: string | null;
}

interface StateOverlay {
  state: string;
  versionId: string;
  status: string | null;
  forms: (ModelElement & { layer: 'core' | 'state' | 'product' })[];
  filings: ModelElement[];
}

interface ProductModelPayload {
  product: {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    runsIn: string | null;
  };
  ancestors: { id: string; name: string; levelNumber: number }[];
  countrywide: {
    versionId: string;
    name: string;
    status: string | null;
    states: string[];
  };
  model: {
    forms: {
      base: ModelElement[];
      coverages: ModelElement[];
      terms: ModelElement[];
      endorsements: ModelElement[];
      clauses: ModelElement[];
    };
    rating: ModelElement[];
    pricing: ModelElement[];
    underwriting: ModelElement[];
    filings: ModelElement[];
    lifecycle: ModelElement[];
  };
  stateOverlays: StateOverlay[];
}

type SectionKey = 'forms' | 'rating' | 'pricing' | 'underwriting' | 'filings' | 'lifecycle';

const SECTIONS: { key: SectionKey; name: string; hint: string }[] = [
  {
    key: 'forms',
    name: 'Forms',
    hint: 'the wordings, decomposed — coverages · terms · endorsements · clauses',
  },
  { key: 'rating', name: 'Rating', hint: 'exposure bases and rating variables' },
  { key: 'pricing', name: 'Pricing', hint: 'discounts, credits and levers' },
  {
    key: 'underwriting',
    name: 'Underwriting Rules',
    hint: 'appetite, eligibility, referral',
  },
  { key: 'filings', name: 'Filings', hint: 'rate, rule and form filing obligations' },
  {
    key: 'lifecycle',
    name: 'Lifecycle Behavior',
    hint: 'the transactions a policy goes through',
  },
];

const SECTION_PARAM = 'section';

function isSectionKey(v: string | null): v is SectionKey {
  return SECTIONS.some((s) => s.key === v);
}

function ElementTable({
  rows,
  emptyText,
  tone,
}: {
  rows: (ModelElement & { from?: string })[];
  emptyText: string;
  tone?: 'state';
}) {
  if (rows.length === 0)
    return <div className="text-xs text-[#737373] italic px-3 py-2">{emptyText}</div>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373] border-b border-[#eaeaea]">
          <th className="py-1.5 px-3 font-semibold">Element</th>
          <th className="py-1.5 px-3 font-semibold hidden lg:table-cell">Where it lives today</th>
          <th className="py-1.5 px-3 font-semibold w-28 hidden md:table-cell">Format</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e, i) => (
          <tr
            key={`${e.element}-${i}`}
            className={`border-b border-[#f5f5f5] align-top ${tone === 'state' ? 'bg-amber-50/60' : ''}`}
          >
            <td className="py-2 px-3">
              <div className="font-medium text-[#171717] flex items-center gap-2 flex-wrap">
                {e.element}
                {e.from && (
                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 rounded px-1.5 py-0.5">
                    {e.from}
                  </span>
                )}
              </div>
              {e.description && (
                <div className="text-xs text-[#666666] mt-0.5 max-w-3xl">{e.description}</div>
              )}
              {e.livesIn && (
                <div className="text-[11px] text-[#8a8a8a] mt-0.5 lg:hidden">{e.livesIn}</div>
              )}
            </td>
            <td className="py-2 px-3 text-xs text-[#525252] hidden lg:table-cell">{e.livesIn}</td>
            <td className="py-2 px-3 hidden md:table-cell">
              {e.format && <Chip variant="soft">{e.format}</Chip>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SubBand({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2 px-3 py-1.5 bg-[#fcfcfd] border-y border-[#f1f3f5]">
      <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#374151]">
        {label}
      </span>
      <span className="text-[10px] text-[#737373] tnum">{count}</span>
    </div>
  );
}

/** Element count for a section's TOC card (overlays excluded — the cards
 *  describe the countrywide core; states surface inside the section). */
function sectionCount(model: ProductModelPayload['model'], key: SectionKey): number {
  if (key === 'forms') {
    const f = model.forms;
    return (
      f.base.length + f.coverages.length + f.terms.length + f.endorsements.length + f.clauses.length
    );
  }
  return model[key].length;
}

export default function ProductModelView({ id }: { id: string }) {
  const { data, error, loading } = useApi<ProductModelPayload>(
    `/product-spine/product/${encodeURIComponent(id)}/model`,
  );
  // The open section AND the jurisdiction pick live in the URL — the back
  // button pops the section like any other drill, and a deep link lands on
  // the same view.
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get(SECTION_PARAM);
  const section: SectionKey | null = isSectionKey(sectionParam) ? sectionParam : null;
  const state = searchParams.get('state') ?? '';
  const setParam = (key: string, value: string | null, push = false) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: !push },
    );

  const overlay = useMemo(
    () => (data && state ? (data.stateOverlays.find((o) => o.state === state) ?? null) : null),
    [data, state],
  );

  if (loading) return <LoadingState message="Loading the product model…" />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!data) return null;
  const { product, ancestors, countrywide, model, stateOverlays } = data;

  const header = (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        {ancestors.map((a) => (
          <Chip key={a.id} variant="soft">
            {a.name}
          </Chip>
        ))}
        {product.code && <Chip variant="soft">{product.code}</Chip>}
        {countrywide.status && (
          <StatusPill tone={statusTone(countrywide.status)}>{countrywide.status}</StatusPill>
        )}
      </div>
      <h1 className="text-h1 text-[#171717]">
        {product.name}
        {section && (
          <span className="text-[#737373] font-normal">
            {' '}
            › {SECTIONS.find((s) => s.key === section)?.name}
          </span>
        )}
      </h1>
      {!section && product.description && (
        <p className="text-sm text-[#666666] mt-1 max-w-3xl">{product.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-4 mt-3">
        {product.runsIn && (
          <span className="text-xs text-[#525252]">
            <span className="font-semibold">Runs in:</span> {product.runsIn}
          </span>
        )}
        <span className="text-xs text-[#525252]">
          <span className="font-semibold">Written in:</span> {countrywide.states.length || '—'}{' '}
          jurisdiction{countrywide.states.length === 1 ? '' : 's'}
        </span>
        {/* Jurisdiction is a FILTER (the document's separation) — it matters
            on the sections a state's own form deviates on. */}
        {(section === 'forms' || section === 'filings') && stateOverlays.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-[#525252]">
            <span className="font-semibold">Jurisdiction:</span>
            <select
              value={state}
              onChange={(e) => setParam('state', e.target.value || null)}
              className="border border-[#d4d4d4] rounded-md px-2 py-1 text-xs bg-white"
            >
              <option value="">Countrywide core</option>
              {stateOverlays.map((o) => (
                <option key={o.state} value={o.state}>
                  US-{o.state} — own state form
                </option>
              ))}
            </select>
          </label>
        )}
        {overlay && (section === 'forms' || section === 'filings') && (
          <span className="text-[11px] font-medium text-amber-800 bg-amber-100 rounded px-2 py-0.5">
            Showing the core model + US-{overlay.state}&rsquo;s deviations
          </span>
        )}
      </div>
    </div>
  );

  // ── The TOC level: six section cards, each its own page. ──────────────────
  if (!section) {
    const rows: TocRow[] = SECTIONS.map((s) => ({
      id: s.key,
      name: s.name,
      count: sectionCount(model, s.key),
      extra: s.hint,
      // Pushed (not replaced) so the browser back button pops the section.
      onClick: () => setParam(SECTION_PARAM, s.key, true),
    }));
    return (
      <div>
        {header}
        <TocView
          stateKey={`productModel.${product.id}`}
          rows={rows}
          nameLabel="Model component"
          countLabel="Elements"
          extraLabel="What it holds"
          unit="model components"
          totals={
            stateOverlays.length > 0
              ? `${stateOverlays.length} jurisdiction${stateOverlays.length === 1 ? '' : 's'} with an own state form: ${stateOverlays.map((o) => o.state).join(', ')}`
              : 'every covered jurisdiction runs the countrywide core'
          }
        />
      </div>
    );
  }

  // ── One section's own page. ───────────────────────────────────────────────
  const stamp = (rows: ModelElement[], from: string) => rows.map((e) => ({ ...e, from }));
  const overlayForms = overlay ? stamp(overlay.forms, `US-${overlay.state}`) : [];
  const overlayFilings = overlay ? stamp(overlay.filings, `US-${overlay.state}`) : [];

  return (
    <div>
      {header}
      <Card className="p-0 overflow-hidden mb-4">
        {section === 'forms' ? (
          <>
            {model.forms.base.length > 0 && (
              <>
                <SubBand label="Base policy form" count={model.forms.base.length} />
                <ElementTable rows={model.forms.base} emptyText="" />
              </>
            )}
            <SubBand label="Coverages" count={model.forms.coverages.length} />
            <ElementTable rows={model.forms.coverages} emptyText="none recorded" />
            <SubBand label="Terms" count={model.forms.terms.length} />
            <ElementTable rows={model.forms.terms} emptyText="none recorded" />
            <SubBand
              label="Endorsements"
              count={model.forms.endorsements.length + overlayForms.length}
            />
            <ElementTable rows={model.forms.endorsements} emptyText="none recorded" />
            {overlayForms.length > 0 && (
              <ElementTable rows={overlayForms} emptyText="" tone="state" />
            )}
            <SubBand label="Clauses" count={model.forms.clauses.length} />
            <ElementTable rows={model.forms.clauses} emptyText="none recorded" />
          </>
        ) : section === 'filings' ? (
          <>
            <ElementTable rows={model.filings} emptyText="none recorded" />
            {overlayFilings.length > 0 && (
              <ElementTable rows={overlayFilings} emptyText="" tone="state" />
            )}
          </>
        ) : (
          <ElementTable rows={model[section]} emptyText="none recorded" />
        )}
      </Card>
    </div>
  );
}
