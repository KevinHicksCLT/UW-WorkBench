// automatable — agent-automatability scale math + the per-task meter render.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  AutomatableMeter,
  automatablePct,
  isAutomatable,
  SCORE_COLOR,
  SCORE_LABEL,
  scoreToPct,
} from '../../src/lib/automatable';

describe('isAutomatable', () => {
  it('is true only for scores 1 and 2 (Workflow + Autonomous tiers)', () => {
    expect(isAutomatable(1)).toBe(true);
    expect(isAutomatable(2)).toBe(true);
    expect(isAutomatable(3)).toBe(false);
    expect(isAutomatable(5)).toBe(false);
  });

  it('is false for missing scores', () => {
    expect(isAutomatable(null)).toBe(false);
    expect(isAutomatable(undefined)).toBe(false);
  });
});

describe('automatablePct', () => {
  it('computes automatable / scored, excluding unscored tasks from the denominator', () => {
    expect(automatablePct([1, 2, 3, null, undefined])).toEqual({ pct: 67, auto: 2, scored: 3 });
  });

  it('returns null when nothing is scored', () => {
    expect(automatablePct([])).toBeNull();
    expect(automatablePct([null, undefined])).toBeNull();
  });

  it('rounds to a whole percent', () => {
    expect(automatablePct([1, 5, 5])?.pct).toBe(33);
  });
});

describe('scoreToPct', () => {
  it('maps the 1–5 scale linearly: 1→100, 2→75, 3→50, 4→25, 5→0', () => {
    expect([1, 2, 3, 4, 5].map(scoreToPct)).toEqual([100, 75, 50, 25, 0]);
  });

  it('returns null for missing scores', () => {
    expect(scoreToPct(null)).toBeNull();
    expect(scoreToPct(undefined)).toBeNull();
  });
});

describe('AutomatableMeter', () => {
  it('renders a muted dash for unscored tasks', () => {
    const { container } = render(<AutomatableMeter score={null} />);
    expect(container.textContent).toBe('—');
  });

  it('fills (6 − score) of five segments in the score color and shows the label', () => {
    const { container, getByText } = render(<AutomatableMeter score={2} />);
    const segments = container.querySelectorAll('span[aria-hidden] > span');
    expect(segments).toHaveLength(5);
    const filled = Array.from(segments).filter(
      (s) => (s as HTMLElement).style.background === 'rgb(101, 163, 13)', // SCORE_COLOR[2]
    );
    expect(filled).toHaveLength(4); // 6 - 2
    expect(getByText(SCORE_LABEL[2])).toBeInTheDocument();
  });

  it('puts the score, label, description, and rationale into the title', () => {
    const { container } = render(<AutomatableMeter score={5} rationale="Requires sign-off" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.title).toContain('5/5');
    expect(root.title).toContain(SCORE_LABEL[5]);
    expect(root.title).toContain('Requires sign-off');
  });

  it('keeps a color defined for every score', () => {
    for (const s of [1, 2, 3, 4, 5]) expect(SCORE_COLOR[s]).toMatch(/^#[0-9a-f]{6}$/);
  });
});
