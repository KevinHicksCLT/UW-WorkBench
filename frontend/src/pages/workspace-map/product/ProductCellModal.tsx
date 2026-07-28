import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../../lib/api';
import { useApi } from '../../../lib/useApi';
import { MATCH_META, groupCitations } from './spine';
import type {
  Comparison,
  ElementGroup,
  ProductDecision,
  ProductDecisionStatus,
  VersionColumn,
} from './spine';

// The grid's cell drill-down — one model component of one version, every
// normalized element group behind the cell as a card tagged Common / Varies /
// Unique, with the Adopt / Variant decision wired to the same
// /product-spine/decisions store the detail view uses. The header surfaces the
// matching dimension definition from the product-model framework so the cell
// reads against the meta-model, not just the data.

interface FrameworkDimension {
  n: number;
  name: string;
  definition: string;
  atomicElements: string[];
  systemOfRecord: string;
}

interface FrameworkPayload {
  dimensions: FrameworkDimension[];
}

/** Loose match: "Coverages" ↔ "Coverages", "Underwriting Rules" ↔ "Underwriting rules"… */
export function dimensionFor(
  component: string,
  dimensions: FrameworkDimension[] | undefined,
): FrameworkDimension | null {
  if (!dimensions) return null;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z]+/g, ' ')
      .trim();
  const c = norm(component);
  return (
    dimensions.find((d) => {
      const dn = norm(d.name);
      return dn === c || c.includes(dn) || dn.includes(c);
    }) ?? null
  );
}

