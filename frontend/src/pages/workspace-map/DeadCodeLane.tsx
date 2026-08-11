import { useState } from 'react';
import { deadCodeGroups } from './stats';
import { RED } from './types';
import type { BoardApp, Finding } from './types';

// The v3 wireframe's full-width dead-code band under the applications board:
// every dead-code finding across ALL compared sources, grouped per
// application, with the per-source counts in the header. Collapsed to a single
// red strip by default and hidden entirely at zero, so it never steals
// vertical space from the three-column map.
//
// The lane is read-only for now: findings carry a migrationStatus lifecycle
// ("Retired" = signed off), but the rationalization API exposes no PATCH for
// individual findings yet — the retire-with-sign-off action lands when it does.

function DeadRow({ finding }: { finding: Finding }) {
  const retired = finding.migrationStatus === 'Retired';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        padding: '4px 0',
        borderBottom: '1px solid #fee2e2',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: '#991b1b', whiteSpace: 'nowrap' }}>
        {finding.name}
      </span>
      <span style={{ fontSize: 10, color: '#b91c1c', whiteSpace: 'nowrap' }}>{finding.layer}</span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 11,
          color: '#7f1d1d',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {finding.plainSummary ?? finding.rationale ?? ''}
      </span>
      {finding.codeRef && (
        <span
          style={{
            fontSize: 9.5,
            color: '#b91c1c',
            fontFamily: 'ui-monospace, monospace',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {finding.codeRef}
        </span>
      )}
      <span
        style={{
          padding: '1px 7px',
          borderRadius: 999,
          fontSize: 9.5,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          background: retired ? '#f1f5f9' : RED,
          border: `1px solid ${retired ? '#cbd5e1' : RED}`,
          color: retired ? '#475569' : '#fff',
        }}
      >
        {retired ? 'RETIRED' : 'AWAITING SIGN-OFF'}
      </span>
    </div>
  );
}

export default function DeadCodeLane({
  findings,
  apps,
}: {
  /** The FULL comparison scope — the lane spans every shown source. */
  findings: Finding[];
  apps: BoardApp[];
}) {
  const [open, setOpen] = useState(false);
  const groups = deadCodeGroups(findings, apps);
  const total = groups.reduce((a, g) => a + g.findings.length, 0);
  if (total === 0) return null;

  return (
    <div
      style={{
        marginTop: 10,
        border: '1px solid #fecaca',
        borderRadius: 10,
        background: '#fef2f2',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '7px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            color: RED,
            fontSize: 10,
            display: 'inline-block',
            transform: open ? 'none' : 'rotate(-90deg)',
            flexShrink: 0,
          }}
        >
          ▾
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#991b1b', whiteSpace: 'nowrap' }}>
          Dead code {total}
        </span>
        <span style={{ fontSize: 11.5, color: '#b91c1c', whiteSpace: 'nowrap' }}>
          across {groups.length} application{groups.length === 1 ? '' : 's'} — unreachable /
          superseded — retire with sign-off
        </span>
        <span style={{ flex: 1 }} />
        {groups.map((g) => (
          <span
            key={g.appId}
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: '#991b1b',
              whiteSpace: 'nowrap',
              padding: '1px 8px',
              borderRadius: 999,
              border: '1px solid #fca5a5',
              background: '#fff',
              flexShrink: 0,
            }}
          >
            {g.appName} · {g.findings.length}
          </span>
        ))}
      </button>
      {open && (
        <div
          style={{
            borderTop: '1px solid #fecaca',
            background: '#fff',
            padding: '6px 14px 10px',
            display: 'flex',
            gap: 24,
            alignItems: 'flex-start',
          }}
        >
          {groups.map((g) => (
            <div key={g.appId} style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '.07em',
                  textTransform: 'uppercase',
                  color: '#991b1b',
                  padding: '4px 0',
                  borderBottom: `2px solid ${RED}`,
                }}
              >
                {g.appName} ({g.findings.length})
              </div>
              {g.findings.map((f) => (
                <DeadRow key={f.id} finding={f} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
