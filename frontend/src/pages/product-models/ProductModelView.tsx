import { useMemo, useState } from 'react';
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

function TableHead() {
  return (
    <thead>
      <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373] border-b border-[#eaeaea]">
        <th className="py-1.5 px-3 font-semibold">Element</th>
        <th className="py-1.5 px-3 font-semibold hidden lg:table-cell">Where it lives today</th>
        <th className="py-1.5 px-3 font-semibold w-28 hidden md:table-cell">Format</th>
      </tr>
    </thead>
  );
}

/** Element rows for a shared table body — the section pages compose several
 *  runs of these (banded) under ONE TableHead. */
function ElementRows({
  rows,
  emptyText,
  tone,
}: {
  rows: (ModelElement & { from?: string })[];
  emptyText: string;
  tone?: 'state';
}) {
  if (rows.length === 0)
    return emptyText ? (
      <tr>
        <td colSpan={3} className="text-xs text-[#737373] italic px-3 py-2">
          {emptyText}
        </td>
      </tr>
    ) : null;
  return (
    <>
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
    </>
  );
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
      <TableHead />
      <tbody>
        <ElementRows rows={rows} emptyText={emptyText} tone={tone} />
      </tbody>
    </table>
  );
}

/** Collapsible band row inside the shared table — chevron + label + count,
 *  spans every column; the band's element rows fold behind it. */
function BandRow({
  label,
  count,
  collapsed,
  onToggle,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <tr
      role="button"
      onClick={onToggle}
      title={collapsed ? `expand ${label}` : `collapse ${label}`}
      className="cursor-pointer bg-[#fcfcfd] border-y border-[#f1f3f5]"
    >
      <td colSpan={3} className="px-3 py-1.5">
        <span className="flex items-baseline gap-2">
          <span aria-hidden className="text-[10px] text-[#525252]">
            {collapsed ? '▸' : '▾'}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#374151]">
            {label}
          </span>
          <span className="text-[10px] text-[#737373] tnum">{count}</span>
        </span>
      </td>
    </tr>
  );
}

/** Element count for a section's TOC card. With a state picked, Forms and
 *  Filings include that state's own-form additions — the cards show the
 *  scoped model before the user drills in. */
function sectionCount(
  model: ProductModelPayload['model'],
  key: SectionKey,
  overlay: StateOverlay | null,
): number {
  if (key === 'forms') {
    const f = model.forms;
    return (
      f.base.length +
      f.coverages.length +
      f.terms.length +
      f.endorsements.length +
      f.clauses.length +
      (overlay?.forms.length ?? 0)
    );
  }
  if (key === 'filings') return model.filings.length + (overlay?.filings.length ?? 0);
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
  // Per-band collapse (Coverages / Terms / Endorsements / …) on the section
  // pages — session-local, all expanded by default.
  const [closedBands, setClosedBands] = useState<Record<string, boolean>>({});
  const toggleBand = (k: string) => setClosedBands((c) => ({ ...c, [k]: !c[k] }));

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
        {/* Version / jurisdiction is a FILTER on the whole product page (the
            document's separation) — an L4 node IS a "Version / Jurisdiction",
            so one selector covers both. Picking a state re-scopes the card
            counts and every section; the deviations land on Forms and
            Filings, flagged as that state's additions. */}
        {stateOverlays.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-[#525252]">
            <span className="font-semibold">Version / jurisdiction:</span>
            <select
              value={state}
              onChange={(e) => setParam('state', e.target.value || null)}
              className="border border-[#d4d4d4] rounded-md px-2 py-1 text-xs bg-white"
            >
              <option value="">Countrywide core — {countrywide.states.length} jurisdictions</option>
              {stateOverlays.map((o) => (
                <option key={o.state} value={o.state}>
                  US-{o.state} — own state form{o.status ? ` · ${o.status}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        {overlay && (
          <span className="text-[11px] font-medium text-amber-800 bg-amber-100 rounded px-2 py-0.5">
            Core model + US-{overlay.state}&rsquo;s deviations
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
      count: sectionCount(model, s.key, overlay),
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
            overlay
              ? `US-${overlay.state} — the core model plus this state's own-form deviations`
              : stateOverlays.length > 0
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
          // ONE table, ONE header — every band is a collapsible row inside it.
          <table className="w-full text-sm">
            <TableHead />
            <tbody>
              {model.forms.base.length > 0 && (
                <>
                  <BandRow
                    label="Base policy form"
                    count={model.forms.base.length}
                    collapsed={Boolean(closedBands.base)}
                    onToggle={() => toggleBand('base')}
                  />
                  {!closedBands.base && <ElementRows rows={model.forms.base} emptyText="" />}
                </>
              )}
              <BandRow
                label="Coverages"
                count={model.forms.coverages.length}
                collapsed={Boolean(closedBands.coverages)}
                onToggle={() => toggleBand('coverages')}
              />
              {!closedBands.coverages && (
                <ElementRows rows={model.forms.coverages} emptyText="none recorded" />
              )}
              <BandRow
                label="Terms"
                count={model.forms.terms.length}
                collapsed={Boolean(closedBands.terms)}
                onToggle={() => toggleBand('terms')}
              />
              {!closedBands.terms && (
                <ElementRows rows={model.forms.terms} emptyText="none recorded" />
              )}
              <BandRow
                label="Endorsements"
                count={model.forms.endorsements.length + overlayForms.length}
                collapsed={Boolean(closedBands.endorsements)}
                onToggle={() => toggleBand('endorsements')}
              />
              {!closedBands.endorsements && (
                <>
                  <ElementRows rows={model.forms.endorsements} emptyText="none recorded" />
                  {overlayForms.length > 0 && (
                    <ElementRows rows={overlayForms} emptyText="" tone="state" />
                  )}
                </>
              )}
              <BandRow
                label="Clauses"
                count={model.forms.clauses.length}
                collapsed={Boolean(closedBands.clauses)}
                onToggle={() => toggleBand('clauses')}
              />
              {!closedBands.clauses && (
                <ElementRows rows={model.forms.clauses} emptyText="none recorded" />
              )}
            </tbody>
          </table>
        ) : section === 'filings' ? (
          <table className="w-full text-sm">
            <TableHead />
            <tbody>
              <ElementRows rows={model.filings} emptyText="none recorded" />
              {overlayFilings.length > 0 && (
                <ElementRows rows={overlayFilings} emptyText="" tone="state" />
              )}
            </tbody>
          </table>
        ) : (
          <ElementTable rows={model[section]} emptyText="none recorded" />
        )}
      </Card>
    </div>
  );
}