export default function ProductCellModal({
  version,
  component,
  comparison,
  lobId,
  lobName,
  onComponent,
  onClose,
}: {
  version: VersionColumn;
  component: string;
  comparison: Comparison;
  lobId: string;
  lobName: string;
  onComponent: (component: string) => void;
  onClose: () => void;
}) {
  const row = comparison.rows.find((r) => r.component === component) ?? null;
  const { data: decisionRows, refetch } = useApi<ProductDecision[]>(
    `/product-spine/decisions?lobId=${lobId}`,
  );
  const decisions = useMemo(() => {
    const m: Record<string, ProductDecisionStatus> = {};
    for (const d of decisionRows ?? []) m[d.groupKey] = d.status;
    return m;
  }, [decisionRows]);
  const { data: framework } = useApi<FrameworkPayload>('/product-spine/framework');
  const dimension = dimensionFor(component, framework?.dimensions);

  const ci = comparison.axis.indexOf(component);
  const at = (n: number) =>
    comparison.axis[(n + comparison.axis.length) % comparison.axis.length] ?? component;

  const groups = row?.groups ?? [];
  const count = (s: ElementGroup['status']) => groups.filter((g) => g.status === s).length;
  const reviewable = groups.filter((g) => g.status === 'PARTIAL' || g.status === 'UNIQUE');

  const decide = async (group: ElementGroup, status: ProductDecisionStatus) => {
    await api.put('/product-spine/decisions', {
      lobId,
      component: group.component,
      groupKey: group.key,
      status,
    });
    refetch();
  };

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.34)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 80,
      }}
    >
      <div
        role="dialog"
        aria-label={`${component} — ${version.productName} ${version.name}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 1080,
          maxWidth: 'calc(100% - 60px)',
          maxHeight: 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(15,23,42,.28)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 16px',
            borderBottom: '1px solid #eaeaea',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: '.07em',
                textTransform: 'uppercase',
                color: '#b45309',
              }}
            >
              Model detail · {component}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#171717', marginTop: 3 }}>
              {component} — {version.productName} · {version.name}
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
              {version.segmentName} › {version.lobName} › {version.productName} › {version.name} ·
              compared against the canonical {lobName} model
            </div>
            {dimension && (
              <div style={{ fontSize: 11, color: '#525252', marginTop: 5, maxWidth: 720 }}>
                <b style={{ color: '#334155' }}>
                  Dimension {dimension.n} — {dimension.name}:
                </b>{' '}
                {dimension.definition}
                {dimension.systemOfRecord && (
                  <span style={{ color: '#64748b' }}>
                    {' '}
                    · system of record: {dimension.systemOfRecord}
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => onComponent(at(ci - 1))}
              style={{
                font: 'inherit',
                fontSize: 11,
                color: '#525252',
                border: '1px solid #e5e5e5',
                background: '#fff',
                borderRadius: 6,
                padding: '5px 9px',
                cursor: 'pointer',
              }}
            >
              ‹ {at(ci - 1)}
            </button>
            <button
              type="button"
              onClick={() => onComponent(at(ci + 1))}
              style={{
                font: 'inherit',
                fontSize: 11,
                color: '#525252',
                border: '1px solid #e5e5e5',
                background: '#fff',
                borderRadius: 6,
                padding: '5px 9px',
                cursor: 'pointer',
              }}
            >
              {at(ci + 1)} ›
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              style={{
                font: 'inherit',
                fontSize: 14,
                color: '#737373',
                background: 'none',
                border: 'none',
                padding: '2px 8px',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 16px',
            background: '#fafafa',
            borderBottom: '1px solid #eaeaea',
            flexWrap: 'wrap',
          }}
        >
          {(
            [
              [groups.length, 'element groups', '#171717'],
              [count('COMMON'), 'common to every version', '#1d4ed8'],
              [count('PARTIAL'), 'vary by version', '#b45309'],
              [count('UNIQUE'), 'unique to one version', '#475569'],
            ] as [number, string, string][]
          ).map(([n, label, tone]) => (
            <span
              key={label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#fff',
                border: '1px solid #eaeaea',
                borderRadius: 999,
                padding: '3px 11px',
                fontSize: 11.5,
                color: '#525252',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: tone }} />
              <b style={{ color: tone }}>{n}</b>
              {label}
            </span>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: '#64748b' }}>
            Common folds into the canonical model · Varies and Unique need a decision
          </span>
        </div>

        <div style={{ overflow: 'auto', padding: '12px 14px', flex: 1, minHeight: 0 }}>
          {!row && (
            <div style={{ fontSize: 12, color: '#737373', padding: 12 }}>
              This version does not carry the {component} component.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {groups.map((g) => {
              const meta = MATCH_META[g.status];
              const mine = g.perVersion[version.id];
              const decided = decisions[g.key];
              const actionable = g.status === 'PARTIAL' || g.status === 'UNIQUE';
              const cites = groupCitations(g);
              return (
                <div
                  key={g.key}
                  style={{
                    border: `1px solid ${meta.border}`,
                    borderLeft: `3px solid ${meta.fg}`,
                    borderRadius: 8,
                    padding: '8px 10px',
                    background: mine ? meta.bg : '#fbfcfe',
                    opacity: mine ? 1 : 0.65,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        color: '#171717',
                        flex: 1,
                      }}
                    >
                      {g.name}
                    </span>
                    <span
                      style={{
                        fontSize: 8.5,
                        fontWeight: 700,
                        color: meta.fg,
                        letterSpacing: '.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {meta.label.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, lineHeight: 1.45, color: '#525252', marginTop: 4 }}>
                    {mine?.description ??
                      (mine
                        ? `carried by this version`
                        : `not in this version — ${g.presentIn} other version${g.presentIn === 1 ? '' : 's'} carry it`)}
                  </div>
                  {cites.length > 0 && (
                    <div
                      style={{
                        fontSize: 9.5,
                        fontFamily: 'ui-monospace, monospace',
                        color: '#737373',
                        marginTop: 5,
                      }}
                    >
                      {cites.slice(0, 2).join(' · ')}
                    </div>
                  )}
                  {actionable && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 4,
                        marginTop: 7,
                        borderTop: '1px solid rgba(0,0,0,.05)',
                        paddingTop: 6,
                      }}
                    >
                      {(
                        [
                          ['Adopt', 'APPROVED'],
                          ['Variant', 'HELD'],
                        ] as [string, ProductDecisionStatus][]
                      ).map(([label, status]) => {
                        const on = decided === status;
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => void decide(g, status)}
                            style={{
                              font: 'inherit',
                              fontSize: 9.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                              borderRadius: 5,
                              padding: '2px 7px',
                              color: on ? '#fff' : '#525252',
                              background: on ? (label === 'Adopt' ? '#4f46e5' : '#525252') : '#fff',
                              border: `1px solid ${on ? 'transparent' : '#e5e5e5'}`,
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderTop: '1px solid #eaeaea',
            background: '#fafafa',
          }}
        >
          <span style={{ fontSize: 11.5, color: '#525252' }}>
            {reviewable.length} of {groups.length} element groups need a decision in this component
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => onComponent(at(ci + 1))}
            style={{
              font: 'inherit',
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              background: '#171717',
              border: 'none',
              borderRadius: 6,
              padding: '6px 13px',
              cursor: 'pointer',
            }}
          >
            Next component ›
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
