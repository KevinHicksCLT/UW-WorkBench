import { findingMoves, GREEN, RED } from './types';
import type { Finding } from './types';

// The selected finding's trace pill above the board: name → the layer it sits
// in → (when it moves) where it lands, and the destination component. Extracted
// from WorkspaceMap so the shell stays a composition module.

export default function TraceBreadcrumb({
  finding,
  destination,
}: {
  finding: Finding;
  destination: string | null;
}) {
  const moved = findingMoves(finding);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: `1px solid ${moved ? '#fecaca' : '#a7f3d0'}`,
        borderRadius: 999,
        background: '#fff',
        boxShadow: `0 2px 8px ${moved ? 'rgba(220,38,38,.12)' : 'rgba(16,185,129,.12)'}`,
        padding: '5px 8px 5px 12px',
        marginBottom: 10,
        alignSelf: 'flex-start',
      }}
    >
      <span
        style={{
          width: 15,
          height: 15,
          borderRadius: 999,
          background: moved ? '#fee2e2' : '#dcfce7',
          border: `1px solid ${moved ? '#fca5a5' : '#86efac'}`,
          color: moved ? RED : GREEN,
          fontSize: 9,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
        }}
      >
        {moved ? '✕' : '✓'}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{finding.name}</span>
      <span style={{ fontSize: 11, color: '#525252' }}>
        in the <b style={{ fontWeight: 600, color: moved ? RED : GREEN }}>{finding.layer}</b> layer
      </span>
      {moved && (finding.targetLayer || finding.recommendedLayer) && (
        <>
          <span style={{ color: '#a3a3a3', fontSize: 12 }}>→</span>
          <span style={{ fontSize: 12.5, color: GREEN, fontWeight: 600 }}>
            {finding.targetLayer ?? finding.recommendedLayer}
          </span>
        </>
      )}
      {destination && (
        <>
          <span style={{ color: '#a3a3a3', fontSize: 12 }}>→</span>
          <span style={{ fontSize: 12.5, color: '#525252' }}>{destination}</span>
        </>
      )}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 9px',
          borderRadius: 999,
          background: moved ? '#ecfdf5' : '#dcfce7',
          border: '1px solid #a7f3d0',
          fontSize: 11,
          fontWeight: 600,
          color: '#047857',
        }}
      >
        {moved ? 'MAPPED' : 'STAYS'}
      </span>
    </div>
  );
}
