// E1 — Forms Hierarchy & Portfolio Summary.
// FR-1.1: one summary card per CORE form (full-width content, vertically
// stacked metrics, high-contrast text — 7/28 card feedback).
// FR-1.2: hierarchy drill-down — every level a defined column, filters
// intersect, layer badge + decision chip on every row.

import { useMemo, type ReactNode } from 'react';
import { EmptyState, Select } from '../../../components/ui';
import { PRODUCT_NAME, PRODUCTS } from './mockData';
import { coreSummaries, decisionOf, effectiveReason, type FormsStore } from './model';
import type { CoreSummary } from './model';
import { STATE_NAME, type FormLayer, type FormRecord } from './types';
import { DecisionChip, LayerBadge, ProgressBar, ReasonChip, SectionTitle } from './chrome';

export interface PortfolioFilters {
  lob: string | null;
  productId: string | null;
}

// ── FR-1.1 — core form summary cards ────────────────────────────────────────

export function FormsCards({
  store,
  filters,
  onFilters,
  onOpenCore,
}: {
  store: FormsStore;
  filters: PortfolioFilters;
  onFilters: (f: PortfolioFilters) => void;
  onOpenCore: (coreId: string, layerFilter: FormLayer | null) => void;
}) {
  const lobs = useMemo(() => [...new Set(PRODUCTS.map((p) => p.lob))], []);
  const summaries = useMemo(
    () =>
      coreSummaries(store, filters.lob).filter(
        (s) => !filters.productId || s.core.productIds.includes(filters.productId),
      ),
    [store, filters],
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Combinatory filters — LOB × product, consistent with the product grid. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Select
          aria-label="Line of business"
          value={filters.lob ?? ''}
          onChange={(e) => onFilters({ ...filters, lob: e.target.value || null })}
          style={{
            width: 'auto',
            minWidth: 170,
            height: 28,
            fontSize: 12,
            padding: '0 28px 0 8px',
          }}
        >
          <option value="">All lines of business</option>
          {lobs.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Product"
          value={filters.productId ?? ''}
          onChange={(e) => onFilters({ ...filters, productId: e.target.value || null })}
          style={{
            width: 'auto',
            minWidth: 190,
            height: 28,
            fontSize: 12,
            padding: '0 28px 0 8px',
          }}
        >
          <option value="">All products</option>
          {PRODUCTS.filter((p) => !filters.lob || p.lob === filters.lob).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      {summaries.length === 0 ? (
        <EmptyState message="No core forms match the filters." />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 12,
          }}
        >
          {summaries.map((s) => (
            <CoreCard key={s.core.formId} summary={s} onOpen={onOpenCore} />
          ))}
        </div>
      )}
    </div>
  );
}

function CoreCard({
  summary: s,
  onOpen,
}: {
  summary: CoreSummary;
  onOpen: (coreId: string, layerFilter: FormLayer | null) => void;
}) {
  const metric = (label: string, value: ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}>
      <span style={{ color: '#404040', fontWeight: 600 }}>{label}</span>
      <span style={{ color: '#171717', fontWeight: 700 }}>{value}</span>
    </div>
  );
  return (
    <div
      style={{
        border: '1px solid #eaeaea',
        borderRadius: 12,
        background: '#fff',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(s.core.formId, null)}
        style={{
          font: 'inherit',
          border: 'none',
          background: 'none',
          padding: 0,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: '#171717' }}>{s.core.title}</span>
        <span style={{ fontSize: 11.5, color: '#525252' }}>
          {s.core.formId} · {s.core.lineOfBusiness}
        </span>
      </button>
      {metric('Used by', `${s.productCount} products`)}
      {metric('States', s.stateCount)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12.5, color: '#404040', fontWeight: 600 }}>Commonality</span>
        <ProgressBar pct={s.commonalityPct} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#171717' }}>
          {s.commonalityPct}%
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <VariationLink
          label="State Variations"
          count={s.stateVariations.length}
          onClick={() => onOpen(s.core.formId, 'STATE_VARIATION')}
        />
        <VariationLink
          label="Product Variations"
          count={s.productVariations.length}
          onClick={() => onOpen(s.core.formId, 'PRODUCT_VARIATION')}
        />
      </div>
    </div>
  );
}

function VariationLink({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        font: 'inherit',
        flex: 1,
        border: '1px solid #eaeaea',
        borderRadius: 8,
        background: '#fafafa',
        padding: '6px 10px',
        fontSize: 12,
        color: '#1d4ed8',
        fontWeight: 600,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {label}: <b>{count}</b>
    </button>
  );
}

// ── FR-1.2 — hierarchy drill-down ───────────────────────────────────────────

