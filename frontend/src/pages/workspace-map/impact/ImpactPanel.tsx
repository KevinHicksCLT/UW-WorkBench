import { createPortal } from 'react-dom';
import {
  CATEGORY_LABELS,
  CHANGE_LABELS,
  DESTRUCTIVE,
  SEVERITY_META,
  type Impact,
  type ImpactSeverity,
} from './types';
import type { ImpactGate } from './useImpactGate';

// The common change-impact panel — rendered by every lens's decision surface
// over the same gate. Shows what the pending change touches (prioritized,
// breaking first) and holds the actual write behind an explicit
// "Proceed" confirmation. zIndex 70: it stacks ABOVE ReviewModal (60), which
// stays open underneath while the user weighs the report.

const SEVERITIES: ImpactSeverity[] = ['BREAKING', 'HIGH', 'MEDIUM', 'LOW'];

function SeverityChip({ severity }: { severity: ImpactSeverity }) {
  const m = SEVERITY_META[severity];
  return (
    <span
      style={{
        flexShrink: 0,
        padding: '1px 7px',
        borderRadius: 999,
        background: m.bg,
        border: `1px solid ${m.border}`,
        color: m.fg,
        fontSize: 9.5,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
      }}
    >
      {m.label}
    </span>
  );
}

function ImpactRow({ impact }: { impact: Impact }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '7px 10px',
        borderTop: '1px solid #f1f5f9',
      }}
    >
      <SeverityChip severity={impact.severity} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#171717' }}>
            {impact.entityName}
          </span>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>
            {CATEGORY_LABELS[impact.category] ?? impact.category}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#525252', lineHeight: 1.45 }}>{impact.description}</div>
      </div>
    </div>
  );
}

export default function ImpactPanel({ gate }: { gate: ImpactGate }) {
  const s = gate.state;
  if (!s) return null;
  const verb = CHANGE_LABELS[s.request.changeType];
  const destructive = DESTRUCTIVE.has(s.request.changeType);
  const report = s.report;
  const subjectName = report?.subject.name ?? s.request.label ?? 'this change';

  return createPortal(
    <div
      role="presentation"
      onClick={gate.cancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.4)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 70,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Change impact assessment — ${subjectName}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 700,
          maxWidth: 'calc(100% - 48px)',
          maxHeight: 'calc(100vh - 110px)',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(15,23,42,.3)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #eaeaea' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#6366f1', letterSpacing: 0.4 }}>
            CHANGE IMPACT ASSESSMENT
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: '#171717', flex: 1 }}>
              {subjectName}
            </span>
            <span
              style={{
                padding: '2px 9px',
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 700,
                color: '#fff',
                background: destructive ? '#dc2626' : '#4f46e5',
              }}
            >
              {verb}
            </span>
          </div>
          {report?.subject.context && (
            <div style={{ fontSize: 11, color: '#737373', marginTop: 2 }}>
              {report.subject.context}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {s.loading && (
            <div style={{ padding: 24, fontSize: 12.5, color: '#737373' }}>
              Assessing everything this change touches…
            </div>
          )}
          {!s.loading && s.error && !report && (
            <div
              style={{
                margin: 14,
                padding: '9px 12px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: 11.5,
              }}
            >
              Impact assessment unavailable — {s.error}. You can still proceed, but the consequences
              have not been reviewed.
            </div>
          )}
          {report && (
            <>
              {/* Summary tiles */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 8,
                  padding: '12px 16px 4px',
                }}
              >
                {SEVERITIES.map((sev) => {
                  const m = SEVERITY_META[sev];
                  const n =
                    sev === 'BREAKING'
                      ? report.summary.breaking
                      : sev === 'HIGH'
                        ? report.summary.high
                        : sev === 'MEDIUM'
                          ? report.summary.medium
                          : report.summary.low;
                  return (
                    <div
                      key={sev}
                      style={{
                        borderRadius: 8,
                        border: `1px solid ${n ? m.border : '#f1f5f9'}`,
                        background: n ? m.bg : '#fafafa',
                        padding: '7px 10px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          color: n ? m.fg : '#cbd5e1',
                          lineHeight: 1.1,
                        }}
                      >
                        {n}
                      </div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: n ? m.fg : '#94a3b8' }}>
                        {m.label}
                      </div>
                    </div>
                  );
                })}
              </div>
              {report.summary.breaking > 0 && (
                <div
                  style={{
                    margin: '8px 16px 0',
                    padding: '7px 11px',
                    borderRadius: 8,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  {report.summary.breaking} breaking impact
                  {report.summary.breaking === 1 ? '' : 's'} — these have no fallback today and need
                  an explicit plan before this change ships.
                </div>
              )}
              <div style={{ padding: '10px 6px 6px' }}>
                {report.impacts.map((impact, i) => (
                  <ImpactRow
                    key={`${impact.category}:${impact.entityId ?? impact.entityName}:${i}`}
                    impact={impact}
                  />
                ))}
                {report.impacts.length === 0 && (
                  <div style={{ padding: '14px 12px', fontSize: 12, color: '#737373' }}>
                    Nothing else in the model touches this — the change is self-contained.
                  </div>
                )}
              </div>
            </>
          )}
          {report && s.error && (
            <div
              style={{
                margin: '0 16px 10px',
                padding: '7px 11px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: 11.5,
              }}
            >
              {s.error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '10px 16px',
            borderTop: '1px solid #eaeaea',
            background: '#fafafa',
          }}
        >
          <button
            type="button"
            onClick={gate.cancel}
            disabled={s.busy}
            style={{
              font: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: 7,
              border: '1px solid #e5e5e5',
              background: '#fff',
              color: '#525252',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              gate.confirm().catch(() => {
                /* surfaced via gate.state.error */
              });
            }}
            disabled={s.busy || s.loading}
            style={{
              font: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 16px',
              borderRadius: 7,
              border: 'none',
              background: destructive ? '#dc2626' : '#4f46e5',
              color: '#fff',
              cursor: s.busy || s.loading ? 'default' : 'pointer',
              opacity: s.busy || s.loading ? 0.6 : 1,
            }}
          >
            {s.busy ? 'Applying…' : `Proceed — ${verb.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
