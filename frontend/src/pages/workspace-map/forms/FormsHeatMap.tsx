// E2 — State Overlay Heat Map.
// FR-2.1: per-core-form tile grid of all states colored (and icon-labeled —
// never color-only) by status; hover tooltip; click → the FR-3.1 matrix
// scoped to that state.
// FR-2.2: region lens — states aggregate into the default named regions; a
// region shows its worst member status and any unified target form.

import { useMemo } from 'react';
import { Select } from '../../../components/ui';
import { MOCK_FORMS } from './mockData';
import { regionRollups, stateRollups, type FormsStore } from './model';
import type { StateRollup } from './model';
import { REASON_META, STATE_STATUS_META } from './types';
import { SectionTitle, StatusLegend } from './chrome';

export default function FormsHeatMap({
  store,
  coreId,
  regionLens,
  onCore,
  onRegionLens,
  onOpenMatrix,
}: {
  store: FormsStore;
  coreId: string | null;
  regionLens: boolean;
  onCore: (id: string | null) => void;
  onRegionLens: (on: boolean) => void;
  onOpenMatrix: (state: string) => void;
}) {
  const cores = useMemo(() => MOCK_FORMS.filter((f) => f.layer === 'CORE'), []);
  const rollups = useMemo(() => stateRollups(coreId, store), [coreId, store]);
  const regions = useMemo(() => regionRollups(rollups, store), [rollups, store]);
  const regioned = new Set(regions.flatMap((r) => r.states.map((s) => s.code)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Select
          aria-label="Core form"
          value={coreId ?? ''}
          onChange={(e) => onCore(e.target.value || null)}
          style={{
            width: 'auto',
            minWidth: 240,
            height: 28,
            fontSize: 12,
            padding: '0 28px 0 8px',
          }}
        >
          <option value="">All core forms (portfolio)</option>
          {cores.map((c) => (
            <option key={c.formId} value={c.formId}>
              {c.title} ({c.formId})
            </option>
          ))}
        </Select>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: '#404040',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={regionLens}
            onChange={(e) => onRegionLens(e.target.checked)}
          />
          Region lens
        </label>
        <div style={{ marginLeft: 'auto' }}>
          <StatusLegend />
        </div>
      </div>

      {regionLens && (
        <div>
          <SectionTitle>Multistate regions (unify targets)</SectionTitle>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {regions.map((r) => {
              const m = STATE_STATUS_META[r.status];
              return (
                <div
                  key={r.name}
                  style={{
                    flex: '1 1 220px',
                    border: `1px solid ${m.border}`,
                    borderRadius: 12,
                    background: m.bg,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: m.fg }}>
                    <span aria-hidden>{m.icon}</span> {r.name}
                  </span>
                  <span style={{ fontSize: 12, color: '#171717', fontWeight: 600 }}>
                    {r.states.length} states · {r.variantCount} variant forms
                  </span>
                  <span style={{ fontSize: 11.5, color: '#404040' }}>
                    {r.states.map((s) => s.code).join(' · ')}
                  </span>
                  {r.unifiedForm && (
                    <span
                      style={{
                        marginTop: 2,
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#0e7490',
                      }}
                    >
                      ✦ Unified target: {r.unifiedForm.title} ({r.unifiedForm.formId})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <SectionTitle>
          {regionLens ? 'States outside a region' : 'All states'}
          {coreId ? '' : ' — whole portfolio'}
        </SectionTitle>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
            gap: 8,
          }}
        >
          {rollups
            .filter((r) => !regionLens || !regioned.has(r.code))
            .map((r) => (
              <StateTile key={r.code} rollup={r} onClick={() => onOpenMatrix(r.code)} />
            ))}
        </div>
      </div>
    </div>
  );
}

function StateTile({ rollup: r, onClick }: { rollup: StateRollup; onClick: () => void }) {
  const m = STATE_STATUS_META[r.status];
  const tip = [
    r.name,
    m.label,
    r.variantForms.length ? `${r.variantForms.length} variant form(s)` : 'No variant forms',
    r.topReason ? `Top reason: ${REASON_META[r.topReason].label}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <button
      type="button"
      onClick={onClick}
      title={tip}
      aria-label={tip}
      style={{
        font: 'inherit',
        border: `1px solid ${m.border}`,
        borderRadius: 10,
        background: m.bg,
        padding: '8px 6px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 13.5, fontWeight: 800, color: m.fg }}>{r.code}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: m.fg }}>
        <span aria-hidden>{m.icon}</span>{' '}
        {r.status === 'standard' ? 'Standard' : `${r.variantForms.length} variant`}
      </span>
    </button>
  );
}