export function FormsDrill({
  store,
  coreId,
  layerFilter,
  stateFilter,
  onLayerFilter,
  onStateFilter,
  onBack,
  onOpenForm,
}: {
  store: FormsStore;
  coreId: string;
  layerFilter: FormLayer | null;
  stateFilter: string | null;
  onLayerFilter: (l: FormLayer | null) => void;
  onStateFilter: (s: string | null) => void;
  onBack: () => void;
  onOpenForm: (formId: string) => void;
}) {
  const summary = useMemo(
    () => coreSummaries(store).find((s) => s.core.formId === coreId) ?? null,
    [store, coreId],
  );
  const children = useMemo(() => {
    if (!summary) return [];
    let rows = [...summary.stateVariations, ...summary.productVariations];
    // Filters intersect (FR-1.2 AC).
    if (layerFilter) rows = rows.filter((f) => f.layer === layerFilter);
    if (stateFilter) rows = rows.filter((f) => f.state === stateFilter);
    return rows.sort((a, b) => (a.state ?? '').localeCompare(b.state ?? ''));
  }, [summary, layerFilter, stateFilter]);
  if (!summary) return <EmptyState message="Core form not found." />;
  const states = [
    ...new Set(
      [...summary.stateVariations, ...summary.productVariations]
        .map((f) => f.state)
        .filter((s): s is string => !!s),
    ),
  ].sort();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Breadcrumb — the path back out of the drill. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            font: 'inherit',
            border: 'none',
            background: 'none',
            padding: 0,
            color: '#1d4ed8',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {summary.core.lineOfBusiness}
        </button>
        <span aria-hidden style={{ color: '#a3a3a3' }}>
          ›
        </span>
        <span style={{ color: '#171717', fontWeight: 700 }}>{summary.core.title}</span>
      </div>

      <SectionTitle
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Select
              aria-label="Layer"
              value={layerFilter ?? ''}
              onChange={(e) => onLayerFilter((e.target.value || null) as FormLayer | null)}
              style={{ width: 'auto', height: 26, fontSize: 11.5, padding: '0 26px 0 8px' }}
            >
              <option value="">All layers</option>
              <option value="STATE_VARIATION">State variations</option>
              <option value="PRODUCT_VARIATION">Product variations</option>
            </Select>
            <Select
              aria-label="State"
              value={stateFilter ?? ''}
              onChange={(e) => onStateFilter(e.target.value || null)}
              style={{ width: 'auto', height: 26, fontSize: 11.5, padding: '0 26px 0 8px' }}
            >
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {STATE_NAME[s] ?? s}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {children.length} variation{children.length === 1 ? '' : 's'} of {summary.core.formId}
      </SectionTitle>

      <div style={{ border: '1px solid #eaeaea', borderRadius: 12, background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {[
                'Layer',
                'Form',
                'State',
                'Description',
                'Products',
                'Why it exists',
                'Decision',
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderBottom: '1px solid #eaeaea',
                    color: '#404040',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {children.map((f) => (
              <DrillRow key={f.formId} form={f} store={store} onOpen={onOpenForm} />
            ))}
            {children.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 14, color: '#404040', fontSize: 12.5 }}>
                  No variations match the filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DrillRow({
  form: f,
  store,
  onOpen,
}: {
  form: FormRecord;
  store: FormsStore;
  onOpen: (formId: string) => void;
}) {
  const cell = { padding: '7px 10px', borderBottom: '1px solid #f5f5f5' };
  return (
    <tr>
      <td style={cell}>
        <LayerBadge layer={f.layer} compact />
      </td>
      <td style={cell}>
        <button
          type="button"
          onClick={() => onOpen(f.formId)}
          style={{
            font: 'inherit',
            border: 'none',
            background: 'none',
            padding: 0,
            color: '#1d4ed8',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {f.formId}
        </button>
      </td>
      <td style={{ ...cell, whiteSpace: 'nowrap', color: '#171717' }}>
        {f.state ? (STATE_NAME[f.state] ?? f.state) : 'Countrywide'}
      </td>
      <td style={{ ...cell, color: '#404040' }}>{f.description}</td>
      <td style={{ ...cell, color: '#171717', whiteSpace: 'nowrap' }}>
        {f.productIds.length}
        <span style={{ color: '#525252', fontSize: 11 }}>
          {' '}
          (
          {f.productIds
            .slice(0, 2)
            .map((p) => PRODUCT_NAME[p] ?? p)
            .join(', ')}
          {f.productIds.length > 2 ? ', …' : ''})
        </span>
      </td>
      <td style={cell}>
        <ReasonChip reason={effectiveReason(f, store)} />
      </td>
      <td style={cell}>
        <DecisionChip status={decisionOf(f, store)} />
      </td>
    </tr>
  );
}
