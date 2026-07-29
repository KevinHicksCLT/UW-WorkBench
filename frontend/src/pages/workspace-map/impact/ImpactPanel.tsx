import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../../lib/api';
import {
  CATEGORY_LABELS,
  CHANGE_LABELS,
  DESTRUCTIVE,
  SEVERITY_META,
  type ImpactReport,
  type ImpactSeverity,
} from './types';
import type { ImpactGate } from './useImpactGate';

// The common change-impact panel — rendered by every lens's decision surface
// over the same gate. The report reads as a board: one column per severity
// (Breaking › High › Medium › Info) with the touched entities organized
// beneath, plus a fast AI read of the whole report on top. Brand accents use
// the Capgemini logo blue. zIndex 70: stacks ABOVE ReviewModal (60), which
// stays open underneath while the user weighs the report.

/** Capgemini wordmark blue (capgemini-wordmark.svg primary fill). */
const LOGO_BLUE = '#0070AD';

const SEVERITIES: ImpactSeverity[] = ['BREAKING', 'HIGH', 'MEDIUM', 'LOW'];

/** Narrates the deterministic report via POST /impact/summary (Haiku behind a
 *  hard 4s server race). Renders nothing when the AI is unavailable or slow —
 *  the report itself is never blocked on this. */
function AiAssessment({ report }: { report: ImpactReport }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setText(null);
    setLoading(true);
    api
      .post(
        '/impact/summary',
        {
          subject: report.subject,
          changeType: report.changeType,
          summary: report.summary,
          impacts: report.impacts.slice(0, 40).map((i) => ({
            severity: i.severity,
            category: i.category.slice(0, 40),
            entityName: i.entityName.slice(0, 300),
            description: i.description.slice(0, 500),
          })),
        },
        { invalidate: 'none' },
      )
      .then((r) => {
        if (!alive) return;
        setText((r as { summary: string | null }).summary);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setText(null);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [report]);

  if (!loading && !text) return null;
  return (
    <div
      style={{
        margin: '10px 16px 0',
        padding: '8px 12px',
        borderRadius: 8,
        background: '#f0f7fb',
        borderLeft: `3px solid ${LOGO_BLUE}`,
      }}
    >
      <div style={{ fontSize: 9.5, fontWeight: 700, color: LOGO_BLUE, letterSpacing: 0.5 }}>
        AI ASSESSMENT
      </div>
      <div style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.5, marginTop: 3 }}>
        {loading ? 'Reading the report against the operating model…' : text}
      </div>
    </div>
  );
}

function SeverityColumn({ severity, report }: { severity: ImpactSeverity; report: ImpactReport }) {
  const m = SEVERITY_META[severity];
  const items = report.impacts.filter((i) => i.severity === severity);
  return (
    <div
      style={{
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        borderRadius: 8,
        border: `1px solid ${items.length ? m.border : '#f1f5f9'}`,
        background: items.length ? m.bg : '#fafafa',
        padding: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: items.length ? m.fg : '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          {m.label}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: items.length ? m.fg : '#cbd5e1' }}>
          {items.length}
        </span>
      </div>
      {items.length === 0 && <div style={{ fontSize: 10.5, color: '#a3a3a3' }}>Nothing here.</div>}
      {items.map((impact, i) => (
        <div
          key={`${impact.category}:${impact.entityId ?? impact.entityName}:${i}`}
          style={{
            background: '#fff',
            border: '1px solid rgba(0,0,0,.06)',
            borderRadius: 7,
            padding: '6px 8px',
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#171717', lineHeight: 1.3 }}>
            {impact.entityName}
          </div>
          <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>
            {CATEGORY_LABELS[impact.category] ?? impact.category}
          </div>
          <div style={{ fontSize: 10.5, color: '#525252', lineHeight: 1.45, marginTop: 3 }}>
            {impact.description}
          </div>
        </div>
      ))}
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
        paddingTop: 60,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Change impact assessment — ${subjectName}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 1020,
          maxWidth: 'calc(100% - 48px)',
          maxHeight: 'calc(100vh - 100px)',
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
          <div style={{ fontSize: 10.5, fontWeight: 700, color: LOGO_BLUE, letterSpacing: 0.4 }}>
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
                background: destructive ? '#dc2626' : LOGO_BLUE,
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
              <AiAssessment report={report} />
              {report.impacts.length === 0 ? (
                <div style={{ padding: '18px 16px', fontSize: 12, color: '#737373' }}>
                  Nothing else in the model touches this — the change is self-contained.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 10,
                    padding: '12px 16px 14px',
                    alignItems: 'start',
                  }}
                >
                  {SEVERITIES.map((sev) => (
                    <SeverityColumn key={sev} severity={sev} report={report} />
                  ))}
                </div>
              )}
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
              background: destructive ? '#dc2626' : LOGO_BLUE,
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
