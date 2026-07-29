import { GREEN } from '../types';
import { MATCH_META, type ElementGroup } from './spine';

// Small chrome pieces of the Products board, shared by its two views.

export function TraceBreadcrumb({
  group,
  versionCount,
  lobName,
}: {
  group: ElementGroup;
  versionCount: number;
  lobName: string;
}) {
  const meta = MATCH_META[group.status];
  const review = group.status === 'PARTIAL' || group.status === 'UNIQUE';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: `1px solid ${meta.border}`,
        borderRadius: 999,
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,.08)',
        padding: '4px 8px 4px 11px',
        marginBottom: 8,
        alignSelf: 'flex-start',
      }}
    >
      <span
        style={{
          padding: '1px 8px',
          borderRadius: 999,
          background: meta.fg,
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        {meta.label}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{group.name}</span>
      <span style={{ fontSize: 11, color: '#525252' }}>
        in <b style={{ fontWeight: 600 }}>{group.component}</b> ·{' '}
        {group.presentIn === versionCount
          ? `all ${versionCount} versions`
          : `${group.presentIn} of ${versionCount} versions`}
      </span>
      <span style={{ color: '#737373', fontSize: 12 }}>→</span>
      <span style={{ fontSize: 12.5, color: GREEN, fontWeight: 600 }}>{lobName} model</span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 9px',
          borderRadius: 999,
          background: review ? '#fffbeb' : '#dcfce7',
          border: `1px solid ${review ? '#fde68a' : '#a7f3d0'}`,
          fontSize: 11,
          fontWeight: 600,
          color: review ? '#92400e' : '#047857',
        }}
      >
        {review ? 'DECIDE — ADOPT OR VARIANT' : 'FOLDS TO ONE ELEMENT'}
      </span>
    </div>
  );
}

export function ZoomBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        border: '1px solid #eaeaea',
        borderRadius: 6,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,.05)',
        fontSize: label === '⛶' ? 13 : 16,
        color: '#525252',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
