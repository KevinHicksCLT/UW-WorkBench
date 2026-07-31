// FR-6.1 — Executive Decision Dashboard. Every number is computed live from
// the form + decision records (model.ts); nothing here is hardcoded.

import { dashboardStats, opportunities, type FormsStore } from './model';
import type { Opportunity } from './model';
import { ProgressBar, SectionTitle, StatTile } from './chrome';

const SAVINGS_META: Record<Opportunity['savings'], { fg: string; bg: string; border: string }> = {
  High: { fg: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
  Medium: { fg: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  Low: { fg: '#404040', bg: '#f5f5f5', border: '#e5e5e5' },
};

export default function FormsDashboard({
  store,
  onOpenCluster,
  onOpenMatrix,
}: {
  store: FormsStore;
  onOpenCluster: (clusterId: string) => void;
  onOpenMatrix: (state: string) => void;
}) {
  const stats = dashboardStats(store);
  const opps = opportunities(store);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Portfolio counts */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatTile label="Total Forms" value={stats.totalForms} />
        <StatTile label="Core Forms" value={stats.coreForms} accent="#166534" />
        <StatTile label="State Variations" value={stats.stateVariations} accent="#92400e" />
        <StatTile label="Product Variations" value={stats.productVariations} accent="#991b1b" />
        <StatTile
          label="Rationalization Candidates"
          value={stats.candidates}
          accent="#3730a3"
          sub="Undecided forms flagged by clustering or the agent"
        />
      </div>

      {/* Decision progress (7/28 progress-indicator requirement) */}
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
        <SectionTitle
          right={
            <span style={{ fontSize: 12, fontWeight: 600, color: '#404040' }}>
              {stats.decided} decided · {stats.outstanding} outstanding
            </span>
          }
        >
          Decision progress
        </SectionTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ProgressBar pct={stats.progressPct} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#171717', minWidth: 38 }}>
            {stats.progressPct}%
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 12.5 }}>
          <span style={{ color: '#404040' }}>
            Current state: <b style={{ color: '#171717' }}>{stats.currentCount} forms</b>
          </span>
          <span aria-hidden style={{ color: '#a3a3a3' }}>
            →
          </span>
          <span style={{ color: '#404040' }}>
            Target state (after recorded decisions execute):{' '}
            <b style={{ color: '#166534' }}>{stats.projectedCount} forms</b>
            {stats.unifiedCount > 0 && (
              <span style={{ color: '#0e7490' }}>
                {' '}
                · {stats.unifiedCount} multistate overlay(s)
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Top opportunities */}
      <div
        style={{
          border: '1px solid #eaeaea',
          borderRadius: 12,
          background: '#fff',
          padding: '14px 16px',
        }}
      >
        <SectionTitle>Top opportunities</SectionTitle>
        {opps.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: '#404040' }}>
            All flagged opportunities have recorded decisions.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                {['Opportunity', 'Savings potential', 'Evidence'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderBottom: '1px solid #eaeaea',
                      color: '#404040',
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {opps.map((o) => {
                const m = SAVINGS_META[o.savings];
                return (
                  <tr key={o.name}>
                    <td style={{ padding: '7px 8px', borderBottom: '1px solid #f5f5f5' }}>
                      <button
                        type="button"
                        onClick={() =>
                          o.target.kind === 'cluster'
                            ? onOpenCluster(o.target.clusterId)
                            : onOpenMatrix(o.target.state)
                        }
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
                        {o.name}
                      </button>
                    </td>
                    <td style={{ padding: '7px 8px', borderBottom: '1px solid #f5f5f5' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          padding: '1px 9px',
                          borderRadius: 999,
                          background: m.bg,
                          border: `1px solid ${m.border}`,
                          color: m.fg,
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      >
                        {o.savings}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '7px 8px',
                        borderBottom: '1px solid #f5f5f5',
                        color: '#404040',
                      }}
                    >
                      {o.detail}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
