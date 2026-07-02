// portfolio — shared Initiative-Tracker helpers and themed primitives: pure
// date/scale math, pills/bars/tiles/modal DOM, risk bands (api mocked), and the
// SVG line chart.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../src/lib/api', () => ({ api: apiMock }));

import {
  BarList,
  bandFor,
  FALLBACK_BANDS,
  generateMonths,
  makeTimelineScale,
  Modal,
  monthKeysFromLines,
  SectionCard,
  SeverityCell,
  StageBar,
  StageChip,
  StatusPill,
  SvgLineChart,
  Tile,
  TimelineAxis,
  TimelineGrid,
  withCompany,
} from '../../src/lib/portfolio';
import type { Line, RiskBand } from '../../src/lib/portfolio';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('withCompany', () => {
  it('appends companyId with ? or & as appropriate', () => {
    expect(withCompany('/portfolio', 'c1')).toBe('/portfolio?companyId=c1');
    expect(withCompany('/portfolio?x=1', 'c1')).toBe('/portfolio?x=1&companyId=c1');
    expect(withCompany('/portfolio', null)).toBe('/portfolio');
  });
});

describe('StatusPill / StageBar / StageChip', () => {
  it('StatusPill maps known statuses and falls back to pill-slate', () => {
    const { container } = render(<StatusPill status="ON_TRACK" />);
    expect(container.firstElementChild?.getAttribute('class')).toBe('pill-green');
    expect(container.firstElementChild).toHaveTextContent('On Track');

    const { container: c2 } = render(<StatusPill status="MYSTERY" />);
    expect(c2.firstElementChild?.getAttribute('class')).toBe('pill-slate');
    expect(c2.firstElementChild).toHaveTextContent('MYSTERY');
  });

  it('StageBar fills one pip per reached stage', () => {
    const { container } = render(<StageBar stage="EXECUTE" />);
    const pips = container.querySelectorAll('.stage-pip');
    expect(pips).toHaveLength(4);
    expect(container.querySelectorAll('.stage-pip-filled')).toHaveLength(3); // IDEA, PLAN, EXECUTE
    expect(container.querySelectorAll('.stage-pip-empty')).toHaveLength(1);
  });

  it('StageChip shows the 1-based stage index and label', () => {
    render(<StageChip stage="PLAN" />);
    expect(screen.getByText('2. Plan')).toBeInTheDocument();
  });
});

describe('risk bands', () => {
  const BANDS: RiskBand[] = [
    { id: 'b1', label: 'Low', minScore: 1, maxScore: 8, color: '#047857', description: null },
    { id: 'b2', label: 'High', minScore: 9, maxScore: 25, color: '#be123c', description: 'act now' },
  ];

  it('bandFor picks the inclusive band, null outside every band', () => {
    expect(bandFor(BANDS, 1)?.label).toBe('Low');
    expect(bandFor(BANDS, 8)?.label).toBe('Low');
    expect(bandFor(BANDS, 9)?.label).toBe('High');
    expect(bandFor(BANDS, 0)).toBeNull();
    expect(bandFor([], 5)).toBeNull();
  });

  it('FALLBACK_BANDS cover the whole 1–25 matrix', () => {
    for (let s = 1; s <= 25; s++) expect(bandFor(FALLBACK_BANDS, s)).not.toBeNull();
  });

  it('SeverityCell renders the rating label (score stays in the tooltip)', async () => {
    apiMock.get.mockResolvedValue({ bands: BANDS });
    render(<SeverityCell value={12} />);
    await waitFor(() => expect(screen.getByText('High')).toBeInTheDocument());
    const el = screen.getByText('High');
    expect(el.title).toContain('12 of 25');
    expect(el.title).toContain('act now');
    expect(apiMock.get).toHaveBeenCalledWith('/portfolio/risk-bands');
  });

  it('SeverityCell reuses the session cache on subsequent renders', async () => {
    render(<SeverityCell value={3} />);
    await waitFor(() => expect(screen.getByText('Low')).toBeInTheDocument());
    expect(apiMock.get).not.toHaveBeenCalled(); // bands were cached by the previous test
  });
});

