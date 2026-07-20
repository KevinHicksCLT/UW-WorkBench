import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AMBER } from './types';

// The review-decision modal shared by the Applications and Products boards.
// Inline Approve/Hold buttons hid what a decision MEANS; this modal lays out
// everything needed to decide — what the item is, what's being asked, and how
// every compared source carries (or misses) it — then offers the choices as
// explicit consequence cards. Rendered through a portal so the board canvas's
// CSS zoom never scales it.

export interface ReviewSource {
  key: string;
  /** Source column name — the version or application. */
  name: string;
  sub?: string;
  present: boolean;
  /** The element/finding as this source carries it. */
  title?: string;
  detail?: string;
  code?: string;
}

export interface ReviewChoice {
  key: string;
  label: string;
  /** Plain-language consequence of picking this choice. */
  explain: string;
  tone: 'adopt' | 'hold';
  /** Marks the decision already in force — shown, not clickable. */
  current?: boolean;
}

export interface ReviewStatusChip {
  label: string;
  fg: string;
  bg: string;
  border: string;
}

const CHOICE_TONES = {
  adopt: { bg: '#f0fdf4', border: '#86efac', fg: '#15803d', icon: '✓' },
  hold: { bg: '#fffbeb', border: '#fcd34d', fg: '#92400e', icon: '⏸' },
} as const;

function ChoiceCard({
  choice,
  busy,
  anyBusy,
  onChoose,
}: {
  choice: ReviewChoice;
  busy: boolean;
  anyBusy: boolean;
  onChoose: (key: string) => void;
}) {
  const t = CHOICE_TONES[choice.tone];
  return (
    <button
      type="button"
      disabled={anyBusy || choice.current}
      onClick={() => onChoose(choice.key)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        textAlign: 'left',
        font: 'inherit',
        padding: '10px 12px',
        borderRadius: 10,
        border: `1.5px solid ${t.border}`,
        background: t.bg,
        cursor: anyBusy || choice.current ? 'default' : 'pointer',
        opacity: anyBusy && !busy ? 0.55 : 1,
        boxShadow: choice.current ? `0 0 0 2px ${t.border}` : 'none',
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: '#fff',
          border: `1.5px solid ${t.border}`,
          color: t.fg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {t.icon}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            fontSize: 13,
            fontWeight: 700,
            color: t.fg,
          }}
        >
          {busy ? `${choice.label}…` : choice.label}
          {choice.current && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '.06em',
                padding: '1px 6px',
                borderRadius: 999,
                background: '#fff',
                border: `1px solid ${t.border}`,
              }}
            >
              CURRENT CHOICE
            </span>
          )}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 11.5,
            color: '#404040',
            lineHeight: 1.5,
            marginTop: 2,
          }}
        >
          {choice.explain}
        </span>
      </span>
    </button>
  );
}

function SourceRow({ s }: { s: ReviewSource }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '170px 1fr',
        gap: 10,
        padding: '7px 10px',
        borderTop: '1px solid #f1f5f9',
        background: s.present ? '#fff' : '#fafafa',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.3 }}>{s.name}</div>
        {s.sub && <div style={{ fontSize: 10, color: '#a3a3a3' }}>{s.sub}</div>}
      </div>
      {s.present ? (
        <div style={{ minWidth: 0 }}>
          {s.title && <div style={{ fontSize: 11.5, fontWeight: 600 }}>{s.title}</div>}
          {s.detail && (
            <div style={{ fontSize: 10.5, color: '#525252', lineHeight: 1.45 }}>{s.detail}</div>
          )}
          {s.code && (
            <div
              style={{
                fontSize: 9.5,
                color: '#a3a3a3',
                fontFamily: 'ui-monospace, monospace',
                wordBreak: 'break-all',
              }}
            >
              {s.code}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#a3a3a3', alignSelf: 'center' }}>
          — not present in this source
        </div>
      )}
    </div>
  );
}

export default function ReviewModal({
  open,
  onClose,
  title,
  status,
  context,
  question,
  sources,
  sourcesLabel,
  choices,
  busyKey,
  error,
  onChoose,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  status: ReviewStatusChip;
  /** Where this item lives — component/layer + board. */
  context: string;
  /** What needs deciding, in the author's words (difference note / proposal). */
  question?: string | null;
  sources: ReviewSource[];
  sourcesLabel: string;
  choices: ReviewChoice[];
  busyKey: string | null;
  error?: string;
  onChoose: (key: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Review ${title}`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(680px, 94vw)',
          maxHeight: '86vh',
          overflow: 'auto',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 20px 50px rgba(15,23,42,.30)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '14px 16px 10px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '1px 8px',
                  borderRadius: 999,
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                  color: status.fg,
                  background: status.bg,
                  border: `1px solid ${status.border}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {status.label}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
            </div>
            <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 3 }}>{context}</div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              color: '#a3a3a3',
              fontSize: 18,
              lineHeight: 1,
              cursor: 'pointer',
              padding: 2,
              font: 'inherit',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {question && (
            <div
              style={{
                border: '1px solid #fde68a',
                background: '#fffbeb',
                borderRadius: 8,
                padding: '8px 11px',
                fontSize: 11.5,
                color: '#92400e',
                lineHeight: 1.5,
              }}
            >
              <b style={{ fontWeight: 700 }}>What needs deciding · </b>
              {question}
            </div>
          )}

          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: '#64748b',
                marginBottom: 4,
              }}
            >
              {sourcesLabel}
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              {sources.map((s) => (
                <SourceRow key={s.key} s={s} />
              ))}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: '#64748b',
                marginBottom: 4,
              }}
            >
              Your decision
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {choices.map((c) => (
                <ChoiceCard
                  key={c.key}
                  choice={c}
                  busy={busyKey === c.key}
                  anyBusy={busyKey != null}
                  onChoose={onChoose}
                />
              ))}
            </div>
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px 14px',
            borderTop: '1px solid #f1f5f9',
          }}
        >
          {error && <span style={{ fontSize: 11, color: '#dc2626', flex: 1 }}>{error}</span>}
          {!error && (
            <span style={{ fontSize: 11, color: '#a3a3a3', flex: 1 }}>
              Nothing changes until you pick an option.
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid #e5e5e5',
              background: '#fff',
              color: '#525252',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            Decide later
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Status chips the two boards share. */
export const REVIEW_STATUS: Record<'review' | 'held', ReviewStatusChip> = {
  review: { label: 'Needs review', fg: '#92400e', bg: '#fffbeb', border: AMBER },
  held: { label: 'On hold', fg: '#475569', bg: '#f8fafc', border: '#cbd5e1' },
};
