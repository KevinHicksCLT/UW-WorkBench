// The Products workspace's north-star strip: names the normalization end goal
// (one consolidated multi-state policy per line of business) and how far the
// current scope has moved toward it. Decisions are persisted server-side
// (ProductNormalizationDecision), so the figure survives leaving the board and
// returning from any workflow — the strip says so explicitly.

const LOGO_BLUE = '#0070AD';

export default function GoalBanner({
  scopeLabel,
  decided,
  need,
  pct,
}: {
  /** What the figures cover — a LOB name or "N products in scope". */
  scopeLabel: string;
  decided: number;
  need: number;
  pct: number;
}) {
  const done = need > 0 && decided >= need;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 14px',
        background: '#f0f7fb',
        borderBottom: '1px solid #dbeafe',
        flexShrink: 0,
      }}
    >
      <span aria-hidden style={{ fontSize: 13 }}>
        🎯
      </span>
      <span style={{ fontSize: 11.5, color: '#334155', flex: 1, lineHeight: 1.4 }}>
        <b style={{ color: LOGO_BLUE }}>End goal:</b> one consolidated multi-state policy per line
        of business. {scopeLabel} — <b>{pct}% normalized</b> ({decided} of {need} decisions made
        {done ? ' · complete' : ''}). Decisions save automatically; pick up where you left off from
        any workflow.
      </span>
      <span
        style={{
          width: 120,
          height: 6,
          borderRadius: 9,
          background: '#e2e8f0',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: 'block',
            height: 6,
            width: `${Math.min(100, pct)}%`,
            background: done ? '#16a34a' : LOGO_BLUE,
          }}
        />
      </span>
    </div>
  );
}
