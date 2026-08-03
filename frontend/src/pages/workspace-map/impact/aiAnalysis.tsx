import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import type { Impact, ImpactReport, ImpactRequest } from './types';

// The AI layer of the impact panel: a fast narrated read of the whole report
// (POST /impact/summary) and the deep-dive that derives specific knock-on
// impacts for every domain (POST /impact/analyze). Both are enrichment over
// the deterministic report — they can be slow or unavailable without ever
// blocking the panel.

/** Capgemini wordmark blue (capgemini-wordmark.svg primary fill). */
export const LOGO_BLUE = '#0070AD';

/** Keyframes for the analyzing state — injected once by the panel. */
export const IMPACT_ANIM_CSS = `
@keyframes impactSweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
@keyframes impactSpin {
  to { transform: rotate(360deg); }
}
@keyframes impactDot {
  0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
`;

/** The indeterminate scanning bar shown in each domain card while the
 *  deep-dive is running. */
export function AnalyzingRow() {
  return (
    <div
      style={{
        border: '1px dashed #dbeafe',
        background: '#f8fbfd',
        borderRadius: 7,
        padding: '8px 8px 9px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          aria-hidden
          style={{
            width: 11,
            height: 11,
            borderRadius: '50%',
            border: '2px solid #dbeafe',
            borderTopColor: LOGO_BLUE,
            animation: 'impactSpin 0.9s linear infinite',
          }}
        />
        <span style={{ fontSize: 10.5, color: '#64748b' }}>
          Deriving knock-on effects
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginLeft: 1,
                animation: `impactDot 1.2s ${i * 0.2}s infinite`,
              }}
            >
              .
            </span>
          ))}
        </span>
      </div>
      <div
        style={{
          marginTop: 7,
          height: 3,
          borderRadius: 2,
          background: '#e8f1f7',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '30%',
            borderRadius: 2,
            background: `linear-gradient(90deg, transparent, ${LOGO_BLUE}, transparent)`,
            animation: 'impactSweep 1.4s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}

/** Runs the deep-dive once per report; the panel merges the returned lines
 *  into the domain cards as they land. */
export function useAiAnalysis(
  report: ImpactReport | null,
  request: ImpactRequest | null,
): { loading: boolean; impacts: Impact[] } {
  const [state, setState] = useState<{ loading: boolean; impacts: Impact[] }>({
    loading: false,
    impacts: [],
  });

  useEffect(() => {
    if (!report || !request) return;
    let alive = true;
    setState({ loading: true, impacts: [] });
    api
      .post(
        '/impact/analyze',
        {
          changeType: report.changeType,
          subject: request.subject,
          subjectName: report.subject.name.slice(0, 300),
          subjectContext: report.subject.context?.slice(0, 400) ?? null,
          reportLines: report.impacts.slice(0, 60).map((i) => ({
            domain: i.domain,
            severity: i.severity,
            entityName: i.entityName.slice(0, 300),
            description: i.description.slice(0, 500),
          })),
        },
        { invalidate: 'none' },
      )
      .then((r) => {
        if (!alive) return;
        setState({ loading: false, impacts: (r as { impacts: Impact[] }).impacts ?? [] });
      })
      .catch(() => {
        if (!alive) return;
        setState({ loading: false, impacts: [] });
      });
    return () => {
      alive = false;
    };
  }, [report, request]);

  return state;
}

/** Narrates the deterministic report via POST /impact/summary (Haiku behind a
 *  hard 4s server race). Renders nothing when the AI is unavailable or slow —
 *  the report itself is never blocked on this. */
export function AiAssessment({ report }: { report: ImpactReport }) {
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
            domain: i.domain,
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
