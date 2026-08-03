import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { DOMAIN_META, type Impact, type ImpactReport, type ImpactRequest } from './types';

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
@keyframes impactPing {
  0% { transform: scale(0.35); opacity: 0.8; }
  100% { transform: scale(1); opacity: 0; }
}
@keyframes impactGlow {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}
@keyframes impactRise {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

/** Fake-but-honest sequential progress: one domain "locks in" every couple of
 *  seconds while the real single-shot analysis runs; the last stays scanning
 *  until the response actually lands and the parent swaps to the report. */
const STEP_MS = 2300;

function StatusIcon({ state }: { state: 'done' | 'active' | 'pending' }) {
  if (state === 'done') {
    return (
      <span
        style={{
          width: 15,
          height: 15,
          borderRadius: '50%',
          background: LOGO_BLUE,
          color: '#fff',
          fontSize: 9.5,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'impactRise 0.25s ease-out',
        }}
      >
        ✓
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span style={{ position: 'relative', width: 15, height: 15, display: 'inline-block' }}>
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid ${LOGO_BLUE}`,
            animation: 'impactPing 1.1s ease-out infinite',
          }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 2,
            borderRadius: '50%',
            border: '2px solid #dbeafe',
            borderTopColor: LOGO_BLUE,
            animation: 'impactSpin 0.8s linear infinite',
          }}
        />
      </span>
    );
  }
  return (
    <span
      style={{
        width: 15,
        height: 15,
        borderRadius: '50%',
        border: '2px solid #e2e8f0',
        display: 'inline-block',
      }}
    />
  );
}

/** The futuristic "checking every system" view shown INSTEAD of the report
 *  body while the assessment + AI deep-dive run. A radar sweeps in the middle
 *  and the six impact domains light up one by one beneath it. */
export function ScannerView({ subjectName }: { subjectName: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, DOMAIN_META.length - 1)), STEP_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        padding: '26px 24px 30px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
      }}
    >
      {/* Radar */}
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        {[0, 1].map((i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `1.5px solid ${LOGO_BLUE}`,
              animation: `impactPing 2.2s ${i * 1.1}s ease-out infinite`,
            }}
          />
        ))}
        <span
          style={{
            position: 'absolute',
            inset: 10,
            borderRadius: '50%',
            border: '1px solid #dbeafe',
          }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 26,
            borderRadius: '50%',
            border: '1px solid #e8f1f7',
          }}
        />
        {/* Sweep */}
        <span
          style={{
            position: 'absolute',
            inset: 10,
            borderRadius: '50%',
            background: `conic-gradient(from 0deg, rgba(0,112,173,0.35), rgba(0,112,173,0.06) 70deg, transparent 110deg)`,
            animation: 'impactSpin 2.4s linear infinite',
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 8,
            height: 8,
            marginTop: -4,
            marginLeft: -4,
            borderRadius: '50%',
            background: LOGO_BLUE,
            animation: 'impactGlow 1.4s ease-in-out infinite',
          }}
        />
      </div>

      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: LOGO_BLUE,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          Impact analysis in progress
        </div>
        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
          Tracing everything “{subjectName}” touches across the operating model
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
        </div>
      </div>

      {/* Domain checklist — lights up sequentially */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 260px))',
          gap: '8px 26px',
          width: '100%',
          maxWidth: 620,
        }}
      >
        {DOMAIN_META.map((d, i) => {
          const state: 'done' | 'active' | 'pending' =
            i < step ? 'done' : i === step ? 'active' : 'pending';
          return (
            <div
              key={d.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '7px 10px',
                borderRadius: 8,
                border: `1px solid ${state === 'pending' ? '#f1f5f9' : '#dbeafe'}`,
                background: state === 'active' ? '#f0f7fb' : '#fff',
                transition: 'background 0.3s, border-color 0.3s',
              }}
            >
              <StatusIcon state={state} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: state === 'pending' ? '#94a3b8' : '#171717',
                    ...(state === 'active' ? { animation: 'impactGlow 1.3s infinite' } : {}),
                  }}
                >
                  {d.label}
                </div>
                <div style={{ fontSize: 9, color: '#94a3b8' }}>
                  {state === 'done'
                    ? 'Checked'
                    : state === 'active'
                      ? `Scanning ${d.areas}`
                      : d.areas}
                </div>
              </div>
            </div>
          );
        })}
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