describe('Tile / SectionCard / BarList / Modal', () => {
  it('Tile renders label/value/hint with tone colors', () => {
    const { container } = render(<Tile label="Net benefit" value="$1.2M" hint="12 mo" tone="positive" />);
    expect(screen.getByText('Net benefit')).toBeInTheDocument();
    expect(screen.getByText('12 mo')).toBeInTheDocument();
    expect(container.querySelector('.text-\\[\\#047857\\]')).toHaveTextContent('$1.2M');
  });

  it('Tile compact mode renders the denser card (optionally centered)', () => {
    const { container } = render(<Tile label="Risks" value={7} compact center tone="negative" />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('px-3 py-1.5');
    expect(card.className).toContain('text-center');
    expect(container.querySelector('.text-\\[\\#be123c\\]')).toHaveTextContent('7');
  });

  it('SectionCard renders title, actions, and children', () => {
    render(
      <SectionCard title="Milestones" actions={<button>Add</button>}>
        <p>rows</p>
      </SectionCard>,
    );
    expect(screen.getByText('Milestones')).toBeInTheDocument();
    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.getByText('rows')).toBeInTheDocument();
  });

  it('BarList scales bar widths against the max count', () => {
    const { container } = render(<BarList groups={[{ key: 'A', count: 10 }, { key: 'B', count: 5 }, { key: 'C', count: 0 }]} />);
    const bars = container.querySelectorAll('.h-full.rounded');
    expect((bars[0] as HTMLElement).style.width).toBe('100%');
    expect((bars[1] as HTMLElement).style.width).toBe('50%');
    expect((bars[2] as HTMLElement).style.width).toBe('0%');
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('Modal closes on backdrop click but not on panel click', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal title="Edit" onClose={onClose}>
        <p>form</p>
      </Modal>,
    );
    fireEvent.click(screen.getByText('form')); // inside the panel → stopPropagation
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.firstElementChild as HTMLElement); // backdrop
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });
});

describe('SvgLineChart', () => {
  it('renders the empty state when there are no labels', () => {
    const { container } = render(<SvgLineChart labels={[]} series={[]} />);
    expect(container).toHaveTextContent('No data yet.');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders a polyline per series plus a legend', () => {
    const { container } = render(
      <SvgLineChart
        labels={['2026-01', '2026-02', '2026-03']}
        series={[
          { name: 'Benefit', color: '#047857', data: [0, 10, 20] },
          { name: 'Cost', color: '#be123c', data: [5, 5, 5], dashed: true },
        ]}
      />,
    );
    const lines = container.querySelectorAll('polyline');
    expect(lines).toHaveLength(2);
    expect(lines[1].getAttribute('stroke-dasharray')).toBe('5 4');
    expect(screen.getByText('Benefit')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
    // Max gridline label uses the formatter default (rounded).
    expect(screen.getByText('20')).toBeInTheDocument();
  });
});

describe('timeline scale', () => {
  it('returns null when no parseable dates exist', () => {
    expect(makeTimelineScale([])).toBeNull();
    expect(makeTimelineScale(['not-a-date'])).toBeNull();
  });

  it('pads two weeks either side and clamps pct to 0..100', () => {
    const scale = makeTimelineScale(['2026-01-01', '2026-03-01']);
    expect(scale).not.toBeNull();
    expect(scale!.pct('2025-01-01')).toBe(0); // before min → clamped
    expect(scale!.pct('2027-01-01')).toBe(100); // after max → clamped
    const mid = scale!.pct('2026-02-01');
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(100);
  });

  it('generates month ticks with month-name labels', () => {
    const scale = makeTimelineScale(['2026-01-15', '2026-04-15']);
    expect(scale!.ticks.length).toBeGreaterThanOrEqual(3);
    expect(scale!.ticks[0].label).toMatch(/^[A-Z][a-z]{2} \d{2}$/); // e.g. "Feb 26"
  });

  it('generates quarter ticks in quarter mode', () => {
    const scale = makeTimelineScale(['2026-01-01', '2027-06-30'], 'quarter');
    expect(scale!.ticks[0].label).toMatch(/^Q[1-4] '\d{2}$/);
  });

  it('TimelineGrid and TimelineAxis render one node per tick', () => {
    const scale = makeTimelineScale(['2026-01-15', '2026-04-15'])!;
    const grid = render(<TimelineGrid scale={scale} />);
    expect(grid.container.querySelectorAll('.border-l')).toHaveLength(scale.ticks.length);
    const axis = render(<TimelineAxis scale={scale} />);
    expect(axis.container.querySelectorAll('span')).toHaveLength(scale.ticks.length);
  });
});

describe('month helpers', () => {
  const line = (values: { periodStart: string; amount: number }[]): Line => ({
    id: 'l1',
    name: 'Benefit',
    category: null,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    values: values.map((v) => ({ dataset: 'ACTUAL', ...v })),
  });

  it('monthKeysFromLines collects sorted distinct YYYY-MM keys across line sets', () => {
    const a = [line([{ periodStart: '2026-03-01', amount: 1 }, { periodStart: '2026-01-01', amount: 2 }])];
    const b = [line([{ periodStart: '2026-03-15', amount: 3 }, { periodStart: '2026-02-01', amount: 4 }])];
    expect(monthKeysFromLines(a, b)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('generateMonths spans the contiguous range inclusive of the start month', () => {
    expect(generateMonths('2026-11-15', '2027-02-10')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });
});
